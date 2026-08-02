# Latent workspace architecture

The repository is an npm workspace with the deployable web application at the
root. Keeping the application at the root preserves the Sites build and hosting
contract while allowing reusable systems to evolve as independent packages.

The user-visible v0.2 scope is frozen in
[the launch contract](./v0.2-launch-contract.md). The security rationale for
the extension model is recorded in
[ADR-0001](./decisions/0001-portable-content-and-trusted-extensions.md).
The reviewed browser-native interaction seam is recorded in
[ADR-0002](./decisions/0002-trusted-interactive-frames.md).

## Platform composition

Agents are authoring and build-time collaborators. They can produce portable
content or modify trusted repository source, but they are never an implicit
authority inside the learner runtime.

```text
people and coding agents
        |
        +-- portable, untrusted data
        |     |
        |     +-- Learning Packs: lessons · quizzes · flash cards
        |     +-- Question Groups: starter source · cases · assertions
        |                         |
        |                 @latent/course-kit
        |             schema · validation · canonical bytes
        |
        +-- trusted, reviewed repository source
                              |
                 application-owned adapters
                              |
                   host-owned contracts
                              |
             Browser Lab / Python Lab workers
                              |
                  bounded runtime results
                              |
          application source + contract binding
                              |
           UI · navigation · device-local progress
                              |
             compiled, self-hosted application
```

The boundary is capability-based, not author-based. Content produced by a
maintainer is still untrusted when loaded through a remote content seam.
Repository code produced by an agent is not trusted until it passes the same
review and validation as human-written code.

## Layer ownership

| Layer | Owns | Must not own |
| --- | --- | --- |
| Course Kit | Portable schemas, framework-neutral types, canonicalization, validation, deterministic standalone builds, feed verification, and the static learner UI foundation used by those builds | React application UI, application persistence, privileged compiler workers, course copy, or remote execution authority |
| Application adapters | Mapping validated content into host-owned view models and exercise contracts | Redefining or silently weakening the portable schema |
| Host-owned contracts | Trusted behavioral checks, contract versions, and result interpretation | Publisher-authored executable test strings |
| Browser Lab and Python Lab | Learner-source execution outside the page realm, resource controls, and bounded runtime results | Navigation, course progress, authored curriculum, application persistence, or a shared receipt format they do not implement |
| Application result binding | Exact submitted-source identity, contract version, stale-result rejection, and durable evidence | Trusting learner-returned pass flags or publisher-authored executable checks |
| Application UI and persistence | Navigation, editor composition, explicit saves, progress, and local recovery | Granting capabilities based only on remote metadata |
| Optional services | Discovery, identity, review attestations, hosting convenience, and later collaboration | Becoming required for local authoring, reading, export, or self-hosting |

## Dependency direction

```text
@latent/web
  ├── @latent/course-kit
  ├── @latent/model-lab
  ├── @latent/tensor
  ├── @latent/browser-lab
  ├── @latent/python-lab
  ├── @latent/artifact-runtime
  ├── @latent/training-replay
  └── @latent/mock-services
```

The only package-to-package edge is `@latent/training-replay` →
`@latent/artifact-runtime`; every other package is a leaf consumed by the web
application. The boundary check rejects undeclared workspace imports, private
source-path imports, unknown packages, root-application dependencies, and
dependency cycles.

- Packages never import `app/`, React components, lesson content, or web
  persistence orchestration.
- The application imports package public exports, never `packages/*/src`.
- Browser Lab owns untrusted learner-code compilation and execution, not IDE UI.
- Python Lab owns guarded Pyodide worker execution. It is not a hostile-code
  security sandbox and is not enabled for arbitrary remote content.
- Mock Services owns simulated network behavior, not LMS navigation or progress.
- Course Kit owns framework-neutral Learning Pack and Question Group schemas
  plus its generated static-player foundation, not authored course text, React
  application UI, application progress orchestration, or runtime authorization.
- Model Lab owns deterministic educational training and inference engines, not
  course UI, persistence, worker orchestration, or recorded replay.
- Latent Tensor owns numerical operations; the application generates lesson
  imports and injects the package's generated runtime source into the VFS.
- Artifact Runtime owns immutable artifacts; course-specific artifact adapters
  remain application features.
- Training Replay owns the model-neutral recording contract, validation,
  checkpoint materialization, lazy registry, and presentation view models. The
  application owns trainers, recordings, course placement, and React rendering.
- Python lesson files execute inside the Pyodide worker with curated NumPy and
  Sorted Containers support, and
  TypeScript lesson adapters execute inside Browser Lab. Both paths stay inside
  the browser, share host-owned behavioral contracts, and feed the same saved
  project without importing Python into the React bundle.

Pure libraries compile to `dist/` with declarations before the web build.
Browser Lab is intentionally source-exported inside the private workspace so
Vite can discover its compiler and sandbox worker URLs; publishing it outside
the monorepo would require a dedicated worker-bundling build.

### Browser Chat development preview

Browser Chat has two deliberately different execution identities. The
development preview compiles the current `capstone/main.tsx` import graph,
verifies the emitted bundle hash, runs the host-owned capstone behavior
contract (including its isolated preflight), and mounts it in the same
opaque-origin sandboxed iframe used by a verified build. It may run before
lesson completion, but it is ephemeral: it does not persist test evidence,
promote a build, mint a receipt, or qualify as portfolio evidence.

A verified build still requires the complete source-bound contract suite and
durable promotion record. Python lesson files remain standalone CPython
contract implementations rather than React imports. Only a host-recorded
`models/character-rnn.py` checkpoint whose hash matches the exact current
source may enter either preview mode; otherwise Browser Chat can use its local
browser model.

### Trusted interactive lesson frames

Trusted lesson interactives are reviewed application source authored as
separate HTML, CSS, and JavaScript files plus a typed definition. They are not
portable Learning Pack or Question Group fields. The application hashes the
exact source, injects the shared learner visual contract, and transfers the
verified bundle over a private `MessageChannel` to an opaque-origin iframe
with `sandbox="allow-scripts"` and a network-denying CSP.

The frame receives only explicit host capabilities for context, bounded JSON
state, allowlisted events, and completion requests. State is namespaced by
course, lesson, interactive, definition version, source hash, and state schema
version. The host validates saved evidence before updating progress; mounting
or messaging from the frame is never completion. This gives coding agents a
natural browser-native authoring medium without granting remotely loaded
content or authored JavaScript application authority. The implementation and
authoring workflow are described in
[Trusted lesson interactives](./trusted-interactives.md).

## Shared learner presentation

Learner UI is an opinionated trusted framework layer, not a property of
portable content. The standalone Learning Pack player, standalone Question
Group player, original React course, and reviewed learning-platform examples
consume the same build-time foundation:

```text
packages/course-kit/src/learner-ui.ts
        |
        +-- v2 design tokens, five named palettes, and breakpoints
        +-- one ethereal, scroll-reactive atmosphere grammar
        +-- shell, one-header anatomy, navigation, and footer renderers
        +-- controls, progress, feedback, empty-state, and editor framing
        +-- editable public-example fields and actual-only try feedback
        +-- focus, screen-reader, reduced-motion, and mobile behavior
        |
        +-- learner-code-editor.ts
        |       +-- CodeMirror language, syntax, theme, and keyboard contract
        |       +-- integrated and specialized workspace variants
        |       +-- React extensions and progressive-textarea adapter
        |       +-- browser/learner-code-editor-runtime.ts
        |               +-- self-hosted learner-code-editor.js
        |
        +-- static-site.ts                 (lesson/card specialization)
        +-- question-group-site.ts         (coding-practice specialization)
        +-- generate-learning-platform-learner-ui.mjs
        |       +-- public/assets/learner-ui.css
        |       +-- public/assets/learner-ui.js
        |               +-- app/layout.tsx (subpath-safe links)
        +-- app/styles/tokens.css          (legacy React-token aliases)
        +-- app/components/LearnerHeader.tsx
        +-- example build inputs           (product configuration)
```

The default `paper` palette carries the warm editorial principles established
by the original Build an LLM System course: serif display type, quiet
hairlines, restrained depth, readable measure, and content-first hierarchy.
Trusted product configuration may select one of five reviewed palettes:
`paper`, `sage`, `cobalt`, `plum`, or `graphite`. Palette selection changes
semantic color and atmosphere tint, not geometry, layout, typography, focus
behavior, or responsive rules. Every palette uses the same sparse partial-line
atmosphere. Its lines fade between phases as the single document scrolls.
Sage, Cobalt, Plum, and Graphite add one short highlight to each existing
hairline; because the highlight belongs to the line, it inherits the same
scroll crossfade without another animation, listener, or decorative layer.
Paper keeps the original quiet line. The atmosphere has no grid, orbital
field, pinstripe, particle field, filled decorative shape, image request,
fixed background attachment, or runtime service. Reduced-motion, forced-color,
and print modes remove the decorative motion and highlights.

Standalone Learning Pack player version 2 and later is always one sidebar-free
vertical document. Its course contents are in flow, use native fragment links,
and do not hide lessons or decks behind view-selection controls. Appearance
palettes cannot select a different layout. The hosted-feed reader follows the
same continuous-reading rule after it verifies a pack.

Learning Studio and the original LLM Systems course use Paper, Interview Loop
uses Sage, and Ten Problems uses Cobalt; Plum and Graphite remain bounded
alternatives. `renderLearnerAtmosphere()` supplies static markup,
`learnerUiJavaScript` owns the shared request-animation-frame scroll behavior,
and `app/components/PageAtmosphere.tsx` is only a React markup adapter. A
low-level token override remains available to trusted callers for
compatibility, but reviewed examples use palette-only `appearance`
configuration and may not combine it with the legacy `theme` input.

Every route in the reviewed suite has exactly one page-level header. Its
stable identity is **Learning Studio** with **Courses and practice** metadata,
and its primary navigation is the same ordered LLM Systems, Interview Loop,
and Ten Problems list. Only the current item and subpath-safe hrefs vary. On
compact screens those three destinations move into one **Experiences**
disclosure without changing identity.

Product-local destinations such as Modules, Practice, Review, Project,
Reading, and Coding lab render through
`renderLearnerContextNavigation()` as a quiet, horizontally scrollable row in
the content plane. It is a `nav`, never another `header` or disclosure.
Lesson controls, problem controls, and editor toolbars stay inside their
content regions. Escape closes the compact global disclosure and restores
focus, the skip link transfers focus to main content, and a three-pixel
visible focus indicator is shared across products.

Branding, routes, navigation labels, palette choice, trusted reference
solutions, and product-specific copy are trusted build configuration. They
are not Learning Pack or Question Group fields and do not affect canonical
content bytes, integrity digests, runtime authority, or progress identities.
The Question Group builder accepts reviewed reference source separately from
portable JSON and renders it as inert text in a native disclosure; opening it
does not execute code, replace a draft, or update progress. Generated sites
copy the shared CSS and JavaScript into their own static artifact. For React,
`scripts/generate-learning-platform-learner-ui.mjs` derives
`public/assets/learner-ui.css` and `public/assets/learner-ui.js` from the same
reviewed Course Kit source before the web build. No learner product depends on
a hosted stylesheet, framework CDN, JavaScript service, or model API.

An example designed to be extracted from the monorepo may check in a generated
build-time copy of this module beside other vendored build tooling. The
repository validates that copy against the reviewed Course Kit source. There
is still one source of truth, and the deployed learner runtime remains
self-hosted.

The trusted `examples/learning-platform/learning-suite.mjs` manifest defines
the ordered deployment directory, stable mount names, card copy, and derived
same-origin family navigation once.
`createLearningSuiteHeaderConfiguration()` is the single reviewed build-time
source for the suite identity, metadata, destination order, compact label,
active state, and root-relative paths. The repository Pages artifact is
assembled from that manifest by `scripts/build-learning-example-pages.mjs`.
It creates a content-first Learning Studio index and copies three independently
built learner products into stable subpaths: the React Build an LLM System
course at `/llm-systems/`, Interview Loop Lab at `/interview-loop/`, and Ten
Problems at `/practice/`.
The root `build:web` script regenerates the two self-hosted learner assets
before compiling the application. `app/layout.tsx` links them through the
active base path rather than inlining package source; `LearnerHeader.tsx` is a
thin adapter over the shared markup contract, and `app/styles/tokens.css` maps
older course variables to the canonical tokens. Interview Loop consumes the
generated, drift-checked
`examples/learning-platform/interview-loop/tools/vendor/learner-ui.mjs`.
Ten Problems consumes the foundation through
`packages/course-kit/src/question-group-site.ts`. All three expose the same
family navigation and a single primary vertical document flow while retaining
product-appropriate reading, module, flash-card, IDE, and coding-practice
sections.

Code editing follows the same ownership rule. The framework-neutral
`packages/course-kit/src/learner-code-editor.ts` is the reviewed source for
language parsing, syntax colors, indentation, keyboard escape behavior,
accessibility attributes, and integrated versus specialized-workspace
appearance. React editors consume its extension factory; standalone Question
Group and Interview Loop builds consume a deterministic, same-origin IIFE made
from `packages/course-kit/src/browser/learner-code-editor-runtime.ts`. The
static adapter progressively enhances a textarea while retaining it as the
draft and event bridge, so existing digest-bound persistence and run/check
logic remain host-owned. CodeMirror's generated style element carries one
fixed reviewed nonce; only that nonce is added to the static sites' CSP. No
`unsafe-inline`, remote stylesheet, CDN, or runtime service is introduced.
`scripts/prepare-pages-course-export.mjs` verifies the static course export
before the atomic suite assembly.

Learning Studio is a build-time directory for the deployment, not a learner
account, enrollment list, or aggregate progress dashboard. The three apps have
no cross-product runtime API. Each persists progress under its own exact
content identity on the same device, and the root page deliberately does not
invent a suite-wide percentage or Continue destination.

## Question Group execution

Question Groups are portable data, but execution is a host decision:

```text
Question Group JSON
        ↓
Course Kit structural and semantic validation
        ↓
application-owned question adapter
        ↓
host-owned ExerciseContract
        ↓
Browser Lab or Python Lab worker
        ↓
bounded runtime result
        ↓
application source and contract binding
        ↓
practice UI and separate device-local progress
```

The built-in `/practice` route imports one reviewed library from the repository.
An arbitrary hosted library can use the released schema and TypeScript
validator, but Latent does not fetch it by URL or grant it access to privileged
runtimes in v0.2.

Practice progress is separate from lesson completion, the cumulative course
project, and flash-card ratings. A leech-focused practice view is a query over
Question Group progress; it is not a fifth content primitive.

Standalone Question Group editor drafts are also separate from portable
progress. The trusted player stores them under the exact library digest and
question contract identity/version, restores them on navigation and reload,
and falls back to visit-local memory when durable storage is unavailable.
Run and check operations are cancelable by the host adapter; cancellation
terminates the disposable worker without changing progress or the saved draft.

Editable public-example arguments are a trusted presentation/runtime
composition owned by `packages/course-kit/src/learner-ui.ts` and
`packages/course-kit/src/question-group-site.ts`, not a new portable field.
Custom arguments are bounded JSON held only for the current visit. **Run this
input** scopes one published example identity to those temporary arguments and
renders the normalized returned/raised observation without grading it against
the published expected value. Canonical **Run examples** and **Check solution**
continue to use the immutable validated cases; only the latter writes
progress. Interview Loop composes the same shared component with its
application-owned Python adapter, while Ten Problems receives it through the
standalone Question Group builder.

Standalone runtime adapters opt in to that custom-input observation path with
an explicit trusted capability. Existing injected adapters without the
capability retain the canonical read-only public-example presentation and are
never sent a new request shape.

Browser Lab can emit a source- and contract-bound receipt directly. Python Lab
returns guarded runtime observations and results; the application performs the
stale-source check and attaches source plus contract identity before saving
progress. The architecture does not claim a shared receipt abstraction that
the two runtime packages do not implement.

## Release and deployment identity

Source, package releases, schemas, and deployments are related but distinct:

- A package version in a manifest is unreleased until the matching tag and
  artifact exist.
- A versioned schema URL is immutable only after the release workflow publishes
  it.
- A Sites deployment records a Git commit, but deploying an unreleased commit
  does not publish Course Kit.
- A release is truthful only when the documented install URL, tag, tarball,
  checksum, schema bytes, and `main` commit agree.

Run `npm run boundaries` to verify these constraints. Each workspace owns its
unit tests; the root test suite verifies the assembled website and capstone.
