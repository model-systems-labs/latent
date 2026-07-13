# Lesson 07 audit — Inference Runtime

## Naive-learner review

The summary had the right serving concepts, but the lifecycle graphic was only a phase inventory. More importantly, it called a 32-token output “32 serial decode iterations” after already showing the first token following prefill. That silently counted 33 generated tokens and made it hard to understand what the model actually executes.

The revised lesson now follows one concrete request, `r-104`:

- prompt: 96 tokens;
- output: 32 generated tokens;
- queue: 18 ms;
- prefill: 74 ms and 6 KV pages;
- first token: sampled from prefill logits at TTFT 92 ms;
- later output: 31 subsequent one-position decode forwards at 21.4 tokens/s;
- cache: 6 → 8 pages, followed by release;
- accounting: 127 positions processed by model forwards and 128 tokens in the final sequence.

TTFT, ITL, and decode tokens/second are defined separately. The memory section now states the complete per-request formula and explicitly uses KV heads rather than the ambiguous query-head count.

## Wrong-answer debugging

### Phase accounting

Checked two plausible mistakes:

1. treating every requested output token as a later decode forward;
2. using `maxNewTokens - 1` without clamping the zero-token case.

Host-owned checks now cover a 32-token output, one-token output, and zero-token output. Failure text points to the exact conceptual distinction: prefill logits sample token 1, the final sampled token is not another processed input, and subsequent decode forwards cannot be negative.

### KV-cache bytes

Checked three plausible mistakes:

1. omitting the factor of two for key plus value;
2. omitting the layer multiplier;
3. retaining the old `heads` field instead of `kvHeads`.

Six focused cases isolate key/value, layer, KV-head, cached-token/head-dimension, and bytes-per-value factors, plus the complete FP16 example. Feedback names each missing factor and makes the FP16/FP32 storage-width relationship explicit.

The browser retest exposed one presentation problem: omitting only the key/value factor made every numeric case fail, so the footer listed six directions and implied that all six factors were wrong. Learner-facing feedback is now staged. It shows the first failing case and first actionable assertion, then reports only a neutral count of additional failing cases or checks. The complete host-owned result array is preserved for verification; only its summary is narrowed. For the missing-factor implementation the learner now sees the key + value direction followed by “5 additional cases still fail; rerun after this fix,” with no misleading layer, head, token, or precision advice.

## UX and diagram changes

- Replaced the generic Queue → Prefill → Decode → Complete list with a worked `r-104` timeline.
- Added a compact request ledger for prompt, output, and final sequence length.
- Added a flat three-column latency glossary for TTFT, ITL, and tokens/s.
- Added the KV-cache formula and grouped-query-attention note directly under the timeline.
- Kept the existing minimal, border-led visual language and added a mobile layout that stacks equations instead of shrinking them.
- Updated the deterministic simulator trace and artifact so it agrees with the lesson and implementation exercise.

## Verification

- Focused curriculum and typed-contract tests: 16 passed.
- Staged-feedback regression confirms that all six KV cases remain failed internally while only the first direction is presented.
- Full application tests: 84 passed before the additional rendered-diagram assertion; the complete rendered HTML suite then passed 16/16 with the new lesson test.
- Workspace package tests: 18 passed.
- Typecheck: passed.
- Lint: passed. An initial lint run raced a concurrent package build deleting generated declarations; the immediate serial rerun passed.
- Production build: passed.
- Diff whitespace check: passed.

Parent Playwright retest passed. Treating all 32 generated tokens as subsequent decode forwards receives the 31-forward/prefill-sample direction. Omitting only the key/value factor now shows that single direction plus a neutral five-case count. Corrected cells pass 3/3 and 6/6 cases and reach `2/2 verified` under v7. The live trace displays token 1/32 from prefill, 31 forwards for tokens 2–32, TTFT 92 ms, 21.4 tok/s, pages 6 → 8, and release. The desktop diagram presents the same accounting and cache formula as one flat timeline; responsive composition is covered by the added CSS/render checks.
