# Build a learning platform in five minutes

Latent's smallest complete platform is a dependency-free static site with all
four v0.2 learning primitives:

- a lesson with a knowledge check;
- a flash-card deck;
- a Question Group for programming practice; and
- a trusted browser JavaScript IDE exercise.

The generated project belongs to you. It runs locally, deploys to any static
host, and does not require a Latent account, model provider, database, or
application server.

## Create and preview

Install Node.js 22.13 or newer, then prepare one Latent checkout:

```bash
git clone --depth 1 --branch course-kit-v0.2.0 \
  https://github.com/model-systems-labs/latent.git
cd latent
npm ci
```

Run one creation command:

```bash
npm run create:platform -- ../my-school \
  --title "My School" \
  --tagline "Learn one useful idea, retrieve it, and put it to work." \
  --accent "#7dd3fc" \
  --preview
```

The command copies the tiny template into a new directory, applies the brand,
runs the canonical strict Learning Pack and Question Group validators, runs
the complete platform validator, builds deterministic static output, and
starts the exact `dist/` artifact on a loopback URL. Press Control-C to stop
the preview. If port 4173 is already occupied, run
`npm run preview -- --port 0` inside the generated project to select an
available loopback port.

The target must be new or empty. Latent stages the project beside the target
and renames it into place only after validation succeeds, so a failed scaffold
does not leave a partial platform behind.

## Understand the generated project

```text
content/
  learning-pack.json       lesson, quiz, and flash cards
  question-groups.json     portable programming practice
trusted/
  ide-exercises.mjs        reviewed IDE files and checks
site/                      static player and browser worker
tools/                     validation, build, and preview
platform.json              brand and source locations
AGENTS.md                  editable-layer rules
GUIDE.md                   local and GitHub Pages workflow
```

`content/` is portable, untrusted declarative data. `trusted/`, `site/`, and
`tools/` are reviewed executable source. A hosted JSON file cannot select a
worker, import a package, or grant itself a runtime capability.

The tiny platform's browser worker is a bounded teaching runtime, not a
hostile-code security sandbox. The full LLM Learning reference application
shows the hardened Browser Lab path for reviewed JavaScript and TypeScript
exercise extensions.

## Ask an agent to customize it

Give any capable file-editing coding agent the generated `AGENTS.md` and a
concrete learning outcome. For example:

```text
Turn this starter into a short course on SQL joins. Keep the four existing
learning primitives, cite primary PostgreSQL documentation, edit only the
portable content layer unless trusted behavior must change, and run every
validation command in AGENTS.md before handing it back.
```

Latent also ships focused, model-neutral workflows in `skills/` for:

- authoring a complete platform, course, flash-card deck, Question Group, or
  IDE exercise;
- reviewing learning design; and
- publishing the exact validated static artifact.

Every workflow names the layer it may edit and the validation evidence it must
return.

## Validate and publish

Inside the generated project:

```bash
npm run validate
npm run build
npm run preview
```

The checked-in GitHub Pages workflow validates and builds on every `main`
push, then uploads only `dist/`. Create a repository from the generated
directory, push it, and select **GitHub Actions** as the Pages source.

The complete tiny reference lives at
[`examples/learning-platform/javascript-array-methods`](../examples/learning-platform/javascript-array-methods).
The full LLM Learning reference application remains in this repository.

To contribute a generally useful lesson, deck, Question Group, workflow, or
framework improvement upstream, follow
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Self-hosting never depends on upstream
acceptance.
