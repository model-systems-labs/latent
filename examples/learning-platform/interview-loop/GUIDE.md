# Interview Loop Lab

This small, dependency-free Latent platform uses all four learning primitives
for one connected preparation loop.

- `content/learning-pack.json` owns three navigable modules totaling 58
  minutes, six quizzes, and one fourteen-card retrieval deck.
- `content/question-groups.json` owns three original JavaScript questions in
  two groups: retry deduplication, observation-window aggregation, and
  per-tenant admission.
- `trusted/ide-exercises.mjs` owns one reviewed browser IDE exercise with four
  host-owned checks for bounded webhook retry scheduling.
- `site/` owns the static player, exact-digest Learning Pack state, and the
  trusted read-only-input/fresh-output coding contract.
- `tools/` owns canonical offline validation, focused contract tests,
  deterministic build, and preview.

The first two files are untrusted declarative content. The IDE definition,
worker, UI, and tools are trusted repository source. Read `AGENTS.md` before
asking any coding agent to edit the project.

## Run it

Node 22.13 or newer is the only prerequisite. The canonical Course Kit
validator and its required Zod code are checked in as one deterministic
generated artifact, so validation and Pages builds do not install packages or
use the network.

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

Create a repository from this directory, push the `main` branch, and select
**GitHub Actions** as the Pages source. The checked-in
`.github/workflows/deploy-pages.yml` validates and builds the platform before
uploading only `dist/`.

The deterministic build contains 21 files, including its two hidden marker
files. No Latent account, database, model provider, or application server is
required. The platform code is Apache-2.0-compatible; the original teaching
and practice content is offered under CC-BY-4.0 as declared in its content
files.
