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
  version: 2;
  selectedBackend: CapstoneBackend;
  messages: PersistedChatMessage[];
};

export const CAPSTONE_STORAGE_KEY = "latent-capstone-v2";
export const CHAT_LOG_ACCESSIBILITY = { role: "log", ariaLive: "polite" } as const;

export function composerKeyAction(key: string, shiftKey: boolean) {
  if (key !== "Enter") return "none" as const;
  return shiftKey ? "newline" as const : "send" as const;
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

export function serializeCapstoneRecord(record: CapstoneLocalRecord) {
  const safeMessages = record.messages
    .filter((message) => message.status !== "streaming")
    .map(({ id, role, content, status, backend, attemptId, parentUserId }) => ({ id, role, content, status, backend, attemptId, parentUserId }));
  return JSON.stringify({ version: 2, selectedBackend: record.selectedBackend, messages: safeMessages });
}

export function parseCapstoneRecord(serialized: string | null): CapstoneLocalRecord | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<CapstoneLocalRecord> & { apiKey?: unknown };
    if (value.version !== 2 || value.apiKey || (value.selectedBackend !== "student" && value.selectedBackend !== "local") || !Array.isArray(value.messages)) return null;
    const messages = value.messages.filter((message): message is PersistedChatMessage => Boolean(
      message && typeof message.id === "string" && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string" && ["complete", "cancelled", "error"].includes(message.status)
      && (message.backend === "student" || message.backend === "local"),
    ));
    return { version: 2, selectedBackend: value.selectedBackend, messages };
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

export type QualityCheck = { label: string; detail: string; passed: boolean };

export function runCapstoneQualityAudit(): QualityCheck[] {
  const messages: PersistedChatMessage[] = [
    { id: "s1", role: "user", content: "student", status: "complete", backend: "student" },
    { id: "l1", role: "user", content: "local", status: "complete", backend: "local" },
  ];
  const serialized = serializeCapstoneRecord({ version: 2, selectedBackend: "local", messages });
  const parsed = parseCapstoneRecord(serialized);
  const context = selectCompleteTurnContext([
    { id: "system", role: "system", tokens: 4, text: "rules" },
    { id: "u1", role: "user", tokens: 5, text: "question" },
    { id: "a1", role: "assistant", tokens: 7, text: "answer" },
    { id: "u2", role: "user", tokens: 4, text: "current" },
  ], 12);
  return [
    { label: "Keyboard send", detail: "Enter sends while Shift+Enter preserves a newline.", passed: composerKeyAction("Enter", false) === "send" && composerKeyAction("Enter", true) === "newline" },
    { label: "Backend isolation", detail: "Student and local conversations are selected independently.", passed: messagesForBackend(messages, "local").map((message) => message.id).join("") === "l1" },
    { label: "Regeneration guard", detail: "Regeneration requires an existing user message for the active backend.", passed: canRegenerate(messages, "local", false) && !canRegenerate([], "local", false) },
    { label: "Storage schema", detail: "Only versioned, non-streaming, non-secret message fields are restored.", passed: parsed?.messages.length === 2 && !serialized.includes("apiKey") },
    { label: "Complete turns", detail: "Context selection never retains an assistant response without its user turn.", passed: context.selected.map((message) => message.id).join(",") === "system,u2" },
    { label: "Accessible log", detail: "Conversation updates use a polite ARIA log contract.", passed: CHAT_LOG_ACCESSIBILITY.role === "log" && CHAT_LOG_ACCESSIBILITY.ariaLive === "polite" },
  ];
}
