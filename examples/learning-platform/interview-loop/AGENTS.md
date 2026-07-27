# Agent contract

This repository has two extension layers.

## Portable content

You may edit:

- `content/learning-pack.json`
- `content/question-groups.json`

These files are untrusted, declarative data. A Question Group may contain
bounded learner starter source and data-only assertions; it may not contain
publisher-defined executable tests or hooks. Do not add executable HTML, model
calls, remote imports, workers, or runtime module URLs. A URL or extension key
never grants a capability. Portable Python runtimes must remain
`host-managed`.

## Trusted learner UI and application source

`platform.json` is trusted build input for the product name, header navigation
labels and hash routes, theme, metadata, and footer. It does not extend either
portable format or grant runtime authority.

The shared learner presentation source of truth is
`packages/course-kit/src/learner-ui.ts`. Its standalone integrations are
`packages/course-kit/src/static-site.ts` and
`packages/course-kit/src/question-group-site.ts`. This example consumes the
generated `tools/vendor/learner-ui.mjs`, produced by
`scripts/generate-learning-platform-learner-ui.mjs`; never hand-edit that
generated file. Put a reusable design token, shell, header, navigation,
control, feedback, editor-frame, progress, accessibility, or responsive
behavior in the shared source instead of cloning it into this example.

`site/` remains responsible for Interview Loop's specialized course, quiz,
card, practice, and IDE layouts and state behavior. `trusted/` owns reviewed
IDE definitions and host-owned checks. `tools/` owns validation and the
deterministic marker-owned build. Edit these only when the task explicitly
requires application behavior. Keep learner Python in the bounded Python Lab
worker, keep checks host-owned, and keep Pyodide assets same-origin. Ownership
checks must run on Python objects before JSON normalization: compare input
values when the call returns, and detect nested output aliasing against live
input identities. Do not claim that post-call equality detects a transient
mutate-then-restore sequence. Do not describe Python Lab or its browser worker
as a hostile-code security sandbox.

Do not patch generated `dist/` output. Build-time branding and navigation
belong in `platform.json`; shared framework behavior belongs in Course Kit;
course-specific behavior belongs in reviewed `site/` source.

Run `npm run validate` after every change. Run `npm run build` before handoff.
From the repository root, run `npm run learner-ui:generate` after a shared UI
change and `npm run learner-ui:check` to prove the vendored build input is
current. Never hand-edit `dist/`.
