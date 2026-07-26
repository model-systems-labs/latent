# Framework and course instances

Latent separates the reusable platform from the sites built with it.

## The ownership model

```text
model-systems-labs/latent (public upstream)
  ├── versioned content contracts and Course Kit
  ├── trusted browser runtimes and application adapters
  ├── authoring and review skills
  └── released reference courses

course-instance repository (independent downstream)
  ├── its own product identity and learner navigation
  ├── the courses selected for that audience
  ├── its own release history and access policy
  └── its own .openai/hosting.json
```

The reference courses remain in the public repository because they are the
reviewed integration fixture for privileged browser runtimes. That does not
make the framework homepage a course catalog, and it does not make a deployed
course site the framework's canonical home.

## Code map

- `packages/course-kit` owns portable Learning Pack and Question Group
  contracts, validation, canonicalization, and deterministic static builds.
- `packages/browser-lab`, `packages/python-lab`, and the other leaf packages
  own reviewed runtime capabilities. Remote course data cannot import them.
- `app/platform` contains application-owned adapters, persistence, and IDE
  extension hosts.
- `app/lessons` and `app/courses` compose the released first-party reference
  curriculum.
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

## Authoring and editing

Course prose is reviewed Git source. The application does not expose a public
`PUT` endpoint or an in-page maintainer editor for homepage or lesson copy.
Learner code, drafts, checkpoints, flash-card ratings, and practice progress
remain editable and are stored on the learner's device.

This gives source review, history, and rollback to maintainers without
confusing course authoring with the learner experience.

## Downstream workflow

Create a course instance as an independent repository with this repository as
`upstream`. Keep instance-specific branding, navigation, content selection,
access control, and `.openai/hosting.json` downstream. Pull reviewed framework
changes from upstream deliberately and validate before deploying.

The public framework repository should never contain a course instance's
hosting project ID. A private deployment does not make a public repository or
previously released CC BY 4.0 curriculum private.

## Local development

From either checkout:

```bash
npm ci
npm run dev
```

The default local URL is printed by the development server. Before publishing
framework changes, run the full validation sequence in `AGENTS.md`. A course
instance should additionally smoke-test its learner homepage, four course
homes, representative lessons, practice, cards, project workspace, and
capstone routes.
