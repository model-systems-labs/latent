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
  experience. Its typed build options accept trusted product identity,
  navigation labels, review directory, learner copy, theme tokens, footer,
  favicon, and an optional reviewed runtime adapter.
- `site-config.mjs` contains Ten Problems' explicit product configuration.
  `tools/build.mjs` passes it and the reviewed Python adapter to Course Kit
  before any files are generated. The old output string replacements and CSS
  append/prepend patches have been removed.
- `security-config.mjs` contains the reviewed custom document meta CSP and the
  full static-host page/Python-worker header policies for both the standalone
  root and combined `/practice/` subpath. `tools/build.mjs` passes the meta
  policy to the Question Group builder and emits `_headers` without weakening
  the builder's runtime boundary.

Ten Problems intentionally keeps its dense problem/copy/editor workspace,
Python terminology, visible example and check flows, and repeated-miss review.
Interview Loop keeps its course/module/card/IDE composition. Both consume the
same shell and interaction language without becoming the same application.

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

GitHub provides one Pages deployment per repository. The three learner
experiences are served from stable routes in that deployment. The root
`.github/workflows/deploy-interview-loop-pages.yml` validates and builds the
combined static artifact before GitHub Pages deployment. Local build and
browser evidence is recorded in `AUTHORING.md`; live deployment and
verification remain pending.

GitHub Pages does not honor generated `_headers` files. On Pages, the document
meta CSP still restricts script sources, workers and connections to
same-origin, plus styles and other assets. The `_headers` page and worker
policies add defense in depth when a static host supports them. Anti-framing
depends on those response headers; the combined local preview mirrors the
Python-worker response CSP during QA.
