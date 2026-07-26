import type { ExerciseContract } from "@/examples/learning-platform/llm-learning/lessons/exercise-contracts";

function contract(
  signature: string,
  inputs: string,
  output: string,
  rule: string,
  example: string,
): ExerciseContract {
  return { signature, inputs, output, rule, example };
}

export const harnessEngineeringExerciseContractCopy: Record<string, ExerciseContract> = {
  "agent-loop/parse-model-response": contract(
    "def parse_model_response(response, tool_names):",
    "response: one final message or one structured tool call; tool_names: available tools",
    "one normalized final or tool-call dictionary",
    "Accept exactly one response form and reject calls to unavailable tools.",
    "{final: 'Done'} → {kind: 'final', text: 'Done'}",
  ),
  "agent-loop/append-tool-result": contract(
    "def append_tool_result(messages, call_id, output, is_error=False):",
    "message history, the completed call id, its output, and an error flag",
    "a copied history with one matching tool observation appended",
    "A tool call can receive one result, and the original history must remain unchanged.",
    "call c1 + 'file contents' → a tool message linked to c1",
  ),
  "tool-contracts/validate-tool-arguments": contract(
    "def validate_tool_arguments(arguments, spec):",
    "model-generated arguments and required, optional, and extra-field rules",
    "a copied argument dictionary, or a clear validation error",
    "Check missing, unexpected, and incorrectly typed fields before dispatch.",
    "path string + optional line integer → validated argument dictionary",
  ),
  "tool-contracts/page-tool-results": contract(
    "def page_tool_results(items, offset, limit):",
    "ordered result items, a non-negative offset, and a limit from 1 through 50",
    "the bounded items, returned and total counts, and the next offset",
    "Slice in stable order and use None when no further page remains.",
    "five items, offset 0, limit 2 → first two items and next_offset 2",
  ),
  "context-selection/select-context": contract(
    "def select_context(items, budget, required_ids):",
    "unique items with token counts and priorities, a token budget, and required ids",
    "selected ids plus used and remaining token counts",
    "Include required ids first, then admit optional items by stable descending priority when they fit.",
    "40 required tokens + optional 30 and 50 under budget 120 → all three selected",
  ),
  "context-selection/compact-tool-outputs": contract(
    "def compact_tool_outputs(messages, keep_recent, preview_chars):",
    "message history, exact recent tool results to keep, and preview characters for older results",
    "a copied history with only oversized older tool content compacted",
    "Preserve message order, role, and call id; mark every changed result explicitly.",
    "'abcdefghij' with preview 4 → 'abcd... [6 chars omitted]'",
  ),
  "permissions-and-sandboxes/normalize-workspace-path": contract(
    "def normalize_workspace_path(workspace_root, requested):",
    "an absolute host-owned workspace root and one relative requested path",
    "the normalized absolute path when it remains inside the workspace",
    "Resolve dot segments and reject lexical escapes; real containment still belongs to the host sandbox or descriptor-safe filesystem layer.",
    "'/workspace' + 'src/../tests/test.py' → '/workspace/tests/test.py'",
  ),
  "permissions-and-sandboxes/permission-decision": contract(
    "def permission_decision(action, rules):",
    "an action with kind and normalized target plus ordered allow, confirm, and deny rules",
    "a decision and the selected rule id, or a default deny with no id",
    "Match kind and resource boundary; deny outranks confirm, which outranks allow, then prefer the more specific prefix.",
    "a read of /workspace/.env → deny when a secrets rule matches",
  ),
  "state-and-recovery/apply-run-event": contract(
    "def apply_run_event(state, event):",
    "durable run state and one event with a stable id",
    "a copied state with the event applied once",
    "Duplicate event ids are no-ops, while new events cannot follow failed or completed state.",
    "tool_completed c1 → c1 added once to completed and the event id added to seen",
  ),
  "state-and-recovery/resume-run": contract(
    "def resume_run(events, planned_call_ids):",
    "an ordered durable event log and the unique planned call ids",
    "status, latest checkpoint, completed calls, and pending calls in plan order",
    "Replay each event id once and reject completions outside the plan or events after terminal status.",
    "completed c1 from plan [c1,c2] → completed [c1], pending [c2]",
  ),
  "agent-evaluations/grade-outcome": contract(
    "def grade_outcome(outcome, requirements):",
    "observable final state and eq, gte, lte, or contains requirements",
    "a pass flag and failed field names in requirement order",
    "Grade the final environment evidence; an absent or incomparable field fails its criterion.",
    "tests_passed equals True and coverage at least .8 → passed when both hold",
  ),
  "agent-evaluations/trial-metrics": contract(
    "def trial_metrics(successes, k):",
    "a non-empty Boolean trial history and a positive attempt count k",
    "empirical pass rate plus finite-sample pass@k and pass^k estimates",
    "Use draw-without-replacement combinations, and require k no larger than the observed trial count.",
    "[True, False, True, False], k=2 → .5, 5/6, 1/6",
  ),
  "task-orchestration/parallel-batches": contract(
    "def parallel_batches(tasks):",
    "unique task ids and their declared dependency ids",
    "stable execution batches containing every task once",
    "A batch contains every remaining task whose dependencies completed in earlier batches; reject missing or cyclic dependencies.",
    "inspect and research start together; implement waits for inspect",
  ),
  "task-orchestration/collect-worker-results": contract(
    "def collect_worker_results(task_ids, results):",
    "the coordinator's task order and asynchronously returned worker result dictionaries",
    "one complete result per task in declared order",
    "Reject missing, duplicate, and unexpected task results before synthesis.",
    "results [research, inspect] for tasks [inspect, research] → [inspect, research]",
  ),
  "integrated-harness/run-harness": contract(
    "def run_recorded_harness(initial_messages, model_config, tool_configs, rules, max_turns):",
    "initial messages, a recorded model-adapter configuration, typed tool adapters, permission rules, and a host turn budget",
    "one completed, approval-required, budget-exceeded, or model-exhausted run record",
    "Validate and authorize every transition; only allowed calls dispatch, and every stop condition is explicit.",
    "read_file c1 + allowed fixture + final response → completed run with one observation",
  ),
  "integrated-harness/audit-harness-run": contract(
    "def audit_harness_run(run):",
    "a harness run containing status, messages, and host events",
    "a validity flag and ordered protocol issues",
    "Require unique calls, one result per dispatched call, and terminal state consistent with the final trace.",
    "paired c1 result followed by final assistant text → valid with no issues",
  ),
};
