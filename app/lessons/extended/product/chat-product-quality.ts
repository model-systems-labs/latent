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
    paperUrl: "https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23",
    paperTitle: "ARIA23: Using role=log to identify sequential information updates",
    authors: "W3C Web Accessibility Initiative",
    year: "WCAG 2.2",
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
      filename: "chat-quality.py",
      intro: "Implement storage validation and user-visible phase labels in Python before running the capstone product audit.",
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
          code: `import json

def valid_conversation_record(record):
    def is_plain_record(value):
        return type(value) is dict

    def has_exact_keys(value, required, optional=()):
        keys = set(value.keys())
        required_keys = set(required)
        allowed_keys = required_keys | set(optional)
        return (
            all(type(key) is str for key in value.keys())
            and required_keys <= keys
            and keys <= allowed_keys
        )

    def valid_id(value):
        return type(value) is str and bool(value.strip()) and len(value) <= 128

    def valid_message(message):
        if not is_plain_record(message) or not has_exact_keys(
            message,
            ("id", "role", "backend", "content", "status"),
            ("attemptId", "parentUserId"),
        ):
            return False
        if not valid_id(message["id"]) or message["role"] not in {"user", "assistant"}:
            return False
        if message["backend"] not in {"student", "local"}:
            return False
        if type(message["content"]) is not str or len(message["content"]) > 20000:
            return False
        if message["status"] not in {"complete", "cancelled", "error"}:
            return False
        if "attemptId" in message and not valid_id(message["attemptId"]):
            return False
        if "parentUserId" in message and not valid_id(message["parentUserId"]):
            return False
        return True

    if not is_plain_record(record) or not has_exact_keys(
        record,
        ("version", "id", "messages"),
    ):
        return False
    if type(record["version"]) is not int or record["version"] != 1:
        return False
    if not valid_id(record["id"]):
        return False
    if type(record["messages"]) is not list or len(record["messages"]) > 200:
        return False
    if not all(valid_message(message) for message in record["messages"]):
        return False
    if sum(len(message["content"]) for message in record["messages"]) > 200000:
        return False
    try:
        return type(json.dumps(record)) is str
    except (TypeError, ValueError):
        return False`,
          checkCode: `safe = valid_conversation_record({
    "version": 1,
    "id": "c1",
    "messages": [
        {"id": "u1", "role": "user", "backend": "local", "content": "Hello", "status": "complete"},
    ],
})
secret = valid_conversation_record({
    "version": 1,
    "id": "c1",
    "messages": [
        {"id": "u1", "role": "user", "backend": "local", "content": "Hello", "status": "complete", "apiKey": "no"},
    ],
})
RESULT = {
    "passed": safe is True and secret is False,
    "detail": "safe terminal message accepted · nested secret rejected",
}`,
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
          code: `def generation_status_label(phase):
    labels = {
        "queued": "Waiting for capacity",
        "loading": "Loading model",
        "prefill": "Processing context",
        "streaming": "Generating",
        "complete": "Complete",
        "cancelled": "Stopped",
        "error": "Generation failed",
    }
    return labels.get(phase, "Status unavailable")`,
          checkCode: `known = generation_status_label("prefill")
unknown = generation_status_label("future-state")
RESULT = {
    "passed": known == "Processing context" and unknown == "Status unavailable",
    "detail": f"{known} · {unknown}",
}`,
        },
      ],
    },
    experiment: { kind: "product", variant: "quality", title: "Audit the product contract", intro: "Run 11 executable pure checks, review 5 explicitly unexecuted specifications, then use the manual list for real keyboard, screen-reader, and mobile verification. The full build separately mounts the capstone for behavior checks." },
  });
