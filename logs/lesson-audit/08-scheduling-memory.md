# Lesson 08 audit — Scheduling and Memory

## Naive-learner review

The original summary named the right serving ideas, but the diagram was a four-item inventory: Waiting → Admission → Decode → Release. It did not show why static membership wastes decode slots, what changes at an iteration boundary, or how the fixed experiment's metrics follow from that policy difference.

The revised lesson holds one workload constant and compares the two policies directly:

- both begin with `a`, `b`, and `c` active, `d` waiting, and 11 KV pages allocated;
- static membership leaves `a`'s position idle after it completes, while `d` waits for the longest sequence to drain;
- continuous batching retains `a` in a completed lane, releases its pages, and admits `d` into the next iteration;
- the fixed simulator reports continuous = 88 iterations, 86% utilization, p95 wait 7; static = 116 iterations, 61% utilization, p95 wait 19.

The copy now explicitly limits the inference. This comparison isolates scheduler policy for one deterministic arrival trace and resource budget. It does not establish universal production gains because scheduler overhead, fairness, prefill interference, kernels, and other workload shapes are out of scope.

## Wrong-answer debugging

### Paged allocation

Host-owned cases now cover zero tokens, an exact 32-token boundary, the first token over that boundary, and a nearly full final page. They reject at least these plausible mistakes:

1. `Math.floor(tokens / pageSize)`, which underallocates when a remainder exists;
2. `Math.floor(tokens / pageSize) + 1`, which adds an unnecessary page at zero and exact multiples.

Feedback is staged around the equations the learner needs: use ceiling division for `pages`, compute `capacity = pages × pageSize`, then compute `wastedSlots = capacity − tokens`. A separate bound confirms that waste is between zero and `pageSize − 1`.

### Decode iteration

The former API returned only surviving active requests, so the scheduler lost the identities it needed to release pages and account completion latency. The reference now returns `{ active, completed }` and copies records rather than mutating input.

Host-owned cases cover an empty iteration, two simultaneously active requests, an active/completing mix with page metadata, and an already-zero/one-token mix. They reject at least these plausible mistakes:

1. returning only a filtered active array;
2. advancing only the first request;
3. returning a completed array but dropping the completed request identity;
4. incrementing a request that was already at zero.

Failure summaries direct the learner first to the missing result lanes, then to advancing every eligible request, then to preserving newly completed identities. The complete result still stays available to the host verifier.

## UX and diagram changes

- Replaced the generic lifecycle inventory with a flat, controlled two-policy comparison.
- Put identical arrivals and limits above both policy lanes.
- Showed the exact idle-slot versus completion-release-readmission event sequence.
- Put 116/61%/19 and 88/86%/7 beside their corresponding policies.
- Added a visible “Can infer / Cannot infer” boundary.
- Added a responsive layout that stacks policy lanes and inference notes on narrow screens without introducing nested card chrome.
- Kept both experiment policy buttons, metric row, and trace; made their events agree with the diagram and the completion-aware API.
- Updated the saved scheduling artifact to expose active and completed lanes, so the lesson file still advances the canonical project/capstone flow.

## Verification

- Parent Playwright evidence before revision confirmed generic failure text for floor allocation and first-request-only decoding, and confirmed the existing static/continuous metrics.
- Parent Playwright retest confirmed that floor allocation receives the ceiling-division direction and the old active-only decode implementation receives the `{ active, completed }` result-shape direction. The correct reference implementations then passed all four isolated cases in each cell.
- The retest also exposed and fixed the shared singular grammar edge case: `1 additional case still fails`, while plural counts remain `N additional cases still fail`.
- Focused host-runtime regressions exercise the reference implementations and multiple wrong implementations per cell.
- The authored decode reference is executed against frozen input to confirm it does not mutate request records.
- Focused curriculum and typed-contract tests: 17 passed.
- Rendered HTML tests: 17 passed, including the policy comparison and completion-aware API.
- Full application tests: 87 passed.
- Workspace package tests: 18 passed.
- Typecheck, lint, and production build: passed.
- Diff whitespace check: passed.
