# Interview Loop Lab

This small Latent platform uses all four learning primitives for one connected
preparation loop. The platform stays behind the practice: every
learner-visible coding surface uses Python, including the lesson sketch, three
portable questions, and the trusted IDE exercise.

- `content/learning-pack.json` owns three navigable modules totaling 58
  minutes, six quizzes, and one fourteen-card retrieval deck.
- `content/question-groups.json` owns three original Python questions in
  two groups: retry deduplication, observation-window aggregation, and
  per-tenant admission.
- `trusted/ide-exercises.mjs` owns one reviewed Python IDE exercise with four
  host-owned checks for bounded webhook retry scheduling.
- `trusted/python-exercise-runtime.ts` owns the reviewed adapter between the
  player, Python Lab, and the host-owned value and ownership checks.
- `site/` owns the static player, exact-digest Learning Pack state, and the
  trusted post-call-input-equality/fresh-output coding contract.
- `tools/` owns canonical offline validation, focused contract tests,
  deterministic build, same-origin Pyodide packaging, and preview.

The first two files are untrusted declarative content. The IDE definition,
Python adapter, worker, UI, and tools are trusted repository source. The
Learning Pack and Question Group library are both version 2.0.0; the IDE uses
contract `interview-loop.retry-plan.v3`. Read `AGENTS.md` before asking any
coding agent to edit the project.

## Run it

Run this example from a Latent monorepo checkout with its workspace
dependencies installed; Node 22.13 or newer is required. The build uses the
installed Course Kit, Python Lab, esbuild, and Pyodide packages. It copies
Pyodide 314.0.2 and the Python worker into `dist/`, so the built course can run
learner Python offline without fetching a runtime from a CDN.

```bash
npm run validate
npm run preview
```

If port 4173 is already occupied, run `npm run preview -- --port 0` and use the
available loopback URL it prints.

Open the printed loopback URL. Move among the three course modules, complete
their quizzes, retrieve the cards, submit each practice question, and run the
IDE checks. Progress stays on this device. Module position, module completion,
quiz answers, and card ratings are namespaced by the exact SHA-256 digest of
the loaded Learning Pack, so changed bytes do not inherit state even if the
package id and version are unchanged.

The host-managed Python runtime checks each case's returned value and, before
normalizing that value, verifies that every input equals its original value
when the call returns and that no nested output list or dictionary aliases a
nested input list or dictionary. It does not claim to detect a
mutate-then-restore sequence that leaves the final input value unchanged.
Python Lab provides containment and cancellation for this trusted browser
integration; it is not a hostile-code security sandbox.

After at least three attempts and two misses, a question appears in the
**Leeches only** view. Question progress is separately bound to the exact
Question Group library digest and submitted-source digest; leeches are a
progress query, not a content type.

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

The Latent repository's root Pages workflow validates and builds this course,
then publishes it at `/latent/interview-loop/` alongside the separate
`/latent/practice/` problem site. To host the course elsewhere, build it from
a Latent monorepo checkout and upload only this example's generated `dist/`
directory.

The deterministic build contains 26 files, including its two hidden marker
files and the same-origin Python runtime assets. No Latent account, database,
model provider, or application server is required after the static artifact
is built. The platform code is Apache-2.0-compatible; the original teaching
and practice content is offered under CC-BY-4.0 as declared in its content
files.
