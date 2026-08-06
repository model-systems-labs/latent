export const ideExercises = [
  {
    id: "bounded-webhook-retries",
    contractVersion: "interview-loop.retry-plan.v4",
    title: "Coding follow-up: schedule bounded retries",
    summary: "A system-design interview can narrow into an implementation follow-up. Turn retry semantics into a deterministic plan with terminal-state and retry-budget boundaries. Target O(r) time and O(r) output space for r deliveries.",
    language: "python",
    runtime: {
      language: "python",
      environment: "host-managed",
      engine: "pyodide",
      engineVersion: "314.0.3",
      capabilities: ["function"],
      limits: {
        timeoutMs: 10000,
        maxOutputBytes: 50000,
      },
    },
    files: [
      {
        path: "schedule_retries.py",
        content: `def schedule_retries(deliveries: list[dict[str, str | int]], now_ms: int) -> list[dict[str, str | int]]:
    # Return dictionaries with "deliveryId" and "runAtMs" keys for retryable deliveries only.
    # attempt is the number of the attempt that just finished.
    # Retry attempts 1, 2, and 3 after 1s, 2s, and 4s respectively.
    # Attempt 4 exhausts the retry budget. Preserve input order.
    # Return a fresh list and fresh result dictionaries.
    # When this function returns, deliveries must equal its original value.
    # Target O(r) time and O(r) output space.
    return []
`,
      },
    ],
    entrypoint: {
      kind: "function",
      functionName: "schedule_retries",
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
