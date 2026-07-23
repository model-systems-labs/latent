# Course Kit

Course Kit owns the framework-neutral lesson types, curriculum manifest schema,
and strict curriculum compiler used by the Latent LMS. It has no React,
persistence, learner-sandbox, or course-content dependencies.

The website supplies authored lessons and a manifest. `deriveCurriculum`
validates complete coverage, stable virtual-project paths, module ordering, and
test counts before routes or learner progress consume the curriculum.

It also owns the public `latent-learning-pack` and `latent-learning-feed`
formats. Those schemas, semantic quality checks, canonical JSON, and
standalone-site renderer are data-only and browser-safe. Community content
cannot reach Latent's privileged code or Python runtimes.

Build the package before using its provider-neutral CLI:

```bash
npm run build --workspace @latent/course-kit
node packages/course-kit/bin/latent-learning.mjs --help
```

The complete authoring, self-hosting, trust, and extension contract lives in
[`docs/open-learning.md`](../../docs/open-learning.md).
