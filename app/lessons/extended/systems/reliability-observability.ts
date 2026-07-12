import { defineExtendedLesson } from "../define-lesson";

export const reliabilityObservabilityLesson = defineExtendedLesson({
    id: "reliability-observability",
    number: 10,
    courseId: "backend",
    courseTitle: "LLM Serving",
    courseNumber: 3,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Failure simulation",
    eyebrow: "Operations · Timeouts, retries, metrics",
    title: "Reliability and Observability",
    thesis: "A streaming chat request is a stateful operation whose failures must be classified, bounded, measured, and surfaced without duplicating generation or corrupting conversation state.",
    paperUrl: "https://sre.google/sre-book/monitoring-distributed-systems/",
    paperTitle: "Monitoring Distributed Systems",
    authors: "Google Site Reliability Engineering",
    year: "2016",
    summary: [
      { label: "Request identity.", body: "Every generation needs a stable request id so logs, metrics, cancellation, retries, and late events can be correlated without confusing two attempts." },
      { label: "Retry boundary.", body: "Retrying before the first token is different from retrying after visible output. Once side effects or deltas escape, transparent retry can duplicate content." },
      { label: "Latency distribution.", body: "Averages hide tails. Time to first token, inter-token latency, completion latency, cancellation rate, and error class should be recorded separately." },
      { label: "Failure injection.", body: "Controlled queue saturation, timeout, malformed-frame, and worker-crash scenarios make recovery paths executable rather than aspirational documentation." },
    ],
    claims: {
      paper: "User-facing distributed systems should be monitored through latency, traffic, errors, and saturation with attention to distributions and symptoms.",
      lab: "The browser injects deterministic failures and verifies request identity, bounded retries, cancellation, and phase-specific metrics.",
      limit: "Local traces cannot reproduce provider outages, cross-region partitions, or production traffic distributions.",
    },
    diagram: {
      title: "Generation state machine",
      caption: "Late events are ignored once a request reaches a terminal state.",
      nodes: [
        { label: "Queued", value: "request id assigned" },
        { label: "Streaming", value: "deltas + heartbeat" },
        { label: "Terminal", value: "done / error / abort" },
        { label: "Recorded", value: "phase metrics" },
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
      size: "5 failure modes · fixed seeds",
      preview: "queue timeout · malformed frame · worker crash · user abort",
    },
    implementation: {
      filename: "generation-reliability.js",
      intro: "Implement retry policy and terminal-state guards before injecting failures into a streaming request trace.",
      codeBlocks: [
        {
          id: "retry-policy",
          label: "Retry policy",
          purpose: "Retry only transient failures before visible output and within a bounded attempt count.",
          concepts: [
            { name: "tokensEmitted", detail: "Visible output makes transparent retry unsafe." },
            { name: "transient", detail: "Classification based on the actual error type." },
            { name: "attempt", detail: "Bounded count preventing an unending retry loop." },
          ],
          code: `function shouldRetry({ transient, tokensEmitted, attempt, maxAttempts = 2 }) {
  return transient && tokensEmitted === 0 && attempt < maxAttempts;
}`,
          checkCode: `const before = shouldRetry({ transient: true, tokensEmitted: 0, attempt: 0 });
const after = shouldRetry({ transient: true, tokensEmitted: 3, attempt: 0 });
return { passed: before === true && after === false, detail: "retry before output: " + before + " · after output: " + after };`,
        },
        {
          id: "terminal-guard",
          label: "Terminal-state guard",
          purpose: "Ignore late events after completion, error, or cancellation.",
          concepts: [
            { name: "terminal", detail: "Closed set of states that cannot accept more deltas." },
            { name: "requestId", detail: "Prevents events from an older attempt mutating the current one." },
            { name: "event", detail: "Typed transport event applied only to the matching active request." },
          ],
          code: `function acceptEvent(request, event) {
  const terminal = ["complete", "error", "cancelled"].includes(request.status);
  return !terminal && request.id === event.requestId;
}`,
          checkCode: `const late = acceptEvent({ id: "r1", status: "complete" }, { requestId: "r1" });
const current = acceptEvent({ id: "r2", status: "streaming" }, { requestId: "r2" });
return { passed: late === false && current === true, detail: "late rejected · active accepted" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "reliability", title: "Inject a generation failure", intro: "Run the same request through timeout, malformed-frame, worker-crash, and cancellation paths while inspecting its trace." },
  });
