import { defineExtendedLesson } from "../define-lesson";

export const reliabilityObservabilityLesson = defineExtendedLesson({
    id: "reliability-observability",
    number: 10,
    courseId: "backend",
    courseTitle: "LLM Serving",
    courseNumber: 3,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Failure walkthrough",
    eyebrow: "Operations · Timeouts, retries, metrics",
    title: "Reliability and Observability",
    thesis: "A streaming chat request has state. When it fails, you need to classify the failure, limit retries, measure what happened, and explain it to the user without duplicating text or messing up the conversation.",
    paperUrl: "https://sre.google/sre-book/monitoring-distributed-systems/",
    paperTitle: "Monitoring Distributed Systems",
    authors: "Google Site Reliability Engineering",
    year: "2016",
    summary: [
      { label: "Track the request and each try.", body: "Keep the same logical request id from start to finish, but assign a new attempt id to every retry. Put the active attempt id on stream events, logs, metrics, cancellation, and owned resources so a delayed event from an older attempt can't change the current one." },
      { label: "Know when an automatic retry is safe.", body: "Only retry automatically when the failure is temporary, the user hasn't seen any tokens, and you still have another attempt. In this practice API, attempt is a zero-based index and maxAttempts is the total number of tries allowed, so the check is attempt + 1 < maxAttempts." },
      { label: "Block events after the request ends.", body: "Only queued, loading, prefill, and streaming requests can accept matching events. Reject events for complete, error, cancelled, or unknown requests, along with events from an old attempt, before they touch conversation state." },
      { label: "Measure each phase.", body: "For every request and attempt, record queue time, prefill time, time to first token, decode duration or inter-token latency, the final result, and whether resources were released. Histograms and error categories show slow tails that one average can hide. Fixed failure injection lets you exercise those paths on purpose." },
    ],
    claims: {
      paper: "For a distributed system people use, watch latency, traffic, errors, and saturation. Pay attention to the full spread and to what users notice, not just averages.",
      lab: "Four fixed failure traces show the logical request id, each attempt id, when visible output makes a retry unsafe, planned timings, final state changes, rejected late events, and released resources.",
      limit: "Local traces can't recreate a provider outage, a cross-region network split, or real production traffic patterns.",
    },
    diagram: {
      title: "One request across two attempts",
      caption: "The logical request keeps the same id after a retry, but the attempt id changes. Once a token is visible, an automatic retry is off the table. Reject events from finished or old attempts before they can change state.",
      nodes: [
        { label: "Attempt r-201.1", value: "queue 120 ms → transient timeout · visible 0" },
        { label: "Retry decision", value: "transient ∧ visible = 0 ∧ 0 + 1 < 2 → retry" },
        { label: "Attempt r-201.2", value: "queue 14 ms + prefill 69 ms → TTFT 83 ms" },
        { label: "Terminal", value: "10 deltas · decode 338 ms → complete · resources released" },
        { label: "Late-event guard", value: "r-201.1 token rejected · r-201.2 post-complete token rejected" },
      ],
    },
    questions: {
      intro: "Ask about safe retries, slow tail latency, request ids, final states, or testing with injected failures.",
      suggestions: ["When is a generation retry unsafe?", "Why separate TTFT from total latency?", "How should late token events be handled?"],
    },
    dataset: {
      name: "Failure Trace",
      source: "Fixed injected scenarios",
      license: "CC0",
      size: "4 failure modes · fixed seeds",
      preview: "queue timeout · malformed frame · worker crash · user abort",
    },
    implementation: {
      filename: "generation-reliability.py",
      intro: "Build the retry rules and final-state guards in Python, then inject failures into a streaming request trace.",
      codeBlocks: [
        {
          id: "retry-policy",
          label: "Retry policy",
          purpose: "Retry only temporary failures that happen before visible output, and never go past the attempt limit.",
          concepts: [
            { name: "tokens_emitted", detail: "Once output is visible, an automatic retry isn't safe." },
            { name: "transient", detail: "Whether the actual error type is temporary." },
            { name: "attempt", detail: "The zero-based number of the failed attempt. maxAttempts is the total number of tries allowed in the input record." },
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
          label: "Finished-request guard",
          purpose: "Ignore events that arrive after completion, error, or cancellation.",
          concepts: [
            { name: "active", detail: "Only queued, loading, prefill, and streaming states can accept events." },
            { name: "attemptId", detail: "Changes with every retry so an old attempt can't update the current one." },
            { name: "requestId", detail: "Names the transport run inside the active attempt." },
            { name: "event", detail: "A typed transport event that only applies to the matching active attempt and transport." },
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
    experiment: { kind: "systems", variant: "reliability", title: "Replay a generation failure", intro: "Replay the planned timeout, malformed-frame, worker-crash, and cancellation paths. Each fixed trace shows the request and attempt ids, timing, retry decision, final state change, rejected late event, and released resources." },
  });
