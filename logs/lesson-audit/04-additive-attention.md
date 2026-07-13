# Lesson audit 04 — Additive Attention

## Naive-reader findings

- The original summary correctly named the fixed-vector bottleneck, compatibility scores, normalized alignments, and dynamic context, but it never followed one decoder step from shapes to scores to weights to context. A new learner had to infer both the softmax axis and the correspondence between each weight and encoder state.
- The original diagram was a four-row inventory—Encoder, Compatibility, Alignment, Context—rather than a computation. It did not explain how the lesson's date heatmap is produced or how to read one of its rows.
- The scoring formula was shown without defining the query, key, attention width, or matrix shapes. It also did not explicitly distinguish Bahdanau additive attention from dot-product attention.
- The browser experiment is a strong teaching artifact: training loss falls from about 1.104 to 0.002, uniform attention is 0.333 at each of three positions, and the learned heatmap aligns the output roles year, month, and day with 2026, March, and 14. The lesson needed to prepare the learner to interpret those results before running it.

## Wrong answers and feedback behavior

### Parent Playwright observations before the fix

- A plain `query · key` implementation that ignored `Wq`, `Wk`, `v`, `bias`, and `tanh` passed the only compatibility-score case. The case's balanced projections happened to expect zero, which the shortcut also returned.
- Uniform attention weights failed, but the learner saw three numeric range failures rather than the missing operation: one softmax across source positions.
- An unweighted average of encoder states failed with only “weighted context vector,” which did not say how to construct that vector.

### Post-fix behavioral coverage

Host-owned contracts now reject at least two plausible mistakes and accept the reference behavior for every cell:

- **Compatibility score:** a direct query-key dot product fails cases that independently expose the learned query projection, learned key projection and signed `v`, and bias plus `tanh`. A linear projected scorer that omits `tanh` also fails. Directions name the missing projection or nonlinear scoring step without revealing source.
- **Alignment weights:** uniform weights and raw score normalization fail with a direct instruction to apply one softmax across the complete source-position score array. A numerically unstable `exp(score)` implementation fails the large-logit case with guidance to subtract the maximum first.
- **Weighted context:** an unweighted mean and winner-take-all state selection both fail. Feedback now says to multiply each state by its corresponding alpha and then sum coordinate-wise.

The contract suite changed from `llm-systems-contracts-v3` to `llm-systems-contracts-v4`, so device-local passes from the weaker contracts are invalidated even when the saved source text is unchanged.

## Edits made

- Rewrote the summary around the actual tensor path for one decoder step: query and encoder-state shapes, additive scoring, the source-position softmax axis, and coordinate-wise weighted context construction.
- Explicitly contrasted the additive scorer `v^T tanh(Wq q + Wk h_i + b)` with direct dot-product scoring.
- Replaced the generic diagram with a worked “emit year” step. It shows three date positions, scores `[-1.8, -0.9, 2.4]`, alignments `[.014, .035, .951]`, and the resulting weighted context expression.
- Connected the worked row to the deterministic experiment: 0.333 means uniform attention; a trained year row should peak on the 2026 source position, with later decoder rows shifting to March and 14.
- Kept the mechanism flat and line-based, with a two-column scoring-family contrast that collapses to one column on mobile.
- Strengthened all three practice contracts and added focused behavioral and server-rendered lesson tests.

## Remaining limitations

- The browser experiment supervises date-alignment roles directly; it does not reproduce the paper's end-to-end translation objective or BLEU results.
- The worked scores are illustrative values chosen to expose the computation. They are not claimed to be the exact learned logits from a particular training run.
- The lesson implements the additive attention primitive, not Transformer multi-head self-attention; the summary and diagram now mark that boundary explicitly.

## Verification evidence

- `npm run typecheck` — passed.
- `npm run lint -- --quiet` — passed.
- `npm run build:web` — passed.
- `node --test tests/curriculum-manifest.test.mjs tests/typed-exercise-contracts.test.mjs tests/rendered-html.test.mjs` — 25/25 passed, including rejected shortcut implementations, accepted references, contract-suite identity, and the worked decoder-step rendering.
- `npm test` — all workspace suites, the production build, and all 78 application tests passed.
- `git diff --check` — passed.
- Parent Playwright post-fix wrong-answer retest — passed. The plain dot-product scorer failed three parameter-sensitive cases with query/key/nonlinearity directions; uniform weights failed with full-axis softmax, negative-logit, and stability guidance; an unweighted context average failed with state-to-alpha correspondence guidance. Corrected cells passed 3/3, 3/3, and 2/2 cases and reached `3/3 verified` only under v4.
- Parent visual and experiment review — passed. The worked year step and additive-vs-dot-product contrast are legible in one flat mechanism, and the preserved training experiment still reduces loss from 1.104 to 0.002 while aligning year/month/day to 2026/March/14.
