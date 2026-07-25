# Course Kit

Course Kit is the public, model-neutral format and toolchain for portable
lessons, flash cards, and programming question groups. It validates learning
content, builds deterministic lesson sites, emits integrity-bound feeds, and
verifies published feeds without requiring Latent hosting.

The source tree is now Course Kit v0.2.0 and includes question groups. The
latest published tarball is still v0.1.0; it supports Learning Packs and flash
cards. Use that exact release for the published CLI until v0.2.0 is tagged:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.1.0/latent-course-kit-0.1.0.tgz

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning init my-learning-pack --json

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning validate my-learning-pack/learning-pack.json --strict --json
```

Course Kit is not currently published on npm. Once the package has been
bootstrapped there, a matching registry version can become an equivalent
shorter pin; do not advertise that pin before it exists.

The generated starter is intentionally incomplete. Replace its example content
before strict validation.

When contributing inside the Latent monorepo, build and run the same CLI
directly:

```bash
npm ci
npm run build --workspace @latent/course-kit
node packages/course-kit/bin/latent-learning.mjs --help
```

The package includes versioned pack, feed, and question-group schemas under
`schema/` and the complete authoring and hosting contracts under `docs/`.

Course Kit also owns the framework-neutral lesson types, curriculum manifest
schema, and strict curriculum compiler used by the Latent application. It has
no React, persistence, learner-sandbox, or course-content dependencies.

The public `latent-learning-pack` and `latent-learning-feed` formats, semantic
quality checks, canonical JSON, and standalone renderer are data-only and
browser-safe. Community content cannot reach Latent's privileged code or Python
runtimes.

Read [`docs/open-learning.md`](./docs/open-learning.md) for the full contract
and [`docs/learning-pack-quality-rubric.md`](./docs/learning-pack-quality-rubric.md)
for the independent review standard.

Question groups are a separate versioned primitive so Learning Pack v1 remains
immutable. They contain declarative cases and assertions, never executable
publisher-authored tests. Until the v0.2.0 package is published, use the
checked-out workspace or the checked-in candidate JSON Schema rather than a
nonexistent release artifact. The candidate may change before the v0.2 tag;
the planned permanent schema URL is not a published contract yet. Read
[`docs/question-groups.md`](./docs/question-groups.md) for the layering and
runtime trust boundary.
