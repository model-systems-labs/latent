---
name: author-learning-platform
description: Create or customize a branded Latent platform containing a course lesson, flash-card deck, Question Group, and browser IDE exercise. Use when a user asks an agent to scaffold a learning site, start from the tiny platform example, change platform branding, or assemble all four Latent learning primitives.
---

# Author Learning Platform

Create a runnable platform without crossing Latent's content and execution
boundary.

## Establish scope

Identify the audience, learning promise, platform title, visual voice, and
initial topic. State reasonable assumptions instead of blocking on cosmetic
choices.

Read `docs/v0.2-launch-contract.md`, `docs/architecture.md`, and
`examples/learning-platform/javascript-array-methods/AGENTS.md`.

## Scaffold

From a Latent checkout, run:

```bash
node scripts/create-learning-platform.mjs <directory> \
  --title "<platform title>" \
  --tagline "<one-sentence promise>"
```

The generated project has no install step. Run `npm run preview` inside it to
validate, build, and serve the exact static artifact.

## Edit by layer

- **Portable content:** edit `content/learning-pack.json` and
  `content/question-groups.json`. Keep these files declarative. Question Groups
  may contain bounded learner starter source and data-only assertions, never
  publisher-defined executable tests or hooks.
- **Trusted platform source:** edit `trusted/ide-exercises.mjs`, `site/`, and
  `tools/`. Treat these as reviewed application code.
- **Brand data:** edit `platform.json`; it may select presentation, never grant
  runtime capabilities.

Default learner-facing coding signatures to typed parameters and return values.
Prefer native TypeScript or Python annotations; use JSDoc `@param` and
`@returns` when the objective is intentionally JavaScript-only. Types guide
the learner, while declarative cases and host-owned checks still define
behavior.

Do not move executable checks into portable JSON, add runtime model calls, or
load remote code. A hosted content URL is never execution authority.

Use `$author-course`, `$author-flash-card-deck`, `$author-question-group`, or
`$author-ide-exercise` for focused changes. In a full Latent reference
application fork, use `$author-interactive` when a lesson needs a purpose-made
simulator, worked trace, explorable diagram, or custom lesson UI. The generated
standalone static scaffold does not include the trusted-interactive frame seam.
That skill edits reviewed application source; it does not create a fifth
portable content primitive or add executable fields to a Learning Pack.

## Validate

Run:

```bash
npm run validate
npm run build
```

Also run the repository's canonical Course Kit validation before publishing
portable content. Inspect the lesson, card reveal, practice checks, IDE checks,
keyboard flow, mobile layout, and saved progress in `npm run preview`.

Report the project path, edited layers, four portable primitive counts, any
trusted-interactive definitions and capabilities, validation result, preview
URL, and anything not interactively verified.
