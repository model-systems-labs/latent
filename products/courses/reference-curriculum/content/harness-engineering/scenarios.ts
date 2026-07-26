import type { JsonValue } from "@latent/python-lab/types";

export type HarnessScenarioKind =
  | "successful-tool-use"
  | "denied-request"
  | "approval-required"
  | "turn-budget-exhausted";

export type HarnessInitialMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

export type HarnessRecordedResponse =
  | { readonly final: string }
  | {
      readonly tool_call: {
        readonly id: string;
        readonly name: string;
        readonly arguments: Readonly<Record<string, JsonValue>>;
      };
    };

export type HarnessToolDescriptor = {
  readonly name: string;
  readonly kind: "read" | "write" | "shell" | "network";
  readonly target_arg: string;
  readonly required: Readonly<Record<string, "str" | "int" | "float" | "bool">>;
  readonly outputs: Readonly<Record<string, JsonValue>>;
};

export type HarnessPermissionRule = {
  readonly id: string;
  readonly kind: HarnessToolDescriptor["kind"] | "*";
  readonly target_prefix: string;
  readonly decision: "allow" | "confirm" | "deny";
};

export type HarnessTerminalStatus =
  | "completed"
  | "approval_required"
  | "budget_exceeded"
  | "model_exhausted";

export type HarnessScenarioFixture = {
  readonly id: string;
  readonly kind: HarnessScenarioKind;
  readonly label: string;
  readonly description: string;
  readonly initialMessages: readonly HarnessInitialMessage[];
  readonly recordedResponses: readonly HarnessRecordedResponse[];
  readonly tools: readonly HarnessToolDescriptor[];
  readonly permissionRules: readonly HarnessPermissionRule[];
  readonly maxTurns: number;
  readonly expected: {
    readonly terminalStatus: HarnessTerminalStatus;
    readonly final: string | null;
    readonly turns: number;
    readonly toolCallCount: number;
    readonly messageRoles: readonly string[];
    readonly eventKinds: readonly string[];
    readonly pendingCall: string | null;
  };
};

export type HarnessTraceRow = {
  readonly actor: "model" | "harness" | "tool";
  readonly text: string;
  readonly tone: "neutral" | "success" | "warning" | "error";
};

export type HarnessScenarioTrace = {
  readonly status: HarnessTerminalStatus;
  readonly summary: string;
  readonly turns: number;
  readonly toolCalls: number;
  readonly final: string | null;
  readonly rows: readonly HarnessTraceRow[];
};

export const HARNESS_SCENARIO_MODULE_PATH = "harness/harness.py";
export const HARNESS_SCENARIO_EXPORT = "run_recorded_harness";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

const fixtures: HarnessScenarioFixture[] = [
  {
    id: "read-file-and-finish",
    kind: "successful-tool-use",
    label: "Read a file and finish",
    description: "A fixed reply requests a file. The harness appends the result, then reads the fixed final reply.",
    initialMessages: [
      { role: "user", content: "What does /workspace/README.md say?" },
    ],
    recordedResponses: [
      {
        tool_call: {
          id: "read-ready-file",
          name: "read_file",
          arguments: { path: "/workspace/README.md" },
        },
      },
      { final: "The project is ready to test." },
    ],
    tools: [
      {
        name: "read_file",
        kind: "read",
        target_arg: "path",
        required: { path: "str" },
        outputs: { "read-ready-file": "Project status: ready to test." },
      },
    ],
    permissionRules: [
      {
        id: "read-workspace-files",
        kind: "read",
        target_prefix: "/workspace",
        decision: "allow",
      },
    ],
    maxTurns: 4,
    expected: {
      terminalStatus: "completed",
      final: "The project is ready to test.",
      turns: 2,
      toolCallCount: 1,
      messageRoles: ["user", "assistant", "tool", "assistant"],
      eventKinds: ["action_proposed", "policy_decision", "tool_completed", "run_completed"],
      pendingCall: null,
    },
  },
  {
    id: "denied-secret-read",
    kind: "denied-request",
    label: "Block a private file",
    description: "The model asks for a private file. The harness returns an error without reading it.",
    initialMessages: [
      { role: "user", content: "Check whether /workspace/.env exists." },
    ],
    recordedResponses: [
      {
        tool_call: {
          id: "read-private-file",
          name: "read_file",
          arguments: { path: "/workspace/.env" },
        },
      },
      { final: "I could not read that file because the request was denied." },
    ],
    tools: [
      {
        name: "read_file",
        kind: "read",
        target_arg: "path",
        required: { path: "str" },
        outputs: { "read-private-file": "This output must never be returned." },
      },
    ],
    permissionRules: [
      {
        id: "read-workspace-files",
        kind: "read",
        target_prefix: "/workspace",
        decision: "allow",
      },
      {
        id: "block-private-file",
        kind: "read",
        target_prefix: "/workspace/.env",
        decision: "deny",
      },
    ],
    maxTurns: 4,
    expected: {
      terminalStatus: "completed",
      final: "I could not read that file because the request was denied.",
      turns: 2,
      toolCallCount: 0,
      messageRoles: ["user", "assistant", "tool", "assistant"],
      eventKinds: ["action_proposed", "policy_decision", "tool_denied", "run_completed"],
      pendingCall: null,
    },
  },
  {
    id: "approval-before-write",
    kind: "approval-required",
    label: "Pause before changing a file",
    description: "The model asks to write a file. The harness pauses before anything changes.",
    initialMessages: [
      { role: "user", content: "Add a short note to /workspace/notes.txt." },
    ],
    recordedResponses: [
      {
        tool_call: {
          id: "write-note",
          name: "write_file",
          arguments: { path: "/workspace/notes.txt", content: "Tests still need to run." },
        },
      },
    ],
    tools: [
      {
        name: "write_file",
        kind: "write",
        target_arg: "path",
        required: { path: "str", content: "str" },
        outputs: { "write-note": { saved: true, path: "/workspace/notes.txt" } },
      },
    ],
    permissionRules: [
      {
        id: "confirm-workspace-writes",
        kind: "write",
        target_prefix: "/workspace",
        decision: "confirm",
      },
    ],
    maxTurns: 3,
    expected: {
      terminalStatus: "approval_required",
      final: null,
      turns: 1,
      toolCallCount: 0,
      messageRoles: ["user", "assistant"],
      eventKinds: ["action_proposed", "policy_decision"],
      pendingCall: "write-note",
    },
  },
  {
    id: "turn-budget-exhausted",
    kind: "turn-budget-exhausted",
    label: "Stop at the turn limit",
    description: "Two fixed replies request files. A two-turn limit stops before the saved final reply.",
    initialMessages: [
      { role: "user", content: "Inspect the project before answering." },
    ],
    recordedResponses: [
      {
        tool_call: {
          id: "read-package-file",
          name: "read_file",
          arguments: { path: "/workspace/package.json" },
        },
      },
      {
        tool_call: {
          id: "read-source-file",
          name: "read_file",
          arguments: { path: "/workspace/src/app.py" },
        },
      },
      { final: "The project has one Python entry point." },
    ],
    tools: [
      {
        name: "read_file",
        kind: "read",
        target_arg: "path",
        required: { path: "str" },
        outputs: {
          "read-package-file": "{\"name\": \"demo\"}",
          "read-source-file": "def main(): return 'ready'",
        },
      },
    ],
    permissionRules: [
      {
        id: "read-workspace-files",
        kind: "read",
        target_prefix: "/workspace",
        decision: "allow",
      },
    ],
    maxTurns: 2,
    expected: {
      terminalStatus: "budget_exceeded",
      final: null,
      turns: 2,
      toolCallCount: 2,
      messageRoles: ["user", "assistant", "tool", "assistant", "tool"],
      eventKinds: ["action_proposed", "policy_decision", "tool_completed", "action_proposed", "policy_decision", "tool_completed", "budget_exceeded"],
      pendingCall: null,
    },
  },
];

export const HARNESS_SCENARIO_FIXTURES: readonly HarnessScenarioFixture[] = deepFreeze(fixtures);

/** Returns independent data that a learner can edit without changing the course fixtures. */
export function createHarnessScenarioFixtures(): HarnessScenarioFixture[] {
  return structuredClone(HARNESS_SCENARIO_FIXTURES) as HarnessScenarioFixture[];
}

export function harnessScenarioArguments(scenario: HarnessScenarioFixture): JsonValue[] {
  return structuredClone([
    scenario.initialMessages,
    { adapter: "recorded", responses: scenario.recordedResponses },
    scenario.tools,
    scenario.permissionRules,
    scenario.maxTurns,
  ]) as JsonValue[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function compact(value: unknown, limit = 88) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const text = (raw || "No value").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function terminalSummary(status: HarnessTerminalStatus, turns: number, toolCalls: number, pendingCall: unknown) {
  if (status === "completed") {
    return `Completed after ${turns} model ${turns === 1 ? "turn" : "turns"} and ${toolCalls} tool ${toolCalls === 1 ? "call" : "calls"}.`;
  }
  if (status === "approval_required") {
    return `Paused for approval before dispatching ${typeof pendingCall === "string" ? pendingCall : "the tool call"}.`;
  }
  if (status === "budget_exceeded") return `Stopped at the ${turns}-turn limit.`;
  return `Stopped after the recorded model ran out of replies.`;
}

/** Builds the visible trace from the learner's returned run record, never from the expected fixture. */
export function harnessScenarioTrace(value: JsonValue): HarnessScenarioTrace {
  const run = record(value);
  const allowedStatuses = new Set<HarnessTerminalStatus>([
    "completed",
    "approval_required",
    "budget_exceeded",
    "model_exhausted",
  ]);
  if (!run || typeof run.status !== "string" || !allowedStatuses.has(run.status as HarnessTerminalStatus)) {
    throw new Error("The harness returned a run without a known terminal status.");
  }
  if (!Number.isInteger(run.turns) || !Number.isInteger(run.tool_calls)) {
    throw new Error("The harness returned a run without finite turn and tool-call counts.");
  }
  if (!Array.isArray(run.messages) || !Array.isArray(run.events)) {
    throw new Error("The harness returned a run without messages and events.");
  }

  const rows: HarnessTraceRow[] = [];
  for (const rawMessage of run.messages) {
    const message = record(rawMessage);
    if (!message || message.role !== "assistant") {
      if (message?.role === "tool" && typeof message.call_id === "string") {
        const denied = message.is_error === true;
        rows.push({
          actor: denied ? "harness" : "tool",
          text: denied ? `Returned error observation · ${compact(message.content)}` : `Returned ${compact(message.content)}`,
          tone: denied ? "error" : "neutral",
        });
      }
      continue;
    }

    const call = record(message.tool_call);
    if (call && typeof call.id === "string" && typeof call.name === "string") {
      const args = record(call.arguments) ?? {};
      const formattedArgs = Object.entries(args)
        .map(([name, argument]) => `${name}=${compact(argument, 54)}`)
        .join(", ");
      rows.push({ actor: "model", text: `${call.name}(${formattedArgs})`, tone: "neutral" });
      const policy = run.events
        .map(record)
        .find((event) => event?.kind === "policy_decision" && event.call_id === call.id);
      if (policy && typeof policy.decision === "string") {
        const rule = typeof policy.rule_id === "string" ? ` by ${policy.rule_id}` : " by default";
        const policyVerb = policy.decision === "allow"
          ? "Allowed"
          : policy.decision === "confirm"
            ? "Approval required"
            : "Denied";
        rows.push({
          actor: "harness",
          text: `${policyVerb}${rule}`,
          tone: policy.decision === "deny" ? "error" : policy.decision === "confirm" ? "warning" : "neutral",
        });
      }
    } else if (typeof message.content === "string") {
      rows.push({ actor: "model", text: `“${compact(message.content)}”`, tone: "neutral" });
    }
  }

  const status = run.status as HarnessTerminalStatus;
  const turns = run.turns as number;
  const toolCalls = run.tool_calls as number;
  const summary = terminalSummary(status, turns, toolCalls, run.pending_call);

  return {
    status,
    summary,
    turns,
    toolCalls,
    final: typeof run.final === "string" ? run.final : null,
    rows,
  };
}

function sameStrings(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

/** Host-owned semantic check for the visible green state. */
export function harnessScenarioMatchesExpected(value: JsonValue, scenario: HarnessScenarioFixture) {
  let trace: HarnessScenarioTrace;
  try {
    trace = harnessScenarioTrace(value);
  } catch {
    return false;
  }
  const run = record(value);
  if (!run || !Array.isArray(run.messages) || !Array.isArray(run.events)) return false;

  const messages = run.messages.map(record);
  const events = run.events.map(record);
  if (messages.some((message) => !message || typeof message.role !== "string")) return false;
  if (events.some((event) => !event || typeof event.kind !== "string")) return false;
  const roles = messages.map((message) => message?.role as string);
  const eventKinds = events.map((event) => event?.kind as string);

  const proposed = new Set<string>();
  const resolved = new Set<string>();
  for (const message of messages) {
    const call = record(message?.tool_call);
    if (message?.role === "assistant" && call) {
      if (typeof call.id !== "string" || proposed.has(call.id)) return false;
      proposed.add(call.id);
    }
    if (message?.role === "tool") {
      if (typeof message.call_id !== "string" || !proposed.has(message.call_id) || resolved.has(message.call_id)) return false;
      resolved.add(message.call_id);
    }
  }

  const pendingCall = typeof run.pending_call === "string" ? run.pending_call : null;
  const expectedPending = scenario.expected.pendingCall;
  const pairingIsValid = expectedPending
    ? proposed.has(expectedPending) && !resolved.has(expectedPending)
    : [...proposed].every((callId) => resolved.has(callId));

  return trace.status === scenario.expected.terminalStatus
    && trace.final === scenario.expected.final
    && trace.turns === scenario.expected.turns
    && trace.toolCalls === scenario.expected.toolCallCount
    && pendingCall === expectedPending
    && sameStrings(roles, scenario.expected.messageRoles)
    && sameStrings(eventKinds, scenario.expected.eventKinds)
    && pairingIsValid;
}
