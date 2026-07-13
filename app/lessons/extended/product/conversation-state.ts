import { defineExtendedLesson } from "../define-lesson";

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
    thesis: "A chat interface is a state machine over conversations, messages, generation attempts, and transport events—not a textarea appended to an array.",
    paperUrl: "https://react.dev/learn/extracting-state-logic-into-a-reducer",
    paperTitle: "Extracting State Logic into a Reducer",
    authors: "React documentation",
    year: "Current reference",
    summary: [
      { label: "Normalized state.", body: "A conversation stores an ordered messageIds list; messagesById stores each message once. Rendering follows the list, while streaming updates address a record by id instead of assuming the last array element is active." },
      { label: "Three identities.", body: "messageId names the durable UI record, attemptId names one model-generation try, and requestId names one transport lifecycle. A regenerated assistant message can keep its conversation position while receiving a new attempt and request." },
      { label: "Immutable transitions.", body: "A delta action returns a new messages collection and a new target message, preserves untouched message identities, and ignores events for missing or non-streaming targets. React can then detect exactly what changed." },
      { label: "Derived controls.", body: "canStop is true only while the active request is streaming; canRegenerate is true only after an assistant attempt reaches a terminal state. Deriving both from normalized records prevents stored booleans from drifting." },
    ],
    claims: {
      paper: "Reducers consolidate state transitions when many event handlers update related state.",
      lab: "An 18-action deterministic trace follows three generation attempts through completion, cancellation with a rejected late delta, and edit plus regeneration.",
      limit: "The lesson models one-device state and does not implement collaborative synchronization.",
    },
    diagram: {
      title: "One delta through normalized state",
      caption: "A concrete update preserves conversation order while message, attempt, and request identities remain distinct.",
      nodes: [
        { label: "Conversation c-17", value: "messageIds: [m-u1, m-a1]" },
        { label: "Message m-a1", value: "assistant · streaming · A causal" },
        { label: "Attempt a-17.2", value: "messageId: m-a1 · requestId: r-17.2" },
        { label: "Delta action", value: "m-a1 + ' mask' → new target record" },
      ],
    },
    questions: {
      intro: "Ask about normalized messages, reducer actions, stable identity, derived state, or generation attempts.",
      suggestions: ["Why not use array indexes as message ids?", "What state belongs to an attempt?", "Which chat flags should be derived?"],
    },
    dataset: { name: "Conversation Event Log", source: "Original deterministic actions", license: "CC0", size: "18 reducer actions · 3 generation attempts", preview: "complete · cancel + ignored late delta · edit + regenerate" },
    implementation: {
      filename: "chat-reducer.js",
      intro: "Implement immutable message creation and token-delta transitions before replaying a complete conversation event log.",
      codeBlocks: [
        {
          id: "create-message",
          label: "Message record",
          purpose: "Create the exact serializable message record used by normalized conversation state.",
          concepts: [
            { name: "id", detail: "Stable identity independent of render position." },
            { name: "role", detail: "User, assistant, or system domain role." },
            { name: "status", detail: "Explicit lifecycle used to derive available actions." },
          ],
          code: `function createMessage({ id, role, content = "", status = "complete" }) {
  return { id, role, content, status, createdAt: 0 };
}`,
          checkCode: `const message = createMessage({ id: "m1", role: "assistant", status: "streaming" });
return { passed: message.id === "m1" && message.content === "" && message.status === "streaming" && message.createdAt === 0, detail: message.role + " · " + message.status };`,
        },
        {
          id: "append-delta",
          label: "Delta transition",
          purpose: "Immutably append one transport delta to the matching streaming message.",
          concepts: [
            { name: "messageId", detail: "Targets a stable message rather than the last array element." },
            { name: "delta", detail: "Incremental text emitted by the transport." },
            { name: "map", detail: "Produces a new message array for React state identity." },
          ],
          code: `function appendMessageDelta(messages, messageId, delta) {
  return messages.map((message) =>
    message.id === messageId && message.status === "streaming"
      ? { ...message, content: message.content + delta }
      : message,
  );
}`,
          checkCode: `const next = appendMessageDelta([{ id: "a", content: "Hel", status: "streaming" }, { id: "b", content: "fixed", status: "complete" }], "a", "lo");
return { passed: next[0].content === "Hello" && next[1].content === "fixed", detail: next[0].content };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "state", title: "Replay the reducer", intro: "Replay all 18 actions in three focused flows; inspect message, attempt, and request ids, immutable revisions, derived controls, and the rejected late event." },
  });
