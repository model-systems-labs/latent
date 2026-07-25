# Latent conformance report: Accessible Web School

- Participant type: `agent`
- Participant or run identifier: `cleanroom-accessibility-20260725T203503Z-r2263K`
- Operating system: macOS 26.2, Darwin 25.2.0 arm64
- Node version: `v26.0.0`
- Started: `2026-07-25T20:35:03Z`
- Finished: `2026-07-25T20:38:39Z`
- Elapsed: `216 seconds` (`3m 36s`)
- Public source commit: `6ac657f3fc06c83a2add2ef996f573dd573c266a`
- Generated platform title: Accessible Web School
- Generated topic: Keyboard-friendly interfaces
- Preview URL: `http://127.0.0.1:64287/` (temporary loopback URL)

The agent used a new temporary directory and shallow public clone. It did not
inspect a maintainer checkout, push, or deploy.

## Commands

```text
git clone --depth 1 https://github.com/model-systems-labs/latent.git repo
cd repo
npm ci
npm run create:platform -- ../accessible-web-school \
  --title "Accessible Web School" \
  --tagline "Build keyboard-friendly interfaces that work without a mouse." \
  --accent "#2563eb"
cd ../accessible-web-school
# Edited only content/learning-pack.json using generated AGENTS.md and GUIDE.md.
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
curl --fail --silent --show-error http://127.0.0.1:49268/ > /dev/null
curl --fail --silent --show-error http://127.0.0.1:49268/content/learning-pack.json > /dev/null
curl --fail --silent --show-error http://127.0.0.1:49268/content/question-groups.json > /dev/null
```

All three probes returned HTTP 200. This recapture does not change the
participant identity or elevate the candidate run to tagged-release evidence.

## Results

- Creation: Pass; generator reported all four primitives.
- Validation: Pass after the validator correctly rejected one unassessed
  objective and the agent added a matching retrieval card.
- Static build: Pass; two builds produced digest
  `d17822a1c5587453c3e4e100bfc29f4ed4e4c7b5c62359fc6ee0adebf0692218`.
- Lesson: HTTP 200; customized as “Start with native keyboard behavior.”
- Flash-card deck: HTTP 200; 6 customized keyboard and JavaScript cards.
- Question Group: HTTP 200; generated group and practice question remained
  present.
- Browser IDE exercise: HTTP 200; generated host-owned exercise remained
  present.
- Preview: Pass; all four surface markers and backing assets were verified.

## Problems and fixes

- Participant authoring error: strict validation rejected an objective that was
  not assessed. The generated content was corrected and validation passed.
- Environment collision: concurrent port 4173 use produced `EADDRINUSE`.
  `npm run preview -- --port 0` selected an available loopback port.
- `npm ci` dependency advisories did not block the conformance path.

The repeated port-collision recovery is now documented and protected by a
repository test.

## Verdict

**Candidate pass — agent evidence, not exact tagged-release conformance.**

No human developer performed or attested to this run. It must not be counted as
developer evidence. The run used the public candidate commit before
`course-kit-v0.2.0` existed.
