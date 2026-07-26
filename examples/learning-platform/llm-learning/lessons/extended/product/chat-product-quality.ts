import { defineExtendedLesson } from "../define-lesson";

export const chatProductQualityLesson = defineExtendedLesson({
    id: "chat-product-quality",
    number: 14,
    courseId: "product",
    courseTitle: "Chat Integration",
    courseNumber: 4,
    lessonNumber: 4,
    mode: "core-mechanism",
    modeLabel: "Product quality check",
    eyebrow: "Quality · Persistence, a11y, latency",
    title: "Product Quality",
    thesis: "A chat product should still make sense after something fails or the page reloads. You need to be able to verify every input, generation phase, announcement, recovery action, and saved record.",
    paperUrl: "https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23",
    paperTitle: "ARIA23: Using role=log to identify sequential information updates",
    authors: "W3C Web Accessibility Initiative",
    year: "WCAG 2.2",
    summary: [
      { label: "One lifecycle you can see.", body: "Pressing Enter queues a request. Loading and prefill labels explain the wait, streaming sends updates in reasonable batches, and complete, cancelled, and error are the final states. The label on screen should come from the same phase that controls Stop and Retry." },
      { label: "Recovery also means focus.", body: "Stop and regenerate aren't just buttons; they move the request into a new state. Reject late events, release resources, label partial output, and put keyboard focus back on a control the user can predict." },
      { label: "Treat saved history as input.", body: "History loaded after a refresh is untrusted data. A versioned record should accept only the exact safe fields, size-limited final messages, and known roles and backends. Reject streaming state and any extra field that could hold a secret." },
      { label: "Know what automation can't prove.", body: "Small contract checks can verify mappings, guards, serialization, and exact policy values. A separate full-build check mounts the capstone and runs through submit, stream, stop, late-event rejection, and errors. Neither one proves focus order, what a screen reader says, how touch controls feel, or how the layout works at a real screen size. Check those by hand." },
    ],
    claims: {
      paper: "For content that updates in order, an accessible log can keep the reading order clear and announce useful additions.",
      lab: "This lesson runs 11 small executable checks, marks 5 unexecuted requirements as specifications, and lists the keyboard, screen-reader, and mobile checks a person still needs to do. The full project build adds a separate mounted behavior check.",
      limit: "Automated checks help, but they don't replace testing with real browsers, keyboards, screen readers, and users.",
    },
    diagram: {
      title: "One send through reload",
      caption: "The screen, status updates, recovery controls, and safely saved record all follow the same request. The automated checks still don't replace testing on real devices.",
      nodes: [
        { label: "Send", value: "Enter → queued" },
        { label: "Wait", value: "loading → prefill" },
        { label: "Generate", value: "streaming → limited batches" },
        { label: "Recover", value: "cancel / retry → composer focus" },
        { label: "Reload", value: "check v1 → restore finished messages" },
      ],
    },
    questions: { intro: "Ask about local storage, schema changes, live regions, keyboard focus, or clear latency labels.", suggestions: ["What chat data should never be saved?", "How often should streaming text be announced?", "Where should focus go after a retry?"] },
    dataset: { name: "Product Contract Audit", source: "Course-authored synthetic checklist", license: "Not separately licensed", size: "11 executable pure checks · 5 specifications · 3 manual verification groups", preview: "input + focus · saved state · lifecycle · accessibility + responsive behavior" },
    implementation: {
      filename: "chat-quality.py",
      intro: "Build the saved-data check and user-facing phase labels in Python, then run the capstone product check.",
      codeBlocks: [
        {
          id: "storage-validation",
          label: "Saved-data check",
          purpose: "Accept only a size-limited v1 conversation record with the exact safe fields allowed for final messages.",
          concepts: [
            { name: "version", detail: "The exact schema version used to decide whether a migration is needed." },
            { name: "exact keys", detail: "Reject extra fields at the top level or inside messages, including fields that could hold secrets." },
            { name: "terminal messages", detail: "Never restore a streaming message as though its request were still running." },
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
          purpose: "Turn internal request phases into short, honest labels for the user.",
          concepts: [
            { name: "phase", detail: "The request's current state, stored directly." },
            { name: "labels", detail: "A fixed mapping instead of guessing which loading text to show." },
            { name: "fallback", detail: "A safe label for a phase this version doesn't know yet." },
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
    experiment: { kind: "product", variant: "quality", title: "Check the product contract", intro: "Run the 11 executable checks, review the 5 specifications that don't run here, then use the manual list to test with a real keyboard, screen reader, and mobile layout. The full build mounts the capstone separately for behavior checks." },
  });
