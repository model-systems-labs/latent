import { defineExtendedLesson } from "../define-lesson";

export const chatProductQualityLesson = defineExtendedLesson({
    id: "chat-product-quality",
    number: 14,
    courseId: "product",
    courseTitle: "Chat Integration",
    courseNumber: 4,
    lessonNumber: 4,
    mode: "core-mechanism",
    modeLabel: "Product verification",
    eyebrow: "Quality · Persistence, a11y, latency",
    title: "Product Quality",
    thesis: "A chat product is a verifiable contract: every input, generation phase, announcement, recovery action, and persisted record must remain understandable after failure and reload.",
    paperUrl: "https://www.w3.org/WAI/ARIA/apg/patterns/log/",
    paperTitle: "Log Pattern",
    authors: "W3C WAI-ARIA Authoring Practices",
    year: "Current reference",
    summary: [
      { label: "One observable lifecycle.", body: "Enter queues a request; loading and prefill explain the wait; streaming adds bounded visual and programmatic updates; complete, cancelled, and error are terminal states. The visible label must come from the same phase that controls Stop and Retry." },
      { label: "Recovery includes focus.", body: "Stop and regeneration are state transitions, not decorative buttons. Late events must be rejected, resources released, partial output labeled, and keyboard focus returned to a predictable control." },
      { label: "Persistence is an input boundary.", body: "Reloaded history is untrusted data. A versioned record should admit only its exact safe fields, bounded terminal messages, and known roles and backends; streaming state and every secret-shaped extra field are rejected." },
      { label: "Automation has a boundary.", body: "Pure contract checks can verify mappings, guards, serialization, and exact policy values. A separate full-build receipt mounts the capstone and drives submit, stream, stop, late-event rejection, and error behavior. Neither proves focus order, screen-reader speech, touch ergonomics, or layout at a real viewport; those remain explicit manual checks." },
    ],
    claims: {
      paper: "Dynamic sequential content can use an accessible log pattern that preserves reading order and announces meaningful additions.",
      lab: "The lesson runs 11 executable pure checks, labels 5 unexecuted requirements as specifications, and names the keyboard, screen-reader, and mobile checks that still require a person. The full-project build adds a separate mounted behavior receipt.",
      limit: "Automated checks supplement rather than replace testing with real browsers, keyboards, screen readers, and users.",
    },
    diagram: {
      title: "One send through reload",
      caption: "The visual surface, programmatic status, recovery controls, and safe persisted record follow one request without claiming that automated contracts replace device testing.",
      nodes: [
        { label: "Send", value: "Enter → queued" },
        { label: "Wait", value: "loading → prefill" },
        { label: "Generate", value: "streaming → bounded batches" },
        { label: "Recover", value: "cancel / retry → composer focus" },
        { label: "Reload", value: "validate v1 → restore terminal messages" },
      ],
    },
    questions: { intro: "Ask about local persistence, schema migration, live regions, focus management, or honest latency states.", suggestions: ["What chat data should never be persisted?", "How often should streaming text be announced?", "What should receive focus after retry?"] },
    dataset: { name: "Product Contract Audit", source: "Original deterministic checklist", license: "CC0", size: "11 executable pure checks · 5 specifications · 3 manual verification groups", preview: "input + focus · persistence · lifecycle · accessibility + responsive contract" },
    implementation: {
      filename: "chat-quality.js",
      intro: "Implement storage validation and user-visible phase labels before running the capstone product audit.",
      codeBlocks: [
        {
          id: "storage-validation",
          label: "Storage validation",
          purpose: "Accept only one bounded v1 conversation record made of exact safe terminal-message fields.",
          concepts: [
            { name: "version", detail: "Explicit schema version used for migration decisions." },
            { name: "exact keys", detail: "Rejects top-level and nested extras, including secret-shaped fields." },
            { name: "terminal messages", detail: "Streaming messages are never restored as if their request were still alive." },
          ],
          code: `function validConversationRecord(record) {
  const isPlainObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
  const hasExactKeys = (value, required, optional = []) => {
    const keys = Reflect.ownKeys(value);
    const allowed = [...required, ...optional];
    return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
      keys.every((key) => typeof key === "string" && allowed.includes(key));
  };
  const validId = (value) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 128;
  const validMessage = (message) => {
    if (!isPlainObject(message) || !hasExactKeys(
      message,
      ["id", "role", "backend", "content", "status"],
      ["attemptId", "parentUserId"],
    )) return false;
    if (!validId(message.id) || !["user", "assistant"].includes(message.role)) return false;
    if (!["student", "local"].includes(message.backend)) return false;
    if (typeof message.content !== "string" || message.content.length > 20000) return false;
    if (!["complete", "cancelled", "error"].includes(message.status)) return false;
    if ("attemptId" in message && !validId(message.attemptId)) return false;
    if ("parentUserId" in message && !validId(message.parentUserId)) return false;
    return true;
  };

  if (!isPlainObject(record) || !hasExactKeys(record, ["version", "id", "messages"])) return false;
  if (record.version !== 1 || !validId(record.id)) return false;
  if (!Array.isArray(record.messages) || record.messages.length > 200) return false;
  if (!record.messages.every(validMessage)) return false;
  if (record.messages.reduce((sum, message) => sum + message.content.length, 0) > 200000) return false;
  try {
    return typeof JSON.stringify(record) === "string";
  } catch {
    return false;
  }
}`,
          checkCode: `const safe = validConversationRecord({ version: 1, id: "c1", messages: [{ id: "u1", role: "user", backend: "local", content: "Hello", status: "complete" }] });
const secret = validConversationRecord({ version: 1, id: "c1", messages: [{ id: "u1", role: "user", backend: "local", content: "Hello", status: "complete", apiKey: "no" }] });
return { passed: safe === true && secret === false, detail: "safe terminal message accepted · nested secret rejected" };`,
        },
        {
          id: "phase-label",
          label: "Generation status",
          purpose: "Map internal request phases to concise honest user-facing labels.",
          concepts: [
            { name: "phase", detail: "Explicit state from the request lifecycle." },
            { name: "labels", detail: "Finite mapping rather than inferred loading copy." },
            { name: "fallback", detail: "Safe label for unknown future phases." },
          ],
          code: `function generationStatusLabel(phase) {
  const labels = {
    queued: "Waiting for capacity",
    loading: "Loading model",
    prefill: "Processing context",
    streaming: "Generating",
    complete: "Complete",
    cancelled: "Stopped",
    error: "Generation failed",
  };
  return labels[phase] ?? "Status unavailable";
}`,
          checkCode: `const known = generationStatusLabel("prefill");
const unknown = generationStatusLabel("future-state");
return { passed: known === "Processing context" && unknown === "Status unavailable", detail: known + " · " + unknown };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "quality", title: "Audit the product contract", intro: "Run 11 executable pure checks, review 5 explicitly unexecuted specifications, then use the manual list for real keyboard, screen-reader, and mobile verification. The full build separately mounts the capstone for behavior checks." },
  });
