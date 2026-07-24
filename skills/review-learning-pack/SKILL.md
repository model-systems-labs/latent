---
name: review-learning-pack
description: Independently review a Latent learning-pack.json for factual support, pedagogy, assessment quality, licensing, accessibility, safety, deterministic output, and publishing readiness. Use when a user asks to audit, QA, approve, critique, or repair a portable lesson or flash-card pack.
---

# Review Learning Pack

Review the exact immutable version proposed for release. Schema validity and editorial quality are separate findings.

## Read the review contract

At the repository root, read:

1. `docs/open-learning.md`
2. `docs/learning-pack-quality-rubric.md`
3. `docs/learning-pack.schema.json`

Do not rely on the authoring agent's summary. Read the package and its cited sources directly.

## Review workflow

### 1. Run the automated gate

```bash
npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning validate \
  <path>/learning-pack.json \
  --strict \
  --json
```

When intentionally reviewing from the Latent monorepo, build the workspace and
use `node packages/course-kit/bin/latent-learning.mjs` as the equivalent local
fallback.

Record the complete structured result. Schema errors and strict warnings block publication, but a clean result does not prove accuracy or teaching quality.

### 2. Trace the learning graph

For each objective, identify:

- where it is taught;
- which example or boundary makes it concrete;
- where it is assessed;
- which sources support it.

Flag objectives that are vague, circular, overbroad, assessed only through recall, or disconnected from the stated learner.

### 3. Verify content and sources

Open every central source when network access is available. Check that:

- the URL resolves to the claimed material;
- the source actually supports the nearby claim;
- the package preserves important qualifications;
- dates, names, code behavior, and terminology are accurate;
- licensing and attribution are compatible with any copied or adapted material.

Clearly label anything that could not be verified. Do not replace verification with familiarity or model memory.

### 4. Review teaching and assessment

Apply `docs/learning-pack-quality-rubric.md`.

Pay special attention to:

- whether explanations build a mental model rather than compress source prose;
- whether examples match the learner's likely context;
- whether wrong quiz choices reveal useful misconceptions;
- whether quiz explanations diagnose the mistake;
- whether cards test durable retrieval rather than isolated wording;
- whether boundaries and failure cases prevent overgeneralization;
- whether the language is direct and accessible.

### 5. Check safety and rendering

Confirm the package is declarative and contains no executable or privacy-sensitive material. Authored code blocks are displayed examples only.

Review any high-stakes domain claim under an appropriately strict expert standard. A general LLM review must not become medical, legal, financial, or safety certification.

### 6. Prove reproducibility

Build twice into separate empty temporary directories:

```bash
npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning build \
  <path>/learning-pack.json \
  --out-dir <first-directory> \
  --json

npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning build \
  <path>/learning-pack.json \
  --out-dir <second-directory> \
  --json

diff -r <first-directory> <second-directory>
```

If reviewing a deployment, run:

```bash
npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning verify-url \
  <https-feed-url> \
  --json
```

Inspect the standalone lesson, quiz, deck, progress, source links, and nested-path behavior.
If no interactive browser is available, record rendered behavior as unverified
and make that limitation explicit in the verdict. Static source inspection is
useful evidence but is not a substitute for exercising interactions.

## Verdict

Return exactly one:

- `publish`: no release blocker remains;
- `revise`: concrete repairs are required;
- `reject`: the source, rights, or safety problem cannot be repaired within this package.

For every finding include:

```text
severity: blocker | important | suggestion
path: exact CLI dot path, such as flashcardDecks.0.cards.1.back
evidence: observed problem
fix: smallest concrete repair
verification: proof that the repair worked
```

If the user asked only for review, do not edit files. If asked to repair, update only the authored source, regenerate derived output, and rerun the entire gate.

Never call a package Latent-reviewed, endorsed, certified, or identity-verified unless a separate authorized attestation for that exact digest exists.
