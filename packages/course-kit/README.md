# Course Kit

Course Kit is the public, model-neutral format and toolchain for portable
lessons and flash cards. It validates learning packs, builds deterministic
static sites, emits integrity-bound feeds, and verifies published feeds without
requiring Latent hosting.

Use the exact v0.1.0 GitHub release from any directory. The tarball remains
available even before or independently of npm scope setup:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.1.0/latent-course-kit-0.1.0.tgz

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning init my-learning-pack --json

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning validate my-learning-pack/learning-pack.json --strict --json
```

Once `@latent/course-kit` has been bootstrapped on npm, the equivalent registry
pin is `@latent/course-kit@0.1.0`.

The generated starter is intentionally incomplete. Replace its example content
before strict validation.

When contributing inside the Latent monorepo, build and run the same CLI
directly:

```bash
npm ci
npm run build --workspace @latent/course-kit
node packages/course-kit/bin/latent-learning.mjs --help
```

The package includes the versioned pack and feed schemas under `schema/` and
the complete authoring and hosting contract under `docs/`.

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
