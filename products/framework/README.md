# Latent Framework product

This folder owns the product-level surface for developers and publishers using
Latent as an open-source learning-platform framework.

## Responsibilities

- Explain the distinction between the framework and the bundled reference
  courses.
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

Reference courses remain in the repository as reviewed examples and runtime
integration fixtures. They do not become part of the portable content trust
boundary: remote packs still cannot provide React, workers, executable tests,
runtime adapters, or persistence code.
