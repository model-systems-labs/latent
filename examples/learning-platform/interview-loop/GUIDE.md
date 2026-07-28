# Interview Loop Lab

Interview Loop Lab is a 58-minute course with three connected modules:
Behavioral Evidence, Progressive Coding, and a System Design Interview using
webhook delivery as the worked prompt.
Its navigation and feedback belong to the same learner UI family as Ten
Problems, while its lesson, quiz, flash-card, and trusted IDE surfaces remain
course-specific.

- `content/learning-pack.json` owns three navigable modules totaling 58
  minutes, six quizzes, and one fourteen-card retrieval deck.
- `content/question-groups.json` owns three original Python questions in
  two groups: retry deduplication, observation-window aggregation, and
  per-tenant admission.
- `trusted/ide-exercises.mjs` owns one reviewed Python IDE exercise with four
  host-owned checks for bounded webhook retry scheduling.
- `trusted/reference-solutions.mjs` owns read-only reviewed solutions for the
  three practice questions and the coding follow-up.
- `trusted/python-exercise-runtime.ts` owns the reviewed adapter between the
  player, Python Lab, and the host-owned value and ownership checks.
- `site/` owns the specialized course, quiz, card, practice, and IDE rendering;
  exact-digest Learning Pack state; and the trusted
  post-call-input-equality/fresh-output coding contract.
- `tools/` owns canonical offline validation, focused contract tests,
  deterministic build, same-origin Pyodide packaging, preview, and composition
  with the generated shared learner UI.

The first two files are untrusted declarative content. The IDE definition,
Python adapter, worker, state logic, specialized UI, and tools are trusted
repository source. The Learning Pack and type-hinted Question Group library
are both version 2.1.0; the type-hinted IDE uses contract
`interview-loop.retry-plan.v4`. Read `AGENTS.md` before asking any coding agent
to edit the project.

## Shared learner UI

The two examples previously diverged because Interview Loop owned a bespoke
page shell, while Ten Problems used Course Kit's standalone Question Group
player and customized the generated output. Primary navigation, responsive
behavior, control styling, and feedback therefore had different owners.

The current ownership is explicit:

- `packages/course-kit/src/learner-ui.ts` is the reviewed source of truth for
  typography and color tokens, spacing, borders, focus states, responsive
  breakpoints, the global shell, header, primary navigation, content widths,
  buttons, forms, cards, progress, status/results, empty states, editor
  framing, screen-reader utilities, and mobile navigation behavior.
- `packages/course-kit/src/learner-code-editor.ts` is the reviewed,
  framework-neutral CodeMirror primitive. It owns Python/JavaScript parsing,
  syntax highlighting, indentation, run/save shortcuts, accessibility
  attributes, and the palette-aware integrated editor surface.
- `packages/course-kit/src/static-site.ts` composes that foundation with the
  standalone lesson/card player.
- `packages/course-kit/src/question-group-site.ts` composes it with the
  standalone coding-practice player.
- `scripts/generate-learning-platform-learner-ui.mjs` produces
  `tools/vendor/learner-ui.mjs` and
  `tools/vendor/learner-code-editor.js` as drift-checked build inputs for the
  repository-owned example. The latter is copied unchanged from Course Kit's
  reviewed same-origin browser bundle. Neither generated file is a second
  hand-maintained theme.
- `../learning-suite.mjs` provides the persistent Learning Studio header
  identity and sibling destinations. `platform.json` provides Interview
  Loop's explicit product name, contextual navigation labels and hash routes,
  theme, metadata, and footer. `tools/build.mjs` renders the shared header,
  context row, and footer and copies the shared CSS and navigation behavior
  into `dist/`.
- `../ten-problems/site-config.mjs` provides the corresponding Ten Problems UI
  inputs, while `../ten-problems/security-config.mjs` provides its reviewed CSP
  configuration: the custom document meta policy passed to the builder and the
  full static-host page/worker header policies for standalone and `/practice/`
  hosting.

Interview Loop keeps its course navigation, reading, quiz, card, portable
Python practice, and trusted IDE sections in `site/app.mjs` and
`site/styles.css`, but they now share one centered vertical document flow.
Both Interview coding surfaces progressively enhance their fallback
textareas with that same Python editor primitive and the Sage-integrated light
surface.
Ten Problems uses the same one-plane flow for problem navigation, prompt,
editor, actions, and results. The products are related, not identical.

The five reviewed palettes change semantic color and line tint. They no longer
select unrelated grids, rings, stripes, or filled shapes: all products use the
same sparse partial-line atmosphere and scroll crossfade. Sage, Cobalt, Plum,
and Graphite add a short highlight to the existing line rather than a particle
field or another animation. Both coding surfaces render trusted example
solutions as closed native disclosures without modifying drafts or portable
content.

Neither portable format changed for this presentation work. Learning Pack and
Question Group JSON remain declarative, while UI behavior, runtime adapters,
executable checks, and persistence remain trusted source.

## Run it

Run this example from a Latent monorepo checkout with its workspace
dependencies installed; Node 22.13 or newer is required. The canonical Course
Kit validator is checked in as one deterministic generated artifact. The build
uses the installed Course Kit, Python Lab, esbuild, and Pyodide packages, then
copies the pinned runtime and worker into `dist/`; the learner runtime does not
load Python from a CDN.

```bash
npm run validate
npm run preview
```

If port 4173 is already occupied, run `npm run preview -- --port 0` and use the
available loopback URL it prints.

Open the printed loopback URL. Move among the three course modules, complete
their quizzes, retrieve the cards, submit each practice question, and run the
IDE checks. Open an example solution when you need a worked approach; the
disclosure does not submit it or change your saved draft. Progress stays on
this device. Module position, module completion,
quiz answers, and card ratings are namespaced by the exact SHA-256 digest of
the loaded Learning Pack, so changed bytes do not inherit state even if the
package id and version are unchanged.

The host-managed Python runtime checks each case's returned value and, before
normalizing it, verifies that every input equals its original value when the
call returns and that no nested output list or dictionary aliases a nested
input list or dictionary. It does not claim to detect a mutate-then-restore
sequence that leaves the final input value unchanged. Python Lab provides
containment and cancellation for this trusted browser integration; it is not a
hostile-code security sandbox.

After at least three attempts and two misses, a question appears in the
**Review repeated misses** view. Question progress is separately bound to the
exact Question Group library digest and submitted-source digest; repeated-miss
review is a progress query, not a content type.

## Suggested practice sequence

1. Build one factual behavioral story record and answer the six follow-up
   lenses without reading a script.
2. Solve the three portable questions aloud before running their visible
   checks.
3. Walk the webhook-delivery system through requirements, constraints,
   interfaces and data flow, failure modes, scaling, observability, and
   tradeoffs during the 24-minute module, then schedule the separate
   45-minute take-away mock.
4. Finish the trusted retry-scheduling exercise and explain which architecture
   assumptions its contract encodes.

## Publish it on GitHub Pages

Interview Loop is trusted repository source: its build consumes the shared
suite catalog, Course Kit UI, Python Lab worker, and pinned local Pyodide
package from the Latent monorepo. Build and publish it through the combined
Pages layout:

```bash
npm run learning-examples:preview
```

It serves the same static artifacts as the production suite:

- `/` — the content-first Learning Studio index
- `/llm-systems/` — the original 14-lesson Build an LLM System course
- `/interview-loop/` — Interview Loop Lab
- `/practice/` — Ten Problems
- `/practice/leeches/` — repeated-miss review

`../learning-suite.mjs` is the trusted build-time directory for these three
independent artifacts. Learning Studio is not an account, enrollment list, or
aggregate progress dashboard; each experience keeps separate exact-content-
bound progress on the device.

The root
`.github/workflows/deploy-interview-loop-pages.yml` builds that combined
artifact atomically for GitHub Pages. Local and live browser evidence for
merge commit `778994638801b2599c9691c98d0d7183b5a97463` is recorded in
`AUTHORING.md`.
GitHub Pages does not honor Ten Problems' generated `_headers` file. Its
builder-injected document meta CSP remains active there and restricts script
sources, workers and connections to same-origin, plus styles and other assets.
The fuller page/worker headers remain defense in depth on supporting static
hosts; anti-framing depends on those response headers. The combined local
preview mirrors the Python-worker response CSP during QA.

No Latent account, database, model provider, or application server is
required. Application code is Apache-2.0-compatible; the original teaching and
practice content is offered under CC-BY-4.0 as declared in its content files.
