# Framework and course instances

Latent separates the reusable platform from the learner site built with it.
That separation is expressed as product folders inside one repository today.
It is not yet a framework repository plus a separate course repository.

## The current ownership model

```text
model-systems-labs/latent (one public monorepo)
  ├── products/
  │   ├── framework/       developer and publisher product surface
  │   └── courses/         learner product surface and hosting profile
  ├── app/                 route adapters and composed application features
  ├── packages/            public contracts and reviewed runtime packages
  ├── worker/ and build/   trusted application and build boundaries
  └── examples/
      └── learning-platform/
          └── llm-learning/ full reviewed learning project
```

The framework product helps developers and publishers build, validate, and
host learning experiences. The course product helps learners choose and
complete the four released courses, practice, cards, and further reading.
Putting those product surfaces in separate folders prevents the framework's
identity from collapsing into its bundled course catalog.

The released courses remain shared repository source because they are reviewed
integration fixtures for privileged browser runtimes as well as useful
learning material. They do not define the framework, and a deployment of
Latent Courses is not the framework's canonical homepage.

The framework-neutral curriculum manifest can give a trusted module a concise
orientation overview: one heading, an introduction that explains how its
lessons connect, and one to five ordered learning objectives. The current
course application renders that data before progress and lesson navigation.
It is trusted repository content, not a Learning Pack field, and does not alter
portable schema bytes or progress identity.

## Code map

- `products/framework` owns the framework landing surface and its
  developer-and-publisher product language.
- `products/courses` owns the learner landing surface and the course
  deployment profile.
- `packages/course-kit` owns portable Learning Pack and Question Group
  contracts, validation, canonicalization, and deterministic static builds.
- `packages/browser-lab`, `packages/python-lab`, and the other leaf packages
  own reviewed runtime capabilities. Remote course data cannot import them.
- `app/platform` contains application-owned adapters, persistence, and IDE
  extension hosts.
- `examples/learning-platform/llm-learning` owns the released first-party
  curriculum, while `app/lessons/[slug]` and `app/courses` provide its current
  route adapters.
- `courses/authored` is the optional in-repository workspace for
  publisher-owned portable Learning Packs; those packs are hosted independently
  and are not added to the bundled catalog.
- `app/open-learning/read` verifies and renders publisher-controlled feeds.
- `app/open-learning/publish` validates declarative content and builds a
  host-ready static site.
- `worker` and `build` contain the trusted application hosting boundary.

The dependency direction is deliberate:

```text
portable JSON
    ↓ validation
Course Kit data
    ↓ application adapter
host-owned contract
    ↓ reviewed runtime
worker result
    ↓
learner UI + device-local progress
```

Portable content never supplies React, workers, runtime adapters, executable
tests, or persistence code.

The full LLM learning project is an explicit example dependency. The
application and Latent Courses product mount it; the example does not import
the application or either product. Moving it to `examples/` does not make its
trusted executable checks portable or remotely loadable.

## Authoring and editing

Course prose is reviewed Git source. The application does not expose a public
`PUT` endpoint or an in-page maintainer editor for homepage or lesson copy.
Learner code, drafts, checkpoints, flash-card ratings, and practice progress
remain editable and are stored on the learner's device.

This gives source review, history, and rollback to maintainers without
confusing course authoring with the learner experience.

## Hosting boundary

The repository root intentionally has no `.openai/hosting.json`. The framework
and course deployment profiles are nested under their respective `products/`
folders and selected only by `npm run build:framework` or
`npm run build:courses`. Each build also selects the matching product homepage.
This prevents a generic build from implicitly targeting either cloud project.

The hosting profile identifies a deployment target; it is not a content trust
grant or a substitute for access controls. A private course deployment also
does not make this public repository or previously released CC BY 4.0
curriculum private.

The public learning-examples Pages deployment is a smaller composition
boundary. `examples/learning-platform/learning-suite.mjs` is its trusted
build-time directory: it defines the three mounted experiences and derives
their same-origin navigation and root cards. It is not a portable learning
format, an enrollment record, or a learner-owned “My courses” list.

The original LLM Systems course, Interview Loop Lab, and Ten Problems are
built independently, copy the reviewed learner UI into their own static
artifacts, and keep separate device-local progress bound to their own content
identity. The root Learning Studio neither reads nor combines those stores.
Adding accounts, enrollment, or cross-product progress would require an
explicit application contract and is not implied by putting the artifacts in
one GitHub Pages deployment.

## Intended future repository split

`products/courses` is an organizational boundary and intended extraction
target. It is not yet a clean dependency seam. If the learner product later
needs independent ownership, release history, access policy, or curriculum
selection, it can move to its own repository and consume reviewed framework
contracts and runtime packages deliberately.

That split has **not** happened. Today, the learner product composes shared
application components, runtime packages, and the example learning project
from this monorepo. New work should keep product-specific identity, navigation,
and deployment metadata under `products/courses` without moving the example
back into product or application source.

The product build commands select distinct homepages, deployment metadata, and
public identity, but both still compile the shared application route tree.
Separate folders, homepages, navigation, and cloud projects make the product
intent clear; exclusive route roots and independent dependency graphs belong
to the future extraction.

A future extraction must preserve the same architectural contracts:

- portable community content remains declarative and independently hostable;
- trusted runtime adapters and executable checks remain reviewed source;
- the course product selects its own identity, access policy, and deployment
  target; and
- framework updates are adopted and validated deliberately rather than through
  an implicit remote runtime dependency.

## Local development

From this checkout:

```bash
npm ci
npm run dev
```

The default local URL is printed by the development server. Before publishing
framework changes, run the full validation sequence in `AGENTS.md`. Before
deploying the course product, additionally smoke-test its learner homepage,
four course homes, representative lessons, practice, cards, project workspace,
and capstone routes.
