# Ten Problems

Ten Problems is a focused coding-practice product containing one portable
Question Group library with 10 original Python problems and 39 public,
data-only cases.

## Problem path

1. First Echo — set lookup
2. Tunnel Gates — stack matching
3. Quietest Window — fixed sliding window
4. Longest Unique Span — variable sliding window
5. Reverse a Linked Chain — nested `{"value": ..., "next": ...}` dictionaries
6. Condense Calendar Windows — sorting and interval merging
7. Disease Spread Clock — multi-source grid breadth-first search
8. Fewest Relay Hops — graph breadth-first search
9. Minimum Climb Energy — dynamic programming
10. Workday Capacity — binary search with greedy feasibility

Every prompt, title, and synthetic case was written for this repository. The
set uses generic algorithms and data structures without copying proprietary
question wording, examples, or hidden tests.

Every Python starter signature type-hints its parameters and return value. The
Question Group library is version 2.1.0, so changed starter source receives a
new immutable content identity and progress namespace.

## Shared learner UI

The two learning examples previously diverged because Interview Loop owned a
bespoke page shell, while this site used the standalone Question Group player
and altered generated HTML, JavaScript, and CSS to establish its product
labels and primary presentation. That made navigation, controls, feedback,
progress, focus, and mobile behavior implementation details of two unrelated
example builds.

The current ownership is explicit:

- `packages/course-kit/src/learner-ui.ts` is the reviewed source of truth for
  typography and color tokens, spacing, borders, focus states, responsive
  breakpoints, the global shell, header, primary navigation, content widths,
  buttons, forms, cards, progress, status/results, empty states, editor
  framing, screen-reader utilities, and mobile navigation behavior.
- `packages/course-kit/src/static-site.ts` composes that foundation with the
  standalone lesson/card player.
- `packages/course-kit/src/question-group-site.ts` composes it with this
  problem-list, prompt, editor, results, progress, resume, and repeated-miss
  experience. Its typed build options accept a compatibility-preserving
  `suiteHeader`, trusted product identity, local navigation labels, review
  directory, learner copy, appearance, footer, favicon, an optional reviewed
  runtime adapter, and separate reviewed reference-solution input.
- `trusted/reference-solutions.mjs` owns the ten reference implementations.
  The builder renders them as inert text in the player JavaScript and never
  adds them to portable Question Group JSON.
- `../learning-suite.mjs` provides the one persistent Learning Studio identity
  and ordered sibling destinations. `site-config.mjs` opts into that contract
  and contains Ten Problems' explicit local product configuration.
  `tools/build.mjs` passes it and the reviewed Python adapter to Course Kit
  before any files are generated. The old output string replacements and CSS
  append/prepend patches have been removed.
- `security-config.mjs` contains the reviewed custom document meta CSP and the
  full static-host page/Python-worker header policies for both the standalone
  root and combined `/practice/` subpath. `tools/build.mjs` passes the meta
  policy to the Question Group builder and emits `_headers` without weakening
  the builder's runtime boundary.
- `packages/course-kit/src/learner-code-editor.ts` owns the shared CodeMirror
  language, highlighting, theme, keyboard, and accessibility extensions.
  `packages/course-kit/src/browser/learner-code-editor-runtime.ts` packages
  that reviewed source as the same-origin static-player asset; Ten Problems
  supplies only the Python language and four-space indentation configuration.

Ten Problems keeps Python terminology, public example and full-check flows,
and repeated-miss review, but the problem list, prompt, editor, actions, and
results now form one centered vertical document rather than three independent
full-height panes. Interview Loop keeps its course/module/card/IDE composition.
Both consume the same shell and interaction language without becoming the same
application.

All five palettes use the same sparse partial-line atmosphere and scroll
crossfade; palette selection changes semantic color and line tint, not
geometry. Sage, Cobalt, Plum, and Graphite add one short glint to the existing
line, so the sparkle inherits that crossfade without a particle field or
second animation. A native **View example solution** disclosure is closed by
default, keyboard-operable, and does not replace the draft, run code, or write
progress.

This presentation work did not change Learning Pack or Question Group formats.
Portable JSON remains declarative. Runtime admission, Python execution,
timeouts, output limits, checks, state logic, and UI behavior remain trusted
repository source.

## Run this site alone

From this directory:

```bash
npm run validate
npm run preview
```

The preview listens on `http://127.0.0.1:4174/`. The build uses Course Kit's
reviewed static Question Group player and shared learner UI foundation.
`site-config.mjs` supplies Ten Problems' product name, Practice and Review
labels, copy, theme, footer, route, and favicon before the player is generated.
`security-config.mjs` supplies the custom meta CSP passed to the builder and
the full static-host page/worker header rules. The trusted build injects the
example-local Python adapter directly and omits the unused browser JavaScript
compiler. It does not patch generated HTML, JavaScript, or CSS.

The first run loads the pinned interpreter from this site's own static assets;
later runs use the browser cache.

Each submission gets a fresh, bounded Python browser worker. Cases are
declarative and public, while the executable adapter and checks remain trusted
source. Python Lab has capability guardrails but is not a hostile-code security
sandbox. The site saves exact-library progress in IndexedDB and offers a
**Review** view after repeated unsuccessful checks.

## Run the complete learner suite

From the repository root:

```bash
npm run learning-examples:preview
```

This assembles the same route layout used by GitHub Pages:

- `/` — the content-first Learning Studio index
- `/llm-systems/` — the original 14-lesson Build an LLM System course
- `/interview-loop/` — Interview Loop Lab
- `/practice/` — Ten Problems
- `/practice/leeches/` — repeated-miss review

`../learning-suite.mjs` is the trusted build-time directory for these three
independent artifacts. Learning Studio is not an account, enrollment list, or
aggregate progress dashboard; each experience keeps separate exact-content-
bound progress on the device.

GitHub provides one Pages deployment per repository. The three learner
experiences are served from stable routes in that deployment. The root
`.github/workflows/deploy-interview-loop-pages.yml` validates and builds the
combined static artifact before GitHub Pages deployment. Local and live
browser evidence for merge commit
`778994638801b2599c9691c98d0d7183b5a97463` is recorded in `AUTHORING.md`.

GitHub Pages does not honor generated `_headers` files. On Pages, the document
meta CSP still restricts script sources, workers and connections to
same-origin, plus styles and other assets. CodeMirror's generated theme rules
are admitted by one exact reviewed nonce, without `unsafe-inline`. The
`_headers` page and worker
policies add defense in depth when a static host supports them. Anti-framing
depends on those response headers; the combined local preview mirrors the
Python-worker response CSP during QA.
