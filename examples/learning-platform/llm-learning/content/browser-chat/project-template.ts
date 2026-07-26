export const CAPSTONE_ENTRY_PATH = "capstone/main.tsx" as const;
export const CAPSTONE_COMPONENT_PATH = "capstone/BrowserChat.tsx" as const;

export type BrowserChatProjectFileKind =
  | "vendor"
  | "bridge"
  | "adapter"
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

export const BROWSER_CHAT_ADAPTER_PATHS = Object.freeze({
  modelSoftmax: "runtime/adapters/model-softmax.js",
  streamingTransport: "runtime/adapters/streaming-transport.js",
  generationReliability: "runtime/adapters/generation-reliability.js",
  chatReducer: "runtime/adapters/chat-reducer.js",
  chatActions: "runtime/adapters/chat-actions.js",
  chatQuality: "runtime/adapters/chat-quality.js",
  streamingReact: "runtime/adapters/streaming-react.js",
} as const);

export const MODEL_SOFTMAX_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This is where the model code connects to React in the browser.
export function stableSoftmax(logits) {
  if (!Array.isArray(logits) || logits.length === 0) return [];
  const maximum = Math.max(...logits);
  const weights = logits.map((logit) => Math.exp(logit - maximum));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}
`;

export const STREAMING_TRANSPORT_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This file handles SSE framing for React.
export function encodeSse(event, data) {
  if (typeof event !== "string" || !event || /[\\r\\n]/.test(event)) {
    throw new Error("event name must be non-empty and contain no CR or LF");
  }
  return "event: " + event + "\\n" + "data: " + JSON.stringify(data) + "\\n\\n";
}

export function parseSseChunk(buffer, chunk) {
  const combined = buffer + chunk;
  const frames = combined.split(/\\r?\\n\\r?\\n/);
  const remainder = frames.pop() ?? "";
  const events = frames.map((frame) => {
    let event = "message";
    const dataLines = [];

    for (const line of frame.split(/\\r?\\n/)) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event" && value) event = value;
      if (field === "data") dataLines.push(value);
    }

    const serialized = dataLines.length ? dataLines.join("\\n") : "null";
    return { event, data: JSON.parse(serialized) };
  });
  return { events, remainder };
}
`;

export const GENERATION_RELIABILITY_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This file keeps React requests on the right attempt and transport.
export function shouldRetry({ transient, tokensEmitted, attempt, maxAttempts = 2 }) {
  return transient && tokensEmitted === 0 && attempt + 1 < maxAttempts;
}

export function acceptEvent(request, event) {
  const active = ["queued", "loading", "prefill", "streaming"];
  return active.includes(request.status)
    && request.attemptId === event.attemptId
    && request.requestId === event.requestId;
}
`;

export const CHAT_REDUCER_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This file gives React the immutable reducer updates it needs.
export function createMessage({ id, role, content = "", status = "complete", attemptId = null, requestId = null }) {
  return { id, role, content, status, attemptId, requestId, createdAt: 0 };
}

export function appendMessageDelta(messages, { messageId, attemptId, requestId, delta }) {
  return messages.map((message) =>
    message.id === messageId &&
    message.attemptId === attemptId &&
    message.requestId === requestId &&
    message.status === "streaming"
      ? { ...message, content: message.content + delta }
      : message,
  );
}
`;

export const CHAT_ACTIONS_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This is where React gets context selection and regeneration support.
export function selectContext({ system, history, activeUser, budget }) {
  const requiredSystem = system.filter((message) => message.role === "system");
  const turns = [];
  for (let index = 0; index < history.length - 1; index += 1) {
    const user = history[index];
    const assistant = history[index + 1];
    if (user.role === "user" && user.status === "complete" &&
        assistant.role === "assistant" && assistant.status === "complete") {
      turns.push([user, assistant]);
      index += 1;
    }
  }
  const selectedTurns = [];
  let used = requiredSystem.reduce((sum, message) => sum + message.tokens, 0) + activeUser.tokens;
  const overflow = used > budget;
  if (!overflow) {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      const turnTokens = turn.reduce((sum, message) => sum + message.tokens, 0);
      if (used + turnTokens <= budget) {
        selectedTurns.unshift(turn);
        used += turnTokens;
      }
    }
  }
  return { selected: [...requiredSystem, ...selectedTurns.flat(), activeUser], used, overflow };
}

export function createRegeneration({ messageId, parentUserId, attemptId, requestId }) {
  return { messageId, parentUserId, attemptId, requestId, role: "assistant", content: "", status: "queued" };
}
`;

export const CHAT_QUALITY_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This file handles React's saved-data checks and status labels.
export function validConversationRecord(record) {
  const isPlainObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
  const hasExactKeys = (value, required, optional = []) => {
    const keys = Reflect.ownKeys(value);
    const allowed = [...required, ...optional];
    return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
      keys.every((key) => typeof key === "string" && allowed.includes(key));
  };
  const validId = (value) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 128;
  const validMessage = (message) => {
    if (!isPlainObject(message) || !hasExactKeys(
      message,
      ["id", "role", "backend", "content", "status"],
      ["attemptId", "parentUserId"],
    )) return false;
    if (!validId(message.id) || !["user", "assistant"].includes(message.role)) return false;
    if (!["student", "local"].includes(message.backend)) return false;
    if (typeof message.content !== "string" || message.content.length > 20000) return false;
    if (!["complete", "cancelled", "error"].includes(message.status)) return false;
    if ("attemptId" in message && !validId(message.attemptId)) return false;
    if ("parentUserId" in message && !validId(message.parentUserId)) return false;
    return true;
  };

  if (!isPlainObject(record) || !hasExactKeys(record, ["version", "id", "messages"])) return false;
  if (record.version !== 1 || !validId(record.id)) return false;
  if (!Array.isArray(record.messages) || record.messages.length > 200) return false;
  if (!record.messages.every(validMessage)) return false;
  if (record.messages.reduce((sum, message) => sum + message.content.length, 0) > 200000) return false;
  try {
    return typeof JSON.stringify(record) === "string";
  } catch {
    return false;
  }
}

export function generationStatusLabel(phase) {
  const labels = {
    queued: "Waiting for capacity",
    loading: "Loading model",
    prefill: "Processing context",
    streaming: "Generating",
    complete: "Complete",
    cancelled: "Stopped",
    error: "Generation failed",
  };
  return labels[phase] ?? "Status unavailable";
}
`;

export const STREAMING_REACT_ADAPTER_SOURCE = `// The course provides this read-only JavaScript adapter.
// The CPython lesson and this file have to pass the same host-owned behavior
// tests. This file handles buffered renders and scroll following for React.
export function flushTokenBuffer(pending) {
  return { text: pending.join(""), remaining: [] };
}

export function shouldFollowStream({ distanceFromBottom, userScrolledUp, threshold = 80 }) {
  return !userScrolledUp && distanceFromBottom <= threshold;
}
`;

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
  throw new Error("The Latent preview couldn't load its trusted React runtime.");
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
  throw new Error("The Latent preview couldn't load its trusted React DOM runtime.");
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
  logicalRequestId: string;
  attemptId: string;
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
    method: "initialize" | "load-local" | "generate" | "cancel" | "persist",
    payload: unknown,
    onEvent?: (event: unknown) => void,
  ): Promise<TResult>;
};

const previewHost = (globalThis as {
  __LATENT_PREVIEW_HOST__?: PreviewHost;
}).__LATENT_PREVIEW_HOST__;

if (!previewHost) {
  throw new Error("The trusted Latent preview host isn't available.");
}

function isGenerationEvent(value: unknown): value is GenerationEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<GenerationEvent>;
  return event.type === "phase" || event.type === "chunk" || event.type === "metrics" || event.type === "error";
}

export function initializePreview() {
  return previewHost.request<PreviewInitialization>("initialize", {});
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
      message: error instanceof Error ? error.message : "The preview host couldn't start generation.",
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
import { createMessage, appendMessageDelta } from "../runtime/adapters/chat-reducer.js";
import { selectContext, createRegeneration } from "../runtime/adapters/chat-actions.js";
import { encodeSse, parseSseChunk } from "../runtime/adapters/streaming-transport.js";
import { shouldRetry, acceptEvent } from "../runtime/adapters/generation-reliability.js";
import { validConversationRecord, generationStatusLabel } from "../runtime/adapters/chat-quality.js";
import { flushTokenBuffer, shouldFollowStream } from "../runtime/adapters/streaming-react.js";
import {
  initializePreview,
  loadLocal,
  persistConversation,
  startGeneration,
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

type ChatState = {
  messages: Message[];
  activeAttemptByParentUserId: Record<string, string>;
};
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
  generatedUnitLabel: "Output units",
  durationMs: 0,
};

const ANNOUNCEMENT_INTERVAL_MS = 500;
const ANNOUNCEMENT_MAX_CHARACTERS = 160;

function activeAttemptMap(messages: Message[]) {
  const latestAttemptByParentUserId: Record<string, string> = {};
  const latestCompleteByParentUserId: Record<string, string> = {};
  for (const message of messages) {
    if (message.role === "assistant" && message.parentUserId) {
      latestAttemptByParentUserId[message.parentUserId] = message.id;
      if (message.status === "complete") latestCompleteByParentUserId[message.parentUserId] = message.id;
    }
  }
  return { ...latestAttemptByParentUserId, ...latestCompleteByParentUserId };
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "append") {
    const activeAttemptByParentUserId = action.message.role === "assistant" && action.message.parentUserId
      ? { ...state.activeAttemptByParentUserId, [action.message.parentUserId]: action.message.id }
      : state.activeAttemptByParentUserId;
    return { messages: [...state.messages, action.message], activeAttemptByParentUserId };
  }
  if (action.type === "delta") {
    return {
      messages: appendMessageDelta(state.messages, {
        messageId: action.messageId,
        attemptId: action.attemptId,
        requestId: action.requestId,
        delta: action.delta,
      }),
      activeAttemptByParentUserId: state.activeAttemptByParentUserId,
    };
  }
  if (action.type === "terminal") {
    const messages = state.messages.map((message) =>
      message.id === action.messageId ? { ...message, status: action.status } : message,
    );
    return {
      messages,
      activeAttemptByParentUserId: activeAttemptMap(messages),
    };
  }
  return {
    messages: action.messages,
    activeAttemptByParentUserId: activeAttemptMap(action.messages),
  };
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
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    activeAttemptByParentUserId: {},
  } as ChatState);
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
  const [controlsOpen, setControlsOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [preparationDetail, setPreparationDetail] = useState("Checking the model");
  const [persistencePhase, setPersistencePhase] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [restoreBlocked, setRestoreBlocked] = useState(false);
  const [streamAnnouncement, setStreamAnnouncement] = useState({ sequence: 0, text: "" });
  const [renderCommitCount, setRenderCommitCount] = useState(0);
  const activeHandle = useRef<GenerationHandle | null>(null);
  const activeRequest = useRef<{
    logicalRequestId: string;
    attemptId: string;
    requestId: string;
    assistantId: string;
    status: string;
  } | null>(null);
  const renderFrame = useRef<number | null>(null);
  const pendingRender = useRef<{
    messageId: string;
    attemptId: string;
    requestId: string;
    deltas: string[];
  } | null>(null);
  const announcementTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const announcementBuffer = useRef("");
  const lastAnnouncementAt = useRef(Number.NEGATIVE_INFINITY);
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
      const hasSavedConversation = initialization.conversation !== null && initialization.conversation !== undefined;
      const savedConversationIsValid = !hasSavedConversation || validConversationRecord(initialization.conversation);
      if (savedConversationIsValid) {
        dispatch({ type: "replace", messages: restoreMessages(initialization.conversation) });
      } else {
        dispatch({ type: "replace", messages: [] });
        setRestoreBlocked(true);
      }
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
      setError(initializationError instanceof Error ? initializationError.message : "The preview isn't available right now.");
    });
    return () => {
      active = false;
      activeHandle.current?.cancel();
      if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
      if (announcementTimer.current !== null) window.clearTimeout(announcementTimer.current);
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      renderFrame.current = null;
      pendingRender.current = null;
      announcementTimer.current = null;
      retryTimer.current = null;
      announcementBuffer.current = "";
    };
  }, []);

  useEffect(() => {
    if (!hydrated || restoreBlocked) return;
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
  }, [backend, hydrated, restoreBlocked, terminalConversationIdentity]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const compact = window.matchMedia("(max-width: 520px)");
    const sync = () => {
      setControlsOpen(!compact.matches);
      if (!compact.matches) setMobileControlsOpen(false);
    };
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

  const discardUnreadableConversation = () => {
    dispatch({ type: "replace", messages: [] });
    setRestoreBlocked(false);
    setPersistencePhase("idle");
  };

  const generating = ["queued", "prefill", "streaming"].includes(phase);
  const busy = preparing || generating || restoreBlocked;
  const canStop = generating && Boolean(activeHandle.current);
  const latestUser = useMemo(
    () => [...state.messages].reverse().find((message) => message.backend === backend && message.role === "user"),
    [backend, state.messages],
  );
  const visibleMessages = useMemo(
    () => state.messages.filter((message) => message.backend === backend),
    [backend, state.messages],
  );
  const attemptCountByParentUserId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const message of visibleMessages) {
      if (message.role === "assistant" && message.parentUserId) {
        counts[message.parentUserId] = (counts[message.parentUserId] || 0) + 1;
      }
    }
    return counts;
  }, [visibleMessages]);
  const backendReady = backend === "student" ? Boolean(preview?.studentReady) : Boolean(preview?.localReady);

  const followTranscript = () => {
    const element = transcriptRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (shouldFollowStream({ distanceFromBottom, userScrolledUp: distanceFromBottom > 120 })) {
      element.scrollTop = element.scrollHeight;
    }
  };

  const publishAnnouncement = (text: string) => {
    const bounded = text.replace(/\\s+/g, " ").trim().slice(0, ANNOUNCEMENT_MAX_CHARACTERS);
    if (!bounded) return;
    lastAnnouncementAt.current = performance.now();
    setStreamAnnouncement((current) => ({ sequence: current.sequence + 1, text: bounded }));
  };

  const scheduleStreamAnnouncement = (delta: string) => {
    announcementBuffer.current += delta;
    if (announcementTimer.current !== null) return;
    const elapsed = performance.now() - lastAnnouncementAt.current;
    const delay = Math.max(0, ANNOUNCEMENT_INTERVAL_MS - elapsed);
    const announce = () => {
      announcementTimer.current = null;
      const buffered = announcementBuffer.current;
      announcementBuffer.current = "";
      publishAnnouncement("Assistant update: " + buffered);
    };
    if (delay === 0) announce();
    else announcementTimer.current = window.setTimeout(announce, delay);
  };

  const publishTerminalAnnouncement = (status: string) => {
    if (announcementTimer.current !== null) window.clearTimeout(announcementTimer.current);
    announcementTimer.current = null;
    const buffered = announcementBuffer.current;
    announcementBuffer.current = "";
    publishAnnouncement(buffered ? status + " Latest assistant update: " + buffered : status);
  };

  const flushPendingRender = () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    renderFrame.current = null;
    const batch = pendingRender.current;
    pendingRender.current = null;
    if (!batch || batch.deltas.length === 0) return;
    const flushed = flushTokenBuffer(batch.deltas);
    if (!flushed.text) return;
    dispatch({
      type: "delta",
      messageId: batch.messageId,
      attemptId: batch.attemptId,
      requestId: batch.requestId,
      delta: flushed.text,
    });
    setRenderCommitCount((count) => count + 1);
    scheduleStreamAnnouncement(flushed.text);
    window.setTimeout(followTranscript, 0);
  };

  const enqueueRenderDelta = (messageId: string, attemptId: string, requestId: string, delta: string) => {
    const current = pendingRender.current;
    if (current && (current.messageId !== messageId || current.attemptId !== attemptId || current.requestId !== requestId)) {
      flushPendingRender();
    }
    if (!pendingRender.current) {
      pendingRender.current = { messageId, attemptId, requestId, deltas: [] };
    }
    pendingRender.current.deltas.push(delta);
    if (renderFrame.current === null) {
      renderFrame.current = window.requestAnimationFrame(() => {
        renderFrame.current = null;
        flushPendingRender();
      });
    }
  };

  const runGeneration = (userText: string, parentUserId: string, logicalRequestId: string, attempt: number) => {
    const attemptId = logicalRequestId + ".attempt-" + attempt;
    const requestId = logicalRequestId + ".transport-" + attempt;
    const assistantId = "assistant-" + attemptId;
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
    activeRequest.current = { logicalRequestId, attemptId, requestId, assistantId, status: "queued" };
    setPhase("queued");
    setMetrics(EMPTY_METRICS);
    setRenderCommitCount(0);
    setError("");

    const currentUser = { id: parentUserId, role: "user", status: "complete", content: userText, tokens: estimateTokens(userText) };
    const systemContext = [{ id: "system", role: "system", content: "Answer in concise technical prose.", tokens: 9 }];
    const historicalContext = state.messages
        .filter((message) => message.backend === backend
          && message.status === "complete"
          && message.id !== parentUserId
          && (message.role === "user"
            || !message.parentUserId
            || state.activeAttemptByParentUserId[message.parentUserId] === message.id))
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
      setError("The required instructions and your prompt don't fit within the 2048-token limit.");
      return;
    }
    const requestContext = bounded.selected;
    const requestFrame = encodeSse("request", {
      logicalRequestId,
      attemptId,
      requestId,
      backend,
      messages: requestContext.map((message: { role: string; content: string }) => ({
        role: message.role,
        content: message.content,
      })),
    });
    let remainder = "";
    let emittedTokens = 0;
    let terminalFinished = false;

    const finish = (status: MessageStatus, nextPhase: GenerationPhase) => {
      if (terminalFinished || !activeRequest.current || activeRequest.current.attemptId !== attemptId || activeRequest.current.requestId !== requestId) return;
      terminalFinished = true;
      flushPendingRender();
      activeRequest.current.status = nextPhase;
      dispatch({ type: "terminal", messageId: assistantId, status });
      setPhase(nextPhase);
      activeHandle.current = null;
      publishTerminalAnnouncement(nextPhase === "complete"
        ? "Response complete."
        : nextPhase === "cancelled"
          ? "Response stopped."
          : "Response failed.");
      window.setTimeout(followTranscript, 0);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    };

    activeHandle.current = startGeneration({
      logicalRequestId,
      attemptId,
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
        if (!current || !acceptEvent(current, { attemptId, requestId })) return;
        current.status = nextPhase;
        setPhase(nextPhase);
        if (nextPhase === "complete") finish("complete", "complete");
        if (nextPhase === "cancelled") finish("cancelled", "cancelled");
      },
      onChunk(chunk) {
        const current = activeRequest.current;
        if (!current || !acceptEvent(current, { attemptId, requestId })) return;
        const parsed = parseSseChunk(remainder, chunk);
        remainder = parsed.remainder;
        for (const event of parsed.events) {
          if (event.event === "token" && typeof event.data?.delta === "string") {
            emittedTokens += 1;
            enqueueRenderDelta(assistantId, branch.attemptId, requestId, event.data.delta);
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
          if (terminalFinished) return;
          terminalFinished = true;
          flushPendingRender();
          const current = activeRequest.current;
          if (current && current.attemptId === attemptId && current.requestId === requestId) current.status = "error";
          dispatch({ type: "terminal", messageId: assistantId, status: "error" });
          activeHandle.current = null;
          setPhase("queued");
          publishTerminalAnnouncement("Something went wrong for a moment. Retrying now.");
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null;
            runGeneration(userText, parentUserId, logicalRequestId, attempt + 1);
          }, 80);
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
    runGeneration(userText, userId, "logical-" + userId, 0);
  };

  const regenerate = () => {
    if (!latestUser || busy) return;
    runGeneration(latestUser.content, latestUser.id, "logical-regenerate-" + Date.now() + "-" + latestUser.id, 0);
  };

  const stop = () => {
    const handle = activeHandle.current;
    if (!handle) return;
    flushPendingRender();
    activeHandle.current = null;
    handle.cancel();
    const request = activeRequest.current;
    if (request) {
      request.status = "cancelled";
      dispatch({ type: "terminal", messageId: request.assistantId, status: "cancelled" });
    }
    setPhase("cancelled");
    publishTerminalAnnouncement("Response stopped.");
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
    if (backend === "student") {
      setError("This build doesn't have a Python checkpoint for the current source. Test and train models/character-rnn.py, then rebuild the project.");
      setPhase("error");
      return;
    }
    setPreparing(true);
    setError("");
    setPhase("loading");
    setPreparationDetail("Preparing local model");
    try {
      const update = (event: { progress: number; detail: string }) => {
        setPreparationDetail(event.detail + " · " + Math.round(event.progress) + "%");
      };
      await loadLocal(update);
      const initialization = await initializePreview();
      setPreview(initialization);
      setPreparationDetail("Active build #" + initialization.buildNumber);
      setPhase("complete");
    } catch (preparationError) {
      setError(preparationError instanceof Error ? preparationError.message : "The selected model couldn't be set up.");
      setPhase("error");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <main className="browser-chat">
      <header className="app-header">
        <div>
          <span className="project-label">browser-chat / current build</span>
          <h1>Browser Chat</h1>
        </div>
        <div className="phase-status" data-phase={phase} role="status" aria-live="polite" aria-atomic="true">
          <i />
          <span>{generationStatusLabel(phase)}</span>
        </div>
      </header>

      <div className="app-layout">
        <aside className={"control-panel" + (mobileControlsOpen ? " mobile-open" : "")}>
          <button
            className="mobile-control-toggle"
            type="button"
            aria-expanded={mobileControlsOpen}
            onClick={() => setMobileControlsOpen((open) => !open)}
          >
            <span>{backend === "local" ? "Local Transformer" : "Student RNN"}</span>
            <strong>{backendReady ? "Ready" : "Setup"} · {temperature.toFixed(2)} · k {topK}</strong>
          </button>
          <section>
            <span className="section-label">Model backend</span>
            <div className="segmented-control">
              <button className={backend === "local" ? "active" : ""} disabled={busy} onClick={() => setBackend("local")} type="button">Local Transformer</button>
              <button className={backend === "student" ? "active" : ""} disabled={busy} onClick={() => setBackend("student")} type="button">Student RNN</button>
            </div>
            <p>{backend === "local" ? "A real model that runs locally through the isolated host bridge." : "The Python checkpoint tied to this build in Model Foundations."}</p>
            <button className="prepare-model" type="button" disabled={preparing || backendReady || backend === "student"} onClick={() => void prepareBackend()}>
              {backendReady ? "Model ready" : preparing ? preparationDetail : backend === "student" ? "Rebuild with Python checkpoint" : "Load local model"}
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
                <p>The Local Transformer can take up to 160 token-generation steps. The Student RNN can write up to 160 characters. The seed in model.config.js only affects Student RNN sampling; this local Transformer doesn't offer deterministic seeding.</p>
              </div>
            </details>
          </section>

          {preview?.runtime.interface.showMetrics !== false ? <section className="metrics-panel">
            <details>
              <summary><span className="section-label">Last request</span><strong>{metrics.durationMs ? metrics.durationMs + " ms total" : "No request yet"}</strong></summary>
              <dl>
                <div><dt>Host queue</dt><dd>{metrics.queueMs} ms</dd></div>
                <div><dt>First visible</dt><dd>{metrics.ttftMs} ms</dd></div>
                <div><dt>Model run</dt><dd>{metrics.modelMs} ms</dd></div>
                <div><dt>{metrics.generatedUnitLabel}</dt><dd>{metrics.generatedUnits}</dd></div>
                <div><dt>Total</dt><dd>{metrics.durationMs} ms</dd></div>
              </dl>
            </details>
          </section> : null}

          <footer>
            <button type="button" onClick={clear} disabled={busy || visibleMessages.length === 0}>Clear conversation</button>
            {persistencePhase === "error" ? <span role="alert">Save failed · your latest finished copy is still here <button type="button" onClick={retryPersistence}>Retry save</button></span> : <span role="status" aria-live="polite">{persistencePhase === "saving" ? "Saving on this device…" : persistencePhase === "saved" ? "Saved on this device" : "Not saved yet"}</span>}
          </footer>
        </aside>

        <section className="conversation-panel">
          <div className="conversation-heading">
            <div><span>Conversation</span><strong>{visibleMessages.length ? visibleMessages.length + " messages" : "New session"}</strong></div>
            <button type="button" onClick={regenerate} disabled={busy || !latestUser}>Regenerate</button>
          </div>

          <div
            className="transcript"
            ref={transcriptRef}
            role="log"
            aria-live="off"
            aria-label="Conversation transcript"
            data-render-commits={renderCommitCount}
          >
            {!hydrated ? <p className="empty-state">Loading the conversation saved on this device…</p> : null}
            {hydrated && visibleMessages.length === 0 ? (
              <div className="empty-state">
                <span>Current project connected</span>
                <h2>Ask the system you built.</h2>
                <p>Your messages go through the context rules, serving protocol, reliability checks, reducer, and render buffer you built.</p>
              </div>
            ) : null}
            {visibleMessages.map((message) => {
              const isActiveAttempt = message.role !== "assistant"
                || !message.parentUserId
                || state.activeAttemptByParentUserId[message.parentUserId] === message.id;
              const hasSiblingAttempt = Boolean(message.parentUserId && attemptCountByParentUserId[message.parentUserId] > 1);
              return (
                <article
                  className={"message " + message.role + " " + message.status + (isActiveAttempt ? " active-attempt" : " superseded-attempt")}
                  data-active-attempt={message.role === "assistant" && message.parentUserId ? String(isActiveAttempt) : undefined}
                  key={message.id}
                >
                  <span>{message.role === "user" ? "You" : preview?.runtime.interface.assistantName || (backend === "student" ? "Student model" : "Local model")}</span>
                  <p>{message.content || (message.status === "streaming" ? "Processing context…" : "No output")}</p>
                  {message.status !== "complete"
                    ? <em>{message.status}</em>
                    : hasSiblingAttempt
                      ? <em>{isActiveAttempt ? "Current try" : "Earlier try"}</em>
                      : null}
                </article>
              );
            })}
          </div>

          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-stream-announcement={streamAnnouncement.sequence}
          >{streamAnnouncement.text}</div>

          {restoreBlocked ? (
            <div className="restore-error" role="alert">
              <strong>We couldn't open the saved conversation</strong>
              <span>We left the unreadable copy on this device unchanged. Discard it to start a new saved conversation.</span>
              <button type="button" onClick={discardUnreadableConversation}>Discard saved conversation</button>
            </div>
          ) : null}

          {error ? <div className="request-error" role="alert"><strong>Request failed</strong><span>{error}</span></div> : null}

          <form className="composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <textarea
              ref={composerRef}
              aria-label="Chat message"
              placeholder="Ask about your model, runtime, or serving setup…"
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
body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 78% 9%, rgba(173, 151, 193, 0.14), transparent 34rem), #f3f0ec; }
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
.app-layout { background: var(--paper); border: 1px solid rgba(65, 53, 72, 0.14); border-radius: 0.4rem; display: grid; grid-template-columns: 18rem minmax(0, 1fr); margin: 0 auto; max-width: 1320px; min-height: calc(100vh - 7.5rem); overflow: hidden; }
.control-panel { border-right: 1px solid var(--line); display: flex; flex-direction: column; min-width: 0; }
.mobile-control-toggle { display: none; }
.control-panel section { border-bottom: 1px solid var(--line); padding: 1.35rem; }
.control-panel section p { color: var(--muted); font-size: 0.74rem; line-height: 1.55; margin: 0.85rem 0 0; }
.inference-panel details summary { align-items: center; cursor: pointer; display: flex; justify-content: space-between; list-style: none; }
.inference-panel details summary::-webkit-details-marker { display: none; }
.inference-panel details summary::after { color: var(--faint); content: "＋"; font-size: 0.8rem; margin-left: 0.6rem; }
.inference-panel details[open] summary::after { content: "−"; }
.inference-panel summary > strong { color: var(--faint); font-size: 0.68rem; font-weight: 500; margin-left: auto; }
.metrics-panel summary { align-items: center; cursor: pointer; display: flex; justify-content: space-between; list-style: none; }
.metrics-panel summary::-webkit-details-marker { display: none; }
.metrics-panel summary::after { color: var(--faint); content: "＋"; font-size: 0.8rem; margin-left: 0.6rem; }
.metrics-panel details[open] summary::after { content: "−"; }
.metrics-panel summary > strong { color: var(--faint); font-size: 0.68rem; font-weight: 500; margin-left: auto; }
.segmented-control { display: grid; gap: 0.35rem; margin-top: 0.85rem; }
.segmented-control button, .control-panel footer button, .conversation-heading button, .composer button { background: transparent; border: 1px solid var(--line); border-radius: 999px; cursor: pointer; font-size: 0.7rem; padding: 0.65rem 0.85rem; text-align: left; }
.segmented-control button.active { background: rgba(116, 100, 135, 0.1); border-color: rgba(116, 100, 135, 0.4); color: #5c496f; }
.prepare-model { background: rgba(255, 255, 255, 0.45); border: 1px solid var(--line); border-radius: 999px; cursor: pointer; font-size: 0.68rem; margin-top: 0.8rem; padding: 0.65rem 0.85rem; width: 100%; }
button:disabled { cursor: default; opacity: 0.42; }
.control-panel label { display: grid; gap: 0.5rem; margin-top: 1rem; }
.control-panel label > span { display: flex; font-size: 0.7rem; justify-content: space-between; }
.control-panel label strong { color: var(--violet); font-weight: 600; }
input[type="range"] { accent-color: var(--violet); width: 100%; }
.metrics-panel dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0.9rem 0 0; }
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
.message.superseded-attempt { opacity: 0.58; }
.message.cancelled p, .message.error p { color: var(--muted); }
.sr-only { border: 0; clip: rect(0 0 0 0); clip-path: inset(50%); height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; white-space: nowrap; width: 1px; }
.request-error, .restore-error { background: rgba(169, 109, 109, 0.08); border-top: 1px solid rgba(169, 109, 109, 0.18); display: grid; gap: 0.25rem; padding: 0.85rem 1.5rem; }
.request-error strong, .restore-error strong { color: #8a5555; font-size: 0.67rem; }
.request-error span, .restore-error span { color: var(--muted); font-size: 0.7rem; }
.restore-error button { background: transparent; border: 1px solid rgba(169, 109, 109, 0.3); border-radius: 999px; color: #8a5555; cursor: pointer; font-size: 0.68rem; justify-self: start; margin-top: 0.45rem; padding: 0.55rem 0.8rem; }
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
  .app-header { align-items: start; display: grid; gap: 0.6rem; grid-template-columns: minmax(0, 1fr); min-height: auto; }
  .app-header h1 { font-size: 1.85rem; }
  .phase-status { justify-self: start; }
  .project-label { display: none; }
  .control-panel { display: block; }
  .mobile-control-toggle { align-items: center; background: transparent; border: 0; border-bottom: 1px solid var(--line); cursor: pointer; display: flex; justify-content: space-between; padding: 0.8rem 1rem; text-align: left; width: 100%; }
  .mobile-control-toggle span { font-size: 0.72rem; font-weight: 600; }
  .mobile-control-toggle strong { color: var(--violet); font-size: 0.67rem; font-weight: 500; }
  .mobile-control-toggle::after { color: var(--faint); content: "＋"; font-size: 0.8rem; margin-left: 0.55rem; }
  .control-panel.mobile-open .mobile-control-toggle::after { content: "−"; }
  .control-panel:not(.mobile-open) > section, .control-panel:not(.mobile-open) > footer { display: none; }
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
 * These course-owned files turn the virtual project into a complete React app.
 * The learner's CPython functions and these read-only JavaScript adapters have
 * to pass the same host-owned behavior tests. The adapters are the connection
 * between the Python work and the React runtime.
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
    path: BROWSER_CHAT_ADAPTER_PATHS.modelSoftmax,
    title: "Provided model softmax adapter",
    kind: "adapter",
    editable: false,
    source: MODEL_SOFTMAX_ADAPTER_SOURCE,
  },
  {
    path: BROWSER_CHAT_ADAPTER_PATHS.streamingTransport,
    title: "Provided SSE transport adapter",
    kind: "adapter",
    editable: false,
    source: STREAMING_TRANSPORT_ADAPTER_SOURCE,
  },
  {
    path: BROWSER_CHAT_ADAPTER_PATHS.generationReliability,
    title: "Provided generation reliability adapter",
    kind: "adapter",
    editable: false,
    source: GENERATION_RELIABILITY_ADAPTER_SOURCE,
  },
  {
    path: BROWSER_CHAT_ADAPTER_PATHS.chatReducer,
    title: "Provided chat reducer adapter",
    kind: "adapter",
    editable: false,
    source: CHAT_REDUCER_ADAPTER_SOURCE,
  },
  {
    path: BROWSER_CHAT_ADAPTER_PATHS.chatActions,
    title: "Provided chat actions adapter",
    kind: "adapter",
    editable: false,
    source: CHAT_ACTIONS_ADAPTER_SOURCE,
  },
  {
    path: BROWSER_CHAT_ADAPTER_PATHS.chatQuality,
    title: "Provided chat quality adapter",
    kind: "adapter",
    editable: false,
    source: CHAT_QUALITY_ADAPTER_SOURCE,
  },
  {
    path: BROWSER_CHAT_ADAPTER_PATHS.streamingReact,
    title: "Provided streaming React adapter",
    kind: "adapter",
    editable: false,
    source: STREAMING_REACT_ADAPTER_SOURCE,
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
