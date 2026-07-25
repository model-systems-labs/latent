---
name: author-flash-card-deck
description: Create or improve a source-grounded flash-card deck in a Latent Learning Pack. Use when a user asks an agent for retrieval practice, spaced-review cards, a portable card deck, or reinforcement for an existing lesson or objective.
---

# Author Flash-Card Deck

Work in the **portable content layer** only.

## Author useful retrievals

Read `docs/open-learning.md`, `docs/learning-pack.schema.json`, and the target
Learning Pack. Select a narrow set of existing objectives or add observable
objectives that the accompanying lesson actually teaches.

For each card:

- ask one unambiguous retrieval;
- keep the answer concise;
- explain how the answer connects to the larger idea;
- reference the objective and exact supporting source;
- add tags only when they improve review or filtering.

Use at least six cards for a release deck unless the user accepts and records a
strict-validation warning. Mix concepts, comparisons, boundary conditions, and
application decisions. Avoid sentence fragments, trivia, and nearly duplicated
prompts.

## Respect the layer

Edit only `flashcardDecks` and directly required objective or source metadata in
`learning-pack.json`. Do not edit rating algorithms, storage, UI, runtimes, or
trusted source. Do not embed HTML, scripts, model calls, or executable tests.

## Validate

Run the pinned strict Course Kit validation documented in
`docs/open-learning.md`. In a generated tiny platform, also run:

```bash
npm run validate
npm run build
```

Preview card reveal, rating, keyboard focus, and saved progress. Report the
file, deck and card counts, objective coverage, strict result, and anything not
interactively verified.
