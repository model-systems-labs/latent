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
  });
