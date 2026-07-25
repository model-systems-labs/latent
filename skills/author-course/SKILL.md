---
name: author-course
description: Create or improve the lesson and quiz sequence in a Latent learning platform or portable Learning Pack. Use when a user asks an agent to design a course, add lessons, map objectives to instruction, or turn source material into an assessed learning sequence.
---

# Author Course

Work in the **portable content layer** only unless the user separately requests
a platform-code change.

## Design the graph

Read `docs/open-learning.md`, `docs/learning-pack.schema.json`, and the target
`learning-pack.json`. Define the learner, prerequisite knowledge, narrow
outcome, two to five observable objectives, and a primary-source map.

For every objective, add:

- instruction that builds a mental model;
- a concrete example and an important boundary;
- a quiz that can reveal a plausible misconception;
- exact source references.

Keep lesson order and prerequisite references acyclic. Prefer a short coherent
course over disconnected coverage.

## Respect the layer

Edit `learning-pack.json` or `content/learning-pack.json`. Do not edit the
runtime, site UI, trusted checks, persistence, or IDE code. Do not add
JavaScript, HTML, MDX, workers, model calls, or executable tests to portable
content. Display-only code blocks remain text.

Use `$author-learning-pack` when initializing a standalone package and
`$author-flash-card-deck` for a focused review deck.

## Validate

Run the pinned strict Course Kit command documented in
`docs/open-learning.md`. In the tiny platform, also run:

```bash
npm run validate
npm run build
```

Finish only when every objective is taught and assessed, strict validation has
no errors or warnings, and the generated lesson and quiz were inspected.
Report exact files, objective and lesson counts, source limitations, and
validation evidence.
