# Latent conformance report: Field Notes School

- Participant type: `agent`
- Participant or run identifier: `agent-field-notes-20260725T203455Z`
- Operating system: macOS 26.2, Darwin 25.2.0 arm64
- Node version: `v26.0.0`
- Started: `2026-07-25T20:34:55Z`
- Finished: `2026-07-25T20:38:11Z`
- Elapsed: `196 seconds` (`3m 16s`)
- Public source commit: `6ac657f3fc06c83a2add2ef996f573dd573c266a`
- Generated platform title: Field Notes School
- Generated topic: Cleaning and summarizing field-observation records
- Preview URL: `http://127.0.0.1:4173/` (temporary loopback URL)

The agent used a new temporary directory and shallow public clone. It did not
inspect a maintainer checkout, push, or deploy.

## Commands

```text
git clone --depth 1 --branch main https://github.com/model-systems-labs/latent.git repo
cd repo
npm ci
npm run create:platform -- ../field-notes-school \
  --title "Field Notes School" \
  --tagline "Observe carefully, record clearly, and turn field evidence into useful insight." \
  --accent "#4f7942"
cd ../field-notes-school
# Edited content/learning-pack.json and content/question-groups.json
# using only generated AGENTS.md and GUIDE.md.
npm run validate
npm run build
npm run preview
```

## Post-run route evidence

The maintainer restarted the unchanged generated artifact with an ephemeral
port and recorded the HTTP probes that had been summarized but not transcribed
in the initial agent report:

```text
npm run preview -- --port 0
curl --fail --silent --show-error http://127.0.0.1:49231/ > /dev/null
curl --fail --silent --show-error http://127.0.0.1:49231/content/learning-pack.json > /dev/null
curl --fail --silent --show-error http://127.0.0.1:49231/content/question-groups.json > /dev/null
```

All three probes returned HTTP 200. This recapture does not change the
participant identity or elevate the candidate run to tagged-release evidence.

## Results

- Creation: Pass; generator reported all four primitives.
- Validation: Pass; 1 lesson, 1 deck, 6 cards, 1 Question Group, 1 practice
  question, and 1 IDE exercise.
- Static build: Pass; two builds produced digest
  `41c25bef02e6bb9b2948c2f761d8780a12d8ac9625d2aca8e788b1a3b84ffbb0`.
- Lesson: HTTP 200; customized as “Shape field notes into evidence.”
- Flash-card deck: HTTP 200; customized field-observation retrieval card.
- Question Group: HTTP 200; customized as “Normalize observation labels.”
- Browser IDE exercise: HTTP 200; generated host-owned exercise remained
  present.
- Preview: Pass on loopback; all four surface markers and backing assets were
  verified.

## Problems and fixes

No command failed and no recovery was required. `npm ci` reported dependency
advisories without blocking installation or the conformance path.

## Verdict

**Candidate pass — agent evidence, not exact tagged-release conformance.**

No human developer performed or attested to this run. It must not be counted as
developer evidence. The run used the public candidate commit before
`course-kit-v0.2.0` existed.
