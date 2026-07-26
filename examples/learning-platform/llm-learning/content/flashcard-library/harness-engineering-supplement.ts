import {
  combineFlashcardLibraries,
  defineFlashcardGroup,
} from "@/examples/learning-platform/llm-learning/content/flashcard-schema";

const agentPatternsSource = "Anthropic, Building effective agents (2024); OpenAI, Harness engineering (2026).";
const runtimePolicySource = "W3C, High Resolution Time Working Draft (2026); course-authored Agent Loop runtime-policy contract.";
const mcpToolsSource = "Model Context Protocol contributors, Tools specification (2025-06-18).";
const toolInterfaceSource = "Anthropic, Building effective agents (2024), Prompt engineering your tools.";
const contextOperationsSource = "OpenAI, Harness engineering (2026); OpenAI, AGENTS.md guide.";
const directPromptInjectionSource = "OWASP GenAI Security Project, LLM01:2025 Prompt Injection; OpenAI, Understanding prompt injections; OpenAI, Agent approvals and security; OpenAI, Sandboxing.";
const securitySource = "OpenAI, Understanding prompt injections; OpenAI, Agent approvals and security; OpenAI, Sandboxing; Model Context Protocol contributors, Tools specification (2025-06-18).";
const harnessOperationsSource = "OpenAI, Harness engineering (2026).";
const orchestrationPatternsSource = "Anthropic, Building effective agents (2024); OpenAI, Harness engineering (2026).";

const agentLoopRuntimeSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Agent Loop",
    source: runtimePolicySource,
  },
  {
    "Wall-clock time budget": {
      definition: "In this course's host policy, a wall-clock time budget caps elapsed real time before the host stops requesting new work.",
      details: [
        "It bounds waiting, model inference, tool execution, retries, and scheduling delay rather than counting only model turns.",
        "The host measures elapsed time against a monotonic clock so system-clock adjustments cannot extend the allowance.",
        "Expiration needs an explicit terminal or paused status because it does not mean the task succeeded or that every in-flight side effect was cancelled.",
      ],
      example: "A run with a ten-minute budget stops requesting new model turns when its monotonic elapsed time reaches ten minutes.",
    },
  },
);

const agentLoopSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Agent Loop",
    source: agentPatternsSource,
  },
  {
    "Workflow–agent control distinction": {
      definition: "A workflow follows model and tool steps selected by predefined host code, while an agent lets a model dynamically choose its next actions and path.",
      details: [
        "Workflows favor predictability when the useful sequence and branches are known in advance.",
        "Agents add flexibility for open-ended tasks whose required steps cannot be enumerated reliably beforehand.",
        "Both are agentic systems and can be combined, so the distinction describes control flow rather than whether a model or tool appears at all.",
      ],
      example: "A fixed classify-then-summarize pipeline is a workflow; a coding loop that decides which files and tests to inspect next is an agent.",
    },
    "Augmented LLM": {
      definition: "An augmented LLM is a model call equipped with host-provided capabilities such as retrieval, tools, or memory beyond its immediate prompt text.",
      details: [
        "The model can choose among exposed capabilities, but deterministic host code still implements and constrains them.",
        "Clear interfaces matter because an augmentation is useful only when the model can select it and interpret its result correctly.",
        "An augmented LLM is a building block that can be used inside one call, a predefined workflow, or a longer-running agent.",
      ],
      example: "A support model that can retrieve policy pages, look up an order, and retain approved case notes is an augmented LLM.",
    },
  },
);

const mcpToolSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Tool Contracts",
    source: mcpToolsSource,
  },
  {
    "Tool-call timeout": {
      definition: "A tool-call timeout is a host-enforced elapsed-time limit for one tool invocation before the caller stops waiting and records a timeout outcome.",
      details: [
        "It is narrower than a run budget because it applies to one invocation rather than the complete agent run.",
        "Stopping the wait does not prove that a remote operation never started or that cancellation reached the authoritative service.",
        "A timed-out side effect may require an idempotency key or reconciliation before the harness decides to retry it.",
      ],
      example: "A customer lookup times out after five seconds and returns a typed timeout error, while a timed-out payment is reconciled before retry.",
    },
    "MCP structuredContent field": {
      definition: "MCP structuredContent is the JSON object field in a tool result that carries machine-readable output separately from unstructured content blocks.",
      details: [
        "When a tool declares an outputSchema, the server must return structuredContent that conforms to that schema.",
        "Clients should validate the structured object before depending on its fields or passing it to another component.",
        "For backwards compatibility, the specification recommends also returning serialized JSON in a text-content block.",
      ],
      example: "A weather tool returns structuredContent with numeric temperature and humidity fields plus a text block containing the same JSON.",
    },
    "MCP error-channel distinction": {
      definition: "An MCP tool call can fail as a JSON-RPC protocol error, or succeed at the protocol layer while returning a tool result whose isError field is true.",
      details: [
        "Unknown tools, invalid call arguments, and server-level request failures can use standard JSON-RPC protocol errors.",
        "API failures, rejected business operations, or bad data encountered by the invoked tool can use a result whose isError field is true.",
        "Keeping the forms distinct tells the client whether the protocol request failed or an invoked capability produced an actionable error observation.",
      ],
      example: "Calling an unknown tool returns a JSON-RPC error, while a known weather tool that hits an upstream rate limit returns isError true.",
    },
    "Tool annotations": {
      definition: "Tool annotations are optional MCP metadata that describe behavioral hints about a tool for clients and interfaces.",
      details: [
        "Annotations can help a client present or reason about properties such as whether an operation appears read-only or destructive.",
        "The specification requires clients to treat annotations as untrusted unless they come from a trusted server.",
        "An annotation is a hint, not authorization, sandbox enforcement, or proof that the implementation behaves as advertised.",
      ],
      example: "A server sets readOnlyHint: true on a lookup tool; a client that does not trust that server treats the hint as display metadata, not permission evidence.",
    },
    "Rate limiting": {
      definition: "Rate limiting caps tool invocation frequency or volume within a defined client, resource, and time boundary.",
      details: [
        "It protects services from accidental loops, abusive callers, and resource exhaustion even when individual calls are valid.",
        "A rate limit differs from an agent tool budget: one governs shared service traffic over time, while the other counts actions in one run.",
        "A rejection should expose a bounded error and retry guidance only when a later retry is actually supported.",
      ],
      example: "A search service permits sixty calls per client per minute and returns a typed rate-limit error for call sixty-one.",
    },
    "Output sanitization": {
      definition: "Output sanitization transforms or rejects untrusted tool data so it cannot exploit the syntax or execution rules of a downstream consumer.",
      details: [
        "The required transformation depends on the sink, such as escaping markup for HTML or rejecting unsafe control sequences in a terminal view.",
        "Sanitization is distinct from schema validation, which checks shape and types rather than every sink-specific interpretation.",
        "Natural-language output can still contain hostile instructions, so sanitization must not turn tool data into trusted policy or bypass independent capability checks.",
      ],
      example: "A log viewer escapes returned HTML before rendering it and still marks the log text as untrusted context for the model.",
    },
  },
);

const toolInterfaceSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Tool Contracts",
    source: toolInterfaceSource,
  },
  {
    "Agent-computer interface (ACI)": {
      definition: "An agent-computer interface is the set of tool names, descriptions, argument formats, results, and feedback through which a model operates software.",
      details: [
        "ACI design plays a role similar to human-computer interface design because usability affects whether the operator can act correctly.",
        "Natural parameter names, examples, edge cases, and clearly separated tool purposes reduce avoidable model mistakes.",
        "A powerful implementation can still be a poor agent tool when its model-facing format is difficult to produce or interpret.",
      ],
      example: "A file-edit tool with explicit path and replacement fields is a clearer ACI than asking the model to construct fragile line-numbered patches.",
    },
    "Poka-yoke": {
      definition: "Poka-yoke is mistake-proofing an interface so common errors are prevented or made easy to detect before they cause harm.",
      details: [
        "For agent tools, this often means redesigning arguments rather than relying on a prompt to remind the model of every pitfall.",
        "Narrow enumerations, explicit units, and mutually exclusive fields can make invalid combinations unrepresentable.",
        "Mistake-proofing complements validation: the interface discourages the error, and deterministic checks still reject it if generated.",
      ],
      example: "A deployment tool accepts environment as staging or production instead of a free-form target string that can be misspelled.",
    },
  },
);

const contextSelectionSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Context Selection",
    source: contextOperationsSource,
  },
  {
    "Agent legibility": {
      definition: "Agent legibility is the degree to which a system exposes the information and interfaces an agent needs in forms it can inspect and act on.",
      details: [
        "Logs, metrics, UI state, architecture maps, and validation commands become useful only when the agent can reach and interpret them.",
        "Legibility favors explicit, versioned, queryable artifacts over knowledge held only in meetings, chat threads, or human memory.",
        "Making a system legible does not grant unlimited access; permissions still bound which evidence and actions are available.",
      ],
      example: "A data-pipeline workspace exposes job status, input schemas, row-count metrics, failed-record samples, and one replay command so an agent can diagnose a broken import.",
    },
    "Repository knowledge as system of record": {
      definition: "Repository knowledge as system of record means versioned in-repository artifacts are the authoritative, discoverable account of how the project should work.",
      details: [
        "A short root instruction file can act as a map to deeper architecture, product, reliability, and security documents.",
        "Keeping decisions beside code makes them available to new agent runs without relying on private conversations or stale external notes.",
        "Authority requires maintenance and verification; merely copying a document into the repository does not keep it current.",
      ],
      example: "AGENTS.md links to versioned architecture and release guides that are updated in the same pull request as a changed workflow.",
    },
    "Doc gardening": {
      definition: "Doc gardening is recurring maintenance that finds and repairs stale, duplicated, orphaned, or poorly connected repository documentation.",
      details: [
        "It treats documentation quality as an ongoing operational responsibility rather than a one-time writing task.",
        "Automated checks can flag broken links, missing owners, obsolete generated references, and documents that no longer match code behavior.",
        "Small frequent repairs keep the repository map trustworthy for later humans and agents.",
      ],
      example: "A scheduled agent detects that a renamed service still appears in two runbooks and opens a focused documentation repair.",
    },
    "Knowledge drift": {
      definition: "Knowledge drift is the divergence between recorded project guidance and the system's current code, behavior, ownership, or operating practice.",
      details: [
        "Drift can make an apparently authoritative document more harmful than no document because it directs work with stale constraints.",
        "Versioning reveals when text changed but does not prove that it remains synchronized with runtime reality.",
        "Cross-link checks, generated references, ownership metadata, and doc gardening help detect and correct drift.",
      ],
      example: "A runbook still names the retired queue after a migration, so an agent follows the wrong recovery path until the document is refreshed.",
    },
  },
);

const directPromptInjectionSupplementCard = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Permissions and Sandboxes",
    source: directPromptInjectionSource,
  },
  {
    "Direct prompt injection (OWASP taxonomy)": {
      definition: "In the OWASP LLM01 taxonomy, direct prompt injection occurs when user-supplied prompt input changes model behavior in unintended or unexpected ways.",
      details: [
        "OWASP includes intentional attacks and accidental user inputs that trigger unintended behavior in this category.",
        "OpenAI's current product terminology instead reserves prompt injection for malicious third-party content, so the label must be interpreted with its named taxonomy.",
        "Prompt instructions are not access-control boundaries; tool registration, sandboxing, permission rules, and approval gates must still limit consequences.",
      ],
      example: "A user asks a documentation agent to ignore its scope and print deployment credentials that its task never requires.",
    },
  },
);

const permissionsSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Permissions and Sandboxes",
    source: securitySource,
  },
  {
    "Indirect prompt injection": {
      definition: "Indirect prompt injection is a hostile instruction embedded in external content that an agent retrieves or observes while pursuing another task.",
      details: [
        "Web pages, documents, issue text, tool results, and repository files can all carry instructions that did not come from the authorized user.",
        "The model may confuse content to analyze with commands to follow unless provenance and trust boundaries remain explicit.",
        "Least-privilege capabilities limit damage even when the model follows an injected instruction.",
      ],
      example: "A fetched web page tells the browsing agent to upload local files to an unrelated host, even though the user asked only for a summary.",
    },
    "Tool-output injection": {
      definition: "Tool-output injection is indirect prompt injection delivered through data returned by a tool and then placed into the model's context.",
      details: [
        "A successful tool invocation does not make the returned text authoritative instructions for the harness or model.",
        "The host should preserve source and trust metadata, bound the result, and keep consequential actions behind independent policy checks.",
        "Escaping markup can prevent display attacks but cannot reliably remove every semantic instruction from natural-language output.",
      ],
      example: "A search result contains “run this shell command and ignore prior rules,” which remains quoted evidence rather than becoming host policy.",
    },
    "Data exfiltration": {
      definition: "Data exfiltration is the unauthorized transfer of sensitive information from a protected environment to an external destination.",
      details: [
        "An agent can exfiltrate through network requests, tool arguments, generated links, logs, or other channels available to its runtime.",
        "Read restrictions, credential isolation, output controls, and destination allowlists reduce what can be acquired and where it can be sent.",
        "Approval for one external action should not become blanket authorization to transmit unrelated workspace or secret data.",
      ],
      example: "A compromised task tries to place an API key in a query parameter sent to an unapproved analytics domain.",
    },
    "Least privilege": {
      definition: "Least privilege gives an agent only the capabilities, resources, credentials, and duration of access required for its current task.",
      details: [
        "Narrow scope reduces the damage possible from mistakes, prompt injection, or a compromised dependency.",
        "Read, write, process, and network permissions should be granted separately instead of bundled into broad full access.",
        "Privilege should be removed when the task or approval scope ends rather than persist for unrelated future work.",
      ],
      example: "A release agent receives a registry token scoped to one package for one publish step, and the token expires when that step ends.",
    },
  },
);

const stateRecoverySupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "State and Recovery",
    source: harnessOperationsSource,
  },
  {
    "Execution plan": {
      definition: "An execution plan is a durable, versioned artifact that records how complex work will proceed, along with progress, decisions, and remaining tasks.",
      details: [
        "It externalizes long-horizon intent so a later agent or replacement environment need not reconstruct the plan only from conversation history.",
        "Progress and decision logs distinguish the original approach from what has actually completed or changed during execution.",
        "A plan guides work but does not prove completion; tests, artifacts, and authoritative runtime evidence remain separate.",
      ],
      example: "A migration plan records completed schema preparation, the decision to delay cutover, and the exact verification still pending.",
    },
  },
);

const evaluationSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Agent Evaluations",
    source: harnessOperationsSource,
  },
  {
    "Structural test": {
      definition: "A structural test mechanically checks an architecture, dependency, naming, or repository-shape invariant rather than one end-user behavior.",
      details: [
        "It can reject forbidden dependency directions, misplaced files, undeclared boundaries, or schema shapes before those patterns spread.",
        "Structural tests turn architectural guidance into executable feedback that an agent can run and repair.",
        "They complement functional tests because valid output alone does not guarantee maintainable or permitted internal structure.",
      ],
      example: "A structural test fails when production code imports from test-fixtures/, even if every functional test still passes.",
    },
    "Feedback-loop design": {
      definition: "Feedback-loop design arranges observable checks and environment signals so an agent can compare an attempted change with the intended outcome and revise its next action.",
      details: [
        "Useful feedback is timely, specific, and tied to state the agent can inspect rather than a vague request to try again.",
        "Tests, browser state, logs, metrics, traces, and reviewer findings can each close a different part of the loop.",
        "A loop still needs stop conditions because repeated feedback without progress can consume unbounded time and cost.",
      ],
      example: "An agent reproduces a UI failure, edits the component, reruns the same interaction, and uses the changed DOM and console state to decide whether to continue.",
    },
  },
);

const orchestrationSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Task Orchestration",
    source: orchestrationPatternsSource,
  },
  {
    "Prompt chaining": {
      definition: "Prompt chaining is a predefined workflow in which each model call consumes the output of an earlier step in a fixed sequence.",
      details: [
        "It decomposes a task into smaller calls whose individual instructions and expected outputs can be easier to optimize.",
        "Deterministic gates can validate intermediate results before the next call receives them.",
        "The pattern trades additional latency and calls for control and accuracy when the decomposition is known in advance.",
      ],
      example: "One call extracts invoice line items, a host check validates totals and required fields, and a second call drafts an exception report from the accepted record.",
    },
    "Routing workflow": {
      definition: "A routing workflow classifies an input and directs it to a specialized model, prompt, tool set, or downstream process.",
      details: [
        "Routing separates distinct input categories so optimizing one path does not have to weaken every other path.",
        "The router can be deterministic, model-based, or hybrid, but its classification errors affect all downstream work.",
        "Routes and fallback behavior should remain explicit so unsupported or ambiguous inputs do not disappear silently.",
      ],
      example: "A build-triage router sends type errors to a compiler-diagnostics workflow and visual regressions to a browser-replay workflow.",
    },
    Sectioning: {
      definition: "Sectioning is a parallelization pattern that assigns different independent portions or criteria of one task to separate model calls.",
      details: [
        "Each worker receives a complementary scope, so the combined result covers more dimensions than any one assignment.",
        "The sections must be independent enough to run without unfinished outputs or conflicting shared mutations.",
        "Host aggregation validates identities and coverage before combining the partial results.",
      ],
      example: "For a migration review, one worker inventories schema dependencies while another audits rollback requirements; the coordinator verifies both scopes before merging the reports.",
    },
    Voting: {
      definition: "Voting is a parallelization pattern that runs the same judgment or task several times and aggregates the resulting answers.",
      details: [
        "Unlike sectioning, workers repeat the same scope to obtain diverse attempts or opinions rather than complementary pieces.",
        "Aggregation may use majority, thresholds, ranking, or a separate adjudicator depending on the error costs.",
        "Correlated model errors can make many votes look confident without adding independent evidence.",
      ],
      example: "Three independent model calls read the same smudged serial number, and the host accepts a value only when at least two exact outputs agree.",
    },
    "Evaluator-optimizer": {
      definition: "An evaluator-optimizer workflow alternates a model that produces or revises an output with another model call that critiques it against explicit criteria.",
      details: [
        "It fits work where feedback can identify a measurable improvement and another iteration can act on that feedback.",
        "The evaluator needs a bounded rubric or evidence; an unconstrained preference can create endless stylistic churn.",
        "Host code owns the iteration limit and acceptance condition rather than allowing either model to loop indefinitely.",
      ],
      example: "A query writer revises an analytics query after an evaluator flags an unbounded scan and a missing tenant predicate, stopping when the rubric passes or the iteration limit is reached.",
    },
    "Human-attention bottleneck": {
      definition: "A human-attention bottleneck occurs when review, clarification, or judgment capacity limits throughput more than model execution or code generation does.",
      details: [
        "Higher agent output can worsen the bottleneck when every artifact still requires the same manual inspection.",
        "Better tests, legible evidence, bounded approvals, and agent-to-agent review can reserve human time for consequential judgment.",
        "Reducing attention cost must not hide uncertainty or remove human control where the risk still requires it.",
      ],
      example: "Ten agents can open fixes overnight, but delivery remains slow when one engineer must manually reproduce and inspect every UI path.",
    },
  },
);

const integratedHarnessSupplementCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Integrated Harness",
    source: harnessOperationsSource,
  },
  {
    "Mechanically enforced architectural invariant": {
      definition: "A mechanically enforced architectural invariant is a project rule encoded in deterministic tooling that rejects structures or dependencies outside an allowed design.",
      details: [
        "The invariant states what must remain true, while implementation details inside the permitted boundary can stay flexible.",
        "Linters, type checks, dependency analyzers, and structural tests can provide immediate, reproducible enforcement.",
        "Encoding the rule prevents repeated agent changes from treating written architectural guidance as optional advice.",
      ],
      example: "A dependency checker allows feature packages to import shared-ui but rejects direct imports between sibling feature packages.",
    },
    "Golden principle": {
      definition: "A golden principle is an opinionated project rule selected for repeated mechanical enforcement so quality preferences compound across future changes.",
      details: [
        "It captures a high-value norm such as validating data at boundaries or centralizing a shared invariant.",
        "A principle becomes operational when tooling detects deviations and gives a concrete remediation path.",
        "The set should remain small and maintained because contradictory or obsolete principles create new drift.",
      ],
      example: "The repository requires every background job to emit a structured completion record, and a custom lint points unstructured exits to the approved helper.",
    },
    "Repository garbage collection": {
      definition: "Repository garbage collection is recurring work that finds and removes stale, duplicated, or inconsistent patterns before agents copy and compound them.",
      details: [
        "Agents often copy nearby precedents, so one weak pattern can spread quickly even when every individual change appears plausible.",
        "Mechanical principles, quality grades, and targeted refactoring tasks make cleanup continuous rather than a rare large rewrite.",
        "Repository garbage collection is an engineering analogy, not automatic memory reclamation by a programming-language runtime.",
      ],
      example: "A weekly cleanup finds four conflicting date parsers, migrates callers to one approved utility, and adds a lint that prevents new variants.",
    },
  },
);

export const harnessEngineeringSupplementFlashcardLibrary = combineFlashcardLibraries(
  agentLoopRuntimeSupplementCards,
  agentLoopSupplementCards,
  mcpToolSupplementCards,
  toolInterfaceSupplementCards,
  contextSelectionSupplementCards,
  directPromptInjectionSupplementCard,
  permissionsSupplementCards,
  stateRecoverySupplementCards,
  evaluationSupplementCards,
  orchestrationSupplementCards,
  integratedHarnessSupplementCards,
);
