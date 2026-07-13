import { defineExtendedLesson } from "../define-lesson";

export const schedulingMemoryLesson = defineExtendedLesson({
    id: "scheduling-memory",
    number: 9,
    courseId: "systems",
    courseTitle: "Inference Runtime",
    courseNumber: 2,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Scheduler simulation",
    eyebrow: "Serving · Queues, batches, KV pages",
    title: "Scheduling and Memory",
    thesis: "Continuous batching replaces completed sequences at decode-iteration boundaries, while paged KV-cache allocation makes that turnover possible without reserving one contiguous region per request.",
    paperUrl: "https://www.usenix.org/conference/osdi22/presentation/yu",
    paperTitle: "Orca: A Distributed Serving System for Transformer-Based Generative Models",
    authors: "Gyeong-In Yu et al.",
    year: "2022",
    summary: [
      { label: "Static membership.", body: "A conventional batch keeps the same requests together until its longest sequence finishes. Short sequences stop producing useful tokens first, so their decode slots sit idle even while other requests wait in the queue." },
      { label: "Iteration scheduling.", body: "Continuous batching revisits membership after each decode iteration. Every active sequence advances by at most one token; completed requests are recorded, their KV pages are released, and eligible waiting work can enter the next iteration." },
      { label: "Paged KV cache.", body: "A request receives fixed-size pages as its stored keys and values grow. Ceiling division allocates enough capacity, and internal fragmentation is bounded by fewer than one page of unused slots per request." },
      { label: "Policy boundary.", body: "The browser comparison holds arrivals and resource limits fixed, so it isolates scheduler policy for one deterministic workload. Its 88-versus-116 iteration result does not prove that continuous batching always wins: admission overhead, fairness, prefill interference, and workload shape still matter in production." },
    ],
    claims: {
      paper: "Iteration-level scheduling and selective batching improve utilization for generative model serving workloads.",
      lab: "With identical arrivals and resource limits, the deterministic simulator compares static membership with completion, page release, and immediate readmission at iteration boundaries.",
      limit: "The fixed metrics explain this workload only; the simulator does not model scheduler overhead, fairness mechanisms, kernels, or a distributed GPU cluster.",
    },
    diagram: {
      title: "Static versus continuous membership",
      caption: "Both policies receive the same arrivals. Only continuous batching can turn a completed slot and released pages into a new admission at the next decode boundary.",
      nodes: [
        { label: "Same arrivals", value: "a, b, c admitted · d waiting · 11 pages active" },
        { label: "Static membership", value: "a finishes → its slot idles → d waits for the longest sequence" },
        { label: "Continuous turnover", value: "a completes → pages released → d joins the next iteration" },
        { label: "Measured outcome", value: "continuous 88 / 86% / 7 · static 116 / 61% / 19" },
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
          purpose: "Allocate enough KV pages for zero, exact-boundary, and partial-page token counts.",
          concepts: [
            { name: "pageSize", detail: "Fixed number of token positions per physical page." },
            { name: "pages", detail: "Ceiling division of logical tokens by page size." },
            { name: "capacity", detail: "Allocated token positions: pages × pageSize." },
            { name: "wastedSlots", detail: "Unused positions: capacity − tokens, always less than one page." },
          ],
          code: `function allocateKvPages(tokens, pageSize = 16) {
  const pages = Math.ceil(tokens / pageSize);
  return { pages, capacity: pages * pageSize, wastedSlots: pages * pageSize - tokens };
}`,
          checkCode: `const partial = allocateKvPages(33, 16);
const exact = allocateKvPages(32, 16);
const empty = allocateKvPages(0, 16);
return { passed: partial.pages === 3 && partial.capacity === 48 && partial.wastedSlots === 15 && exact.pages === 2 && exact.wastedSlots === 0 && empty.pages === 0, detail: partial.pages + " pages · " + partial.wastedSlots + " unused slots" };`,
        },
        {
          id: "batch-step",
          label: "Decode iteration",
          purpose: "Advance every admitted request once, retaining both active and newly completed identities.",
          concepts: [
            { name: "remaining", detail: "Tokens still required by an active request." },
            { name: "active", detail: "Advanced requests that still need another decode iteration." },
            { name: "completed", detail: "Finished identities retained for page release and latency accounting." },
          ],
          code: `function decodeIteration(activeRequests) {
  const active = [];
  const completed = [];

  for (const request of activeRequests) {
    if (request.remaining <= 0) {
      completed.push({ ...request });
      continue;
    }

    const advanced = {
      ...request,
      remaining: request.remaining - 1,
      generated: request.generated + 1,
    };

    if (advanced.remaining === 0) completed.push(advanced);
    else active.push(advanced);
  }

  return { active, completed };
}`,
          checkCode: `const result = decodeIteration([{ id: "a", remaining: 1, generated: 0 }, { id: "b", remaining: 3, generated: 2 }]);
return { passed: result.active.length === 1 && result.active[0].id === "b" && result.completed.length === 1 && result.completed[0].id === "a", detail: result.active.length + " active · " + result.completed.length + " completed" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "scheduling", title: "Schedule the workload", intro: "Compare static and continuous batches while watching queue depth, active pages, utilization, and completion latency." },
  });
