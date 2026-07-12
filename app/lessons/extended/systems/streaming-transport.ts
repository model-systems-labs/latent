import { defineExtendedLesson } from "../define-lesson";

export const streamingTransportLesson = defineExtendedLesson({
    id: "streaming-transport",
    number: 8,
    courseId: "backend",
    courseTitle: "LLM Serving",
    courseNumber: 3,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Mock protocol implementation",
    eyebrow: "Transport · SSE-compatible streams",
    title: "Streaming Transport",
    thesis: "A chat client needs a stable event protocol that can deliver token deltas, metadata, completion, cancellation, and errors without coupling React to the model backend.",
    paperUrl: "https://html.spec.whatwg.org/multipage/server-sent-events.html",
    paperTitle: "Server-sent events",
    authors: "WHATWG HTML Living Standard",
    year: "Living standard",
    summary: [
      { label: "Event framing.", body: "SSE encodes named events and data fields as UTF-8 text separated by blank lines. A parser must tolerate arbitrary network chunk boundaries rather than assuming one chunk equals one event." },
      { label: "Transport boundary.", body: "The UI should consume typed chat events, not raw model callbacks. A transport adapter can then switch among a browser worker, mock stream, or remote endpoint." },
      { label: "Cancellation.", body: "AbortSignal is part of the request contract. Cancellation must stop transport parsing, model generation, and UI state transitions rather than merely hiding the spinner." },
      { label: "Backpressure.", body: "Generation may produce deltas faster than React should render them. Buffering small token bursts reduces commits without changing the logical event sequence." },
    ],
    claims: {
      paper: "The HTML event-stream format defines a one-way event channel with named events, data fields, reconnection behavior, and UTF-8 framing.",
      lab: "A real ReadableStream emits and parses SSE-compatible token, metric, done, and error frames across split chunks.",
      limit: "The stream is local and deterministic; browser networking, proxies, and multi-region disconnects are not reproduced.",
    },
    diagram: {
      title: "Typed token stream",
      caption: "React sees domain events while adapters own bytes, framing, and backend differences.",
      nodes: [
        { label: "Generator", value: "model delta" },
        { label: "Encoder", value: "event: token" },
        { label: "Parser", value: "bytes → event" },
        { label: "Reducer", value: "append delta" },
      ],
    },
    questions: {
      intro: "Ask about SSE framing, arbitrary chunks, cancellation, adapters, or render backpressure.",
      suggestions: ["Why can one event span multiple chunks?", "Where should AbortSignal propagate?", "Why buffer token renders?"],
    },
    dataset: {
      name: "Token Event Trace",
      source: "Original deterministic stream",
      license: "CC0",
      size: "14 frames · adversarial chunk boundaries",
      preview: "meta → token × 10 → metrics → done",
    },
    implementation: {
      filename: "streaming-transport.js",
      intro: "Implement event framing and incremental parsing against chunks that deliberately split events in inconvenient places.",
      codeBlocks: [
        {
          id: "encode-sse",
          label: "SSE encoder",
          purpose: "Serialize one typed event using the event-stream wire format.",
          concepts: [
            { name: "event", detail: "Stable event type such as token, metrics, done, or error." },
            { name: "data", detail: "JSON payload kept independent of framing." },
            { name: "blank line", detail: "Two newline characters terminate one event." },
          ],
          code: `function encodeSse(event, data) {
  return "event: " + event + "\\n" + "data: " + JSON.stringify(data) + "\\n\\n";
}`,
          checkCode: `const frame = encodeSse("token", { delta: "hi" });
return { passed: frame === "event: token\\ndata: {\\\"delta\\\":\\\"hi\\\"}\\n\\n", detail: frame.replace(/\\n/g, " ↵ ") };`,
        },
        {
          id: "parse-sse",
          label: "Incremental parser",
          purpose: "Retain incomplete bytes and emit only complete events.",
          concepts: [
            { name: "buffer", detail: "Unconsumed text carried across network chunks." },
            { name: "separator", detail: "Blank line marking the end of one frame." },
            { name: "remainder", detail: "Partial final frame saved for the next chunk." },
          ],
          code: `function parseSseChunk(buffer, chunk) {
  const combined = buffer + chunk;
  const frames = combined.split("\\n\\n");
  const remainder = frames.pop() ?? "";
  const events = frames.map((frame) => {
    const lines = frame.split("\\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
    const data = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "null";
    return { event, data: JSON.parse(data) };
  });
  return { events, remainder };
}`,
          checkCode: `const first = parseSseChunk("", "event: token\\ndata: {\\\"delta\\\":\\\"h");
const second = parseSseChunk(first.remainder, "i\\\"}\\n\\n");
return { passed: first.events.length === 0 && second.events[0].data.delta === "hi" && second.remainder === "", detail: second.events.length + " event parsed across chunks" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "streaming", title: "Inspect the event stream", intro: "Stream a response through adversarial byte chunks, pause rendering, cancel generation, and inspect every decoded event." },
  });
