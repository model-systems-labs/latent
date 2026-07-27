# Agent contract

This example deliberately exposes one learner surface: programming practice.

## Portable content

You may edit `content/question-groups.json`.

This file is untrusted, declarative data. A Question Group may contain
bounded learner starter source and data-only assertions; it may not contain
publisher-defined executable tests or hooks. Do not add executable HTML, model
calls, remote imports, workers, or runtime module URLs. A URL or extension key
never grants a capability.

## Trusted build source

`tools/build.mjs` invokes the reviewed Course Kit static player and applies
presentation-only learner-facing labels and colors. It must not weaken
validation, alter portable cases, or move executable tests into JSON. Do not
describe the browser worker as a hostile-code security sandbox.

Run `npm run validate` after every change. Run `npm run build` before handoff.
Never hand-edit `dist/`.
