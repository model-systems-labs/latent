export const CAPSTONE_ENTRY_PATH = "capstone/main.tsx" as const;
export const CAPSTONE_COMPONENT_PATH = "capstone/BrowserChat.tsx" as const;

export type BrowserChatProjectFileKind =
  | "vendor"
  | "bridge"
  | "component"
  | "entry"
  | "style";

export type BrowserChatProjectTemplateFile = {
  path: string;
  title: string;
  kind: BrowserChatProjectFileKind;
  editable: boolean;
  source: string;
};

export const REACT_ADAPTER_SOURCE = `type ReactRuntime = {
  createElement: (...args: any[]) => any;
  Fragment: any;
  StrictMode: any;
  useEffect: (...args: any[]) => any;
  useMemo: (...args: any[]) => any;
  useReducer: (...args: any[]) => any;
  useRef: (...args: any[]) => any;
  useState: (...args: any[]) => any;
};

const React = (globalThis as {
  __LATENT_REACT__?: { React?: ReactRuntime };
}).__LATENT_REACT__?.React;

if (!React) {
  throw new Error("The trusted React runtime was not installed by the Latent preview host.");
}

export const Fragment = React.Fragment;
export const StrictMode = React.StrictMode;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useReducer = React.useReducer;
export const useRef = React.useRef;
export const useState = React.useState;
export default React;
`;

export const REACT_DOM_ADAPTER_SOURCE = `type Root = {
  render(node: any): void;
  unmount(): void;
};

const createRoot = (globalThis as {
  __LATENT_REACT__?: { createRoot?: (container: Element | DocumentFragment) => Root };
}).__LATENT_REACT__?.createRoot;

if (!createRoot) {
  throw new Error("The trusted React DOM runtime was not installed by the Latent preview host.");
}

export { createRoot };
`;

export const HOST_BRIDGE_SOURCE = `export type ChatRole = "system" | "user" | "assistant";
export type ChatBackend = "student" | "local";
export type GenerationPhase = "queued" | "loading" | "prefill" | "streaming" | "complete" | "cancelled" | "error";

export type PreviewInitialization = {
  buildId: string;
  buildNumber: number;
  selectedBackend: ChatBackend;
  studentReady: boolean;
  localReady: boolean;
  runtime: {
    model: { temperature: number; topK: number; maxTokens: number };
    transport: { wordsPerEvent: number; delayMs: number };
    interface: { assistantName: string; responsePrefix: string; showMetrics: boolean };
  };
  conversation: {
    version: 1;
    id: string;
    messages: unknown[];
  } | null;
};

export type BridgeMessage = {
  role: ChatRole;
  content: string;
};

export type StartGenerationInput = {
  requestId: string;
  backend: ChatBackend;
  messages: BridgeMessage[];
  requestFrame: string;
  options: {
    temperature: number;
    topK: number;
    maxTokens: number;
  };
};

export type GenerationMetrics = {
  queueMs: number;
  modelMs: number;
  ttftMs: number;
  generatedUnits: number;
  generatedUnitLabel: string;
  durationMs: number;
};

export type GenerationBridgeHandlers = {
  onPhase(phase: GenerationPhase): void;
  onChunk(chunk: string): void;
  onMetrics(metrics: GenerationMetrics): void;
  onError(error: { message: string; transient: boolean }): void;
};

export type GenerationHandle = {
  cancel(): void;
};

export type PreparationEvent = {
  type: "progress";
  progress: number;
  detail: string;
};

type GenerationEvent =
  | { type: "phase"; phase: GenerationPhase }
  | { type: "chunk"; chunk: string }
  | { type: "metrics"; metrics: GenerationMetrics }
  | { type: "error"; message: string; transient: boolean };

type PreviewHost = {
  request<TResult = unknown>(
    method: "initialize" | "train-student" | "load-local" | "generate" | "cancel" | "persist",
    payload: unknown,
    onEvent?: (event: unknown) => void,
  ): Promise<TResult>;
};

const previewHost = (globalThis as {
  __LATENT_PREVIEW_HOST__?: PreviewHost;
}).__LATENT_PREVIEW_HOST__;

if (!previewHost) {
  throw new Error("The trusted Latent preview host was not installed.");
}

function isGenerationEvent(value: unknown): value is GenerationEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<GenerationEvent>;
  return event.type === "phase" || event.type === "chunk" || event.type === "metrics" || event.type === "error";
}

export function initializePreview() {
  return previewHost.request<PreviewInitialization>("initialize", {});
}

export function trainStudent(onEvent?: (event: PreparationEvent) => void) {
  return previewHost.request<{ ready: true }>("train-student", {}, (event) => {
    if (!event || typeof event !== "object") return;
    const progress = event as Partial<PreparationEvent>;
    if (progress.type === "progress" && typeof progress.progress === "number" && typeof progress.detail === "string") {
      onEvent?.(progress as PreparationEvent);
    }
  });
}

export function loadLocal(onEvent?: (event: PreparationEvent) => void) {
  return previewHost.request<{ ready: true }>("load-local", {}, (event) => {
    if (!event || typeof event !== "object") return;
    const progress = event as Partial<PreparationEvent>;
    if (progress.type === "progress" && typeof progress.progress === "number" && typeof progress.detail === "string") {
      onEvent?.(progress as PreparationEvent);
    }
  });
}

export function persistConversation(record: unknown, selectedBackend: ChatBackend) {
  return previewHost.request<void>("persist", { record, selectedBackend });
}

export function startGeneration(
  input: StartGenerationInput,
  handlers: GenerationBridgeHandlers,
): GenerationHandle {
  let closed = false;
  void previewHost.request("generate", input, (value) => {
    if (closed || !isGenerationEvent(value)) return;
    const event = value;
    if (event.type === "phase") {
      handlers.onPhase(event.phase);
      if (["complete", "cancelled", "error"].includes(event.phase)) close();
    } else if (event.type === "chunk") {
      handlers.onChunk(event.chunk);
    } else if (event.type === "metrics") {
      handlers.onMetrics(event.metrics);
    } else if (event.type === "error") {
      handlers.onError({ message: event.message, transient: event.transient });
      close();
    }
  }).catch((error) => {
    if (closed) return;
    handlers.onError({
      message: error instanceof Error ? error.message : "The preview host rejected generation.",
      transient: false,
    });
    close();
  });
  const close = () => {
    if (closed) return;
    closed = true;
  };
  return {
    cancel() {
      if (closed) return;
      close();
      void previewHost.request("cancel", { requestId: input.requestId });
    },
  };
}
`;

export const BROWSER_CHAT_COMPONENT_SOURCE = `import React, { useEffect, useMemo, useReducer, useRef, useState } from "../vendor/react";
import { createMessage, appendMessageDelta } from "../product/chat-reducer.js";
import { selectContext, createRegeneration } from "../product/chat-actions.js";
import { encodeSse, parseSseChunk } from "../backend/streaming-transport.js";
import { shouldRetry, acceptEvent } from "../backend/generation-reliability.js";
import { validConversationRecord, generationStatusLabel } from "../product/chat-quality.js";
import { flushTokenBuffer, shouldFollowStream } from "../product/streaming-react.js";
import {
  initializePreview,
  loadLocal,
  persistConversation,
  startGeneration,
  trainStudent,
  type ChatBackend,
  type GenerationHandle,
  type GenerationMetrics,
  type GenerationPhase,
  type PreviewInitialization,
} from "../runtime/host-bridge";

type MessageStatus = "complete" | "streaming" | "cancelled" | "error";
type Message = {
  id: string;
  role: "user" | "assistant";
  backend: ChatBackend;
  content: string;
  status: MessageStatus;
  createdAt: number;
  parentUserId?: string;
  attemptId?: string | null;
  requestId?: string | null;
};

type ChatState = { messages: Message[] };
type ChatAction =
  | { type: "append"; message: Message }
  | { type: "delta"; messageId: string; attemptId: string; requestId: string; delta: string }
  | { type: "terminal"; messageId: string; status: MessageStatus }
  | { type: "replace"; messages: Message[] };

const EMPTY_METRICS: GenerationMetrics = {
  queueMs: 0,
  modelMs: 0,
  ttftMs: 0,
  generatedUnits: 0,
  generatedUnitLabel: "Generated units",
  durationMs: 0,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "append") return { messages: [...state.messages, action.message] };
  if (action.type === "delta") {
    return { messages: appendMessageDelta(state.messages, {
      messageId: action.messageId,
      attemptId: action.attemptId,
      requestId: action.requestId,
      delta: action.delta,
    }) };
  }
  if (action.type === "terminal") {
    return {
      messages: state.messages.map((message) =>
        message.id === action.messageId ? { ...message, status: action.status } : message,
      ),
    };
  }
  return { messages: action.messages };
}

function estimateTokens(content: string) {
  return Math.max(1, Math.ceil(content.length / 4));
}

function messageRecord(input: {
  id: string;
  role: "user" | "assistant";
  backend: ChatBackend;
  content?: string;
  status?: MessageStatus;
  parentUserId?: string;
  attemptId?: string;
  requestId?: string;
}): Message {
  return {
    ...createMessage({
      id: input.id,
      role: input.role,
      content: input.content || "",
      status: input.status || "complete",
      attemptId: input.attemptId || null,
      requestId: input.requestId || null,
    }),
    backend: input.backend,
    parentUserId: input.parentUserId,
  } as Message;
}

function restoreMessages(record: unknown): Message[] {
  if (!validConversationRecord(record)) return [];
  return record.messages.filter((message: unknown): message is Omit<Message, "createdAt"> => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Partial<Message>;
    return typeof candidate.id === "string"
      && (candidate.role === "user" || candidate.role === "assistant")
      && (candidate.backend === "student" || candidate.backend === "local")
      && typeof candidate.content === "string"
      && ["complete", "cancelled", "error"].includes(String(candidate.status));
  }).map((message: Omit<Message, "createdAt">) => ({ ...message, createdAt: 0 }));
}

function conversationRecord(messages: Message[]) {
  return {
    version: 1,
    id: "active",
    messages: messages
      .filter((message) => message.status !== "streaming")
      .map(({ id, role, backend, content, status, attemptId, parentUserId }) => ({
        id,
        role,
        backend,
        content,
        status,
        ...(attemptId ? { attemptId } : {}),
        ...(parentUserId ? { parentUserId } : {}),
      })),
  };
}

export function BrowserChat() {
  const [state, dispatch] = useReducer(chatReducer, { messages: [] } as ChatState);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [backend, setBackend] = useState<ChatBackend>("local");
  const [phase, setPhase] = useState<GenerationPhase>("complete");
  const [metrics, setMetrics] = useState<GenerationMetrics>(EMPTY_METRICS);
  const [error, setError] = useState("");
  const [temperature, setTemperature] = useState(0.72);
  const [topK, setTopK] = useState(24);
  const [maxTokens, setMaxTokens] = useState(160);
  const [preview, setPreview] = useState<PreviewInitialization | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [preparationDetail, setPreparationDetail] = useState("Checking model state");
  const [persistencePhase, setPersistencePhase] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const activeHandle = useRef<GenerationHandle | null>(null);
  const activeRequest = useRef<{ id: string; status: string } | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const latestTerminalRecord = useRef<{ record: unknown; selectedBackend: ChatBackend } | null>(null);
  const persistenceGeneration = useRef(0);
  const terminalConversation = useMemo(() => conversationRecord(state.messages), [state.messages]);
  const terminalConversationIdentity = JSON.stringify(terminalConversation);

  useEffect(() => {
    let active = true;
    void initializePreview().then((initialization) => {
      if (!active) return;
      dispatch({ type: "replace", messages: restoreMessages(initialization.conversation) });
      setPreview(initialization);
      setBackend(initialization.selectedBackend);
      setTemperature(initialization.runtime.model.temperature);
      setTopK(initialization.runtime.model.topK);
      setMaxTokens(Math.min(160, initialization.runtime.model.maxTokens));
      setPreparationDetail("Active build #" + initialization.buildNumber);
      setHydrated(true);
    }).catch((initializationError) => {
      if (!active) return;
      dispatch({ type: "replace", messages: [] });
      setHydrated(true);
      setError(initializationError instanceof Error ? initializationError.message : "The preview host is unavailable.");
    });
    return () => {
      active = false;
      activeHandle.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const record: unknown = JSON.parse(terminalConversationIdentity);
    if (!validConversationRecord(record)) return;
    latestTerminalRecord.current = { record, selectedBackend: backend };
    const generation = ++persistenceGeneration.current;
    setPersistencePhase("saving");
    void persistConversation(record, backend).then(() => {
      if (persistenceGeneration.current === generation) setPersistencePhase("saved");
    }).catch(() => {
      if (persistenceGeneration.current === generation) setPersistencePhase("error");
    });
  }, [backend, hydrated, terminalConversationIdentity]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 520px)");
    const sync = () => setControlsOpen(!compact.matches);
    sync();
    compact.addEventListener("change", sync);
    return () => compact.removeEventListener("change", sync);
  }, []);

  const retryPersistence = () => {
    const latest = latestTerminalRecord.current;
    if (!latest || !validConversationRecord(latest.record)) return;
    const generation = ++persistenceGeneration.current;
    setPersistencePhase("saving");
    void persistConversation(latest.record, latest.selectedBackend).then(() => {
      if (persistenceGeneration.current === generation) setPersistencePhase("saved");
    }).catch(() => {
      if (persistenceGeneration.current === generation) setPersistencePhase("error");
    });
  };

  const generating = ["queued", "prefill", "streaming"].includes(phase);
  const busy = preparing || generating;
  const canStop = generating && Boolean(activeHandle.current);
  const latestUser = useMemo(
    () => [...state.messages].reverse().find((message) => message.backend === backend && message.role === "user"),
    [backend, state.messages],
  );
  const visibleMessages = useMemo(
    () => state.messages.filter((message) => message.backend === backend),
    [backend, state.messages],
  );
  const backendReady = backend === "student" ? Boolean(preview?.studentReady) : Boolean(preview?.localReady);

  const followTranscript = () => {
    const element = transcriptRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (shouldFollowStream({ distanceFromBottom, userScrolledUp: distanceFromBottom > 120 })) {
      element.scrollTop = element.scrollHeight;
    }
  };

  const runGeneration = (userText: string, parentUserId: string, attempt: number) => {
    const requestId = "request-" + Date.now() + "-" + attempt;
    const attemptId = "attempt-" + requestId;
    const assistantId = "assistant-" + requestId;
    const branch = createRegeneration({
      messageId: assistantId,
      parentUserId,
      attemptId,
      requestId,
    });
    dispatch({
      type: "append",
      message: messageRecord({
        id: branch.messageId,
        role: "assistant",
        backend,
        status: "streaming",
        parentUserId: branch.parentUserId,
        attemptId: branch.attemptId,
        requestId: branch.requestId,
      }),
    });
    activeRequest.current = { id: requestId, status: "queued" };
    setPhase("queued");
    setMetrics(EMPTY_METRICS);
    setError("");

    const currentUser = { id: parentUserId, role: "user", status: "complete", content: userText, tokens: estimateTokens(userText) };
    const systemContext = [{ id: "system", role: "system", content: "Answer in concise technical prose.", tokens: 9 }];
    const historicalContext = state.messages
        .filter((message) => message.backend === backend && message.status === "complete" && message.id !== parentUserId)
        .map((message) => ({
          id: message.id,
          role: message.role,
          status: message.status,
          content: message.content,
          tokens: estimateTokens(message.content),
        }));
    const bounded = selectContext({ system: systemContext, history: historicalContext, activeUser: currentUser, budget: 2048 });
    if (bounded.overflow) {
      activeRequest.current.status = "error";
      dispatch({ type: "terminal", messageId: assistantId, status: "error" });
      setPhase("error");
      setError("Required instructions and the current prompt exceed the 2048-token request budget.");
      return;
    }
    const requestContext = bounded.selected;
    const requestFrame = encodeSse("request", {
      requestId,
      backend,
      messages: requestContext.map((message: { role: string; content: string }) => ({
        role: message.role,
        content: message.content,
      })),
    });
    let remainder = "";
    let emittedTokens = 0;

    const finish = (status: MessageStatus, nextPhase: GenerationPhase) => {
      if (!activeRequest.current || activeRequest.current.id !== requestId) return;
      activeRequest.current.status = nextPhase;
      dispatch({ type: "terminal", messageId: assistantId, status });
      setPhase(nextPhase);
      activeHandle.current = null;
      window.setTimeout(followTranscript, 0);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    };

    activeHandle.current = startGeneration({
      requestId,
      backend,
      messages: requestContext.map((message: { role: string; content: string }) => ({
        role: message.role as "system" | "user" | "assistant",
        content: message.content,
      })),
      requestFrame,
      options: { temperature, topK, maxTokens },
    }, {
      onPhase(nextPhase) {
        const current = activeRequest.current;
        if (!current || !acceptEvent(current, { requestId })) return;
        current.status = nextPhase;
        setPhase(nextPhase);
        if (nextPhase === "complete") finish("complete", "complete");
        if (nextPhase === "cancelled") finish("cancelled", "cancelled");
      },
      onChunk(chunk) {
        const current = activeRequest.current;
        if (!current || !acceptEvent(current, { requestId })) return;
        const parsed = parseSseChunk(remainder, chunk);
        remainder = parsed.remainder;
        for (const event of parsed.events) {
          if (event.event === "token" && typeof event.data?.delta === "string") {
            const flushed = flushTokenBuffer([event.data.delta]);
            emittedTokens += 1;
            dispatch({ type: "delta", messageId: assistantId, attemptId: branch.attemptId, requestId, delta: flushed.text });
          } else if (event.event === "done") {
            finish("complete", "complete");
          } else if (event.event === "error") {
            const detail = typeof event.data?.message === "string" ? event.data.message : "Generation failed.";
            setError(detail);
            finish("error", "error");
          }
        }
        window.setTimeout(followTranscript, 0);
      },
      onMetrics(nextMetrics) {
        setMetrics(nextMetrics);
      },
      onError(bridgeError) {
        if (backend === "local") {
          void initializePreview().then(setPreview).catch(() => undefined);
        }
        if (shouldRetry({
          transient: bridgeError.transient,
          tokensEmitted: emittedTokens,
          attempt,
          maxAttempts: 2,
        })) {
          finish("error", "error");
          window.setTimeout(() => runGeneration(userText, parentUserId, attempt + 1), 80);
          return;
        }
        setError(bridgeError.message);
        finish("error", "error");
      },
    });
  };

  const send = (text = input) => {
    const userText = text.trim();
    if (!userText || busy || !backendReady) return;
    const userId = "user-" + Date.now();
    dispatch({
      type: "append",
      message: messageRecord({ id: userId, role: "user", backend, content: userText }),
    });
    setInput("");
    runGeneration(userText, userId, 0);
  };

  const regenerate = () => {
    if (!latestUser || busy) return;
    runGeneration(latestUser.content, latestUser.id, 0);
  };

  const stop = () => {
    const handle = activeHandle.current;
    if (!handle) return;
    activeHandle.current = null;
    handle.cancel();
    const request = activeRequest.current;
    if (request) request.status = "cancelled";
    const activeAssistant = [...state.messages].reverse().find((message) => message.backend === backend && message.status === "streaming");
    if (activeAssistant) dispatch({ type: "terminal", messageId: activeAssistant.id, status: "cancelled" });
    setPhase("cancelled");
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const clear = () => {
    if (busy) return;
    dispatch({ type: "replace", messages: state.messages.filter((message) => message.backend !== backend) });
    setError("");
    setMetrics(EMPTY_METRICS);
    setPhase("complete");
  };

  const prepareBackend = async () => {
    if (preparing || backendReady) return;
    setPreparing(true);
    setError("");
    setPhase("loading");
    setPreparationDetail(backend === "student" ? "Preparing training worker" : "Preparing local model");
    try {
      const update = (event: { progress: number; detail: string }) => {
        setPreparationDetail(event.detail + " · " + Math.round(event.progress) + "%");
      };
      if (backend === "student") await trainStudent(update);
      else await loadLocal(update);
      const initialization = await initializePreview();
      setPreview(initialization);
      setPreparationDetail("Active build #" + initialization.buildNumber);
      setPhase("complete");
    } catch (preparationError) {
      setError(preparationError instanceof Error ? preparationError.message : "The selected model could not be prepared.");
      setPhase("error");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <main className="browser-chat">
      <header className="app-header">
        <div>
          <span className="project-label">browser-chat / active build</span>
          <h1>Browser Chat</h1>
        </div>
        <div className="phase-status" data-phase={phase} role="status" aria-live="polite" aria-atomic="true">
          <i />
          <span>{generationStatusLabel(phase)}</span>
        </div>
      </header>

      <div className="app-layout">
        <aside className="control-panel">
          <section>
            <span className="section-label">Model backend</span>
            <div className="segmented-control">
              <button className={backend === "local" ? "active" : ""} disabled={busy} onClick={() => setBackend("local")} type="button">Local Transformer</button>
              <button className={backend === "student" ? "active" : ""} disabled={busy} onClick={() => setBackend("student")} type="button">Student RNN</button>
            </div>
            <p>{backend === "local" ? "A real local model served through the isolated host bridge." : "The checkpoint and recurrent functions completed in Model Foundations."}</p>
            <button className="prepare-model" type="button" disabled={preparing || backendReady} onClick={() => void prepareBackend()}>
              {backendReady ? "Model ready" : preparing ? preparationDetail : backend === "student" ? "Train student model" : "Load local model"}
            </button>
          </section>

          <section className="inference-panel">
            <details open={controlsOpen} onToggle={(event) => setControlsOpen(event.currentTarget.open)}>
              <summary><span className="section-label">Inference controls</span><strong>{temperature.toFixed(2)} · k {topK} · max {maxTokens}</strong></summary>
              <div className="inference-fields">
                <label>
                  <span>Temperature <strong>{temperature.toFixed(2)}</strong></span>
                  <input type="range" min="0.2" max="1.4" step="0.02" value={temperature} onChange={(event) => setTemperature(Number(event.currentTarget.value))} />
                </label>
                <label>
                  <span>Top-k <strong>{topK}</strong></span>
                  <input type="range" min="0" max="64" step="1" value={topK} onChange={(event) => setTopK(Number(event.currentTarget.value))} />
                </label>
                <label>
                  <span>Maximum generated units <strong>{maxTokens}</strong></span>
                  <input type="range" min="40" max="160" step="10" value={maxTokens} onChange={(event) => setMaxTokens(Number(event.currentTarget.value))} />
                </label>
                <p>Local Transformer: at most 160 tokenizer generation steps. Student RNN: at most 160 generated characters. The model.config.js seed applies to Student RNN sampling only; this local Transformer runtime does not expose deterministic seeding.</p>
              </div>
            </details>
          </section>

          {preview?.runtime.interface.showMetrics !== false ? <section className="metrics-panel">
            <span className="section-label">Last request</span>
            <dl>
              <div><dt>Host queue</dt><dd>{metrics.queueMs} ms</dd></div>
              <div><dt>First visible</dt><dd>{metrics.ttftMs} ms</dd></div>
              <div><dt>Model run</dt><dd>{metrics.modelMs} ms</dd></div>
              <div><dt>{metrics.generatedUnitLabel}</dt><dd>{metrics.generatedUnits}</dd></div>
              <div><dt>Total</dt><dd>{metrics.durationMs} ms</dd></div>
            </dl>
          </section> : null}

          <footer>
            <button type="button" onClick={clear} disabled={busy || visibleMessages.length === 0}>Clear conversation</button>
            {persistencePhase === "error" ? <span role="alert">Save failed · latest terminal snapshot retained <button type="button" onClick={retryPersistence}>Retry save</button></span> : <span role="status" aria-live="polite">{persistencePhase === "saving" ? "Saving on this device…" : persistencePhase === "saved" ? "Saved on this device" : "Not saved yet"}</span>}
          </footer>
        </aside>

        <section className="conversation-panel">
          <div className="conversation-heading">
            <div><span>Conversation</span><strong>{visibleMessages.length ? visibleMessages.length + " messages" : "New session"}</strong></div>
            <button type="button" onClick={regenerate} disabled={busy || !latestUser}>Regenerate</button>
          </div>

          <div className="transcript" ref={transcriptRef} role="log" aria-live="polite" aria-label="Conversation transcript">
            {!hydrated ? <p className="empty-state">Restoring device-local conversation…</p> : null}
            {hydrated && visibleMessages.length === 0 ? (
              <div className="empty-state">
                <span>Active project connected</span>
                <h2>Ask the system you built.</h2>
                <p>Messages move through your context policy, serving protocol, reliability guards, reducer, and render buffer.</p>
              </div>
            ) : null}
            {visibleMessages.map((message) => (
              <article className={"message " + message.role + " " + message.status} key={message.id}>
                <span>{message.role === "user" ? "You" : preview?.runtime.interface.assistantName || (backend === "student" ? "Student model" : "Local model")}</span>
                <p>{message.content || (message.status === "streaming" ? "Processing context…" : "No output")}</p>
                {message.status !== "complete" ? <em>{message.status}</em> : null}
              </article>
            ))}
          </div>

          {error ? <div className="request-error" role="alert"><strong>Request failed</strong><span>{error}</span></div> : null}

          <form className="composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <textarea
              ref={composerRef}
              aria-label="Chat message"
              placeholder="Ask about the model, runtime, or serving path…"
              value={input}
              disabled={busy || !backendReady}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <div>
              <span>Enter to send · Shift+Enter for newline</span>
              {canStop ? <button className="stop" type="button" onClick={stop}>Stop</button> : <button type="submit" disabled={busy || !input.trim() || !backendReady}>Send</button>}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
`;

export const CAPSTONE_MAIN_SOURCE = `import React from "../vendor/react";
import { createRoot } from "../vendor/react-dom-client";
import { BrowserChat } from "./BrowserChat";
import { installStyles } from "./styles";

export function mount() {
  installStyles();
  const target = document.getElementById("root");
  if (!target) throw new Error("Browser Chat requires a #root element.");
  const root = createRoot(target);
  root.render(
    <React.StrictMode>
      <BrowserChat />
    </React.StrictMode>,
  );
  return () => root.unmount();
}

mount();
`;

const BROWSER_CHAT_CSS = `
:root {
  color: #29262d;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  --ink: #29262d;
  --muted: #625d67;
  --faint: #69636d;
  --line: rgba(64, 53, 73, 0.13);
  --violet: #746487;
  --paper: rgba(250, 248, 245, 0.86);
  background: #f3f0ec;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 78% 9%, rgba(173, 151, 193, 0.22), transparent 32rem), radial-gradient(circle at 11% 86%, rgba(225, 186, 145, 0.18), transparent 30rem), #f3f0ec; }
button, textarea, input { font: inherit; }
button { color: inherit; }
.browser-chat { min-height: 100vh; padding: 1.25rem; }
.app-header { align-items: center; display: flex; justify-content: space-between; margin: 0 auto; max-width: 1320px; min-height: 4.75rem; padding: 0 0.25rem 1.25rem; }
.app-header h1 { font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 4vw, 3.4rem); font-weight: 400; letter-spacing: -0.05em; line-height: 1; margin: 0.35rem 0 0; }
.project-label, .section-label, .conversation-heading span { color: var(--faint); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; }
.phase-status { align-items: center; display: flex; font-size: 0.75rem; gap: 0.55rem; }
.phase-status i { background: #73927b; border-radius: 50%; box-shadow: 0 0 0 5px rgba(115, 146, 123, 0.1); height: 0.46rem; width: 0.46rem; }
.phase-status[data-phase="streaming"] i, .phase-status[data-phase="prefill"] i { animation: pulse 1.4s infinite; background: #947bb1; }
.phase-status[data-phase="error"] i { background: #a96d6d; }
.app-layout { background: var(--paper); border: 1px solid rgba(65, 53, 72, 0.18); border-radius: 1.25rem; box-shadow: 0 30px 80px rgba(61, 48, 67, 0.1); display: grid; grid-template-columns: 18rem minmax(0, 1fr); margin: 0 auto; max-width: 1320px; min-height: calc(100vh - 7.5rem); overflow: hidden; backdrop-filter: blur(24px); }
.control-panel { border-right: 1px solid var(--line); display: flex; flex-direction: column; min-width: 0; }
.control-panel section { border-bottom: 1px solid var(--line); padding: 1.35rem; }
.control-panel section p { color: var(--muted); font-size: 0.74rem; line-height: 1.55; margin: 0.85rem 0 0; }
.inference-panel details summary { align-items: center; cursor: pointer; display: flex; justify-content: space-between; list-style: none; }
.inference-panel details summary::-webkit-details-marker { display: none; }
.inference-panel details summary::after { color: var(--faint); content: "＋"; font-size: 0.8rem; margin-left: 0.6rem; }
.inference-panel details[open] summary::after { content: "−"; }
.inference-panel summary > strong { color: var(--faint); font-size: 0.68rem; font-weight: 500; margin-left: auto; }
.segmented-control { display: grid; gap: 0.35rem; margin-top: 0.85rem; }
.segmented-control button, .control-panel footer button, .conversation-heading button, .composer button { background: transparent; border: 1px solid var(--line); border-radius: 999px; cursor: pointer; font-size: 0.7rem; padding: 0.65rem 0.85rem; text-align: left; }
.segmented-control button.active { background: rgba(116, 100, 135, 0.1); border-color: rgba(116, 100, 135, 0.4); color: #5c496f; }
.prepare-model { background: rgba(255, 255, 255, 0.45); border: 1px solid var(--line); border-radius: 999px; cursor: pointer; font-size: 0.68rem; margin-top: 0.8rem; padding: 0.65rem 0.85rem; width: 100%; }
button:disabled { cursor: default; opacity: 0.42; }
.control-panel label { display: grid; gap: 0.5rem; margin-top: 1rem; }
.control-panel label > span { display: flex; font-size: 0.7rem; justify-content: space-between; }
.control-panel label strong { color: var(--violet); font-weight: 600; }
input[type="range"] { accent-color: var(--violet); width: 100%; }
.metrics-panel dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0.7rem 0 0; }
.metrics-panel dl div { border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; padding: 0.65rem 0; }
.metrics-panel dl div:nth-child(odd) { padding-right: 0.65rem; }
.metrics-panel dl div:nth-child(even) { border-left: 1px solid var(--line); padding-left: 0.65rem; }
.metrics-panel dt { color: var(--faint); font-size: 0.68rem; }
.metrics-panel dd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.68rem; margin: 0; }
.control-panel footer { align-items: start; display: flex; flex-direction: column; gap: 0.7rem; margin-top: auto; padding: 1.35rem; }
.control-panel footer span { color: var(--faint); font-size: 0.68rem; }
.conversation-panel { display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; min-width: 0; }
.conversation-heading { align-items: center; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; min-height: 4.4rem; padding: 0.9rem 1.5rem; }
.conversation-heading > div { display: grid; gap: 0.3rem; }
.conversation-heading strong { font-family: Georgia, "Times New Roman", serif; font-size: 1.05rem; font-weight: 400; }
.transcript { min-height: 20rem; overflow-y: auto; padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1.25rem, 7vw, 6rem); scroll-behavior: smooth; }
.empty-state { margin: clamp(3rem, 10vh, 7rem) auto; max-width: 31rem; text-align: center; }
.empty-state > span { color: var(--violet); font-size: 0.64rem; letter-spacing: 0.1em; text-transform: uppercase; }
.empty-state h2 { font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 4vw, 3.25rem); font-weight: 400; letter-spacing: -0.04em; margin: 0.85rem 0; }
.empty-state p { color: var(--muted); font-family: Georgia, "Times New Roman", serif; font-size: 0.95rem; line-height: 1.65; }
.message { border-top: 1px solid var(--line); display: grid; gap: 0.55rem; grid-template-columns: 7.5rem minmax(0, 1fr) auto; padding: 1.35rem 0; }
.message:first-of-type { border-top: 0; }
.message > span { color: var(--faint); font-size: 0.68rem; letter-spacing: 0.08em; padding-top: 0.2rem; text-transform: uppercase; }
.message p { font-family: Georgia, "Times New Roman", serif; font-size: 1rem; line-height: 1.65; margin: 0; white-space: pre-wrap; }
.message.user p { color: #49414d; }
.message em { color: var(--violet); font-size: 0.68rem; font-style: normal; }
.message.cancelled p, .message.error p { color: var(--muted); }
.request-error { background: rgba(169, 109, 109, 0.08); border-top: 1px solid rgba(169, 109, 109, 0.18); display: grid; gap: 0.25rem; padding: 0.85rem 1.5rem; }
.request-error strong { color: #8a5555; font-size: 0.67rem; }
.request-error span { color: var(--muted); font-size: 0.7rem; }
.composer { border-top: 1px solid var(--line); padding: 1rem 1.25rem 1.15rem; }
.composer textarea { background: rgba(255, 255, 255, 0.54); border: 1px solid var(--line); border-radius: 0.85rem; color: var(--ink); min-height: 6.3rem; outline: none; padding: 1rem; resize: vertical; width: 100%; }
.composer textarea:focus { border-color: rgba(116, 100, 135, 0.48); box-shadow: 0 0 0 3px rgba(116, 100, 135, 0.08); }
.composer > div { align-items: center; display: flex; justify-content: space-between; padding: 0.65rem 0.15rem 0; }
.composer > div > span { color: var(--faint); font-size: 0.68rem; }
.composer button { background: #3a343e; color: #fff; min-width: 5rem; text-align: center; }
.composer button.stop { background: #865d61; }
@keyframes pulse { 50% { opacity: 0.38; transform: scale(0.78); } }
@media (max-width: 800px) {
  .browser-chat { padding: 0; }
  .app-header { padding: 1rem 1.1rem; }
  button, .inference-panel details summary, input[type="range"] { min-height: 2.75rem; }
  .app-layout { border: 0; border-radius: 0; grid-template-columns: 1fr; min-height: calc(100vh - 5rem); }
  .control-panel { border-bottom: 1px solid var(--line); border-right: 0; display: grid; grid-template-columns: 1fr 1fr; }
  .control-panel section { padding: 1rem; }
  .control-panel .metrics-panel, .control-panel footer { grid-column: 1 / -1; }
  .control-panel footer { margin-top: 0; padding: 1rem; }
  .conversation-panel { min-height: 62vh; }
  .transcript { padding: 1.25rem; }
  .message { grid-template-columns: 1fr; gap: 0.3rem; }
  .message > span { padding: 0; }
}
@media (max-width: 520px) {
  .app-header h1 { font-size: 2rem; }
  .project-label { display: none; }
  .control-panel { display: block; }
  .control-panel section, .control-panel footer { padding: 0.85rem 1rem; }
  .inference-panel summary > strong { max-width: 10.5rem; text-align: right; }
  .conversation-heading { padding: 0.8rem 1rem; }
  .composer { padding: 0.8rem; }
  .composer > div > span { max-width: 12rem; }
}
`;

export const CAPSTONE_STYLES_SOURCE = `const styles = ${JSON.stringify(BROWSER_CHAT_CSS)};

export function installStyles() {
  if (document.querySelector("style[data-browser-chat]")) return;
  const element = document.createElement("style");
  element.dataset.browserChat = "true";
  element.textContent = styles;
  document.head.appendChild(element);
}

export { styles };
`;

/**
 * Course-owned files that make the virtual project a complete React program.
 * The fourteen lesson-owned source paths intentionally remain in the LLM
 * Systems curriculum manifest so project structure has one owner per file.
 */
export const CANONICAL_BROWSER_CHAT_FILES = Object.freeze([
  {
    path: "vendor/react.ts",
    title: "React runtime adapter",
    kind: "vendor",
    editable: false,
    source: REACT_ADAPTER_SOURCE,
  },
  {
    path: "vendor/react-dom-client.ts",
    title: "React DOM runtime adapter",
    kind: "vendor",
    editable: false,
    source: REACT_DOM_ADAPTER_SOURCE,
  },
  {
    path: "runtime/host-bridge.ts",
    title: "Isolated host bridge",
    kind: "bridge",
    editable: false,
    source: HOST_BRIDGE_SOURCE,
  },
  {
    path: CAPSTONE_COMPONENT_PATH,
    title: "Browser Chat",
    kind: "component",
    editable: true,
    source: BROWSER_CHAT_COMPONENT_SOURCE,
  },
  {
    path: CAPSTONE_ENTRY_PATH,
    title: "Capstone entrypoint",
    kind: "entry",
    editable: false,
    source: CAPSTONE_MAIN_SOURCE,
  },
  {
    path: "capstone/styles.ts",
    title: "Browser Chat styles",
    kind: "style",
    editable: true,
    source: CAPSTONE_STYLES_SOURCE,
  },
] satisfies readonly BrowserChatProjectTemplateFile[]);

export const browserChatProjectFileByPath: ReadonlyMap<
  string,
  BrowserChatProjectTemplateFile
> = new Map(CANONICAL_BROWSER_CHAT_FILES.map((file) => [file.path, file]));
