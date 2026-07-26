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
  └── shared curriculum, examples, skills, tests, and documentation
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
- `products/courses/reference-curriculum` owns the released first-party
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

The `products/` boundary does not alter that trust model. Moving a component
into a product folder does not make remote content executable, and keeping
shared packages at the root does not grant them authority over one another.
The application still depends on reviewed leaf packages through explicit
adapters.

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

## Intended future repository split

`products/courses` is an organizational boundary and intended extraction
target. It is not yet a clean dependency seam. If the learner product later
needs independent ownership, release history, access policy, or curriculum
selection, it can move to its own repository and consume reviewed framework
contracts and runtime packages deliberately.

That split has **not** happened. Today, the learner product still imports
shared application components, course definitions, runtime packages, and
content from this monorepo. New work should keep product-specific identity,
navigation, and deployment metadata under `products/courses` where practical,
without duplicating shared code merely to simulate a repository boundary.

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
