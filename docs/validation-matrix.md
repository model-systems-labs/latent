# Validation matrix

This file records the difference between an implemented fallback, an automated
contract, and behavior actually observed in a browser or on a device. A blank or
pending cell is not a compatibility claim.

## Automated release gates

| Gate | Command | Required result |
| --- | --- | --- |
| Package boundaries | `npm run boundaries` | no cross-layer violations |
| Types | `npm run typecheck` | no TypeScript errors |
| Lint | `npm run lint` | no lint errors or warnings |
| Unit and integration contracts | `npm test` | every workspace and app test passes |
| Production dependencies | `npm audit --omit=dev` | zero known vulnerabilities, or only a reviewed and unexpired entry in `docs/security-exceptions.md` |
| Payload ceilings | `npm run test:performance` | all emitted assets stay under the checked budgets |

The payload gate also proves that the IDE and local Transformer remain deferred
build entries. It intentionally allows the large compiler and inference WASM
files only behind those learner-triggered boundaries.

## Manual browser and device matrix

| Environment | Viewport / input | Required paths | Status | Evidence |
| --- | --- | --- | --- | --- |
| In-app Chromium, desktop | 1440 × 900, mouse + keyboard | first run, lesson failure/recovery, checkpoint, IDE, capstone | verified 2026-07-13 | trained the 1,267-parameter first-run model; rejected and repaired a plausible RNN error; ran a failing module checkpoint with a file-specific repair link; exercised IDE tests, recovery, backup, portfolio gating, capstone admission, and sources |
| In-app Chromium, mobile | 390 × 844, touch emulation | IDE tabs, editor, tests, output, history, export | verified 2026-07-13 | Files, Code, Tests, and Output expose one pane at a time; file selection moves to Code; history confirmation, backup, and export controls are at least 44 px |
| In-app Chromium, compact | 320 × 700, touch emulation | navigation, lesson, IDE tabs, overflow | verified 2026-07-13 | four 80 px IDE tabs in a 320 px viewport, 48 px tab height, no horizontal document overflow, and 44 px export/history controls |
| Safari on macOS | current stable, keyboard | worker, IndexedDB, WASM fallback, SSE cancellation | pending external device | — |
| Firefox on desktop | current stable, keyboard | worker, IndexedDB, WASM fallback, SSE cancellation | pending external device | — |
| iOS Safari | current stable, touch + software keyboard | save/reload, IDE editing, interruption recovery | pending external device | — |
| Android Chrome | current stable, touch + software keyboard | save/reload, IDE editing, interruption recovery | pending external device | — |

## Failure and recovery cases

Each supported environment must exercise these cases before it is marked
verified:

- dismiss or interrupt model training without corrupting the last artifact;
- reload after an edit and recover the same file and test state;
- fail one cell, read actionable feedback, fix it, and pass that exact source;
- restore an immutable file revision through the two-step confirmation;
- run a module checkpoint against the currently saved project;
- cancel an SSE response and reject late events;
- export, extract, and inspect the portable portfolio project;
- use reduced motion and keyboard focus without losing visible state.

Real Safari, Firefox, iOS, Android, assistive-technology, and physical-keyboard
results must be recorded by a human on those surfaces. Chromium emulation does
not substitute for them.

## Current release evidence — 2026-07-13

- `npm run validate` passed package-boundary checks, TypeScript, ESLint, every
  workspace suite, 117 application tests, the production build, and all payload
  budgets.
- `npm audit --omit=dev` and `npm audit` both reported zero vulnerabilities.
- The completed portfolio was materialized into a clean temporary directory,
  installed from its own `package.json`, and built with Vite 8.1.4. The output
  was a 214.61 KiB JavaScript entry with no missing imports or exports.
- An unfinished project cannot present itself as a runnable portfolio. The IDE
  explains that all fourteen lessons, all thirty-nine host-owned tests, and a
  passing full build are required; Backup remains available throughout.
- The progress backup downloaded and parsed as a versioned portable snapshot
  containing the project, source files, immutable revisions, receipts, builds,
  checkpoints, lesson progress, and conversations.

## Open-source release evidence — 2026-07-24

- Cloudflare's Vite integration, Workers types, and Wrangler were advanced to
  their compatible current lines (`1.47.0`, `5.20260724.1`, and `4.114.0`).
- `npm audit --omit=dev` reports three high entries that all resolve to the one
  Sharp/libvips advisory recorded in `docs/security-exceptions.md`. No
  compatible upstream resolution exists yet; the exception expires on
  2026-08-31 and forbids adding untrusted server-side image processing.
- `npm audit` reports 4 moderate and 12 high dependency entries. Three high
  entries are the accepted production Sharp advisory above; the other nine
  high entries all propagate one `brace-expansion` advisory through the ESLint
  toolchain. The four moderate entries are development-tool findings. The
  development-only entries do not ship in Course Kit or the deployed
  application and remain tracked for a compatible upstream resolution.

## Remaining manual recovery evidence

| Case | Current evidence |
| --- | --- |
| interrupt first-run model training | pending manual interruption |
| reload after a saved edit | covered by persistence contracts; pending fresh-browser observation |
| fail, diagnose, repair, and pass one lesson cell | verified in Character RNNs |
| restore an immutable revision | two-step confirmation verified; final destructive restore intentionally not completed during QA |
| run a checkpoint against saved source | verified with a failing causal-mask repair path |
| cancel SSE and reject late events | automated contracts pass; pending browser observation |
| export and build the portable project | verified with clean install and Vite build |
| reduced motion, keyboard, and assistive technology | pending human verification |

## Learning-suite mobile evidence — 2026-07-27

The production Pages artifact for Learning Studio, LLM Systems, Interview Loop,
and Ten Problems was inspected in the in-app Chromium browser at 320 × 800,
360 × 800, 390 × 844, 430 × 932, and 844 × 390. Eleven representative routes
at each viewport produced 55 route/viewport checks with no horizontal document
overflow or off-origin assets; the final 390 × 844 route sweep recorded no
console warnings or errors.

The beginner flow covered product choice, compact navigation, Continue,
reading a first lesson/problem, public examples, and saved progress. The
advanced flow covered direct module/problem navigation, visible keyboard
focus, wrong/correct quiz states, card reveal/rating persistence, Python
example/check failure and success, source/progress reload, repeated-miss
entry/removal, Transformer matrix keyboard scrolling, IDE viewport sizing,
capstone sizing, and skip-link transfer past family navigation.

The exact 441-file Pages build rendered 95 original-course routes. Aggregate
route CSS was 175.8 KiB for the course, 185.1 KiB for the representative
lesson, 176.4 KiB for the IDE shell, and 176.5 KiB for the capstone against
220 KiB per-route ceilings; all intended deferred runtime boundaries remained
deferred. `npm run validate` passed 475 application tests plus every package,
workspace, strict example, type, lint, build, boundary, and performance gate.

This evidence is Chromium emulation and keyboard inspection. It does not mark
iOS Safari, Android Chrome, physical software keyboards, or a formal
screen-reader audit as verified.

## Learner UI v2 local evidence — 2026-07-27

This pass replaced the suite's parallel presentation layers with the
opinionated Course Kit learner UI v2 foundation. The latest local combined
Pages build contains 441 files and exposes `/`, `/llm-systems/`,
`/interview-loop/`, `/practice/`, and `/practice/leeches/`. The React course
export prerendered 96 routes and verified 95 rendered course routes, 27
required routes, and 4 assets.

Automated evidence completed for this revision:

- Course Kit built successfully and all 57 package tests passed.
- The 70 focused application regression tests passed.
- Interview Loop strict validation passed with all 13 focused tests and all
  authored Python cases. Ten Problems strict validation passed with 4 groups,
  10 questions, 39 cases, and zero warnings; all 6 example tests passed.
- `npm run open-learning:validate`, `npm run open-learning:schema`, and
  `npm run open-learning:generate` passed.
- TypeScript (`npx tsc --noEmit`), ESLint, the production course export, and
  the combined learning-suite build passed.

In-app Chromium at 1440 × 900 verified the one-header presentation and
product-appropriate layouts for Learning Studio, the original LLM course,
Interview Loop, and Ten Problems. The beginning-learner flow covered product
choice, module/problem navigation, Continue, public examples, and saved
progress. The advanced flow covered:

- Interview module navigation and resume after reload, wrong/correct quiz
  feedback, flash-card reveal/rating persistence, and Python IDE failure then
  four-check success.
- Ten Problems example failure/success, full-check failure/success,
  five-of-ten solved progress after reload, repeated-miss appearance, and
  removal from Review after a passing solution.
- Keyboard opening and Escape focus restoration for **Explore**, with the
  shared visible three-pixel focus indicator.

At 390 × 844, Interview, Ten Problems, the original course, and a
representative original-course lesson fit without horizontal document
overflow. The compact header exposes product identity plus one **Explore**
disclosure; local navigation moves into that disclosure instead of creating a
second header. Ten Problems retains its stacked practice workspace and
Interview retains its collapsible module navigation.

This is local Chromium emulation and keyboard inspection, not physical-device
or formal screen-reader certification. The combined local route sweep recorded
zero browser-console warnings or errors. The full `npm run validate` gate
passed with 606 tests and zero failures.

PR `#36` was squash-merged as
`c9e86158a6b56882d098691d416d1c6001b7d698`. GitHub Actions Validate run
`30277729862` and Deploy Learning Examples run `30277729464` completed
successfully. Live Chromium checks at 1440 × 900 and 390 × 844 verified
`/latent/`, `/latent/llm-systems/`, `/latent/interview-loop/`,
`/latent/practice/`, and `/latent/practice/leeches/`: every product exposed
one global learner header, loaded its shared assets from the Pages origin,
fit without horizontal overflow, and recorded zero browser-console warnings
or errors. Live Ten Problems execution produced actionable expected/received
failure feedback, then passed the public example and all four published
checks; solved progress advanced from two to three problems and remained
three after reload, with **Continue** moving to the next unfinished problem.
The live Interview route restored its digest-bound one-of-three module resume,
and the original course loaded its generated shared CSS and JavaScript through
the `/latent/llm-systems/` base path. Keyboard focus used the shared visible
three-pixel indicator.

## Ethereal one-plane learner UI evidence — 2026-07-27

This evidence supersedes the local learner-UI counts above. Earlier PR and live
run identifiers remain historical records for their published revisions.

- Course Kit passed 64 tests. Interview strict validation and 16 focused tests
  covered 3 lessons, 14 cards, 3 practice questions, 1 IDE exercise, and all
  13 authored Python cases. Ten Problems strict validation and 6 focused tests
  covered 4 groups, 10 questions, 39 cases, 10 public examples, and 29 complete
  checks.
- Open Learning validation, schema generation, and committed-site generation
  passed without changing the portable contracts. The course production build
  stayed within CSS and deferred-runtime budgets. The combined Pages artifact
  contains 444 files.
- The final root `npm run validate` gate passed package builds/tests,
  boundaries, TypeScript, ESLint, the 480-test application suite, performance
  budgets, and both strict example validations.
- Desktop Chromium at 1280 × 720 covered `/`, `/llm-systems/`,
  `/interview-loop/`, `/practice/`, `/practice/leeches/`, and every
  `/latent/` equivalent. Mobile Chromium at 390 × 844 covered the same product
  routes. All checked routes had one global header, a visible H1, same-origin
  assets, no horizontal overflow, and zero console warnings or errors.
- Interview checks covered module navigation/resume, wrong and correct quiz
  states, card reveal/rating persistence, portable practice and IDE states,
  and a trusted example solution that does not replace a draft or update
  progress.
- Ten Problems checks covered problem switching and chooser collapse, public
  example failure/success, complete-check failure/success, progress after
  reload, repeated-miss appearance/removal, and the accessible empty Review
  state.
- The header regression was exercised directly: clicking **Learning Studio**
  from LLM Systems preserved the identity, **Courses and practice** metadata,
  global destination order, and header height. Only the product-local context
  row was removed on the Studio index.
- Paper reported zero glint strength. Sage and Cobalt reported the reviewed
  nonzero strength, and scroll evidence showed the intro line fading out while
  a trace and its inherited highlight faded in.
- Keyboard checks covered the skip target, compact-menu Escape restoration,
  synchronized current-page state, focusable code/reference regions, 53-pixel
  context-navigation targets, and an unclipped shared three-pixel focus
  indicator.

This is local Chromium emulation and keyboard inspection, not physical-device
or formal screen-reader certification. Live Pages verification for this
revision belongs to the release handoff after deployment.

## Editable coding-flow polish — 2026-07-28

This local checkpoint tightened the existing shared learner foundation without
changing the portable Learning Pack or Question Group contracts. The reviewed
`packages/course-kit/src/learner-code-editor.ts` source now accepts a trusted
`runModes` configuration so each host exposes only the run/check shortcuts it
actually supports. All editable course and practice code continues to use that
same CodeMirror primitive, including Python syntax highlighting, Tab and
Shift+Tab indentation, and Escape-then-Tab exit behavior. The shared
`packages/course-kit/src/learner-ui.ts` and
`packages/course-kit/src/question-group-site.ts` controllers now invalidate
out-of-date example, check, and custom-input feedback when source changes
instead of leaving a result that appears to describe a newer draft.
The editor also consumes the other family run chord when a host supports only
one mode. For example, Command/Control+Shift+Enter in a check-only lesson or
IDE now leaves the source untouched instead of falling through to CodeMirror
as an accidental newline; the advertised Command/Control+Enter check still
runs normally.

The earlier standalone post-build string and styling patch architecture remains
removed. React, Interview Loop, and the standalone Question Group player
consume the reviewed learner UI and editor source through deterministic,
same-origin build artifacts. Example solutions are trusted application source,
open separately, and do not overwrite the learner's saved draft. What remains
intentionally specialized is product structure: LLM Systems keeps its lesson
and intentionally dark project workspace; Interview Loop keeps modules,
quizzes, cards, practice, and its Python coding lab; Ten Problems keeps its
focused problem chooser, editable public inputs, Python checks, and
repeated-miss Review.

Targeted automated evidence for this checkpoint:

- Course Kit: 76 tests passed.
- LLM Systems focused regressions: 48 tests passed.
- Interview Loop focused regressions: 22 tests passed, with strict authored
  content validation green.
- Ten Problems: 9 tests passed; strict Question Group validation remained green
  for 4 groups, 10 questions, and 39 declarative cases.
- The combined production Pages build completed successfully and produced 446
  files with its strict example, subpath, and performance checks green.

Local in-app Chromium flows covered beginning, advanced, keyboard-oriented, and
mobile learners at 1440 × 900 and 390 × 844. The exercised routes were `/`,
`/llm-systems/`, `/interview-loop/`, `/practice/`, `/practice/leeches/`, and
their `/latent/` equivalents. The flows included LLM lesson/practice/project
editing; Interview module, quiz, card, practice, IDE, and resume states; and Ten
Problems example/check failure and success, custom public input, draft reload,
progress, and repeated-miss removal. The route sweeps found one stable global
header, no horizontal document overflow, same-origin subpath assets, and no
browser-console errors. This is local Chromium evidence only; final repository
validation and live Pages verification are intentionally not claimed by this
checkpoint.

Two additional full passes on fresh local origins found no new P0, P1, or
meaningful P2 issues after the final fixes. Those fixes gave the narrow LLM
practice search field its own 44-pixel-tall row above the two filters, exposed
the dark project workspace identity as a level-one screen-reader heading
without adding another visual header, and verified the unsupported-shortcut
guard in both the LLM lesson editor and Interview IDE. The second pass repeated
desktop and mobile route sweeps, failure/success checks, draft-preserving
solutions, custom Python inputs, reload persistence, repeated-miss
appearance/removal, compact-menu Escape restoration, focus outlines, and
editor Tab/Shift+Tab behavior with zero page overflow or console errors.

The final repository gate then passed Open Learning validation/schema/public
generation, all 76 Course Kit tests, all 480 application tests, Interview
strict validation plus 22 focused tests, Ten Problems strict validation plus 9
tests, and the production learning-examples build. The final Pages artifact
contains 446 files; 96 LLM routes prerendered, 95 were rewritten for the Pages
subpath, all performance budgets passed, and `git diff --check` was clean.
Live Pages verification remains a release step after merge.
