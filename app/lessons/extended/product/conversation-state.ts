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
      { label: "Normalized state.", body: "Conversations own ordered message ids while messages are addressable records. Stable ids allow streaming updates, retries, edits, and cancellation without relying on array position." },
      { label: "Attempt identity.", body: "One assistant message may have multiple generation attempts. Transport request ids and UI message ids should be related but not conflated." },
      { label: "Reducer boundary.", body: "Typed actions centralize legal transitions such as start, delta, complete, fail, cancel, edit, and regenerate. Rendering becomes a projection of state rather than a second state machine." },
      { label: "Derived state.", body: "Flags such as canStop or canRegenerate should be derived from message and request status instead of stored independently and allowed to drift." },
    ],
    claims: {
      paper: "Reducers consolidate state transitions when many event handlers update related state.",
      lab: "A typed conversation reducer processes deterministic user, token, completion, cancellation, edit, and retry events.",
      limit: "The lesson models one-device state and does not implement collaborative synchronization.",
    },
    diagram: {
      title: "Conversation domain model",
      caption: "Stable identities separate messages, generation attempts, and transport requests.",
      nodes: [
        { label: "Conversation", value: "ordered message ids" },
        { label: "Message", value: "role + content + status" },
        { label: "Attempt", value: "model + parameters" },
        { label: "Request", value: "transport lifecycle" },
      ],
    },
    questions: {
      intro: "Ask about normalized messages, reducer actions, stable identity, derived state, or generation attempts.",
      suggestions: ["Why not use array indexes as message ids?", "What state belongs to an attempt?", "Which chat flags should be derived?"],
    },
    dataset: { name: "Conversation Event Log", source: "Original deterministic actions", license: "CC0", size: "18 actions · 3 attempts", preview: "send → start → delta × 4 → complete → edit → regenerate" },
    implementation: {
      filename: "chat-reducer.js",
      intro: "Implement immutable message creation and token-delta transitions before replaying a complete conversation event log.",
      codeBlocks: [
        {
          id: "create-message",
          label: "Message record",
          purpose: "Create a stable, serializable message with explicit generation status.",
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
          purpose: "Append one transport delta to the matching streaming message.",
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
    experiment: { kind: "product", variant: "state", title: "Replay the reducer", intro: "Step through a complete conversation trace and inspect state changes, derived actions, and ignored late events." },
  });
