export const interviewPracticeReferenceSolutions = Object.freeze([
  Object.freeze({
    groupId: "identity-and-signals",
    questionId: "collapse-attempts",
    source: `def collapse_attempts(attempts):
    seen = set()
    output = []
    for attempt in attempts:
        delivery_id = attempt["deliveryId"]
        if delivery_id not in seen:
            seen.add(delivery_id)
            output.append({
                "deliveryId": delivery_id,
                "status": attempt["status"],
            })
    return output
`,
  }),
  Object.freeze({
    groupId: "identity-and-signals",
    questionId: "summarize-window",
    source: `def summarize_window(events, start_ms):
    traffic = 0
    errors = 0
    max_latency_ms = 0
    for event in events:
        if event["atMs"] >= start_ms:
            traffic += 1
            if event["outcome"] == "error":
                errors += 1
            max_latency_ms = max(max_latency_ms, event["latencyMs"])
    return {
        "traffic": traffic,
        "errors": errors,
        "maxLatencyMs": max_latency_ms,
    }
`,
  }),
  Object.freeze({
    groupId: "bounded-admission",
    questionId: "admit-per-tenant",
    source: `def admit_per_tenant(jobs, limit):
    admitted = []
    counts = {}
    for job in jobs:
        tenant = job["tenant"]
        if counts.get(tenant, 0) < limit:
            admitted.append(job["id"])
            counts[tenant] = counts.get(tenant, 0) + 1
    return admitted
`,
  }),
]);

export const interviewIdeReferenceSolutions = Object.freeze([
  Object.freeze({
    exerciseId: "bounded-webhook-retries",
    contractVersion: "interview-loop.retry-plan.v3",
    source: `def schedule_retries(deliveries, now_ms):
    delays = {1: 1000, 2: 2000, 3: 4000}
    output = []
    for delivery in deliveries:
        delay = delays.get(delivery["attempt"])
        if delivery["outcome"] == "retryable" and delay is not None:
            output.append({
                "deliveryId": delivery["deliveryId"],
                "runAtMs": now_ms + delay,
            })
    return output
`,
  }),
]);
