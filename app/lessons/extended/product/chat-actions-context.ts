import { defineExtendedLesson } from "../define-lesson";

export const chatActionsContextLesson = defineExtendedLesson({
    id: "chat-actions-context",
    number: 13,
    courseId: "product",
    courseTitle: "Chat Integration",
    courseNumber: 4,
    lessonNumber: 3,
    mode: "core-mechanism",
    modeLabel: "Interaction state lab",
    eyebrow: "Product · Stop, retry, context",
    title: "Actions and Context",
    thesis: "Editing, regenerating, stopping, and retrying are graph operations over conversation history whose model context must be reconstructed under a finite token budget.",
    paperUrl: "https://platform.openai.com/docs/guides/conversation-state",
    paperTitle: "Conversation state",
    authors: "OpenAI API documentation",
    year: "Current reference",
    summary: [
      { label: "Branch graph.", body: "Stop retains the partial assistant record with cancelled status. Retry or regenerate adds a new assistant attempt from the same user prefix; editing a user message creates a new branch and invalidates dependent descendants without erasing them." },
      { label: "Request assembly.", body: "System instructions and the active user prompt are required request inputs. Completed history is admitted only as user-assistant pairs, newest pair first, then emitted in chronological order so truncation never creates an orphan half-turn." },
      { label: "Budget contract.", body: "If a newer completed pair is too large, selection continues to older pairs that may fit. Token use is the exact sum of selected records. If required system instructions alone exceed the selector budget, they remain selected and overflow is reported; the caller must not send that request unchanged." },
      { label: "Attempt record.", body: "Every attempt records stable message, parent-user, attempt, and request ids together with model id, prompt version, sampling policy, included message ids, and terminal status so two outputs can be explained and replayed." },
    ],
    claims: {
      paper: "Conversation state can be represented explicitly and carried across model requests rather than inferred from rendered UI.",
      lab: "Three selectable action flows retain cancellation, allocate new attempt and request ids, expose edit invalidation, and rebuild the exact request as the token budget changes.",
      limit: "Token estimates are deterministic approximations rather than the selected model's production tokenizer.",
    },
    diagram: {
      title: "One prefix, three actions, one request boundary",
      caption: "Stopping retains a cancelled partial attempt. Retry allocates a new attempt and request from the same user; edit creates a new user branch and invalidates the old descendant. Request assembly keeps required inputs, then admits complete historical pairs newest-first under the remaining budget.",
      nodes: [
        { label: "Active prefix", value: "s1 → m-u3" },
        { label: "Stop", value: "m-a3 · a-31 · r-31 · cancelled" },
        { label: "Retry", value: "m-a4 · a-32 · r-32 · queued" },
        { label: "Edit", value: "m-u3-e1 → m-a5 · a-33 · r-33" },
        { label: "Request", value: "required prefix + complete turn units ≤ budget" },
      ],
    },
    questions: { intro: "Ask about branching history, cancellation, retries, prompt records, or token-budget policy.", suggestions: ["What should regenerate preserve?", "Should stopping delete partial text?", "Which messages leave the context first?"] },
    dataset: { name: "Branching Conversation", source: "Original deterministic scenario", license: "CC0", size: "3 action flows · 29 budgets (14–42)", preview: "stop partial → retry same prefix → edit into a new branch" },
    implementation: {
      filename: "chat-actions.py",
      intro: "Implement bounded context selection and regeneration branching in Python before manipulating a complete conversation graph.",
      codeBlocks: [
        {
          id: "context-budget",
          label: "Context selection",
          purpose: "Assemble the exact request: required system instructions and active user prompt plus the newest complete historical pairs that fit.",
          concepts: [
            { name: "history", detail: "Only adjacent complete user-assistant pairs are admissible; streaming, cancelled, error, and orphan records are skipped." },
            { name: "active_user", detail: "Required current prompt, selected after system and historical context and counted inside the same budget." },
            { name: "overflow", detail: "True when required system plus active-user tokens already exceed budget; the caller must not send the request unchanged." },
          ],
          code: `def select_context(options):
    system = options["system"]
    history = options["history"]
    active_user = options["activeUser"]
    budget = options["budget"]

    required_system = [
        message for message in system if message.get("role") == "system"
    ]
    turns = []
    index = 0
    while index < len(history) - 1:
        user = history[index]
        assistant = history[index + 1]
        is_complete_turn = (
            user.get("role") == "user"
            and user.get("status") == "complete"
            and assistant.get("role") == "assistant"
            and assistant.get("status") == "complete"
        )
        if is_complete_turn:
            turns.append([user, assistant])
            index += 2
        else:
            index += 1

    selected_turns = []
    used = sum(message["tokens"] for message in required_system) + active_user["tokens"]
    overflow = used > budget
    if not overflow:
        for turn in reversed(turns):
            turn_tokens = sum(message["tokens"] for message in turn)
            if used + turn_tokens <= budget:
                selected_turns.insert(0, turn)
                used += turn_tokens

    selected_history = [
        message for turn in selected_turns for message in turn
    ]
    return {
        "selected": required_system + selected_history + [active_user],
        "used": used,
        "overflow": overflow,
    }`,
          checkCode: `result = select_context({
    "system": [{"id": "s", "role": "system", "tokens": 4}],
    "history": [
        {"id": "u1", "role": "user", "status": "complete", "tokens": 3},
        {"id": "a1", "role": "assistant", "status": "complete", "tokens": 3},
        {"id": "u2", "role": "user", "status": "complete", "tokens": 4},
        {"id": "a2", "role": "assistant", "status": "complete", "tokens": 4},
    ],
    "activeUser": {"id": "u3", "role": "user", "status": "complete", "tokens": 2},
    "budget": 14,
})
selected_ids = ",".join(message["id"] for message in result["selected"])
RESULT = {
    "passed": selected_ids == "s,u2,a2,u3" and result["used"] == 14 and result["overflow"] is False,
    "detail": " → ".join(message["id"] for message in result["selected"]) + f' · {result["used"]} tokens',
}`,
        },
        {
          id: "regenerate-branch",
          label: "Regeneration branch",
          purpose: "Create the exact queued assistant record for a new generation attempt and transport request without copying caller-only fields.",
          concepts: [
            { name: "parent_user_id", detail: "Branch point shared by all regenerated attempts." },
            { name: "attempt_id", detail: "Unique identity for metrics and model parameters." },
            { name: "request_id", detail: "Unique identity for this transport lifecycle and its incoming events." },
          ],
          code: `def create_regeneration(options):
    return {
        "messageId": options["messageId"],
        "parentUserId": options["parentUserId"],
        "attemptId": options["attemptId"],
        "requestId": options["requestId"],
        "role": "assistant",
        "content": "",
        "status": "queued",
    }`,
          checkCode: `branch = create_regeneration({
    "messageId": "m9",
    "parentUserId": "m4",
    "attemptId": "a2",
    "requestId": "r2",
})
RESULT = {
    "passed": (
        branch["parentUserId"] == "m4"
        and branch["attemptId"] == "a2"
        and branch["requestId"] == "r2"
        and branch["status"] == "queued"
    ),
    "detail": f'{branch["attemptId"]} → {branch["requestId"]}',
}`,
        },
      ],
    },
    experiment: { kind: "product", variant: "context-actions", title: "Branch the conversation", intro: "Choose Stop, Retry / regenerate, or Edit prompt, then vary the 14–42 token request budget. Inspect retained partial text, invalidated descendants, exact message / attempt / request ids, included and excluded context ids with token reasons, and the recorded model, prompt, and sampling policy." },
  });
