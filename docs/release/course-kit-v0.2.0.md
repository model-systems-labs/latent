# Course Kit v0.2.0

**Build your own learning platform with agents.**

Latent v0.2 turns the repository into an agent-friendly platform framework
while keeping the complete LLM Learning curriculum as its reference
application.

## Five-minute start

```bash
git clone --depth 1 --branch course-kit-v0.2.0 \
  https://github.com/model-systems-labs/latent.git
cd latent
npm ci

npm run create:platform -- ../my-school \
  --title "My School" \
  --tagline "Learn one useful idea, retrieve it, and put it to work." \
  --preview
```

The generated static platform contains a lesson, six-card deck, Question Group,
browser JavaScript IDE exercise, device-local progress, leech-only practice
query, validation, and GitHub Pages workflow.

## What shipped

- Released Question Group v1 schemas, strict validation, provenance and
  objective contracts, CLI workflows, portable progress, leech queries,
  injectable players, and a self-hosted JavaScript/TypeScript practice build.
- A supported Browser IDE seam that injects the editor, runtime, files, checks,
  and persistence. v0.2 supports hardened browser JavaScript and TypeScript; it
  does not claim remote Python execution.
- Seven agent-neutral workflows for authoring, reviewing, and publishing each
  platform layer.
- A tiny non-LLM starter and the full LLM Systems reference application.
- A tested static-host deployment workflow and public clean-room conformance
  protocol.

## Clean-room evidence

Before tagging, three independent agents started in empty directories from
public release-candidate documentation and produced distinct, validated,
deterministic platforms with all four surfaces in 3m 16s, 3m 36s, and 3m 59s.
Their candidate
[reports](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/conformance.md)
are recorded separately from people. Exact-tag agent reruns are pending until
the immutable tag exists.

Human developer conformance remains pending; this release does not relabel an
agent persona as developer evidence.

## 33-second demo

[Watch the lesson, flash-card, Question Group, and browser IDE walkthrough](https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-v0.2-demo.webm).
The recording uses the checked-in tiny non-LLM platform and shows failing
starter code followed by passing practice and IDE checks.

## Architecture

![Latent v0.2 architecture](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/release/architecture-graphic.png?raw=1)

Portable lessons, cards, and Question Groups remain declarative data. IDE
exercises, runtime adapters, workers, checks, and platform UI remain reviewed
repository source. Hosted content cannot grant itself executable authority.

## Four learning primitives

### Course

![Course](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/release/screenshots/course.jpg?raw=1)

### Flash cards

![Flash cards](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/release/screenshots/flashcards.jpg?raw=1)

### Practice

![Practice](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/release/screenshots/practice.jpg?raw=1)

### Browser IDE

![Browser IDE](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/release/screenshots/ide.jpg?raw=1)

## Install Course Kit directly

Course Kit remains intentionally unpublished on npm. Install the exact
registry-independent tarball:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-course-kit-0.2.0.tgz

npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning --help
```

The release also includes `SHA256SUMS`. The immutable Learning Pack, feed, and
Question Group schemas are published through GitHub Pages.

Read the [five-minute guide](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/getting-started.md),
[Question Group contract](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/question-groups.md),
and [architecture](https://github.com/model-systems-labs/latent/blob/course-kit-v0.2.0/docs/architecture.md).
