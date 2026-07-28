# Authoring record

## Request

> that doesn't seem to really be that useful - it seems more like half showing off the platforms feature. Make three Yeah It doesn't really seem that useful. It seems more like half an advertisement for a platform, but also an example of how it could work. A better example would not really be showing off the platform features at all. The platform should fade into the background of this, and it should more just be like, this is the, like a useful artifact that comes from the platform. So let's actually do this, and let's do another example of just kind of like a LeetCode alternative site. So just have like 10 basic practice problems. Stay clear of copyright things by doing things like linked lists or disease spread in a grid, and make it like a really great example of how this works. So have this example, have this other one hosted in GitHub Pages. And yeah, I think that kind of makes sense for this. Yeah, please do that, and let's get two different GitHub Pages working locally.

## Decisions

- Use only the portable Question Group primitive. Do not include a lesson,
  cards, an IDE showcase, feature navigation, or promotional platform copy.
- Build a progressive set of ten original JavaScript problems with 39 public,
  declarative cases. The path covers sets, stacks, sliding windows, nested
  linked nodes, intervals, grid and graph BFS, dynamic programming, and binary
  search.
- Represent a linked list directly as finite JSON `{ value, next }` data so the
  public portable contract needs no hidden adapter.
- Treat every `check` case as public. This is practice feedback, not a claim of
  secret certification.
- Use Course Kit's reviewed standalone Question Group player for execution,
  integrity-bound loading, atomic device progress, and repeated-miss review.
  Apply only example-local learner-facing labels and presentation changes at
  build time.
- Repair the trusted standalone-player adapter after browser QA showed that
  function entrypoints were receiving the reserved constructor-argument array
  instead of the authored case arguments. Cover the adapter shape with a
  Course Kit regression test; keep the portable library unchanged.
- Keep Interview Loop Lab at the existing Pages root, add a stable
  `/interview-loop/` alias, and publish Ten Problems at `/practice/`.
- Preserve the published schema directories and update both workflows capable
  of replacing the repository's single Pages artifact.

## Counts

- Question Groups: 4
- Problems: 10
- Public cases: 39
- Visible example cases: 10
- Additional check cases: 29
- Learning objectives: 5
- External runtime dependencies at learner time: 0

## Validation evidence

- Strict Question Group validation: 4 groups, 10 problems, 39 cases, zero
  errors, and zero warnings.
- Reference solutions: all 10 implementations pass every authored case.
- Course Kit standalone-player regression suite: 10 of 10 tests pass.
- Combined Pages build: 80 files with `/`, `/interview-loop/`, `/practice/`,
  and `/practice/leeches/`.
- Browser QA: the starter fails visibly; correct set and multi-source BFS
  solutions pass; two solved statuses survive reload; repeated-miss review
  renders; both Interview Loop routes render; and the 390 × 844 layout stacks
  all three practice panels with no horizontal overflow.

## Python revision request

> shouldn't tne problems be able to use python code that should be how it happens

## Python revision decisions

- Convert every learner-facing contract from JavaScript to idiomatic Python:
  `.py` paths, `snake_case` entrypoints, Python starter source, and Python terms
  such as `None`, lists, and dictionaries.
- Advance the immutable portable library from `1.0.0` to `2.0.0` because the
  execution contract changed while leaving all 39 public case vectors intact.
- Declare one exact `python` / `host-managed` / `pyodide@314.0.2` requirement.
  Portable JSON still cannot load an interpreter or executable tests.
- Add a reviewed example-local host adapter that reuses Latent's Python Lab
  worker and host-owned assertion evaluator. Each submission starts a fresh
  worker, initialization is separate from the declared 10-second learner-code
  limit, and timeout disposal is a hard stop.
- Self-host the five npm-locked Pyodide core payloads in the generated site.
  The learner's browser makes no third-party runtime request.
- Keep Interview Loop Lab at `/` and `/interview-loop/`, and keep Ten Problems
  at `/practice/`; this revision changes the practice language, not the route
  contract.

## Python revision counts

- Learner problems: 10 before, 10 after
- JavaScript learner contracts: 10 before, 0 after
- Python learner contracts: 0 before, 10 after
- Public cases: 39 before, 39 after
- Visible example cases: 10 before, 10 after
- Additional check cases: 29 before, 29 after
- Self-hosted interpreter core files: 0 before, 5 after
- Third-party runtime fetches while solving: 0 after

## Python revision evidence

- Strict Question Group validation: 4 groups, 10 questions, 39 cases, 10
  examples, 29 additional checks, zero errors, and zero warnings.
- Real Pyodide reference solutions: all 10 Python implementations pass all 39
  authored cases under the pinned runtime.
- Trusted runtime adapter tests: exact-profile support, example/check mapping,
  adapted-argument transport, failed assertions, and fail-closed incomplete
  results pass. A focused build-output test also proves the configured UI,
  unchanged canonical library, injected runtime, and omitted browser compiler;
  6 example tests pass in total.
- Example validation and build: `2.0.0` canonical library digest
  `cbf3e5b4c6ea04d734b30c2abc1526d59d83a8a6b5a08ba21d8691064bdad834`;
  21 generated files; no runtime warnings; five hashed same-origin Pyodide core
  payloads totaling 13,544,397 source bytes; and no bundled JavaScript runtime
  claim. The generated report records source and published hashes for the two
  module copies that receive an inert lint directive.
- Combined Pages build: 85 files with `/`, `/interview-loop/`, `/practice/`,
  and `/practice/leeches/`.
- Browser QA: the Python starter fails on its returned value; a syntax error
  reports the Python line; correct set and multi-source BFS implementations
  pass; a non-terminating function hard-stops at 10 seconds and the next worker
  passes; solved state survives reload; old-digest state does not restore;
  repeated misses appear at `/practice/leeches/`; the Interview Loop route
  still renders; and the 390 × 844 layout stacks all three panels at 390 pixels
  with no horizontal overflow. The browser console recorded no warnings or
  errors.

## Shared learner UI revision

### Why the examples diverged

Interview Loop grew from a bespoke application shell, while Ten Problems used
Course Kit's standalone Question Group player and then changed generated
HTML/JavaScript strings and generated CSS to establish the primary product
interface. Those paths duplicated navigation, typography, controls, feedback,
progress, accessibility, and responsive decisions. Similar colors alone would
not have fixed that ownership gap.

This revision moves common learner presentation into reviewed Course Kit source
and makes product differences explicit trusted build input. Ten Problems stays
a focused Python practice workspace; it is not reshaped into a course.

### Architectural decisions

- `packages/course-kit/src/learner-ui.ts` is the source of truth for design
  tokens, responsive breakpoints, the global shell and widths, header and
  primary navigation, buttons, forms, cards, progress/resume, status and result
  panels, empty states, editor framing, focus treatment, screen-reader helpers,
  reduced-motion handling, and local mobile-menu behavior.
- `packages/course-kit/src/static-site.ts` composes the same foundation with
  standalone Learning Pack lesson/card sites.
- `packages/course-kit/src/question-group-site.ts` composes it with the
  specialized problem-list, prompt, editor, run/check, progress, continue, and
  repeated-miss layout. Its reviewed build API accepts product identity,
  navigation labels, review directory, learner copy, theme tokens, footer,
  favicon, and an optional trusted runtime adapter.
- `site-config.mjs` is the sole Ten Problems product-configuration input. It
  declares **Practice**, **Review**, **Run examples**, **Check solution**, and
  **Continue** copy, the `leeches` review directory, the blue accent variant,
  quiet footer attribution, and the favicon.
- `security-config.mjs` is the sole Ten Problems security configuration. It
  provides the custom document meta CSP passed into the Question Group builder
  and renders the full static-host page/Python-worker header policies for the
  standalone root and combined `/practice/` subpath without changing portable
  content.
- `tools/build.mjs` passes that object and the reviewed Python adapter to
  `buildStandaloneQuestionGroupSite` before files are rendered. The old
  post-build HTML/JavaScript replacements and generated-CSS patches are
  removed. `bundledBrowserRuntime: false` omits the browser compiler and sandbox
  assets through the builder instead of deleting exact generated script tags,
  and `runtimeAdapterJavaScript` injects the reviewed Python adapter directly.
  The same-origin Pyodide URL is supplied while bundling the worker rather than
  rewritten in compiled output. Generated files are then assembled with the
  self-hosted Python payloads, headers, reports, and marker-owned directory.
- Interview Loop consumes the canonical foundation through the generated
  `examples/learning-platform/interview-loop/tools/vendor/learner-ui.mjs`.
  `scripts/generate-learning-platform-learner-ui.mjs` creates that file from
  Course Kit and the repository checks it for drift.
- `scripts/build-learning-example-pages.mjs` atomically assembles the
  content-first Learning Studio index, the original Build an LLM System course
  at `/llm-systems/`, Interview Loop at `/interview-loop/`, and Ten Problems
  at `/practice/`. `scripts/generate-learning-platform-learner-ui.mjs`
  derives the React course's self-hosted learner CSS and behavior from Course
  Kit, `app/layout.tsx` links those assets, and
  `app/components/LearnerHeader.tsx` adapts the shared markup contract.
- No portable Learning Pack, Learning Feed, or Question Group contract changed.
  Question cases remain public declarative data. Runtime admission, executable
  checks, Python execution, timeouts, output limits, state logic, and UI
  behavior remain trusted source.
- Progress remains bound to the exact Question Group library digest and
  question contract identity/version. Portable Question Group v1 progress
  stores no submitted-source digest. Repeated-miss review remains a progress
  query.
  Pyodide remains version-pinned and same-origin, and the build adds no hosted
  stylesheet, framework CDN, JavaScript service, model API, or remote
  executable plugin. Existing CSP, subpath-safe relative assets, marker-owned
  output, and combined GitHub Pages routes remain in force.
- The builder embeds the custom document meta CSP. `_headers` supplies fuller
  page/worker response policies, including anti-framing and a worker-context
  CSP, as defense in depth on supporting static hosts. Anti-framing depends on
  those response headers; the combined local preview mirrors the Python-worker
  response CSP during QA. GitHub Pages does not honor `_headers`, but the
  document meta CSP remains active there and restricts script sources,
  same-origin workers/connections, styles, and other assets.

### What remains intentionally specialized

Ten Problems retains its problem list, prompt and contract column, editor,
public examples, full visible checks, progress statuses, continue flow, and
repeated-miss review. The example-local Python adapter still maps validated
Question Groups into the repository's reviewed Python worker and host-owned
assertion evaluator.

Interview Loop retains its module rail, long-form lessons, quizzes,
flash-card review, portable Python practice, and trusted Python IDE. The
shared foundation unifies their shell and interaction language, not their
information architecture or runtime.

### Concise visual comparison

| Concern | Before | After |
| --- | --- | --- |
| Shell and navigation | Ten's generated player and Interview's bespoke shell used different header and mobile patterns. | Both use the shared header, primary navigation, page widths, footer, current-page state, and mobile menu. |
| Product copy | Framework concepts were renamed after generation. | `site-config.mjs` supplies Practice, Review, Continue, Run examples, and Check solution before generation. |
| Controls and feedback | Buttons, progress, statuses, results, and empty states evolved separately. | Shared component contracts provide consistent shape, spacing, focus, and success/failure language. |
| Coding surfaces | Ten's three-panel Python workspace had no family resemblance to Interview's IDE. | Both use the shared editor frame, toolbar, actions, and result treatment while preserving different workspace layouts and runtimes. |
| Color and identity | CSS patches carried most Ten Problems branding. | A small validated theme-token override distinguishes Ten Problems within the common system; attribution stays secondary in the footer. |
| Mobile and accessibility | Each build owned its own responsive and focus fixes. | Shared breakpoints, skip links, visible focus, live status regions, screen-reader helpers, and reduced-motion rules establish the baseline. |

### Validation and browser evidence for this revision

The JavaScript and Python revision results above remain historical evidence for
those versions. They are not evidence for the shared learner UI revision.
The following evidence belongs to the shared learner UI revision.

- Course Kit built-package tests passed 55 of 55, including learner UI and
  configured standalone-builder coverage.
- Course Kit's smoke-package check passed an isolated tarball installation and
  CLI smoke test.
- Ten Problems strict Question Group validation passed with 4 groups,
  10 questions, 39 cases, and zero warnings. Its six tests passed, including
  real CPython reference execution across all 39 cases and configured build
  output. The production artifact contains 21 files, reports learner UI
  version 1, uses `bundledBrowserRuntime: false`, and records zero remote URLs
  in the Python worker.
- Interview Loop's shared-source/vendor check, validation, nine focused tests,
  and production build passed, including all 13 real-Python authored cases and
  mutation/alias checks.
- The combined local Pages build contains 437 files and the routes `/`,
  `/llm-systems/`, `/interview-loop/`, `/practice/`, and
  `/practice/leeches/`.
- `npm run build:pages-course` passed with 95 rendered routes, 27 verified
  course routes, and 4 verified assets.
- `npm run build:web && npm run test:performance` passed; the largest emitted
  stylesheet is 179.8 KiB against the 180 KiB budget.
- Desktop browser inspection at 1440 × 900 covered Ten Problems problem
  navigation, Python example failure and success, Python check failure and
  success, progress persistence after reload, and removal from repeated-miss
  **Review** after a successful check.
- The same desktop pass covered Interview Loop module navigation and resume,
  wrong and correct quiz feedback, card reveal/rating persistence, coding
  starter failure, a four-check passing Python solution, and source/progress
  persistence after reload.
- Compact browser and keyboard inspection at 390 × 844 covered the shared
  menus and collapsible problem panels, Escape focus restoration, the visible
  three-pixel focus indicator, skip-link focus transfer, and no horizontal
  overflow.
- Direct local navigation verified same-origin subpath asset URLs for `/`,
  `/llm-systems/`, `/interview-loop/`, `/practice/`, and
  `/practice/leeches/`. The browser console recorded zero warnings or errors
  during the inspected flows.
- The accessibility evidence is browser and keyboard inspection, not a formal
  screen-reader audit.
- Final full-root `npm run validate` passed, including 470 of 470 application
  tests, the workspace and package test suites, and both learning-example
  validations.
- GitHub Pages workflow run `30238407331` deployed merge commit
  `778994638801b2599c9691c98d0d7183b5a97463` on 2026-07-27. Live browser QA
  at 1440 × 900 and 390 × 844 verified `/latent/`,
  `/latent/llm-systems/`, `/latent/interview-loop/`, `/latent/practice/`, and
  `/latent/practice/leeches/` with no horizontal overflow, off-origin loaded
  assets, or console warnings/errors. The live interaction pass repeated
  Interview module/quiz/card/IDE failure and success states, Ten Problems
  example/check failure and success, saved progress/drafts, repeated-miss
  review, and keyboard-driven mobile-menu focus restoration.

### Express beginner and advanced user-testing loop

- The beginning-learner pass started from the Learning Studio at 1440 × 900
  and 390 × 844, then entered the original course, Interview Loop, and Ten
  Problems without repository context. It exposed platform-showcase wording,
  a misleading resume target, hidden-before-run example expectations, and a
  crowded intermediate-width navigation state. The revision replaced that
  framing with content-oriented labels, made **Continue** choose the next
  incomplete item, exposed public input/expected output before execution, and
  added the shared compact menu and collapsible problem panels.
- The advanced-learner pass exercised direct problem/module navigation,
  Control/Command+Enter checking, Shift+Control/Command+Enter example runs,
  cancellation, detailed expected/received feedback, Python success and
  failure states, repeated-miss review, and persistence after reload. It also
  caught the need to preserve Interview Loop's Python-first runtime, restore
  course project/workspace context links, resolve extensionless static-course
  URLs, mirror the Python-worker CSP, and keep the shared header below the CSS
  performance budget; each issue was fixed before the final validation pass.
- Both personas repeated their route checks through the production-base local
  aliases `/latent/`, `/latent/llm-systems/`, `/latent/interview-loop/`,
  `/latent/practice/`, and `/latent/practice/leeches/`. Desktop and mobile
  passes finished without horizontal overflow or browser-console warnings or
  errors. The same persona flows were then repeated against the deployed
  GitHub Pages routes at merge commit
  `778994638801b2599c9691c98d0d7183b5a97463`, including live same-origin
  Python execution and persistence after reload.

The table above is the concise before/after visual record.

## Mobile learning-suite follow-up — 2026-07-27

The final mobile pass treated Ten Problems, Interview Loop, and the original
LLM Systems course as one learning suite. The shared source remains
`packages/course-kit/src/learner-ui.ts`; Ten Problems consumes it directly
through `packages/course-kit/src/question-group-site.ts` and
`site-config.mjs`, with no generated-output renaming or styling patch.

The Question Group player now closes compact problem navigation before
rerendering, centers and visibly focuses the replacement problem heading,
keeps detailed results keyboard-focusable, and uses a separate concise live
announcement. Editing an active run aborts its identity and clears the stale
Running state. These behaviors remain trusted player source; the portable
Question Group JSON and digest-bound progress contract are unchanged.

The wider suite uses the following reviewed mobile sources:

- `packages/course-kit/src/learner-ui.ts` and
  `packages/course-kit/src/question-group-site.ts` for shared tokens, shell,
  header, controls, editor, results, progress, compact problem navigation, and
  focus behavior.
- `examples/learning-platform/interview-loop/site/focus.mjs`,
  `site/app.mjs`, and `site/styles.css` for the specialized course rerender and
  compact module/practice flows.
- `scripts/generate-learning-platform-learner-ui.mjs`,
  `public/assets/learner-ui.css`, `public/assets/learner-ui.js`, and
  `app/layout.tsx` for build-generated, subpath-safe shared presentation in
  the original React course.
- `app/components/LearnerHeader.tsx` and `SkipLink.tsx` for truthful
  desktop/mobile family navigation and server-rendered post-navigation skip
  targets.
- `app/components/PaperLab.module.css`, `WorkspaceShell.tsx`,
  `WorkspaceShell.module.css`, and `BrowserChatCapstone.module.css` for the
  specialized lesson, IDE, and capstone mobile layouts.
- `scripts/check-performance-budget.mjs` for aggregate CSS budgets on
  representative exported suite routes.

### Mobile visual comparison

| Concern | Before this follow-up | After |
| --- | --- | --- |
| Problem changes | Focus could land at the viewport edge after the compact list collapsed. | The new heading is centered with a visible 3-pixel outline and the list remains closed. |
| Results and output | Long expected/received values could be difficult to inspect by keyboard. | Results wrap within the panel, the detailed region is focusable, and concise pass/fail text is announced separately. |
| Suite navigation | The React course could show desktop family links beside its compact Menu and expose a different semantic state before hydration. | All three products expose one truthful desktop or compact family navigation at a time. |
| Coding layout | Header subtraction, editor type, and dense feedback differed across products. | Compact editors use readable 16-pixel type, primary targets are at least 44 pixels, and IDE/capstone shells account for the family header. |

### Validation and express user evidence

- `npm run validate` passed 475 application tests plus all package/workspace
  suites, strict learning-example validation, TypeScript, ESLint, the
  production build, boundaries, and performance gates.
- Strict Ten Problems validation passed 4 groups, 10 questions, 39 cases, and
  zero warnings; all six example tests passed, including all 39 cases in real
  CPython. Interview Loop passed its 13 focused tests and all 13 real-Python
  authored cases.
- `npm run learning-examples:build` produced 441 files and 95 rendered
  original-course routes. Aggregate route CSS was 175.8–185.1 KiB against the
  220 KiB ceilings, and all intended runtime/editor boundaries remained
  deferred.
- In-app Chromium checked 11 routes at 320 × 800, 360 × 800, 390 × 844,
  430 × 932, and 844 × 390: 55 combinations with no horizontal document
  overflow or off-origin assets. A final 390 × 844 route sweep recorded no
  console warnings or errors.
- The beginning-learner pass verified the Studio handoff, compact Menu,
  Continue destination, visible public example, plain-language failure, and
  automatic move to the next unsolved problem.
- The advanced pass verified problem-list focus, example failure/success,
  complete-check failure/success, focusable detailed results, saved source and
  solved progress after reload, repeated-miss appearance after three attempts
  and two misses, removal after success, and keyboard Escape focus
  restoration. Parallel passes covered Interview quiz/card/IDE states and the
  original course lesson quiz, flash-card persistence, scrollable Transformer
  matrix, IDE, skip link, and capstone viewport.
- This is browser emulation and keyboard inspection, not a physical
  iOS/Android or formal screen-reader certification.

## Learner UI v2 — opinionated framework follow-up

This section supersedes the presentation architecture in the earlier shared-UI
handoffs. Their commit, deployment, file-count, and learner UI v1 evidence
remains historical; it is not evidence for v2.

### Why another framework revision was necessary

The first shared-UI pass removed Ten Problems' generated-output patches and
introduced common tokens, but the suite still had parallel shell owners.
Interview Loop rendered a bespoke application header, Ten Problems composed
the standalone Question Group player, and the original React course used a
separate header stylesheet. Activity toolbars could also read as additional
site headers. Similar accent colors did not reconcile hierarchy, typography,
navigation, focus, or responsive behavior.

V2 promotes the warm editorial principles of the original course into Course
Kit's default learner framework. The system is intentionally opinionated:
typography, measure, spacing, borders, component geometry, focus, feedback,
and responsive behavior are shared. A product chooses its content,
information architecture, and one reviewed color palette; it does not rebuild
the shell.

### Exact shared and specialized sources

| Source | Responsibility |
| --- | --- |
| `packages/course-kit/src/learner-ui.ts` | Canonical v2 tokens, five palettes, CSS, one-header renderer, footer, focus behavior, screen-reader utilities, and compact navigation script. |
| `packages/course-kit/src/learner-code-editor.ts` | Canonical CodeMirror extensions, Python/JavaScript parsing, syntax colors derived from learner tokens, keyboard commands, accessibility attributes, and the reviewed CSP nonce. |
| `packages/course-kit/src/browser/learner-code-editor-runtime.ts` | Progressive textarea enhancer bundled into the same-origin `assets/learner-code-editor.js` used by static learners. |
| `packages/course-kit/src/static-site.ts` | Shared foundation composed with standalone Learning Pack lessons and cards. |
| `packages/course-kit/src/question-group-site.ts` | Shared foundation composed with problem navigation, editor, Run examples/Check solution feedback, progress, Continue, and repeated-miss Review. |
| `scripts/generate-learning-platform-learner-ui.mjs` | Derives `public/assets/learner-ui.css`, `public/assets/learner-ui.js`, and the dependency-free Interview build input from reviewed Course Kit source. |
| `public/assets/learner-ui.css` and `public/assets/learner-ui.js` | Generated, self-hosted React assets; `build:web` regenerates them rather than treating them as another design source. |
| `app/layout.tsx` | Links the generated stylesheet and behavior through the active base path for the original React course. |
| `app/styles/tokens.css` | Aliases older course variables to the canonical learner tokens. |
| `app/components/LearnerHeader.tsx` | Thin React adapter over the shared header markup contract. |
| `examples/learning-platform/ten-problems/site-config.mjs` | Product identity, content-oriented labels, review route, footer, favicon, and `cobalt` palette. |
| `examples/learning-platform/ten-problems/tools/build.mjs` | Passes the reviewed configuration and Python adapter into the builder before rendering. |
| `examples/learning-platform/ten-problems/security-config.mjs` | Document meta CSP and static-host page/worker response policy. |
| `examples/learning-platform/ten-problems/trusted/python-question-runtime.ts` | Maps validated declarative cases to the reviewed Python worker and host-owned assertions. |
| `examples/learning-platform/interview-loop/tools/vendor/learner-ui.mjs` | Generated, drift-checked build input used by the extracted Interview example. |
| `scripts/generate-learning-platform-learner-ui.mjs` | Generates that vendored copy from Course Kit rather than creating another design source. |
| `scripts/build-learning-example-pages.mjs` | Builds the Paper-palette Learning Studio and assembles all three products at stable Pages subpaths. |

### Shared editor primitive

The original v2 handoff shared the editor shell and focus treatment but left
three implementations behind it: native textareas in Ten Problems and
Interview Loop, plus separate CodeMirror configuration in the React IDE.
`packages/course-kit/src/learner-code-editor.ts` now owns the actual editor
primitive. It provides the CodeMirror extensions, real Python/JavaScript
parsers and syntax highlighting, token-driven integrated surface, optional
dark project-workspace variant, Tab/Shift+Tab indentation, Escape-then-Tab
focus exit, run/save shortcuts, and editor accessibility attributes.

For static learners,
`packages/course-kit/src/browser/learner-code-editor-runtime.ts` is bundled at
build time as `assets/learner-code-editor.js`. The Question Group builder emits
that same-origin asset before `learner-ui.js` and `player.js`; the shared
`LearnerUiComponents.prepareCodeEditor` adapter progressively enhances the
textarea while preserving its bubbling input events, draft persistence, run
identity, and exact-digest progress behavior. The native textarea remains only
the no-script/failure fallback. CodeMirror's reviewed generated style element
uses the exact `latent-learner-code-editor-v1` nonce; both document and response
CSP include only that nonce and never add `unsafe-inline`.

Ten Problems selects Python and four-space indentation from trusted player
source. Portable Question Group JSON still contains only declarative starter
source and public cases; no Question Group field, digest, runtime adapter,
executable-check boundary, timeout, or output limit changed.

The one global header has a stable anatomy: product identity and optional
metadata, local primary navigation, and one **Learning suite** disclosure for the
product family. Compact layouts put Practice/Review navigation inside
**Learning suite** rather than adding a second header. The problem list, progress
summary, editor actions, and results stay inside the practice workspace. In
the original course, **Read / Code / Results** is now a quiet “In this lesson”
section nav after the lesson introduction rather than another full-width bar.

The reviewed palettes are `paper`, `sage`, `cobalt`, `plum`, and `graphite`;
`paper` is the default. Ten Problems supplies only
`appearance.palette: "cobalt"`. Palette choice changes semantic color and line
tint, while every palette uses the same sparse, scroll-reactive partial-line
atmosphere. The editorial type system, single vertical flow, components, focus
treatment, and responsive contract remain shared. Learning Studio and the
original course use Paper, Interview Loop uses Sage, and Ten Problems uses
Cobalt. A low-level trusted token override remains for compatibility, but the
reviewed examples do not use it and the builder rejects combining
`ui.appearance` with the legacy top-level `ui.theme`.

No portable Question Group or Learning Pack contract changed. Canonical bytes,
digest-bound drafts/progress, public declarative cases, trusted Python checks,
runtime timeouts/output limits, same-origin Pyodide assets, CSP, and Pages
subpath routing retain their existing ownership and security boundaries. The
old post-build HTML/JavaScript replacements, framework-concept renaming, and
generated-CSS patches remain removed. Product identity, routes, labels,
palette, footer, runtime adapter, and CSP are explicit trusted build inputs.

### What remains intentionally specialized

Ten Problems remains a focused Python practice product: problem list, prompt
and contract, editor, public examples, full visible checks, progress,
Continue, and repeated-miss Review. These sections now follow a centered
single-column document on desktop and compact screens rather than independent
full-height panes.

Interview Loop remains a navigable course with behavioral and architecture
modules, quizzes, flash cards, portable practice, and a trusted Python IDE.
The original course retains its lesson, project, workspace, and capstone
layouts. All three now inherit the same navigation, typography, controls,
feedback, progress, focus, and mobile language.

### Concise visual comparison

| Concern | Before v2 | After v2 |
| --- | --- | --- |
| Design ownership | Three shells approximated a family with local CSS. | Course Kit owns one exact foundation consumed by static and React builds. |
| Headers | Family, product, and activity bars created stacked header-like rows. | One global header; problem, lesson, and editor navigation remains contextual. |
| Theme choice | Raw token maps could recreate unrelated products. | Five reviewed palettes vary the background atmosphere and semantic color while framework geometry and behavior stay invariant. |
| Coding surfaces | Ten Problems and Interview's IDE used different control and result languages. | Both inherit shared editor framing, actions, status, and feedback while preserving different workspace flows. |
| Customization | Generated output was patched to establish the product interface. | `site-config.mjs` and the builder establish identity, labels, routes, palette, and runtime before rendering. |
| Mobile/a11y | Products reconciled menus, landmarks, focus, and short viewports independently. | Shared compact disclosure, skip target, Escape restoration, visible focus, live regions, and breakpoints form the baseline. |

### Local validation and express user evidence

- Course Kit built successfully and all 57 package tests passed. The 70
  focused application regression tests, TypeScript, and ESLint passed.
- `npm run open-learning:validate`, `npm run open-learning:schema`, and
  `npm run open-learning:generate` passed without changing the portable
  contracts.
- Ten Problems strict validation passed with 4 groups, 10 questions, 39 cases,
  and zero warnings; all 6 example tests and the production build passed.
- Interview Loop strict validation and all 13 focused tests passed, including
  its real-Python authored cases and production build.
- The React production export prerendered 96 routes and verified 95 rendered
  course routes, 27 required routes, and 4 assets. The combined local Pages
  artifact contains 441 files and exposes `/`, `/llm-systems/`,
  `/interview-loop/`, `/practice/`, and `/practice/leeches/`.
- At 1440 × 900, the beginning-learner pass moved from Learning Studio into
  Ten Problems, found one stable header, opened Practice, understood the public
  example, used Continue, and recognized device-local progress without
  framework terminology.
- The advanced Ten Problems pass verified problem navigation, example and
  full-check failure then success, actionable expected/received feedback,
  five-of-ten solved progress after reload, repeated-miss appearance, and
  removal from Review after a passing solution.
- The parallel Interview pass verified module navigation/resume,
  wrong/correct quiz feedback, card rating persistence, and Python IDE failure
  then four-check success.
- At 390 × 844, the single vertical practice flow fit the viewport width
  without horizontal document overflow. **Learning suite** opened with local
  and family navigation, and Escape restored focus with the shared
  three-pixel visible indicator.
- The combined local route sweep recorded zero browser-console warnings or
  errors.

This evidence is local Chromium emulation and keyboard inspection, not a
physical-device or formal screen-reader certification. The final full-root
`npm run validate` gate passed with 606 tests and zero failures.

PR `#36` was squash-merged as
`c9e86158a6b56882d098691d416d1c6001b7d698`; GitHub Actions Validate run
`30277729862` and Deploy Learning Examples run `30277729464` completed
successfully. Live Chromium checks at 1440 × 900 and 390 × 844 covered
`/latent/`, `/latent/llm-systems/`, `/latent/interview-loop/`,
`/latent/practice/`, and `/latent/practice/leeches/`. Each route exposed one
global learner header, loaded its shared assets from the Pages origin, fit
without horizontal overflow, and recorded zero browser-console warnings or
errors. Live Python execution produced actionable expected/received failure
feedback, then passed the public example and all four published checks.
Solved progress advanced from two to three problems, remained three after
reload, and moved **Continue** to the next unfinished problem. Keyboard focus
used the shared visible three-pixel indicator.

## Ethereal one-plane refinement — 2026-07-27

This section supersedes the presentation and local-evidence portions of the
v2 handoff above. Its PR and deployment records remain historical evidence for
the previously published revision.

The final framework is intentionally opinionated rather than a collection of
loosely related themes. It fixes one persistent **Learning Studio** global
header, one in-content local navigation row, one vertical content plane,
editorial typography and measure, component geometry, feedback, focus,
responsive behavior, and a sparse scroll-reactive line atmosphere. Products
choose one reviewed palette. LLM Systems uses warm `paper`, Interview Loop
uses `sage`, and Ten Problems uses `cobalt`; background colors and line tint
differ, while the four non-Paper palettes add a short highlight to the same
geometry and scroll crossfade.

### Exact shared and specialized sources

| Source | Final responsibility |
| --- | --- |
| `packages/course-kit/src/learner-ui.ts` | Canonical tokens, five palettes, open-line atmosphere and glint, shell, persistent-header and context-navigation renderers, controls, progress, focus, screen-reader helpers, compact behavior, and trusted example-solution disclosure. |
| `packages/course-kit/src/static-site.ts` | Standalone Learning Pack composition over the shared foundation. |
| `packages/course-kit/src/question-group-site.ts` | Single-column problem flow, chooser, editor, Run examples/Check solution feedback, Continue, repeated-miss Review, and accessible empty state. |
| `scripts/generate-learning-platform-learner-ui.mjs` | Generates React assets and Interview's drift-checked build input from Course Kit source. |
| `app/components/PageAtmosphere.tsx` and `app/components/LearnerHeader.tsx` | Thin React markup adapters for the original course. |
| `examples/learning-platform/learning-suite.mjs` | Trusted suite catalog and the single `createLearningSuiteHeaderConfiguration()` source for identity, metadata, sibling navigation, active state, subpath routes, and compact label. |
| `examples/learning-platform/ten-problems/site-config.mjs` | Explicit Cobalt identity, labels, routes, footer, favicon, runtime assets, and security-adjacent build configuration. |
| `examples/learning-platform/ten-problems/trusted/reference-solutions.mjs` | Ten reviewed Python references keyed to exact trusted question identities. |
| `examples/learning-platform/interview-loop/site-config.mjs`, `site/app.mjs`, and `trusted/reference-solutions.mjs` | Specialized Sage course composition and reviewed coding references. |

Ten Problems remains a focused Python product with a problem chooser, prompt,
editor, public examples, full checks, progress, Continue, and repeated-miss
Review. Interview remains a three-module course using one webhook-delivery
scenario across behavioral, coding, and system-design rounds. The original
course keeps its lesson, workspace, project, and capstone layouts. These
content structures are intentionally different inside one navigation,
typography, control, feedback, progress, solution, and mobile language.

The suite catalog is a directory of independently built static experiences,
not an account, enrollment system, or aggregate **My courses** dashboard.
Each experience keeps exact-content-bound progress separately on the current
device.

No portable Question Group or Learning Pack contract changed. References,
runtime adapters, executable checks, Python workers, state logic, and UI
behavior remain trusted source. The shared solution disclosure renders
bounded text only; opening it does not execute source, replace a draft, or
change progress. Digest-bound persistence, public declarative cases, complete
trusted checks, timeouts, output limits, CSP, same-origin Pyodide, and
subpath-safe routing remain intact.

The editable public-example interaction is also trusted UI, not portable
content. `packages/course-kit/src/learner-ui.ts` owns the labeled JSON fields,
bounded parsing, reset, cancellation, actual-only feedback, focus, and mobile
behavior. `packages/course-kit/src/question-group-site.ts` scopes one
published example identity to temporary arguments and passes it to the same
reviewed Python adapter. The published expected value remains explicitly tied
to the original input. Custom tries stay visit-local and never call the
progress writer; canonical **Run examples** and **Check solution** continue to
use the untouched validated case objects, with only the latter changing
attempt, solved, or repeated-miss state.

The primary interface is still produced from `site-config.mjs` and Course Kit
at build time. The removed HTML/JavaScript string replacements, concept
renaming, and generated-CSS patches have not returned. The obsolete nested
Interview-only Pages workflow was also removed; combined deployment depends
on reviewed monorepo sources and is owned by the root Pages build.

### Concise visual comparison

| Before this refinement | After this refinement |
| --- | --- |
| Ten Problems exposed multiple adjacent work surfaces and an unrelated player hierarchy. | One centered vertical flow with a collapsed chooser, prompt, editor, actions, solution, and feedback in reading order. |
| Similar accent colors masked different backgrounds, headers, controls, and responsive behavior. | Every route keeps the Learning Studio header; local links sit in one context row, while Paper, Sage, and Cobalt retain distinct atmospheres over identical geometry, shell, components, and breakpoints. |
| Coding experiences offered no consistent reference answer. | Interview and Ten use one reviewed read-only solution disclosure after actions. |
| Public example arguments were display-only. | Both Python practice products use one shared editable JSON field, actual-only **Run this input** feedback, and **Reset input**, while canonical grading remains unchanged. |
| Empty repeated-miss Review was only a status sentence. | Review preserves the product H1, context label, live message, and programmatic focus. |

### Current local validation and user evidence

- Course Kit passed all 75 package tests. Ten Problems passed strict
  validation and all 9 focused tests: 4 groups, 10 questions, 39 cases, 10
  public examples, and 29 complete checks. Interview passed strict validation
  and all 20 focused tests: 3 lessons, 14 cards, 3 practice questions, 1 IDE
  exercise, and all 13 authored Python cases.
- `npm run open-learning:validate`, `npm run open-learning:schema`, and
  `npm run open-learning:generate` passed with unchanged public contracts.
  The production course build stayed within CSS/runtime budgets, and the
  combined Pages artifact contains 446 files.
- The final root `npm run validate` gate passed package builds/tests,
  boundaries, TypeScript, ESLint, the application suite, performance budgets,
  and both strict example validations.
- The beginner pass covered product choice, the collapsed problem chooser,
  prompt/constraint reading, editing a public JSON input, resetting it,
  canonical Run examples, Continue, and the optional example solution. The
  advanced pass covered problem switching, custom returned-value feedback,
  canonical example and full-check failure/success, saved progress after
  reload, repeated-miss appearance/removal, and proof that custom runs and
  solution disclosure mutate neither draft-bound progress nor review state.
- The regression that motivated this revision is covered directly: clicking
  **Learning Studio** from LLM Systems preserves the same identity,
  **Courses and practice** metadata, global destination order, and header
  height. Only the product-local context row is added or removed.
- Paper reports zero glint strength. Sage and Cobalt report the reviewed
  nonzero strength, and browser scroll evidence showed the intro line fading
  out while the first trace and its inherited highlight faded in.
- Desktop checks at 1280 × 720 covered `/`, `/llm-systems/`,
  `/interview-loop/`, `/practice/`, `/practice/leeches/`, and all `/latent/`
  equivalents. Mobile checks at 390 × 844 covered the same product routes.
  Every checked route had one global header, a visible H1, same-origin assets,
  no horizontal document overflow, and zero console warnings or errors.
- Keyboard and accessibility checks covered skip-target routing,
  compact-menu Escape focus restoration, current-page state, one page-level
  header, distinct global/local navigation labels, visible headings and live
  messages, the JSON field's normal Tab exit, CodeMirror Tab indentation and
  Escape-then-Tab exit, focusable code/reference regions, 53-pixel local
  navigation targets, and the shared three-pixel visible focus indicator.

This is local Chromium emulation and keyboard inspection, not a physical
device or formal screen-reader certification.
