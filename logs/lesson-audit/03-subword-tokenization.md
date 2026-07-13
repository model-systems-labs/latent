# Lesson audit 03 — Subword Tokenization

## Naive-reader findings

- The original summary named the BPE steps accurately, but it never followed one tiny corpus through pair counting, merge selection, corpus-wide replacement, and recounting. A new learner could know the nouns without understanding the state transition.
- The original four-row diagram was an inventory rather than a mechanism. It did not show concrete frequencies, which pair wins, why counts change after a merge, or how training produces the ordered artifact used by the encoder.
- Pair keys were described only as symbols “joined by a separator.” The reference source used an invisible null character, while the contract expected paths such as `l\u0000o`. A learner who reasonably used `left + right` received a missing-value error containing an invisible separator and no explanation of the representation the exercise required.
- Simple concatenation is not only different from the hidden reference; it is incorrect when symbol boundaries differ. `[a, bc]` and `[ab, c]` would both collapse to the key `abc`.
- The merge operation promised to replace every occurrence, but its single contract contained only one occurrence. An implementation that stopped after the first match passed.
- The encoder contract checked one normal merge list, but did not prove that order is semantically observable or that one merge must be applied at every matching position.
- The paper/lab boundary needed one more detail: the paper trains from word-frequency data with word-boundary conventions, while the small browser lab expands literal occurrences and omits boundary markers.

## Wrong answers and feedback behavior

### Parent Playwright observation before the fix

- `countPairs` implemented with `symbols[index] + symbols[index + 1]` failed with “Could not find value at l\u0000o.” Because neither the source explanation nor the UI exposed the null separator, the feedback gave a novice no useful next action.
- `mergePair` implemented with `findIndex` and one splice incorrectly passed the only contract even though it merged only the first occurrence.

### Post-fix behavioral coverage

Automated contract evaluation now rejects two plausible mistakes per cell and accepts the reference behavior:

- **Adjacent pair counts:** (1) concatenate the two symbols directly; (2) record each pair only once instead of accumulating frequency. Cases now cover repeated pairs, overlapping candidate positions in `aaa`, and the distinct boundaries `[a, bc]` versus `[ab, c]`. Feedback explicitly directs the learner to `JSON.stringify([left, right])`, visible JSON keys, one-position counting, and frequency accumulation.
- **Merge operation:** (1) replace only the first occurrence; (2) detect overlapping matches without skipping the consumed right symbol. Cases require replacement across `a b x a b` and require the non-overlapping result `aa · a` for `a a a`. Feedback tells the learner to continue scanning and to skip the consumed symbol after a match.
- **Ordered encoder:** (1) reverse the learned list; (2) replace only the first matching occurrence for each merge. An order-sensitive case starts with the unavailable merge `[ab,c]` before `[a,b]`, so a correct single ordered replay stops at `ab · c`; a repeated-pair case requires `abab` to become `ab · ab`.

### Contract-version release blocker

The parent Playwright retest found that the newly rejected first-occurrence `mergePair` still appeared as “Verified previously on this device” after reload. Verification was bound to exact source text, but not to the host contract suite that had evaluated it. The stronger test changed the meaning of “passing” without invalidating the older device-local receipt.

Saved lesson verification now includes the contract suite version. Restoration requires both exact source equality and exact contract-version equality; an old or missing version restores the learner's code but clears its verified state. Passing a cell records the current suite version, editing still invalidates that cell immediately, and changing the suite from v2 to v3 invalidates every v2 verification. The version survives learner-state sanitization, legacy import, the progress repository, and validated lesson artifacts.

## Edits made

- Rewrote the summary around the representation boundary, mutable training state, delimiter-safe pair identity, ordered replay, and the model-system tradeoff.
- Replaced the invisible null-separated key with the inline expression `JSON.stringify([left, right])`. Keeping `countPairs` as the first and only function declaration in its cell preserves the existing practice-starter generator, while the source, concept legend, implementation intro, check, contract paths, and failure directions all show the same inspectable representation such as `["l","o"]`.
- Replaced the generic diagram with a worked two-round BPE trace on `low | low | lo`: counts, winner, corpus-wide merge, and recomputed counts are visible in sequence.
- Added a side-by-side order contrast showing `a · b · c → abc` in learned order and `a · b · c → ab · c` when the same merges are reversed.
- Kept the diagram flat and line-based so it uses the existing minimal design language instead of adding nested cards. Added a one-column mobile layout for the trace and order comparison.
- Preserved the deterministic merge-budget experiment and supplied corpus unchanged.
- Bound saved verification to `llm-systems-contracts-v3` as well as exact source so stronger host tests cannot inherit a stale pass.

## Remaining limitations

- The browser lab teaches character-level BPE without explicit word-boundary symbols or a separate word-frequency table. The lesson now states that boundary clearly.
- JSON keys are a readable teaching representation, not a claim about how production tokenizer libraries store pair ids internally.
- Compression statistics still measure this small corpus, not downstream translation or language-model quality.

## Verification evidence

- `npm run typecheck` — passed.
- `npm run lint -- --quiet` — passed.
- `npm run build:web` — passed.
- `node --test tests/curriculum-manifest.test.mjs tests/rendered-html.test.mjs` — 21/21 passed, including two rejected shortcut implementations and the accepted reference behavior for every Subword Tokenization cell, the `countPairs` practice-starter boundary, and the worked diagram content.
- `node --test tests/curriculum-manifest.test.mjs tests/persistence-layer.test.mjs tests/typed-exercise-contracts.test.mjs` — 19/19 passed, including stale contract-version invalidation, legacy version migration, progress-repository round-trip, and the v3 suite identity.
- `npm test` — all package suites, the production build, and all 76 application tests passed.
- `git diff --check` — passed.
- Parent Playwright post-fix retest — passed. The old v2 first-occurrence implementation remained visible but restored as unverified under v3. It then failed with the direction to continue scanning after the first match. Ambiguous concatenated pair keys failed with visible `JSON.stringify([left, right])` guidance. Corrected pair counting and merge implementations each passed 3/3 cases, and progress advanced only for the v3-verified sources.
- Parent visual review — passed at the desktop viewport. The two training rounds, recount step, learned-order path, and reversed-order path are readable in one flat mechanism without additional card nesting.
