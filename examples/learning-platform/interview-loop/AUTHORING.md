# Agent authoring record

This file preserves the originating request, first-pass handoff, and revision
feedback so a later agent can continue shaping the course without
reconstructing intent from the artifact.

## Originating prompt

> Create the first pass of a new Latent example course called “Interview Loop Lab” in `examples/learning-platform/interview-loop`. This is a genuine demo of agent-authored course creation, so preserve the prompt and your final summary for an iterative follow-up.
>
> The course should prepare experienced software engineers for high-bar interviews at product and AI infrastructure companies—companies like Stripe, OpenAI, and Anthropic, but do not claim to reproduce any company’s private process or questions. Include three connected areas: (1) behavioral story preparation and follow-up questions, (2) coding practice, and (3) a reusable system-architecture interview framework covering requirements, constraints, interfaces/data flow, failure modes, scaling, observability, and tradeoffs.
>
> Use the repository’s checked-in `skills/author-learning-platform`, `skills/author-course`, `skills/author-flash-card-deck`, `skills/author-question-group`, and `skills/author-ide-exercise` workflows. Read their SKILL.md files and the generated platform AGENTS.md before editing. Research only primary or official sources where claims need grounding. Scaffold from the tiny Latent platform, then customize all four learning primitives. Keep portable JSON declarative and executable checks in trusted source. Make this a coherent, useful first pass—not marketing copy—and run the generated project’s full validation and build.
>
> Only create or edit files under `examples/learning-platform/interview-loop`; do not touch README.md or any existing working-tree changes. Stop after the validated first pass and report the course structure, exact files, and validation evidence so I can give revision feedback.

## First-pass summary

Created a dependency-free first pass of **Interview Loop Lab** from Latent's
tiny learning-platform scaffold. The authored course is a single connected
48-minute lesson that moves from behavioral evidence to coding evidence to
architecture decisions. It includes five learning objectives, five quizzes,
one fourteen-card retrieval deck, two Question Groups with three JavaScript
questions and nine declarative cases, and one trusted browser IDE exercise
with four host-owned checks.

The shared technical scenario is multi-tenant webhook delivery. The reusable
architecture checklist is R-C-I-F-S-O-T: requirements, constraints, interfaces
and data flow, failure modes, scaling, observability, and tradeoffs. This
checklist and all practice prompts are original course material. Public claims
are grounded in nine official, primary, or specification sources from OpenAI,
Anthropic, the U.S. Department of Veterans Affairs, Stripe, AWS, Google SRE,
and Ecma International. The course explicitly says it does not reproduce or
predict any employer's private process, rubric, or questions.

Portable content remains declarative in:

- `content/learning-pack.json`
- `content/question-groups.json`

Executable behavioral checks remain in reviewed trusted source:

- `trusted/ide-exercises.mjs`

The rendered platform also derives lesson duration and quiz count from the
validated pack, exposes all nine source records as ordinary links, and fixes
the inherited one-column mobile grid so a 390-pixel viewport has no horizontal
overflow.

### Exact source files

- `.github/workflows/deploy-pages.yml`
- `.gitignore`
- `AGENTS.md`
- `AUTHORING.md`
- `CONTENT_LICENSE.md`
- `GUIDE.md`
- `LICENSE`
- `NOTICE.md`
- `README.md`
- `content/learning-pack.json`
- `content/question-groups.json`
- `package.json`
- `platform.json`
- `site/app.mjs`
- `site/checker.mjs`
- `site/executor.worker.mjs`
- `site/index.html`
- `site/progress.mjs`
- `site/runner.worker.mjs`
- `site/runtime-policy.mjs`
- `site/styles.css`
- `tools/build.mjs`
- `tools/serve.mjs`
- `tools/validate.mjs`
- `tools/vendor/course-kit-validator.mjs`
- `trusted/ide-exercises.mjs`

`dist/` is the ignored 20-file generated platform build.

### Validation and inspection evidence

- `npm run validate`: passed with Course Kit validator 0.2.0; 1 lesson,
  1 deck, 14 cards, 2 Question Groups, 3 practice questions, and 1 IDE
  exercise.
- `npm run build`: passed and wrote `dist/`.
- Canonical Learning Pack `validate --strict --json`: passed with zero errors
  and warnings; 1 lesson, 5 quizzes, 14 cards, 5 objectives, and 9 sources.
- Canonical Question Group `questions validate --strict --json`: passed with
  zero errors and warnings; 2 groups, 3 questions, 9 cases, 3 example cases,
  and 6 check cases.
- Canonical standalone Learning Pack build: passed, SHA-256
  `82e6b93c4ede6b5a6f33eda68140a3bb90296678fdf6cd1ad163021516815852`.
- Canonical standalone Question Group build: passed, SHA-256
  `bbc336ded3867dcf3fa6060049f0050a8d151348aebe73751be5b0cbd4edd9ed`.
- Browser inspection: verified the 48-minute and five-quiz lesson metadata,
  correct quiz feedback, 14-card reveal/rating and reload persistence, one
  failing then passing practice solution, passing solutions for all three
  questions, one failing then all-passing IDE run, persisted IDE source after
  reload, nine rendered official-source links, no browser warnings or errors,
  no desktop overflow, and no horizontal overflow at a 390 by 844 viewport.

The automated browser surface did not advance focus during synthetic Tab-key
attempts, so end-to-end keyboard focus traversal remains a manual follow-up.
Timeout/cancellation, stale-result rejection, and the three-miss leech view
were not forced interactively in this first pass.

## Revision feedback (verbatim)

> Good first pass, but it still feels like one long generated lesson rather than a course I shaped with you. Please revise the same example with this feedback:
>
> 1. Turn behavioral preparation, coding practice, and architecture reasoning into three genuinely navigable modules—not just headings inside one lesson. Add visible module progress and resume behavior. This may require trusted changes to the generated player and validator; keep those changes inside this example.
> 2. Make the behavioral module less generic: show one weak answer, a coached rewrite, likely follow-up questions, and a concise self-review rubric based on ownership, decisions, evidence, outcome, and reflection. Do not pretend to grade free-form answers automatically.
> 3. Keep the webhook-delivery architecture scenario, but make the walkthrough explicitly move through requirements, constraints, interfaces/data flow, failure modes, scale, observability, and tradeoffs. Finish with a 45-minute mock-interview brief and an interviewer follow-up checklist.
> 4. Make the coding sequence visibly progressive. Add explicit complexity expectations and at least one boundary case that defeats the obvious partial solution.
> 5. Shorten the introduction and cut generic interview advice. Preserve the company-neutral disclaimer and official source grounding.
>
> Update AUTHORING.md with this exact feedback, the revision decisions, and before/after counts. Re-run strict portable validation, the full project validation/build, and browser QA for module navigation, progress/resume, mobile layout, and representative fail/pass states. Do not edit outside `examples/learning-platform/interview-loop`.

## Revision decisions

- Split the single portable lesson into three ordered lessons that the trusted
  player presents as modules: Behavioral Evidence, Progressive Coding, and
  Webhook Delivery Architecture. The second and third lessons declare the
  preceding lesson as their portable prerequisite, but navigation remains
  available for targeted practice.
- Added a trusted module rail, explicit learner-controlled complete/incomplete
  actions, a visible native progress bar, previous/next controls, and
  device persistence for the active module and completed module IDs. At this
  revision the namespace used package id and version; the third revision below
  corrects that identity to include the exact Learning Pack digest. Resume
  never infers completion from quiz answers.
- Reworked the behavioral example around one weak answer and one coached
  rewrite. The five-line rubric is Ownership, Decisions, Evidence, Outcome,
  and Reflection. The course explicitly sends free-form review to the learner,
  a peer, or a mentor rather than claiming an automated score.
- Turned the three portable coding questions plus the trusted IDE exercise into
  a four-step ladder. Each step now states its time and space target. The first
  example defeats adjacent-only deduplication, and the second defeats an early
  exit that assumes timestamps are sorted.
- Expanded the existing webhook scenario into seven named passes:
  requirements, constraints, interfaces and data flow, failure modes, scale,
  observability, and tradeoffs. Added a minute-by-minute 45-minute mock brief
  and a matching interviewer follow-up checklist.
- Kept all nine official, primary, or specification sources and the
  company-neutral disclaimer. Removed the long general-purpose introduction
  and generic interview loop advice. Bumped both portable artifacts from
  version 1.0.0 to 1.1.0 so their published identities remain immutable.
- Updated the example-local validator to require the exact three-module
  sequence, one deterministic quiz in every module, and the intended linear
  prerequisite chain.

### Before / after counts

| Course element | First pass | Revision |
| --- | ---: | ---: |
| Navigable lesson modules | 1 | 3 |
| Total lesson minutes | 48 | 58 |
| Learning objectives | 5 | 5 |
| Lesson blocks | 32 | 36 |
| Deterministic lesson quizzes | 5 | 6 |
| Official/primary/specification sources | 9 | 9 |
| Flash-card decks | 1 | 1 |
| Flash cards | 14 | 14 |
| Question Groups | 2 | 2 |
| Portable coding questions | 3 | 3 |
| Declarative coding cases | 9 | 9 |
| Trusted IDE exercises | 1 | 1 |
| Host-owned IDE checks | 4 | 4 |

## Revision validation and browser evidence

- Canonical Learning Pack `validate --strict --json`: passed with zero errors
  and warnings; 3 lessons, 6 quizzes, 1 deck, 14 cards, 5 objectives, and
  9 sources.
- Canonical Question Group `questions validate --strict --json`: passed with
  zero errors and warnings; 2 groups, 3 questions, 9 cases, 3 example cases,
  and 6 check cases.
- `npm run validate`: passed with Course Kit validator 0.2.0; the example-local
  contract reported 3 lessons, 1 deck, 14 cards, 2 Question Groups,
  3 practice questions, and 1 trusted IDE exercise.
- `npm run build`: passed after running validation again and wrote the
  20-file ignored `dist/` platform, including its two hidden marker files.
- Portable source SHA-256:
  `content/learning-pack.json` =
  `32f625cfce9733ffce736041fafda35bed3051b60a4e17299a4ee8517e0081fd`;
  `content/question-groups.json` =
  `e8aa95861ab6f2b9928b0c233e7bf58ce613a804be2f3de094fc54285444b5ec`.
- Browser module navigation: observed module 1 on entry, then opened modules 2
  and 3 from the module rail; module metadata changed to 1/3, 2/3, and 3/3
  with the expected duration, source, objective, and quiz counts.
- Browser progress/resume: marked module 2 complete, observed `1 / 3 modules
  complete` and its `Complete` label, reloaded the page, and observed module 2
  restored as active with the same completion state.
- Browser content inspection: observed the weak behavioral answer, coached
  rewrite, five self-review dimensions, no-auto-grading statement, progressive
  three-question Practice list, step and complexity labels, all seven
  architecture passes, the 45-minute mock brief, and the interviewer checklist.
- Browser fail/pass states: observed `Try again` then `Correct` for the
  architecture failure-mode quiz; failing cases then all-passing cases for the
  non-adjacent-duplicate practice question; and a failing then all-four-passing
  trusted IDE run.
- Browser mobile layout: at 390 by 844, both Course and Practice rendered a
  single 372-pixel content column inside a 390-pixel document. The Practice
  editor measured about 334 pixels wide, and neither view produced horizontal
  overflow.
- Browser console: zero warnings or errors during the requested checks.

## Revision handoff summary

Interview Loop Lab is now a 58-minute, three-module course rather than one
long lesson. Behavioral Evidence contains the weak answer, coached rewrite,
likely follow-ups, and the learner-owned O-D-E-O-R self-review. Progressive
Coding connects a four-step ladder to three portable browser exercises and one
trusted IDE exercise, with explicit complexity and boundary traps. Webhook
Delivery Architecture walks all seven R-C-I-F-S-O-T decisions and ends with a
45-minute mock brief plus interviewer checklist.

The trusted player now exposes module navigation, self-marked completion,
visible 0/3 through 3/3 progress, and device-local resume tied to the exact
Learning Pack package and version. Portable content is version 1.1.0; no
free-form response is graded automatically.

### Exact files revised

- `AUTHORING.md`
- `content/learning-pack.json`
- `content/question-groups.json`
- `site/app.mjs`
- `site/index.html`
- `site/styles.css`
- `tools/validate.mjs`
- `trusted/ide-exercises.mjs`

All other checked-in scaffold files were left unchanged. `dist/` was
regenerated by the successful build and remains ignored.

## Third revision feedback (verbatim)

> An independent review found publication-blocking inconsistencies in the revised Interview Loop Lab. Please make a third, narrow revision in the same example only:
>
> 1. Bind all Learning Pack learner state (module, quiz, and card progress) to the exact SHA-256 digest, not only package-id@version. Load the pack with its digest, include the digest in the state identity/namespace, and add validation or focused checks proving unchanged bytes restore state while changed bytes at the same package/version do not.
> 2. The coding contracts promise read-only inputs and fresh output, but current runtime checks only compare return values. Repair the trusted runner/checker so a deliberately mutating or output-aliasing implementation fails while an equivalent pure implementation passes. If complete alias detection is not safely enforceable in this runner, narrow the learner-facing claim precisely instead of pretending it is checked—but prefer enforcing both stated properties.
> 3. Make the coding ladder labels consistent as steps 1–4 of 4 across portable questions and the IDE. Clarify that the architecture module’s declared 24 minutes prepares a separate 45-minute take-away mock, rather than implying the mock fits inside 24 minutes.
> 4. Update GUIDE.md and AUTHORING.md to the actual final module/quiz/build-file counts. Preserve this feedback verbatim in AUTHORING.md, record decisions/evidence, and update the handoff.
>
> Run strict Learning Pack and Question Group validation, the example validation/build, focused tests for digest-bound restore and mutation/alias rejection, and representative browser QA. Do not edit outside examples/learning-platform/interview-loop. Report exact changes and evidence.

## Third revision decisions

- The player now fetches the Learning Pack as text, parses that same byte
  sequence, computes its SHA-256 digest, and constructs a Learning Pack
  identity containing package id, package version, and digest. Module position
  and completion, quiz answers, and card ratings all use a namespace ending in
  `sha256:<digest>`. A focused in-memory-storage test writes all three state
  classes, proves an unchanged byte sequence restores them, and proves a
  whitespace-only byte change at the same id and version restores none of
  them.
- Question Group drafts and progress remain separate from Learning Pack state.
  Their existing contracts include the exact Question Group library digest;
  submitted progress also records the exact source digest. The IDE contract
  changed from `interview-loop.retry-plan.v1` to `.v2`, so older results do not
  cross the strengthened host contract.
- The executor now clones and deeply freezes every JSON input before invoking
  learner code, snapshots it for a post-run equality check, and records every
  input object and array identity. The checker adds host-owned assertions that
  every input stayed unchanged and that no object or array in the returned
  value aliases the input graph. A mutating implementation therefore throws
  or fails, an otherwise value-correct alias fails freshness, and an
  equivalent implementation that creates its output passes all assertions.
- The portable prompts, module ladder, Practice heading, and trusted IDE
  summary now use one four-step sequence: steps 1–3 of 4 are Question Group
  exercises and step 4 of 4 is the IDE exercise.
- The architecture module summary and take-away heading now say explicitly
  that the 24-minute module prepares a separate 45-minute mock. Both portable
  artifacts were bumped from 1.1.0 to 1.2.0.
- The example-local validator now requires the digest-qualified Learning Pack
  identity, the exact three-module sequence and 58-minute/six-quiz totals,
  consistent Question Group step labels, and the separate mock timing.

### Actual counts after the third revision

| Course or build element | Second revision | Third revision |
| --- | ---: | ---: |
| Navigable lesson modules | 3 | 3 |
| Total lesson minutes | 58 | 58 |
| Deterministic lesson quizzes | 6 | 6 |
| Learning objectives | 5 | 5 |
| Lesson blocks | 36 | 36 |
| Flash-card decks | 1 | 1 |
| Flash cards | 14 | 14 |
| Question Groups | 2 | 2 |
| Portable coding questions | 3 | 3 |
| Declarative coding cases | 9 | 9 |
| Trusted IDE exercises | 1 | 1 |
| Host-owned IDE value checks | 4 | 4 |
| Host-owned ownership assertions per coding case | 0 | 2 |
| Focused contract tests | 0 | 4 |
| Built files, including hidden marker files | 20 | 21 |

## Third revision validation and browser evidence

- Canonical Learning Pack strict validation passed with zero errors or
  warnings: 3 lessons, 6 quizzes, 1 deck, 14 cards, 5 objectives, and 9
  sources.
- Canonical Question Group strict validation passed with zero errors or
  warnings: 2 groups, 3 questions, 9 cases, 3 example cases, and 6 check
  cases.
- `npm run validate` and `npm run build` passed. All four focused contract
  tests passed, and the deterministic build contains exactly 21 files when
  its two hidden marker files are counted.
- Portable source SHA-256:
  `content/learning-pack.json` =
  `91b4fc403bcab8615b41f03e09a37fdf0a8dd719fe5d90ec922e850c5484a95a`;
  `content/question-groups.json` =
  `990bd09acc89ad8f00c93d53d22b163d7b4f5d18cc9a45a6090a4f29f3f911ba`.
- Browser QA restored the active module, `1 / 3` completion, a quiz result,
  and a card rating after reload under the unchanged digest-qualified
  namespace.
- Browser QA showed steps 1–4 of 4 and the separate 24-minute-module /
  45-minute-mock wording. A value-correct solution that returned input objects
  failed only the fresh-output assertion; the equivalent pure solution passed
  every value and ownership assertion. A mutating implementation was rejected
  by the frozen-input contract.
- The selected browser-control surface did not expose viewport resizing, so
  the third pass did not repeat the 390 by 844 assertion. The preceding
  revision's mobile-layout evidence remains recorded above; the third revision
  did not change layout or styling files.

## Third revision handoff summary

Interview Loop Lab remains a 58-minute course with three navigable modules and
six deterministic lesson quizzes. Its Learning Pack is now loaded with an
exact SHA-256 digest, and all module, quiz, and card state is isolated by that
digest. The trusted browser runner enforces the learner-facing read-only-input
and fresh-output properties in addition to result equality.

The coding ladder now reads steps 1–4 of 4 everywhere. The 24-minute
architecture module explicitly prepares a separate 45-minute take-away mock.
Portable Learning Pack and Question Group identities are now version 1.2.0.
The generated platform contains 21 files when the two hidden marker files are
counted.

### Exact files revised in the third revision

- `AUTHORING.md`
- `GUIDE.md`
- `content/learning-pack.json`
- `content/question-groups.json`
- `package.json`
- `site/app.mjs`
- `site/checker.mjs`
- `site/executor.worker.mjs`
- `site/progress.mjs`
- `site/runner.worker.mjs`
- `tools/validate.mjs`
- `trusted/ide-exercises.mjs`

### Exact files added in the third revision

- `site/invocation-contract.mjs`
- `test/invocation-contract.test.mjs`
- `test/learning-state.test.mjs`

## Shared learner UI revision

### Why the examples diverged

Interview Loop grew from an example-local application shell. Its header,
navigation, course rail, controls, feedback, responsive rules, and page layout
were implemented directly in `site/`. Ten Problems later started from Course
Kit's standalone Question Group player and used post-build string and CSS
patches to turn framework-oriented generated output into a focused Python
product. The two sites therefore had different owners for the same
learner-facing concerns.

This revision treats learner presentation as reviewed trusted framework source,
not portable content and not generated-output customization. It does not make
the two products identical: it gives them one visual and interaction language
while preserving the course and coding-workspace layouts appropriate to each.

### Architectural decisions

- `packages/course-kit/src/learner-ui.ts` is the canonical learner UI
  foundation. It owns typography and color tokens, spacing, borders, focus
  states, responsive breakpoints, global widths and shell, header and primary
  navigation, buttons, forms, cards, progress/resume, statuses, result panels,
  empty states, editor framing, screen-reader helpers, and local mobile-menu
  behavior.
- `packages/course-kit/src/static-site.ts` consumes the foundation for
  standalone Learning Pack lesson/card sites.
- `packages/course-kit/src/question-group-site.ts` consumes it for standalone
  problem navigation, editor, run/check feedback, progress, resume, and
  repeated-miss review. Product copy, navigation labels, the review directory,
  theme, footer, favicon, and a trusted runtime adapter are typed build inputs
  rather than generated-output patches.
- `scripts/generate-learning-platform-learner-ui.mjs` generates
  `examples/learning-platform/interview-loop/tools/vendor/learner-ui.mjs` from
  the canonical Course Kit module. Interview Loop uses that checked,
  dependency-free build input so an extracted example still builds without a
  runtime package or hosted asset.
- `examples/learning-platform/interview-loop/platform.json` explicitly owns
  the Interview Loop product name, navigation labels and hash routes, header
  metadata, theme values, and footer copy.
- `examples/learning-platform/interview-loop/tools/build.mjs` renders the
  shared header/footer and emits the shared CSS and local menu script alongside
  the existing trusted application. `site/app.mjs` and `site/styles.css`
  remain responsible for the specialized module, quiz, flash-card, portable
  practice, and IDE experiences.
- `examples/learning-platform/ten-problems/site-config.mjs` owns the parallel
  Ten Problems configuration, and its build passes that configuration directly
  to the Question Group builder.
- `examples/learning-platform/ten-problems/security-config.mjs` owns the
  reviewed custom document meta CSP passed into the Question Group builder and
  the full static-host page/Python-worker header policies for standalone and
  `/practice/` subpath hosting. The previous post-build HTML/JavaScript string
  replacements and generated-CSS patches are removed.
- `scripts/build-learning-example-pages.mjs` atomically assembles the
  content-first Learning Studio index, the original Build an LLM System course
  at `/llm-systems/`, Interview Loop at `/interview-loop/`, and Ten Problems
  at `/practice/`. `app/components/LearnerHeader.tsx` and
  `app/components/LearnerHeader.module.css` carry the family navigation and
  presentation across the React course, module, lesson, checkpoint, project,
  workspace, and capstone routes.
- No Learning Pack, Learning Feed, or Question Group field was added or
  changed. Branding and navigation remain trusted build configuration.
  Canonical content bytes, digest-bound progress identities, and portable
  execution authority are unaffected.
- Every deployed asset remains self-hosted. The revision adds no hosted
  stylesheet, JavaScript service, framework CDN, model API, remote executable
  extension, or implicit learner-time agent call. Existing CSP, same-origin
  static hosting, relative asset URLs, subpath routes, and marker-owned build
  directories remain in force. Supporting hosts can apply `_headers` as
  defense in depth for worker isolation and anti-framing; anti-framing depends
  on those response headers. The combined local preview mirrors the
  Python-worker response CSP during QA. GitHub Pages does not honor `_headers`;
  the generated document meta CSP remains active there and restricts script
  sources, same-origin workers/connections, styles, and other assets.

### What remains intentionally specialized

Interview Loop remains a navigable three-module course with deterministic
quizzes, a flash-card deck, three portable Python practice questions, and one
trusted Python coding-lab exercise. It retains its module rail, reading-focused content,
lesson completion controls, card review flow, host-owned Python contracts, and
same-origin pinned Pyodide runtime.

Ten Problems remains a focused Python workspace with a problem list, contract
copy, editor, public examples and checks, exact-library progress, continue
behavior, and repeated-miss review. Its Python adapter, worker policy,
timeouts, output limits, and same-origin Pyodide assets remain trusted source.

### Concise visual comparison

| Concern | Before | After |
| --- | --- | --- |
| Page shell and header | Interview used an example-local shell; Ten used the standalone player's unrelated shell. | Both use the shared bounded page shell, wordmark treatment, primary navigation, footer, and content-width tokens. |
| Navigation | Course tabs and practice/review links had different markup, labels, and responsive behavior. | Both use content-oriented navigation such as Modules, Practice, Review, and Coding lab, with one mobile-menu interaction and current-page semantics. |
| Controls and feedback | Buttons, forms, progress, results, and empty states were styled independently. | Shared component contracts provide consistent geometry, focus rings, success/failure tones, progress, resume, and empty states. |
| Coding surfaces | The IDE and Question Group editor looked unrelated. | Both use the shared editor frame, toolbar, monospaced treatment, actions, and result language while retaining different workspace layouts and runtimes. |
| Product identity | Ten's primary identity depended on output rewrites; Interview's lived in bespoke shell markup. | Each product supplies explicit trusted build-time configuration; Latent attribution is quiet footer metadata. |
| Mobile and accessibility | Responsive and focus behavior evolved separately. | Shared breakpoints, skip links, visible `:focus-visible`, screen-reader status regions, reduced-motion handling, and menu behavior establish one baseline. |

### Validation and browser evidence for this revision

The historical evidence above belongs to the revisions in which it was
recorded. The following evidence belongs to the shared learner UI revision.

- Course Kit built-package tests passed 55 of 55, including learner UI and
  configured standalone-builder coverage.
- Course Kit's smoke-package check passed an isolated tarball installation and
  CLI smoke test.
- Interview Loop's shared-source/vendor check, local validation, nine focused
  tests, and production build passed. All 13 authored cases also passed real
  Python execution, including mutation and nested-alias checks. Its
  marker-owned artifact contains 28 files and self-hosts Pyodide 314.0.2.
- Ten Problems strict Question Group validation passed with 4 groups,
  10 questions, 39 cases, and zero warnings. Its six tests passed, including
  real CPython reference execution across all 39 cases and configured build
  output. The production artifact contains 21 files.
- The combined local Pages build contains 437 files and the routes `/`,
  `/llm-systems/`, `/interview-loop/`, `/practice/`, and
  `/practice/leeches/`.
- `npm run build:pages-course` passed with 95 rendered routes, 27 verified
  course routes, and 4 verified assets.
- `npm run build:web && npm run test:performance` passed; the largest emitted
  stylesheet is 179.8 KiB against the 180 KiB budget.
- Desktop browser inspection at 1440 × 900 covered Interview Loop module
  navigation and resume, wrong and correct quiz feedback, card reveal/rating
  persistence, Python coding-starter failure, a four-check passing solution,
  and source/progress persistence after reload. It also covered Ten Problems
  problem navigation, Python example and check failure/success, cancellation,
  saved drafts, progress after reload, and removal from repeated-miss
  **Review** after success.
- Compact browser and keyboard inspection at 390 × 844 covered the shared
  menus and collapsible panels, Escape focus restoration, the visible
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

The table above is the concise before/after visual record for this revision.

## Python-first revision integrated with the shared learner UI

- Every learner-visible coding surface now uses Python: the module sketch,
  three declarative Question Group exercises, and the trusted step-four coding
  lab. Function names, `.py` paths, starter code, source guidance, and runtime
  labels were converted together.
- The Learning Pack and Question Group library are version 2.0.0. The trusted
  coding-lab contract is `interview-loop.retry-plan.v3`, preventing saved
  JavaScript drafts from carrying into the Python exercise.
- Portable content declares only a `host-managed` Pyodide 314.0.2 requirement.
  `trusted/python-exercise-runtime.ts` is the reviewed adapter from the shared
  learner application to Python Lab. The marker-owned build bundles that
  adapter and worker, copies the pinned Pyodide assets to the same origin, and
  records their byte counts and SHA-256 digests in `build-report.json`.
- Host-owned checks compare returned values and inspect Python object
  ownership before JSON normalization. They require the input values to equal
  their originals when the call returns and reject nested output lists or
  dictionaries that alias nested inputs. This does not claim to detect a
  transient mutate-then-restore operation.
- The obsolete `site/executor.worker.mjs`,
  `site/invocation-contract.mjs`, `site/runner.worker.mjs`, and
  `test/invocation-contract.test.mjs` JavaScript execution path was removed.
  JavaScript remains trusted application implementation source, not learner
  exercise code.
- The shared Course Kit shell, build-configured family navigation, accessible
  mobile panels, digest-bound module/card state, and content-focused copy are
  retained. The Python migration changes the coding runtime, not the portable
  formats or the shared learner design contract.

Validation evidence for the integrated revision: `npm run validate` passed
strict Learning Pack and Question Group validation with zero warnings and all
9 focused tests. The real-Python suite passed all 13 authored coding cases,
mutation detection, nested-alias rejection, runtime admission, and fail-closed
cleanup. `npm run build` passed and emitted 28 files, including the shared
learner assets and eight recorded same-origin Python runtime assets.

## Mobile learning-suite follow-up — 2026-07-27

This follow-up tested the three published learning products as one mobile
suite, rather than treating responsive CSS as a per-example concern.
`packages/course-kit/src/learner-ui.ts` remains the common token, shell,
navigation, control, progress, feedback, editor, focus, and breakpoint source.
`packages/course-kit/src/question-group-site.ts` now also owns centered,
visible focus transfer after a mobile problem change and separates detailed
keyboard-scrollable results from concise live announcements.

Interview Loop keeps its course-specific module, quiz, flash-card, practice,
and IDE composition in `site/app.mjs` and `site/styles.css`.
`site/focus.mjs` is the reviewed focus/reveal helper used after rerenders:
module and practice navigation close their compact disclosure, reveal the new
heading, scroll it into view, and only then focus it. Repeated-miss filtering
reopens the compact problem panel before returning focus to the checkbox.
The helper and its test are explicit validation inputs in
`tools/validate.mjs`.

The original React course consumes the same family language through these
trusted sources:

- `app/components/LearnerHeader.tsx` and
  `app/components/LearnerHeader.module.css` provide separate, semantically
  truthful desktop navigation and a compact disclosure.
- `app/components/SkipLink.tsx` links to server-rendered `#main-content`
  targets placed after learner navigation; no hydration-time mutation is
  required.
- `app/components/LearnerActionLink.tsx`, `CourseCurriculum.module.css`,
  `CourseResume.module.css`, and `ModuleCheckpoint.module.css` keep contextual
  actions at least 44 pixels high.
- `app/components/PaperLab.module.css` contains the bounded,
  keyboard-scrollable Transformer matrix and narrow-screen lesson treatment.
- `app/components/WorkspaceShell.tsx`,
  `WorkspaceShell.module.css`, and
  `BrowserChatCapstone.module.css` account for the family header at portrait
  and short-landscape breakpoints. The workspace server-renders a readable
  loading state and does not stream the deferred workbench before its styles.
- `scripts/check-performance-budget.mjs` now measures aggregate CSS referenced
  by representative exported course, lesson, IDE, and capstone routes, not
  only the largest individual stylesheet.

No portable format or runtime authority changed. Interview Loop still owns
its digest-bound module/card state and trusted Python IDE contracts; Ten
Problems still owns its Question Group progress and Python worker; the
original course still owns its cumulative project, checkpoints, workspace,
and capstone.

### Mobile visual comparison

| Concern | Before this follow-up | After |
| --- | --- | --- |
| Family navigation | At some compact widths the React course could paint desktop links beside the Menu control; the closed disclosure also disagreed with desktop accessibility semantics before hydration. | Desktop and compact navigation have separate stable markup, and exactly one is visible and exposed at each breakpoint. |
| Focus after navigation | A newly selected Interview module or Ten Problems problem could receive focus above the viewport, with its focus outline clipped. | Selection closes the panel and centers the new heading; repeated-miss focus remains visible inside its reopened panel. |
| Full-height coding | IDE and capstone height rules did not consistently subtract the family header, especially between 651 and 760 pixels or in short landscape. | The workspace and capstone share the 760-pixel/500-pixel-height compact contract and fill the remaining viewport when their content fits. |
| Dense output | Long code, case output, and narrow Transformer tables could make the document feel cramped. | Text wraps within result panels, editors retain readable 16-pixel compact type, and wide tables scroll inside a labelled focused region without document overflow. |

### Validation and express user evidence

- `npm run validate` passed 475 application tests plus every workspace and
  package suite, strict example validation, TypeScript, ESLint, production
  build, boundaries, and performance gates.
- `npm run learning-examples:build` produced the exact 441-file Pages artifact
  with 95 rendered original-course routes and `/`, `/llm-systems/`,
  `/interview-loop/`, `/practice/`, and `/practice/leeches/`.
- Route CSS measured 175.8 KiB for the course, 185.1 KiB for a representative
  lesson, 176.4 KiB for the IDE shell, and 176.5 KiB for the capstone, each
  below the 220 KiB aggregate route ceiling. The IDE, editor, lesson
  experiment, and local Transformer remain deferred.
- In-app Chromium covered 11 combined Pages routes at 320 × 800, 360 × 800,
  390 × 844, 430 × 932, and 844 × 390: 55 route/viewport checks with no
  horizontal document overflow or off-origin assets. A final 390 × 844 sweep
  recorded no console warnings or errors.
- The beginning-learner pass moved from Learning Studio into each product,
  found Continue, opened compact navigation, read a first lesson/problem, and
  understood public examples and saved progress without framework knowledge.
- The advanced pass covered direct Interview module navigation, wrong/correct
  quiz feedback, card rating and reload, Python IDE failure/success and reload,
  repeated-miss filtering, Ten Problems problem navigation, Python example
  and full-check failure/success, automatic continuation, draft/progress
  persistence, repeated-miss entry/removal, keyboard menu Escape restoration,
  skip-link transfer, Transformer matrix scrolling, and original-course
  lesson quiz/card/IDE/capstone states.
- Focused browser measurements confirmed the compact workspace occupies the
  exact remaining viewport (`64 px` family header plus a `780 px` shell in a
  `390 × 844` viewport), and the capstone gate ends at the same viewport
  boundary when its content fits.
- This evidence is Chromium emulation and keyboard inspection, not a physical
  iOS/Android or formal screen-reader certification. Those surfaces remain
  external manual checks.
