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
      { label: "Branching history.", body: "Regeneration creates another assistant attempt from the same prefix. Editing an earlier user message invalidates or branches all dependent messages after it." },
      { label: "Stop semantics.", body: "Stopping should abort generation and retain the partial assistant message with an explicit cancelled status. Deleting partial text hides useful state and complicates retry." },
      { label: "Context budget.", body: "The client assembles system instructions, retained turns, retrieved evidence, and the current user message under a maximum token budget. Truncation policy is product behavior." },
      { label: "Reproducibility.", body: "Every attempt should record model id, prompt version, sampling policy, and included message ids so differences can be explained rather than guessed." },
    ],
    claims: {
      paper: "Conversation state can be represented explicitly and carried across model requests rather than inferred from rendered UI.",
      lab: "The browser branches attempts, preserves cancellation, rebuilds a bounded context, and exposes the exact included message ids.",
      limit: "Token estimates are deterministic approximations rather than the selected model's production tokenizer.",
    },
    diagram: {
      title: "Conversation branch",
      caption: "A retry shares the prefix but creates a new attempt and potentially a new continuation.",
      nodes: [
        { label: "Prefix", value: "retained turns" },
        { label: "User edit", value: "new branch point" },
        { label: "Attempt", value: "model + policy" },
        { label: "Context", value: "budgeted request" },
      ],
    },
    questions: { intro: "Ask about branching history, cancellation, retries, prompt records, or token-budget policy.", suggestions: ["What should regenerate preserve?", "Should stopping delete partial text?", "Which messages leave the context first?"] },
    dataset: { name: "Branching Conversation", source: "Original deterministic scenario", license: "CC0", size: "12 messages · 3 branches", preview: "answer → stop → retry → edit earlier prompt" },
    implementation: {
      filename: "chat-actions.js",
      intro: "Implement bounded context selection and regeneration branching before manipulating a complete conversation graph.",
      codeBlocks: [
        {
          id: "context-budget",
          label: "Context selection",
          purpose: "Retain the system message and newest complete user-assistant turns that fit the budget.",
          concepts: [
            { name: "turns", detail: "Keeps each user message paired with its dependent assistant response." },
            { name: "system", detail: "Instructions retained separately from conversational turns." },
            { name: "used", detail: "Running token estimate for complete admitted units." },
          ],
          code: `function selectContext(messages, budget) {
  const system = messages.filter((message) => message.role === "system");
  const turns = [];
  for (const message of messages.filter((item) => item.role !== "system")) {
    if (message.role === "user" || turns.length === 0) turns.push([message]);
    else turns[turns.length - 1].push(message);
  }
  const selectedTurns = [];
  let used = system.reduce((sum, message) => sum + message.tokens, 0);
  for (const turn of [...turns].reverse()) {
    const turnTokens = turn.reduce((sum, message) => sum + message.tokens, 0);
    if (used + turnTokens <= budget) {
      selectedTurns.unshift(turn);
      used += turnTokens;
    }
  }
  return { selected: [...system, ...selectedTurns.flat()], used };
}`,
          checkCode: `const result = selectContext([
  { id: "s", role: "system", tokens: 4 },
  { id: "u1", role: "user", tokens: 5 },
  { id: "a1", role: "assistant", tokens: 6 },
  { id: "u2", role: "user", tokens: 5 }
], 10);
return { passed: result.selected.map(m => m.id).join(",") === "s,u2" && result.used === 9, detail: result.selected.map(m => m.id).join(" → ") + " · " + result.used + " tokens" };`,
        },
        {
          id: "regenerate-branch",
          label: "Regeneration branch",
          purpose: "Create a new assistant attempt from the same user-message prefix.",
          concepts: [
            { name: "parentUserId", detail: "Branch point shared by all regenerated attempts." },
            { name: "attemptId", detail: "Unique identity for metrics and model parameters." },
            { name: "status", detail: "Queued until transport starts producing output." },
          ],
          code: `function createRegeneration({ messageId, parentUserId, attemptId }) {
  return { messageId, parentUserId, attemptId, role: "assistant", content: "", status: "queued" };
}`,
          checkCode: `const branch = createRegeneration({ messageId: "m9", parentUserId: "m4", attemptId: "a2" });
return { passed: branch.parentUserId === "m4" && branch.attemptId === "a2" && branch.status === "queued", detail: branch.parentUserId + " → " + branch.attemptId };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "context-actions", title: "Branch the conversation", intro: "Stop, retry, edit, and regenerate while inspecting the exact context and attempt record sent to the model." },
  });
