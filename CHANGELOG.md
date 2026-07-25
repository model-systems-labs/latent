# Changelog

All notable changes to Latent are documented in this file.

The project follows [Semantic Versioning](https://semver.org/) for published
packages. Learning Pack and feed schema versions are independent compatibility
contracts and are identified inside their documents.

## [Unreleased]

## [0.2.0] - 2026-07-25

### Added

- A five-minute platform generator with a lesson, flash-card deck, Question
  Group, browser IDE exercise, deterministic validation, local serving, and a
  static-host deployment workflow.
- The released `latent-question-group-library` v1 format for portable
  JavaScript, TypeScript, and Python function or class-method practice.
- Strict structural and semantic validation, canonical JSON, immutable JSON
  Schemas, progress contracts, leech queries, a static JavaScript/TypeScript
  player, and framework-neutral package subpaths for Question Group readers.
- A grouped programming-practice route using the shared editor, host-owned
  behavioral contracts, and source-bound device progress.
- An injected Browser IDE seam for host-supplied editors, JavaScript or
  TypeScript runtimes, files, checks, and persistence.
- Agent-neutral workflows for authoring, reviewing, and publishing platforms,
  courses, flash-card decks, Question Groups, and IDE exercises.
- A tiny non-LLM reference platform, clean-room conformance protocol,
  architecture graphic, social card, and screenshots of all four primitives.

### Changed

- Course Kit release packaging and smoke tests now include the question-group
  guide, schema, runtime exports, and type declarations.
- Public documentation pins the Course Kit v0.2.0 tarball and distinguishes
  portable declarative content from trusted repository extensions.

### Security

- The bundled Question Group worker denies browser network and persistent
  storage capabilities, lowers dynamic imports before evaluation, freezes
  grading intrinsics, and rejects hostile or non-plain result graphs.
- Browser IDE persistence uses source-bound identities, monotonic
  compare-and-save semantics, bounded receipts, and abort/disposal gates.

## [0.1.0] - 2026-07-24

### Added

- The `latent-learning-pack` and `latent-learning-feed` v1 declarative formats
  for lessons, quizzes, flash-card decks, sources, and objectives.
- Strict semantic validation, canonical JSON, deterministic static-site builds,
  local preview, and remote feed verification in Course Kit.
- Browser-local authoring, ZIP export, verified hosted-feed loading, immutable
  device saves, and digest-bound learner progress.
- Model-neutral author, review, and publish workflows for capable file-editing
  LLMs.
- Public contribution, security, conduct, licensing, and roadmap documentation,
  plus GitHub issue and pull-request templates.
- A complete self-hosted example covering lessons, quizzes, and flash cards.
- Four first-party executable browser courses, local learner persistence,
  Browser Lab, Model Lab, Artifact Runtime, and the project capstone.

### Security

- Community Learning Packs remain text-only declarative data and cannot invoke
  the privileged runtimes used by first-party lessons.
- Feed loading verifies origin, redirects, UTF-8, byte limits, canonical bytes,
  identity, version, and SHA-256 before rendering.

[Unreleased]: https://github.com/model-systems-labs/latent/compare/course-kit-v0.2.0...HEAD
[0.2.0]: https://github.com/model-systems-labs/latent/compare/course-kit-v0.1.0...course-kit-v0.2.0
[0.1.0]: https://github.com/model-systems-labs/latent/releases/tag/course-kit-v0.1.0
