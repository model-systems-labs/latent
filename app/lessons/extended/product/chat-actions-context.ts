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
          purpose: "Assemble the exact request: required system instructions and active user prompt plus the newest complete historical pairs that fit.",
          concepts: [
            { name: "history", detail: "Only adjacent complete user-assistant pairs are admissible; streaming, cancelled, error, and orphan records are skipped." },
            { name: "activeUser", detail: "Required current prompt, selected after system and historical context and counted inside the same budget." },
            { name: "overflow", detail: "True when required system plus active-user tokens already exceed budget; the caller must not send the request unchanged." },
          ],
          code: `function selectContext({ system, history, activeUser, budget }) {
  const requiredSystem = system.filter((message) => message.role === "system");
  const turns = [];
  for (let index = 0; index < history.length - 1; index += 1) {
    const user = history[index];
    const assistant = history[index + 1];
    if (user.role === "user" && user.status === "complete" &&
        assistant.role === "assistant" && assistant.status === "complete") {
      turns.push([user, assistant]);
      index += 1;
    }
  }
  const selectedTurns = [];
  let used = requiredSystem.reduce((sum, message) => sum + message.tokens, 0) + activeUser.tokens;
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
  return { selected: [...requiredSystem, ...selectedTurns.flat(), activeUser], used, overflow };
}`,
          checkCode: `const result = selectContext({
  system: [{ id: "s", role: "system", tokens: 4 }],
  history: [
    { id: "u1", role: "user", status: "complete", tokens: 3 },
    { id: "a1", role: "assistant", status: "complete", tokens: 3 },
    { id: "u2", role: "user", status: "complete", tokens: 4 },
    { id: "a2", role: "assistant", status: "complete", tokens: 4 }
  ],
  activeUser: { id: "u3", role: "user", status: "complete", tokens: 2 },
  budget: 14
});
return { passed: result.selected.map(m => m.id).join(",") === "s,u2,a2,u3" && result.used === 14 && result.overflow === false, detail: result.selected.map(m => m.id).join(" → ") + " · " + result.used + " tokens" };`,
        },
        {
          id: "regenerate-branch",
          label: "Regeneration branch",
          purpose: "Create the exact queued assistant record for a new generation attempt and transport request without copying caller-only fields.",
          concepts: [
            { name: "parentUserId", detail: "Branch point shared by all regenerated attempts." },
            { name: "attemptId", detail: "Unique identity for metrics and model parameters." },
            { name: "requestId", detail: "Unique identity for this transport lifecycle and its incoming events." },
          ],
          code: `function createRegeneration({ messageId, parentUserId, attemptId, requestId }) {
  return { messageId, parentUserId, attemptId, requestId, role: "assistant", content: "", status: "queued" };
}`,
          checkCode: `const branch = createRegeneration({ messageId: "m9", parentUserId: "m4", attemptId: "a2", requestId: "r2" });
return { passed: branch.parentUserId === "m4" && branch.attemptId === "a2" && branch.requestId === "r2" && branch.status === "queued", detail: branch.attemptId + " → " + branch.requestId };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "context-actions", title: "Branch the conversation", intro: "Choose Stop, Retry / regenerate, or Edit prompt, then vary the 14–42 token request budget. Inspect retained partial text, invalidated descendants, exact message / attempt / request ids, included and excluded context ids with token reasons, and the recorded model, prompt, and sampling policy." },
  });
