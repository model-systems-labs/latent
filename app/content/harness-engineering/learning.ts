import type { LessonLearningOutcome } from "../llm-systems/learning";

export const harnessEngineeringLearningOutcomes = {
  "agent-loop": {
    concept: "An agent loop alternates between model responses and deterministic host actions until an explicit stop condition is reached.",
    before: "A model response appears to execute a tool by itself.",
    after: "The model proposes an action, while the harness validates it, executes it, records the observation, and decides whether another turn is allowed.",
    check: {
      id: "tool-executor",
      prompt: "A model returns a valid request to read a file. What executes that request?",
      choices: [
        { id: "harness", label: "The harness, after validation and policy checks" },
        { id: "generated-runtime", label: "Model-generated code evaluated directly by the client" },
        { id: "renderer", label: "The interface when it renders the tool-call text" },
      ],
      correctChoiceId: "harness",
      explanation: "The model emits data describing a proposed action. Deterministic host code decides whether and how to perform it.",
    },
  },
  "tool-contracts": {
    concept: "A tool contract gives a probabilistic model a small typed interface to deterministic software.",
    before: "Any plausible-looking tool arguments can be sent directly to an internal API.",
    after: "The harness checks required fields, types, and boundaries, then returns a bounded result the model can interpret.",
    check: {
      id: "tool-surface",
      prompt: "Why is one agent tool per internal API endpoint usually a poor default?",
      choices: [
        { id: "ambiguity", label: "It enlarges and obscures the model-facing action space" },
        { id: "flexibility", label: "It is always best to mirror every internal endpoint for maximum flexibility" },
        { id: "shell", label: "A single unrestricted shell tool is clearer than task-level contracts" },
      ],
      correctChoiceId: "ambiguity",
      explanation: "Tools should represent clear agent tasks. Overlapping, low-level tools make selection harder and consume context with unnecessary schemas.",
    },
  },
  "context-selection": {
    concept: "Context selection allocates a finite token budget to instructions, current evidence, and useful history.",
    before: "More context always appears to give the model more useful information.",
    after: "Required instructions and current evidence are preserved while stale or lower-priority observations are omitted or compacted.",
    check: {
      id: "context-dilution",
      prompt: "Why can adding more context make an agent less reliable?",
      choices: [
        { id: "dilution", label: "Irrelevant tokens can crowd out or obscure the evidence needed now" },
        { id: "attention", label: "Attention will reliably ignore stale evidence, so selection is unnecessary" },
        { id: "rules-first", label: "System instructions should be compacted before old tool output" },
      ],
      correctChoiceId: "dilution",
      explanation: "Context is a finite inference-time resource. Selection should favor information that changes the next decision.",
    },
  },
  "permissions-and-sandboxes": {
    concept: "Permissions and sandbox boundaries restrict what an agent can do independently of what the model says.",
    before: "A system instruction appears sufficient to prevent unsafe file or network access.",
    after: "Paths are normalized, actions are matched against deterministic rules, and unmatched capabilities are denied by default.",
    check: {
      id: "security-boundary",
      prompt: "Why is a system prompt not an access-control boundary?",
      choices: [
        { id: "probabilistic", label: "Its effect is probabilistic, so the runtime must enforce permissions separately" },
        { id: "schema", label: "A tool schema listing allowed actions already authorizes each concrete target" },
        { id: "confirmation", label: "The model can reliably decide when its own action needs approval" },
      ],
      correctChoiceId: "probabilistic",
      explanation: "Instructions can steer behavior, but deterministic host controls must cap the available file, process, credential, and network access.",
    },
  },
  "state-and-recovery": {
    concept: "Durable run state records completed work outside the model context and disposable execution environment.",
    before: "Restarting an expired sandbox appears to require repeating the whole run.",
    after: "Stable event IDs, checkpoints, and replay identify which actions completed and which remain pending.",
    check: {
      id: "external-state",
      prompt: "Why store run state outside the sandbox?",
      choices: [
        { id: "survive", label: "The sandbox can fail or expire without erasing durable progress" },
        { id: "transcript", label: "Keeping the transcript only in model context provides the same recovery guarantee" },
        { id: "inside", label: "A checkpoint inside the disposable sandbox survives its deletion" },
      ],
      correctChoiceId: "survive",
      explanation: "Separating state from compute lets a fresh environment skip logged completions; ambiguous in-flight side effects still need idempotency keys or reconciliation.",
    },
  },
  "agent-evaluations": {
    concept: "Agent evaluations grade observable outcomes across repeated trials instead of requiring one exact trajectory.",
    before: "One successful transcript appears to prove that the agent is reliable.",
    after: "Outcome graders verify the changed environment, while repeated trials measure both capability and consistency.",
    check: {
      id: "coding-outcome",
      prompt: "What is the strongest basic grader for an agent asked to repair code?",
      choices: [
        { id: "tests", label: "Run the relevant tests against the resulting repository state" },
        { id: "claim", label: "Check whether the final response says the task is complete" },
        { id: "trace", label: "Require the same tool sequence as a reference trace" },
      ],
      correctChoiceId: "tests",
      explanation: "A working outcome matters more than a claim of success or one prescribed path to the solution.",
    },
  },
  "task-orchestration": {
    concept: "Task orchestration schedules independent work concurrently while preserving explicit dependency and result contracts.",
    before: "Adding more agents appears to make every task faster.",
    after: "Only independent tasks share a batch, and the coordinator detects missing, duplicate, or cyclic work before synthesis.",
    check: {
      id: "parallel-fit",
      prompt: "When is a multi-agent design most justified?",
      choices: [
        { id: "independent", label: "When substantial work is independently parallelizable with clear outputs" },
        { id: "shared", label: "When every worker must edit the same changing state" },
        { id: "small", label: "When one deterministic function already solves the task" },
      ],
      correctChoiceId: "independent",
      explanation: "Parallel agents add coordination and token costs. They help when work can be separated without constant shared-state synchronization.",
    },
  },
  "integrated-harness": {
    concept: "A model-agnostic harness composes adapters with deterministic validation, policy, limits, observations, and terminal state.",
    before: "The individual harness helpers appear sufficient without a single owner for their ordering and stop conditions.",
    after: "One host loop owns every transition, while recorded adapters make complete runs deterministic enough to test and audit in the browser.",
    check: {
      id: "approval-boundary",
      prompt: "A valid tool call matches a confirm rule. What should the composed harness do next?",
      choices: [
        { id: "pause", label: "Record the pending call and pause before dispatch" },
        { id: "execute", label: "Execute it, then ask whether the result should be kept" },
        { id: "deny", label: "Convert every confirmation rule into a permanent denial" },
      ],
      correctChoiceId: "pause",
      explanation: "Confirmation is a host-owned pre-dispatch state. No tool side effect should occur while approval remains unresolved.",
    },
  },
} satisfies Readonly<Record<string, LessonLearningOutcome>>;
