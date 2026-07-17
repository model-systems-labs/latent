# Latent productization audit

This document turns the public-beta product goals into verifiable repository
contracts. A checked item requires both implementation evidence and learner-level
browser evidence; unit tests alone are not sufficient.

## 1. Continuous project learning loop

- Existing: every lesson owns a stable path in `llmSystemsManifest`, practice
  source is written into the browser project, and host-owned tests bind receipts
  to the exact source.
- Missing at audit start: a consistent end-of-lesson explanation of the file,
  concept, behavioral change, and next runnable milestone.
- Completion evidence: lesson outcome panels on all fourteen routes, module
  checkpoint links at module boundaries, and browser verification of one early,
  middle, and final lesson.

## 2. Module checkpoints

- Existing: module membership and outcomes are canonical in the curriculum.
- Missing at audit start: learner-facing checkpoint routes that execute the
  current module files and expose a concrete model/runtime/serving/product result.
- Completion evidence: four checkpoint routes, source-bound module verification,
  and a visible output for each module.

## 3. First fifteen minutes

- Existing: concise technical homepage and an executable first lesson.
- Missing at audit start: a runnable model before the learner commits to the
  course, environment readiness feedback, and a direct explanation of the first
  observable code-to-behavior change.
- Completion evidence: first-run model interaction on the homepage and a browser
  test from a clean profile.

## 4. Mobile IDE

- Existing: responsive stacking and touch-sized controls.
- Missing at audit start: task-focused Files, Code, Tests, and Output views;
  stacked panes still force excessive scrolling and context loss.
- Completion evidence: mobile tab model, focus preservation, 320 px and 390 px
  browser checks, and keyboard/touch manual checks.

## 5. Recovery and safety

- Existing: IndexedDB autosave, source-bound invalidation, reference restore,
  portable import/export, immutable file revisions, and passing-build retention.
- Missing at audit start: revision-history UI, explicit destructive confirmation,
  and user-visible persistence capability/failure guidance.
- Completion evidence: revision restore, per-cell reset, guarded reference reset,
  reload/import tests, and degraded-storage messaging.

## 6. Editorial, sources, and licenses

- Existing: curated sources, lesson-specific relevance notes, course-authored
  synthetic-fixture labels, and an in-product source-and-runtime index.
- Completed on 2026-07-17: all fourteen lessons were compared with their cited
  papers, standards, tutorials, and reference repositories. One overly similar
  trainer structure and one borrowed worked example were replaced.
- Completion evidence: `CONTENT_PROVENANCE.md`, the machine-readable lesson
  origin map, source and runtime notices, and regression tests for the remediated
  RNN and BPE patterns.

## 7. Naive-user sessions

- Existing: fourteen scripted learner audits performed with wrong-answer and
  recovery paths.
- Missing at audit start: observation of five to ten independent human learners.
- Completion evidence: anonymized session notes, recurring-friction synthesis,
  and resulting changes. Simulated agent sessions must be labeled separately and
  cannot satisfy this requirement.
- Study protocol: `docs/usability-study.md`. Human sessions are still required;
  the existence of the protocol is not completion evidence.

## 8. Privacy-preserving learning analytics

- Existing: device-local progress and test receipts.
- Missing at audit start: a bounded event vocabulary, no-code/no-prompt data
  policy, learner-visible readback, export, and deletion.
- Completion evidence: local event store, privacy panel, event-contract tests,
  and proof that no network request is used.

## 9. Learning outcomes

- Existing: implementation contracts prove behavioral correctness.
- Missing at audit start: prediction questions that distinguish passing code from
  conceptual understanding.
- Completion evidence: one technical prediction per lesson, durable result state,
  explanatory feedback, and module-level mastery readback.

## 10. Browser and device support

- Existing: WebGPU to WASM fallback, worker isolation, reduced-motion styling,
  responsive layouts, and IndexedDB capability detection.
- Missing at audit start: learner-facing readiness diagnostics and a recorded
  browser/device matrix for interrupted downloads, offline reload, storage
  failure, and low-memory behavior.
- Completion evidence: capability surface, automated fallback contracts, and
  real-device/manual matrix results.
- Evidence ledger: `docs/validation-matrix.md`; untested rows stay explicitly
  pending rather than inheriting a compatibility claim from Chromium emulation.

## 11. Performance

- Existing: model weights load only after learner action and inference runs in a
  worker.
- Missing at audit start: route-level payload budget, removal of global project
  reconciliation from reading-only routes, and measured production assets.
- Completion evidence: production build asset report, lazy model/IDE boundaries,
  and documented budgets.
- Enforced by `scripts/check-performance-budget.mjs` after every production
  build; the gate fails when the IDE, local model, workers, WASM, lesson runtime,
  or global stylesheet crosses its reviewed ceiling.

## 12. Portfolio export

- Existing: full persistence snapshots and content-addressed build artifacts.
- Missing at audit start: a human-readable, source-first project archive with a
  README, architecture, passing-test summary, and backend replacement guide.
- Completion evidence: downloadable archive, deterministic manifest tests, and
  successful extraction/readback. The final archive is gated on fourteen
  completed lessons, thirty-nine passing host-owned tests, and a promoted build;
  course functions are converted to explicit ES-module exports. A clean install
  and Vite production build of the completed standalone repository passed on
  2026-07-13. Unfinished work remains downloadable through the separate Backup
  path and is never labeled as a runnable portfolio.
