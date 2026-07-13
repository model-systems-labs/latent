# Lesson 02 audit — Neural Language Models

## Naive learner review

The original summary named the correct ideas, but assumed prior knowledge of n-grams, embeddings, logits, softmax, negative log-likelihood, and perplexity. It did not show one context moving numerically through the model, so the live experiment's strongest outputs—validation NLL, a 30-word probability distribution, and learned nearest neighbors—arrived without enough preparation.

The revised lesson now:

- contrasts an unseen exact n-gram context with learned continuous coordinates;
- defines vocabulary ids, embedding-table lookup, coordinate-wise context averaging, logits, stable softmax, and target NLL in execution order;
- works one toy context from ids through embeddings, mean pooling, logits, probabilities, and `−log p(target)`;
- explains why a 30-word uniform model begins near `ln(30) = 3.40` and how validation NLL maps to perplexity;
- frames nearest neighbors as learned predictive geometry rather than assigned word meaning;
- preserves the existing deterministic training experiment because it is the lesson's clearest payoff.

## Implementation and wrong-answer behavior

Browser evidence before the revision showed:

- a raw-`Math.exp` softmax failed with six repetitive finite/range assertions and no max-subtraction direction;
- returning only the first embedding row failed with a useful but terse coordinate-average hint;
- corrected tensor implementations passed.

Host-owned contracts now exercise additional behavioral cases and give explicit directions:

- stable softmax: large logits must remain finite, and equal logits must become a uniform distribution;
- context representation: every selected id, including repeated nonconsecutive ids, must be averaged along axis 0;
- negative log-likelihood: the target index must be used, the sign must be negative, and zero target probability must be clamped to `10^-12`.

The feedback formatter collapses repeated assertion labels within one case, so the overflow mistake produces one actionable instruction: subtract `max(logits)` before exponentiating, then normalize.

Automated contract tests reject two plausible shortcuts per cell and accept the reference behavior. Parent Playwright retesting also confirmed the live paths: raw exponentiation preserves the learner's source and receives the max-subtraction direction; returning only the first context row receives coordinate-wise averaging guidance; corrected implementations pass two cases each and advance progress only for their exact sources.

## UX and diagram

The four-row inventory was replaced with a responsive, data-driven probability path using the existing `DiagramSection` design-kit surface. It stays border-light and avoids nested cards while showing:

1. context ids;
2. embedding rows;
3. the averaged context vector;
4. vocabulary logits with named output order;
5. stable-softmax probabilities;
6. target negative log-likelihood.

Desktop uses a compact two-column generalization contrast and aligned numeric stages. Mobile stacks the contrast and left-aligns equations for readable scanning.

## Validation

- curriculum/contract tests: 9 passed;
- typecheck: passed;
- lint: passed;
- production web build: passed;
- rendered HTML tests: 10 passed;
- `git diff --check`: passed.
- parent Playwright wrong-answer, correction, training-experiment, and visual review: passed.
