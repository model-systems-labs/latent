"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { sampleCharacterRnn } from "../lib/lab-engines";
import { loadLearnerState, saveCharacterRnnArtifact, type SavedRnnArtifact } from "../lib/learner-state";
import { useProjectState } from "../lib/project-workspace";
import { loadCapstoneConversation, persistCapstoneConversation } from "../features/capstone/conversation-store";
import { LocalModelClient } from "../runtime/model/local-model-client";
import type { ModelMessage } from "../runtime/model/protocol";
import { trainCharacterRnnInWorker } from "../runtime/model/train-character-client";
import { createCapstoneRuntimeDescriptor, type CapstoneRuntimeDescriptor } from "../runtime/bindings";
import { getPersistenceContext } from "../platform/persistence/client";
import {
  consumeSse,
  createMockServingStream,
  type MockServingScenario,
} from "@latent/mock-services";
import {
  CHAT_LOG_ACCESSIBILITY,
  canRegenerate,
  composerKeyAction,
  lastUserForBackend,
  messagesForBackend,
  type CapstoneBackend,
  type PersistedChatMessage,
} from "../lib/capstone-contract";

type ChatState = { messages: PersistedChatMessage[] };
type ChatAction =
  | { type: "user"; message: PersistedChatMessage }
  | { type: "start"; message: PersistedChatMessage }
  | { type: "delta"; id: string; delta: string }
  | { type: "terminal"; id: string; status: PersistedChatMessage["status"] }
  | { type: "reset"; messages: PersistedChatMessage[] };
type MetricState = { queueMs: number; modelMs: number; ttftMs: number; tokens: number; durationMs: number; events: number };

function welcomeMessage(backend: CapstoneBackend): PersistedChatMessage {
  return {
    id: `welcome-${backend}`,
    role: "assistant",
    backend,
    status: "complete",
    content: backend === "student"
      ? "This conversation uses the character RNN checkpoint produced in Module 01. Its output is a prompt-conditioned character continuation, not a general-purpose answer."
      : "This conversation uses a real local 135M Transformer. Course-note grounding replaces unsupported drafts when a matching technical source is available.",
  };
}

const initialMessages = [welcomeMessage("student"), welcomeMessage("local")];

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "reset") return { messages: action.messages };
  if (action.type === "user" || action.type === "start") return { messages: [...state.messages, action.message] };
  if (action.type === "delta") return {
    messages: state.messages.map((message) => message.id === action.id && message.status === "streaming" ? { ...message, content: message.content + action.delta } : message),
  };
  return { messages: state.messages.map((message) => message.id === action.id ? { ...message, status: action.status } : message) };
}

const COURSE_GROUNDING = [
  {
    terms: ["causal", "mask", "future"],
    minTerms: 2,
    source: "Transformers · causal self-attention",
    answer: "A causal mask prevents position t from attending to positions greater than t. Adding negative infinity to those attention logits makes their softmax probability exactly zero, so a training token cannot read the future token it is supposed to predict.",
  },
  {
    terms: ["sse", "stream", "chunk"],
    minTerms: 1,
    source: "Streaming Transport · event framing",
    answer: "SSE represents each event as UTF-8 fields terminated by a blank line. Network chunks are arbitrary, so the parser must retain an incomplete remainder and emit an event only after the full delimiter arrives.",
  },
  {
    terms: ["token", "subword", "bpe"],
    minTerms: 1,
    source: "Subword Tokenization · learned merges",
    answer: "Subword tokenization learns frequent symbol merges. More merges shorten common sequences but enlarge the vocabulary; rare or unseen words remain representable as smaller units.",
  },
  {
    terms: ["recurrent", "rnn", "hidden state"],
    minTerms: 1,
    source: "Character RNNs · recurrent state",
    answer: "A recurrent model reuses the same transition at every position, combining the current input with the previous hidden state. Training next-character cross-entropy through the unrolled transition makes that state useful for predicting later characters.",
  },
];

function applyCourseGrounding(question: string, rawDraft: string) {
  const normalized = question.toLowerCase();
  const match = COURSE_GROUNDING.find((entry) => entry.terms.filter((term) => normalized.includes(term)).length >= entry.minTerms);
  if (!match) return { text: `Unverified local draft:\n\n${rawDraft}`, grounded: false, source: null };
  return {
    text: `Grounded course answer:\n\n${match.answer}\n\nPost-technique: a real local draft was generated, then replaced with the matching course note because the 135M model is not a reliable technical authority.`,
    grounded: true,
    source: match.source,
  };
}

export function BrowserChatCapstone() {
  const project = useProjectState();
  const runtime = project.runtime;
  const [state, dispatch] = useReducer(chatReducer, { messages: [] });
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CapstoneBackend>("student");
  const [student, setStudent] = useState<SavedRnnArtifact | null>(null);
  const [training, setTraining] = useState(false);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelDetail, setModelDetail] = useState("Not loaded");
  const [requestPhase, setRequestPhase] = useState("ready");
  const [metrics, setMetrics] = useState<MetricState>({ queueMs: 0, modelMs: 0, ttftMs: 0, tokens: 0, durationMs: 0, events: 0 });
  const [groundingSource, setGroundingSource] = useState<string | null>(null);
  const [servingScenario, setServingScenario] = useState<MockServingScenario>("healthy");
  const [activeDescriptor, setActiveDescriptor] = useState<CapstoneRuntimeDescriptor | null>(null);
  const modelClientRef = useRef<LocalModelClient | null>(null);
  const activeModelRequestRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const learner = loadLearnerState();
      setStudent(learner.artifacts.characterRnn ?? null);
      const saved = await loadCapstoneConversation();
      if (!active) return;
      setMode(saved?.selectedBackend ?? "student");
      const restoredMessages = saved?.messages.length
        ? [
            welcomeMessage("student"),
            welcomeMessage("local"),
            ...saved.messages.filter((message) => (
              !message.id.startsWith("welcome-")
              && !message.content.startsWith("This conversation uses the character RNN checkpoint produced in")
              && !message.content.startsWith("This conversation uses a real local 135M Transformer")
            )),
          ]
        : initialMessages;
      dispatch({ type: "reset", messages: restoredMessages });
      setHydrated(true);
    })().catch(() => {
      if (!active) return;
      dispatch({ type: "reset", messages: initialMessages });
      setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated || state.messages.some((message) => message.status === "streaming")) return;
    void persistCapstoneConversation(mode, state.messages).catch((error) => console.error("Conversation persistence failed", error));
  }, [hydrated, mode, state.messages]);

  useEffect(() => () => {
    modelClientRef.current?.dispose();
    modelClientRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { repositories } = await getPersistenceContext();
      const build = await repositories.builds.active("browser-chat");
      if (!build || !active) return;
      const descriptor = await createCapstoneRuntimeDescriptor(build);
      if (active) setActiveDescriptor(descriptor);
    })().catch(() => {
      if (active) setActiveDescriptor(null);
    });
    return () => { active = false; };
  }, [runtime.buildNumber]);

  const trainStudent = async () => {
    setTraining(true);
    setRequestPhase("training");
    try {
      const trained = await trainCharacterRnnInWorker(600);
      saveCharacterRnnArtifact(trained);
      setStudent({ checkpoint: trained.checkpoint, finalLoss: trained.finalLoss, parameters: trained.parameters, vocabularySize: trained.vocabularySize, trainedAt: Date.now() });
    } catch {
      setRequestPhase("error");
    } finally {
      setTraining(false);
      window.setTimeout(() => setRequestPhase("ready"), 450);
    }
  };

  const loadLocalModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    setModelStatus("loading");
    setModelProgress(0);
    setRequestPhase("loading");
    try {
      const client = modelClientRef.current ?? new LocalModelClient();
      modelClientRef.current = client;
      const loaded = await client.load({
        onProgress: (progress, detail) => {
          setModelProgress(progress);
          setModelDetail(detail);
        },
      });
      setModelStatus("ready");
      setModelProgress(100);
      setModelDetail(loaded.detail);
      setRequestPhase("ready");
    } catch (error) {
      setModelStatus("error");
      setModelDetail(error instanceof Error ? error.message : "Model load failed");
      setRequestPhase("error");
    }
  };

  const generateResponse = async (userText: string, generationSeed: number, requestId: string, signal: AbortSignal) => {
    if (mode === "student") {
      if (!student) throw new Error("Train the student model first.");
      const continuation = sampleCharacterRnn(student.checkpoint, userText, runtime.model.maxTokens, runtime.model.temperature, runtime.model.seed + generationSeed, runtime.model.topK);
      return `${runtime.interface.responsePrefix}Prompt-conditioned character continuation:\n\n…${userText.slice(-32)}${continuation}`;
    }
    const client = modelClientRef.current;
    if (!client || modelStatus !== "ready") throw new Error("Load the local model first.");
    const context: ModelMessage[] = [
      { role: "system", content: "Answer in concise technical prose. If uncertain, state uncertainty. Do not use markdown headings." },
      ...messagesForBackend(state.messages, "local")
        .filter((message) => !message.id.startsWith("welcome-") && message.status === "complete")
        .slice(-6)
        .map((message) => ({ role: message.role, content: message.content } as ModelMessage)),
      { role: "user", content: userText },
    ];
    let raw = "";
    const interrupt = () => client.cancel(requestId);
    signal.addEventListener("abort", interrupt, { once: true });
    activeModelRequestRef.current = requestId;
    try {
      await client.generate(requestId, context, {
        maxTokens: Math.min(runtime.model.maxTokens, 160),
        temperature: runtime.model.temperature,
        topK: runtime.model.topK,
      }, {
        onDelta: (delta) => { raw += delta; },
      });
    } finally {
      signal.removeEventListener("abort", interrupt);
      if (activeModelRequestRef.current === requestId) activeModelRequestRef.current = null;
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    raw = raw.trim() || "The local model returned no text.";
    const grounded = applyCourseGrounding(userText, raw);
    setGroundingSource(grounded.source);
    return `${runtime.interface.responsePrefix}${grounded.text}`;
  };

  const send = async (override?: string, regenerateFrom?: PersistedChatMessage) => {
    const userText = (override ?? input).trim();
    if (!userText || requestPhase !== "ready") return;
    const requestId = `r-${Date.now()}`;
    const parentUser = regenerateFrom ?? { id: `u-${requestId}`, role: "user", content: userText, status: "complete", backend: mode } as PersistedChatMessage;
    if (!regenerateFrom) dispatch({ type: "user", message: parentUser });
    const assistantId = `a-${requestId}`;
    dispatch({ type: "start", message: { id: assistantId, role: "assistant", content: "", status: "streaming", backend: mode, attemptId: requestId, parentUserId: parentUser.id } });
    setInput("");
    setGroundingSource(null);
    setRequestPhase("queued");
    setMetrics({ queueMs: 12, modelMs: 0, ttftMs: 0, tokens: 0, durationMs: 0, events: 0 });
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 12));
      setRequestPhase("prefill");
      const modelStarted = performance.now();
      const response = await generateResponse(userText, Number(requestId.slice(2)) % 100000, requestId, controller.signal);
      const modelMs = performance.now() - modelStarted;
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setRequestPhase("streaming");
      let firstEvent = 0;
      let eventCount = 0;
      let tokens = 0;
      await consumeSse(createMockServingStream(response, controller.signal, {
        wordsPerEvent: runtime.transport.wordsPerEvent,
        delayMs: runtime.transport.delayMs,
        scenario: servingScenario,
      }), (event) => {
        eventCount += 1;
        if (!firstEvent && event.type === "token") firstEvent = performance.now();
        if (event.type === "token") {
          const delta = event.data.delta;
          tokens += delta.match(/\S+/g)?.length ?? 0;
          dispatch({ type: "delta", id: assistantId, delta });
        }
        if (event.type === "cancelled") dispatch({ type: "terminal", id: assistantId, status: "cancelled" });
        if (event.type === "error") throw new Error(`${event.data.code}: ${event.data.message}`);
      });
      if (controller.signal.aborted) {
        dispatch({ type: "terminal", id: assistantId, status: "cancelled" });
        setRequestPhase("cancelled");
      } else {
        dispatch({ type: "terminal", id: assistantId, status: "complete" });
        setRequestPhase("ready");
      }
      setMetrics({ queueMs: 12, modelMs: Math.round(modelMs), ttftMs: Math.round((firstEvent || performance.now()) - started), tokens, durationMs: Math.round(performance.now() - started), events: eventCount });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      if (!cancelled) {
        const detail = error instanceof Error ? error.message : "The generation request failed.";
        dispatch({ type: "delta", id: assistantId, delta: `Generation failed: ${detail}` });
      }
      dispatch({ type: "terminal", id: assistantId, status: cancelled ? "cancelled" : "error" });
      setRequestPhase(cancelled ? "cancelled" : "error");
    } finally {
      abortRef.current = null;
      window.setTimeout(() => setRequestPhase((phase) => phase === "cancelled" || phase === "error" ? "ready" : phase), 500);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    const requestId = activeModelRequestRef.current;
    if (requestId) modelClientRef.current?.cancel(requestId);
  };
  const generating = ["queued", "prefill", "streaming"].includes(requestPhase);
  const regenerate = () => {
    const lastUser = lastUserForBackend(state.messages, mode);
    if (lastUser) void send(lastUser.content, lastUser);
  };
  const reset = () => {
    abortRef.current?.abort();
    dispatch({ type: "reset", messages: [...state.messages.filter((message) => message.backend !== mode), welcomeMessage(mode)] });
  };
  const switchMode = (backend: CapstoneBackend) => {
    if (generating) return;
    setMode(backend);
    setInput("");
    setGroundingSource(null);
    setMetrics({ queueMs: 0, modelMs: 0, ttftMs: 0, tokens: 0, durationMs: 0, events: 0 });
    setRequestPhase("ready");
  };
  const readyForMode = hydrated && (mode === "student" ? Boolean(student) : modelStatus === "ready");
  const visibleMessages = messagesForBackend(state.messages, mode);
  const regenerationAvailable = canRegenerate(state.messages, mode, generating) && readyForMode;

  return (
    <main className="capstone-shell">
      <header className="capstone-topbar">
        <Link className="wordmark" href="/"><i />latent</Link>
        <div><span>Capstone</span><strong>Browser Chat</strong></div>
        <nav><Link href="/workspace">IDE</Link><Link href="/courses/models">Model</Link><Link href="/courses/systems">Runtime</Link><Link href="/courses/backend">Serving</Link><Link href="/courses/product">React</Link></nav>
      </header>
      <div className="capstone-layout">
        <aside className="capstone-sidebar">
          <section className="backend-panel">
            <span>Model backend</span>
            <div className="mode-switch"><button disabled={generating} className={mode === "student" ? "active" : ""} type="button" onClick={() => switchMode("student")}>Student model</button><button disabled={generating} className={mode === "local" ? "active" : ""} type="button" onClick={() => switchMode("local")}>Local chat model</button></div>
            {mode === "student" ? (
              <div className="backend-card"><strong>18-unit character RNN</strong><p>{student ? "Checkpoint restored from device-local Module 01 state." : "Train here or complete Character RNNs to create a reusable local checkpoint."}</p>{student ? <dl><div><dt>Parameters</dt><dd>{student.parameters.toLocaleString()}</dd></div><div><dt>Final loss</dt><dd>{student.finalLoss.toFixed(3)}</dd></div></dl> : null}<button type="button" onClick={() => void trainStudent()} disabled={training}>{training ? "Training…" : student ? "Retrain model" : "Train model"}</button></div>
            ) : (
              <div className="backend-card"><strong>SmolLM2-135M · q4</strong><p>Real local generation with an explicit course-note grounding layer. Raw unmatched drafts remain labeled unverified.</p><div className="load-progress"><i><b style={{ width: `${modelProgress}%` }} /></i><em>{modelDetail}</em></div><button type="button" onClick={loadLocalModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>{modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${modelProgress}% loaded` : "Load ~181 MB"}</button></div>
            )}
          </section>
          <section className="runtime-panel">
            <span>Request lifecycle</span>
            <div className="phase-row">{["queued", "prefill", "streaming"].map((phase) => <i className={requestPhase === phase ? "active" : ""} key={phase}>{phase}</i>)}</div>
            {runtime.interface.showMetrics ? <dl><div><dt>Queue</dt><dd>{metrics.queueMs} ms</dd></div><div><dt>Model</dt><dd>{metrics.modelMs} ms</dd></div><div><dt>TTFT</dt><dd>{metrics.ttftMs} ms</dd></div><div><dt>Events</dt><dd>{metrics.events}</dd></div><div><dt>Tokens</dt><dd>{metrics.tokens}</dd></div><div><dt>Total</dt><dd>{metrics.durationMs} ms</dd></div></dl> : <p>Metrics hidden by runtime/interface.config.js.</p>}
          </section>
          <section className="transport-panel"><span>Serving adapter · build {runtime.buildNumber}</span><strong>SSE-compatible ReadableStream</strong><code>{runtime.transport.wordsPerEvent} words/event · {runtime.transport.delayMs} ms</code><p>The deterministic adapter controls delivery and failure injection; model computation stays in its own worker.</p><div className="active-build-proof"><span>{activeDescriptor ? `${activeDescriptor.contributions.length}/14 tested modules` : "Legacy build"}</span><code>{activeDescriptor ? activeDescriptor.fingerprints.sourceTree.slice(7, 19) : "Rebuild in the IDE to create a source-bound artifact"}</code></div><label><span>Failure scenario</span><select value={servingScenario} onChange={(event) => setServingScenario(event.target.value as MockServingScenario)} disabled={generating}><option value="healthy">Healthy stream</option><option value="slow-first-token">Slow first token</option><option value="timeout-before-first-token">Queue timeout</option><option value="malformed-frame">Malformed frame</option></select></label></section>
          <footer><span>Device-local · {mode} conversation</span><button type="button" onClick={reset}>Clear current backend</button></footer>
        </aside>
        <section className="chat-workspace">
          <header><div><span>{mode === "student" ? "Learner-trained continuation" : "Local model + grounding"}</span><strong>{!hydrated ? "Restoring local state" : readyForMode ? "Ready" : mode === "student" ? "Train before chatting" : "Load before chatting"}</strong></div><div className={`runtime-status ${requestPhase}`}><i />{requestPhase}</div></header>
          <div className="capstone-messages" role={CHAT_LOG_ACCESSIBILITY.role} aria-live={CHAT_LOG_ACCESSIBILITY.ariaLive} aria-label="Conversation">
            {!hydrated ? <p className="capstone-hydrating">Restoring device-local conversation…</p> : visibleMessages.map((message) => (
              <article className={`capstone-message ${message.role} ${message.status}`} key={message.id}>
                <span>{message.role === "user" ? "You" : runtime.interface.assistantName}</span>
                <p>{message.content || (message.status === "streaming" ? "Processing context…" : "No output")}</p>
                {message.status !== "complete" ? <em>{message.status}</em> : null}
              </article>
            ))}
          </div>
          {groundingSource ? <div className="grounding-record"><span>Grounding applied</span><strong>{groundingSource}</strong></div> : null}
          <div className="chat-actions"><button type="button" onClick={regenerate} disabled={!regenerationAvailable}>Regenerate last answer</button>{generating ? <button className="stop" type="button" onClick={stop}>Stop generation</button> : null}</div>
          <form className="capstone-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (composerKeyAction(event.key, event.shiftKey) === "send") { event.preventDefault(); void send(); } }} placeholder={readyForMode ? "Send a message to the selected model…" : "Prepare the selected model first…"} disabled={!readyForMode || generating} aria-label="Chat message" />
            <div><span>Enter to send · Shift+Enter for newline</span><button type="submit" disabled={!readyForMode || generating || !input.trim()}>Send</button></div>
          </form>
          <footer className="capstone-contract"><span>Execution contract</span><p>Lesson files, edits, build settings, checkpoints, and conversations remain on this device. The active model, transport, and interface adapters above directly control new chat requests.</p></footer>
        </section>
      </div>
    </main>
  );
}
