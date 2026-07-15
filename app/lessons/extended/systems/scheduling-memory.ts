import { defineExtendedLesson } from "../define-lesson";

export const schedulingMemoryLesson = defineExtendedLesson({
    id: "scheduling-memory",
    number: 9,
    courseId: "systems",
    courseTitle: "Inference Runtime",
    courseNumber: 2,
    lessonNumber: 2,
    mode: "core-mechanism",
    modeLabel: "Scheduler walkthrough",
    eyebrow: "Serving · Queues, batches, KV pages",
    title: "Scheduling and Memory",
    thesis: "Continuous batching swaps finished sequences for waiting ones between decode iterations. A paged KV cache makes that possible without reserving one big, unbroken block of memory for every request.",
    paperUrl: "https://www.usenix.org/conference/osdi22/presentation/yu",
    paperTitle: "Orca: A Distributed Serving System for Transformer-Based Generative Models",
    authors: "Gyeong-In Yu et al.",
    year: "2022",
    summary: [
      { label: "Static batches keep the same members.", body: "A regular batch keeps the same requests together until the longest sequence finishes. Short sequences stop producing useful tokens sooner, so their decode slots sit idle while other requests are still waiting." },
      { label: "Continuous batches change each round.", body: "Continuous batching checks membership after every decode iteration. Each active sequence moves ahead by at most one token. After that, completed requests are recorded, their KV pages are freed, and eligible work from the queue can join the next iteration." },
      { label: "Use pages for the KV cache.", body: "A request gets fixed-size pages as its saved keys and values grow. Ceiling division gives it enough room, and each request wastes fewer than one page of unused slots." },
      { label: "Keep the result in perspective.", body: "The browser comparison uses the same arrivals and resource limits for both schedulers, so you're only comparing policy on one fixed workload. The 88-versus-116 iteration result does not prove that continuous batching always wins. Admission overhead, fairness, prefill interference, and the shape of the workload still matter in production." },
    ],
    claims: {
      paper: "Scheduling at each iteration and choosing which requests to batch can use serving capacity more efficiently for generative models.",
      lab: "With the same planned arrivals and resource limits, a fixed trace compares static membership with finishing, freeing pages, and admitting new work between iterations.",
      limit: "These fixed numbers only explain this workload. The trace doesn't model scheduler overhead, fairness rules, kernels, or a distributed GPU cluster.",
    },
    diagram: {
      title: "Static versus continuous membership",
      caption: "Both policies get the same requests. Only continuous batching can use a finished slot and its freed pages to admit a waiting request at the next decode boundary.",
      nodes: [
        { label: "Same arrivals", value: "a, b, c admitted · d waiting · 11 pages active" },
        { label: "Static membership", value: "a finishes → its slot idles → d waits for the longest sequence" },
        { label: "Continuous turnover", value: "a completes → pages released → d joins the next iteration" },
        { label: "Measured outcome", value: "continuous 88 / 86% / 7 · static 116 / 61% / 19" },
      ],
    },
    questions: {
      intro: "Ask about continuous batching, fairness, token budgets, page allocation, or the tradeoff between latency and throughput.",
      suggestions: ["Why do static batches waste capacity?", "How much can the final KV page waste?", "When should a long prompt wait?"],
    },
    dataset: {
      name: "Serving Workload",
      source: "Fixed synthetic arrivals",
      license: "CC0",
      size: "9 requests · mixed prompt and output lengths",
      preview: "short chat · long document · concurrent follow-up",
    },
    implementation: {
      filename: "continuous-batching.py",
      intro: "Build cache-page accounting and one scheduler iteration in Python, then compare latency and capacity use under the two policies.",
      codeBlocks: [
        {
          id: "page-allocation",
          label: "Paged allocation",
          purpose: "Allocate enough KV pages when the token count is zero, exactly fills a page, or ends partway through one.",
          concepts: [
            { name: "page_size", detail: "The fixed number of token positions in one physical page." },
            { name: "pages", detail: "The token count divided by page size and rounded up." },
            { name: "capacity", detail: "The number of token positions allocated: pages × page_size." },
            { name: "wastedSlots", detail: "The returned JSON field for unused positions: capacity − tokens. It's always less than one page." },
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
          purpose: "Advance every admitted request once and keep track of both the still-active and newly finished request ids.",
          concepts: [
            { name: "remaining", detail: "How many tokens an active request still needs." },
            { name: "active", detail: "Requests that moved ahead but still need another decode iteration." },
            { name: "completed", detail: "Finished request ids kept so their pages can be freed and their latency recorded." },
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
    experiment: { kind: "systems", variant: "scheduling", title: "Replay the scheduling workload", intro: "Replay the fixed static and continuous schedules, then compare the planned queue depth, active pages, capacity use, and time to completion." },
  });
