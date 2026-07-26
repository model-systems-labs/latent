import { defineExtendedLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/define-lesson";

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
    thesis: "A good chat UI turns a fast token stream into smooth, accessible screen updates while still handling cancellation and completion correctly.",
    paperUrl: "https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams",
    paperTitle: "Using readable streams",
    authors: "MDN Web Docs",
    year: "Current docs",
    summary: [
      { label: "Keep parsing out of React.", body: "The transport sends events as they arrive. The read loop should turn them into app actions for React. React shouldn't parse raw bytes or wait for one giant response string." },
      { label: "Don't render every piece.", body: "Dispatching every subword can cause extra renders and a jumpy layout. A small requestAnimationFrame buffer keeps every piece in order while grouping screen updates." },
      { label: "Respect the reader's scroll.", body: "Only keep auto-scrolling when the reader is still near the bottom. If someone scrolls up to read earlier content, don't yank them back down." },
      { label: "Group accessible updates.", body: "Announcing every token can overwhelm assistive technology. Send the live region meaningful batches, then make one final completion announcement." },
    ],
    claims: {
      paper: "ReadableStream lets you read chunks as they arrive, cancel the stream, and work with backpressure.",
      lab: "A fixed trace compares bursty, steady, stalled, and cancelled delivery. It shows every screen update, scroll decision, live announcement, and cleanup result.",
      limit: "This fixed lab doesn't benchmark every mix of browser, renderer, and assistive technology.",
    },
    diagram: {
      title: "One animation-frame commit",
      caption: "Typed token events are already parsed. The UI queue keeps their exact text until one animation-frame callback sends a render delta; scrolling, announcements, and cancellation remain separate policies.",
      nodes: [
        { label: "Typed token events", value: "t=2 ‘A’ · t=7 ‘ causal’ · t=11 ‘ €’" },
        { label: "Pending render-delta queue", value: "[‘A’, ‘ causal’, ‘ €’] · order retained" },
        { label: "requestAnimationFrame", value: "t=16 ms · flush once" },
        { label: "Reducer dispatch", value: "TOKEN_BATCH · delta ‘A causal €’" },
        { label: "Screen update", value: "one render · announcement stays limited" },
      ],
    },
    questions: { intro: "Ask about grouping renders, following the scroll, cancellation, live regions, or reading a stream.", suggestions: ["Why not render every token?", "When should auto-scroll stop?", "How should a screen reader announce streaming text?"] },
    dataset: { name: "Render Trace", source: "Course-authored synthetic stream", license: "Not separately licensed", size: "60 deltas · 4 timing profiles", preview: "burst · steady · stalled · cancelled" },
    implementation: {
      filename: "streaming-react.py",
      intro: "Build delta buffering and scroll-follow rules in Python, then compare transport events with the updates React would actually render.",
      codeBlocks: [
        {
          id: "delta-buffer",
          label: "Render buffer",
          purpose: "Combine token deltas into one screen update per frame.",
          concepts: [
            { name: "pending", detail: "The deltas that arrived since the last screen update." },
            { name: "join", detail: "Keeps the exact order, whitespace, empty strings, and Unicode without adding separators." },
            { name: "flush", detail: "Returns one string and a new empty queue without changing the input." },
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
          purpose: "Follow new output only while the reader stays near the bottom.",
          concepts: [
            { name: "distance_from_bottom", detail: "How many CSS pixels are left below the current scroll position." },
            { name: "threshold", detail: "A little wiggle room for layout and font changes." },
            { name: "user_scrolled_up", detail: "Lets the reader opt out while looking at older content." },
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
    experiment: { kind: "product", variant: "streaming-ui", title: "Replay the token stream", intro: "Run the same fixed 60-delta response with burst, steady, stalled, and cancelled timing. Check the planned screen updates, scroll-follow decisions, short live-region announcements, and final cleanup." },
  });
