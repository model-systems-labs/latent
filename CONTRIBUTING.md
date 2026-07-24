# Contributing to Latent

Latent welcomes improvements to the open learning format, Course Kit, the
browser reader and authoring studio, interoperability, accessibility,
documentation, and first-party lessons.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- For a focused bug fix, a pull request can be the first discussion.
- For a format change, new runtime capability, large dependency, or broad
  product change, open a proposal first. Describe the learner problem,
  compatibility impact, security boundary, and smallest viable change.
- Report security problems privately as described in [SECURITY.md](./SECURITY.md).
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

Latent requires Node.js `>=22.13.0`.

```bash
git clone https://github.com/model-systems-labs/latent.git
cd latent
npm ci
npm run dev
```

Run the complete release gate before requesting review:

```bash
npm run validate
```

Open-learning changes also require:

```bash
npm run open-learning:validate
npm run open-learning:schema
npm run open-learning:generate
git diff --exit-code
```

Generated schemas, public workflow documents, and the example static site are
committed. Change their source, regenerate them, and review the resulting diff;
do not hand-edit generated output.

## Pull requests

Keep each pull request centered on one coherent change. Include:

- the problem and intended learner or publisher outcome;
- the approach and important tradeoffs;
- tests added or changed;
- exact validation commands and results;
- screenshots or recordings for material interface changes; and
- compatibility, migration, security, and accessibility notes where relevant.

Do not weaken a contract merely to make a test pass. If behavior intentionally
changes, update the implementation, contract, documentation, generated
artifacts, and tests together.

### Open-learning invariants

Community Learning Packs are untrusted data. Contributions must preserve these
rules unless a separately reviewed format version explicitly replaces them:

- packs remain declarative and do not execute remote JavaScript, HTML, CSS,
  MDX, React, Python, workers, iframes, packages, or authored tests;
- remote feeds use HTTPS outside loopback, reject redirects, enforce same-origin
  package paths and byte limits, and verify canonical UTF-8 plus SHA-256;
- a published package id and version identify immutable bytes;
- integrity, publisher identity, editorial review, and certification remain
  separate claims; and
- self-hosting continues to work without a Latent account or central directory.

See [docs/open-learning.md](./docs/open-learning.md) for the complete contract.

## Educational content and sources

Read [CONTENT_PROVENANCE.md](./CONTENT_PROVENANCE.md) before changing lessons,
cards, exercises, diagrams, or fixtures.

- Record every source that materially informs the change.
- Prefer primary research, specifications, and maintained implementation
  documentation.
- Write explanations, examples, diagrams, fixtures, and code independently.
- Mark quotations and adaptations at the point of use with their exact
  attribution and license.
- Do not submit private, personal, confidential, or copyrighted source
  material that you lack permission to contribute.

AI-assisted contributions are welcome, but the human contributor remains
responsible for accuracy, originality, rights, tests, and review. Inspect every
generated line and disclose material AI assistance in the pull-request
description when it affects provenance or reviewer judgment.

## Licensing contributions

By submitting a contribution, you represent that you have the right to do so
and agree that:

- software, schemas, tests, scripts, configuration, and executable code
  examples are contributed under Apache-2.0; and
- original educational material covered by
  [CONTENT_LICENSE.md](./CONTENT_LICENSE.md) is also contributed under
  CC BY 4.0.

Third-party material must keep its original license and attribution. A
contribution explicitly marked `Not a Contribution` is not accepted for
inclusion.
