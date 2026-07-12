"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sampleCharacterRnn } from "../lib/lab-engines";
import { loadLearnerState, saveCharacterRnnArtifact, type SavedRnnArtifact } from "../lib/learner-state";
import { useProjectState } from "../lib/project-workspace";
import { loadCapstoneConversation, persistCapstoneConversation } from "../features/capstone/conversation-store";
import { LocalModelClient } from "../runtime/model/local-model-client";
import type { ModelMessage } from "../runtime/model/protocol";
import { trainCharacterRnnInWorker } from "../runtime/model/train-character-client";
import { getPersistenceContext } from "../platform/persistence/client";
import { createMockServingStream } from "@latent/mock-services/sse";
import {
  loadValidatedCapstoneBundle,
  type CapstoneRuntimeDescriptor,
} from "../runtime/bindings";
import {
  mountPreviewFrame,
  PREVIEW_REACT_RUNTIME_PATH,
  verifyPreviewBundle,
  verifyPreviewRuntime,
  type PreviewFrameSession,
  type PreviewJson,
  type PreviewRequestMessage,
  type ValidatedPreviewBundle,
  type ValidatedPreviewRuntime,
} from "../runtime/capstone/preview-frame";
import type { CapstoneBackend, PersistedChatMessage } from "../lib/capstone-contract";

const ALLOWED_METHODS = new Set(["initialize", "train-student", "load-local", "generate", "cancel", "persist"]);

type GenerationPayload = {
  requestId: string;
  backend: CapstoneBackend;
  messages: ModelMessage[];
  requestFrame: string;
  options: { temperature: number; topK: number; maxTokens: number };
};

type HostStatus = "loading" | "ready" | "missing" | "error";

export type CapabilityAdmission =
  | "accepted"
  | "model-preparation-busy"
  | "duplicate-generation"
  | "generation-busy";

/** Pure admission gate kept outside the iframe's control. */
export class CapstoneCapabilityGate {
  #preparation: "train" | "load" | null = null;
  readonly #generations = new Set<string>();

  beginPreparation(kind: "train" | "load"): CapabilityAdmission {
    if (this.#preparation) return "model-preparation-busy";
    if (this.#generations.size) return "generation-busy";
    this.#preparation = kind;
    return "accepted";
  }

  finishPreparation(kind: "train" | "load"): void {
    if (this.#preparation === kind) this.#preparation = null;
  }

  beginGeneration(requestId: string): CapabilityAdmission {
    if (this.#preparation) return "model-preparation-busy";
    if (this.#generations.has(requestId)) return "duplicate-generation";
    if (this.#generations.size) return "generation-busy";
    this.#generations.add(requestId);
    return "accepted";
  }

  finishGeneration(requestId: string): void {
    this.#generations.delete(requestId);
  }

  reset(): void {
    this.#preparation = null;
    this.#generations.clear();
  }
}

const COURSE_GROUNDING = [
  {
    terms: ["causal", "mask", "future"],
    minTerms: 2,
    answer: "A causal mask prevents position t from attending to future positions. Those logits receive zero probability after softmax, so a token cannot read the target it is supposed to predict.",
  },
  {
    terms: ["sse", "stream", "chunk"],
    minTerms: 1,
    answer: "SSE events end with a blank line, while network chunks can split anywhere. A correct parser retains incomplete bytes and emits only complete events.",
  },
  {
    terms: ["token", "subword", "bpe"],
    minTerms: 1,
    answer: "Subword tokenization learns frequent symbol merges. Common sequences become shorter while rare words remain representable as smaller units.",
  },
];

function groundedAnswer(question: string, draft: string) {
  const normalized = question.toLowerCase();
  const match = COURSE_GROUNDING.find((entry) => entry.terms.filter((term) => normalized.includes(term)).length >= entry.minTerms);
  return match ? `Grounded course answer:\n\n${match.answer}` : `Unverified local draft:\n\n${draft}`;
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number, integer = false) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const bounded = Math.min(maximum, Math.max(minimum, numeric));
  return integer ? Math.round(bounded) : bounded;
}

function generationPayload(value: PreviewJson): GenerationPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, PreviewJson>;
  const backend = candidate.backend;
  const requestId = candidate.requestId;
  const requestFrame = candidate.requestFrame;
  const rawMessages = candidate.messages;
  const rawOptions = candidate.options;
  if ((backend !== "student" && backend !== "local") || typeof requestId !== "string" || requestId.length > 128
    || typeof requestFrame !== "string" || requestFrame.length > 64_000 || !Array.isArray(rawMessages)
    || rawMessages.length > 32 || !rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions)) return null;
  const messages: ModelMessage[] = [];
  let characters = 0;
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const message = raw as Record<string, PreviewJson>;
    if ((message.role !== "system" && message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return null;
    characters += message.content.length;
    if (characters > 48_000) return null;
    messages.push({ role: message.role, content: message.content });
  }
  const options = rawOptions as Record<string, PreviewJson>;
  return {
    requestId,
    backend,
    messages,
    requestFrame,
    options: {
      temperature: boundedNumber(options.temperature, 0.72, 0.2, 1.8),
      topK: boundedNumber(options.topK, 24, 0, 64, true),
      maxTokens: boundedNumber(options.maxTokens, 160, 40, 240, true),
    },
  };
}

function safeConversationMessages(value: PreviewJson): PersistedChatMessage[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, PreviewJson>;
  const record = payload.record;
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const candidate = record as Record<string, PreviewJson>;
  if (candidate.version !== 1 || typeof candidate.id !== "string" || !Array.isArray(candidate.messages) || candidate.messages.length > 200 || "apiKey" in candidate) return null;
  const messages: PersistedChatMessage[] = [];
  let characters = 0;
  for (const raw of candidate.messages) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const message = raw as Record<string, PreviewJson>;
    if (typeof message.id !== "string" || (message.role !== "user" && message.role !== "assistant")
      || (message.backend !== "student" && message.backend !== "local") || typeof message.content !== "string"
      || (message.status !== "complete" && message.status !== "cancelled" && message.status !== "error")) return null;
    characters += message.content.length;
    if (characters > 200_000) return null;
    messages.push({
      id: message.id,
      role: message.role,
      backend: message.backend,
      content: message.content,
      status: message.status,
      ...(typeof message.attemptId === "string" ? { attemptId: message.attemptId } : {}),
      ...(typeof message.parentUserId === "string" ? { parentUserId: message.parentUserId } : {}),
    });
  }
  return messages;
}

function portableMessages(messages: PersistedChatMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    backend: message.backend,
    ...(message.attemptId ? { attemptId: message.attemptId } : {}),
    ...(message.parentUserId ? { parentUserId: message.parentUserId } : {}),
  }));
}

export function BrowserChatCapstone() {
  const project = useProjectState();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<PreviewFrameSession | null>(null);
  const studentRef = useRef<SavedRnnArtifact | null>(null);
  const localModelRef = useRef<LocalModelClient | null>(null);
  const localReadyRef = useRef(false);
  const [bundle, setBundle] = useState<ValidatedPreviewBundle | null>(null);
  const [reactRuntime, setReactRuntime] = useState<ValidatedPreviewRuntime | null>(null);
  const [descriptor, setDescriptor] = useState<CapstoneRuntimeDescriptor | null>(null);
  const [status, setStatus] = useState<HostStatus>("loading");
  const [detail, setDetail] = useState("Loading the last passing project build…");
  const [runRequested, setRunRequested] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setStatus("loading");
      setBundle(null);
      setReactRuntime(null);
      setDescriptor(null);
      setRunRequested(false);
      setDetail("Loading the last passing project build…");
      const { repositories } = await getPersistenceContext();
      const build = await repositories.builds.active("browser-chat");
      if (!build) {
        if (active) { setStatus("missing"); setDetail("No passing canonical project build exists on this device yet."); }
        return;
      }
      const loaded = await loadValidatedCapstoneBundle(build);
      const runtimeResponse = await fetch(PREVIEW_REACT_RUNTIME_PATH, {
        cache: "force-cache",
        credentials: "same-origin",
      });
      if (!runtimeResponse.ok) throw new Error("The trusted React preview runtime is unavailable.");
      const [verified, verifiedRuntime] = await Promise.all([
        verifyPreviewBundle({
          projectId: loaded.descriptor.projectId,
          buildId: loaded.descriptor.buildId,
          buildNumber: loaded.descriptor.buildNumber,
          projectRevision: loaded.descriptor.projectRevision,
          sourceHash: loaded.descriptor.fingerprints.sourceTree,
          entryPath: loaded.entryPath,
          code: loaded.code,
          codeHash: loaded.codeHash,
        }),
        runtimeResponse.text().then((source) => verifyPreviewRuntime(source)),
      ]);
      if (!active) return;
      setDescriptor(loaded.descriptor);
      setBundle(verified);
      setReactRuntime(verifiedRuntime);
      setStatus("ready");
      setDetail(`Build ${loaded.descriptor.buildNumber} is verified. It runs with isolated host capabilities; a synchronous loop can still require reloading this tab.`);
    })().catch((error) => {
      if (!active) return;
      setStatus("error");
      setDetail(error instanceof Error ? error.message : "The active capstone build could not be verified.");
    });
    return () => { active = false; };
  }, [project.runtime.buildNumber]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !bundle || !reactRuntime || !descriptor || !runRequested) return;
    let disposed = false;
    const capabilityGate = new CapstoneCapabilityGate();
    const generationRequests = new Map<string, AbortController>();
    let trainingController: AbortController | null = null;

    const emit = (requestId: string, event: string, payload: PreviewJson) => {
      if (disposed) return;
      try { sessionRef.current?.emit(requestId, event, payload); } catch { /* The frame may have closed. */ }
    };
    const respond = (requestId: string, value: PreviewJson) => {
      if (disposed) return;
      try { sessionRef.current?.respond(requestId, value); } catch { /* The frame may have closed. */ }
    };
    const fail = (requestId: string, code: string, message: string) => {
      if (disposed) return;
      try { sessionRef.current?.fail(requestId, code, message); } catch { /* The frame may have closed. */ }
    };

    const generate = async (bridgeRequestId: string, payload: GenerationPayload) => {
      const controller = new AbortController();
      generationRequests.set(payload.requestId, controller);
      const started = performance.now();
      emit(bridgeRequestId, "phase", { type: "phase", phase: "queued" });
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 12));
        emit(bridgeRequestId, "phase", { type: "phase", phase: "prefill" });
        const modelStarted = performance.now();
        const latestUser = [...payload.messages].reverse().find((message) => message.role === "user")?.content ?? "";
        let response: string;
        if (payload.backend === "student") {
          const student = studentRef.current ?? loadLearnerState().artifacts.characterRnn ?? null;
          if (!student) throw new Error("Train the student model before generating.");
          const continuation = sampleCharacterRnn(student.checkpoint, latestUser, payload.options.maxTokens, payload.options.temperature, project.runtime.model.seed, payload.options.topK);
          response = `Prompt-conditioned character continuation:\n\n…${latestUser.slice(-32)}${continuation}`;
        } else {
          const client = localModelRef.current;
          if (!client || !localReadyRef.current) throw new Error("Load the local model before generating.");
          let draft = "";
          await client.generate(payload.requestId, payload.messages.slice(-12), payload.options, { onDelta: (delta) => { draft += delta; } });
          response = groundedAnswer(latestUser, draft.trim() || "The local model returned no text.");
        }
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const modelMs = performance.now() - modelStarted;
        emit(bridgeRequestId, "phase", { type: "phase", phase: "streaming" });
        const stream = createMockServingStream(response, controller.signal, project.runtime.transport);
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let firstChunk = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!firstChunk) firstChunk = performance.now();
          emit(bridgeRequestId, "chunk", { type: "chunk", chunk: decoder.decode(value, { stream: true }) });
        }
        const durationMs = performance.now() - started;
        emit(bridgeRequestId, "metrics", {
          type: "metrics",
          metrics: {
            queueMs: 12,
            modelMs: Math.round(modelMs),
            ttftMs: Math.round((firstChunk || performance.now()) - started),
            tokens: response.match(/\S+/g)?.length ?? 0,
            durationMs: Math.round(durationMs),
          },
        });
        emit(bridgeRequestId, "phase", { type: "phase", phase: controller.signal.aborted ? "cancelled" : "complete" });
        respond(bridgeRequestId, { status: controller.signal.aborted ? "cancelled" : "complete" });
      } catch (error) {
        const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
        if (cancelled) {
          emit(bridgeRequestId, "phase", { type: "phase", phase: "cancelled" });
          respond(bridgeRequestId, { status: "cancelled" });
        } else {
          const message = error instanceof Error ? error.message : "Generation failed.";
          emit(bridgeRequestId, "error", { type: "error", message, transient: false });
          fail(bridgeRequestId, "generation-failed", message);
        }
      } finally {
        generationRequests.delete(payload.requestId);
        capabilityGate.finishGeneration(payload.requestId);
      }
    };

    const handleRequest = (request: PreviewRequestMessage) => {
      void (async () => {
        if (request.method === "initialize") {
          studentRef.current = loadLearnerState().artifacts.characterRnn ?? null;
          const saved = await loadCapstoneConversation();
          respond(request.requestId, {
            buildId: descriptor.buildId,
            buildNumber: descriptor.buildNumber,
            studentReady: Boolean(studentRef.current),
            localReady: localReadyRef.current,
            conversation: { version: 1, id: "active", messages: portableMessages(saved.messages) },
            runtime: project.runtime as unknown as PreviewJson,
          });
          return;
        }
        if (request.method === "train-student") {
          const admission = capabilityGate.beginPreparation("train");
          if (admission !== "accepted") return fail(request.requestId, admission, "Another model preparation or generation job is already active.");
          const controller = new AbortController();
          trainingController = controller;
          try {
            emit(request.requestId, "progress", { type: "progress", progress: 5, detail: "Starting training worker" });
            const trained = await trainCharacterRnnInWorker(600, controller.signal);
            saveCharacterRnnArtifact(trained);
            studentRef.current = { checkpoint: trained.checkpoint, finalLoss: trained.finalLoss, parameters: trained.parameters, vocabularySize: trained.vocabularySize, trainedAt: Date.now() };
            emit(request.requestId, "progress", { type: "progress", progress: 100, detail: "Checkpoint ready" });
            respond(request.requestId, { ready: true });
          } finally {
            if (trainingController === controller) trainingController = null;
            capabilityGate.finishPreparation("train");
          }
          return;
        }
        if (request.method === "load-local") {
          const admission = capabilityGate.beginPreparation("load");
          if (admission !== "accepted") return fail(request.requestId, admission, "Another model preparation or generation job is already active.");
          try {
            const client = localModelRef.current ?? new LocalModelClient();
            localModelRef.current = client;
            await client.load({ onProgress: (progress, progressDetail) => emit(request.requestId, "progress", { type: "progress", progress, detail: progressDetail }) });
            localReadyRef.current = true;
            respond(request.requestId, { ready: true });
          } finally {
            capabilityGate.finishPreparation("load");
          }
          return;
        }
        if (request.method === "generate") {
          const payload = generationPayload(request.payload);
          if (!payload) return fail(request.requestId, "invalid-generation", "The generation request did not satisfy the bounded host contract.");
          const admission = capabilityGate.beginGeneration(payload.requestId);
          if (admission !== "accepted") return fail(request.requestId, admission, "Only one unique model generation may run at a time.");
          await generate(request.requestId, payload);
          return;
        }
        if (request.method === "cancel") {
          const payload = request.payload && typeof request.payload === "object" && !Array.isArray(request.payload) ? request.payload as Record<string, PreviewJson> : null;
          if (typeof payload?.requestId === "string") {
            generationRequests.get(payload.requestId)?.abort();
            localModelRef.current?.cancel(payload.requestId);
          }
          respond(request.requestId, null);
          return;
        }
        if (request.method === "persist") {
          const messages = safeConversationMessages(request.payload);
          if (!messages) return fail(request.requestId, "invalid-conversation", "The conversation record did not satisfy its storage schema.");
          const selected = messages.at(-1)?.backend ?? "local";
          await persistCapstoneConversation(selected, messages);
          respond(request.requestId, null);
          return;
        }
        fail(request.requestId, "unknown-method", "The preview requested an unavailable host capability.");
      })().catch((error) => fail(request.requestId, "host-capability-failed", error instanceof Error ? error.message : "The host capability failed."));
    };

    const previewSession = mountPreviewFrame({
      iframe,
      bundle,
      runtime: reactRuntime,
      allowedMethods: ALLOWED_METHODS,
      handlers: {
        onRequest: handleRequest,
        onReady: () => setDetail(`Build ${descriptor.buildNumber} is running from the IDE project.`),
        onError: (message) => { setStatus("error"); setDetail(message.message); },
        onProtocolViolation: () => setDetail("The preview rejected an out-of-contract message."),
      },
    });
    sessionRef.current = previewSession;

    return () => {
      disposed = true;
      previewSession.dispose();
      sessionRef.current = null;
      trainingController?.abort();
      trainingController = null;
      for (const controller of generationRequests.values()) controller.abort();
      generationRequests.clear();
      capabilityGate.reset();
    };
  }, [bundle, descriptor, project.runtime, reactRuntime, runRequested]);

  useEffect(() => () => {
    sessionRef.current?.dispose();
    localModelRef.current?.dispose();
    localModelRef.current = null;
  }, []);

  return (
    <main className="compiled-capstone-shell">
      <header className="capstone-topbar">
        <Link className="wordmark" href="/"><i />latent</Link>
        <div><span>Capstone</span><strong>Browser Chat</strong></div>
        <nav><Link href="/">Course</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav>
      </header>
      {status === "ready" && bundle && reactRuntime && runRequested ? (
        <section className="compiled-capstone-runtime">
          <header><div><span>Active project build</span><strong>{detail}</strong></div><div><code>{descriptor?.fingerprints.sourceTree.slice(7, 19)}</code><button type="button" onClick={() => setRunRequested(false)}>Reset preview</button></div></header>
          <iframe ref={iframeRef} title="Browser Chat compiled project" sandbox="allow-scripts" />
        </section>
      ) : (
        <section className={`capstone-build-gate ${status}`}>
          <span>{status === "loading" ? "Restoring project" : status === "ready" ? "Verified project build" : "Canonical project required"}</span>
          <h1>{status === "loading" ? "Loading Browser Chat…" : status === "ready" ? "Run Browser Chat." : "Build the repository in the IDE."}</h1>
          <p>{detail}</p>
          {status === "ready" ? <button type="button" onClick={() => setRunRequested(true)}>Run verified preview</button> : null}
          {status !== "loading" && status !== "ready" ? <Link href="/workspace?file=capstone%2FBrowserChat.tsx">Open the project IDE →</Link> : null}
        </section>
      )}
    </main>
  );
}
