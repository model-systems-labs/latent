import {
  combineFlashcardLibraries,
  defineFlashcardGroup,
} from "../flashcard-schema";

const agentLoopSource = "Yao et al., ReAct (2023); Anthropic, Building effective agents (2024); OpenAI, Harness engineering (2026).";
const toolContractsSource = "Model Context Protocol contributors, Tools specification (2025); Anthropic, Building effective agents (2024).";
const contextSelectionSource = "OpenAI, Harness engineering (2026); OpenAI, AGENTS.md guide; course-authored Context Selection contracts.";
const permissionsSource = "OpenAI, Agent approvals and security; OpenAI, Sandboxing; MITRE CWE-22 Path Traversal and CWE-367 TOCTOU; course-authored permission contracts.";
const stateRecoverySource = "UK AI Security Institute, Inspect agents and Checkpointing; course-authored State and Recovery contracts and synthetic event logs.";
const evaluationsSource = "Jimenez et al., SWE-bench (2024); Chen et al., HumanEval (2021); Yao et al., tau-bench (2024); UK AI Security Institute, Inspect metrics.";
const orchestrationSource = "Anthropic, Building effective agents (2024); OpenAI, Harness engineering (2026); course-authored orchestration fixtures.";
const integratedHarnessSource = "OpenAI, Harness engineering (2026); Model Context Protocol Tools specification (2025); course-authored integrated harness.";

const agentLoopCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Agent Loop",
    source: agentLoopSource,
  },
  {
    "Agent loop": {
      definition: "An agent loop repeatedly asks a model what to do next, validates any proposed action, executes permitted work, and returns the resulting observation.",
      details: [
        "The model proposes text or structured actions; deterministic host code owns every real side effect.",
        "Each observation gives the next model turn evidence about what actually happened in the environment.",
        "The loop needs explicit terminal states and budgets so repetition or malformed output cannot continue forever.",
      ],
      example: "A coding agent reads a failing test, edits one file, reruns the test, and then returns a final answer.",
    },
    Harness: {
      definition: "A harness is the deterministic software around a model that assembles context, exposes tools, enforces policy, records state, and controls termination.",
      details: [
        "It converts probabilistic model output into a small set of validated host transitions.",
        "Its responsibilities include permissions, budgets, tool dispatch, observations, persistence, and audit records.",
        "The same model can behave very differently when the surrounding harness provides clearer tools and feedback.",
      ],
      example: "The harness rejects an unknown write tool even when the model returns a syntactically valid request for it.",
    },
    "Model response": {
      definition: "A model response is the structured or textual output of one inference step, not proof that any requested action has already occurred.",
      details: [
        "A response may represent final text, a proposed tool call, or an invalid protocol shape.",
        "Host code must parse the response before deciding which transition, if any, is legal.",
        "Treating response text as an executed action confuses a proposal with an environment state change.",
      ],
      example: "The JSON object naming read_file is only a proposal until the host validates its arguments and dispatches the tool.",
    },
    "Tool call": {
      definition: "A tool call is a model-produced request naming an available capability and supplying structured arguments for the host to consider executing.",
      details: [
        "The request must conform to both the conversation protocol and the selected tool's input contract.",
        "A valid shape does not imply authorization; policy checks still happen before dispatch.",
        "The call should carry a stable identifier so its eventual result can be paired unambiguously.",
      ],
      example: "A call named read_file with path app.py is validated, permitted, executed, and paired with one returned observation.",
    },
    Observation: {
      definition: "An observation is a host-recorded result of an action that becomes evidence for the model's next decision in an agent loop.",
      details: [
        "Observations may contain successful output, structured errors, or a bounded summary of a larger result.",
        "They should describe what the environment returned rather than what the model expected to happen.",
        "Protocol metadata such as role and call identifier must survive any later compaction.",
      ],
      example: "After run_tests finishes, the harness records two failing test names and their error messages as the next observation.",
    },
    "Stop condition": {
      definition: "A stop condition is an explicit host-recognized state that ends or pauses an agent run instead of asking the model for another turn.",
      details: [
        "A valid final response is one normal stop condition, but errors and exhausted limits are also terminal outcomes.",
        "A required approval can create a paused state without pretending the task completed or failed.",
        "Stop logic belongs in deterministic code because a model cannot be trusted to police its own repetition.",
      ],
      example: "The run stops with status turn_limit after the eighth model response even if the model proposes a ninth tool call.",
    },
    "Turn budget": {
      definition: "A turn budget caps how many model responses an agent run may request before the harness must stop with a limit outcome.",
      details: [
        "It bounds inference cost and prevents an unproductive response-action cycle from running indefinitely.",
        "The harness increments the counter, so a model cannot reset or ignore the remaining allowance.",
        "A limit outcome should remain distinguishable from successful completion and from an execution error.",
      ],
      example: "With a four-turn budget, three tool-seeking responses leave only one chance to produce a useful final response.",
    },
    "Tool budget": {
      definition: "A tool budget caps the number of host actions an agent may dispatch during a run, independently of the number of model turns.",
      details: [
        "Separate budgets matter because one model response can propose an action while another may return final text.",
        "The limit can contain expense, latency, or risk for capabilities such as web search or code execution.",
        "The counter should advance only according to a documented rule, such as immediately before successful dispatch.",
      ],
      example: "A research run with five allowed searches refuses the sixth search call and records tool_limit as its terminal status.",
    },
    "Call identifier": {
      definition: "A call identifier is a stable value that connects one requested tool action to exactly one corresponding tool result in message history.",
      details: [
        "It prevents concurrent or repeated calls to the same tool from having their observations confused.",
        "Duplicate identifiers make pairing ambiguous and should be rejected before another transition occurs.",
        "Compaction must preserve the identifier even when the tool output itself is shortened.",
      ],
      example: "Results tagged c17 and c18 can be paired with two read_file calls even when both calls target different files.",
    },
    "Unresolved tool call": {
      definition: "An unresolved tool call is a recorded assistant request that does not yet have its one matching tool-result observation in the run history.",
      details: [
        "The harness should not silently treat a pending request as though its side effect succeeded.",
        "Appending a second result to an already resolved call violates the one-call-one-result protocol.",
        "Recovery logic uses unresolved calls to decide whether to resume, reconcile, or wait for approval.",
      ],
      example: "A write request recorded before a process crash stays unresolved until a receipt proves completion or reconciliation reruns it safely.",
    },
    "Immutable message history": {
      definition: "Immutable message history means each agent transition creates a new history value rather than modifying previously recorded messages in place.",
      details: [
        "Old states remain inspectable, which makes protocol bugs and replay behavior easier to reason about.",
        "Copying before appending prevents a helper from unexpectedly changing state held by another part of the program.",
        "Immutability does not make history durable; persistence is a separate storage concern.",
      ],
      example: "Appending the result for c1 returns a two-message list while the original one-message list remains unchanged for comparison.",
    },
    "ReAct loop": {
      definition: "A ReAct loop interleaves model reasoning and externally grounded actions so later reasoning can incorporate observations returned by the environment.",
      details: [
        "The pattern links internal planning with evidence-gathering actions instead of relying only on a fixed initial prompt.",
        "An action by itself has no value unless the resulting observation reaches a later decision step.",
        "Production harnesses still need schemas, permissions, limits, and recovery beyond the high-level loop pattern.",
      ],
      example: "The model decides to inspect a configuration file, reads the returned contents, and revises its diagnosis before answering.",
    },
    "Final response": {
      definition: "A final response is non-empty model text that asks the harness to end the normal response-action cycle without dispatching another tool.",
      details: [
        "It is a protocol form, not independent evidence that claimed external work actually succeeded.",
        "The host can still reject empty or structurally ambiguous final output before recording termination.",
        "A final response should remain distinct from errors, budget exhaustion, and approval pauses in run state.",
      ],
      example: "After the verification command passes, the model returns a concise completion note and the harness records final as the stop reason.",
    },
    "Response-form invariant": {
      definition: "A response-form invariant is a host-enforced rule about which protocol fields may coexist in one model response before it can become an action.",
      details: [
        "This course deliberately accepts exactly one final field or one tool_call field in its teaching protocol.",
        "Other agent protocols may support several tool calls in one response, so the rule is not universal.",
        "Making the invariant explicit prevents ambiguous output from falling through to accidental dispatch.",
      ],
      example: "A teaching-protocol response containing both final text and tool_call fails validation instead of choosing one field arbitrarily.",
    },
    "Call-result pairing": {
      definition: "Call-result pairing is the one-to-one protocol relationship between a recorded tool request and the observation produced for that request.",
      details: [
        "Every result must name one earlier matching call identifier to preserve the trace's causal structure.",
        "A second result for an already resolved call is rejected rather than silently replacing the first.",
        "Auditors and recovery code rely on pairing to distinguish completed work from pending actions.",
      ],
      example: "The observation tagged c4 resolves only the earlier c4 search request, while the separate c5 request remains pending.",
    },
  },
);

const toolContractCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Tool Contracts",
    source: toolContractsSource,
  },
  {
    "Tool contract": {
      definition: "A tool contract is the model-facing agreement that names an action, explains its purpose, defines valid inputs, and describes the result shape.",
      details: [
        "Clear contracts let a probabilistic model request narrow deterministic operations without learning an internal API.",
        "The runtime validates every request against the contract before invoking implementation code.",
        "Result limits and error shapes belong to the contract as much as required input fields do.",
      ],
      example: "A search_files contract requires query text, permits an optional path, and returns bounded matches plus a continuation cursor.",
    },
    "Model-facing action space": {
      definition: "The model-facing action space is the complete set of tool choices and argument patterns presented to the model for a decision step.",
      details: [
        "Every extra or overlapping tool adds selection complexity and consumes context with another schema.",
        "Task-level capabilities are usually easier to choose correctly than a mirror of every internal endpoint.",
        "A smaller action space can improve reliability without reducing the host application's internal functionality.",
      ],
      example: "One find_customer tool is clearer to the model than six similar database endpoints with subtly different lookup rules.",
    },
    "Tool input schema": {
      definition: "A tool input schema describes the allowed structure, field names, types, and constraints of the arguments accepted by a tool call.",
      details: [
        "MCP represents a tool's input schema with JSON Schema at the protocol boundary.",
        "Schemas help the model form requests, but deterministic validation is still required after generation.",
        "Narrow types and explicit boundaries prevent implementation assumptions from becoming hidden parts of the interface.",
      ],
      example: "The read_file schema requires a string path and rejects a numeric path before any filesystem code receives the request.",
    },
    "JSON Schema validation": {
      definition: "JSON Schema validation checks generated JSON against declared structural and value constraints before the data crosses into tool implementation code.",
      details: [
        "It can enforce object shape, property types, required fields, enumerations, and additional-property rules.",
        "Schema validity is not an authorization decision and does not prove that a target path or URL is permitted.",
        "Validation errors should become bounded observations the model can interpret and correct.",
      ],
      example: "A limit value of minus three fails the declared minimum of one, so the search tool is never dispatched.",
    },
    "Required argument": {
      definition: "A required argument is an input field that must be present for a tool request to satisfy its declared contract.",
      details: [
        "Requiredness is distinct from type checking because a correctly typed value cannot help when the field is absent.",
        "The validator should report the missing field before implementation code tries to read it.",
        "Only information genuinely needed for every invocation should be required, keeping calls concise.",
      ],
      example: "A file-reading tool rejects an empty argument object because its path field is required for every invocation.",
    },
    "Optional argument": {
      definition: "An optional argument is a contract field that may be omitted, with the tool applying documented default behavior when it is absent.",
      details: [
        "Optional fields reduce unnecessary model output when a safe and unsurprising default exists.",
        "Omitted, null, and empty values can mean different things and should not be conflated accidentally.",
        "Defaults should be applied by deterministic host code rather than left for the model to remember.",
      ],
      example: "A search call without limit uses the contract's default page size of twenty instead of returning an unbounded result.",
    },
    "Unknown-field rejection": {
      definition: "Unknown-field rejection fails a tool request when it contains argument names that are not declared by the input contract.",
      details: [
        "Failing closed catches misspellings that would otherwise look like successfully accepted preferences.",
        "It stops hidden implementation options from being guessed and passed through by the model.",
        "A clear error can list the unexpected field without echoing sensitive argument values.",
      ],
      example: "The validator rejects maxResults when the contract declares max_results, prompting the model to correct the field name.",
    },
    "Trust boundary": {
      definition: "A trust boundary is the point where data from a less trusted component must be checked before a more privileged component acts on it.",
      details: [
        "Model-generated arguments cross a trust boundary when they enter deterministic host or tool code.",
        "Parsing, schema validation, permission checks, and resource limits serve different parts of that boundary.",
        "A trusted transport does not make generated content trustworthy for execution.",
      ],
      example: "Before a model-supplied command reaches a process launcher, the host checks its schema, capability rule, and approval state.",
    },
    "Tool dispatch": {
      definition: "Tool dispatch is the host-controlled step that maps a validated, permitted tool name to its implementation and invokes it with normalized arguments.",
      details: [
        "Dispatch happens only after protocol, schema, policy, approval, and budget checks succeed.",
        "The mapping should be explicit so an arbitrary generated name cannot select an unintended function.",
        "Thrown errors should be converted into a stable result shape rather than corrupting the agent loop.",
      ],
      example: "The dispatcher maps list_files to one registered function and returns an unknown_tool error for every other generated name.",
    },
    "Bounded tool result": {
      definition: "A bounded tool result limits the size and shape of an observation so one tool response cannot consume the remaining context or overwhelm the client.",
      details: [
        "Bounds may constrain item count, character count, nesting depth, runtime, or total serialized bytes.",
        "Truncation must be visible so the model does not mistake a partial result for the entire dataset.",
        "Pagination or a follow-up query lets the agent retrieve more evidence deliberately when needed.",
      ],
      example: "A log tool returns the first fifty matching lines, marks the result truncated, and provides a cursor for the next page.",
    },
    "Result pagination": {
      definition: "Result pagination divides a potentially large tool response into deterministic pages that can be requested separately with position metadata.",
      details: [
        "A page limit bounds context use while an offset or cursor identifies where retrieval should continue.",
        "Stable ordering is necessary or items may move between pages and be duplicated or skipped.",
        "The result should signal whether another page exists instead of making the model infer it from page length.",
      ],
      example: "The first page returns items zero through nineteen and next_offset 20, which the next call uses to continue.",
    },
    "Structured tool result": {
      definition: "A structured tool result returns machine-readable fields with defined meanings instead of forcing the model or interface to parse an informal text blob.",
      details: [
        "Structured content can carry records, status, pagination metadata, and typed error information consistently.",
        "Human-readable text may accompany the structure, but consumers should not depend on prose formatting.",
        "The host still validates or normalizes implementation output before adding it to protocol history.",
      ],
      example: "A customer lookup returns status, customer, and next_steps fields rather than one sentence containing all three values.",
    },
    "Tool definition": {
      definition: "A tool definition is the metadata presented before a call that gives a capability its unique name, human-readable purpose, and accepted input shape.",
      details: [
        "The name acts as protocol identity while the description helps the model decide when the tool is appropriate.",
        "In MCP, inputSchema carries the JSON Schema used to describe expected call arguments.",
        "Definitions expose a model-facing contract without revealing every internal implementation detail.",
      ],
      example: "A get_weather definition explains that it retrieves current conditions and requires one location string before any call occurs.",
    },
    "Tool discovery": {
      definition: "Tool discovery is the protocol step in which a client obtains the current set of tool definitions offered by a server or host.",
      details: [
        "Discovery lets the client construct an accurate action space rather than assume capabilities exist.",
        "MCP exposes tools/list and allows a server to indicate when its list of available tools changes.",
        "A discovered capability is still subject to local trust, permission, and approval controls.",
      ],
      example: "A client lists the server's tools, finds get_weather, and only then includes that definition in the model's next request.",
    },
    "Tool output schema": {
      definition: "A tool output schema is an optional machine-readable contract describing the fields and types in a tool's structured result.",
      details: [
        "It lets clients validate structured output instead of depending on an implementation's informal prose format.",
        "When a server declares an MCP outputSchema, its structuredContent is expected to conform to that schema.",
        "An output schema describes result shape; it does not prove the underlying information is correct or safe.",
      ],
      example: "A weather output schema declares numeric temperature and humidity fields, allowing the client to reject a malformed string value.",
    },
  },
);

const contextSelectionCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Context Selection",
    source: contextSelectionSource,
  },
  {
    "Agent context": {
      definition: "Agent context is the complete inference input assembled for one model call, including instructions, task data, tool definitions, history, and observations.",
      details: [
        "Prompt wording is only one component of the information the model receives for a turn.",
        "Host code decides which eligible items enter and rebuilds that selection as the run changes.",
        "Context should contain enough protocol history to make the next transition coherent and auditable.",
      ],
      example: "A debugging turn includes repository rules, the current failing assertion, two tool schemas, and the latest file contents.",
    },
    "Context selection": {
      definition: "Context selection is the host process that chooses which available information enters a finite model context for the next decision.",
      details: [
        "It differs from accumulation because stale or low-value material can be omitted deliberately.",
        "Required protocol information is handled separately from optional evidence competing for remaining capacity.",
        "Selection policy should be deterministic enough to test, inspect, and refine from observed failures.",
      ],
      example: "The selector keeps current test output and the file under edit while omitting a superseded build log from yesterday.",
    },
    "Context token budget": {
      definition: "A context token budget is the maximum estimated model-input capacity allocated to a collection of candidate context items.",
      details: [
        "Every selected instruction, schema, message, file excerpt, and observation consumes part of the allowance.",
        "The course selector uses supplied estimates for teaching; production systems normally use model-aware token counting.",
        "A budget enforces scarcity but does not itself determine which information is most valuable.",
      ],
      example: "A 120-token teaching budget exactly fits three candidates estimated at forty, thirty, and fifty tokens.",
    },
    "Required context": {
      definition: "Required context is information a particular host policy declares non-droppable for one model call, such as protocol state or safety instructions.",
      details: [
        "The course selector admits declared required identifiers before considering optional evidence.",
        "If required items exceed its budget, it reports overflow instead of silently deleting a rule.",
        "Real instruction-discovery systems can impose their own size limits, so requiredness is policy-scoped rather than universal.",
      ],
      example: "The teaching selector keeps the tool-result call IDs and active permission rule even when a lengthy old log no longer fits.",
    },
    "Optional evidence": {
      definition: "Optional evidence is context that may improve the next decision but can be excluded when a more relevant or better-fitting item needs the capacity.",
      details: [
        "Optional does not mean useless; its expected value depends on the current task and environment state.",
        "Items can be ranked after required material and admitted only when each fits the remaining budget.",
        "Skipping one oversized candidate should not automatically prevent a smaller useful candidate from being selected.",
      ],
      example: "An old architecture note is omitted so the current error stack and a short interface definition can both fit.",
    },
    "Current evidence": {
      definition: "Current evidence is environment information that still describes the state relevant to the model's next decision rather than a superseded state.",
      details: [
        "Recent failing tests often matter more than earlier passing output after the implementation changes.",
        "Currentness is semantic: a stable specification can remain useful longer than a newer but irrelevant message.",
        "Tool observations should be invalidated or refreshed when their underlying files, services, or assumptions change.",
      ],
      example: "A failure from the post-edit test run outranks the passing result captured before the edited function existed.",
    },
    "Stale observation": {
      definition: "A stale observation is a previously valid tool result that no longer reliably describes the environment state used for the next decision.",
      details: [
        "File edits, new deployments, elapsed time, or external updates can invalidate an earlier result.",
        "Stale evidence can actively mislead the model rather than merely consume extra tokens.",
        "The harness can omit, label, or refresh it instead of presenting it as current ground truth.",
      ],
      example: "A cached route list becomes stale after a new page is added, so the agent re-runs route discovery before auditing navigation.",
    },
    "Context priority": {
      definition: "Context priority is a deterministic host estimate of how useful one candidate item is for the model's immediate next decision.",
      details: [
        "Priority is a selection heuristic rather than a probability that the information is correct.",
        "Requiredness remains separate because a mandatory item cannot be displaced merely by a higher score.",
        "Stable tie-breaking makes equal-priority selections reproducible across runs and tests.",
      ],
      example: "The active stack trace receives priority nine while an old exploratory note receives priority two for the same debugging turn.",
    },
    "Fit-aware greedy selection": {
      definition: "Fit-aware greedy selection scans optional candidates by priority, admits each item that fits, and continues past items too large for the remaining budget.",
      details: [
        "The course uses this simple deterministic policy rather than claiming a globally optimal knapsack solution.",
        "Continuing after an oversized item allows smaller lower-priority evidence to use otherwise stranded capacity.",
        "Its output depends on token estimates, priority ordering, and the stable tie rule.",
      ],
      example: "With two tokens left, the selector skips an eight-token log and admits a two-token status flag later in the ranking.",
    },
    "Context dilution": {
      definition: "Context dilution is reduced decision reliability when irrelevant or stale material crowds out, distracts from, or contradicts the evidence needed now.",
      details: [
        "Dilution can hurt before a hard model context limit is reached because attention is still finite.",
        "Adding more tokens is not automatically helpful when they make the decisive information harder to identify.",
        "Selection and progressive disclosure counter dilution by matching evidence to the current decision.",
      ],
      example: "Thousands of obsolete log lines obscure the one current stack trace that identifies the actual failing module.",
    },
    "Progressive disclosure": {
      definition: "Progressive disclosure starts with a small stable map and retrieves deeper instructions or evidence only when the current task makes them relevant.",
      details: [
        "It preserves discoverability without loading an entire repository handbook into every model request.",
        "Links, indexes, and scoped instruction files can point the agent toward detail on demand.",
        "The host still needs a reliable rule for deciding when referenced material should be fetched.",
      ],
      example: "A short root AGENTS.md links to a detailed release guide that is loaded only when the task involves a deployment.",
    },
    "Scoped repository instruction": {
      definition: "A scoped repository instruction is guidance whose applicability follows its location and precedence within a repository's instruction-file hierarchy.",
      details: [
        "Broader root guidance can be specialized by instruction files closer to the active working directory.",
        "Codex combines at most one recognized instruction file per directory until its configured documentation byte limit.",
        "Selection must preserve the relevant scope instead of treating every repository rule as globally interchangeable.",
      ],
      example: "A payments-directory instruction adds stricter verification steps when work starts below services/payments without affecting an unrelated UI task.",
    },
    "Context compaction": {
      definition: "Context compaction replaces older or oversized context payloads with shorter explicit representations while preserving facts needed for later protocol decisions.",
      details: [
        "It is not silent deletion: the shortened record should indicate that some original content was omitted.",
        "Roles, ordering, call identifiers, durable decisions, and unresolved work must survive the transformation.",
        "Prefix previews are one course teaching policy, not a substitute for semantic summaries in every system.",
      ],
      example: "An old ten-thousand-character log becomes a labeled error summary while its tool role and call identifier stay intact.",
    },
    "Recent-result reservation": {
      definition: "Recent-result reservation is a compaction policy that keeps a chosen number of newest tool observations exact while older eligible results may be shortened.",
      details: [
        "The course's keep_recent count applies to tool-result messages rather than every message in history.",
        "Reserving recent output reflects its likely value without proving that every newest item is relevant.",
        "A value of zero makes all oversized results eligible, while a negative reservation is invalid.",
      ],
      example: "With keep_recent set to one, the newest c3 test result stays complete while older c1 and c2 logs receive previews.",
    },
    "Protocol identity under compaction": {
      definition: "Protocol identity under compaction is the stable message metadata that lets shortened history retain the same call relationships and run meaning.",
      details: [
        "The message role, call identifier, ordering, and resolved or unresolved status cannot be inferred from a text preview alone.",
        "Changing an identifier during shortening would create an orphan result or attach evidence to the wrong action.",
        "A compaction marker distinguishes the bounded representation from the complete original observation.",
      ],
      example: "A compacted c8 result still carries role tool and call_id c8, so the earlier c8 request remains correctly resolved.",
    },
  },
);

const permissionsCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Permissions and Sandboxes",
    source: permissionsSource,
  },
  {
    Sandbox: {
      definition: "A sandbox is an operating-system or runtime-enforced environment that restricts which files, processes, and network resources agent-run code can reach.",
      details: [
        "It limits technical capability even when a model misunderstands or ignores an instruction.",
        "Sandbox boundaries should expose only the resources needed for the current task and workflow.",
        "A sandbox is distinct from an approval policy, which decides when execution must pause and ask.",
      ],
      example: "A workspace-write run can edit the checked-out project but cannot read the user's keychain or arbitrary home-directory files.",
    },
    "Approval policy": {
      definition: "An approval policy is a host-owned rule that decides when a proposed action must pause for authorization before any side effect is dispatched.",
      details: [
        "It controls when to ask, while the sandbox controls what execution can technically reach.",
        "Approval should identify the exact pending call and consequence rather than request vague blanket permission.",
        "A granted approval does not automatically widen an unchanged operating-system sandbox boundary.",
      ],
      example: "The harness pauses before a network-enabled package install and resumes that exact call only after the user approves it.",
    },
    "Permission rule": {
      definition: "A permission rule is a deterministic mapping from an action kind and target boundary to a decision such as allow, confirm, or deny.",
      details: [
        "Rules are evaluated by host code rather than interpreted probabilistically from the model conversation.",
        "The action category and normalized target both matter because read and write access can differ.",
        "A stable rule identifier makes the policy decision visible in logs and approval interfaces.",
      ],
      example: "Rule deny-secrets rejects reads under /workspace/.env even though a broader rule allows ordinary workspace reads.",
    },
    "Default-deny policy": {
      definition: "A default-deny policy rejects a proposed action when no explicit permission rule authorizes or confirmation-gates that action and target.",
      details: [
        "The absence of a matching rule is treated as no permission rather than an accidental allow.",
        "New tools and resource types remain closed until the host deliberately defines their boundaries.",
        "The denial record can omit a rule identifier while still explaining that no policy rule matched.",
      ],
      example: "An outbound request is denied when the configured policy contains file rules but no rule for network actions.",
    },
    "Lexical path normalization": {
      definition: "Lexical path normalization simplifies dot segments in a pathname string before policy comparison without consulting the actual filesystem.",
      details: [
        "It resolves ordinary current-directory and parent-directory components into a normalized spelling.",
        "Normalization must happen before containment checks or a traversal string can disguise its target.",
        "It cannot by itself account for symbolic links, mount points, or a filesystem changed between check and use.",
      ],
      example: "/workspace/src/../tests/a.py normalizes lexically to /workspace/tests/a.py before the rule engine compares boundaries.",
    },
    "Path traversal": {
      definition: "Path traversal is an attempt to use pathname structure, often parent segments or absolute paths, to reach beyond an intended directory boundary.",
      details: [
        "A relative-path contract should reject absolute requests before joining them to a host-owned root.",
        "Normalization reveals ordinary parent-segment escapes but remains only one layer of enforcement.",
        "Containment comparisons must respect path components rather than accept a shared string prefix.",
      ],
      example: "From workspace root /project, the request ../../etc/passwd is rejected after normalization shows that it leaves the allowed tree.",
    },
    "Dot segment": {
      definition: "A dot segment is a pathname component named . or .. that denotes the current or parent lexical location during path resolution.",
      details: [
        "A single dot normally leaves the current lexical location unchanged.",
        "A double dot removes a preceding segment and can move a request outside its intended root.",
        "The segment's effect must be resolved before target-prefix policy rules are evaluated.",
      ],
      example: "The request src/../.env reaches .env at the workspace root rather than a file inside the src directory.",
    },
    "Path containment": {
      definition: "Path containment is the requirement that a requested resource resolve at or beneath a host-owned root instead of merely sharing its text prefix.",
      details: [
        "Component-aware comparison distinguishes /workspace/file from the unrelated path /workspace-old/file.",
        "Lexical containment catches ordinary traversal but is weaker than secure real-filesystem resolution.",
        "Kernel sandboxing or descriptor-relative access should enforce the boundary when hostile path changes are possible.",
      ],
      example: "/workspace/app.py is contained by /workspace, while /workspace-copy/secret is rejected despite starting with similar letters.",
    },
    "Symlink escape": {
      definition: "A symlink escape occurs when a path that appears lexically inside an allowed tree follows a symbolic link to a resource outside that tree.",
      details: [
        "String normalization does not resolve the link target and therefore cannot prevent this escape alone.",
        "An attacker may also replace a path component with a link between a separate check and open operation.",
        "Secure host access can forbid link traversal or constrain resolution beneath an already-open directory.",
      ],
      example: "/workspace/outside/passwords escapes if outside is a symbolic link pointing to /etc rather than a real workspace folder.",
    },
    "TOCTOU race": {
      definition: "A time-of-check/time-of-use race occurs when a resource changes after authorization is checked but before the permitted operation actually uses it.",
      details: [
        "Path checking and path opening are separate operations unless the host uses an atomic constrained-resolution mechanism.",
        "A safe-looking file component can be swapped for a symlink during the gap between those operations.",
        "Descriptor-relative or kernel-enforced access reduces reliance on vulnerable check-then-use sequences.",
      ],
      example: "A process validates report.txt, an attacker replaces it with a secret-link, and a later ordinary open follows the changed target.",
    },
    "Capability boundary": {
      definition: "A capability boundary limits the concrete operations and resources made available to an agent independently of what its prompt requests.",
      details: [
        "Tool registration, sandbox configuration, credential scoping, and network controls all shape actual capability.",
        "Instructions can guide selection among capabilities but must not be treated as enforcement.",
        "The narrowest practical boundary reduces the damage possible from mistakes or prompt injection.",
      ],
      example: "A documentation agent receives read-only repository access and no deployment credentials because publishing is outside its task.",
    },
    "Policy precedence": {
      definition: "Policy precedence is the deterministic ordering used to choose a decision when several permission rules match one proposed action and target.",
      details: [
        "The course policy ranks deny above confirm and confirm above allow so a broad allowance cannot erase a safety gate.",
        "That ordering is a deliberate course design rather than a universal rule of MCP or every sandbox.",
        "Specificity and stable rule order can break ties only after the decision precedence is applied.",
      ],
      example: "A secret-specific deny wins over both a repository-wide allow and a confirmation rule that also match the requested read.",
    },
    "Approval gate": {
      definition: "An approval gate is a pre-dispatch host state that records a consequential pending call and waits for explicit authorization to continue it.",
      details: [
        "No tool side effect should occur while the action remains in the approval-pending state.",
        "The stored call identifier prevents approval for one action from being reused accidentally for another.",
        "Denial and approval lead to different recorded transitions, both of which remain auditable.",
      ],
      example: "A production restart call pauses with identifier c12 and zero dispatches until the operator confirms that exact restart.",
    },
    "Network isolation": {
      definition: "Network isolation blocks or constrains outbound connections from agent-run processes so untrusted code cannot reach arbitrary external destinations.",
      details: [
        "A domain allowlist can expose only the endpoints required by a task while denying every other destination.",
        "Network access also affects dependency installation, data exfiltration risk, and resistance to remote prompt injection.",
        "A model-generated URL is data to validate, not authority to alter the sandbox's network configuration.",
      ],
      example: "The run can fetch packages from the approved registry but an attempted request to an unlisted host is blocked by policy.",
    },
    "Sandbox mode versus approval policy": {
      definition: "Sandbox mode defines the technical access boundary for execution, while approval policy defines which eligible actions must pause for human authorization.",
      details: [
        "A permissive sandbox can still require confirmation before consequential commands are dispatched.",
        "A restrictive sandbox continues to block inaccessible resources even if a user approves an unrelated action.",
        "Keeping the controls distinct makes failures and escalation requests easier to explain accurately.",
      ],
      example: "A host asks before running a package installer, yet the approved process still cannot access destinations outside its network allowlist.",
    },
  },
);

const stateRecoveryCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "State and Recovery",
    source: stateRecoverySource,
  },
  {
    "Durable run state": {
      definition: "Durable run state is persisted evidence of a run's progress, status, checkpoints, and completed work that survives model calls and disposable execution environments.",
      details: [
        "It lives outside the model context so losing a conversation window does not erase operational truth.",
        "A deterministic reducer can rebuild current state from durable events without rerunning completed actions.",
        "External side effects need their own evidence because local state alone cannot prove what another system did.",
      ],
      example: "After a sandbox expires, a replacement process still knows that call c1 completed and calls c2 and c3 remain pending.",
    },
    "Disposable execution environment": {
      definition: "A disposable execution environment is compute that may be stopped, replaced, or erased without serving as the authority for lasting run progress.",
      details: [
        "Temporary files and process memory can disappear when a sandbox times out or is recreated.",
        "Recovery therefore separates durable state from the environment used to perform the next unit of work.",
        "A fresh environment may need selected files or checkpoints rehydrated before the run can continue safely.",
      ],
      example: "A timed-out container is replaced, while its externally stored event log and checkpoint are used to resume investigation.",
    },
    "Durable event log": {
      definition: "A durable event log is an ordered persisted sequence of identified run events from which host code can reconstruct operational state.",
      details: [
        "Events can record tool completion, checkpoints, failures, and terminal completion as explicit state transitions.",
        "Durable means the records survive process loss; an in-memory array is only the course representation of that design.",
        "Replay rules must define duplicate delivery, unknown event kinds, and events arriving after termination.",
      ],
      example: "Events e1 tool_completed, e2 checkpoint, and e3 failed are stored before the original worker disappears.",
    },
    "Stable event identifier": {
      definition: "A stable event identifier names one logical run event so duplicate delivery can be recognized during replay without applying its local state change twice.",
      details: [
        "It is separate from a tool-call identifier even when an event describes that call's completion.",
        "The identity must be assigned before retry or two deliveries of one event can appear unrelated.",
        "Stable event identity alone does not make an external side effect idempotent.",
      ],
      example: "Two deliveries carrying event ID e17 update the local completion ledger once even if both messages reach the reducer.",
    },
    "Run-state reducer": {
      definition: "A run-state reducer is a deterministic function that folds one validated event into a copied state value according to explicit transition rules.",
      details: [
        "It keeps prior state inspectable instead of mutating the caller's snapshot in place.",
        "Known event kinds have narrow effects, while unknown or post-terminal events should fail closed.",
        "Applying the same sequence from the same initial state must reconstruct the same local run state.",
      ],
      example: "Applying checkpoint event e2 changes the latest checkpoint and seen IDs while leaving the earlier state object unchanged.",
    },
    "Idempotent replay": {
      definition: "Idempotent replay reprocesses durable events so repeated delivery of the same identified event does not duplicate its effect on reconstructed local state.",
      details: [
        "The reducer remembers seen event identifiers and treats an exact redelivery according to a documented no-op rule.",
        "Replay rebuilds a completion ledger but should not redispatch actions already proven complete.",
        "External systems still require idempotency keys, receipts, or reconciliation across crash windows.",
      ],
      example: "Replaying the e4 completion event twice leaves call c2 recorded once in the reconstructed completion ledger.",
    },
    Checkpoint: {
      definition: "A checkpoint is a committed durable snapshot of selected state that helps a fresh process continue an interrupted run from a known boundary.",
      details: [
        "Inspect can restore agent state, selected sandbox paths, store data, and event history from its checkpoints.",
        "Checkpointing between turns does not capture an arbitrary in-flight tool call or reverse an external side effect.",
        "A checkpoint kept only inside the disposable environment cannot support recovery after that environment is lost.",
      ],
      example: "At a turn boundary, the evaluator stores messages, selected workspace files, and sample data before replacing the sandbox.",
    },
    "Resume plan": {
      definition: "A resume plan is a derived record of current status, latest checkpoint, completed calls, and still-pending calls after durable state is replayed.",
      details: [
        "It keeps output in the declared plan order even when completion events arrived in another order.",
        "Pending means not durably completed; it does not prove that an external action never started.",
        "Ambiguous side effects must be reconciled before a pending call is retried blindly.",
      ],
      example: "After c1 is proven complete, the resume plan preserves c1 under completed and returns c2 then c3 under pending.",
    },
    "Completion ledger": {
      definition: "A completion ledger is the durable ordered set of planned call identifiers whose effects have trustworthy recorded completion evidence.",
      details: [
        "It is not inferred from a model's claim that work succeeded or from a missing error message.",
        "Recovery uses the ledger to avoid scheduling already completed units of planned work.",
        "A completion for an identifier outside the declared run plan should be rejected as inconsistent state.",
      ],
      example: "The ledger containing c1 and c3 lets recovery skip those actions while preserving c2 as unfinished.",
    },
    "Terminal run status": {
      definition: "Terminal run status records that one run has completed or failed and therefore cannot accept ordinary new work events in the same state history.",
      details: [
        "The status is assigned by host transition rules rather than by an unverified sentence from the model.",
        "Post-terminal events indicate a malformed history unless a new recovery run is explicitly created.",
        "Failure, successful completion, and paused approval remain distinct states with different recovery meaning.",
      ],
      example: "Once event e9 marks the run completed, a later checkpoint event for that same run is rejected rather than appended.",
    },
    "External side-effect ambiguity": {
      definition: "External side-effect ambiguity is uncertainty about whether another system completed an action when a crash occurs before local durable confirmation is written.",
      details: [
        "A missing completion event cannot prove that the remote action never happened.",
        "Blindly retrying an ambiguous payment, deployment, or message can duplicate a real effect.",
        "Recovery must consult stable request identity, a durable receipt, or authoritative external state.",
      ],
      example: "A payment succeeds remotely, but the harness crashes before writing tool_completed, leaving local state unable to distinguish success from no dispatch.",
    },
    "Idempotency key": {
      definition: "An idempotency key is a stable request identity that a side-effecting service uses to ensure retries of one logical operation take effect at most once.",
      details: [
        "The key must cross the tool boundary and be honored by the authoritative external service.",
        "It may be linked to a call or event identifier, but those local identifiers are not automatically equivalent.",
        "A retry with the same key should return or reference the original outcome instead of repeating the effect.",
      ],
      example: "Retrying a charge with key payment-42 returns the first transaction record instead of charging the customer a second time.",
    },
    "Durable receipt": {
      definition: "A durable receipt is persisted evidence from the authoritative side-effecting system that a particular identified request completed.",
      details: [
        "It survives loss of the harness process and can settle an otherwise ambiguous crash window.",
        "The receipt should carry the stable request identity and enough outcome information for later verification.",
        "A local success message is weaker than a provider-issued transaction or deployment identifier.",
      ],
      example: "The payment provider's transaction ID and idempotency key prove that payment-42 already succeeded after the worker crashed.",
    },
    Reconciliation: {
      definition: "Reconciliation queries authoritative external state and compares it with local run records before recovery decides whether to retry or mark work complete.",
      details: [
        "It handles effects that could not be atomically committed with the harness's own event log.",
        "A successful match can repair a missing local receipt, while no matching effect can return the call to pending.",
        "Reconciliation is slower than assuming an outcome but avoids duplicating consequential work based on a guess.",
      ],
      example: "Before rerunning deployment d7, the harness asks the platform whether d7 already exists and records the returned status.",
    },
    "Completed-pending partition": {
      definition: "A completed-pending partition divides every planned call into exactly one of two sets according to durable completion evidence after replay.",
      details: [
        "Every declared call appears once, and result order follows the plan rather than asynchronous event delivery.",
        "Duplicate completion events do not move a call twice or create another completed entry.",
        "A pending call can be unstarted, in flight, approval-blocked, or externally ambiguous, so more state may be needed.",
      ],
      example: "Plan c1, c2, c3 with durable completions for c2 and c1 yields completed c1, c2 and pending c3.",
    },
  },
);

const evaluationCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Agent Evaluations",
    source: evaluationsSource,
  },
  {
    "Agent evaluation": {
      definition: "An agent evaluation is a structured test of a model-plus-harness system on defined tasks, environments, tools, limits, and observable success criteria.",
      details: [
        "It evaluates the complete execution setup rather than model output in isolation from the harness.",
        "A task can permit many valid action trajectories while holding the final requirements constant.",
        "Repeated trials reveal both whether success is possible and how consistently the system reaches it.",
      ],
      example: "A coding evaluation gives the agent a failing repository, allows bounded tools, and grades the resulting checkout with tests.",
    },
    "Evaluation trial": {
      definition: "An evaluation trial is one complete execution of a task by a specified model, harness, tool set, and environment from its defined starting state.",
      details: [
        "Each trial produces a trace, a stop reason, and an observable final environment state.",
        "Comparable trials must reset the repository and other starting conditions to avoid hidden carryover.",
        "One trial cannot characterize reliability when sampling or model behavior varies between runs.",
      ],
      example: "Trial two begins from the same commit and failing test as trial one but may produce a different valid patch.",
    },
    "Observable outcome": {
      definition: "An observable outcome is evidence left in the environment after a trial that can be checked without trusting the model's claim about success.",
      details: [
        "Tests, changed files, service state, and measured thresholds can provide direct outcome evidence.",
        "Outcome checks allow alternative correct paths instead of requiring one reference sequence of actions.",
        "Missing evidence should fail its declared criterion rather than be interpreted optimistically.",
      ],
      example: "The evaluator inspects the actual checkout and confirms the target tests pass instead of accepting the sentence I fixed it.",
    },
    "Outcome grader": {
      definition: "An outcome grader checks the final observable environment state against a task's declared success requirements; this course uses deterministic checks.",
      details: [
        "It can run executable checks or compare fields with operations such as equality, containment, and thresholds.",
        "A well-scoped grader permits different correct implementations that satisfy the same behavior.",
        "It should return which requirements failed so a score remains diagnosable rather than merely binary.",
      ],
      example: "The grader requires tests_passed true, coverage at least 0.8, and a changed file under the expected package.",
    },
    "Trace grader": {
      definition: "A trace grader checks recorded actions, messages, approvals, limits, or other run events rather than only the final environment state.",
      details: [
        "It can detect forbidden credential access even if the resulting patch happens to pass every test.",
        "Trace grading complements outcome grading because a safe process and a correct result answer different questions.",
        "It should enforce necessary invariants without prescribing one arbitrary valid tool trajectory.",
      ],
      example: "A patch earns the outcome score but fails the trace rule because its run accessed a prohibited secrets directory.",
    },
    "Executable-test grader": {
      definition: "An executable-test grader runs relevant checks against the generated environment state to assess functional behavior directly.",
      details: [
        "It accepts alternative patches when they produce behavior covered by the same tests.",
        "Test coverage and isolation still matter because an incomplete or flaky suite can misgrade a result.",
        "The evaluator should capture command status and artifacts instead of relying on an agent-reported pass.",
      ],
      example: "After the agent exits, the evaluator runs pytest target_test.py in the changed checkout and records the real exit code.",
    },
    "SWE-bench task instance": {
      definition: "A SWE-bench task instance pairs a real GitHub issue with a repository snapshot from before its fix and asks a system to generate a resolving patch.",
      details: [
        "The task requires repository-scale code understanding and coordinated changes across relevant files.",
        "Evaluation applies the generated patch and uses executable tests associated with the issue.",
        "A valid generated solution need not textually match the historical reference patch.",
      ],
      example: "The agent receives a pre-fix checkout and issue description, edits the repository, and is graded on whether required tests pass.",
    },
    "Repeated trials": {
      definition: "Repeated trials run the same evaluation task several times from the same defined initial state to expose variation in system outcomes.",
      details: [
        "A single lucky success demonstrates possibility but gives little evidence about consistency.",
        "Each attempt should be isolated so one trial's files or caches do not change another trial's starting point.",
        "The finite set supports sample estimates and uncertainty, not a guarantee about every future run.",
      ],
      example: "Four isolated attempts on one repair task produce success flags true, false, true, and false for metric reduction.",
    },
    "Empirical pass rate": {
      definition: "Empirical pass rate is the fraction of observed evaluation trials that meet the task's success criterion.",
      details: [
        "It equals the number of observed successes divided by the number of observed trials.",
        "The value summarizes that sample without distinguishing find-one capability from repeated consistency.",
        "It is not interchangeable with finite-sample pass@k or pass^k when k is greater than one.",
      ],
      example: "Two successful trials among four observed attempts produce an empirical pass rate of one half.",
    },
    "pass@k (at least one success)": {
      definition: "pass@k describes the probability that at least one of k independent attempts succeeds, emphasizing capability when a system gets multiple chances.",
      details: [
        "For n observed outcomes with c successes, the common finite-sample estimator is 1 minus C(n-c,k) divided by C(n,k).",
        "Its combinatorial estimator selects distinct records from the observed sample without replacement; that is not a claim that future trials are generated that way.",
        "For a fixed observed set, increasing k cannot reduce the chance of including at least one success.",
      ],
      example: "With two successes among four records, the finite-sample pass@2 estimate is one minus C(2,2) over C(4,2), or five sixths.",
    },
    "pass^k (all successes)": {
      definition: "pass^k describes the probability that all k independent attempts succeed, emphasizing consistency across repeated opportunities.",
      details: [
        "For n observed outcomes with c successes, the finite-sample estimator is C(c,k) divided by C(n,k).",
        "The estimator is not simply empirical pass rate raised to k because it reduces a finite set through distinct k-sized subsets.",
        "Inspect exposes this all-success reduction with pass_k naming, which is different from its pass_at_k reducer.",
      ],
      example: "With two successes among four records, the finite-sample pass^2 estimate is C(2,2) over C(4,2), or one sixth.",
    },
    "Finite-sample combinatorial estimator": {
      definition: "A finite-sample combinatorial estimator averages a k-attempt success condition over all distinct k-sized subsets of n observed trial outcomes.",
      details: [
        "The denominator C(n,k) counts every unordered subset of k observed records.",
        "For pass@k the failure-only subsets form the complement; for pass^k the all-success subsets form the numerator.",
        "The subset calculation summarizes observed trials and should remain distinct from the process that generates IID attempts.",
      ],
      example: "Four trial records have C(4,2), or six, distinct two-record subsets over which an all-or-any success rule can be evaluated.",
    },
    "Capability-consistency distinction": {
      definition: "The capability-consistency distinction separates a system's ability to succeed at least once from its reliability at succeeding on every repeated attempt.",
      details: [
        "pass@k rewards finding one successful trajectory among several chances and therefore emphasizes capability.",
        "pass^k requires all selected attempts to work and therefore exposes operational consistency.",
        "Two systems with similar average pass rates can have different usefulness when retries are cheap or failures are costly.",
      ],
      example: "A flaky solver can look strong on pass@5 because one attempt works while remaining weak on pass^5 because all five rarely work.",
    },
    "Evaluation epoch": {
      definition: "An evaluation epoch is Inspect terminology for one repeated scored execution of the same sample, not an epoch of model training.",
      details: [
        "Several epochs produce several scores for one task instance under the configured evaluation setup.",
        "An epoch reducer combines those scores before or alongside ordinary sample metrics.",
        "The starting environment still needs reset or isolation so repetitions remain comparable.",
      ],
      example: "Five evaluation epochs run the same coding repair five times while leaving the model's trained weights unchanged.",
    },
    "Epoch reducer": {
      definition: "An epoch reducer combines repeated scores for one evaluation sample into a value that answers a chosen reliability or capability question.",
      details: [
        "Inspect supports reducers such as mean, mode, pass_at_k, and pass_k for different interpretations of repetition.",
        "Reducer choice is part of the evaluation design because it changes what strong performance means.",
        "The reducer cannot repair a weak task definition, contaminated starting state, or inaccurate grader.",
      ],
      example: "Using pass_at_3 asks whether at least one of three selected epochs succeeds rather than averaging their Boolean scores.",
    },
  },
);

const orchestrationCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Task Orchestration",
    source: orchestrationSource,
  },
  {
    "Task orchestration": {
      definition: "Task orchestration coordinates multiple units of work so independent tasks can proceed concurrently while dependencies and result contracts remain explicit.",
      details: [
        "Host scheduling decides when a task is ready instead of asking every worker to infer global order.",
        "Parallelism is safe only when tasks do not need unfinished outputs or incompatible access to changing state.",
        "The coordinator validates returned identities and cardinality before synthesizing worker output.",
      ],
      example: "Content and accessibility reviews run together, while final verification waits until both reports and the implementation are complete.",
    },
    "Task graph": {
      definition: "A task graph is a set of uniquely identified work items connected by directed dependency edges that state which work must finish first.",
      details: [
        "Each node names a task, while an edge represents a prerequisite relationship rather than data similarity.",
        "Every referenced dependency must exist and repeated task identifiers make the schedule ambiguous.",
        "An acyclic graph admits an ordering that respects all declared prerequisites.",
      ],
      example: "The verify node depends on implement and research, while inspect and research have no edge between them.",
    },
    "Task dependency": {
      definition: "A task dependency is an explicit task identifier that must be completed before another declared task is eligible to start.",
      details: [
        "Dependencies convert necessary ordering into data that a deterministic scheduler can validate.",
        "A missing or duplicated dependency identifier is an invalid plan rather than a task to guess about.",
        "Shared-resource conflicts may require added dependencies even when no output relationship exists.",
      ],
      example: "The implementation task waits for inspect because it needs the inspected interface map before making edits.",
    },
    "Ready task": {
      definition: "A ready task is an unfinished task whose entire declared dependency set is already present in the scheduler's completed set.",
      details: [
        "Tasks with no dependencies are ready in the first scheduling wave.",
        "Readiness is recalculated after each batch as more prerequisite identifiers become complete.",
        "The course scheduler models dependencies only; separate checks must handle hidden mutable-resource conflicts.",
      ],
      example: "Implement becomes ready immediately after inspect completes, while verify still waits for both implement and research.",
    },
    "Ready batch": {
      definition: "A ready batch is the stable ordered group of all currently ready tasks selected for one potential execution wave.",
      details: [
        "Every member depends only on work in earlier batches according to the declared graph.",
        "The course helper preserves source task order so repeated scheduling is deterministic.",
        "Membership means dependency-ready, not proof that enough workers exist or shared resources are conflict-free.",
      ],
      example: "Inspect and research form the first ready batch even if a two-worker limit causes them to start a few milliseconds apart.",
    },
    "Topological batching": {
      definition: "Topological batching converts an acyclic dependency graph into successive stable waves in which every prerequisite appears before its dependent task.",
      details: [
        "Completed identifiers accumulate after each wave and no task appears in more than one batch.",
        "Independent tasks can share a batch because the dependency order does not constrain them relative to one another.",
        "The helper computes scheduling groups; it does not itself launch concurrent processes or detect resource conflicts.",
      ],
      example: "A graph becomes batches inspect plus research, then implement, then verify without violating any declared edge.",
    },
    "Cycle detection": {
      definition: "Cycle detection identifies a remaining dependency loop when unfinished tasks exist but none can become ready under the current completed set.",
      details: [
        "A direct two-task cycle and a longer indirect loop both prevent a complete topological schedule.",
        "Adding more workers cannot solve a logical dependency cycle because every member still waits.",
        "The scheduler should return a clear invalid-plan error rather than hang or silently skip the tasks.",
      ],
      example: "Task a waits for b and task b waits for a, so the scheduler reports a cycle before assigning either task.",
    },
    "Parallelizable independence": {
      definition: "Parallelizable independence means tasks can progress without unfinished outputs from one another or incompatible mutation of shared resources.",
      details: [
        "Declared graph independence is necessary but can miss two workers editing the same file or operating one external account.",
        "Separate worktrees, read-only scopes, or explicit serialization can remove otherwise hidden conflicts.",
        "Clear, separable output contracts reduce the context each worker must share with the coordinator.",
      ],
      example: "Two agents can review disjoint modules in separate worktrees and return reports without observing one another's intermediate edits.",
    },
    "Worker assignment": {
      definition: "A worker assignment is a bounded contract naming one task's objective, allowed scope, dependencies, and expected output for a delegated execution context.",
      details: [
        "A unique task identifier links the assignment to exactly one later result record.",
        "Scope limits keep a worker from making unrelated changes that surprise the coordinator or other workers.",
        "An explicit return shape makes validation and synthesis possible without parsing an open-ended status conversation.",
      ],
      example: "Assignment source-audit may read lesson files and primary sources but must return a list of claims, links, and severity.",
    },
    "Worker result contract": {
      definition: "A worker result contract requires every declared task to return one identifiable success or error record in a shape the coordinator can validate.",
      details: [
        "Missing, duplicate, and undeclared task identifiers all violate the collected result set.",
        "Errors should be explicit results so downstream scheduling does not mistake silence for successful completion.",
        "Validated records can then be reordered deterministically before synthesis.",
      ],
      example: "The record task_id inspect, status ok, and value route-map satisfies one assignment without mutating coordinator state silently.",
    },
    "Result-set completeness": {
      definition: "Result-set completeness requires collected outputs to contain exactly one result for every expected task identifier and no result for any other task.",
      details: [
        "It checks count, membership, and uniqueness rather than accepting any list of the expected length.",
        "Two records with the same identifier leave another assignment unresolved even when total counts happen to match.",
        "Completeness validation occurs before synthesis so partial or contaminated output cannot masquerade as a complete batch.",
      ],
      example: "Expected tasks inspect and research require one matching record each; two inspect records fail even though two records arrived.",
    },
    "Deterministic result order": {
      definition: "Deterministic result order restores validated worker outputs to the coordinator's declared task sequence instead of preserving variable completion timing.",
      details: [
        "Asynchronous workers may finish in any order without changing downstream prompt or synthesis input.",
        "The full result record remains intact while only its collection position is normalized.",
        "Stable order makes tests, diffs, and repeated orchestration runs easier to compare.",
      ],
      example: "Incoming research then inspect results are returned as inspect then research because that is the declaration order.",
    },
    "Coordination overhead": {
      definition: "Coordination overhead is the extra time, context, model calls, scheduling, validation, and communication introduced by splitting work across workers.",
      details: [
        "More agents are not automatically faster when task setup and synthesis exceed the useful parallel work.",
        "Long dependency chains cap speedup because later workers must still wait for the critical path.",
        "Small deterministic tasks often cost less to execute directly than to describe, delegate, and review.",
      ],
      example: "Spawning five workers for one tiny identifier rename takes longer than one bounded edit plus its focused test.",
    },
    "Parallelization workflow": {
      definition: "A parallelization workflow runs predefined independent model tasks simultaneously and aggregates their outputs through explicit host logic.",
      details: [
        "Sectioning assigns different complementary scopes, while voting repeats a judgment to gather diverse attempts.",
        "The decomposition and aggregation path are known to host code instead of dynamically invented at every step.",
        "This pattern fits work whose subtasks do not require constant shared-state synchronization.",
      ],
      example: "One worker checks mobile interaction and another checks content provenance before the host combines both release reports.",
    },
    "Orchestrator-worker pattern": {
      definition: "The orchestrator-worker pattern uses a central model to dynamically decompose an input, delegate discovered subtasks, and synthesize worker results.",
      details: [
        "Its subtasks are chosen from the particular problem rather than fixed entirely in a static workflow.",
        "The orchestrator needs bounded worker interfaces and an explicit synthesis responsibility.",
        "It is conceptually distinct from the course's static dependency-batching helper, which returns declared waves only.",
      ],
      example: "A coding orchestrator inspects the issue, discovers three affected modules, and delegates a focused investigation for each module.",
    },
  },
);

const integratedHarnessCards = defineFlashcardGroup(
  {
    subjectId: "harness-engineering",
    module: "Harness Engineering",
    lesson: "Integrated Harness",
    source: integratedHarnessSource,
  },
  {
    "Integrated harness": {
      definition: "An integrated harness is one complete host loop that composes model and tool adapters with validation, policy, budgets, observations, and auditable terminal state.",
      details: [
        "One component owns transition order so every consequential call crosses the same deterministic checks.",
        "The course implementation uses recorded responses and fixture tools to make complete browser runs reproducible.",
        "Its structured product includes run status, messages, events, and counts rather than final text alone.",
      ],
      example: "A recorded read request is validated, allowed, dispatched, observed, and followed by final text in one inspectable run record.",
    },
    "Model-agnostic harness": {
      definition: "A model-agnostic harness consumes a narrow normalized response interface instead of embedding one model provider's private output format throughout host logic.",
      details: [
        "Provider-specific parsing remains in an adapter while permissions and transition rules stay host-owned.",
        "A provider can be replaced only when the new adapter preserves the same interface and response semantics.",
        "Model independence does not remove the need to test differences in tool calling, errors, and stop behavior.",
      ],
      example: "A live API adapter replaces recorded responses without rewriting the policy engine because both emit the same normalized actions.",
    },
    "Model adapter": {
      definition: "A model adapter translates one provider's response format into the normalized final-text or tool-action representation accepted by the harness.",
      details: [
        "It owns provider-specific parsing but should not execute tools or make permission decisions.",
        "Recorded adapters supply fixed outputs that make state-machine tests deterministic and inexpensive.",
        "Mapping must preserve call identifiers, arguments, error distinctions, and any supported multi-call semantics accurately.",
      ],
      example: "The adapter maps a provider function-call object into kind tool_call with ID c1, name read_file, and normalized arguments.",
    },
    "Tool adapter": {
      definition: "A tool adapter invokes one registered capability behind a narrow host interface and returns a bounded result or explicit error.",
      details: [
        "It hides internal service or library details from the model-facing tool definition.",
        "The harness dispatches it only after response, schema, target, policy, approval, and budget checks.",
        "Production and fixture implementations can share the contract when their observable semantics remain equivalent.",
      ],
      example: "The read_file adapter accepts one validated path and returns bounded contents without exposing the raw filesystem API.",
    },
    "Adapter registry": {
      definition: "An adapter registry is the host-owned mapping from unique tool names to their descriptors and callable implementations or deterministic fixtures.",
      details: [
        "Duplicate tool names are invalid because dispatch would otherwise select between ambiguous capabilities.",
        "Descriptors can identify action kind and which argument contains the policy target.",
        "A generated name not present in the registry fails before arbitrary application code can be invoked.",
      ],
      example: "Registry entry read_file declares kind read and target field path, while the unknown name erase_disk is rejected.",
    },
    "Host state machine": {
      definition: "A host state machine is deterministic transition logic that moves a run through response handling, policy, dispatch, observation, pause, and terminal states.",
      details: [
        "Valid states and transitions are explicit, while model output supplies input rather than authority over the transition.",
        "Transition order is security-relevant because dispatch must never precede validation or approval.",
        "Recorded state makes protocol behavior testable without requiring one exact reasoning trajectory.",
      ],
      example: "A confirm decision moves the run to approval_required with a pending call instead of invoking the tool immediately.",
    },
    "Host transition": {
      definition: "A host transition is one host-controlled harness step that validates a response, enforces applicable limits and policy, and records the resulting state change.",
      details: [
        "For a tool proposal, target normalization and permission matching occur before any adapter dispatch.",
        "Allowed execution produces an observation, while denial produces an explicit error observation without the side effect.",
        "Every branch records enough state to explain why the next model turn, pause, or terminal outcome occurred.",
      ],
      example: "Turn one transforms call c3 into action_proposed, policy allow, tool_completed, and one paired tool observation.",
    },
    "Consequential decision": {
      definition: "A consequential decision is a host choice that can change external state, widen access, incur meaningful cost, or terminate or pause the run.",
      details: [
        "It must not be delegated to unchecked model text because generation is probabilistic and potentially influenced by untrusted content.",
        "Permissions, approvals, budgets, and explicit transition rules govern different consequential choices.",
        "The event trace should record the chosen outcome and rule so later review can explain it.",
      ],
      example: "Deciding whether a production write requires confirmation is consequential even when its tool arguments are perfectly valid.",
    },
    "Approval-required state": {
      definition: "Approval-required state is a distinct pause containing the exact validated pending call when policy requires confirmation before dispatch.",
      details: [
        "The dispatched-tool count does not increase because no adapter has run while authorization remains unresolved.",
        "The pending call stays in history without a result so an auditor can identify the intentional unresolved action.",
        "The course records the pause but does not claim its teaching implementation includes a full approve-and-resume workflow.",
      ],
      example: "Call c6 produces status approval_required and pending_call c6 while the recorded number of dispatched tools remains zero.",
    },
    "Denied-action observation": {
      definition: "A denied-action observation is an explicit error result paired with a valid proposed call that host policy refused to dispatch.",
      details: [
        "It lets the next model turn revise its plan from the denial rather than wait for a result that will never arrive.",
        "The tool implementation and any fixture output remain untouched and undisclosed.",
        "Pairing the error with the call keeps the message protocol resolved even though the requested effect did not occur.",
      ],
      example: "A secret-file read receives content permission denied with is_error true and zero adapter dispatches for that call.",
    },
    "Turn-budget exhaustion": {
      definition: "Turn-budget exhaustion is an explicit terminal state reached when the harness consumes its maximum allowed model-response turns without a final response.",
      details: [
        "A response beyond the limit is not requested or consumed even when a recorded adapter still contains one.",
        "The run has no invented final text and records a budget-exceeded event explaining termination.",
        "This outcome remains distinct from model-output exhaustion, tool error, denial, and successful completion.",
      ],
      example: "With max_turns one, a first-turn tool call runs but the recorded second-turn final response is never read.",
    },
    "Model-response exhaustion": {
      definition: "Model-response exhaustion is an explicit run state reached when the model adapter has no response available for the next otherwise permitted turn.",
      details: [
        "It differs from a turn limit because the harness was ready to continue but its response source ended.",
        "The state records which turn required output instead of inventing final text or silently completing.",
        "Recorded adapters make this edge case deterministic, while live adapters may surface an equivalent provider failure.",
      ],
      example: "One recorded tool call with no following response yields model_exhausted after the call's observation is added.",
    },
    "Run record": {
      definition: "A run record is the structured execution product containing status, final text when present, counts, messages, pending state, and deterministic host events.",
      details: [
        "It is richer than a conversation transcript because it also exposes host policy and terminal transitions.",
        "Stable structure supports debugging, browser inspection, recovery decisions, and automated protocol tests.",
        "Different terminal statuses populate different fields instead of forcing every outcome into a success-shaped object.",
      ],
      example: "An approval record includes status, pending call, message history, zero dispatches, and the matching policy-decision event.",
    },
    "Host event": {
      definition: "A host event is a deterministic trace record for a harness-side occurrence such as action proposal, policy decision, tool completion, pause, or termination.",
      details: [
        "It is distinct from model messages and makes host-owned reasoning about transitions directly inspectable.",
        "Ordering shows whether policy preceded dispatch and whether a terminal event ended the trace consistently.",
        "Stable event kinds let tests assert important invariants without matching every field of one reference run.",
      ],
      example: "The trace records action_proposed, policy_decision, tool_completed, and run_completed in the order they occurred.",
    },
    "Protocol audit": {
      definition: "A protocol audit independently checks selected call-pairing and terminal-state invariants in a run record without requiring one exact tool trajectory.",
      details: [
        "It detects orphan results, duplicate results, duplicate call identifiers, and unresolved calls at ordinary completion.",
        "A valid approval pause may intentionally contain exactly one pending unresolved call with no dispatch.",
        "The course auditor is deliberately limited and must not be described as a comprehensive security audit.",
      ],
      example: "A completed run whose c9 request has no result returns valid false with an unresolved-call issue from the auditor.",
    },
  },
);

export const harnessEngineeringFlashcardLibrary = combineFlashcardLibraries(
  agentLoopCards,
  toolContractCards,
  contextSelectionCards,
  permissionsCards,
  stateRecoveryCards,
  evaluationCards,
  orchestrationCards,
  integratedHarnessCards,
);
