# Array Method School

This is the small end of the Latent examples: a dependency-free learning
platform that fits in one screen and covers all four primitives.

- `content/learning-pack.json` owns one lesson, one quiz, and one six-card deck.
- `content/question-groups.json` owns portable method-style practice.
- `trusted/ide-exercises.mjs` owns a reviewed browser IDE exercise and checks.
- `site/` owns the static player and device-local progress.
- `tools/` owns canonical offline validation, deterministic build, and preview.

The first two files are untrusted declarative content. The IDE definition,
worker, UI, and tools are trusted repository source. Read `AGENTS.md` before
asking any coding agent to edit the project.

Both JavaScript learner entrypoints include JSDoc parameter and return types.
The Question Group library is version 1.1.0, so existing versioned progress is
not attached to the changed starter source.

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

Open the printed loopback URL. Complete the lesson quiz, reveal a card, submit
the practice question, and run the IDE checks. Progress stays on this device.
After at least three attempts and two misses, a question appears in the
**Leeches only** view. Leeches are a query over exact-version progress, not a
content type.

## Publish it on GitHub Pages

Create a repository from this directory, push the `main` branch, and select
**GitHub Actions** as the Pages source. The checked-in
`.github/workflows/deploy-pages.yml` validates and builds the platform before
uploading only `dist/`.

No Latent account, database, model provider, or application server is required.
The platform code is Apache-2.0-compatible; the example teaching content is
offered under CC-BY-4.0 as declared in its content files.
