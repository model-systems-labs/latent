import { defineExtendedLesson } from "../define-lesson";

export const reliabilityObservabilityLesson = defineExtendedLesson({
    id: "reliability-observability",
    number: 10,
    courseId: "backend",
    courseTitle: "LLM Serving",
    courseNumber: 3,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Worked failure trace",
    eyebrow: "Operations · Timeouts, retries, metrics",
    title: "Reliability and Observability",
    thesis: "A streaming chat request is a stateful operation whose failures must be classified, bounded, measured, and surfaced without duplicating generation or corrupting conversation state.",
    paperUrl: "https://sre.google/sre-book/monitoring-distributed-systems/",
    paperTitle: "Monitoring Distributed Systems",
    authors: "Google Site Reliability Engineering",
    year: "2016",
    summary: [
      { label: "Request and attempt identity.", body: "Keep one logical request id across the operation, but assign a new attempt id to every retry. Stream events, logs, metrics, cancellation, and resource ownership carry the active attempt id so a delayed event from an earlier attempt cannot mutate the current one." },
      { label: "Transparent-retry boundary.", body: "A retry is safe only when the failure is transient, zero tokens have become visible, and another attempt remains. In the practice API, attempt is a zero-based index and maxAttempts is the total attempt budget, so attempt + 1 < maxAttempts is the boundary test." },
      { label: "Terminal event guard.", body: "Only queued, loading, prefill, and streaming requests accept matching events. Complete, error, cancelled, unknown, and stale-attempt events are rejected before they reach conversation state." },
      { label: "Phase observability.", body: "Record queue time, prefill time, time to first token, decode duration or inter-token latency, terminal outcome, and resource release by request and attempt. Histograms and error classes preserve tail behavior that a single average hides; deterministic failure injection exercises those paths." },
    ],
    claims: {
      paper: "User-facing distributed systems should be monitored through latency, traffic, errors, and saturation with attention to distributions and symptoms.",
      lab: "Four fixed failure traces show logical request identity, per-attempt identity, the visible-token retry boundary, authored timings, terminal transitions, late-event rejection, and resource release.",
      limit: "Local traces cannot reproduce provider outages, cross-region partitions, or production traffic distributions.",
    },
    diagram: {
      title: "One request across two attempts",
      caption: "The logical request survives a retry; attempt identity does not. A visible token closes the transparent-retry branch, and terminal or stale-attempt events are rejected before state mutation.",
      nodes: [
        { label: "Attempt r-201.1", value: "queue 120 ms → transient timeout · visible 0" },
        { label: "Retry decision", value: "transient ∧ visible = 0 ∧ 0 + 1 < 2 → retry" },
        { label: "Attempt r-201.2", value: "queue 14 ms + prefill 69 ms → TTFT 83 ms" },
        { label: "Terminal", value: "10 deltas · decode 338 ms → complete · resources released" },
        { label: "Late-event guard", value: "r-201.1 token rejected · r-201.2 post-complete token rejected" },
      ],
    },
    questions: {
      intro: "Ask about retry safety, tail latency, request identity, terminal states, or failure injection.",
      suggestions: ["When is a generation retry unsafe?", "Why separate TTFT from total latency?", "How should late token events be handled?"],
    },
    dataset: {
      name: "Failure Trace",
      source: "Deterministic injected scenarios",
      license: "CC0",
      size: "4 failure modes · fixed seeds",
      preview: "queue timeout · malformed frame · worker crash · user abort",
    },
    implementation: {
      filename: "generation-reliability.py",
      intro: "Implement retry policy and terminal-state guards in Python before injecting failures into a streaming request trace.",
      codeBlocks: [
        {
          id: "retry-policy",
          label: "Retry policy",
          purpose: "Retry only transient failures before visible output and within a bounded attempt count.",
          concepts: [
            { name: "tokens_emitted", detail: "Visible output makes transparent retry unsafe." },
            { name: "transient", detail: "Classification based on the actual error type." },
            { name: "attempt", detail: "Zero-based index of the failed attempt; maxAttempts is the total attempt budget in the input record." },
          ],
          code: `def should_retry(options):
    transient = options["transient"]
    tokens_emitted = options["tokensEmitted"]
    attempt = options["attempt"]
    max_attempts = options.get("maxAttempts", 2)
    return transient and tokens_emitted == 0 and attempt + 1 < max_attempts`,
          checkCode: `before = should_retry({"transient": True, "tokensEmitted": 0, "attempt": 0})
after = should_retry({"transient": True, "tokensEmitted": 3, "attempt": 0})
RESULT = {
    "passed": before is True and after is False,
    "detail": f"retry before output: {str(before).lower()} · after output: {str(after).lower()}",
}`,
        },
        {
          id: "terminal-guard",
          label: "Terminal-state guard",
          purpose: "Ignore late events after completion, error, or cancellation.",
          concepts: [
            { name: "active", detail: "Queued, loading, prefill, and streaming are the only event-accepting states." },
            { name: "attemptId", detail: "Changes on every retry and prevents a retired attempt from mutating the current one." },
            { name: "requestId", detail: "Names the transport lifecycle within the active attempt." },
            { name: "event", detail: "Typed transport event applied only to the matching active attempt and transport." },
          ],
          code: `def accept_event(request, event):
    active = {"queued", "loading", "prefill", "streaming"}
    return (
        request["status"] in active
        and request["attemptId"] == event["attemptId"]
        and request["requestId"] == event["requestId"]
    )`,
          checkCode: `late = accept_event(
    {"attemptId": "a1", "requestId": "r1", "status": "complete"},
    {"attemptId": "a1", "requestId": "r1"},
)
current = accept_event(
    {"attemptId": "a2", "requestId": "r2", "status": "streaming"},
    {"attemptId": "a2", "requestId": "r2"},
)
RESULT = {
    "passed": late is False and current is True,
    "detail": "late rejected · active accepted",
}`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "reliability", title: "Replay a generation failure", intro: "Replay authored timeout, malformed-frame, worker-crash, and cancellation paths. Each fixed trace names its request and attempts, timings, retry decision, terminal transition, rejected late event, and released resources." },
  });
