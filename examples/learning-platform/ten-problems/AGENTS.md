# Agent contract

This example exposes one learner surface: Python programming practice.

## Portable content

You may edit `content/question-groups.json`.

This file is untrusted, declarative data. A Question Group may contain
bounded learner starter source and data-only assertions; it may not contain
publisher-defined executable tests or hooks. Do not add executable HTML, model
calls, remote imports, workers, or runtime module URLs. A URL or extension key
never grants a capability.

Python coding problems default to type-hinted starter signatures. Keep
annotations on every learner-facing parameter and return value, use
dependency-free built-in types where practical, and treat declarative
cases—not annotations—as the behavioral contract.

## Trusted build source

`site-config.mjs` is the explicit trusted input for product identity,
navigation labels, learner copy, theme tokens, footer, review route, and
favicon. `security-config.mjs` is the explicit trusted input for page and
Python-worker CSP: it provides the custom document meta policy and the full
static-host page/worker header policies at the standalone root and combined
`/practice/` subpath. `tools/build.mjs` passes the meta policy, UI input, and
reviewed Python adapter to the Course Kit static player, reuses the repository's
reviewed Python Lab worker, copies the npm-locked Pyodide core to same-origin
assets, renders `_headers`, and writes the result through a fresh marker-owned
directory. Do not patch generated HTML, JavaScript, or CSS to customize the
primary interface.

Treat `_headers` as defense in depth on hosts that support it. Anti-framing
depends on those response headers; the combined local preview mirrors the
Python-worker response CSP during QA. GitHub Pages does not honor `_headers`,
so the builder-injected document meta CSP must remain self-sufficient there for
script sources, same-origin workers/connections, styles, and other assets.

The shared learner presentation source of truth is
`packages/course-kit/src/learner-ui.ts`. Its standalone integrations are
`packages/course-kit/src/static-site.ts` and
`packages/course-kit/src/question-group-site.ts`. Put reusable design tokens,
shells, headers, navigation, controls, feedback, editor frames, progress,
accessibility, or responsive behavior in that shared trusted source. Keep only
the focused problem/copy/editor layout and Python-specific workflow specialized
in the Question Group builder and this example's trusted adapter.

Trusted source may interpret the portable assertion vocabulary; executable
checks must never move into JSON. Do not describe the browser worker as a
hostile-code security sandbox.

Run `npm run validate` after every change. Run `npm run build` before handoff.
From the repository root, run `npm run learning-examples:validate` when shared
learner UI or builder behavior changes. Never hand-edit `dist/`.
