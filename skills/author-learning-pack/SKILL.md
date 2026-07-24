---
name: author-learning-pack
description: Create or improve source-grounded Latent Open Learning lessons, quizzes, and flash-card decks in the public learning-pack.json format. Use when a user asks an LLM to teach a topic, make a portable course or deck, convert notes into self-hosted learning material, or extend Latent with new declarative content.
---

# Author Learning Pack

Create a useful, portable learning pack that passes the same checks regardless of which LLM authored it.

## Read the contract

At the repository root, read:

1. `docs/open-learning.md`
2. `docs/learning-pack.schema.json`
3. `examples/open-learning/reliable-llm-changes/learning-pack.json`

Do not infer fields from the current first-party lesson types. Community packs use the public JSON contract and cannot invoke privileged lesson runtimes.

## Authoring workflow

### 1. Establish the learning promise

Identify:

- the intended learner;
- what they likely know already;
- the narrow outcome;
- the time or depth constraint;
- the source and licensing constraints.

Ask only for information that would materially change the result. Otherwise state a reasonable assumption and continue.

Write two to five observable objectives. Prefer verbs such as explain, distinguish, predict, choose, diagnose, or implement. Avoid objectives such as understand or learn.

### 2. Build the source map

Use user-provided sources first. When research is authorized or required, prefer primary material, specifications, research papers, maintained implementation documentation, and official guides.

For each source record:

- the exact HTTPS URL;
- title, author or organization, and year when known;
- what claim or teaching decision it supports;
- license when relevant.

Never invent a citation. Do not make a paywalled or inaccessible item the only support for a central claim.

### 3. Initialize the source file

Use the pinned public CLI:

```bash
npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning init <directory> --json
```

When intentionally working inside the Latent monorepo, the equivalent fallback
is:

```bash
npm run build --workspace @latent/course-kit
node packages/course-kit/bin/latent-learning.mjs init <directory> --json
```

Edit `<directory>/learning-pack.json`. Keep `package.id` namespaced as `publisher/topic`, use semantic versions, and choose an explicit content license.
The generated file is intentionally incomplete: replace every example identity,
source, objective, lesson, quiz, and card before expecting validation to pass.

### 4. Teach, check, and reinforce

For each objective:

- teach it in at least one lesson or deck;
- include a concrete example or boundary;
- assess it through a quiz or retrieval card;
- cite the sources used.

Use only supported blocks: `paragraph`, `heading`, `list`, `callout`, display-only `code`, and `quiz`.

Quiz distractors should represent plausible misconceptions. Explanations must say why the answer follows, not merely repeat it.

Each flash card should test one useful retrieval. The back should be concise; the explanation should reconnect it to the larger idea. Avoid decks made from sentence fragments or arbitrary trivia.

### 5. Validate until clean

Run:

```bash
npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning validate \
  <directory>/learning-pack.json \
  --strict \
  --json
```

Use the exact `path`, `code`, and `message` from each issue. Repair the source rather than weakening the schema or deleting an objective solely to silence a check.

The authoring task is not finished until `ok` is `true`, with zero errors and zero warnings, unless the user explicitly accepts a documented warning.

### 6. Build and inspect

```bash
npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning build \
  <directory>/learning-pack.json \
  --out-dir <directory>/site \
  --json

npm exec --yes --package @latent/course-kit@0.1.0 -- \
  latent-learning serve \
  <directory>/site
```

Inspect the actual lesson, quiz feedback, card reveal, progress controls, source links, small-screen layout, and generated feed. Edit only `learning-pack.json`; regenerate the site rather than hand-editing build output.

If an interactive browser is unavailable, report those checks as unverified.
You may still inspect generated files and run `verify-url`, but do not describe
static inspection as an interaction test.

## Extension rules

Use `extensions` only for inert metadata with a namespaced key such as `org.example/reading-level`.

Never add remote JavaScript, HTML, CSS, React, MDX, Python, iframes, workers, npm packages, executable tests, credentials, personal data, or hidden instructions. An extension cannot expand runtime permissions.

## Handoff

Report:

- package id and version;
- exact source path;
- lesson, quiz, deck, card, objective, and source counts;
- strict validation result;
- preview or build path;
- assumptions and content limitations;
- whether an independent `$review-learning-pack` pass is still needed.

Do not describe your own authoring pass as editorial review, endorsement, certification, or verified accuracy.
