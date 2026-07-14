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
      lab: "A deterministic worked trace compares authored burst, steady, stalled, and cancelled delivery while exposing every visual commit, scroll decision, live announcement, and cleanup result.",
      limit: "The deterministic lab does not benchmark every browser, renderer, or assistive technology combination.",
    },
    diagram: {
      title: "One animation-frame commit",
      caption: "Typed token events are already parsed. The UI queue preserves their exact text until one animation-frame callback dispatches a render delta; scrolling, announcements, and cancellation remain separate policies.",
      nodes: [
        { label: "Typed token events", value: "t=2 ‘A’ · t=7 ‘ causal’ · t=11 ‘ €’" },
        { label: "Pending render-delta queue", value: "[‘A’, ‘ causal’, ‘ €’] · order retained" },
        { label: "requestAnimationFrame", value: "t=16 ms · flush once" },
        { label: "Reducer dispatch", value: "TOKEN_BATCH · delta ‘A causal €’" },
        { label: "Visual commit", value: "one render · announcement remains bounded" },
      ],
    },
    questions: { intro: "Ask about render batching, scroll following, cancellation, live regions, or stream consumption.", suggestions: ["Why not render every token?", "When should auto-scroll stop?", "How should streaming be announced accessibly?"] },
    dataset: { name: "Render Trace", source: "Deterministic 60-token stream", license: "CC0", size: "60 deltas · 4 timing profiles", preview: "burst · steady · stalled · cancelled" },
    implementation: {
      filename: "streaming-react.py",
      intro: "Implement delta buffering and scroll-follow policy in Python, then compare transport events with actual React-style commits.",
      codeBlocks: [
        {
          id: "delta-buffer",
          label: "Render buffer",
          purpose: "Merge token deltas into one frame-sized visual update.",
          concepts: [
            { name: "pending", detail: "Deltas received since the previous visual commit." },
            { name: "join", detail: "Preserves exact order, whitespace, empty strings, and Unicode without separators." },
            { name: "flush", detail: "Returns one string and a fresh empty queue without mutating the read-only input." },
          ],
          code: `def flush_token_buffer(pending):
    return {"text": "".join(pending), "remaining": []}`,
          checkCode: `result = flush_token_buffer(["Hel", "lo", " ", "world"])
RESULT = {
    "passed": result["text"] == "Hello world" and len(result["remaining"]) == 0,
    "detail": result["text"],
}`,
        },
        {
          id: "scroll-policy",
          label: "Scroll-follow policy",
          purpose: "Follow new output only when the reader remains near the bottom.",
          concepts: [
            { name: "distance_from_bottom", detail: "Remaining scroll distance in CSS pixels." },
            { name: "threshold", detail: "Small tolerance for layout and font changes." },
            { name: "user_scrolled_up", detail: "Explicit opt-out while reviewing older content." },
          ],
          code: `def should_follow_stream(options):
    distance_from_bottom = options["distanceFromBottom"]
    user_scrolled_up = options["userScrolledUp"]
    threshold = options.get("threshold", 80)
    return not user_scrolled_up and distance_from_bottom <= threshold`,
          checkCode: `near = should_follow_stream({"distanceFromBottom": 24, "userScrolledUp": False})
reading = should_follow_stream({"distanceFromBottom": 24, "userScrolledUp": True})
RESULT = {
    "passed": near is True and reading is False,
    "detail": "near bottom follows · reader control wins",
}`,
        },
      ],
    },
    experiment: { kind: "product", variant: "streaming-ui", title: "Replay the token stream", intro: "Replay the same fixed 60-delta response through burst, steady, stalled, and cancelled timing profiles. Inspect authored visual commits, scroll-follow decisions, bounded live-region contents, and terminal cleanup." },
  });
