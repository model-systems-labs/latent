# Latent conformance report: HTTP Cache Lab

- Participant type: `agent`
- Participant or run identifier: `http-cache-lab-zA0odX-20260725T203522Z`
- Operating system: macOS 26.2, Darwin 25.2.0 arm64
- Node version: `v26.0.0`
- Started: `2026-07-25T20:35:22Z`
- Finished: `2026-07-25T20:39:21Z`
- Elapsed: `239 seconds` (`3m 59s`)
- Public source commit: `6ac657f3fc06c83a2add2ef996f573dd573c266a`
- Generated platform title: HTTP Cache Lab
- Generated topic: HTTP cache freshness and revalidation
- Preview URL: `http://127.0.0.1:64302/` (temporary loopback URL)

The agent used a new temporary directory and shallow public clone at the exact
public commit. It did not inspect a maintainer checkout, push, or deploy.

## Commands

```text
git clone --filter=blob:none --no-checkout \
  https://github.com/model-systems-labs/latent.git latent
git -C latent fetch --depth 1 origin \
  6ac657f3fc06c83a2add2ef996f573dd573c266a
git -C latent checkout --detach \
  6ac657f3fc06c83a2add2ef996f573dd573c266a
cd latent
npm ci
npm run create:platform -- ../http-cache-lab \
  --title "HTTP Cache Lab" \
  --tagline "Learn when cached responses are fresh, stale, or ready to revalidate." \
  --accent "#38bdf8"
cd ../http-cache-lab
# Edited content/learning-pack.json and content/question-groups.json
# using only generated AGENTS.md and GUIDE.md.
npm run validate
npm run build
npm run build
npm run preview
npm run preview -- --port 0
```

## Post-run route evidence

The maintainer restarted the unchanged generated artifact with an ephemeral
port and recorded the HTTP probes that had been summarized but not transcribed
in the initial agent report:

```text
npm run preview -- --port 0
curl --fail --silent --show-error http://127.0.0.1:49291/ > /dev/null
curl --fail --silent --show-error http://127.0.0.1:49291/content/learning-pack.json > /dev/null
curl --fail --silent --show-error http://127.0.0.1:49291/content/question-groups.json > /dev/null
```

All three probes returned HTTP 200. This recapture does not change the
participant identity or elevate the candidate run to tagged-release evidence.

## Results

- Creation: Pass; generator reported all four primitives.
- Validation: Pass; 1 lesson, 1 deck, 6 cards, 1 Question Group, 1 practice
  question, and 1 IDE exercise.
- Static build: Pass; two builds produced digest
  `bccbe29713b90b1434280fc4e73e3e45c8e211d49fa02959b5a90e45a3656646`.
- Lesson: HTTP 200; customized for freshness lifetime and revalidation.
- Flash-card deck: HTTP 200; all 6 cards cover cache freshness.
- Question Group: HTTP 200; customized as `normalizeDirectives`.
- Browser IDE exercise: HTTP 200; generated host-owned exercise remained
  present.
- Preview: Pass; all four surface markers and backing assets were verified.

## Problems and fixes

- Environment collision: concurrent port 4173 use produced `EADDRINUSE`.
  `npm run preview -- --port 0` selected an available loopback port.
- An agent-side shell probe used zsh-reserved variable names; renaming those
  variables fixed the probe without a platform change.
- `npm ci` dependency advisories did not block the conformance path.

The repeated port-collision recovery is now documented and protected by a
repository test.

## Verdict

**Candidate pass — agent evidence, not exact tagged-release conformance.**

No human developer performed or attested to this run. It must not be counted as
developer evidence. The run used the public candidate commit before
`course-kit-v0.2.0` existed.
