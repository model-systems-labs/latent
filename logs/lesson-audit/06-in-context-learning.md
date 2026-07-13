# Lesson 06 audit — In-Context Learning

## Naive learner review

The original summary correctly distinguished in-context learning from fine-tuning, but the mechanism diagram was an inventory rather than an experiment. A new learner could still miss *how* a frozen model changes behavior: demonstration tokens alter the causal prefix, hidden activations, and KV cache, while parameters remain unchanged.

The revised lesson makes the comparison explicit. Instruction, held-out queries, decoding, extraction, and exact-match scoring stay fixed; only zero, one, or four demonstrations change. The measurement table also states the inference boundary: two held-out items can show output sensitivity in this run, but cannot establish a general accuracy improvement or reproduce GPT-3's scaling result.

## Practice debugging review

### Demonstration formatter

- Rejects reversing supplied demonstrations.
- Rejects collapsing record separators to a single newline.
- Requires trimmed field edges while retaining an empty-input record.
- Feedback now identifies order, schema, blank-line separation, and record retention directly.

### Prompt builder

- Rejects a phantom blank demonstration in zero-shot prompts.
- Rejects prompts that omit the required instruction.
- Covers zero-, one-, and few-shot construction with the identical held-out query.
- Requires whitespace trimming and a terminal `Label:` continuation point.

### Exact-match scorer

- Rejects a scorer that searches for the expected answer and calls that its prediction.
- Extracts the first standalone allowed label before comparing with gold.
- Covers a wrong allowed label, both labels, a label embedded in a word, lowercase output, and no label.
- The experiment uses the same case-sensitive standalone-label semantics as the reference cell.

The host-owned suite is now `llm-systems-contracts-v6`, invalidating passes created under the weaker scorer cases.

## Experiment and runtime

The explicit `Load model · ~181 MB` consent step remains. The model library now sits behind a consent-gated client module with a static dependency edge, and Vite explicitly prebundles Transformers.js. This addresses the development failure where the first click requested an absent optimized dependency module. Production still code-splits the local model runtime.

Parent Playwright verification after restarting the development server confirmed:

1. `node_modules/.vite/deps/@huggingface_transformers.js` exists.
2. The consent click begins model progress instead of reporting a missing dynamic module.
3. The real 135M model reaches ready state and runs all six generations: three conditions times two identical held-out items.
4. Results showed weights updated `0`, predictions changed on `2/2` held-out items, and accuracy remained `1/2` in all three conditions. The raw pattern changed from `K/K` to `M/M` to `K/K`, a useful demonstration of prompt sensitivity without improvement.
5. The UI preserved the two-item inference caveat instead of presenting the run as a general few-shot gain.

## Validation

- TypeScript check passed.
- ESLint passed.
- Production web build passed.
- All 81 app tests passed before the final two focused render assertions were added.
- Focused curriculum and typed-contract tests passed (15/15).
- Focused rendered HTML tests passed (15/15).
- Final diff check is recorded in the parent handoff.
- Parent Playwright wrong-answer retest passed. Reversed demonstrations, a prompt without its instruction, and a scorer that selected predictions using `expected` all preserved their source and received specific schema/section/independent-extraction guidance. Corrected cells passed 2/2, 3/3, and 6/6 cases and reached `3/3 verified` only under v6.
- Parent visual review passed. The fixed inputs, 0/1/4-example branches, frozen-model boundary, measurement table, and can/cannot-infer statements read as one flat controlled experiment.
