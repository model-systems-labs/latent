import { defineExtendedLesson } from "../define-lesson";

export const schedulingMemoryLesson = defineExtendedLesson({
    id: "scheduling-memory",
    number: 9,
    courseId: "systems",
    courseTitle: "Inference Runtime",
    courseNumber: 2,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Worked scheduler trace",
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
      lab: "With identical authored arrivals and resource limits, a deterministic worked trace compares static membership with completion, page release, and readmission at iteration boundaries.",
      limit: "The fixed metrics explain this workload only; the trace does not model scheduler overhead, fairness mechanisms, kernels, or a distributed GPU cluster.",
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
      filename: "continuous-batching.py",
      intro: "Implement cache-page accounting and one scheduler iteration in Python, then inspect latency and utilization under competing policies.",
      codeBlocks: [
        {
          id: "page-allocation",
          label: "Paged allocation",
          purpose: "Allocate enough KV pages for zero, exact-boundary, and partial-page token counts.",
          concepts: [
            { name: "page_size", detail: "Fixed number of token positions per physical page." },
            { name: "pages", detail: "Ceiling division of logical tokens by page size." },
            { name: "capacity", detail: "Allocated token positions: pages × page_size." },
            { name: "wastedSlots", detail: "Returned JSON field for unused positions: capacity − tokens, always less than one page." },
          ],
          code: `def allocate_kv_pages(tokens, page_size=16):
    pages = (tokens + page_size - 1) // page_size
    capacity = pages * page_size
    return {
        "pages": pages,
        "capacity": capacity,
        "wastedSlots": capacity - tokens,
    }`,
          checkCode: `partial = allocate_kv_pages(33, 16)
exact = allocate_kv_pages(32, 16)
empty = allocate_kv_pages(0, 16)
RESULT = {
    "passed": (
        partial["pages"] == 3
        and partial["capacity"] == 48
        and partial["wastedSlots"] == 15
        and exact["pages"] == 2
        and exact["wastedSlots"] == 0
        and empty["pages"] == 0
    ),
    "detail": f'{partial["pages"]} pages · {partial["wastedSlots"]} unused slots',
}`,
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
          code: `def decode_iteration(active_requests):
    active = []
    completed = []

    for request in active_requests:
        if request["remaining"] <= 0:
            completed.append(dict(request))
            continue

        advanced = {
            **request,
            "remaining": request["remaining"] - 1,
            "generated": request["generated"] + 1,
        }

        if advanced["remaining"] == 0:
            completed.append(advanced)
        else:
            active.append(advanced)

    return {"active": active, "completed": completed}`,
          checkCode: `result = decode_iteration([
    {"id": "a", "remaining": 1, "generated": 0},
    {"id": "b", "remaining": 3, "generated": 2},
])
RESULT = {
    "passed": (
        len(result["active"]) == 1
        and result["active"][0]["id"] == "b"
        and len(result["completed"]) == 1
        and result["completed"][0]["id"] == "a"
    ),
    "detail": f'{len(result["active"])} active · {len(result["completed"])} completed',
}`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "scheduling", title: "Replay the scheduling workload", intro: "Replay fixed static and continuous schedules while inspecting authored queue depth, active pages, utilization, and completion latency." },
  });
