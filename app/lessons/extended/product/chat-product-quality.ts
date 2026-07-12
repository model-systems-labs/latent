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
    thesis: "A functional chat demo becomes a product when state survives safely, keyboard and assistive technology paths work, and latency has intentional intermediate states.",
    paperUrl: "https://www.w3.org/WAI/ARIA/apg/patterns/log/",
    paperTitle: "Log Pattern",
    authors: "W3C WAI-ARIA Authoring Practices",
    year: "Current reference",
    summary: [
      { label: "Persistence.", body: "Conversation records require schema versions and validation. Browser storage is appropriate for device-local history and preferences, but secrets and provider keys should remain session-only." },
      { label: "Keyboard path.", body: "Send, stop, retry, conversation switching, settings, and message actions require visible focus and predictable keyboard behavior independent of pointer hover." },
      { label: "Live updates.", body: "The conversation log and streaming status need carefully scoped announcements. Token-by-token aria-live output is noisy; silence is equally unhelpful." },
      { label: "Perceived latency.", body: "Queued, loading, prefill, streaming, cancelled, and failed are distinct user states. Honest phase feedback reduces uncertainty without inventing progress percentages." },
    ],
    claims: {
      paper: "Dynamic sequential content can use an accessible log pattern that preserves reading order and announces meaningful additions.",
      lab: "The browser audits keyboard actions, live announcements, storage migration, and phase-specific latency states against a deterministic checklist.",
      limit: "Automated checks supplement rather than replace testing with real browsers, keyboards, screen readers, and users.",
    },
    diagram: {
      title: "Product state surface",
      caption: "The same generation lifecycle must be legible visually, programmatically, and after reload.",
      nodes: [
        { label: "Persist", value: "versioned local record" },
        { label: "Operate", value: "keyboard + pointer" },
        { label: "Announce", value: "bounded live updates" },
        { label: "Recover", value: "cancel / retry / restore" },
      ],
    },
    questions: { intro: "Ask about local persistence, schema migration, live regions, focus management, or honest latency states.", suggestions: ["What chat data should never be persisted?", "How often should streaming text be announced?", "What should receive focus after retry?"] },
    dataset: { name: "Product Audit", source: "Original deterministic checklist", license: "CC0", size: "16 checks · desktop and mobile", preview: "keyboard · focus · live region · storage · recovery" },
    implementation: {
      filename: "chat-quality.js",
      intro: "Implement storage validation and user-visible phase labels before running the capstone product audit.",
      codeBlocks: [
        {
          id: "storage-validation",
          label: "Storage validation",
          purpose: "Accept only the current local conversation schema and safe serializable fields.",
          concepts: [
            { name: "version", detail: "Explicit schema version used for migration decisions." },
            { name: "Array.isArray", detail: "Rejects malformed message collections." },
            { name: "apiKey", detail: "Secret field that must never enter persisted chat state." },
          ],
          code: `function validConversationRecord(record) {
  return Boolean(record) && record.version === 1 && typeof record.id === "string" && Array.isArray(record.messages) && !("apiKey" in record);
}`,
          checkCode: `const safe = validConversationRecord({ version: 1, id: "c1", messages: [] });
const secret = validConversationRecord({ version: 1, id: "c1", messages: [], apiKey: "no" });
return { passed: safe === true && secret === false, detail: "safe accepted · secret rejected" };`,
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
    cancelled: "Stopped",
    error: "Generation failed",
  };
  return labels[phase] ?? "Ready";
}`,
          checkCode: `const known = generationStatusLabel("prefill");
const unknown = generationStatusLabel("future-state");
return { passed: known === "Processing context" && unknown === "Ready", detail: known + " · " + unknown };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "quality", title: "Audit the chat product", intro: "Run the full keyboard, persistence, announcement, recovery, and latency-state checklist against the capstone interface." },
  });
