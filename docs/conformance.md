# Clean-room platform conformance

This protocol tests whether Latent's public launch promise works without
maintainer-only knowledge.

## Success bar

A participant starts in an empty directory and uses only the public repository
documentation. Within fifteen minutes, they must produce a distinct branded
learning platform that:

- contains at least one lesson;
- contains at least one flash-card deck;
- contains at least one Question Group;
- contains at least one trusted browser JavaScript or TypeScript IDE exercise;
- passes the generated project's validation command;
- builds deterministic static output; and
- can be served or deployed without a Latent account.

The participant must change the title, tagline, and at least one learning item.
Merely rebuilding the checked-in example is not a conformance pass.

## Public procedure

Use Node.js 22.13 or newer. Do not reuse a prior clone, generated project, or
maintainer-provided build artifact.

```bash
git clone --depth 1 --branch course-kit-v0.2.0 \
  https://github.com/model-systems-labs/latent.git
cd latent
npm ci
npm run create:platform -- ../my-learning-platform \
  --title "My learning platform" \
  --tagline "A concrete promise for its learners"
cd ../my-learning-platform
# Change at least one item using AGENTS.md and GUIDE.md.
npm run validate
npm run build
npm run preview
```

The creation command must finish with a validated project. `npm run preview`
reruns validation, rebuilds the static output, and starts a loopback-only local
server. If port 4173 is occupied, retry with
`npm run preview -- --port 0`; record the printed URL. The participant may stop
it after checking all four surfaces.

## Evidence

Record:

- participant type: `agent` or `developer`;
- participant or run identifier;
- operating system and Node version;
- start and finish timestamps;
- exact commands;
- generated title and topic;
- validation and build results;
- preview or deployed URL;
- problems encountered; and
- whether those problems became documentation, code, or regression-test
  changes.

Agent runs and developer runs are reported separately. An agent persona does
not count as a developer participant. A developer result is complete only when
an actual person performs the procedure and supplies the evidence above.

## Failure classification

| Result | Meaning |
| --- | --- |
| Pass | Distinct platform validated, built, and previewed or deployed within fifteen minutes |
| Product failure | Correctly followed public instructions exposed a generator, validator, build, runtime, or deployment defect |
| Documentation failure | A required step or concept was absent, ambiguous, stale, or ordered incorrectly |
| Environment failure | A documented prerequisite was absent or an external service failed independently of Latent |
| Invalid run | Maintainer-only knowledge, unreleased artifacts, an existing generated project, or falsified participant identity was used |

Repeated product or documentation failures block release until they are fixed
or explicitly removed from the launch promise.

## Recorded v0.2 candidate evidence

Three independent agents completed the public procedure from empty directories
against public release-candidate `main` commit
`6ac657f3fc06c83a2add2ef996f573dd573c266a`. Each customized portable learning
content, validated all four primitives, reproduced deterministic static output,
and checked the built site over loopback HTTP in under four minutes:

| Participant | Topic | Elapsed | Result |
| --- | --- | ---: | --- |
| [agent-field-notes](./conformance-reports/2026-07-25-agent-field-notes.md) | Field observation | 3m 16s | Candidate pass |
| [cleanroom-accessibility](./conformance-reports/2026-07-25-agent-accessibility.md) | Keyboard-friendly interfaces | 3m 36s | Candidate pass |
| [http-cache-lab](./conformance-reports/2026-07-25-agent-http-cache.md) | HTTP cache freshness | 3m 59s | Candidate pass |

The two concurrent runs that found port 4173 occupied both recovered with the
now-documented `--port 0` path. The reports classify this as an environment
collision, not a platform failure.

These runs validate the public candidate workflow, not the exact tagged release
procedure above. Exact-tag agent runs must be recorded after the immutable tag
exists. Human developer evidence also remains pending and is not inferred from
agent runs.
