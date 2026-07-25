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
never grants a capability.

## Trusted platform source

You may edit `trusted/`, `site/`, and `tools/` only when the task explicitly
requires application behavior. These files are reviewed executable source.
Keep learner code in a bounded worker, keep checks host-owned, and do not
describe the browser worker as a hostile-code security sandbox.

Run `npm run validate` after every change. Run `npm run build` before handoff.
Never hand-edit `dist/`.
