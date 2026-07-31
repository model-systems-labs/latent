---
name: review-learning-design
description: Independently review a Latent platform across courses, browser IDE exercises, flash-card decks, and Question Groups. Use when a user asks an agent to audit pedagogy, trace objective coverage, find duplication or gaps, assess practice quality, or decide whether a learning platform is ready to publish.
---

# Review Learning Design

Review before editing unless the user explicitly requests repairs. Treat
automated validity, learning quality, and runtime safety as separate findings.

## Trace the platform

Read the platform promise and all four primitive sources. For every objective,
record where it is:

- taught with an example and boundary;
- checked by a quiz, card, practice case, or IDE contract;
- reinforced after failure;
- supported by a source.

Identify orphan objectives, activities without instruction, duplicated
retrievals, abrupt difficulty jumps, and checks that can pass without the
intended skill.

## Review by layer

- **Portable content:** verify format, provenance, source grounding, licensing,
  objective references, and declarative-only boundaries.
- **Trusted platform source:** verify checks are deterministic and host-owned,
  browser execution is bounded, persistence binds exact source and contract,
  and remote metadata cannot grant capabilities.
- **Trusted interactives, when present:** verify source is repository-owned,
  the opaque frame requests only named capabilities, exact-version state
  restores before controls activate, reset is complete, and the host validates
  meaningful saved evidence before changing progress.
- **Experience:** verify navigation, feedback, accessibility, mobile layout,
  reload behavior, and the leech page as a progress query.

Run canonical strict validators and the platform's full validation gate. A
passing validator does not prove factual accuracy or good teaching.

## Verdict

Return `publish`, `revise`, or `reject`. For each finding provide severity,
exact path, observed evidence, smallest repair, editable layer, and
verification. Clearly separate browser interactions you exercised from those
you only inferred. Never describe a model-only review as certification or
expert approval.
