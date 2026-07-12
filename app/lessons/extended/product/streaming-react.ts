import { defineExtendedLesson } from "../define-lesson";

export const streamingReactLesson = defineExtendedLesson({
    id: "streaming-react",
    number: 12,
    courseId: "product",
    courseTitle: "Chat Integration",
    courseNumber: 4,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "React rendering lab",
    eyebrow: "React · Streaming and scheduling",
    title: "Streaming React",
    thesis: "A polished chat UI converts a high-frequency token stream into stable, accessible render updates without losing cancellation or completion semantics.",
    paperUrl: "https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams",
    paperTitle: "Using readable streams",
    authors: "MDN Web Docs",
    year: "Current reference",
    summary: [
      { label: "Read loop.", body: "The transport yields events asynchronously. React should receive domain actions from the read loop rather than own the byte parser or await one final response string." },
      { label: "Render cadence.", body: "Dispatching every subword can create unnecessary renders and unstable layout. A small requestAnimationFrame buffer preserves the stream while batching visual commits." },
      { label: "Scroll policy.", body: "Automatic scrolling should follow only when the reader remains near the bottom. Forcing scroll while someone reads earlier content is a product bug." },
      { label: "Accessible updates.", body: "Announcing every token overwhelms assistive technology. The live region should receive bounded semantic batches and a final completion announcement." },
    ],
    claims: {
      paper: "ReadableStream exposes asynchronous chunk consumption with cancellation and backpressure-aware primitives.",
      lab: "A React-style render scheduler buffers transport deltas, respects user scroll position, and emits bounded accessibility announcements.",
      limit: "The deterministic lab does not benchmark every browser, renderer, or assistive technology combination.",
    },
    diagram: {
      title: "Stream-to-render pipeline",
      caption: "Transport frequency and visual render frequency are related but deliberately not identical.",
      nodes: [
        { label: "ReadableStream", value: "typed events" },
        { label: "Frame buffer", value: "merge deltas" },
        { label: "Reducer", value: "one immutable update" },
        { label: "View", value: "text + live region" },
      ],
    },
    questions: { intro: "Ask about render batching, scroll following, cancellation, live regions, or stream consumption.", suggestions: ["Why not render every token?", "When should auto-scroll stop?", "How should streaming be announced accessibly?"] },
    dataset: { name: "Render Trace", source: "Deterministic 60-token stream", license: "CC0", size: "60 deltas · 4 timing profiles", preview: "burst · steady · stalled · cancelled" },
    implementation: {
      filename: "streaming-react.js",
      intro: "Implement delta buffering and scroll-follow policy, then compare transport events with actual React-style commits.",
      codeBlocks: [
        {
          id: "delta-buffer",
          label: "Render buffer",
          purpose: "Merge token deltas into one frame-sized visual update.",
          concepts: [
            { name: "pending", detail: "Deltas received since the previous visual commit." },
            { name: "join", detail: "Preserves exact generation order." },
            { name: "flush", detail: "Returns one string and clears the pending buffer." },
          ],
          code: `function flushTokenBuffer(pending) {
  return { text: pending.join(""), remaining: [] };
}`,
          checkCode: `const result = flushTokenBuffer(["Hel", "lo", " ", "world"]);
return { passed: result.text === "Hello world" && result.remaining.length === 0, detail: result.text };`,
        },
        {
          id: "scroll-policy",
          label: "Scroll-follow policy",
          purpose: "Follow new output only when the reader remains near the bottom.",
          concepts: [
            { name: "distanceFromBottom", detail: "Remaining scroll distance in CSS pixels." },
            { name: "threshold", detail: "Small tolerance for layout and font changes." },
            { name: "userScrolledUp", detail: "Explicit opt-out while reviewing older content." },
          ],
          code: `function shouldFollowStream({ distanceFromBottom, userScrolledUp, threshold = 80 }) {
  return !userScrolledUp && distanceFromBottom <= threshold;
}`,
          checkCode: `const near = shouldFollowStream({ distanceFromBottom: 24, userScrolledUp: false });
const reading = shouldFollowStream({ distanceFromBottom: 24, userScrolledUp: true });
return { passed: near === true && reading === false, detail: "near bottom follows · reader control wins" };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "streaming-ui", title: "Render the token stream", intro: "Compare 60 transport deltas with buffered visual commits, cancellation, scroll-follow state, and accessibility announcements." },
  });
