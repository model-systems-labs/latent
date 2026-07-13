# Lesson 12 — Streaming React

## Naive learner review

The original lesson separated transport, render cadence, scrolling, and announcements in prose, but its diagram was a generic `ReadableStream → Frame buffer → Reducer → View` pipeline. `Frame buffer` also sounded like the SSE framing buffer from lesson 9. A new learner could not see when token events arrive, which queue React owns, or why several transport events become one visual update.

The revised explanation works one concrete UI frame:

- already-parsed token events arrive at 2, 7, and 11 milliseconds;
- their exact deltas, including leading spaces and `€`, enter a pending render-delta queue;
- the 16 millisecond `requestAnimationFrame` callback flushes once;
- one `TOKEN_BATCH` reducer action produces one visual commit;
- the near-bottom scroll gate and bounded live-region write run as independent UI policies;
- completion flushes pending text, while cancellation drops pending text, cancels the scheduled frame, and rejects late deltas.

The lesson never implies that this queue parses bytes or SSE frames. That responsibility remains in Streaming Transport.

## Practice and wrong-answer debugging

`flushTokenBuffer` expanded from one shallow case to four host-owned cases. They cover an ordinary burst, empty/whitespace/newline/Unicode deltas, an empty queue, and arrival order that differs from sort order. Every QuickJS input is frozen, so `splice`, `sort`, and other input mutation shortcuts cannot pass. Staged feedback directs learners to join every delta with no separator, preserve exact text, and return a fresh empty `remaining` queue.

Focused regressions reject first-delta-only, separator insertion, sorting, retained pending state, and input mutation. The authored `pending.join("")` reference passes all four cases.

`shouldFollowStream` expanded from two cases to seven. It covers near, exactly at the default 80-pixel threshold, beyond it, explicit `userScrolledUp`, a custom threshold on both sides, and an explicit zero threshold. Focused regressions reject distance-only logic, user-flag-only logic, an exclusive `<` boundary, and a fixed 80-pixel constant. The authored inclusive, override-aware reference passes every case.

The contract suite is now `llm-systems-contracts-v12`, so a result verified against the earlier shallow checks is not carried forward.

## UX and worked diagram

The diagram is a flat timing trace rather than nested pipeline cards. It exposes the exact pending queue and reducer action, then separates scroll, live-region, complete, and cancel policy below the main render path. Desktop uses fine rules and a two/three-column evidence rhythm; the narrow layout becomes one readable column with left-aligned code.

The experiment now exposes every timing profile named by the dataset:

- **Burst:** 60/60 delivered deltas, 12 visual commits, 4 bounded announcements, no dropped text.
- **Steady:** 60/60 delivered deltas, 30 commits, 4 announcements, no dropped text.
- **Stalled:** 60/60 delivered deltas, a 440 millisecond transport pause, 14 commits, 4 announcements, and paused scroll following at 214 pixels.
- **Cancelled:** 23/60 delivered deltas, 4 commits, 2 announcements, exact pending text `" positions."` dropped, the scheduled frame cancelled, one late event rejected, and reader/generator cleanup recorded.

Each selectable profile shows exact metric totals, timestamped commit evidence, visible assistant text/status, scroll-follow state, every live-region string, dropped text, and terminal cleanup. The output is deterministic instructional data, not a browser benchmark.

## Reference sources

- MDN Web Docs, **Using readable streams** — asynchronous consumption and cancellation.
- WHATWG, **Streams Standard** — normative reader, queue, and cancellation behavior.
- React, **useTransition** — non-blocking rendering and responsiveness during UI updates.

## Validation

- TypeScript typecheck: passed
- ESLint: passed
- Focused curriculum, typed-contract, and rendered-HTML suite: 42 passed
- Production build: passed
- Full workspace package suite: 18 passed
- Full application suite: 96 passed
- Diff whitespace check: passed

Delegated agents cannot access the shared in-app browser backend. Parent Playwright verification is pending for desktop/mobile diagram readability, the staged wrong-answer feedback, both authored references, and all four experiment profiles.

## Parent Playwright verification

- The live summary traced three typed token events at 2, 7, and 11 ms into the render-delta queue, a single 16 ms animation-frame flush, one `TOKEN_BATCH` reducer action, one visible commit, a separate scroll gate, and a bounded live-region write.
- A first-delta-only buffer failed with exact-order/no-separator guidance; an exclusive scroll threshold failed specifically at the inclusive boundary. The earlier distance-only policy also failed because `userScrolledUp` must override proximity.
- The authored render buffer passed 4 of 4 cases and the authored scroll policy passed 7 of 7.
- All four live profiles were exercised. Burst produced 60/60 deltas, 12 commits, and 4 announcements; steady produced 60/60, 30, and 4; stalled produced 60/60, 14, and 4 while preserving a 440 ms pause and pausing scroll at 214 px.
- Cancelled delivered 23 of 60 deltas in 4 commits, made 2 bounded announcements, dropped the exact pending text `" positions."`, cancelled the scheduled frame and reader, rejected the late delta, and retained the committed partial response.
