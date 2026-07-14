"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sampleCharacterRnn } from "@latent/model-lab/character-rnn";
import { loadLearnerState, saveCharacterRnnArtifact, useLearnerState, type SavedRnnArtifact } from "../lib/learner-state";
import { useProjectState, type ProjectState } from "../lib/project-workspace";
import { expectedProjectContractIdsForPath, projectLessonBuildStatus, projectResultsForFile, trustedProjectResults } from "../lib/project-file-status";
import { canonicalLessonSeeds, reconcileCanonicalProject } from "../lib/canonical-project";
import { recordLearningEvent } from "../lib/learning-analytics";
import { createLatestConversationWriter, loadCapstoneConversation } from "../features/capstone/conversation-store";
import { LocalModelClient } from "../runtime/model/local-model-client";
import { LOCAL_MODEL_MAX_NEW_TOKENS, type ModelMessage } from "../runtime/model/protocol";
import { trainCharacterRnnInWorker } from "../runtime/model/train-character-client";
import { getPersistenceContext } from "../platform/persistence/client";
import { createMockServingStream } from "@latent/mock-services/sse";
import {
  LLM_LESSON_SOURCES,
  LLM_RUNTIME_CAPABILITIES,
  certifiedCapstoneRuntimeConfig,
  loadValidatedCapstoneBundle,
  type CapstoneRuntimeDescriptor,
  type CertifiedCapstoneRuntimeConfig,
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
import { CAPSTONE_COMPONENT_PATH as CANONICAL_CAPSTONE_COMPONENT_PATH } from "../content/browser-chat/project-template";

const ALLOWED_METHODS = new Set(["initialize", "train-student", "load-local", "generate", "cancel", "persist"]);

type GenerationPayload = {
  requestId: string;
  backend: CapstoneBackend;
  messages: ModelMessage[];
  requestFrame: string;
  options: { temperature: number; topK: number; maxTokens: number };
};

type HostStatus = "loading" | "ready" | "missing" | "error";

type CapstoneFailure = {
  code: string | null;
  message: string;
};

export type CapstoneProgress = {
  verifiedLessonFiles: number;
  totalLessonFiles: number;
  passingTests: number;
  totalTests: number;
  nextPath: string;
  nextTitle: string;
};

export type CapstoneRecovery = {
  eyebrow: string;
  title: string;
  summary: string;
  path: string | null;
  pathLabel: string;
  why: string;
  action: "workspace" | "retry";
  actionLabel: string;
  actionPath?: string;
  href: string;
  blockedStage: "source" | "build" | "preview";
};

const CAPSTONE_COMPONENT_PATH = CANONICAL_CAPSTONE_COMPONENT_PATH;
const CAPSTONE_ENTRY_PATH = LLM_RUNTIME_CAPABILITIES.find((definition) => definition.capability === "ui.mount")?.modulePath
  ?? "capstone/main.tsx";

const CAPABILITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "ui.mount": "React preview entrypoint · export mount",
  "transport.parse-sse": "Streaming parser · export parseSseChunk",
  "serving.should-retry": "Retry policy · export shouldRetry",
  "chat.select-context": "Context policy · export selectContext",
});

const CAPABILITY_SOURCE: Readonly<Record<string, { path: string; label: string }>> = Object.freeze(Object.fromEntries(
  LLM_RUNTIME_CAPABILITIES.filter((definition) => definition.required).map((definition) => [definition.capability, {
    path: definition.modulePath,
    label: CAPABILITY_LABELS[definition.capability]
      ?? `${definition.modulePath.split("/").at(-1) ?? definition.modulePath} · export ${definition.exportName}`,
  }]),
));

function workspaceHref(path: string) {
  return `/workspace?file=${encodeURIComponent(path)}`;
}

/** Summarizes only learner-visible evidence; it never treats a partial test run as a passing build. */
export function summarizeCapstoneProgress(
  project: Pick<ProjectState, "files" | "tests">,
  verifiedLessons: Readonly<Record<string, { content: string; verifiedCells: number; totalCells: number }>>,
): CapstoneProgress {
  const trustedResults = trustedProjectResults(project.tests);
  const lessonFiles = LLM_LESSON_SOURCES.map((lesson) => {
    const file = project.files[lesson.sourcePath] ?? {
      path: lesson.sourcePath,
      title: lesson.sourcePath.split("/").at(-1) ?? lesson.sourcePath,
      content: undefined,
      verifiedCells: 0,
      totalCells: 1,
    };
    const expected = verifiedLessons[lesson.sourcePath];
    return {
      file,
      status: projectLessonBuildStatus({
        projectSource: file.content,
        verifiedSource: expected?.content,
        verifiedCells: expected?.verifiedCells ?? 0,
        totalCells: expected?.totalCells ?? file.totalCells,
        trustedResults: projectResultsForFile(trustedResults, lesson.sourcePath),
        expectedContractIds: expectedProjectContractIdsForPath(lesson.sourcePath),
      }),
    };
  });
  const verifiedLessonFiles = lessonFiles.filter(({ status }) => status.complete).length;
  const results = Object.values(trustedResults).flat();
  const next = lessonFiles.find(({ status }) => !status.complete);
  const nextPath = next?.file.path ?? CAPSTONE_COMPONENT_PATH;
  return {
    verifiedLessonFiles,
    totalLessonFiles: lessonFiles.length,
    passingTests: results.filter((result) => result.passed).length,
    totalTests: results.length,
    nextPath,
    nextTitle: project.files[nextPath]?.title ?? nextPath.split("/").at(-1) ?? nextPath,
  };
}

export function capstoneMissingBuildRecovery(progress: CapstoneProgress): CapstoneRecovery {
  const sourceComplete = progress.totalLessonFiles > 0 && progress.verifiedLessonFiles === progress.totalLessonFiles;
  if (!sourceComplete) {
    return {
      eyebrow: "Passing build required",
      title: "Complete the next tested module.",
      summary: progress.totalLessonFiles
        ? `${progress.verifiedLessonFiles} of ${progress.totalLessonFiles} lesson files are verified. The capstone remains locked until every module passes in one full build.`
        : "No passing full-project build exists on this device yet. Restore or begin the project in the IDE.",
      path: progress.nextPath,
      pathLabel: `Next source · ${progress.nextPath}`,
      why: "This file is the earliest unfinished input to the model, serving, and React system assembled by the capstone.",
      action: "workspace",
      actionLabel: `Open ${progress.nextTitle}`,
      href: workspaceHref(progress.nextPath),
      blockedStage: "source",
    };
  }
  return {
    eyebrow: "Full build required",
    title: "Create the first passing build.",
    summary: `All ${progress.totalLessonFiles} lesson files are verified. Run the complete suite once to compile the React application and promote a source-bound build.`,
    path: CAPSTONE_COMPONENT_PATH,
    pathLabel: `Final integration · ${CAPSTONE_COMPONENT_PATH}`,
    why: "A passing full build proves that the independently tested lesson files still work together before any project code reaches the preview.",
    action: "workspace",
    actionLabel: "Open integration · Test, build & run",
    href: workspaceHref(CAPSTONE_COMPONENT_PATH),
    blockedStage: "build",
  };
}

export function capstoneReadyGateCopy(buildNumber: number) {
  return {
    eyebrow: `Verified build ${buildNumber}`,
    title: "Run the verified build.",
    summary: "The complete lesson source tree and React integration passed together. The preview will run inside an isolated frame with only explicit model, stream, cancel, and persistence capabilities.",
  } as const;
}

export function capstoneTestEvidence(status: HostStatus, buildNumber: number | null, progress: CapstoneProgress) {
  if (status === "ready" && buildNumber) {
    return { label: "Build test evidence", value: `Full suite passed for build #${buildNumber}` } as const;
  }
  return {
    label: "Saved test receipts",
    value: progress.totalTests
      ? `${progress.passingTests}/${progress.totalTests} currently passing`
      : "No saved test receipts",
  } as const;
}

function failureRecord(error: unknown): CapstoneFailure {
  if (!error || typeof error !== "object") {
    return { code: null, message: typeof error === "string" ? error : "The active capstone build could not be verified." };
  }
  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate.code === "string" ? candidate.code : null,
    message: typeof candidate.message === "string" ? candidate.message : "The active capstone build could not be verified.",
  };
}

/** Converts host verification failures into a concrete, non-jargon repair step without weakening the gate. */
export function capstoneRecoveryForFailure(error: unknown, progress: CapstoneProgress): CapstoneRecovery {
  const failure = failureRecord(error);
  const capability = Object.keys(CAPABILITY_SOURCE).find((candidate) => failure.message.includes(candidate));
  const source = capability ? CAPABILITY_SOURCE[capability as keyof typeof CAPABILITY_SOURCE] : null;
  if (source || failure.code === "MISSING_CAPSTONE_UI" || failure.code === "UNVERIFIED_CAPSTONE_UI") {
    const target = source ?? CAPABILITY_SOURCE["ui.mount"];
    const isEntrypoint = target.path === CAPSTONE_ENTRY_PATH;
    return {
      eyebrow: "Build contract incomplete",
      title: isEntrypoint ? "Rebuild the React entrypoint." : "Rebuild the missing runtime export.",
      summary: `The current passing build does not prove ${target.path}. The host rejected it before project code could execute.`,
      path: target.path,
      pathLabel: target.label,
      why: isEntrypoint
        ? "This provided entrypoint mounts your editable BrowserChat component inside the isolated preview. A fresh full build rebinds that boundary; the provided file itself does not need editing."
        : "This tested export is required by the assembled chatbot. Rebuilding links its current source and test receipt into the active build.",
      action: "workspace",
      actionLabel: `Open ${isEntrypoint ? "BrowserChat.tsx" : target.path.split("/").at(-1)} · Test, build & run`,
      actionPath: isEntrypoint ? CAPSTONE_COMPONENT_PATH : target.path,
      href: workspaceHref(isEntrypoint ? CAPSTONE_COMPONENT_PATH : target.path),
      blockedStage: "build",
    };
  }
  if (failure.message.includes("trusted React preview runtime") || failure.code === "PREVIEW_RUNTIME_ERROR") {
    return {
      eyebrow: "Preview runtime unavailable",
      title: "Restore the isolated preview.",
      summary: "The passing project build is still protected. Its trusted browser runtime did not initialize, so learner code was not executed.",
      path: null,
      pathLabel: "Host preview runtime · no project source changed",
      why: "Reloading retries the course-owned runtime and repeats bundle verification before the iframe receives any code.",
      action: "retry",
      actionLabel: "Reload and verify again",
      href: "/capstone",
      blockedStage: "preview",
    };
  }
  if (failure.code === "INCOMPLETE_BUILD_CONTRIBUTIONS") {
    const missingPath = LLM_LESSON_SOURCES.find((lesson) => failure.message.includes(lesson.sourcePath))?.sourcePath
      ?? progress.nextPath;
    return {
      eyebrow: "Lesson coverage incomplete",
      title: "Rebuild the complete source tree.",
      summary: "The current build does not contain a tested contribution from every lesson module, so it cannot become the active capstone.",
      path: missingPath,
      pathLabel: `Missing contribution · ${missingPath}`,
      why: "The capstone records all lesson files as build provenance, even when a file is not invoked directly at runtime.",
      action: "workspace",
      actionLabel: `Open ${missingPath.split("/").at(-1)} · run the full build`,
      actionPath: missingPath,
      href: workspaceHref(missingPath),
      blockedStage: "source",
    };
  }
  return {
    eyebrow: "Build verification stopped",
    title: "Rebuild the verified project.",
    summary: "The active build no longer matches the compiler and test evidence stored with it. The previous build was not executed.",
    path: progress.nextPath,
    pathLabel: `Repair from · ${progress.nextPath}`,
    why: "A fresh full build rechecks source hashes, required exports, and the React entrypoint as one atomic release.",
    action: "workspace",
    actionLabel: "Open the IDE · Test, build & run",
    href: workspaceHref(progress.nextPath),
    blockedStage: "build",
  };
}

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

function courseReference(question: string) {
  const normalized = question.toLowerCase();
  const match = COURSE_GROUNDING.find((entry) => entry.terms.filter((term) => normalized.includes(term)).length >= entry.minTerms);
  return match?.answer ?? null;
}

export function composeLocalModelResponse(question: string, draft: string) {
  const modelDraft = draft.trim();
  const reference = courseReference(question);
  const sampledSection = modelDraft || "[The local model returned no text for this sample.]";
  return {
    modelDraft,
    reference,
    response: [
      "Local Transformer sample · sampling controls applied",
      sampledSection,
      ...(reference ? [
        "Course reference · fixed teaching text · controls do not affect this section · excluded from generated-unit metrics",
        reference,
      ] : []),
    ].join("\n\n"),
  };
}

export function applyInterfaceResponsePrefix(prefix: string, response: string) {
  return `${prefix}${response}`;
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
      maxTokens: boundedNumber(options.maxTokens, LOCAL_MODEL_MAX_NEW_TOKENS, 40, LOCAL_MODEL_MAX_NEW_TOKENS, true),
    },
  };
}

function safeConversationWrite(value: PreviewJson): { selectedBackend: CapstoneBackend; messages: PersistedChatMessage[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, PreviewJson>;
  if (Object.keys(payload).length !== 2 || !("record" in payload) || !("selectedBackend" in payload)
    || (payload.selectedBackend !== "student" && payload.selectedBackend !== "local")) return null;
  const record = payload.record;
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const candidate = record as Record<string, PreviewJson>;
  const recordKeys = Object.keys(candidate);
  if (recordKeys.length !== 3 || !recordKeys.every((key) => ["version", "id", "messages"].includes(key))) return null;
  if (candidate.version !== 1 || typeof candidate.id !== "string" || !candidate.id.trim() || candidate.id.length > 128
    || !Array.isArray(candidate.messages) || candidate.messages.length > 200) return null;
  const messages: PersistedChatMessage[] = [];
  let characters = 0;
  for (const raw of candidate.messages) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const message = raw as Record<string, PreviewJson>;
    const messageKeys = Object.keys(message);
    if (!messageKeys.every((key) => ["id", "role", "backend", "content", "status", "attemptId", "parentUserId"].includes(key))
      || !["id", "role", "backend", "content", "status"].every((key) => key in message)) return null;
    if (typeof message.id !== "string" || !message.id.trim() || message.id.length > 128
      || (message.role !== "user" && message.role !== "assistant")
      || (message.backend !== "student" && message.backend !== "local") || typeof message.content !== "string" || message.content.length > 20_000
      || (message.status !== "complete" && message.status !== "cancelled" && message.status !== "error")) return null;
    if (("attemptId" in message && (typeof message.attemptId !== "string" || !message.attemptId.trim() || message.attemptId.length > 128))
      || ("parentUserId" in message && (typeof message.parentUserId !== "string" || !message.parentUserId.trim() || message.parentUserId.length > 128))) return null;
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
  return { selectedBackend: payload.selectedBackend, messages };
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

export function capstonePathPresentation(
  status: HostStatus,
  progress: CapstoneProgress,
  blockedStage?: CapstoneRecovery["blockedStage"],
) {
  const sourceComplete = progress.totalLessonFiles > 0 && progress.verifiedLessonFiles === progress.totalLessonFiles;
  return {
    sourceState: sourceComplete ? "complete" : blockedStage === "source" ? "current" : "pending",
    buildState: status === "ready" ? "complete" : status === "loading" || blockedStage === "build" ? "current" : "pending",
    previewState: status === "ready" || blockedStage === "preview" ? "current" : "pending",
    previewDetail: status === "ready" ? "ready to run" : blockedStage === "preview" ? "runtime needs reload" : "locked until build passes",
  } as const;
}

function CapstoneBuildPath({
  status,
  progress,
  buildNumber,
  blockedStage,
}: {
  status: HostStatus;
  progress: CapstoneProgress;
  buildNumber?: number;
  blockedStage?: CapstoneRecovery["blockedStage"];
}) {
  const presentation = capstonePathPresentation(status, progress, blockedStage);
  return (
    <ol className="capstone-build-path" aria-label="Capstone execution path">
      <li className={presentation.sourceState}>
        <span>01</span>
        <strong>Current workspace lesson source</strong>
        <code>{progress.totalLessonFiles ? `${progress.verifiedLessonFiles}/${progress.totalLessonFiles} files verified` : "restoring source state"}</code>
      </li>
      <li className={presentation.buildState}>
        <span>02</span>
        <strong>Active build snapshot</strong>
        <code>{status === "ready" && buildNumber ? `build #${buildNumber} verified` : status === "loading" ? "checking receipt + hashes" : "full suite required"}</code>
      </li>
      <li className={presentation.previewState}>
        <span>03</span>
        <strong>Sandboxed React preview</strong>
        <code>{presentation.previewDetail}</code>
      </li>
    </ol>
  );
}

export function BrowserChatCapstone() {
  const project = useProjectState();
  const learner = useLearnerState();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<PreviewFrameSession | null>(null);
  const studentRef = useRef<SavedRnnArtifact | null>(null);
  const localModelRef = useRef<LocalModelClient | null>(null);
  const [conversationWriter] = useState(() => createLatestConversationWriter());
  const localReadyRef = useRef(false);
  const [bundle, setBundle] = useState<ValidatedPreviewBundle | null>(null);
  const [reactRuntime, setReactRuntime] = useState<ValidatedPreviewRuntime | null>(null);
  const [descriptor, setDescriptor] = useState<CapstoneRuntimeDescriptor | null>(null);
  const [buildRuntime, setBuildRuntime] = useState<CertifiedCapstoneRuntimeConfig | null>(null);
  const [status, setStatus] = useState<HostStatus>("loading");
  const [detail, setDetail] = useState("Loading the last passing project build…");
  const [runRequested, setRunRequested] = useState(false);
  const [failure, setFailure] = useState<CapstoneFailure | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      await reconcileCanonicalProject();
      if (!active) return;
      setStatus("loading");
      setBundle(null);
      setReactRuntime(null);
      setDescriptor(null);
      setBuildRuntime(null);
      setRunRequested(false);
      setFailure(null);
      setDetail("Loading the last passing project build…");
      const { repositories } = await getPersistenceContext();
      const build = await repositories.builds.activeValidated("browser-chat");
      if (!build) {
        if (active) { setStatus("missing"); setDetail("No passing full-project build exists on this device yet."); }
        return;
      }
      const loaded = await loadValidatedCapstoneBundle(build);
      const certifiedRuntime = certifiedCapstoneRuntimeConfig(build);
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
      setBuildRuntime(certifiedRuntime);
      setBundle(verified);
      setReactRuntime(verifiedRuntime);
      setStatus("ready");
      setDetail(`Build ${loaded.descriptor.buildNumber} is verified. It runs with isolated host capabilities; a synchronous loop can still require reloading this tab.`);
    })().catch((error) => {
      if (!active) return;
      setFailure(failureRecord(error));
      setStatus("error");
      setDetail("The active capstone build could not be verified, so it was not executed.");
    });
    return () => { active = false; };
  }, [project.activeBuild?.id]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !bundle || !reactRuntime || !descriptor || !buildRuntime || !runRequested) return;
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
        await Promise.resolve();
        const queueMs = performance.now() - started;
        emit(bridgeRequestId, "phase", { type: "phase", phase: "prefill" });
        const modelStarted = performance.now();
        const latestUser = [...payload.messages].reverse().find((message) => message.role === "user")?.content ?? "";
        let response: string;
        let generatedUnits = 0;
        let generatedUnitLabel = "Generated units";
        if (payload.backend === "student") {
          const student = studentRef.current ?? loadLearnerState().artifacts.characterRnn ?? null;
          if (!student) throw new Error("Train the student model before generating.");
          const continuation = sampleCharacterRnn(student.checkpoint, latestUser, payload.options.maxTokens, payload.options.temperature, buildRuntime.model.seed, payload.options.topK);
          response = `Prompt-conditioned character continuation:\n\n…${latestUser.slice(-32)}${continuation}`;
          generatedUnits = continuation.length;
          generatedUnitLabel = "Generated characters";
        } else {
          const client = localModelRef.current;
          if (!client || !localReadyRef.current || !client.isReady()) {
            localReadyRef.current = false;
            throw new Error("Load the local model explicitly before generating.");
          }
          let draft = "";
          const generation = await client.generate(payload.requestId, payload.messages.slice(-12), payload.options, { onDelta: (delta) => { draft += delta; } });
          const composed = composeLocalModelResponse(latestUser, draft);
          response = composed.response;
          generatedUnits = generation.generatedUnits;
          generatedUnitLabel = generation.unit === "stream-chunks" ? "Model stream chunks" : "Generated units";
        }
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const modelMs = performance.now() - modelStarted;
        emit(bridgeRequestId, "phase", { type: "phase", phase: "streaming" });
        const stream = createMockServingStream(
          applyInterfaceResponsePrefix(buildRuntime.interface.responsePrefix, response),
          controller.signal,
          buildRuntime.transport,
        );
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
            queueMs: Math.round(queueMs),
            modelMs: Math.round(modelMs),
            ttftMs: Math.round((firstChunk || performance.now()) - started),
            generatedUnits,
            generatedUnitLabel,
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
            selectedBackend: saved.selectedBackend,
            studentReady: Boolean(studentRef.current),
            localReady: localReadyRef.current,
            conversation: { version: 1, id: "active", messages: portableMessages(saved.messages) },
            runtime: buildRuntime as unknown as PreviewJson,
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
            let client = localModelRef.current;
            if (!client) {
              client = new LocalModelClient();
              client.setUnavailableHandler(() => { localReadyRef.current = false; });
              localModelRef.current = client;
            }
            await client.load({ onProgress: (progress, progressDetail) => emit(request.requestId, "progress", { type: "progress", progress, detail: progressDetail }) });
            localReadyRef.current = client.isReady();
            if (!localReadyRef.current) throw new Error("The local-model worker did not reach an explicit ready state.");
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
          const write = safeConversationWrite(request.payload);
          if (!write) return fail(request.requestId, "invalid-conversation", "The conversation record did not satisfy its storage schema.");
          await conversationWriter.enqueue(write.selectedBackend, write.messages);
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
        onError: (message) => {
          setFailure({ code: "PREVIEW_RUNTIME_ERROR", message: message.message });
          setStatus("error");
          setRunRequested(false);
          setDetail("The preview stopped before learner code could continue.");
        },
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
  }, [buildRuntime, bundle, conversationWriter, descriptor, reactRuntime, runRequested]);

  useEffect(() => () => {
    sessionRef.current?.dispose();
    localModelRef.current?.dispose();
    localModelRef.current = null;
  }, []);

  const verifiedLessons = Object.fromEntries(canonicalLessonSeeds(learner).map((seed) => [seed.path, {
    content: seed.content,
    verifiedCells: seed.verifiedCells,
    totalCells: seed.totalCells,
  }]));
  const progress = summarizeCapstoneProgress(project, verifiedLessons);
  const recovery = status === "missing"
    ? capstoneMissingBuildRecovery(progress)
    : status === "error"
      ? capstoneRecoveryForFailure(failure, progress)
      : null;
  const gateCopy = status === "loading"
    ? {
        eyebrow: "Build admission",
        title: "Verifying the active build.",
        summary: "Checking the full-project test receipt, compiler hashes, and isolated React entrypoint before any learner code executes.",
      }
    : status === "ready"
      ? capstoneReadyGateCopy(descriptor?.buildNumber ?? project.activeBuild?.buildNumber ?? 1)
      : recovery ?? capstoneMissingBuildRecovery(progress);
  const testEvidence = capstoneTestEvidence(status, descriptor?.buildNumber ?? null, progress);

  return (
    <main className="compiled-capstone-shell">
      <header className="capstone-topbar">
        <Link className="wordmark" href="/"><i />latent</Link>
        <div><span>Capstone</span><strong>Browser Chat</strong></div>
        <nav><Link href="/">Course</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav>
      </header>
      {status === "ready" && bundle && reactRuntime && buildRuntime && runRequested ? (
        <section className="compiled-capstone-runtime">
          <header><div><span>Active project build</span><strong role="status" aria-live="polite" aria-atomic="true">{detail}</strong></div><div><code>{descriptor?.fingerprints.sourceTree.slice(7, 19)}</code><button type="button" onClick={() => setRunRequested(false)}>Reset preview</button></div></header>
          <iframe ref={iframeRef} title="Browser Chat compiled project" sandbox="allow-scripts" />
        </section>
      ) : (
        <section
          className={`capstone-build-gate ${status}`}
          aria-labelledby="capstone-gate-title"
          aria-busy={status === "loading"}
        >
          <div className="capstone-gate-copy" role="status" aria-live="polite" aria-atomic="true">
            <span>{gateCopy.eyebrow}</span>
            <h1 id="capstone-gate-title">{gateCopy.title}</h1>
            <p>{gateCopy.summary}</p>
          </div>

          <div className="capstone-progress-line" aria-label="Current project evidence">
            <div>
              <span>Current workspace lesson source</span>
              <strong>{progress.totalLessonFiles ? `${progress.verifiedLessonFiles}/${progress.totalLessonFiles} verified` : "Restoring"}</strong>
            </div>
            <progress
              aria-label="Verified lesson files"
              value={progress.verifiedLessonFiles}
              max={Math.max(1, progress.totalLessonFiles)}
            />
            <div>
              <span>{testEvidence.label}</span>
              <strong>{testEvidence.value}</strong>
            </div>
          </div>

          <CapstoneBuildPath
            status={status}
            progress={progress}
            buildNumber={descriptor?.buildNumber}
            blockedStage={recovery?.blockedStage}
          />

          <div className="capstone-next-step">
            <div>
              <span>{status === "ready" ? "Execution boundary" : "Next repair"}</span>
              <code>{status === "ready" ? "capstone/main.tsx → isolated preview" : recovery?.pathLabel}</code>
              <p>{status === "ready" ? "The host verifies the bundle, then exposes only allowlisted capabilities across the iframe boundary." : recovery?.why}</p>
            </div>
            {status === "ready" ? (
              <button type="button" onClick={() => { setRunRequested(true); void recordLearningEvent("capstone_started", { outcome: "passed" }); }}>
                Run verified preview
              </button>
            ) : recovery?.action === "retry" ? (
              <button type="button" onClick={() => window.location.reload()}>{recovery.actionLabel}</button>
            ) : recovery ? (
              <Link href={recovery.href} aria-label={`${recovery.actionLabel}. Opens ${recovery.actionPath ?? recovery.path ?? "the project"} in the IDE.`}>{recovery.actionLabel} →</Link>
            ) : (
              <span className="capstone-verifying">Verifying…</span>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
