import type { CourseLesson, CourseTrack } from "../lib/lesson-types";
import { getLessonSources } from "./sources";

type ExtendedLessonInput = Pick<
  CourseLesson,
  | "id" | "number" | "courseId" | "courseTitle" | "courseNumber" | "lessonNumber"
  | "mode" | "modeLabel" | "eyebrow" | "title" | "thesis" | "paperUrl"
  | "paperTitle" | "authors" | "year" | "summary" | "claims" | "diagram"
  | "questions" | "dataset" | "implementation" | "experiment"
>;

function makeLesson(input: ExtendedLessonInput): CourseLesson {
  const compactContext = input.summary.map((paragraph) => `- ${paragraph.label} ${paragraph.body}`).join("\n");
  return {
    ...input,
    sources: getLessonSources(input.id),
    paperContext: `
This lesson is "${input.title}" in the ${input.courseTitle} course.
Primary reference: "${input.paperTitle}" by ${input.authors} (${input.year}).
${compactContext}
- The browser experiment is a bounded implementation of the mechanism described in the lesson.
- Distinguish production distributed systems from the controlled single-browser simulation.
Answer precisely and technically. Separate the primary source from later convention. Do not invent benchmark results, quotations, or production guarantees. Keep answers under 240 words unless asked for detail.
`.trim(),
  };
}

export const systemsLessons: CourseLesson[] = [
  makeLesson({
    id: "inference-runtime",
    number: 7,
    courseId: "systems",
    courseTitle: "LLM Systems",
    courseNumber: 2,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Runtime simulation",
    eyebrow: "Inference · Prefill and decode",
    title: "Inference Runtime",
    thesis: "LLM inference separates a parallel prompt-prefill phase from an iterative decode phase whose state and memory grow with every generated token.",
    paperUrl: "https://arxiv.org/abs/2309.06180",
    paperTitle: "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    authors: "Woosuk Kwon et al.",
    year: "2023",
    summary: [
      { label: "Two phases.", body: "Prefill processes the prompt in parallel and populates attention state. Decode then advances one token per active request, repeatedly reading model weights and the accumulated key-value cache." },
      { label: "Memory growth.", body: "Every generated token adds keys and values for every layer. The resulting cache often dominates per-request memory and directly constrains concurrency." },
      { label: "Isolation.", body: "Browser inference belongs in a Web Worker so model execution cannot block React rendering. Messages form an explicit boundary between product state and model state." },
      { label: "Measurement.", body: "Time to first token reflects queueing and prefill; inter-token latency reflects decode. Combining them into one duration hides the user-visible shape of latency." },
    ],
    claims: {
      paper: "Paged allocation reduces KV-cache waste and enables higher serving throughput under dynamic request lengths.",
      lab: "The browser simulates prefill, iterative decode, worker isolation, and cache growth with explicit phase timing.",
      limit: "No GPU kernel, multi-host network, or production memory allocator is reproduced.",
    },
    diagram: {
      title: "Request lifecycle",
      caption: "The first visible token and later tokens are produced by different computational phases.",
      nodes: [
        { label: "Queue", value: "request admitted" },
        { label: "Prefill", value: "prompt → KV state" },
        { label: "Decode", value: "one token / iteration" },
        { label: "Complete", value: "release cache pages" },
      ],
    },
    questions: {
      intro: "Ask about prefill, decode, KV-cache growth, worker isolation, or latency measurement.",
      suggestions: ["Why is decode memory-bandwidth bound?", "What determines time to first token?", "Why isolate inference in a Worker?"],
    },
    dataset: {
      name: "Inference Trace",
      source: "Deterministic synthetic requests",
      license: "CC0",
      size: "6 requests · fixed prompt and output lengths",
      preview: "prompt 96 → output 32 · prompt 24 → output 80",
    },
    implementation: {
      filename: "inference-runtime.js",
      intro: "Implement phase accounting and KV-cache sizing before running the request lifecycle simulator.",
      codeBlocks: [
        {
          id: "inference-phases",
          label: "Phase accounting",
          purpose: "Separate prefill work from iterative decode work.",
          concepts: [
            { name: "promptTokens", detail: "Tokens processed together during prefill." },
            { name: "maxNewTokens", detail: "Maximum number of serial decode iterations." },
            { name: "decodeIterations", detail: "One scheduling opportunity per generated token." },
          ],
          code: `function inferencePhases(promptTokens, maxNewTokens) {
  return {
    prefillTokens: promptTokens,
    decodeIterations: maxNewTokens,
    totalTokenPositions: promptTokens + maxNewTokens,
  };
}`,
          checkCode: `const phases = inferencePhases(96, 32);
return { passed: phases.prefillTokens === 96 && phases.decodeIterations === 32 && phases.totalTokenPositions === 128, detail: phases.prefillTokens + " prefill · " + phases.decodeIterations + " decode" };`,
        },
        {
          id: "kv-bytes",
          label: "KV-cache bytes",
          purpose: "Calculate request memory from model shape and sequence length.",
          concepts: [
            { name: "2", detail: "Separate key and value tensors." },
            { name: "layers", detail: "Every Transformer layer owns cached states." },
            { name: "bytesPerValue", detail: "Storage width of each cached scalar." },
          ],
          code: `function kvCacheBytes({ layers, heads, headDimension, tokens, bytesPerValue = 2 }) {
  return 2 * layers * heads * headDimension * tokens * bytesPerValue;
}`,
          checkCode: `const bytes = kvCacheBytes({ layers: 4, heads: 8, headDimension: 16, tokens: 100, bytesPerValue: 2 });
return { passed: bytes === 204800, detail: (bytes / 1024).toFixed(0) + " KiB" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "runtime", title: "Run the inference lifecycle", intro: "Advance deterministic requests through queue, prefill, decode, and cache release while measuring phase latency." },
  }),
  makeLesson({
    id: "streaming-transport",
    number: 8,
    courseId: "systems",
    courseTitle: "LLM Systems",
    courseNumber: 2,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Protocol implementation",
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
  return "event: " + event + "\n" + "data: " + JSON.stringify(data) + "\n\n";
}`,
          checkCode: `const frame = encodeSse("token", { delta: "hi" });
return { passed: frame === "event: token\ndata: {\"delta\":\"hi\"}\n\n", detail: frame.replace(/\n/g, " ↵ ") };`,
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
  const frames = combined.split("\n\n");
  const remainder = frames.pop() ?? "";
  const events = frames.map((frame) => {
    const lines = frame.split("\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
    const data = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "null";
    return { event, data: JSON.parse(data) };
  });
  return { events, remainder };
}`,
          checkCode: `const first = parseSseChunk("", "event: token\ndata: {\"delta\":\"h");
const second = parseSseChunk(first.remainder, "i\"}\n\n");
return { passed: first.events.length === 0 && second.events[0].data.delta === "hi" && second.remainder === "", detail: second.events.length + " event parsed across chunks" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "streaming", title: "Inspect the event stream", intro: "Stream a response through adversarial byte chunks, pause rendering, cancel generation, and inspect every decoded event." },
  }),
  makeLesson({
    id: "scheduling-memory",
    number: 9,
    courseId: "systems",
    courseTitle: "LLM Systems",
    courseNumber: 2,
    lessonNumber: 3,
    mode: "core-mechanism",
    modeLabel: "Scheduler simulation",
    eyebrow: "Serving · Queues, batches, KV pages",
    title: "Scheduling and Memory",
    thesis: "High-throughput inference interleaves requests at token boundaries while a paged cache prevents variable-length sequences from reserving large contiguous memory regions.",
    paperUrl: "https://www.usenix.org/conference/osdi22/presentation/yu",
    paperTitle: "Orca: A Distributed Serving System for Transformer-Based Generative Models",
    authors: "Gyeong-In Yu et al.",
    year: "2022",
    summary: [
      { label: "Iteration scheduling.", body: "Requests have different prompt and output lengths. Scheduling at decode-iteration boundaries lets completed requests leave and waiting requests join without draining an entire static batch." },
      { label: "Token budget.", body: "A scheduler admits work under compute and memory budgets. Fairness, throughput, and latency can conflict when one long prompt competes with several short requests." },
      { label: "Paged cache.", body: "Fixed-size cache pages decouple logical token positions from contiguous physical allocation. Internal fragmentation is limited to the unused portion of a request's final page." },
      { label: "Product consequence.", body: "Queueing and scheduling choices appear directly as time to first token, inter-token stalls, and admission failures in the chat interface." },
    ],
    claims: {
      paper: "Iteration-level scheduling and selective batching improve utilization for generative model serving workloads.",
      lab: "A deterministic scheduler admits, batches, decodes, and releases variable-length requests under token and KV-page budgets.",
      limit: "The simulator models decisions and resource accounting, not kernel execution or a distributed GPU cluster.",
    },
    diagram: {
      title: "Continuous batching",
      caption: "The active batch changes after every decode iteration instead of remaining fixed until all requests finish.",
      nodes: [
        { label: "Waiting queue", value: "priority + arrival" },
        { label: "Admission", value: "token/page budget" },
        { label: "Decode batch", value: "one token each" },
        { label: "Release", value: "pages returned" },
      ],
    },
    questions: {
      intro: "Ask about continuous batching, fairness, token budgets, page allocation, or latency-throughput tradeoffs.",
      suggestions: ["Why do static batches waste capacity?", "How much can the final KV page waste?", "When should a long prompt wait?"],
    },
    dataset: {
      name: "Serving Workload",
      source: "Deterministic synthetic arrivals",
      license: "CC0",
      size: "9 requests · mixed prompt and output lengths",
      preview: "short chat · long document · concurrent follow-up",
    },
    implementation: {
      filename: "continuous-batching.js",
      intro: "Implement cache-page accounting and one scheduler iteration, then inspect latency and utilization under competing policies.",
      codeBlocks: [
        {
          id: "page-allocation",
          label: "Paged allocation",
          purpose: "Calculate pages and bounded internal fragmentation for one request.",
          concepts: [
            { name: "pageSize", detail: "Fixed number of token positions per physical page." },
            { name: "pages", detail: "Ceiling division of logical tokens by page size." },
            { name: "wastedSlots", detail: "Unused positions only in the final allocated page." },
          ],
          code: `function allocateKvPages(tokens, pageSize = 16) {
  const pages = Math.ceil(tokens / pageSize);
  return { pages, capacity: pages * pageSize, wastedSlots: pages * pageSize - tokens };
}`,
          checkCode: `const allocation = allocateKvPages(33, 16);
return { passed: allocation.pages === 3 && allocation.capacity === 48 && allocation.wastedSlots === 15, detail: allocation.pages + " pages · " + allocation.wastedSlots + " unused slots" };`,
        },
        {
          id: "batch-step",
          label: "Decode iteration",
          purpose: "Advance every admitted request by at most one output token.",
          concepts: [
            { name: "remaining", detail: "Tokens still required by an active request." },
            { name: "filter", detail: "Completed requests leave before the next iteration." },
            { name: "generated", detail: "Observable progress accumulated per request." },
          ],
          code: `function decodeIteration(activeRequests) {
  return activeRequests
    .map((request) => ({ ...request, remaining: request.remaining - 1, generated: request.generated + 1 }))
    .filter((request) => request.remaining > 0);
}`,
          checkCode: `const active = decodeIteration([{ id: "a", remaining: 1, generated: 0 }, { id: "b", remaining: 3, generated: 2 }]);
return { passed: active.length === 1 && active[0].id === "b" && active[0].remaining === 2 && active[0].generated === 3, detail: active.length + " request remains" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "scheduling", title: "Schedule the workload", intro: "Compare static and continuous batches while watching queue depth, active pages, utilization, and completion latency." },
  }),
  makeLesson({
    id: "reliability-observability",
    number: 10,
    courseId: "systems",
    courseTitle: "LLM Systems",
    courseNumber: 2,
    lessonNumber: 4,
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
  }),
];

export const productLessons: CourseLesson[] = [
  makeLesson({
    id: "conversation-state",
    number: 11,
    courseId: "product",
    courseTitle: "Chat Product",
    courseNumber: 3,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "React state model",
    eyebrow: "React · Messages and reducers",
    title: "Conversation State",
    thesis: "A chat interface is a state machine over conversations, messages, generation attempts, and transport events—not a textarea appended to an array.",
    paperUrl: "https://react.dev/learn/extracting-state-logic-into-a-reducer",
    paperTitle: "Extracting State Logic into a Reducer",
    authors: "React documentation",
    year: "Current reference",
    summary: [
      { label: "Normalized state.", body: "Conversations own ordered message ids while messages are addressable records. Stable ids allow streaming updates, retries, edits, and cancellation without relying on array position." },
      { label: "Attempt identity.", body: "One assistant message may have multiple generation attempts. Transport request ids and UI message ids should be related but not conflated." },
      { label: "Reducer boundary.", body: "Typed actions centralize legal transitions such as start, delta, complete, fail, cancel, edit, and regenerate. Rendering becomes a projection of state rather than a second state machine." },
      { label: "Derived state.", body: "Flags such as canStop or canRegenerate should be derived from message and request status instead of stored independently and allowed to drift." },
    ],
    claims: {
      paper: "Reducers consolidate state transitions when many event handlers update related state.",
      lab: "A typed conversation reducer processes deterministic user, token, completion, cancellation, edit, and retry events.",
      limit: "The lesson models one-device state and does not implement collaborative synchronization.",
    },
    diagram: {
      title: "Conversation domain model",
      caption: "Stable identities separate messages, generation attempts, and transport requests.",
      nodes: [
        { label: "Conversation", value: "ordered message ids" },
        { label: "Message", value: "role + content + status" },
        { label: "Attempt", value: "model + parameters" },
        { label: "Request", value: "transport lifecycle" },
      ],
    },
    questions: {
      intro: "Ask about normalized messages, reducer actions, stable identity, derived state, or generation attempts.",
      suggestions: ["Why not use array indexes as message ids?", "What state belongs to an attempt?", "Which chat flags should be derived?"],
    },
    dataset: { name: "Conversation Event Log", source: "Original deterministic actions", license: "CC0", size: "18 actions · 3 attempts", preview: "send → start → delta × 4 → complete → edit → regenerate" },
    implementation: {
      filename: "chat-reducer.js",
      intro: "Implement immutable message creation and token-delta transitions before replaying a complete conversation event log.",
      codeBlocks: [
        {
          id: "create-message",
          label: "Message record",
          purpose: "Create a stable, serializable message with explicit generation status.",
          concepts: [
            { name: "id", detail: "Stable identity independent of render position." },
            { name: "role", detail: "User, assistant, or system domain role." },
            { name: "status", detail: "Explicit lifecycle used to derive available actions." },
          ],
          code: `function createMessage({ id, role, content = "", status = "complete" }) {
  return { id, role, content, status, createdAt: 0 };
}`,
          checkCode: `const message = createMessage({ id: "m1", role: "assistant", status: "streaming" });
return { passed: message.id === "m1" && message.content === "" && message.status === "streaming" && message.createdAt === 0, detail: message.role + " · " + message.status };`,
        },
        {
          id: "append-delta",
          label: "Delta transition",
          purpose: "Append one transport delta to the matching streaming message.",
          concepts: [
            { name: "messageId", detail: "Targets a stable message rather than the last array element." },
            { name: "delta", detail: "Incremental text emitted by the transport." },
            { name: "map", detail: "Produces a new message array for React state identity." },
          ],
          code: `function appendMessageDelta(messages, messageId, delta) {
  return messages.map((message) =>
    message.id === messageId && message.status === "streaming"
      ? { ...message, content: message.content + delta }
      : message,
  );
}`,
          checkCode: `const next = appendMessageDelta([{ id: "a", content: "Hel", status: "streaming" }, { id: "b", content: "fixed", status: "complete" }], "a", "lo");
return { passed: next[0].content === "Hello" && next[1].content === "fixed", detail: next[0].content };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "state", title: "Replay the reducer", intro: "Step through a complete conversation trace and inspect state changes, derived actions, and ignored late events." },
  }),
  makeLesson({
    id: "streaming-react",
    number: 12,
    courseId: "product",
    courseTitle: "Chat Product",
    courseNumber: 3,
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
  }),
  makeLesson({
    id: "chat-actions-context",
    number: 13,
    courseId: "product",
    courseTitle: "Chat Product",
    courseNumber: 3,
    lessonNumber: 3,
    mode: "core-mechanism",
    modeLabel: "Interaction state lab",
    eyebrow: "Product · Stop, retry, context",
    title: "Actions and Context",
    thesis: "Editing, regenerating, stopping, and retrying are graph operations over conversation history whose model context must be reconstructed under a finite token budget.",
    paperUrl: "https://platform.openai.com/docs/guides/conversation-state",
    paperTitle: "Conversation state",
    authors: "OpenAI API documentation",
    year: "Current reference",
    summary: [
      { label: "Branching history.", body: "Regeneration creates another assistant attempt from the same prefix. Editing an earlier user message invalidates or branches all dependent messages after it." },
      { label: "Stop semantics.", body: "Stopping should abort generation and retain the partial assistant message with an explicit cancelled status. Deleting partial text hides useful state and complicates retry." },
      { label: "Context budget.", body: "The client assembles system instructions, retained turns, retrieved evidence, and the current user message under a maximum token budget. Truncation policy is product behavior." },
      { label: "Reproducibility.", body: "Every attempt should record model id, prompt version, sampling policy, and included message ids so differences can be explained rather than guessed." },
    ],
    claims: {
      paper: "Conversation state can be represented explicitly and carried across model requests rather than inferred from rendered UI.",
      lab: "The browser branches attempts, preserves cancellation, rebuilds a bounded context, and exposes the exact included message ids.",
      limit: "Token estimates are deterministic approximations rather than the selected model's production tokenizer.",
    },
    diagram: {
      title: "Conversation branch",
      caption: "A retry shares the prefix but creates a new attempt and potentially a new continuation.",
      nodes: [
        { label: "Prefix", value: "retained turns" },
        { label: "User edit", value: "new branch point" },
        { label: "Attempt", value: "model + policy" },
        { label: "Context", value: "budgeted request" },
      ],
    },
    questions: { intro: "Ask about branching history, cancellation, retries, prompt records, or token-budget policy.", suggestions: ["What should regenerate preserve?", "Should stopping delete partial text?", "Which messages leave the context first?"] },
    dataset: { name: "Branching Conversation", source: "Original deterministic scenario", license: "CC0", size: "12 messages · 3 branches", preview: "answer → stop → retry → edit earlier prompt" },
    implementation: {
      filename: "chat-actions.js",
      intro: "Implement bounded context selection and regeneration branching before manipulating a complete conversation graph.",
      codeBlocks: [
        {
          id: "context-budget",
          label: "Context selection",
          purpose: "Retain the newest complete turns that fit inside the available token budget.",
          concepts: [
            { name: "reverse", detail: "Considers the newest messages first." },
            { name: "used", detail: "Running token estimate for admitted messages." },
            { name: "unshift", detail: "Restores chronological order in the final request." },
          ],
          code: `function selectContext(messages, budget) {
  const selected = [];
  let used = 0;
  for (const message of [...messages].reverse()) {
    if (used + message.tokens > budget) continue;
    selected.unshift(message);
    used += message.tokens;
  }
  return { selected, used };
}`,
          checkCode: `const result = selectContext([{ id: "a", tokens: 6 }, { id: "b", tokens: 5 }, { id: "c", tokens: 4 }], 9);
return { passed: result.selected.map(m => m.id).join("") === "bc" && result.used === 9, detail: result.selected.map(m => m.id).join(" → ") + " · " + result.used + " tokens" };`,
        },
        {
          id: "regenerate-branch",
          label: "Regeneration branch",
          purpose: "Create a new assistant attempt from the same user-message prefix.",
          concepts: [
            { name: "parentUserId", detail: "Branch point shared by all regenerated attempts." },
            { name: "attemptId", detail: "Unique identity for metrics and model parameters." },
            { name: "status", detail: "Queued until transport starts producing output." },
          ],
          code: `function createRegeneration({ messageId, parentUserId, attemptId }) {
  return { messageId, parentUserId, attemptId, role: "assistant", content: "", status: "queued" };
}`,
          checkCode: `const branch = createRegeneration({ messageId: "m9", parentUserId: "m4", attemptId: "a2" });
return { passed: branch.parentUserId === "m4" && branch.attemptId === "a2" && branch.status === "queued", detail: branch.parentUserId + " → " + branch.attemptId };`,
        },
      ],
    },
    experiment: { kind: "product", variant: "context-actions", title: "Branch the conversation", intro: "Stop, retry, edit, and regenerate while inspecting the exact context and attempt record sent to the model." },
  }),
  makeLesson({
    id: "chat-product-quality",
    number: 14,
    courseId: "product",
    courseTitle: "Chat Product",
    courseNumber: 3,
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
  }),
];

export const courseTracks: CourseTrack[] = [
  {
    id: "models",
    number: 1,
    title: "Language Models",
    shortTitle: "Model",
    thesis: "Build the numerical path from tokens to a trained causal language model and real local inference.",
    outcome: "A learner-trained model checkpoint and a frozen local-model evaluation harness.",
    lessonIds: ["character-rnns", "neural-language-models", "subword-tokenization", "additive-attention", "transformers", "in-context-learning"],
  },
  {
    id: "systems",
    number: 2,
    title: "LLM Systems",
    shortTitle: "Platform",
    thesis: "Build the inference lifecycle, streaming transport, scheduler, memory model, and reliability boundary.",
    outcome: "An SSE-compatible local inference service and executable serving simulator.",
    lessonIds: systemsLessons.map((lesson) => lesson.id),
  },
  {
    id: "product",
    number: 3,
    title: "Chat Product",
    shortTitle: "React",
    thesis: "Build the React state machine and interaction system that turns model events into a usable chat product.",
    outcome: "A polished streaming chat interface with persistence, recovery, and accessible state.",
    lessonIds: productLessons.map((lesson) => lesson.id),
  },
];
