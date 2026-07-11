"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { sampleCharacterRnn, trainCharacterRnn } from "../lib/lab-engines";
import { loadLearnerState, saveCharacterRnnArtifact, type SavedRnnArtifact } from "../lib/learner-state";
import { useProjectState } from "../lib/project-workspace";
import {
  CAPSTONE_STORAGE_KEY,
  CHAT_LOG_ACCESSIBILITY,
  canRegenerate,
  composerKeyAction,
  lastUserForBackend,
  messagesForBackend,
  parseCapstoneRecord,
  serializeCapstoneRecord,
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
type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type TextGenerator = (input: ModelMessage[], options?: Record<string, unknown>) => Promise<unknown>;
type MetricState = { queueMs: number; modelMs: number; ttftMs: number; tokens: number; durationMs: number; events: number };

function welcomeMessage(backend: CapstoneBackend): PersistedChatMessage {
  return {
    id: `welcome-${backend}`,
    role: "assistant",
    backend,
    status: "complete",
    content: backend === "student"
      ? "This conversation uses the character RNN checkpoint produced in Course 01. Its output is a prompt-conditioned character continuation, not a general-purpose answer."
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

function extractGeneratedText(result: unknown) {
  if (!Array.isArray(result) || !result.length) return "";
  const generated = (result[0] as { generated_text?: unknown }).generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const final = generated.at(-1) as { content?: unknown } | undefined;
    return typeof final?.content === "string" ? final.content : "";
  }
  return "";
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

function createSseStream(text: string, signal: AbortSignal, wordsPerEvent = 1, delayMs = 24) {
  const encoder = new TextEncoder();
  const words = text.match(/\S+\s*/g) ?? [text];
  const pieces = Array.from({ length: Math.ceil(words.length / wordsPerEvent) }, (_, index) => words.slice(index * wordsPerEvent, (index + 1) * wordsPerEvent).join(""));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let index = 0;
      const push = () => {
        if (signal.aborted) {
          controller.enqueue(encoder.encode(`event: cancelled\ndata: {}\n\n`));
          controller.close();
          return;
        }
        if (index >= pieces.length) {
          controller.enqueue(encoder.encode(`event: done\ndata: {"tokens":${pieces.length}}\n\n`));
          controller.close();
          return;
        }
        const frame = `event: token\ndata: ${JSON.stringify({ delta: pieces[index] })}\n\n`;
        const midpoint = Math.max(1, Math.floor(frame.length * 0.62));
        controller.enqueue(encoder.encode(frame.slice(0, midpoint)));
        controller.enqueue(encoder.encode(frame.slice(midpoint)));
        index += 1;
        window.setTimeout(push, delayMs);
      };
      window.setTimeout(push, Math.min(120, delayMs * 3));
    },
  });
}

async function consumeSse(stream: ReadableStream<Uint8Array>, onEvent: (event: string, data: Record<string, unknown>) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const lines = frame.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
      const raw = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "{}";
      onEvent(event, JSON.parse(raw) as Record<string, unknown>);
    }
  }
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
  const generatorRef = useRef<TextGenerator | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const learner = loadLearnerState();
      setStudent(learner.artifacts.characterRnn ?? null);
      const saved = parseCapstoneRecord(window.localStorage.getItem(CAPSTONE_STORAGE_KEY));
      setMode(saved?.selectedBackend ?? "student");
      dispatch({ type: "reset", messages: saved?.messages.length ? saved.messages : initialMessages });
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || state.messages.some((message) => message.status === "streaming")) return;
    try {
      window.localStorage.setItem(CAPSTONE_STORAGE_KEY, serializeCapstoneRecord({ version: 2, selectedBackend: mode, messages: state.messages }));
    } catch {}
  }, [hydrated, mode, state.messages]);

  const trainStudent = () => {
    setTraining(true);
    setRequestPhase("training");
    window.setTimeout(() => {
      const trained = trainCharacterRnn(600);
      saveCharacterRnnArtifact(trained);
      setStudent({ checkpoint: trained.checkpoint, finalLoss: trained.finalLoss, parameters: trained.parameters, vocabularySize: trained.vocabularySize, trainedAt: Date.now() });
      setTraining(false);
      setRequestPhase("ready");
    }, 40);
  };

  const loadLocalModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    setModelStatus("loading");
    setModelProgress(0);
    setRequestPhase("loading");
    try {
      const transformers = await import("@huggingface/transformers");
      const progressCallback = (info: unknown) => {
        const update = info as { progress?: number; file?: string };
        if (typeof update.progress === "number") setModelProgress(Math.round(update.progress));
        if (update.file) setModelDetail(update.file.split("/").at(-1) ?? update.file);
      };
      const common = { dtype: "q4", progress_callback: progressCallback };
      let generator: TextGenerator;
      if ("gpu" in navigator) {
        try {
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "webgpu" }) as unknown as TextGenerator;
        } catch {
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "wasm" }) as unknown as TextGenerator;
        }
      } else {
        generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "wasm" }) as unknown as TextGenerator;
      }
      generatorRef.current = generator;
      setModelStatus("ready");
      setModelProgress(100);
      setModelDetail("SmolLM2-135M-Instruct · q4 · local");
      setRequestPhase("ready");
    } catch (error) {
      setModelStatus("error");
      setModelDetail(error instanceof Error ? error.message : "Model load failed");
      setRequestPhase("error");
    }
  };

  const generateResponse = async (userText: string, generationSeed: number) => {
    if (mode === "student") {
      if (!student) throw new Error("Train the student model first.");
      const continuation = sampleCharacterRnn(student.checkpoint, userText, runtime.model.maxTokens, runtime.model.temperature, runtime.model.seed + generationSeed, runtime.model.topK);
      return `${runtime.interface.responsePrefix}Prompt-conditioned character continuation:\n\n…${userText.slice(-32)}${continuation}`;
    }
    const generator = generatorRef.current;
    if (!generator) throw new Error("Load the local model first.");
    const context: ModelMessage[] = [
      { role: "system", content: "Answer in concise technical prose. If uncertain, state uncertainty. Do not use markdown headings." },
      ...messagesForBackend(state.messages, "local")
        .filter((message) => !message.id.startsWith("welcome-") && message.status === "complete")
        .slice(-6)
        .map((message) => ({ role: message.role, content: message.content } as ModelMessage)),
      { role: "user", content: userText },
    ];
    const result = await generator(context, { max_new_tokens: Math.min(runtime.model.maxTokens, 120), do_sample: true, temperature: runtime.model.temperature, top_k: runtime.model.topK || undefined, top_p: 0.9, repetition_penalty: 1.08 });
    const raw = extractGeneratedText(result).trim() || "The local model returned no text.";
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
      const response = await generateResponse(userText, Number(requestId.slice(2)) % 100000);
      const modelMs = performance.now() - modelStarted;
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setRequestPhase("streaming");
      let firstEvent = 0;
      let eventCount = 0;
      let tokens = 0;
      await consumeSse(createSseStream(response, controller.signal, runtime.transport.wordsPerEvent, runtime.transport.delayMs), (event, data) => {
        eventCount += 1;
        if (!firstEvent && event === "token") firstEvent = performance.now();
        if (event === "token") {
          const delta = String(data.delta ?? "");
          tokens += delta.match(/\S+/g)?.length ?? 0;
          dispatch({ type: "delta", id: assistantId, delta });
        }
        if (event === "cancelled") dispatch({ type: "terminal", id: assistantId, status: "cancelled" });
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
      dispatch({ type: "terminal", id: assistantId, status: cancelled ? "cancelled" : "error" });
      setRequestPhase(cancelled ? "cancelled" : "error");
    } finally {
      abortRef.current = null;
      window.setTimeout(() => setRequestPhase((phase) => phase === "cancelled" || phase === "error" ? "ready" : phase), 500);
    }
  };

  const stop = () => abortRef.current?.abort();
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
        <nav><Link href="/workspace">IDE</Link><Link href="/courses/models">Model</Link><Link href="/courses/systems">Platform</Link><Link href="/courses/product">React</Link></nav>
      </header>
      <div className="capstone-layout">
        <aside className="capstone-sidebar">
          <section className="backend-panel">
            <span>Model backend</span>
            <div className="mode-switch"><button disabled={generating} className={mode === "student" ? "active" : ""} type="button" onClick={() => switchMode("student")}>Student model</button><button disabled={generating} className={mode === "local" ? "active" : ""} type="button" onClick={() => switchMode("local")}>Local chat model</button></div>
            {mode === "student" ? (
              <div className="backend-card"><strong>18-unit character RNN</strong><p>{student ? "Checkpoint restored from device-local Course 01 state." : "Train here or complete Character RNNs to create a reusable local checkpoint."}</p>{student ? <dl><div><dt>Parameters</dt><dd>{student.parameters.toLocaleString()}</dd></div><div><dt>Final loss</dt><dd>{student.finalLoss.toFixed(3)}</dd></div></dl> : null}<button type="button" onClick={trainStudent} disabled={training}>{training ? "Training…" : student ? "Retrain model" : "Train model"}</button></div>
            ) : (
              <div className="backend-card"><strong>SmolLM2-135M · q4</strong><p>Real local generation with an explicit course-note grounding layer. Raw unmatched drafts remain labeled unverified.</p><div className="load-progress"><i><b style={{ width: `${modelProgress}%` }} /></i><em>{modelDetail}</em></div><button type="button" onClick={loadLocalModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>{modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${modelProgress}% loaded` : "Load ~181 MB"}</button></div>
            )}
          </section>
          <section className="runtime-panel">
            <span>Request lifecycle</span>
            <div className="phase-row">{["queued", "prefill", "streaming"].map((phase) => <i className={requestPhase === phase ? "active" : ""} key={phase}>{phase}</i>)}</div>
            {runtime.interface.showMetrics ? <dl><div><dt>Queue</dt><dd>{metrics.queueMs} ms</dd></div><div><dt>Model</dt><dd>{metrics.modelMs} ms</dd></div><div><dt>TTFT</dt><dd>{metrics.ttftMs} ms</dd></div><div><dt>Events</dt><dd>{metrics.events}</dd></div><div><dt>Tokens</dt><dd>{metrics.tokens}</dd></div><div><dt>Total</dt><dd>{metrics.durationMs} ms</dd></div></dl> : <p>Metrics hidden by runtime/interface.config.js.</p>}
          </section>
          <section className="transport-panel"><span>Transport · build {runtime.buildNumber}</span><strong>SSE-compatible ReadableStream</strong><code>{runtime.transport.wordsPerEvent} words/event · {runtime.transport.delayMs} ms</code><p>The compiled transport adapter controls how the visible answer arrives.</p></section>
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
