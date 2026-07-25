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

```bash
git clone --depth 1 https://github.com/model-systems-labs/latent.git
cd latent
node scripts/create-learning-platform.mjs ../my-learning-platform \
  --title "My learning platform" \
  --tagline "A concrete promise for its learners"
cd ../my-learning-platform
npm run validate
npm run build
npm run preview
```

The creation command must finish with a validated project. `npm run preview`
reruns validation, rebuilds the static output, and starts a loopback-only local
server. The participant may stop it after checking all four surfaces.

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

