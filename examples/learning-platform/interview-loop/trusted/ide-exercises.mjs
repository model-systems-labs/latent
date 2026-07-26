export const ideExercises = [
  {
    id: "bounded-webhook-retries",
    contractVersion: "interview-loop.retry-plan.v2",
    title: "Schedule bounded webhook retries",
    summary: "Step 4 of 4. Turn retry semantics into a deterministic plan with terminal-state and retry-budget boundaries. Target O(r) time and O(r) output space for r deliveries.",
    language: "javascript",
    files: [
      {
        path: "schedule-retries.js",
        content: `function scheduleRetries(deliveries, nowMs) {
  // Return { deliveryId, runAtMs } for retryable deliveries only.
  // attempt is the number of the attempt that just finished.
  // Retry attempts 1, 2, and 3 after 1s, 2s, and 4s respectively.
  // Attempt 4 exhausts the retry budget. Preserve input order.
  // Return a fresh array and fresh result objects. Do not mutate deliveries.
  // Target O(r) time and O(r) output space.
  return [];
}
`,
      },
    ],
    entrypoint: {
      kind: "function",
      functionName: "scheduleRetries",
    },
    limits: {
      timeoutMs: 1500,
      maxOutputBytes: 50000,
    },
    checks: [
      {
        id: "mixed-outcomes",
        label: "schedules only retryable deliveries with exponential delays",
        args: [
          [
            { deliveryId: "evt-a", outcome: "retryable", attempt: 1 },
            { deliveryId: "evt-b", outcome: "delivered", attempt: 1 },
            { deliveryId: "evt-c", outcome: "retryable", attempt: 3 },
          ],
          10_000,
        ],
        expected: [
          { deliveryId: "evt-a", runAtMs: 11_000 },
          { deliveryId: "evt-c", runAtMs: 14_000 },
        ],
      },
      {
        id: "retry-budget",
        label: "stops after the fourth completed attempt",
        args: [
          [
            { deliveryId: "evt-a", outcome: "retryable", attempt: 4 },
            { deliveryId: "evt-b", outcome: "retryable", attempt: 2 },
          ],
          500,
        ],
        expected: [
          { deliveryId: "evt-b", runAtMs: 2_500 },
        ],
      },
      {
        id: "terminal-outcomes",
        label: "does not retry delivered or permanent failures",
        args: [
          [
            { deliveryId: "evt-a", outcome: "delivered", attempt: 1 },
            { deliveryId: "evt-b", outcome: "permanent-failure", attempt: 1 },
          ],
          2_000,
        ],
        expected: [],
      },
      {
        id: "empty-input",
        label: "returns an empty plan when there are no deliveries",
        args: [[], 2_000],
        expected: [],
      },
    ],
  },
];
