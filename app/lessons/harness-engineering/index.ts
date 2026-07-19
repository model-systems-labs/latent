import { defineHarnessLesson } from "./define-harness-lesson";

const harnessEngineeringSource = {
  role: "Guide" as const,
  title: "Harness engineering: leveraging Codex in an agent-first world",
  authors: "Ryan Lopopolo",
  year: "2026",
  url: "https://openai.com/index/harness-engineering/",
  relevance: "Describes the environment, feedback loops, repository knowledge, and constraints that make agents effective in software work.",
};

const buildingEffectiveAgentsSource = {
  role: "Guide" as const,
  title: "Building effective agents",
  authors: "Erik S. and Barry Zhang",
  year: "2024",
  url: "https://www.anthropic.com/engineering/building-effective-agents",
  relevance: "Defines agent loops and composable workflow, routing, parallelization, and orchestrator-worker patterns.",
};

const reactSource = {
  role: "Paper" as const,
  title: "ReAct: Synergizing Reasoning and Acting in Language Models",
  authors: "Shunyu Yao et al.",
  year: "2023",
  url: "https://arxiv.org/abs/2210.03629",
  relevance: "Studies the interleaving of model reasoning, actions, and observations.",
};

const highResolutionTimeSource = {
  role: "Specification" as const,
  title: "High Resolution Time",
  authors: "W3C",
  year: "2026 Working Draft",
  url: "https://www.w3.org/TR/hr-time-3/",
  relevance: "Defines monotonic high-resolution time measurements suitable for elapsed-time budgets that must not change with the system clock.",
};

const mcpToolsSource = {
  role: "Specification" as const,
  title: "Model Context Protocol: Tools",
  authors: "Model Context Protocol contributors",
  year: "2025",
  url: "https://modelcontextprotocol.io/specification/2025-06-18/server/tools",
  relevance: "Specifies named tools, input schemas, discovery, calls, and results at a model-facing protocol boundary.",
};

const approvalsSecuritySource = {
  role: "Guide" as const,
  title: "Agent approvals & security",
  authors: "OpenAI",
  year: "Current",
  url: "https://learn.chatgpt.com/docs/agent-approvals-security",
  relevance: "Documents sandboxing, approvals, network access, and the boundary between model behavior and enforced permissions.",
};

const sandboxingSource = {
  role: "Guide" as const,
  title: "Sandboxing",
  authors: "OpenAI",
  year: "Current",
  url: "https://learn.chatgpt.com/docs/sandboxing",
  relevance: "Distinguishes the technical sandbox boundary from approval policy and documents filesystem and network isolation.",
};

const promptInjectionSource = {
  role: "Guide" as const,
  title: "Understanding prompt injections",
  authors: "OpenAI",
  year: "Current",
  url: "https://openai.com/safety/prompt-injections/",
  relevance: "Explains how untrusted third-party content can inject instructions and why constrained access limits the resulting risk.",
};

const owaspPromptInjectionSource = {
  role: "Guide" as const,
  title: "LLM01:2025 Prompt Injection",
  authors: "OWASP GenAI Security Project",
  year: "2025",
  url: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
  relevance: "Defines direct and indirect prompt injection in OWASP's LLM01 taxonomy and lists least-privilege controls that reduce impact.",
};

const agentsMdSource = {
  role: "Guide" as const,
  title: "Custom instructions with AGENTS.md",
  authors: "OpenAI",
  year: "Current",
  url: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
  relevance: "Explains how repository-local instructions are discovered and scoped for an agent run.",
};

const pathTraversalSource = {
  role: "Guide" as const,
  title: "CWE-22: Improper Limitation of a Pathname to a Restricted Directory",
  authors: "MITRE",
  year: "Current",
  url: "https://cwe.mitre.org/data/definitions/22.html",
  relevance: "Defines path traversal weaknesses and the need to constrain pathname resolution to an intended directory.",
};

const toctouSource = {
  role: "Guide" as const,
  title: "CWE-367: Time-of-check Time-of-use Race Condition",
  authors: "MITRE",
  year: "Current",
  url: "https://cwe.mitre.org/data/definitions/367.html",
  relevance: "Defines the race that can occur when a resource changes between an authorization check and its use.",
};

const sweBenchSource = {
  role: "Paper" as const,
  title: "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?",
  authors: "Carlos E. Jimenez et al.",
  year: "2024",
  url: "https://arxiv.org/abs/2310.06770",
  relevance: "Defines repository-level software tasks whose outcomes can be graded with executable tests.",
};

const inspectAgentsSource = {
  role: "Implementation" as const,
  title: "Inspect agents",
  authors: "UK AI Security Institute",
  year: "Current",
  url: "https://inspect.aisi.org.uk/agents.html",
  relevance: "Documents agent state, tools, limits, handoffs, and evaluation-oriented execution in Inspect.",
};

const inspectMetricsSource = {
  role: "Guide" as const,
  title: "Scoring metrics",
  authors: "UK AI Security Institute",
  year: "Current",
  url: "https://inspect.aisi.org.uk/metrics.html",
  relevance: "Documents repeated-epoch reducers, including finite-sample pass@k and pass^k estimators.",
};

const inspectCheckpointingSource = {
  role: "Guide" as const,
  title: "Checkpointing",
  authors: "UK AI Security Institute",
  year: "Current",
  url: "https://inspect.aisi.org.uk/checkpointing.html",
  relevance: "Documents committed checkpoints, recovery boundaries, restored state, and the limits of captured external effects.",
};

const humanEvalSource = {
  role: "Paper" as const,
  title: "Evaluating Large Language Models Trained on Code",
  authors: "Mark Chen et al.",
  year: "2021",
  url: "https://arxiv.org/abs/2107.03374",
  relevance: "Introduces the pass@k functional-correctness estimator for repeated code-generation attempts.",
};

const tauBenchSource = {
  role: "Paper" as const,
  title: "tau-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains",
  authors: "Shunyu Yao et al.",
  year: "2024",
  url: "https://arxiv.org/abs/2406.12045",
  relevance: "Introduces pass^k as a measure of consistent success across repeated agent trials.",
};

const harnessIdentity = {
  courseId: "harness-engineering",
  programId: "harness-engineering",
  courseTitle: "Harness Engineering",
  courseNumber: 3,
} as const;

export const agentLoopLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "agent-loop",
  number: 1,
  lessonNumber: 1,
  eyebrow: "Responses · Actions · Observations",
  title: "Agent Loop",
  thesis: "An agent loop turns model responses into validated actions and observations until an explicit stop condition is reached.",
  sources: [buildingEffectiveAgentsSource, reactSource, harnessEngineeringSource, highResolutionTimeSource],
  summary: [
    {
      label: "The model proposes; the harness executes.",
      body: "A model response may contain final text or structured data describing a tool call. The response has no effect on files, processes, or external systems until deterministic host code validates and executes it.",
    },
    {
      label: "Each action produces the next observation.",
      body: "After a permitted tool runs, the harness records its result with the matching call identifier. That observation becomes part of the next model request, allowing the model to revise its plan from evidence rather than assume the action succeeded.",
    },
    {
      label: "Termination is part of the protocol.",
      body: "The loop stops on a valid final response, an unrecoverable error, or an enforced turn, time, or tool budget. These limits belong in host code because a malformed or repetitive model response cannot be trusted to stop itself.",
    },
  ],
  diagram: {
    title: "One agent turn",
    caption: "The harness validates every transition between probabilistic model output and deterministic environment state.",
    nodes: [
      { label: "Context", value: "instructions · task · prior observations" },
      { label: "Model response", value: "final text or proposed tool call" },
      { label: "Harness", value: "parse · validate · enforce limits" },
      { label: "Observation", value: "tool result enters the next turn" },
    ],
  },
  dataset: {
    name: "Recorded agent responses",
    source: "Course-authored synthetic traces",
    license: "Not separately licensed",
    size: "8 response and tool-result fixtures",
    preview: "final response · valid call · unknown tool · duplicate result",
  },
  implementation: {
    filename: "agent-loop.py",
    intro: "Parse one model response, then attach a tool observation to the call that requested it.",
    tensorOps: ["Python", "dict", "list", "copy.deepcopy"],
    codeBlocks: [
      {
        id: "parse-model-response",
        label: "Parse a model response",
        purpose: "Normalize exactly one final response or known tool call before the harness acts.",
        concepts: [
          { name: "response form", detail: "Exactly one of final or tool_call must be present." },
          { name: "allowed tools", detail: "A syntactically valid call can still name an unavailable capability." },
          { name: "normalized action", detail: "Host code receives one predictable dictionary shape." },
        ],
        code: `def parse_model_response(response, tool_names):
    if type(response) is not dict:
        raise ValueError("response must be a dictionary")

    has_final = "final" in response
    has_tool_call = "tool_call" in response
    if has_final == has_tool_call:
        raise ValueError("response must contain exactly one final or tool_call")

    if has_final:
        text = response["final"]
        if type(text) is not str or not text.strip():
            raise ValueError("final must be non-empty text")
        return {"kind": "final", "text": text}

    call = response["tool_call"]
    if type(call) is not dict:
        raise ValueError("tool_call must be a dictionary")
    call_id = call.get("id")
    name = call.get("name")
    arguments = call.get("arguments")
    if type(call_id) is not str or not call_id:
        raise ValueError("tool call id must be non-empty text")
    if type(name) is not str or name not in set(tool_names):
        raise ValueError("unknown tool")
    if type(arguments) is not dict:
        raise ValueError("tool arguments must be a dictionary")
    return {
        "kind": "tool_call",
        "call_id": call_id,
        "name": name,
        "arguments": dict(arguments),
    }`,
        checkCode: `action = parse_model_response(
    {"tool_call": {"id": "c1", "name": "read_file", "arguments": {"path": "app.py"}}},
    ["read_file", "run_tests"],
)
RESULT = {
    "passed": action == {"kind": "tool_call", "call_id": "c1", "name": "read_file", "arguments": {"path": "app.py"}},
    "detail": f"normalized kind = {action['kind']}",
}`,
      },
      {
        id: "append-tool-result",
        label: "Append a tool result",
        purpose: "Add one observation to an unresolved tool call without mutating prior messages.",
        concepts: [
          { name: "call_id", detail: "Connects the observation to the assistant request that caused it." },
          { name: "unresolved call", detail: "A call accepts exactly one tool result." },
          { name: "immutable history", detail: "A copied message list makes state transitions explicit." },
        ],
        code: `import copy

def append_tool_result(messages, call_id, output, is_error=False):
    if type(messages) is not list:
        raise ValueError("messages must be a list")
    if type(call_id) is not str or not call_id:
        raise ValueError("call_id must be non-empty text")
    if type(is_error) is not bool:
        raise ValueError("is_error must be a boolean")

    copied = copy.deepcopy(messages)
    matching_calls = []
    resolved = set()
    for message in copied:
        if type(message) is not dict:
            continue
        if message.get("role") == "assistant" and type(message.get("tool_call")) is dict:
            if message["tool_call"].get("id") == call_id:
                matching_calls.append(message)
        if message.get("role") == "tool" and message.get("call_id") == call_id:
            resolved.add(call_id)

    if len(matching_calls) != 1:
        raise ValueError("tool result requires one matching call")
    if call_id in resolved:
        raise ValueError("tool call already has a result")

    copied.append({
        "role": "tool",
        "call_id": call_id,
        "content": output,
        "is_error": is_error,
    })
    return copied`,
        checkCode: `history = [{"role": "assistant", "tool_call": {"id": "c1", "name": "read_file"}}]
updated = append_tool_result(history, "c1", "file contents")
RESULT = {
    "passed": len(history) == 1 and updated[-1] == {"role": "tool", "call_id": "c1", "content": "file contents", "is_error": False},
    "detail": f"messages before {len(history)} · after {len(updated)}",
}`,
      },
    ],
  },
  experiment: {
    variant: "agent-loop",
    title: "Trace an agent loop",
    intro: "Change the number of tool calls before the final response and inspect the resulting turns, observations, and remaining budget.",
  },
});

export const toolContractsLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "tool-contracts",
  number: 2,
  lessonNumber: 2,
  eyebrow: "Schemas · Validation · Results",
  title: "Tool Contracts",
  thesis: "A tool contract gives a probabilistic model a small typed interface to deterministic software.",
  sources: [mcpToolsSource, buildingEffectiveAgentsSource, inspectAgentsSource],
  summary: [
    {
      label: "The schema is part of the agent interface.",
      body: "A tool name, description, and argument schema tell the model which action exists and how to request it. Similar names or overlapping purposes make selection harder even when the underlying APIs are well designed for human programmers. The exercise below uses a deliberately reduced teaching schema; MCP tools use JSON Schema on the wire.",
    },
    {
      label: "Validation happens before dispatch.",
      body: "Model-generated arguments cross a trust boundary. This course's closed schema checks required fields, rejects undeclared fields, and verifies types before an internal function, network client, or process receives the request.",
    },
    {
      label: "Results need a context budget.",
      body: "A tool should return enough evidence for the next decision, not every record it can access. Limits, pagination, stable ordering, and explicit truncation keep observations inspectable and prevent one call from consuming the remaining context window.",
    },
  ],
  diagram: {
    title: "Tool boundary",
    caption: "Typed input and bounded output isolate model-generated data from the underlying implementation.",
    nodes: [
      { label: "Definition", value: "name · purpose · input schema" },
      { label: "Validation", value: "required fields · types · boundaries" },
      { label: "Dispatch", value: "one deterministic implementation" },
      { label: "Result", value: "bounded items · count · next offset" },
    ],
  },
  dataset: {
    name: "Tool-call fixtures",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "10 argument and result-page fixtures",
    preview: "valid call · missing field · wrong type · paginated matches",
  },
  implementation: {
    filename: "tool-contracts.py",
    intro: "Validate a small model-facing schema, then return a bounded page of tool results.",
    tensorOps: ["Python", "dict", "type", "slicing"],
    codeBlocks: [
      {
        id: "validate-tool-arguments",
        label: "Validate tool arguments",
        purpose: "Check required, optional, typed, and unexpected arguments before dispatch.",
        concepts: [
          { name: "required", detail: "Fields that every call must provide." },
          { name: "optional", detail: "Fields accepted when present but not required." },
          { name: "allow_extra", detail: "Controls whether undeclared fields cross the boundary." },
        ],
        code: `def validate_tool_arguments(arguments, spec):
    if type(arguments) is not dict or type(spec) is not dict:
        raise ValueError("arguments and spec must be dictionaries")

    required = spec.get("required", {})
    optional = spec.get("optional", {})
    allow_extra = spec.get("allow_extra", False)
    if type(required) is not dict or type(optional) is not dict or type(allow_extra) is not bool:
        raise ValueError("invalid tool specification")

    type_checks = {
        "str": lambda value: type(value) is str,
        "int": lambda value: type(value) is int,
        "float": lambda value: type(value) in (int, float),
        "bool": lambda value: type(value) is bool,
        "list": lambda value: type(value) is list,
        "dict": lambda value: type(value) is dict,
    }
    overlap = set(required).intersection(optional)
    if overlap:
        raise ValueError("a field cannot be both required and optional")
    declared = {**required, **optional}
    for name, expected in declared.items():
        if expected not in type_checks:
            raise ValueError("unsupported schema type for " + name + ": " + str(expected))

    missing = [name for name in required if name not in arguments]
    if missing:
        raise ValueError("missing required argument: " + missing[0])
    if not allow_extra:
        extra = [name for name in arguments if name not in declared]
        if extra:
            raise ValueError("unexpected argument: " + extra[0])

    for name, value in arguments.items():
        if name not in declared:
            continue
        expected = declared[name]
        if not type_checks[expected](value):
            raise ValueError(name + " must have type " + expected)
    return dict(arguments)`,
        checkCode: `arguments = validate_tool_arguments(
    {"path": "app.py", "line": 12},
    {"required": {"path": "str"}, "optional": {"line": "int"}, "allow_extra": False},
)
RESULT = {
    "passed": arguments == {"path": "app.py", "line": 12},
    "detail": f"validated fields = {list(arguments)}",
}`,
      },
      {
        id: "page-tool-results",
        label: "Page tool results",
        purpose: "Return a deterministic bounded slice with enough metadata to request more.",
        concepts: [
          { name: "offset", detail: "The first item included in this page." },
          { name: "limit", detail: "The maximum number of items returned to context." },
          { name: "next_offset", detail: "The next starting point, or None when the result is complete." },
        ],
        code: `def page_tool_results(items, offset, limit):
    if type(items) is not list:
        raise ValueError("items must be a list")
    if type(offset) is not int or offset < 0:
        raise ValueError("offset must be a non-negative integer")
    if type(limit) is not int or limit < 1 or limit > 50:
        raise ValueError("limit must be between 1 and 50")

    page = items[offset:offset + limit]
    end = offset + len(page)
    return {
        "items": page,
        "returned": len(page),
        "total": len(items),
        "next_offset": end if end < len(items) else None,
    }`,
        checkCode: `page = page_tool_results(["a", "b", "c", "d", "e"], 0, 2)
RESULT = {
    "passed": page == {"items": ["a", "b"], "returned": 2, "total": 5, "next_offset": 2},
    "detail": f"returned {page['returned']} of {page['total']}",
}`,
      },
    ],
  },
  experiment: {
    variant: "tool-contracts",
    title: "Bound a tool result",
    intro: "Change the page limit and compare returned evidence, omitted records, and the offset needed for another call.",
  },
});

export const contextSelectionLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "context-selection",
  number: 3,
  lessonNumber: 3,
  eyebrow: "Budgets · Priority · Compaction",
  title: "Context Selection",
  thesis: "Context selection allocates a finite token budget to instructions, current evidence, and useful history.",
  sources: [harnessEngineeringSource, agentsMdSource, inspectAgentsSource],
  summary: [
    {
      label: "Context is the full inference input.",
      body: "It includes system and repository instructions, tool definitions, retrieved files, conversation history, and prior observations. Prompt wording is one part of this larger state assembled for each model call.",
    },
    {
      label: "Selection is different from accumulation.",
      body: "The course selector prioritizes declared required instructions, while optional evidence competes for the remaining budget. Current test failures or relevant schemas usually matter more than old logs and files that have already changed.",
    },
    {
      label: "Compaction preserves protocol structure.",
      body: "Older tool output can be replaced with a short, explicit preview, but roles, call identifiers, durable decisions, and unresolved work must remain intact. Otherwise the next turn receives a shorter history that no longer describes a valid run.",
    },
  ],
  diagram: {
    title: "Context budget",
    caption: "Required material enters first; current evidence receives priority; replaceable detail is compacted or omitted.",
    nodes: [
      { label: "Required", value: "system rules · scoped repository instructions" },
      { label: "Current", value: "task · active files · latest test result" },
      { label: "Optional", value: "supporting docs ordered by relevance" },
      { label: "Compacted", value: "old observations retain identity, not full payload" },
    ],
  },
  dataset: {
    name: "Context-budget fixtures",
    source: "Course-authored synthetic traces",
    license: "Not separately licensed",
    size: "9 instruction, file, test, and tool-output items",
    preview: "required rules · current failure · schema · stale log",
  },
  implementation: {
    filename: "context-selection.py",
    intro: "Select context under a fixed budget, then compact old tool output without breaking call identity.",
    tensorOps: ["Python", "sorting", "copy.deepcopy", "string slicing"],
    codeBlocks: [
      {
        id: "select-context",
        label: "Select context",
        purpose: "Include required items, then admit optional evidence by stable priority while it fits.",
        concepts: [
          { name: "budget", detail: "The maximum token estimate available to these context items." },
          { name: "required_ids", detail: "Items that cannot be dropped for this model call." },
          { name: "priority", detail: "A deterministic estimate of value for the next decision." },
        ],
        code: `def select_context(items, budget, required_ids):
    if type(items) is not list or type(required_ids) is not list:
        raise ValueError("items and required_ids must be lists")
    if type(budget) is not int or budget < 0:
        raise ValueError("budget must be a non-negative integer")

    by_id = {}
    indexed = []
    for index, item in enumerate(items):
        if type(item) is not dict or type(item.get("id")) is not str:
            raise ValueError("every item needs a text id")
        if item["id"] in by_id:
            raise ValueError("context item ids must be unique")
        if type(item.get("tokens")) is not int or item["tokens"] < 0:
            raise ValueError("item tokens must be non-negative integers")
        if type(item.get("priority")) not in (int, float):
            raise ValueError("item priority must be numeric")
        by_id[item["id"]] = item
        indexed.append((index, item))

    if len(set(required_ids)) != len(required_ids):
        raise ValueError("required ids must be unique")
    missing = [item_id for item_id in required_ids if item_id not in by_id]
    if missing:
        raise ValueError("missing required context item: " + missing[0])

    selected = list(required_ids)
    used = sum(by_id[item_id]["tokens"] for item_id in selected)
    if used > budget:
        raise ValueError("required context exceeds budget")

    required = set(required_ids)
    optional = [(index, item) for index, item in indexed if item["id"] not in required]
    optional.sort(key=lambda pair: (-pair[1]["priority"], pair[0]))
    for _, item in optional:
        if used + item["tokens"] <= budget:
            selected.append(item["id"])
            used += item["tokens"]

    return {
        "selected_ids": selected,
        "used_tokens": used,
        "remaining_tokens": budget - used,
    }`,
        checkCode: `selection = select_context(
    [
        {"id": "instructions", "tokens": 40, "priority": 100},
        {"id": "current-test", "tokens": 30, "priority": 9},
        {"id": "schema", "tokens": 50, "priority": 8},
        {"id": "old-log", "tokens": 70, "priority": 2},
    ],
    120,
    ["instructions"],
)
RESULT = {
    "passed": selection == {"selected_ids": ["instructions", "current-test", "schema"], "used_tokens": 120, "remaining_tokens": 0},
    "detail": f"selected {selection['selected_ids']}",
}`,
      },
      {
        id: "compact-tool-outputs",
        label: "Compact tool output",
        purpose: "Shorten older tool payloads while preserving message order and call identifiers.",
        concepts: [
          { name: "keep_recent", detail: "The number of newest tool results kept exactly." },
          { name: "preview_chars", detail: "The payload prefix retained for older results." },
          { name: "protocol identity", detail: "Role and call_id remain unchanged after compaction." },
        ],
        code: `import copy

def compact_tool_outputs(messages, keep_recent, preview_chars):
    if type(messages) is not list:
        raise ValueError("messages must be a list")
    if type(keep_recent) is not int or keep_recent < 0:
        raise ValueError("keep_recent must be non-negative")
    if type(preview_chars) is not int or preview_chars < 0:
        raise ValueError("preview_chars must be non-negative")

    compacted = copy.deepcopy(messages)
    tool_indexes = [
        index for index, message in enumerate(compacted)
        if type(message) is dict and message.get("role") == "tool"
    ]
    eligible = tool_indexes if keep_recent == 0 else tool_indexes[:-keep_recent]

    for index in eligible:
        message = compacted[index]
        content = message.get("content")
        if type(content) is str and len(content) > preview_chars:
            omitted = len(content) - preview_chars
            message["content"] = content[:preview_chars] + f"... [{omitted} chars omitted]"
            message["compacted"] = True
    return compacted`,
        checkCode: `messages = [
    {"role": "tool", "call_id": "c1", "content": "abcdefghij"},
    {"role": "tool", "call_id": "c2", "content": "klmnopqrst"},
]
compacted = compact_tool_outputs(messages, keep_recent=1, preview_chars=4)
RESULT = {
    "passed": compacted[0]["content"] == "abcd... [6 chars omitted]" and compacted[0]["call_id"] == "c1" and compacted[1] == messages[1],
    "detail": compacted[0]["content"],
}`,
      },
    ],
  },
  experiment: {
    variant: "context-selection",
    title: "Allocate a context budget",
    intro: "Change the available budget and inspect which instructions, evidence, and historical observations remain.",
  },
});

export const permissionsAndSandboxesLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "permissions-and-sandboxes",
  number: 4,
  lessonNumber: 4,
  eyebrow: "Paths · Policy · Containment",
  title: "Permissions and Sandboxes",
  thesis: "Permissions and sandbox boundaries restrict what an agent can do independently of what the model says.",
  sources: [approvalsSecuritySource, sandboxingSource, promptInjectionSource, owaspPromptInjectionSource, agentsMdSource, pathTraversalSource, toctouSource],
  summary: [
    {
      label: "Instructions are not access control.",
      body: "A model can misunderstand a rule or follow an instruction embedded in untrusted content. File, process, credential, and network permissions therefore need deterministic enforcement outside the model context.",
    },
    {
      label: "Authorization starts with lexical normalization.",
      body: "A path such as src/../.env must be normalized before policy matching. This removes dot segments, but it is not secure filesystem containment: symlinks, mounts, and time-of-check/time-of-use races still require sandbox boundaries or descriptor-based host access.",
    },
    {
      label: "Containment limits the failure surface.",
      body: "A sandbox gives the agent only the workspace, processes, and network routes required for the task. Approval can remain useful for consequential actions, but deny-by-default host boundaries protect the system even when a model decision is wrong.",
    },
  ],
  diagram: {
    title: "Enforced action boundary",
    caption: "The model proposes an action; normalized resources and host policy determine whether it can reach the sandbox.",
    nodes: [
      { label: "Proposed action", value: "operation · target · arguments" },
      { label: "Normalize", value: "lexical path before host resolution" },
      { label: "Policy", value: "deny · confirm · allow" },
      { label: "Sandbox", value: "bounded files · processes · network" },
    ],
  },
  dataset: {
    name: "Permission-policy fixtures",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "12 paths, actions, and overlapping policy rules",
    preview: "workspace read · traversal · symlink caveat · credential access",
  },
  implementation: {
    filename: "permissions-and-sandboxes.py",
    intro: "Normalize a requested workspace path, then make an explicit policy decision for an action.",
    tensorOps: ["Python", "posixpath", "prefix rules", "deny by default"],
    codeBlocks: [
      {
        id: "normalize-workspace-path",
        label: "Normalize a workspace path",
        purpose: "Reject lexical escapes before the host resolves the path inside its real sandbox boundary.",
        concepts: [
          { name: "workspace_root", detail: "The absolute directory exposed to this run." },
          { name: "requested", detail: "A relative path supplied by the proposed action." },
          { name: "containment", detail: "The normalized result must remain under the workspace root." },
        ],
        code: `import posixpath

def normalize_workspace_path(workspace_root, requested):
    if type(workspace_root) is not str or not posixpath.isabs(workspace_root):
        raise ValueError("workspace root must be an absolute path")
    if type(requested) is not str or not requested or "\\x00" in requested:
        raise ValueError("requested path must be non-empty text")
    if posixpath.isabs(requested):
        raise ValueError("requested path must be relative")

    root = posixpath.normpath(workspace_root)
    resolved = posixpath.normpath(posixpath.join(root, requested))
    if posixpath.commonpath([root, resolved]) != root:
        raise ValueError("requested path is outside the workspace")
    return resolved`,
        checkCode: `path = normalize_workspace_path("/workspace", "src/../tests/test_app.py")
RESULT = {
    "passed": path == "/workspace/tests/test_app.py",
    "detail": path,
}`,
      },
      {
        id: "permission-decision",
        label: "Evaluate permission rules",
        purpose: "Apply overlapping host rules with deny-first precedence and a default deny.",
        concepts: [
          { name: "kind", detail: "The operation category, such as read, write, shell, or network." },
          { name: "target_prefix", detail: "The normalized resource range covered by a rule." },
          { name: "precedence", detail: "Deny overrides confirm, which overrides allow." },
        ],
        code: `def permission_decision(action, rules):
    if type(action) is not dict or type(rules) is not list:
        raise ValueError("action must be a dictionary and rules must be a list")
    kind = action.get("kind")
    target = action.get("target")
    if type(kind) is not str or type(target) is not str:
        raise ValueError("action needs text kind and target fields")

    precedence = {"allow": 0, "confirm": 1, "deny": 2}
    matches = []
    for index, rule in enumerate(rules):
        if type(rule) is not dict:
            raise ValueError("every rule must be a dictionary")
        decision = rule.get("decision")
        if decision not in precedence:
            raise ValueError("rule decision must be allow, confirm, or deny")
        rule_kind = rule.get("kind")
        prefix = rule.get("target_prefix")
        if type(rule.get("id")) is not str or type(rule_kind) is not str or type(prefix) is not str:
            raise ValueError("rule id, kind, and target_prefix must be text")
        if not prefix:
            raise ValueError("target_prefix must be non-empty")
        normalized_prefix = prefix.rstrip("/") or "/"
        target_matches = (
            target.startswith("/") if normalized_prefix == "/"
            else target == normalized_prefix or target.startswith(normalized_prefix + "/")
        )
        if rule_kind in (kind, "*") and target_matches:
            matches.append((precedence[decision], len(prefix), -index, rule))

    if not matches:
        return {"decision": "deny", "rule_id": None}
    selected = max(matches, key=lambda match: match[:3])[3]
    return {"decision": selected["decision"], "rule_id": selected["id"]}`,
        checkCode: `rules = [
    {"id": "read-workspace", "kind": "read", "target_prefix": "/workspace", "decision": "allow"},
    {"id": "deny-secrets", "kind": "read", "target_prefix": "/workspace/.env", "decision": "deny"},
]
decision = permission_decision({"kind": "read", "target": "/workspace/.env"}, rules)
RESULT = {
    "passed": decision == {"decision": "deny", "rule_id": "deny-secrets"},
    "detail": f"decision = {decision['decision']}",
}`,
      },
    ],
  },
  experiment: {
    variant: "permission-boundaries",
    title: "Apply a permission boundary",
    intro: "Change the autonomy level and compare decisions for reading source, writing source, accessing credentials, running tests, and using the network.",
  },
});

export const stateAndRecoveryLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "state-and-recovery",
  number: 5,
  lessonNumber: 5,
  eyebrow: "Events · Checkpoints · Replay",
  title: "State and Recovery",
  thesis: "Durable run state records completed work outside the model context and disposable execution environment.",
  sources: [inspectCheckpointingSource, inspectAgentsSource, harnessEngineeringSource],
  summary: [
    {
      label: "A transcript is not the whole run state.",
      body: "The harness also needs explicit records of completed tool calls, checkpoints, errors, and terminal status. Keeping this state outside the model context makes it available to deterministic recovery code and to a replacement execution environment.",
    },
    {
      label: "Replay must be idempotent.",
      body: "Every durable event receives a stable identifier. If delivery is retried, an event already present in the log has no second effect, and a logged completion is not scheduled twice.",
    },
    {
      label: "Recovery separates completed from pending work.",
      body: "A new run replays the event log, restores the latest checkpoint, and compares completed call identifiers with planned work. A crash after an external side effect but before its completion event is persisted remains ambiguous; production tools need idempotency keys, durable receipts, or reconciliation.",
    },
  ],
  diagram: {
    title: "Durable recovery",
    caption: "Run events survive disposable compute and reconstruct the point from which work can safely continue.",
    nodes: [
      { label: "Event log", value: "stable event IDs in append order" },
      { label: "Reducer", value: "completed calls · checkpoint · status" },
      { label: "Failure", value: "the current sandbox can be discarded" },
      { label: "Resume", value: "new compute receives only pending work" },
    ],
  },
  dataset: {
    name: "Run-event fixtures",
    source: "Course-authored synthetic traces",
    license: "Not separately licensed",
    size: "10 completion, checkpoint, failure, and finish events",
    preview: "completed call · duplicate event · checkpoint · expired sandbox",
  },
  implementation: {
    filename: "state-and-recovery.py",
    intro: "Reduce one durable event into run state, then replay a log to identify pending work.",
    tensorOps: ["Python", "copy.deepcopy", "event reduction", "idempotency"],
    codeBlocks: [
      {
        id: "apply-run-event",
        label: "Apply a run event",
        purpose: "Update explicit run state once for each stable event identifier.",
        concepts: [
          { name: "seen", detail: "Event identifiers already incorporated into state." },
          { name: "completed", detail: "Tool-call identifiers whose effects finished." },
          { name: "terminal status", detail: "Failed or completed runs reject later new events." },
        ],
        code: `import copy

def apply_run_event(state, event):
    if type(state) is not dict or type(event) is not dict:
        raise ValueError("state and event must be dictionaries")
    next_state = copy.deepcopy(state)
    seen = next_state.setdefault("seen", [])
    completed = next_state.setdefault("completed", [])
    next_state.setdefault("status", "running")
    next_state.setdefault("checkpoint", None)
    if type(seen) is not list or type(completed) is not list:
        raise ValueError("state seen and completed fields must be lists")

    event_id = event.get("id")
    kind = event.get("kind")
    if type(event_id) is not str or not event_id:
        raise ValueError("event id must be non-empty text")
    if event_id in seen:
        return next_state
    if next_state["status"] in ("failed", "completed"):
        raise ValueError("cannot apply a new event after terminal status")

    if kind == "tool_completed":
        call_id = event.get("call_id")
        if type(call_id) is not str or not call_id:
            raise ValueError("tool_completed needs a call_id")
        if call_id not in completed:
            completed.append(call_id)
    elif kind == "checkpoint":
        summary = event.get("summary")
        if type(summary) is not str or not summary:
            raise ValueError("checkpoint needs a summary")
        next_state["checkpoint"] = summary
    elif kind == "failed":
        next_state["status"] = "failed"
        next_state["error"] = event.get("error")
    elif kind == "finished":
        next_state["status"] = "completed"
        next_state["result"] = event.get("result")
    else:
        raise ValueError("unknown run event kind")

    seen.append(event_id)
    return next_state`,
        checkCode: `state = {"seen": [], "status": "running", "completed": [], "checkpoint": None}
updated = apply_run_event(state, {"id": "e1", "kind": "tool_completed", "call_id": "c1"})
replayed = apply_run_event(updated, {"id": "e1", "kind": "tool_completed", "call_id": "c1"})
RESULT = {
    "passed": state["completed"] == [] and replayed["completed"] == ["c1"] and replayed["seen"] == ["e1"],
    "detail": f"completed calls = {replayed['completed']}",
}`,
      },
      {
        id: "resume-run",
        label: "Derive a resume plan",
        purpose: "Replay a durable log and return completed and pending calls in planned order.",
        concepts: [
          { name: "planned_call_ids", detail: "The complete ordered set of actions expected for this run." },
          { name: "checkpoint", detail: "The latest durable summary needed to continue." },
          { name: "pending", detail: "Planned calls that have no completion event." },
        ],
        code: `def resume_run(events, planned_call_ids):
    if type(events) is not list or type(planned_call_ids) is not list:
        raise ValueError("events and planned_call_ids must be lists")
    if any(type(call_id) is not str or not call_id for call_id in planned_call_ids):
        raise ValueError("planned call ids must be non-empty text")
    if len(set(planned_call_ids)) != len(planned_call_ids):
        raise ValueError("planned call ids must be unique")

    planned = set(planned_call_ids)
    seen = set()
    completed = []
    checkpoint = None
    status = "running"

    for event in events:
        if type(event) is not dict or type(event.get("id")) is not str or not event["id"]:
            raise ValueError("every event needs a non-empty text id")
        if event["id"] in seen:
            continue
        if status in ("failed", "completed"):
            raise ValueError("event log continues after terminal status")
        seen.add(event["id"])
        kind = event.get("kind")
        if kind == "tool_completed":
            call_id = event.get("call_id")
            if call_id not in planned:
                raise ValueError("completed call is not in the plan")
            if call_id not in completed:
                completed.append(call_id)
        elif kind == "checkpoint":
            if type(event.get("summary")) is not str or not event["summary"]:
                raise ValueError("checkpoint needs a summary")
            checkpoint = event["summary"]
        elif kind == "failed":
            status = "failed"
        elif kind == "finished":
            status = "completed"
        else:
            raise ValueError("unknown run event kind")

    return {
        "status": status,
        "checkpoint": checkpoint,
        "completed": [call_id for call_id in planned_call_ids if call_id in completed],
        "pending": [call_id for call_id in planned_call_ids if call_id not in completed],
    }`,
        checkCode: `resume = resume_run(
    [
        {"id": "e1", "kind": "tool_completed", "call_id": "c1"},
        {"id": "e2", "kind": "checkpoint", "summary": "tests collected"},
        {"id": "e3", "kind": "failed", "error": "sandbox expired"},
    ],
    ["c1", "c2", "c3"],
)
RESULT = {
    "passed": resume == {"status": "failed", "checkpoint": "tests collected", "completed": ["c1"], "pending": ["c2", "c3"]},
    "detail": f"pending calls = {resume['pending']}",
}`,
      },
    ],
  },
  experiment: {
    variant: "state-and-recovery",
    title: "Resume after failure",
    intro: "Move the failure point and compare a blind restart with replay from durable completion events.",
  },
});

export const agentEvaluationsLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "agent-evaluations",
  number: 6,
  lessonNumber: 6,
  eyebrow: "Tasks · Graders · Trials",
  title: "Agent Evaluations",
  thesis: "Agent evaluations grade observable outcomes across repeated trials instead of requiring one exact trajectory.",
  sources: [sweBenchSource, inspectMetricsSource, humanEvalSource, tauBenchSource],
  summary: [
    {
      label: "A task is evaluated through one or more trials.",
      body: "Each trial starts from a defined environment, runs the model and harness, and records both a transcript and a final outcome. Repeating the same task matters because model behavior can vary even when the initial state is fixed.",
    },
    {
      label: "Outcome graders permit valid alternative paths.",
      body: "For a coding task, executable tests and repository state are usually stronger evidence than a final claim or an exact sequence of tools. Trace checks remain useful for constraints such as forbidden actions, excessive turns, or missing approvals.",
    },
    {
      label: "Capability and consistency are different measurements.",
      body: "pass@k asks whether at least one of k attempts succeeds, while pass^k asks whether every attempt succeeds. With a finite set of observed trials, standard benchmark reducers estimate these quantities by enumerating k-sized subsets of the observed results without replacement rather than treating the empirical rate as a known IID probability.",
    },
  ],
  diagram: {
    title: "Evaluation unit",
    caption: "A task creates trials; each trial yields a trace and outcome; graders turn those records into comparable measurements.",
    nodes: [
      { label: "Task", value: "initial state · instructions · success criteria" },
      { label: "Trial", value: "model + harness + tools" },
      { label: "Evidence", value: "transcript · final environment state" },
      { label: "Metrics", value: "graders · pass rate · pass@k · pass^k" },
    ],
  },
  dataset: {
    name: "Agent-evaluation fixtures",
    source: "Course-authored synthetic outcomes",
    license: "Not separately licensed",
    size: "8 outcomes, requirements, and trial sets",
    preview: "passing tests · false completion claim · repeated successes",
  },
  implementation: {
    filename: "agent-evaluations.py",
    intro: "Grade a final environment state, then summarize success across repeated trials.",
    tensorOps: ["Python", "comparisons", "membership", "probability"],
    codeBlocks: [
      {
        id: "grade-outcome",
        label: "Grade an outcome",
        purpose: "Apply deterministic equality, threshold, and containment requirements to final state.",
        concepts: [
          { name: "outcome", detail: "The observable environment state after a trial." },
          { name: "requirement", detail: "One field, comparison operator, and expected value." },
          { name: "failed_fields", detail: "Criteria that the final state did not satisfy." },
        ],
        code: `def grade_outcome(outcome, requirements):
    if type(outcome) is not dict or type(requirements) is not list:
        raise ValueError("outcome must be a dictionary and requirements must be a list")

    failed = []
    for requirement in requirements:
        if type(requirement) is not dict:
            raise ValueError("every requirement must be a dictionary")
        field = requirement.get("field")
        operation = requirement.get("op")
        expected = requirement.get("value")
        if type(field) is not str or operation not in ("eq", "gte", "lte", "contains"):
            raise ValueError("requirement needs a field and supported operation")

        if field not in outcome:
            passed = False
        else:
            actual = outcome[field]
            try:
                if operation == "eq":
                    if type(actual) is bool or type(expected) is bool:
                        passed = type(actual) is type(expected) and actual == expected
                    else:
                        passed = actual == expected
                elif operation == "gte":
                    passed = actual >= expected
                elif operation == "lte":
                    passed = actual <= expected
                else:
                    passed = expected in actual
            except (TypeError, ValueError):
                passed = False
        if not passed:
            failed.append(field)

    return {"passed": not failed, "failed_fields": failed}`,
        checkCode: `grade = grade_outcome(
    {"tests_passed": True, "coverage": 0.86, "changed_files": ["src/app.py"]},
    [
        {"field": "tests_passed", "op": "eq", "value": True},
        {"field": "coverage", "op": "gte", "value": 0.8},
        {"field": "changed_files", "op": "contains", "value": "src/app.py"},
    ],
)
RESULT = {
    "passed": grade == {"passed": True, "failed_fields": []},
    "detail": f"failed fields = {grade['failed_fields']}",
}`,
      },
      {
        id: "trial-metrics",
        label: "Compute trial metrics",
        purpose: "Estimate at-least-one success and repeated consistency from finite observed trials.",
        concepts: [
          { name: "pass_rate", detail: "The successful fraction of observed trials." },
          { name: "pass_at_k", detail: "The draw-without-replacement estimate that at least one of k attempts succeeds." },
          { name: "pass_k", detail: "The draw-without-replacement estimate that all k attempts succeed." },
        ],
        code: `import math

def trial_metrics(successes, k):
    if type(successes) is not list or not successes:
        raise ValueError("successes must be a non-empty list")
    if any(type(value) is not bool for value in successes):
        raise ValueError("every trial result must be a boolean")
    if type(k) is not int or k < 1:
        raise ValueError("k must be a positive integer")
    if k > len(successes):
        raise ValueError("k cannot exceed the number of observed trials")

    total = len(successes)
    correct = sum(1 for value in successes if value)
    combinations = math.comb(total, k)
    return {
        "pass_rate": correct / total,
        "pass_at_k": 1 - (math.comb(total - correct, k) / combinations if total - correct >= k else 0),
        "pass_k": math.comb(correct, k) / combinations if correct >= k else 0,
    }`,
        checkCode: `metrics = trial_metrics([True, False, True, False], 2)
RESULT = {
    "passed": abs(metrics["pass_at_k"] - 5 / 6) < 1e-12 and abs(metrics["pass_k"] - 1 / 6) < 1e-12,
    "detail": f"pass@2 {metrics['pass_at_k']:.3f} · pass^2 {metrics['pass_k']:.3f}",
}`,
      },
    ],
  },
  experiment: {
    variant: "agent-evaluations",
    title: "Compare repeated-trial metrics",
    intro: "Change the observed successes and compare finite-sample pass@3 with pass³.",
  },
});

export const taskOrchestrationLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "task-orchestration",
  number: 7,
  lessonNumber: 7,
  eyebrow: "Dependencies · Parallelism · Results",
  title: "Task Orchestration",
  thesis: "Task orchestration schedules independent work concurrently while preserving explicit dependency and result contracts.",
  sources: [buildingEffectiveAgentsSource, inspectAgentsSource, harnessEngineeringSource],
  summary: [
    {
      label: "Parallel work requires independence.",
      body: "Tasks can share an execution batch only when their dependencies are complete and they do not require the same changing intermediate state. The exercise models declared dependencies; resource conflicts must be converted into dependencies or rejected before scheduling.",
    },
    {
      label: "Delegation needs a result contract.",
      body: "A worker assignment identifies the objective, allowed scope, dependencies, and expected output. The coordinator rejects missing, duplicate, or unexpected results before using them in later work.",
    },
    {
      label: "More workers are not automatically better.",
      body: "Parallel agents add model calls, context, and coordination overhead. They are most useful when substantial work can proceed independently; a short deterministic step or a task with one long dependency chain should remain single-threaded.",
    },
  ],
  diagram: {
    title: "Dependency-aware execution",
    caption: "Ready tasks run together; dependent work waits; the coordinator restores one deterministic result order.",
    nodes: [
      { label: "Task graph", value: "IDs · dependencies · declared order" },
      { label: "Ready batch", value: "all dependencies already completed" },
      { label: "Workers", value: "independent contexts and bounded assignments" },
      { label: "Coordinator", value: "validate · order · pass results forward" },
    ],
  },
  dataset: {
    name: "Task-graph fixtures",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "9 acyclic, cyclic, and incomplete task graphs",
    preview: "parallel inspection · dependent implementation · missing result",
  },
  implementation: {
    filename: "task-orchestration.py",
    intro: "Build dependency-safe execution batches, then collect asynchronous worker results in task order.",
    tensorOps: ["Python", "sets", "topological ordering", "dictionary indexing"],
    codeBlocks: [
      {
        id: "parallel-batches",
        label: "Build parallel batches",
        purpose: "Group tasks whose declared dependencies are already complete.",
        concepts: [
          { name: "depends_on", detail: "Task identifiers that must finish before this task starts." },
          { name: "ready batch", detail: "Every remaining task whose dependencies are in the completed set." },
          { name: "cycle", detail: "Remaining tasks exist but none can become ready." },
        ],
        code: `def parallel_batches(tasks):
    if type(tasks) is not list:
        raise ValueError("tasks must be a list")

    ordered_ids = []
    dependencies = {}
    for task in tasks:
        if type(task) is not dict or type(task.get("id")) is not str:
            raise ValueError("every task needs a text id")
        task_id = task["id"]
        depends_on = task.get("depends_on", [])
        if not task_id or type(depends_on) is not list or any(type(value) is not str for value in depends_on):
            raise ValueError("task ids and dependencies must be text")
        if task_id in dependencies:
            raise ValueError("task ids must be unique")
        if len(set(depends_on)) != len(depends_on):
            raise ValueError("task dependencies must be unique")
        ordered_ids.append(task_id)
        dependencies[task_id] = set(depends_on)

    known = set(ordered_ids)
    for task_id, required in dependencies.items():
        missing = required - known
        if missing:
            raise ValueError("missing dependency for " + task_id)

    remaining = set(ordered_ids)
    completed = set()
    batches = []
    while remaining:
        ready = [
            task_id for task_id in ordered_ids
            if task_id in remaining and dependencies[task_id] <= completed
        ]
        if not ready:
            raise ValueError("task graph contains a cycle")
        batches.append(ready)
        completed.update(ready)
        remaining.difference_update(ready)
    return batches`,
        checkCode: `batches = parallel_batches([
    {"id": "inspect", "depends_on": []},
    {"id": "research", "depends_on": []},
    {"id": "implement", "depends_on": ["inspect"]},
    {"id": "verify", "depends_on": ["implement", "research"]},
])
RESULT = {
    "passed": batches == [["inspect", "research"], ["implement"], ["verify"]],
    "detail": f"execution batches = {batches}",
}`,
      },
      {
        id: "collect-worker-results",
        label: "Collect worker results",
        purpose: "Require one result per task and restore declared task order after asynchronous completion.",
        concepts: [
          { name: "task_ids", detail: "The coordinator's declared result order." },
          { name: "worker result", detail: "One dictionary carrying the task_id and its output or error." },
          { name: "cardinality", detail: "Missing, duplicate, and unexpected task results are invalid." },
        ],
        code: `def collect_worker_results(task_ids, results):
    if type(task_ids) is not list or type(results) is not list:
        raise ValueError("task_ids and results must be lists")
    if any(type(task_id) is not str or not task_id for task_id in task_ids):
        raise ValueError("task ids must be non-empty text")
    if len(set(task_ids)) != len(task_ids):
        raise ValueError("task ids must be unique")

    expected = set(task_ids)
    by_id = {}
    for result in results:
        if type(result) is not dict or type(result.get("task_id")) is not str:
            raise ValueError("every result needs a text task_id")
        task_id = result["task_id"]
        if task_id not in expected:
            raise ValueError("unexpected worker result")
        if task_id in by_id:
            raise ValueError("duplicate worker result")
        by_id[task_id] = result

    missing = [task_id for task_id in task_ids if task_id not in by_id]
    if missing:
        raise ValueError("missing worker result: " + missing[0])
    return [by_id[task_id] for task_id in task_ids]`,
        checkCode: `ordered = collect_worker_results(
    ["inspect", "research"],
    [
        {"task_id": "research", "status": "ok", "value": "sources"},
        {"task_id": "inspect", "status": "ok", "value": "files"},
    ],
)
RESULT = {
    "passed": [result["task_id"] for result in ordered] == ["inspect", "research"],
    "detail": f"result order = {[result['task_id'] for result in ordered]}",
}`,
      },
    ],
  },
  experiment: {
    variant: "task-orchestration",
    title: "Schedule a task graph",
    intro: "Change the worker count and inspect a dependency-respecting schedule for the same task graph.",
  },
});

export const integratedHarnessLesson = defineHarnessLesson({
  ...harnessIdentity,
  id: "integrated-harness",
  number: 8,
  lessonNumber: 8,
  eyebrow: "Adapters · Policy · Loop",
  title: "Integrated Harness",
  thesis: "A complete harness composes model and tool adapters with validation, policy, limits, observations, and an auditable terminal state.",
  sources: [harnessEngineeringSource, buildingEffectiveAgentsSource, approvalsSecuritySource],
  summary: [
    {
      label: "Adapters keep the loop model-agnostic.",
      body: "The loop consumes structured responses and tool results through narrow interfaces. The browser lab uses recorded responses and deterministic tool fixtures; a production adapter can replace either side when it preserves the same interface and semantics.",
    },
    {
      label: "One host transition owns every consequential decision.",
      body: "Each turn validates exactly one response, checks the tool contract, evaluates permission rules, enforces the remaining budget, and records an observation. A confirmation pauses the run before dispatch, while a denial becomes an error observation the next model turn can inspect.",
    },
    {
      label: "The trace is a testable product of the run.",
      body: "The final state includes messages and host events rather than only final text. An independent audit can detect orphaned results, duplicate call identifiers, unresolved actions, or events written after completion.",
    },
  ],
  diagram: {
    title: "Composed execution path",
    caption: "Recorded adapters make the browser exercise deterministic; the same host boundaries apply when live model and tool adapters are substituted.",
    nodes: [
      { label: "Model adapter", value: "one final response or tool call" },
      { label: "Host transition", value: "validate · authorize · enforce budget" },
      { label: "Tool adapter", value: "bounded result or explicit error" },
      { label: "Run record", value: "messages · events · terminal status" },
    ],
  },
  dataset: {
    name: "Integrated harness traces",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "11 complete, denied, approval-gated, and malformed runs",
    preview: "read then answer · denied secret · approval pause · exhausted budget",
  },
  implementation: {
    filename: "integrated-harness.py",
    intro: "Run a complete deterministic harness trace, then audit the resulting protocol state.",
    tensorOps: ["Python", "copy", "state machine", "policy", "event log"],
    codeBlocks: [
      {
        id: "run-harness",
        label: "Run the harness",
        purpose: "Compose response validation, typed tool dispatch, permission policy, observations, and a turn budget.",
        concepts: [
          { name: "responses", detail: "Recorded model-adapter outputs used as deterministic turns in this browser lab." },
          { name: "tools", detail: "Small typed descriptors whose outputs stand in for production tool adapters." },
          { name: "rules", detail: "Host-owned allow, confirm, and deny decisions evaluated before dispatch." },
        ],
        code: `import copy
import posixpath

def run_harness(initial_messages, responses, tools, rules, max_turns):
    if type(initial_messages) is not list or type(responses) is not list:
        raise ValueError("messages and responses must be lists")
    if type(tools) is not list or type(rules) is not list:
        raise ValueError("tools and rules must be lists")
    if type(max_turns) is not int or max_turns < 1:
        raise ValueError("max_turns must be a positive integer")

    type_checks = {
        "str": lambda value: type(value) is str,
        "int": lambda value: type(value) is int,
        "bool": lambda value: type(value) is bool,
        "list": lambda value: type(value) is list,
        "dict": lambda value: type(value) is dict,
    }
    tool_by_name = {}
    for tool in tools:
        if type(tool) is not dict or type(tool.get("name")) is not str:
            raise ValueError("every tool needs a text name")
        name = tool["name"]
        if name in tool_by_name:
            raise ValueError("tool names must be unique")
        required = tool.get("required")
        if type(required) is not dict or any(kind not in type_checks for kind in required.values()):
            raise ValueError("every tool needs supported required field types")
        if type(tool.get("kind")) is not str or type(tool.get("target_arg")) is not str:
            raise ValueError("every tool needs kind and target_arg text")
        if type(tool.get("outputs")) is not dict:
            raise ValueError("every tool needs deterministic adapter outputs")
        tool_by_name[name] = tool

    precedence = {"allow": 0, "confirm": 1, "deny": 2}

    def policy_decision(kind, target):
        matches = []
        for index, rule in enumerate(rules):
            if type(rule) is not dict or rule.get("decision") not in precedence:
                raise ValueError("every rule needs an allow, confirm, or deny decision")
            prefix = rule.get("target_prefix")
            rule_kind = rule.get("kind")
            if type(rule.get("id")) is not str or type(prefix) is not str or not prefix or type(rule_kind) is not str:
                raise ValueError("every rule needs id, kind, and non-empty target_prefix text")
            boundary = prefix.rstrip("/") or "/"
            target_matches = target.startswith("/") if boundary == "/" else target == boundary or target.startswith(boundary + "/")
            if rule_kind in (kind, "*") and target_matches:
                matches.append((precedence[rule["decision"]], len(prefix), -index, rule))
        if not matches:
            return {"decision": "deny", "rule_id": None}
        selected = max(matches, key=lambda item: item[:3])[3]
        return {"decision": selected["decision"], "rule_id": selected["id"]}

    history = copy.deepcopy(initial_messages)
    events = []
    seen_call_ids = set()
    dispatched = 0

    for turn in range(1, max_turns + 1):
        if turn > len(responses):
            events.append({"kind": "model_exhausted", "turn": turn})
            return {"status": "model_exhausted", "final": None, "turns": turn - 1, "tool_calls": dispatched, "messages": history, "events": events}

        response = responses[turn - 1]
        if type(response) is not dict:
            raise ValueError("every response must be a dictionary")
        has_final = "final" in response
        has_call = "tool_call" in response
        if has_final == has_call:
            raise ValueError("each response needs exactly one final or tool_call")

        if has_final:
            final = response["final"]
            if type(final) is not str or not final.strip():
                raise ValueError("final must be non-empty text")
            history.append({"role": "assistant", "content": final})
            events.append({"kind": "run_completed", "turn": turn})
            return {"status": "completed", "final": final, "turns": turn, "tool_calls": dispatched, "messages": history, "events": events}

        call = response["tool_call"]
        if type(call) is not dict:
            raise ValueError("tool_call must be a dictionary")
        call_id = call.get("id")
        name = call.get("name")
        arguments = call.get("arguments")
        if type(call_id) is not str or not call_id or call_id in seen_call_ids:
            raise ValueError("tool call ids must be unique non-empty text")
        if type(name) is not str or name not in tool_by_name:
            raise ValueError("unknown tool")
        if type(arguments) is not dict:
            raise ValueError("tool arguments must be a dictionary")

        tool = tool_by_name[name]
        required = tool["required"]
        if set(arguments) != set(required):
            raise ValueError("tool arguments must exactly match required fields")
        for field, expected in required.items():
            if not type_checks[expected](arguments[field]):
                raise ValueError(field + " must have type " + expected)
        target = arguments.get(tool["target_arg"])
        if type(target) is not str:
            raise ValueError("the tool target must be text")
        if tool["kind"] in ("read", "write"):
            if not posixpath.isabs(target):
                raise ValueError("filesystem tool targets must be absolute")
            target = posixpath.normpath(target)

        seen_call_ids.add(call_id)
        history.append({"role": "assistant", "tool_call": copy.deepcopy(call)})
        events.append({"kind": "action_proposed", "turn": turn, "call_id": call_id, "tool": name})
        policy = policy_decision(tool["kind"], target)
        events.append({"kind": "policy_decision", "call_id": call_id, **policy})

        if policy["decision"] == "confirm":
            return {"status": "approval_required", "final": None, "turns": turn, "tool_calls": dispatched, "pending_call": call_id, "messages": history, "events": events}

        is_error = policy["decision"] == "deny"
        if is_error:
            content = "permission denied"
            events.append({"kind": "tool_denied", "call_id": call_id})
        else:
            if call_id not in tool["outputs"]:
                raise ValueError("the tool adapter has no output for call " + call_id)
            content = copy.deepcopy(tool["outputs"][call_id])
            dispatched += 1
            events.append({"kind": "tool_completed", "call_id": call_id})
        history.append({"role": "tool", "call_id": call_id, "content": content, "is_error": is_error})

    events.append({"kind": "budget_exceeded", "turn": max_turns})
    return {"status": "budget_exceeded", "final": None, "turns": max_turns, "tool_calls": dispatched, "messages": history, "events": events}`,
        checkCode: `run = run_harness(
    [{"role": "user", "content": "Read app.py"}],
    [
        {"tool_call": {"id": "c1", "name": "read_file", "arguments": {"path": "/workspace/app.py"}}},
        {"final": "The file defines the application."},
    ],
    [{"name": "read_file", "kind": "read", "target_arg": "path", "required": {"path": "str"}, "outputs": {"c1": "def main(): pass"}}],
    [{"id": "workspace-read", "kind": "read", "target_prefix": "/workspace", "decision": "allow"}],
    4,
)
RESULT = {
    "passed": run["status"] == "completed" and run["tool_calls"] == 1 and run["final"] == "The file defines the application.",
    "detail": f"{run['status']} after {run['turns']} turns and {run['tool_calls']} tool call",
}`,
      },
      {
        id: "audit-harness-run",
        label: "Audit a harness run",
        purpose: "Detect broken call-result pairing and invalid terminal state without prescribing one model trajectory.",
        concepts: [
          { name: "call pairing", detail: "Every tool result resolves one earlier unique assistant call identifier." },
          { name: "terminal state", detail: "A completed run ends with final assistant text and no unresolved calls." },
          { name: "approval pause", detail: "The pending call remains unresolved because dispatch has not occurred." },
        ],
        code: `def audit_harness_run(run):
    if type(run) is not dict or type(run.get("messages")) is not list:
        raise ValueError("run needs a message list")

    issues = []
    calls = set()
    resolved = set()
    final_positions = []
    for index, message in enumerate(run["messages"]):
        if type(message) is not dict:
            issues.append("message " + str(index) + " is not a dictionary")
            continue
        if message.get("role") == "assistant" and type(message.get("tool_call")) is dict:
            call_id = message["tool_call"].get("id")
            if type(call_id) is not str or not call_id:
                issues.append("tool call id is missing")
            elif call_id in calls:
                issues.append("duplicate tool call " + call_id)
            else:
                calls.add(call_id)
        elif message.get("role") == "tool":
            call_id = message.get("call_id")
            if call_id not in calls:
                issues.append("orphan tool result " + str(call_id))
            elif call_id in resolved:
                issues.append("duplicate tool result " + str(call_id))
            else:
                resolved.add(call_id)
        elif message.get("role") == "assistant" and type(message.get("content")) is str:
            final_positions.append(index)

    status = run.get("status")
    if status == "completed":
        if not final_positions or final_positions[-1] != len(run["messages"]) - 1:
            issues.append("a completed run must end with final assistant text")
        unresolved = sorted(calls - resolved)
        if unresolved:
            issues.append("completed run has unresolved calls: " + ", ".join(unresolved))
    elif status == "approval_required":
        pending = run.get("pending_call")
        if pending not in calls or pending in resolved:
            issues.append("approval_required needs one unresolved pending call")
    elif status not in ("budget_exceeded", "model_exhausted"):
        issues.append("unknown run status")

    events = run.get("events")
    if type(events) is not list or not events:
        issues.append("run has no host events")
    elif status == "completed" and events[-1].get("kind") != "run_completed":
        issues.append("completion must be the final host event")
    return {"valid": not issues, "issues": issues}`,
        checkCode: `audit = audit_harness_run({
    "status": "completed",
    "messages": [
        {"role": "assistant", "tool_call": {"id": "c1", "name": "read_file"}},
        {"role": "tool", "call_id": "c1", "content": "file", "is_error": False},
        {"role": "assistant", "content": "Done"},
    ],
    "events": [{"kind": "tool_completed"}, {"kind": "run_completed"}],
})
RESULT = {
    "passed": audit == {"valid": True, "issues": []},
    "detail": f"issues = {audit['issues']}",
}`,
      },
    ],
  },
  experiment: {
    variant: "integrated-harness",
    title: "Run the composed loop",
    intro: "Change the host turn budget and inspect the same tool-then-final trace.",
  },
});

export const harnessEngineeringLessons = [
  agentLoopLesson,
  toolContractsLesson,
  contextSelectionLesson,
  permissionsAndSandboxesLesson,
  stateAndRecoveryLesson,
  agentEvaluationsLesson,
  taskOrchestrationLesson,
  integratedHarnessLesson,
];
