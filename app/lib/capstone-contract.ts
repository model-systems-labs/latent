export type CapstoneBackend = "student" | "local";

export type PersistedChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "cancelled" | "error";
  backend: CapstoneBackend;
  attemptId?: string;
  parentUserId?: string;
};

export type CapstoneLocalRecord = {
  version: 1;
  id: string;
  messages: PersistedChatMessage[];
};

export type GenerationPhase = "queued" | "loading" | "prefill" | "streaming" | "complete" | "cancelled" | "error";
export type QualityCategory = "Input and focus" | "Persistence and context" | "Lifecycle and recovery" | "Accessibility and responsive contract";
export type QualityCheck = {
  category: QualityCategory;
  label: string;
  detail: string;
  verification: "automated-pure" | "specification";
  passed: boolean | null;
};

export const CAPSTONE_STORAGE_KEY = "latent-capstone-v1";
export const CHAT_LOG_ACCESSIBILITY = { role: "log", ariaLive: "polite" } as const;
export const CHAT_STATUS_ACCESSIBILITY = { role: "status", ariaLive: "polite", ariaAtomic: true } as const;
export const LIVE_ANNOUNCEMENT_CONTRACT = { maximumCharacters: 160, minimumIntervalMs: 500, tokenByToken: false } as const;
export const CANCELLATION_RESOURCE_CONTRACT = { abortTransport: true, cancelRenderFrame: true, rejectLateEvents: true, releaseGeneration: true } as const;
export const CAPSTONE_MOBILE_CONTRACT = { minimumViewportWidth: 320, singleColumnAt: 800, composerAfterTranscript: true } as const;

export const MANUAL_PRODUCT_VERIFICATION = [
  { label: "Keyboard and focus", detail: "Tab through every control at 100% and 200% zoom; send, stop, and regenerate without a pointer; confirm visible focus returns to the composer after a terminal action." },
  { label: "Screen reader", detail: "With VoiceOver or NVDA, confirm new messages enter the log in reading order, phase changes are announced once, and streamed tokens are not spoken one by one." },
  { label: "Mobile and touch", detail: "At 320 px and 390 px, confirm controls form one readable column, the transcript remains usable, the composer follows it, and touch targets do not overlap." },
] as const;

const GENERATION_LABELS: Record<GenerationPhase, string> = {
  queued: "Waiting for capacity",
  loading: "Loading model",
  prefill: "Processing context",
  streaming: "Generating",
  complete: "Complete",
  cancelled: "Stopped",
  error: "Generation failed",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => typeof key === "string" && allowed.has(key));
}

function validId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 128;
}

function validPersistedMessage(value: unknown): value is PersistedChatMessage {
  if (!isPlainObject(value) || !hasExactKeys(value, ["id", "role", "backend", "content", "status"], ["attemptId", "parentUserId"])) return false;
  if (!validId(value.id) || (value.role !== "user" && value.role !== "assistant")) return false;
  if (value.backend !== "student" && value.backend !== "local") return false;
  if (typeof value.content !== "string" || value.content.length > 20_000) return false;
  if (value.status !== "complete" && value.status !== "cancelled" && value.status !== "error") return false;
  if ("attemptId" in value && !validId(value.attemptId)) return false;
  if ("parentUserId" in value && !validId(value.parentUserId)) return false;
  return true;
}

export function validCapstoneRecord(value: unknown): value is CapstoneLocalRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, ["version", "id", "messages"])) return false;
  if (value.version !== 1 || !validId(value.id) || !Array.isArray(value.messages) || value.messages.length > 200) return false;
  if (!value.messages.every(validPersistedMessage)) return false;
  if (value.messages.reduce((sum, message) => sum + message.content.length, 0) > 200_000) return false;
  try {
    return typeof JSON.stringify(value) === "string";
  } catch {
    return false;
  }
}

export function composerKeyAction(key: string, shiftKey: boolean) {
  if (key !== "Enter") return "none" as const;
  return shiftKey ? "newline" as const : "send" as const;
}

export function terminalFocusTarget(action: "complete" | "cancel" | "retry" | "error") {
  return action === "retry" ? "composer-after-terminal" as const : "composer" as const;
}

export function messagesForBackend(messages: PersistedChatMessage[], backend: CapstoneBackend) {
  return messages.filter((message) => message.backend === backend);
}

export function lastUserForBackend(messages: PersistedChatMessage[], backend: CapstoneBackend) {
  return [...messages].reverse().find((message) => message.backend === backend && message.role === "user");
}

export function canRegenerate(messages: PersistedChatMessage[], backend: CapstoneBackend, generating: boolean) {
  return !generating && Boolean(lastUserForBackend(messages, backend));
}

export function lifecycleEventAccepted(active: { requestId: string; terminal: boolean }, eventRequestId: string) {
  return !active.terminal && active.requestId === eventRequestId;
}

export function generationStatusLabelContract(phase: string) {
  return GENERATION_LABELS[phase as GenerationPhase] ?? "Status unavailable";
}

export function serializeCapstoneRecord(record: CapstoneLocalRecord) {
  const safeMessages = record.messages
    .filter((message) => message.status !== "streaming")
    .map(({ id, role, content, status, backend, attemptId, parentUserId }) => ({
      id, role, content, status, backend,
      ...(attemptId ? { attemptId } : {}),
      ...(parentUserId ? { parentUserId } : {}),
    }));
  return JSON.stringify({ version: 1, id: record.id, messages: safeMessages });
}

export function parseCapstoneRecord(serialized: string | null): CapstoneLocalRecord | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    return validCapstoneRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export type ContextMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  tokens: number;
  text: string;
};

export function selectCompleteTurnContext(messages: ContextMessage[], budget: number) {
  const systems = messages.filter((message) => message.role === "system");
  const turns: ContextMessage[][] = [];
  for (const message of messages.filter((candidate) => candidate.role !== "system")) {
    if (message.role === "user" || turns.length === 0) turns.push([message]);
    else turns[turns.length - 1].push(message);
  }
  const selectedTurns: ContextMessage[][] = [];
  let used = systems.reduce((sum, message) => sum + message.tokens, 0);
  for (const turn of [...turns].reverse()) {
    const turnTokens = turn.reduce((sum, message) => sum + message.tokens, 0);
    if (used + turnTokens <= budget) {
      selectedTurns.unshift(turn);
      used += turnTokens;
    }
  }
  const selected = [...systems, ...selectedTurns.flat()];
  return { selected, used };
}

export function runCapstoneQualityAudit(): QualityCheck[] {
  const automated = (category: QualityCategory, label: string, detail: string, passed: boolean): QualityCheck => ({
    category, label, detail, verification: "automated-pure", passed,
  });
  const specification = (category: QualityCategory, label: string, detail: string): QualityCheck => ({
    category, label, detail, verification: "specification", passed: null,
  });
  const messages: PersistedChatMessage[] = [
    { id: "s1", role: "user", content: "student", status: "complete", backend: "student" },
    { id: "l1", role: "user", content: "local", status: "complete", backend: "local" },
    { id: "l2", role: "assistant", content: "partial", status: "streaming", backend: "local", attemptId: "a2", parentUserId: "l1" },
  ];
  const serialized = serializeCapstoneRecord({ version: 1, id: "active", messages });
  const parsed = parseCapstoneRecord(serialized);
  const secretRecord = JSON.stringify({
    version: 1,
    id: "active",
    messages: [{ id: "u1", role: "user", backend: "local", content: "hello", status: "complete", providerKey: "never" }],
  });
  const context = selectCompleteTurnContext([
    { id: "system", role: "system", tokens: 4, text: "rules" },
    { id: "u1", role: "user", tokens: 5, text: "question" },
    { id: "a1", role: "assistant", tokens: 7, text: "answer" },
    { id: "u2", role: "user", tokens: 4, text: "current" },
  ], 12);
  const phases: GenerationPhase[] = ["queued", "loading", "prefill", "streaming", "complete", "cancelled", "error"];
  const exactLabels = phases.map(generationStatusLabelContract).join(" → ");

  return [
    automated("Input and focus", "Enter sends", "Enter without Shift resolves to send.", composerKeyAction("Enter", false) === "send"),
    automated("Input and focus", "Shift+Enter preserves a newline", "The same key with Shift resolves to newline, not send.", composerKeyAction("Enter", true) === "newline"),
    specification("Input and focus", "Terminal focus target specification", "The policy names the composer as the terminal target; real keyboard focus still requires browser testing."),
    automated("Input and focus", "Regeneration guard", "Retry needs an active-backend user message and is disabled while generating.", canRegenerate(messages, "local", false) && !canRegenerate(messages, "local", true) && !canRegenerate([], "local", false)),

    automated("Persistence and context", "Versioned round trip", "v1 / active restores two exact terminal messages.", parsed?.version === 1 && parsed.id === "active" && parsed.messages.length === 2),
    automated("Persistence and context", "Nested secret rejection", "A message containing providerKey fails the exact-field validator.", parseCapstoneRecord(secretRecord) === null),
    automated("Persistence and context", "Streaming state is not persisted", "The in-flight l2 record is omitted; reload cannot resurrect a dead request.", !serialized.includes('"id":"l2"') && !serialized.includes("streaming")),
    automated("Persistence and context", "Backend isolation", "Selecting local yields l1 and l2; student s1 stays outside that view.", messagesForBackend(messages, "local").map((message) => message.id).join(",") === "l1,l2"),

    automated("Lifecycle and recovery", "Every phase has an honest label", exactLabels, exactLabels === "Waiting for capacity → Loading model → Processing context → Generating → Complete → Stopped → Generation failed"),
    automated("Lifecycle and recovery", "Unknown phase fallback", "future-state → Status unavailable (never a false Ready).", generationStatusLabelContract("future-state") === "Status unavailable"),
    automated("Lifecycle and recovery", "Stale and terminal events are rejected", "r2 accepts r2 while active; r1 and every post-terminal event are rejected.", lifecycleEventAccepted({ requestId: "r2", terminal: false }, "r2") && !lifecycleEventAccepted({ requestId: "r2", terminal: false }, "r1") && !lifecycleEventAccepted({ requestId: "r2", terminal: true }, "r2")),
    specification("Lifecycle and recovery", "Cancellation resource specification", "The declared contract requires transport abort, render cancellation, late-event rejection, and generation release; the full-build browser receipt exercises stop and late-output rejection."),

    automated("Accessibility and responsive contract", "Complete-turn context", "A 12-token budget selects system,u2; it never keeps orphan assistant a1.", context.selected.map((message) => message.id).join(",") === "system,u2"),
    specification("Accessibility and responsive contract", "Conversation log specification", "The declared role=log and aria-live=polite attributes are exercised by the full-build mounted behavior receipt; screen-reader speech remains manual."),
    specification("Accessibility and responsive contract", "Status announcement specification", "The declared role=status, atomic update, and announcement bounds are requirements; assistive-technology timing remains manual."),
    specification("Accessibility and responsive contract", "Mobile layout specification", "320 px support, one-column layout, and composer order are declared requirements that still need real viewport and touch verification."),
  ];
}
