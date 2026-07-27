# Agent contract

This repository has two extension layers.

## Portable content

You may edit:

- `content/learning-pack.json`
- `content/question-groups.json`
- presentation-only values in `platform.json`

These files are untrusted, declarative data. A Question Group may contain
bounded learner starter source and data-only assertions; it may not contain
publisher-defined executable tests or hooks. Do not add executable HTML, model
calls, remote imports, workers, or runtime module URLs. A URL or extension key
never grants a capability. Portable Python runtimes must remain
`host-managed`.

## Trusted platform source

You may edit `trusted/`, `site/`, and `tools/` only when the task explicitly
requires application behavior. These files are reviewed executable source.
Keep learner Python in the bounded Python Lab worker, keep checks host-owned,
and keep Pyodide assets same-origin. Ownership checks must run on Python
objects before JSON normalization: compare input values when the call returns,
and detect nested output aliasing against live input identities. Do not claim
that post-call equality detects a transient mutate-then-restore sequence. Do
not describe Python Lab or its browser worker as a hostile-code security
sandbox.

This example builds inside the Latent monorepo with its workspace dependencies
installed. Run `npm run validate` after every change. Run `npm run build`
before handoff. Never hand-edit `dist/`.
