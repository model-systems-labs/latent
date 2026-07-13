# Lesson audit 01 — Character RNNs

## Naive-reader findings

- The original summary was technically accurate but introduced one-hot vectors, hidden state, logits, softmax, cross-entropy, BPTT, truncated BPTT, and gradient clipping without walking through a single sequence position. A new learner could repeat the vocabulary without knowing what values flow through the model.
- The original “diagram” was a four-row inventory. It did not show time moving left to right, the hidden state crossing positions, the prediction at each position, parameter sharing, or the generation feedback loop.
- “Temporal credit” did not explain what is unrolled, what truncation removes, or why repeated use of the recurrent matrix can amplify a gradient.
- The implementation transition did not explicitly tell the learner that omitting `previous` is a semantic failure. More importantly, the only test used an all-zero previous state, so an implementation that ignored recurrence could pass.
- The source finding and reproduction boundary were accurate. The lesson correctly distinguishes the small vanilla RNN lab from Karpathy's larger LSTM experiments.

## Wrong answers and feedback behavior

### Playwright observation before the fix

The parent Playwright session selected **Practice all**, replaced `rnnStep` with a plausible implementation that ignored `previous`, and selected **Run cell**. The UI changed to “Running…” and then back to “Not run” without an explanation. Hydration subsequently replaced the typed answer with an older saved implementation ending `// learner edit saved to project`. At the same time, the toolbar displayed `3/3 verified`, the active cell displayed `Not run`, and the lesson footer displayed `1/3 checks`.

This was both a missing recurrence assertion and a destructive hydration race.

### Post-fix behavioral coverage

Automated contract checks now exercise two plausible semantic mistakes and the reference behavior for every cell:

- **Recurrent transition:** (1) ignore `previous`; (2) combine both projections but omit `tanh`. The first now fails the new non-empty-state case with the direction “Use Whh and the previous state before tanh”; the second fails the expected activation ranges. The reference passes both the empty-state and non-empty-state cases.
- **Cross-entropy:** (1) return `probabilities[targetIndex]`; (2) return `log(probabilities[targetIndex])` without the negative sign. Failures direct the learner to apply `-log` to the target probability and to use `targetIndex`, rather than exposing implementation source. The reference passes both probability cases.
- **Gradient clipping:** (1) cap only the positive tail; (2) cap only the negative tail. Both fail with “Clamp both negative and positive gradients to the symmetric limit.” The reference preserves in-range values and passes.

The shared formatter now includes the failing case, the behavioral direction, and the host assertion detail. A failed cell retains the learner's source and explicitly says that other cells were not changed.

## Edits made

- Rewrote the summary as a five-step path: represent a character, update memory, predict and score, assign credit through time, and generate autoregressively.
- Added concrete values for cross-entropy (`p = 0.8` versus `p = 0.1`) and clarified each symbol in the recurrent equation.
- Replaced the row inventory with a three-position unrolled diagram showing input, prior state, new state, logits/softmax, hidden-state flow, generation feedback, and shared parameters.
- Expanded implementation guidance and variable descriptions without changing the reference solution.
- Added a non-empty recurrent-state contract, more directional labels for all three lesson contracts, and a new shared learner-facing feedback formatter.
- Gated all practice actions, cell buttons, textareas, and lesson-level checks until device-local progress is restored. The editor now exposes a visible restoring state instead of accepting edits that hydration can overwrite.
- Previously verified cells now read “Verified previously on this device” instead of the contradictory “Not run.”
- A follow-up Playwright retest exposed a second race: running immediately after an edit could test an older render closure and a later restore could replace the textarea. The editor now resolves lessons to a stable definition, hydrates only once, mirrors every edit into synchronous source refs, snapshots the exact source passed to the worker, and discards a result if that source changes while the worker runs.
- Verification is now bound to the exact source text that passed. Editing invalidates the binding in the same event before persistence is scheduled; legacy or mismatched verification ids are removed during restoration rather than attached to different code.
- The final hydration race came from unlocking after project restoration while learner progress was still loading independently. Practice readiness now awaits both persistence layers; a delayed learner read can no longer replace text entered after the editor unlocks.
- Added desktop and mobile layout rules for the unrolled diagram.

## Remaining limitations

- The lab remains a tiny vanilla RNN and does not teach LSTM gates; the fidelity record states this boundary.
- Contract feedback reports the violated behavior and expected range, but deliberately does not reveal the reference source or the learner's exact returned vector.
- The first development-server run of the isolated compiler can trigger Vite dependency optimization and a page reload. This is a development-only warm-up behavior; after optimization, browser runs complete normally and preserve learner source.

## Verification evidence

- `npm run typecheck` — passed.
- `npm run lint -- --quiet` — passed after package builds completed.
- `node --test tests/curriculum-manifest.test.mjs tests/persistence-layer.test.mjs` — 13/13 passed, including two wrong semantic implementations per Character RNN cell, exact-source verification restoration/invalidation, and persistence compatibility.
- `npm run build:web` — passed.
- `node --test tests/rendered-html.test.mjs` — 9/9 passed, including the unrolled mechanism and pre-hydration practice gate.
- `git diff --check` — passed.
- Parent Playwright re-test on a clean server — passed. A recurrent transition that ignored `previous` remained visible, cleared prior verification, and failed with the `Whh`/previous-state direction. The corrected tensor implementation passed 2/2 cases. A cross-entropy implementation that returned the target probability failed with `-log` guidance; the corrected `nllLoss` implementation passed 2/2 cases. Progress advanced only for the exact passing sources (`0/3` → `1/3` → `2/3`).
- Parent visual review — passed at the desktop viewport. The summary reads as one continuous technical lesson, and the recurrence diagram clearly shows three positions, state flow, shared parameters, and the generation loop without introducing a new nested-card style.
