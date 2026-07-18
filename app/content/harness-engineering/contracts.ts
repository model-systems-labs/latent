import type {
  ContractSuite,
  ExerciseCase,
  ExerciseContract,
  HostAssertion,
  JsonValue,
  ValuePath,
} from "@latent/browser-lab/types";

type Case = {
  id: string;
  label: string;
  args: readonly JsonValue[];
  assertions: readonly HostAssertion[];
};

const paths: Record<string, string> = {
  "agent-loop": "harness-engineering/agent-loop.py",
  "tool-contracts": "harness-engineering/tool-contracts.py",
  "context-selection": "harness-engineering/context-selection.py",
  "permissions-and-sandboxes": "harness-engineering/permissions-and-sandboxes.py",
  "state-and-recovery": "harness-engineering/state-and-recovery.py",
  "agent-evaluations": "harness-engineering/agent-evaluations.py",
  "task-orchestration": "harness-engineering/task-orchestration.py",
  "integrated-harness": "harness-engineering/integrated-harness.py",
};

function define(
  lessonId: string,
  blockId: string,
  label: string,
  exportName: string,
  cases: readonly Case[],
): ExerciseContract {
  const modulePath = paths[lessonId];
  if (!modulePath) throw new Error(`Missing Harness Engineering path for ${lessonId}.`);
  return {
    id: `${lessonId}/${blockId}`,
    label,
    cases: cases.map((exerciseCase): ExerciseCase => ({
      id: exerciseCase.id,
      label: exerciseCase.label,
      invoke: { modulePath, exportName, args: exerciseCase.args },
      assertions: exerciseCase.assertions,
    })),
  };
}

function equal(
  id: string,
  label: string,
  expected: JsonValue,
  path?: ValuePath,
): HostAssertion {
  return { id, label, kind: "deep-equal", expected, path };
}

function length(
  id: string,
  label: string,
  expected: number,
  path?: ValuePath,
): HostAssertion {
  return { id, label, kind: "length", expected, path };
}

function range(
  id: string,
  label: string,
  minimum: number,
  maximum: number,
  path?: ValuePath,
): HostAssertion {
  return { id, label, kind: "range", minimum, maximum, path };
}

function throwsWith(id: string, label: string, messageIncludes: string): HostAssertion {
  return { id, label, kind: "throws", messageIncludes };
}

const readFileCall = {
  role: "assistant",
  tool_call: { id: "c1", name: "read_file", arguments: { path: "app.py" } },
} as const;

const integratedMessages: JsonValue[] = [{ role: "user", content: "Read app.py" }];
const integratedTools: JsonValue[] = [{
  name: "read_file",
  kind: "read",
  target_arg: "path",
  required: { path: "str" },
  outputs: { c1: "def main(): pass" },
}];
const integratedRules: JsonValue[] = [{
  id: "workspace-read",
  kind: "read",
  target_prefix: "/workspace",
  decision: "allow",
}];

export const harnessEngineeringExerciseContracts: readonly ExerciseContract[] = [
  define("agent-loop", "parse-model-response", "Parse a model response", "parse_model_response", [
    {
      id: "final-response",
      label: "Normalizes a final response",
      args: [{ final: "The tests pass." }, ["read_file", "run_tests"]],
      assertions: [
        equal("final-action", "Return final text without changing it", {
          kind: "final",
          text: "The tests pass.",
        }),
      ],
    },
    {
      id: "known-tool",
      label: "Normalizes a call to an available tool",
      args: [
        { tool_call: { id: "c1", name: "read_file", arguments: { path: "app.py" } } },
        ["read_file", "run_tests"],
      ],
      assertions: [
        equal("tool-action", "Keep the call id, tool name, and arguments together", {
          kind: "tool_call",
          call_id: "c1",
          name: "read_file",
          arguments: { path: "app.py" },
        }),
      ],
    },
    {
      id: "ambiguous-response",
      label: "Rejects a response with two actions",
      args: [
        {
          final: "Done",
          tool_call: { id: "c1", name: "read_file", arguments: { path: "app.py" } },
        },
        ["read_file"],
      ],
      assertions: [
        throwsWith(
          "one-action",
          "Require exactly one final response or tool call",
          "exactly one final or tool_call",
        ),
      ],
    },
    {
      id: "unknown-tool",
      label: "Rejects a tool outside the available set",
      args: [
        { tool_call: { id: "c2", name: "delete_repo", arguments: {} } },
        ["read_file", "run_tests"],
      ],
      assertions: [
        throwsWith("known-tool-only", "Do not dispatch an unavailable tool", "unknown tool"),
      ],
    },
  ]),
  define("agent-loop", "append-tool-result", "Append a tool result", "append_tool_result", [
    {
      id: "successful-result",
      label: "Appends a successful observation",
      args: [[readFileCall], "c1", "file contents", false],
      assertions: [
        length("history-length", "Add exactly one message", 2),
        equal("tool-message", "Attach the observation to the matching call", {
          role: "tool",
          call_id: "c1",
          content: "file contents",
          is_error: false,
        }, [1]),
      ],
    },
    {
      id: "error-result",
      label: "Records a tool failure as an observation",
      args: [[readFileCall], "c1", "file not found", true],
      assertions: [
        equal("error-flag", "Preserve the tool error flag", true, [1, "is_error"]),
        equal("error-content", "Keep the error text available to the next turn", "file not found", [1, "content"]),
      ],
    },
    {
      id: "missing-call",
      label: "Rejects an observation without a matching call",
      args: [[readFileCall], "c9", "orphaned", false],
      assertions: [
        throwsWith("matching-call", "Require one matching assistant tool call", "one matching call"),
      ],
    },
    {
      id: "duplicate-result",
      label: "Rejects a second result for the same call",
      args: [[
        readFileCall,
        { role: "tool", call_id: "c1", content: "first", is_error: false },
      ], "c1", "second", false],
      assertions: [
        throwsWith("one-result", "Do not resolve the same call twice", "already has a result"),
      ],
    },
  ]),

  define("tool-contracts", "validate-tool-arguments", "Validate tool arguments", "validate_tool_arguments", [
    {
      id: "required-and-optional",
      label: "Accepts declared required and optional fields",
      args: [
        { path: "app.py", line: 12 },
        { required: { path: "str" }, optional: { line: "int" }, allow_extra: false },
      ],
      assertions: [
        equal("validated-arguments", "Return the validated arguments unchanged", { path: "app.py", line: 12 }),
      ],
    },
    {
      id: "missing-required",
      label: "Rejects a missing required field",
      args: [
        { line: 12 },
        { required: { path: "str" }, optional: { line: "int" }, allow_extra: false },
      ],
      assertions: [
        throwsWith("required-path", "Name the missing required argument", "missing required argument: path"),
      ],
    },
    {
      id: "boolean-is-not-integer",
      label: "Does not treat a Boolean as an integer",
      args: [
        { line: true },
        { required: { line: "int" }, optional: {}, allow_extra: false },
      ],
      assertions: [
        throwsWith("exact-type", "Apply the declared type exactly", "line must have type int"),
      ],
    },
    {
      id: "unexpected-field",
      label: "Rejects undeclared arguments by default",
      args: [
        { path: "app.py", recursive: true },
        { required: { path: "str" }, optional: {}, allow_extra: false },
      ],
      assertions: [
        throwsWith("closed-schema", "Keep undeclared fields outside the tool boundary", "unexpected argument: recursive"),
      ],
    },
    {
      id: "unsupported-optional-type",
      label: "Rejects an unsupported type even when the optional field is absent",
      args: [
        { path: "app.py" },
        { required: { path: "str" }, optional: { mode: "enum" }, allow_extra: false },
      ],
      assertions: [
        throwsWith("validate-whole-schema", "Validate the entire tool schema before accepting arguments", "unsupported schema type for mode"),
      ],
    },
    {
      id: "overlapping-field",
      label: "Rejects a field declared as both required and optional",
      args: [
        { path: "app.py" },
        { required: { path: "str" }, optional: { path: "int" }, allow_extra: false },
      ],
      assertions: [
        throwsWith("one-field-role", "Give each declared field one unambiguous role", "both required and optional"),
      ],
    },
  ]),
  define("tool-contracts", "page-tool-results", "Page tool results", "page_tool_results", [
    {
      id: "first-page",
      label: "Returns the first bounded page",
      args: [["a", "b", "c", "d", "e"], 0, 2],
      assertions: [
        equal("page", "Return the slice and the next offset", {
          items: ["a", "b"], returned: 2, total: 5, next_offset: 2,
        }),
      ],
    },
    {
      id: "final-page",
      label: "Marks the final partial page",
      args: [["a", "b", "c", "d", "e"], 4, 3],
      assertions: [
        equal("last-page", "Return the remaining item without another offset", {
          items: ["e"], returned: 1, total: 5, next_offset: null,
        }),
      ],
    },
    {
      id: "past-end",
      label: "Handles an offset beyond the available results",
      args: [["a", "b"], 5, 2],
      assertions: [
        equal("empty-page", "Return an empty completed page", {
          items: [], returned: 0, total: 2, next_offset: null,
        }),
      ],
    },
    {
      id: "oversized-limit",
      label: "Rejects a page that exceeds the tool boundary",
      args: [["a", "b"], 0, 51],
      assertions: [
        throwsWith("bounded-limit", "Keep the limit between one and fifty", "between 1 and 50"),
      ],
    },
  ]),

  define("context-selection", "select-context", "Select context", "select_context", [
    {
      id: "required-then-priority",
      label: "Places required context before the best optional evidence",
      args: [[
        { id: "instructions", tokens: 40, priority: 100 },
        { id: "current-test", tokens: 30, priority: 9 },
        { id: "schema", tokens: 50, priority: 8 },
        { id: "old-log", tokens: 70, priority: 2 },
      ], 120, ["instructions"]],
      assertions: [
        equal("selected-order", "Keep required ids first, then use stable priority order", ["instructions", "current-test", "schema"], ["selected_ids"]),
        equal("used-budget", "Count every selected token", 120, ["used_tokens"]),
        equal("remaining-budget", "Report no unused tokens", 0, ["remaining_tokens"]),
      ],
    },
    {
      id: "stable-priority",
      label: "Preserves input order when priorities tie",
      args: [[
        { id: "required", tokens: 1, priority: 0 },
        { id: "first", tokens: 2, priority: 5 },
        { id: "second", tokens: 2, priority: 5 },
      ], 5, ["required"]],
      assertions: [
        equal("stable-tie", "Use source order to break equal priorities", ["required", "first", "second"], ["selected_ids"]),
      ],
    },
    {
      id: "skip-oversized-item",
      label: "Uses smaller evidence when a higher-priority item does not fit",
      args: [[
        { id: "required", tokens: 4, priority: 100 },
        { id: "large", tokens: 8, priority: 9 },
        { id: "small", tokens: 2, priority: 8 },
      ], 6, ["required"]],
      assertions: [
        equal("fit-not-prefix", "Continue looking for useful evidence that fits", ["required", "small"], ["selected_ids"]),
      ],
    },
    {
      id: "required-overflow",
      label: "Rejects a budget smaller than required context",
      args: [[{ id: "rules", tokens: 10, priority: 100 }], 9, ["rules"]],
      assertions: [
        throwsWith("required-fits", "Do not silently drop required context", "required context exceeds budget"),
      ],
    },
  ]),
  define("context-selection", "compact-tool-outputs", "Compact tool output", "compact_tool_outputs", [
    {
      id: "older-result",
      label: "Compacts an older tool result",
      args: [[
        { role: "tool", call_id: "c1", content: "abcdefghij" },
        { role: "tool", call_id: "c2", content: "klmnopqrst" },
      ], 1, 4],
      assertions: [
        equal("old-preview", "Keep the old call id and an explicit content preview", {
          role: "tool", call_id: "c1", content: "abcd... [6 chars omitted]", compacted: true,
        }, [0]),
        equal("recent-exact", "Leave the most recent tool result unchanged", {
          role: "tool", call_id: "c2", content: "klmnopqrst",
        }, [1]),
      ],
    },
    {
      id: "compact-all",
      label: "Compacts every result when no recent result is reserved",
      args: [[{ role: "tool", call_id: "c1", content: "abcdef" }], 0, 2],
      assertions: [
        equal("all-preview", "Honor keep_recent zero", "ab... [4 chars omitted]", [0, "content"]),
        equal("compaction-marker", "Mark a message only when its content changes", true, [0, "compacted"]),
      ],
    },
    {
      id: "short-content",
      label: "Leaves already-small content unchanged",
      args: [[{ role: "tool", call_id: "c1", content: "abc" }], 0, 3],
      assertions: [
        equal("short-exact", "Do not add a compaction marker to content that already fits", {
          role: "tool", call_id: "c1", content: "abc",
        }, [0]),
      ],
    },
    {
      id: "invalid-recency",
      label: "Rejects a negative recent-result count",
      args: [[], -1, 4],
      assertions: [
        throwsWith("nonnegative-recent", "Require a non-negative keep_recent value", "keep_recent must be non-negative"),
      ],
    },
  ]),

  define("permissions-and-sandboxes", "normalize-workspace-path", "Normalize a workspace path", "normalize_workspace_path", [
    {
      id: "resolve-segments",
      label: "Resolves a relative path inside the workspace",
      args: ["/workspace", "src/../tests/test_app.py"],
      assertions: [
        equal("normalized-path", "Return one normalized absolute workspace path", "/workspace/tests/test_app.py"),
      ],
    },
    {
      id: "workspace-root",
      label: "Allows a request for the workspace root itself",
      args: ["/workspace/project", "."],
      assertions: [
        equal("root-path", "Keep the normalized request inside the configured root", "/workspace/project"),
      ],
    },
    {
      id: "absolute-request",
      label: "Rejects an absolute requested path",
      args: ["/workspace", "/etc/passwd"],
      assertions: [
        throwsWith("relative-request", "Require requested paths to be relative", "requested path must be relative"),
      ],
    },
    {
      id: "parent-traversal",
      label: "Rejects traversal beyond the workspace",
      args: ["/workspace", "../workspace-old/secret.txt"],
      assertions: [
        throwsWith("workspace-containment", "Do not confuse a shared prefix with workspace containment", "outside the workspace"),
      ],
    },
    {
      id: "relative-root",
      label: "Rejects a relative workspace root",
      args: ["workspace", "src/app.py"],
      assertions: [
        throwsWith("absolute-root", "Require an absolute host-owned workspace root", "root must be an absolute path"),
      ],
    },
  ]),
  define("permissions-and-sandboxes", "permission-decision", "Evaluate permission rules", "permission_decision", [
    {
      id: "deny-overrides-allow",
      label: "Lets a deny rule override a broader allow",
      args: [
        { kind: "read", target: "/workspace/.env" },
        [
          { id: "read-workspace", kind: "read", target_prefix: "/workspace", decision: "allow" },
          { id: "deny-secrets", kind: "read", target_prefix: "/workspace/.env", decision: "deny" },
        ],
      ],
      assertions: [
        equal("secret-denied", "Select the matching deny rule", { decision: "deny", rule_id: "deny-secrets" }),
      ],
    },
    {
      id: "confirm-overrides-allow",
      label: "Requires confirmation when allow and confirm both match",
      args: [
        { kind: "write", target: "/workspace/src/app.py" },
        [
          { id: "allow-source", kind: "write", target_prefix: "/workspace/src", decision: "allow" },
          { id: "confirm-writes", kind: "*", target_prefix: "/workspace", decision: "confirm" },
        ],
      ],
      assertions: [
        equal("write-confirmed", "Choose confirm ahead of allow", { decision: "confirm", rule_id: "confirm-writes" }),
      ],
    },
    {
      id: "longer-prefix",
      label: "Uses the most specific rule at equal precedence",
      args: [
        { kind: "read", target: "/workspace/public/readme.md" },
        [
          { id: "workspace-read", kind: "read", target_prefix: "/workspace", decision: "allow" },
          { id: "public-read", kind: "read", target_prefix: "/workspace/public", decision: "allow" },
        ],
      ],
      assertions: [
        equal("specific-rule", "Prefer the longer matching target prefix", { decision: "allow", rule_id: "public-read" }),
      ],
    },
    {
      id: "default-deny",
      label: "Denies an action with no matching rule",
      args: [
        { kind: "network", target: "https://example.com" },
        [{ id: "read-files", kind: "read", target_prefix: "/workspace", decision: "allow" }],
      ],
      assertions: [
        equal("deny-unmatched", "Deny unmatched capabilities without inventing a rule id", { decision: "deny", rule_id: null }),
      ],
    },
    {
      id: "path-prefix-collision",
      label: "Does not treat a sibling path as a child resource",
      args: [
        { kind: "read", target: "/workspace2/file.txt" },
        [{ id: "workspace-read", kind: "read", target_prefix: "/workspace", decision: "allow" }],
      ],
      assertions: [
        equal("segment-boundary", "Match path segments rather than a shared string prefix", { decision: "deny", rule_id: null }),
      ],
    },
    {
      id: "empty-prefix",
      label: "Rejects an empty resource prefix",
      args: [
        { kind: "read", target: "/etc/passwd" },
        [{ id: "empty-read", kind: "read", target_prefix: "", decision: "allow" }],
      ],
      assertions: [
        throwsWith("explicit-prefix", "Do not turn an empty prefix into a root-wide rule", "target_prefix must be non-empty"),
      ],
    },
  ]),

  define("state-and-recovery", "apply-run-event", "Apply a run event", "apply_run_event", [
    {
      id: "tool-completed",
      label: "Records one completed tool call",
      args: [
        { seen: [], status: "running", completed: [], checkpoint: null },
        { id: "e1", kind: "tool_completed", call_id: "c1" },
      ],
      assertions: [
        equal("completion-state", "Record the event and call exactly once", {
          seen: ["e1"], status: "running", completed: ["c1"], checkpoint: null,
        }),
      ],
    },
    {
      id: "duplicate-event",
      label: "Treats a repeated event id as a no-op",
      args: [
        { seen: ["e1"], status: "running", completed: ["c1"], checkpoint: null },
        { id: "e1", kind: "tool_completed", call_id: "c2" },
      ],
      assertions: [
        equal("idempotent-replay", "Do not apply the payload of an event already seen", {
          seen: ["e1"], status: "running", completed: ["c1"], checkpoint: null,
        }),
      ],
    },
    {
      id: "latest-checkpoint",
      label: "Stores a durable checkpoint summary",
      args: [
        { seen: ["e1"], status: "running", completed: ["c1"], checkpoint: null },
        { id: "e2", kind: "checkpoint", summary: "tests collected" },
      ],
      assertions: [
        equal("checkpoint-summary", "Keep prior completions and update the checkpoint", "tests collected", ["checkpoint"]),
        equal("checkpoint-seen", "Record the checkpoint event id", ["e1", "e2"], ["seen"]),
      ],
    },
    {
      id: "finished-run",
      label: "Records a terminal result",
      args: [
        { seen: [], status: "running", completed: [], checkpoint: null },
        { id: "e9", kind: "finished", result: { answer: "done" } },
      ],
      assertions: [
        equal("completed-status", "Move the run to completed", "completed", ["status"]),
        equal("terminal-result", "Preserve the finished result", { answer: "done" }, ["result"]),
      ],
    },
    {
      id: "event-after-terminal",
      label: "Rejects new work after a terminal event",
      args: [
        { seen: ["e9"], status: "completed", completed: [], checkpoint: null, result: "done" },
        { id: "e10", kind: "checkpoint", summary: "too late" },
      ],
      assertions: [
        throwsWith("terminal-boundary", "Do not change a completed run with a new event", "after terminal status"),
      ],
    },
  ]),
  define("state-and-recovery", "resume-run", "Derive a resume plan", "resume_run", [
    {
      id: "resume-after-failure",
      label: "Separates completed and pending calls after failure",
      args: [[
        { id: "e1", kind: "tool_completed", call_id: "c1" },
        { id: "e2", kind: "checkpoint", summary: "tests collected" },
        { id: "e3", kind: "failed", error: "sandbox expired" },
      ], ["c1", "c2", "c3"]],
      assertions: [
        equal("resume-plan", "Restore status, checkpoint, and planned call order", {
          status: "failed",
          checkpoint: "tests collected",
          completed: ["c1"],
          pending: ["c2", "c3"],
        }),
      ],
    },
    {
      id: "duplicate-delivery",
      label: "Ignores duplicate event delivery during replay",
      args: [[
        { id: "e1", kind: "tool_completed", call_id: "c1" },
        { id: "e1", kind: "tool_completed", call_id: "c2" },
      ], ["c1", "c2"]],
      assertions: [
        equal("single-delivery", "Apply only the first payload for a stable event id", {
          status: "running", checkpoint: null, completed: ["c1"], pending: ["c2"],
        }),
      ],
    },
    {
      id: "planned-order",
      label: "Restores completed calls in planned order",
      args: [[
        { id: "e2", kind: "tool_completed", call_id: "c2" },
        { id: "e1", kind: "tool_completed", call_id: "c1" },
      ], ["c1", "c2", "c3"]],
      assertions: [
        equal("ordered-completed", "Use plan order rather than delivery order", ["c1", "c2"], ["completed"]),
        equal("ordered-pending", "Leave only unfinished planned calls pending", ["c3"], ["pending"]),
      ],
    },
    {
      id: "unknown-completion",
      label: "Rejects completion for an unplanned call",
      args: [[{ id: "e1", kind: "tool_completed", call_id: "c9" }], ["c1"]],
      assertions: [
        throwsWith("planned-call", "Do not accept side effects outside the run plan", "not in the plan"),
      ],
    },
    {
      id: "continued-terminal-log",
      label: "Rejects events appended after terminal status",
      args: [[
        { id: "e1", kind: "finished", result: "done" },
        { id: "e2", kind: "checkpoint", summary: "late" },
      ], []],
      assertions: [
        throwsWith("terminal-log", "Require terminal events to end the durable log", "continues after terminal status"),
      ],
    },
  ]),

  define("agent-evaluations", "grade-outcome", "Grade an outcome", "grade_outcome", [
    {
      id: "all-requirements-pass",
      label: "Passes an outcome that meets every requirement",
      args: [
        { tests_passed: true, coverage: 0.86, changed_files: ["src/app.py"] },
        [
          { field: "tests_passed", op: "eq", value: true },
          { field: "coverage", op: "gte", value: 0.8 },
          { field: "changed_files", op: "contains", value: "src/app.py" },
        ],
      ],
      assertions: [
        equal("passing-grade", "Return no failed fields", { passed: true, failed_fields: [] }),
      ],
    },
    {
      id: "several-failures",
      label: "Reports each failed outcome field in requirement order",
      args: [
        { tests_passed: false, coverage: 0.61, changed_files: [] },
        [
          { field: "tests_passed", op: "eq", value: true },
          { field: "coverage", op: "gte", value: 0.8 },
          { field: "changed_files", op: "contains", value: "src/app.py" },
        ],
      ],
      assertions: [
        equal("failed-grade", "Name every criterion that the final state missed", {
          passed: false,
          failed_fields: ["tests_passed", "coverage", "changed_files"],
        }),
      ],
    },
    {
      id: "missing-field",
      label: "Fails a requirement whose field is absent",
      args: [{ tests_passed: true }, [{ field: "coverage", op: "gte", value: 0.8 }]],
      assertions: [
        equal("missing-fails", "Treat missing outcome evidence as a failed criterion", {
          passed: false, failed_fields: ["coverage"],
        }),
      ],
    },
    {
      id: "less-than-threshold",
      label: "Supports an upper-bound requirement",
      args: [{ tool_calls: 6 }, [{ field: "tool_calls", op: "lte", value: 6 }]],
      assertions: [
        equal("inclusive-upper-bound", "Include the exact upper bound", { passed: true, failed_fields: [] }),
      ],
    },
    {
      id: "boolean-type",
      label: "Does not accept an integer in place of a Boolean outcome",
      args: [{ tests_passed: 1 }, [{ field: "tests_passed", op: "eq", value: true }]],
      assertions: [
        equal("typed-boolean", "Require exact Boolean evidence for a Boolean requirement", {
          passed: false, failed_fields: ["tests_passed"],
        }),
      ],
    },
    {
      id: "unsupported-operation",
      label: "Rejects a grader operation it does not implement",
      args: [{ score: 1 }, [{ field: "score", op: "approximately", value: 1 }]],
      assertions: [
        throwsWith("known-grader", "Require a supported deterministic operation", "supported operation"),
      ],
    },
  ]),
  define("agent-evaluations", "trial-metrics", "Compute trial metrics", "trial_metrics", [
    {
      id: "mixed-trials",
      label: "Separates capability and consistency across two attempts",
      args: [[true, false, true, false], 2],
      assertions: [
        equal("mixed-metrics", "Compute finite-sample pass rate, pass at k, and pass k", {
          pass_rate: 0.5, pass_at_k: 0.8333333333333334, pass_k: 0.16666666666666666,
        }),
      ],
    },
    {
      id: "all-pass",
      label: "Returns one for an always-successful trial set",
      args: [[true, true, true], 3],
      assertions: [
        equal("perfect-metrics", "Keep every success metric at one", {
          pass_rate: 1, pass_at_k: 1, pass_k: 1,
        }),
      ],
    },
    {
      id: "none-pass",
      label: "Returns zero for a never-successful trial set",
      args: [[false, false], 2],
      assertions: [
        equal("zero-metrics", "Keep every success metric at zero", {
          pass_rate: 0, pass_at_k: 0, pass_k: 0,
        }),
      ],
    },
    {
      id: "one-attempt",
      label: "Makes both repeated-trial metrics equal the pass rate at k one",
      args: [[true, false], 1],
      assertions: [
        range("pass-at-one", "Return one half for pass at one", 0.499999999, 0.500000001, ["pass_at_k"]),
        range("pass-k-one", "Return one half for pass k at one", 0.499999999, 0.500000001, ["pass_k"]),
      ],
    },
    {
      id: "empty-trials",
      label: "Rejects an empty trial set",
      args: [[], 2],
      assertions: [
        throwsWith("observed-trial", "Require at least one observed trial", "non-empty list"),
      ],
    },
    {
      id: "too-many-draws",
      label: "Rejects k larger than the observed trial set",
      args: [[true, false], 3],
      assertions: [
        throwsWith("finite-sample", "Keep the draw inside the finite trial set", "cannot exceed"),
      ],
    },
  ]),

  define("task-orchestration", "parallel-batches", "Build parallel batches", "parallel_batches", [
    {
      id: "dependency-graph",
      label: "Batches independent work before dependent work",
      args: [[
        { id: "inspect", depends_on: [] },
        { id: "research", depends_on: [] },
        { id: "implement", depends_on: ["inspect"] },
        { id: "verify", depends_on: ["implement", "research"] },
      ]],
      assertions: [
        equal("execution-waves", "Keep ready tasks together and preserve declared order", [
          ["inspect", "research"], ["implement"], ["verify"],
        ]),
      ],
    },
    {
      id: "single-chain",
      label: "Keeps a dependency chain sequential",
      args: [[
        { id: "a", depends_on: [] },
        { id: "b", depends_on: ["a"] },
        { id: "c", depends_on: ["b"] },
      ]],
      assertions: [
        equal("sequential-waves", "Do not parallelize dependent work", [["a"], ["b"], ["c"]]),
      ],
    },
    {
      id: "missing-dependency",
      label: "Rejects a task whose dependency is absent",
      args: [[{ id: "verify", depends_on: ["implement"] }]],
      assertions: [
        throwsWith("complete-graph", "Require every dependency to be declared", "missing dependency"),
      ],
    },
    {
      id: "cyclic-graph",
      label: "Rejects a cyclic task graph",
      args: [[
        { id: "a", depends_on: ["b"] },
        { id: "b", depends_on: ["a"] },
      ]],
      assertions: [
        throwsWith("acyclic-graph", "Do not schedule a graph with no ready task", "contains a cycle"),
      ],
    },
  ]),
  define("task-orchestration", "collect-worker-results", "Collect worker results", "collect_worker_results", [
    {
      id: "asynchronous-completion",
      label: "Restores declared order after workers finish out of order",
      args: [
        ["inspect", "research"],
        [
          { task_id: "research", status: "ok", value: "sources" },
          { task_id: "inspect", status: "ok", value: "files" },
        ],
      ],
      assertions: [
        equal("ordered-results", "Return the full result records in task order", [
          { task_id: "inspect", status: "ok", value: "files" },
          { task_id: "research", status: "ok", value: "sources" },
        ]),
      ],
    },
    {
      id: "missing-result",
      label: "Rejects an incomplete worker result set",
      args: [["inspect", "research"], [{ task_id: "inspect", status: "ok" }]],
      assertions: [
        throwsWith("one-per-task", "Name the task whose worker result is missing", "missing worker result: research"),
      ],
    },
    {
      id: "duplicate-result",
      label: "Rejects duplicate results for one task",
      args: [["inspect"], [
        { task_id: "inspect", status: "ok" },
        { task_id: "inspect", status: "error" },
      ]],
      assertions: [
        throwsWith("unique-result", "Accept exactly one result per task", "duplicate worker result"),
      ],
    },
    {
      id: "unexpected-result",
      label: "Rejects a result for an undeclared task",
      args: [["inspect"], [
        { task_id: "inspect", status: "ok" },
        { task_id: "extra", status: "ok" },
      ]],
      assertions: [
        throwsWith("declared-results", "Do not collect output outside the assignment set", "unexpected worker result"),
      ],
    },
  ]),

  define("integrated-harness", "run-harness", "Run the harness", "run_harness", [
    {
      id: "tool-then-final",
      label: "Completes after one allowed tool observation",
      args: [
        integratedMessages,
        [
          { tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/app.py" } } },
          { final: "The file defines the application." },
        ],
        integratedTools,
        integratedRules,
        4,
      ],
      assertions: [
        equal("completed-status", "Reach an explicit completed state", "completed", ["status"]),
        equal("final-text", "Return the final model text", "The file defines the application.", ["final"]),
        equal("one-dispatch", "Count only the allowed tool dispatch", 1, ["tool_calls"]),
        length("complete-history", "Keep the task, call, observation, and final response", 4, ["messages"]),
        equal("completion-event", "End the host trace with completion", "run_completed", ["events", 3, "kind"]),
      ],
    },
    {
      id: "denied-observation",
      label: "Turns a denied action into an error observation",
      args: [
        integratedMessages,
        [
          { tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/.env" } } },
          { final: "I cannot read that file." },
        ],
        integratedTools,
        [
          ...integratedRules,
          { id: "deny-secrets", kind: "read", target_prefix: "/workspace/.env", decision: "deny" },
        ],
        3,
      ],
      assertions: [
        equal("denied-not-dispatched", "Do not count a denied action as a tool dispatch", 0, ["tool_calls"]),
        equal("denied-error", "Expose the denial as an error observation", true, ["messages", 2, "is_error"]),
        equal("denied-content", "Do not leak a fixture output through a denied call", "permission denied", ["messages", 2, "content"]),
      ],
    },
    {
      id: "normalize-before-policy",
      label: "Normalizes a filesystem target before permission matching",
      args: [
        integratedMessages,
        [
          { tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/src/../.env" } } },
          { final: "Access was denied." },
        ],
        integratedTools,
        [
          ...integratedRules,
          { id: "deny-secrets", kind: "read", target_prefix: "/workspace/.env", decision: "deny" },
        ],
        3,
      ],
      assertions: [
        equal("normalized-denial", "Apply the specific deny rule after lexical normalization", true, ["messages", 2, "is_error"]),
        equal("normalization-blocks-output", "Do not dispatch the adapter through a dot-segment alias", 0, ["tool_calls"]),
      ],
    },
    {
      id: "approval-pause",
      label: "Pauses before a confirmation-gated dispatch",
      args: [
        integratedMessages,
        [{ tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/app.py" } } }],
        integratedTools,
        [{ id: "confirm-read", kind: "read", target_prefix: "/workspace", decision: "confirm" }],
        2,
      ],
      assertions: [
        equal("approval-status", "Return a distinct approval-required state", "approval_required", ["status"]),
        equal("pending-call", "Identify the exact call waiting for approval", "c1", ["pending_call"]),
        equal("no-dispatch-before-approval", "Do not dispatch before approval", 0, ["tool_calls"]),
        length("unresolved-history", "Keep the proposed call unresolved", 2, ["messages"]),
      ],
    },
    {
      id: "turn-budget",
      label: "Stops before a response beyond the host turn budget",
      args: [
        integratedMessages,
        [
          { tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/app.py" } } },
          { final: "This response is beyond the budget." },
        ],
        integratedTools,
        integratedRules,
        1,
      ],
      assertions: [
        equal("budget-status", "Stop with an explicit budget state", "budget_exceeded", ["status"]),
        equal("no-false-final", "Do not claim an unread final response", null, ["final"]),
        equal("budget-event", "Record why the run stopped", "budget_exceeded", ["events", 3, "kind"]),
      ],
    },
    {
      id: "unknown-tool",
      label: "Rejects a call outside the adapter registry",
      args: [
        integratedMessages,
        [{ tool_call: { id: "c9", name: "delete_repo", arguments: {} } }],
        integratedTools,
        integratedRules,
        1,
      ],
      assertions: [
        throwsWith("registered-tool", "Dispatch only a registered tool adapter", "unknown tool"),
      ],
    },
    {
      id: "duplicate-call-id",
      label: "Rejects a reused tool call identifier",
      args: [
        integratedMessages,
        [
          { tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/app.py" } } },
          { tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/app.py" } } },
        ],
        integratedTools,
        integratedRules,
        2,
      ],
      assertions: [
        throwsWith("unique-call-id", "Keep call-result pairing unambiguous", "unique non-empty text"),
      ],
    },
  ]),
  define("integrated-harness", "audit-harness-run", "Audit a harness run", "audit_harness_run", [
    {
      id: "valid-completion",
      label: "Accepts a complete paired run",
      args: [{
        status: "completed",
        messages: [
          { role: "assistant", tool_call: { id: "c1", name: "read_file" } },
          { role: "tool", call_id: "c1", content: "file", is_error: false },
          { role: "assistant", content: "Done" },
        ],
        events: [{ kind: "tool_completed" }, { kind: "run_completed" }],
      }],
      assertions: [
        equal("valid-run", "Return no issues for a valid protocol trace", { valid: true, issues: [] }),
      ],
    },
    {
      id: "orphan-result",
      label: "Finds a result without an earlier call",
      args: [{
        status: "model_exhausted",
        messages: [{ role: "tool", call_id: "c9", content: "orphan", is_error: false }],
        events: [{ kind: "model_exhausted" }],
      }],
      assertions: [
        equal("invalid-orphan", "Reject the malformed trace", false, ["valid"]),
        equal("orphan-detail", "Name the orphaned call identifier", "orphan tool result c9", ["issues", 0]),
      ],
    },
    {
      id: "unresolved-completion",
      label: "Finds a completed run with an unresolved tool call",
      args: [{
        status: "completed",
        messages: [
          { role: "assistant", tool_call: { id: "c1", name: "read_file" } },
          { role: "assistant", content: "Done" },
        ],
        events: [{ kind: "run_completed" }],
      }],
      assertions: [
        equal("invalid-unresolved", "Reject completion while a call is unresolved", false, ["valid"]),
        equal("unresolved-detail", "Name the unresolved call", "completed run has unresolved calls: c1", ["issues", 0]),
      ],
    },
    {
      id: "valid-approval",
      label: "Accepts an unresolved call when the run is awaiting approval",
      args: [{
        status: "approval_required",
        pending_call: "c1",
        messages: [{ role: "assistant", tool_call: { id: "c1", name: "read_file" } }],
        events: [{ kind: "action_proposed" }, { kind: "policy_decision" }],
      }],
      assertions: [
        equal("approval-valid", "Keep an approval pause distinct from a broken completion", { valid: true, issues: [] }),
      ],
    },
  ]),
];

export const harnessEngineeringContractSuite: ContractSuite = {
  contractVersion: "harness-engineering-contracts-v2-cpython",
  contracts: harnessEngineeringExerciseContracts,
};
