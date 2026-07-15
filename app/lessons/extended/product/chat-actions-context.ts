import { defineExtendedLesson } from "../define-lesson";

export const chatActionsContextLesson = defineExtendedLesson({
    id: "chat-actions-context",
    number: 13,
    courseId: "product",
    courseTitle: "Chat Integration",
    courseNumber: 4,
    lessonNumber: 3,
    mode: "core-mechanism",
    modeLabel: "Interaction state workshop",
    eyebrow: "Product · Stop, retry, context",
    title: "Actions and Context",
    thesis: "Editing, regenerating, stopping, and retrying all change the conversation graph. After any of them, you need to rebuild the model context within a fixed token budget.",
    paperUrl: "https://platform.openai.com/docs/guides/conversation-state",
    paperTitle: "Conversation state",
    authors: "OpenAI API documentation",
    year: "Current docs",
    summary: [
      { label: "How branches work.", body: "Stop keeps the partial assistant message and marks it cancelled. Retry or regenerate starts a new assistant attempt from the same user message. Editing a user message starts a new branch and marks everything that depended on the old version invalid without deleting it." },
      { label: "Building the request.", body: "The system instructions and current user prompt always go into the request. Completed history can only come along in full user-assistant pairs. Pick the newest pairs first, then send them in time order so truncation never leaves half a turn behind." },
      { label: "Staying in budget.", body: "If a newer completed pair is too big, keep looking for older pairs that fit. The token count is the exact total for the records you picked. If the required system instructions already exceed the budget, keep them selected; overflow is reported, and the caller shouldn't send that request as-is." },
      { label: "Tracking each attempt.", body: "For every attempt, save stable message, parent-user, attempt, and request ids. Also save the model id, prompt version, sampling policy, included message ids, and final status. That gives you what you need to explain or replay two different outputs." },
    ],
    claims: {
      paper: "You can store conversation state directly and carry it from one model request to the next instead of trying to reconstruct it from the UI.",
      lab: "The three action flows keep cancelled output, create new attempt and request ids, show what an edit invalidates, and rebuild the exact request as you change the token budget.",
      limit: "The token counts are fixed estimates, not results from the selected model's production tokenizer.",
    },
    diagram: {
      title: "One prefix, three actions, one request boundary",
      caption: "Stopping keeps a cancelled partial attempt. Retry creates a new attempt and request from the same user message. Edit starts a new user branch and invalidates the old follow-up. When you build the next request, keep the required inputs, consider complete historical pairs from newest to oldest, and send the selected pairs in time order.",
      nodes: [
        { label: "Active prefix", value: "s1 → m-u3" },
        { label: "Stop", value: "m-a3 · a-31 · r-31 · cancelled" },
        { label: "Retry", value: "m-a4 · a-32 · r-32 · queued" },
        { label: "Edit", value: "m-u3-e1 → m-a5 · a-33 · r-33" },
        { label: "Request", value: "required prefix + complete turn units ≤ budget" },
      ],
    },
    questions: { intro: "Ask about conversation branches, cancellation, retries, prompt records, or how the token budget works.", suggestions: ["What should regenerate keep?", "Should stopping delete partial text?", "Which messages should leave the context first?"] },
    dataset: { name: "Branching Conversation", source: "Original fixed scenario", license: "CC0", size: "3 action flows · 29 budgets (14–42)", preview: "stop midway → retry from the same point → edit into a new branch" },
    implementation: {
      filename: "chat-actions.py",
      intro: "Build token-limited context selection and regeneration branches in Python before you work with a full conversation graph.",
      codeBlocks: [
        {
          id: "context-budget",
          label: "Context selection",
          purpose: "Build the exact request from the required system instructions, the current user prompt, and the newest complete history pairs that fit.",
          concepts: [
            { name: "history", detail: "Only complete user-assistant pairs next to each other can be included. Skip streaming, cancelled, error, and orphan records." },
            { name: "active_user", detail: "The current prompt is required. It comes after the system and history context and counts toward the same budget." },
            { name: "overflow", detail: "True when the required system and current user prompt already exceed the budget. The caller shouldn't send that request unchanged." },
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
          purpose: "Create the queued assistant record for a new generation attempt and transport request without copying fields that only the caller needs.",
          concepts: [
            { name: "parent_user_id", detail: "The branch point all regenerated attempts share." },
            { name: "attempt_id", detail: "A unique id for metrics and model settings." },
            { name: "request_id", detail: "A unique id for this transport run and the events it receives." },
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
    experiment: { kind: "product", variant: "context-actions", title: "Branch the conversation", intro: "Choose Stop, Retry / regenerate, or Edit prompt, then move the request budget from 14 to 42 tokens. Check the partial text that stays, the follow-ups an edit invalidates, the exact message / attempt / request ids, why each context id was included or left out, and the saved model, prompt, and sampling settings." },
  });
