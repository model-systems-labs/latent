import { defineExtendedLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/define-lesson";

export const conversationStateLesson = defineExtendedLesson({
    id: "conversation-state",
    number: 11,
    courseId: "product",
    courseTitle: "Chat Integration",
    courseNumber: 4,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "React state model",
    eyebrow: "React · Messages and reducers",
    title: "Conversation State",
    thesis: "A chat interface is a state machine for conversations, messages, generation attempts, and transport events. It's more than a text box that keeps appending strings to an array.",
    paperUrl: "https://react.dev/learn/extracting-state-logic-into-a-reducer",
    paperTitle: "Extracting State Logic into a Reducer",
    authors: "React documentation",
    year: "Current docs",
    summary: [
      { label: "Keep state normalized.", body: "A conversation keeps messageIds in order, while messagesById stores each message once. Rendering follows the id list. Streaming updates target a message by id instead of assuming the last item in an array is the active one." },
      { label: "Use three different ids.", body: "messageId names the long-lived UI record, attemptId names one try at generation, and requestId names one transport run. A regenerated assistant message can stay in the same place in the conversation while getting a new attempt and request." },
      { label: "Don't mutate old state.", body: "A delta action returns a new messages collection and a new version of the target message. It keeps every other message's identity unchanged and ignores events aimed at missing or non-streaming targets. That lets React see exactly what changed." },
      { label: "Calculate control state.", body: "canStop is true only while the active request is streaming. canRegenerate is true only after an assistant attempt reaches a final state. Calculate both from the normalized records so saved booleans can't get out of sync." },
    ],
    claims: {
      paper: "Reducers put related state changes in one place when lots of event handlers touch the same data.",
      lab: "A fixed 18-action trace follows three generation attempts: one completes, one is cancelled and rejects a late delta, and one starts after an edit and regeneration.",
      limit: "This lesson handles state on one device. It doesn't sync edits between people or devices.",
    },
    diagram: {
      title: "One delta through normalized state",
      caption: "This update keeps the conversation in order while treating message, attempt, and request ids as three separate things.",
      nodes: [
        { label: "Conversation c-17", value: "messageIds: [m-u1, m-a1]" },
        { label: "Message m-a1", value: "assistant · streaming · A causal" },
        { label: "Attempt a-17.2", value: "messageId: m-a1 · requestId: r-17.2" },
        { label: "Delta action", value: "m-a1 + ' mask' → new target record" },
      ],
    },
    questions: {
      intro: "Ask about normalized messages, reducer actions, stable ids, calculated state, or generation attempts.",
      suggestions: ["Why not use array indexes as message ids?", "What state belongs to an attempt?", "Which chat flags should be calculated?"],
    },
    dataset: { name: "Conversation Event Log", source: "Course-authored synthetic actions", license: "Not separately licensed", size: "18 reducer actions · 3 generation attempts", preview: "complete · cancel + ignore a late delta · edit + regenerate" },
    implementation: {
      filename: "chat-reducer.py",
      intro: "Build message creation and token-delta updates without mutation in Python, then replay the full conversation event log.",
      codeBlocks: [
        {
          id: "create-message",
          label: "Message record",
          purpose: "Create the exact message record you can serialize, including the active attempt and transport ids for assistant output.",
          concepts: [
            { name: "id", detail: "A stable id that doesn't depend on where the message renders." },
            { name: "role", detail: "The message role: user, assistant, or system." },
            { name: "attempt_id / request_id", detail: "Ids for the generation attempt and transport run. Use None for records that don't own a model request." },
          ],
          code: `def create_message(options):
    return {
        "id": options["id"],
        "role": options["role"],
        "content": options.get("content", ""),
        "status": options.get("status", "complete"),
        "attemptId": options.get("attemptId"),
        "requestId": options.get("requestId"),
        "createdAt": 0,
    }`,
          checkCode: `message = create_message({
    "id": "m1",
    "role": "assistant",
    "status": "streaming",
    "attemptId": "a1",
    "requestId": "r1",
})
RESULT = {
    "passed": (
        message["id"] == "m1"
        and message["attemptId"] == "a1"
        and message["requestId"] == "r1"
        and message["createdAt"] == 0
    ),
    "detail": f'{message["attemptId"]} · {message["requestId"]}',
}`,
        },
        {
          id: "append-delta",
          label: "Delta transition",
          purpose: "Append one transport delta without mutation, but only when its message, attempt, and request ids all match the active streaming record.",
          concepts: [
            { name: "message_id", detail: "Targets a stable message instead of the last item in an array." },
            { name: "attempt_id / request_id", detail: "Use these ids to reject late events from an old generation or transport run." },
            { name: "delta", detail: "The next piece of text sent by the transport." },
          ],
          code: `def append_message_delta(messages, event):
    next_messages = []
    for message in messages:
        matches_active_stream = (
            message.get("id") == event["messageId"]
            and message.get("attemptId") == event["attemptId"]
            and message.get("requestId") == event["requestId"]
            and message.get("status") == "streaming"
        )
        if matches_active_stream:
            next_messages.append({
                **message,
                "content": message["content"] + event["delta"],
            })
        else:
            next_messages.append(message)
    return next_messages`,
          checkCode: `messages = [
    {"id": "a", "attemptId": "a1", "requestId": "r1", "content": "Hel", "status": "streaming"},
    {"id": "b", "content": "fixed", "status": "complete"},
]
next_messages = append_message_delta(
    messages,
    {"messageId": "a", "attemptId": "a1", "requestId": "r1", "delta": "lo"},
)
RESULT = {
    "passed": (
        next_messages is not messages
        and next_messages[0] is not messages[0]
        and next_messages[1] is messages[1]
        and next_messages[0]["content"] == "Hello"
        and next_messages[1]["content"] == "fixed"
    ),
    "detail": next_messages[0]["content"],
}`,
        },
      ],
    },
    experiment: { kind: "product", variant: "state", title: "Replay the reducer", intro: "Replay all 18 actions in three short flows. Watch the message, attempt, and request ids; the new state versions; the calculated controls; and the rejected late event." },
  });
