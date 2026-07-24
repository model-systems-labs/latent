# Changelog

All notable changes to Latent are documented in this file.

The project follows [Semantic Versioning](https://semver.org/) for published
packages. Learning Pack and feed schema versions are independent compatibility
contracts and are identified inside their documents.

## [Unreleased]

### Added

- Public contribution, security, conduct, licensing, and roadmap documentation.
- GitHub issue and pull-request templates for community participation.

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
- A complete self-hosted example covering lessons, quizzes, and flash cards.
- Four first-party executable browser courses, local learner persistence,
  Browser Lab, Model Lab, Artifact Runtime, and the project capstone.

### Security

- Community Learning Packs remain text-only declarative data and cannot invoke
  the privileged runtimes used by first-party lessons.
- Feed loading verifies origin, redirects, UTF-8, byte limits, canonical bytes,
  identity, version, and SHA-256 before rendering.

[Unreleased]: https://github.com/model-systems-labs/latent/compare/course-kit-v0.1.0...HEAD
[0.1.0]: https://github.com/model-systems-labs/latent/releases/tag/course-kit-v0.1.0
