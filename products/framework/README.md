# Latent Framework

Latent is an open-source framework for building rigorous learning experiences
around real practice. It combines static publishing with browser-native
JavaScript, TypeScript, and Python runtimes so a lesson can move from an idea,
to code, to immediate feedback without requiring a proprietary learner
backend.

The framework is designed around four product principles:

- **Practice over passive familiarity.** Lessons can connect to focused coding
  problems, cumulative projects, retrieval practice, and flash cards.
- **Local-first learner runtime.** JavaScript and TypeScript run in reviewed
  browser workers; the full reference application runs CPython and NumPy
  through Pyodide and WebAssembly. Progress stays on the learner's device.
- **Portable publishing.** Course Kit builds declarative lessons, quizzes,
  cards, and programming-practice data into independently hosted artifacts.
- **Agent-ready, model-neutral authoring.** Checked-in skills and validation
  gates let people or coding agents change the source. No agent or model
  provider is required when a learner opens the result.

Read the repository's [founding principles](../../PRINCIPLES.md) for the
original motivation and the
[five-minute guide](../../docs/getting-started.md) for the smallest complete
platform.

## What this folder owns

- Explain what developers, educators, and communities can build with the
  framework.
- Direct publishers to the portable Open Learning authoring, validation, and
  self-hosting workflows.
- Direct trusted extensions through normal source review, build, and
  validation.
- Present framework identity independently from the learner course library.

`FrameworkLanding.tsx` is mounted by the application route at `/framework`.
`FrameworkHeader.tsx` and `metadata.ts` keep publisher navigation and social
identity out of learner surfaces. The Open Learning reader and publisher
remain under `app/open-learning/` because they are shared framework
capabilities, and public formats and tooling remain under
`packages/course-kit/`.

This folder owns only the Latent Framework deployment profile. Run
`npm run build:framework` from the repository root to select its homepage and
hosting metadata. It does not own the Latent Courses profile, and the
repository root has no implicit hosting target.

Reference courses remain in the repository as proof that the browser runtimes
and learning loop work together. They do not define the framework, and they do
not expand the portable-content trust boundary: remote packs still cannot
provide React, workers, executable tests, runtime adapters, or persistence
code.
