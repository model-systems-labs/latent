# Lesson 05 audit — Transformers

## Naive learner review

The original summary named queries, keys, values, masking, and the surrounding Transformer block accurately, but it moved from prose to a four-row operation inventory without showing a learner how one attention row is computed. A new learner still had to infer the tensor shapes, which dimension controls scaling, when masking occurs, which axis softmax normalizes, and how probabilities become a context vector.

The revised lesson makes that chain explicit:

- `X[n×d_model]` projects to `Q,K[n×d_k]` and `V[n×d_v]`.
- `QKᵀ[n×n] / √d_k` contains one scaled compatibility score per query-key pair.
- Scores where `column > row` become `-Infinity` before row-wise softmax.
- The resulting probability matrix multiplies `V` to produce one `d_v`-wide context per token.
- Attention remains one sublayer inside the projection, residual, normalization, and MLP boundary.

The diagram now carries a three-token causal probability matrix. Its exactly-zero upper triangle, decoded-token row `[0.20, 0.33, 0.46]`, and context norms connect the derivation directly to the existing deterministic experiment rather than replacing that experiment.

## Wrong-answer debugging

The host-owned contracts now distinguish plausible mistakes rather than checking only one happy-path shape:

- Causal mask: unchanged scores, a transposed mask, and a diagonal-only mask all fail. Feedback says to preserve diagonal and past logits and write `-Infinity` only where `column > row`.
- Scaled attention: omitting scaling, using `√(number of keys)`, returning attention probabilities, taking only the winning value, or averaging values all fail. The second fixture deliberately makes `d_k`, key count, and value width different.
- Layer normalization: RMS-only normalization and division by variance instead of `√(variance + epsilon)` fail. A constant-vector fixture verifies that centering returns zeros and epsilon keeps the result finite.

Reference implementations pass every new case. The contract suite is now `llm-systems-contracts-v5`, which invalidates device-local passes produced by the weaker suite.

## UX and diagram changes

The new mechanism remains a single flat evidence surface: a compact operation sequence, one causal matrix, one short interpretation, and one decoder-block boundary. It uses the existing typographic and rule-based visual language, avoids nested cards, exposes table semantics, and keeps the live attention experiment as the lesson payoff.

## Validation

- Focused curriculum, typed-contract, and rendered-lesson tests: passed.
- Typecheck: passed.
- Lint: passed.
- Production build: passed.
- Complete app suite: 79/79 passed before the added rendered-lesson assertion; the focused rendered suite then passed 13/13.
- Workspace package suites: 18/18 passed.
- `git diff --check`: passed.
- Parent Playwright wrong-answer retest: passed. An unchanged mask, unscaled attention, and mean-only layer normalization each preserved their source and received direct future-mask, `sqrt(d_k)`, value-mixture, and `sqrt(variance + epsilon)` guidance. Corrected cells passed 2/2 cases each and reached `3/3 verified` only under v5.
- Parent visual and experiment review: passed. The three-token matrix, exact future zeros, decoded row, context norms, and full decoder-block boundary read as one flat technical mechanism; the deterministic live matrix remains the concrete payoff.
