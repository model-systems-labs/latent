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
      filename: "chat-actions.js",
      intro: "Implement bounded context selection and regeneration branching before manipulating a complete conversation graph.",
      codeBlocks: [
        {
          id: "context-budget",
          label: "Context selection",
          purpose: "Retain required system instructions and the newest complete historical user-assistant pairs that fit the selector budget.",
          concepts: [
            { name: "turns", detail: "Only an ordered user followed by its assistant is an admissible historical unit; incomplete or orphan records are skipped." },
            { name: "system", detail: "All system instructions are a required prefix. If they exceed budget, return them with overflow true so the caller can block or revise the request." },
            { name: "used", detail: "Exact token sum for selected records. Examine complete units newest-first, but return admitted units in chronological order." },
          ],
          code: `function selectContext(messages, budget) {
  const system = messages.filter((message) => message.role === "system");
  const turns = [];
  let pendingUser = null;
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      pendingUser = message;
      continue;
    }
    if (message.role === "assistant" && pendingUser) {
      turns.push([pendingUser, message]);
      pendingUser = null;
    }
  }
  const selectedTurns = [];
  let used = system.reduce((sum, message) => sum + message.tokens, 0);
  const overflow = used > budget;
  if (!overflow) {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      const turnTokens = turn.reduce((sum, message) => sum + message.tokens, 0);
      if (used + turnTokens <= budget) {
        selectedTurns.unshift(turn);
        used += turnTokens;
      }
    }
  }
  return { selected: [...system, ...selectedTurns.flat()], used, overflow };
}`,
          checkCode: `const result = selectContext([
  { id: "s", role: "system", tokens: 4 },
  { id: "u1", role: "user", tokens: 3 },
  { id: "a1", role: "assistant", tokens: 3 },
  { id: "u2", role: "user", tokens: 4 },
  { id: "a2", role: "assistant", tokens: 4 }
], 12);
return { passed: result.selected.map(m => m.id).join(",") === "s,u2,a2" && result.used === 12 && result.overflow === false, detail: result.selected.map(m => m.id).join(" → ") + " · " + result.used + " tokens" };`,
        },
        {
          id: "regenerate-branch",
          label: "Regeneration branch",
          purpose: "Create the exact queued assistant record for a new attempt without copying caller-only fields.",
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
    experiment: { kind: "product", variant: "context-actions", title: "Branch the conversation", intro: "Choose Stop, Retry / regenerate, or Edit prompt, then vary the 14–42 token request budget. Inspect retained partial text, invalidated descendants, exact message / attempt / request ids, included and excluded context ids with token reasons, and the recorded model, prompt, and sampling policy." },
  });
