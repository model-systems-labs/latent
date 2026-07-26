# Product boundaries

Latent is one repository with two product surfaces:

| Product | Audience | Product-owned folder | Primary surface |
| --- | --- | --- | --- |
| Latent Framework | Developers and publishers | `products/framework/` | `/framework` and the Open Learning workflows |
| Latent Courses | Learners | `products/courses/` | `/`, courses, practice, cards, and reading |

These folders make product identity and deployment intent visible without
duplicating the shared architecture.

## What remains shared

The products currently compose the same reviewed repository source:

- `app/` provides route adapters, shared UI, persistence, and composed learner
  features.
- `examples/learning-platform/llm-learning/` owns the full reviewed learning
  project mounted by the Latent Courses showcase.
- `courses/authored/` is the recommended in-repository workspace for portable
  Learning Packs that publishers own and host independently.
- `app/courses/` and `app/lessons/[slug]/` provide the current route adapters
  for the bundled curriculum.
- `packages/` provides Course Kit, portable schemas, browser runtimes, model
  and tensor libraries, artifact lineage, and replay.
- `worker/` and `build/` own trusted execution and build boundaries.
- `examples/`, `skills/`, `docs/`, and `tests/` support authoring, review,
  interoperability, and release validation.

Shared placement does not blur the trust boundary. Portable Learning Packs and
Question Groups remain declarative data. Runtime adapters, executable checks,
UI, persistence, and workers remain reviewed repository source.

## Hosting

There is no root `.openai/hosting.json`. Each product keeps its own profile in
its `products/<name>/.openai/` folder, and each product build selects that
profile and homepage explicitly. A generic build therefore has no implicit
cloud deployment target.

## Future direction

`products/courses` is intentionally limited to product identity and deployment
concerns so it can later become an independent repository if that ownership
model is useful. It is **not** a separate repository today: it composes the
shared application and the full example learning project.

This is currently an organizational product boundary, not two fully
independent applications. The product builds select different homepages,
deployment profiles, and public identities, while both still compile the
shared route tree. Exclusive route roots and one-way package dependencies are
work for the eventual repository extraction.

Keep the full reference learning project in `examples/`, course-product
identity in `products/courses/`, publisher-owned portable source in
`courses/authored/`, reusable contracts and reviewed runtimes in packages, and
route and persistence code in the application. Do not introduce remote
executable plugins or model calls into the learner runtime to bridge the
folders.
