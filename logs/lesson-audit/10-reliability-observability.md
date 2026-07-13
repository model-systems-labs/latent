# Lesson 10 — Reliability and Observability

## Naive learner review

The original lesson named sound operational concepts, but it compressed request identity, retry identity, terminal state, and metrics into a generic Queued → Streaming → Terminal → Recorded inventory. A new learner could not see which identity survives a retry, which identity must change, or why one late token is safe to reject.

The revised explanation separates one stable logical request from its per-attempt ids. It defines the practice convention precisely: `attempt` is a zero-based index, `maxAttempts` is the total attempt budget, and another attempt exists only when `attempt + 1 < maxAttempts`. It also names the only event-accepting phases—queued, loading, prefill, and streaming—so terminal and unknown states fail closed.

The observability section now tells the learner what to record rather than merely saying to add metrics: queue, prefill, TTFT, decode or inter-token latency, terminal outcome, error class, resource release, logical request id, and attempt id. The browser lab remains a deterministic failure simulation and does not claim to recreate production traffic or regional failures.

## Practice and wrong-answer debugging

The retry policy expanded from three shallow examples to seven host-owned cases. It now covers:

- a transient first-attempt failure before visible output;
- a permanent failure with budget remaining;
- the first visible token closing the transparent-retry boundary;
- the second and final attempt in a two-attempt budget;
- a one-attempt budget;
- a larger custom three-attempt budget;
- the default two-attempt boundary when `maxAttempts` is omitted.

Focused regressions reject plausible shortcuts that ignore visible output, ignore transient classification, use the old off-by-one comparison, or cap every supplied budget at two. The first failure is written as an action—such as returning false after visible output—instead of an awkward prose fragment followed by verifier detail.

The terminal guard expanded from two examples to seven. It verifies complete, error, and cancelled terminal states; matching streaming and prefill events; an event from retired attempt `r-201.1` while `r-201.2` is active; and an unknown state. Regressions reject status-only and identity-only guards, a terminal set that forgets cancellation, and a nonterminal shortcut that accidentally accepts unknown states. The authored references pass every case.

## UX and worked diagram

The diagram now works one logical request `r-201` through two attempts. Attempt `r-201.1` spends 120 ms in queue and times out transiently with no visible token. The exact retry predicate retires it and creates `r-201.2`; the second attempt records queue 14 ms, prefill 69 ms, TTFT 83 ms, decode 338 ms, completion, and resource release. The diagram then rejects both a stale token from `r-201.1` and a post-completion token from `r-201.2`.

A side-by-side retry branch makes the user-visible boundary explicit: the observed zero-token failure retries, while the same transient failure after one visible token preserves partial output and stops. The presentation uses flat rules, type, and restrained violet accents, with a stacked narrow-screen layout rather than nested cards.

The four experiment scenarios now expose the same schema:

- logical request and per-attempt identities;
- queue/prefill/TTFT or other phase timing;
- visible token count and the concrete retry decision;
- the terminal transition;
- a rejected late event;
- reader, parser, worker, or KV resource accounting.

Queue timeout retries from `r-201.1` to `r-201.2`; malformed-frame preserves six visible tokens and terminates in error; worker crash retires the first worker/attempt before a bounded retry; user abort reaches cancelled in 14 ms without being reclassified as infrastructure failure.

## Validation

- TypeScript typecheck: passed
- Focused curriculum, typed-contract, rendered-HTML, and canonical compile suite: 40 passed
- ESLint: passed
- Full workspace package suite: 18 passed
- Full application suite: 91 passed
- Production build: passed
- Diff whitespace check: passed

Delegated agents cannot access the shared in-app browser backend. Parent Playwright verification is pending for the visual trace, staged wrong-answer feedback, authored references, and all four experiment scenarios.

## Parent Playwright verification

- The live summary showed one logical request across attempts `r-201.1` and `r-201.2`, the exact zero-based retry predicate, a visible-token counterfactual, phase metrics, stale-attempt rejection, terminal rejection, and resource release in one worked trace.
- The plausible retry implementation that ignored `tokensEmitted` failed at the visible-output boundary and gave the learner one concrete correction before acknowledging the remaining cases.
- The previously accepted status-only event guard now failed on the retired-attempt case and directed the learner to compare `request.id` with `event.requestId`.
- The authored retry policy and terminal guard each passed all 7 host-owned cases.
- All four live experiment policies were exercised. Queue timeout and worker crash showed bounded, identity-changing retries before visible output; malformed-frame preserved six visible tokens and terminated without retry; user abort reached cancelled in 14 ms without becoming an infrastructure error.
- Every scenario named request and attempt ids, phase timing, terminal state, a rejected late event, and zero remaining reader/parser/KV resource ownership as applicable.
