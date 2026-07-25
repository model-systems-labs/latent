# Latent workspace architecture

The repository is an npm workspace with the deployable web application at the
root. Keeping the application at the root preserves the Sites build and hosting
contract while allowing reusable systems to evolve as independent packages.

The user-visible v0.2 scope is frozen in
[the launch contract](./v0.2-launch-contract.md). The security rationale for
the extension model is recorded in
[ADR-0001](./decisions/0001-portable-content-and-trusted-extensions.md).

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
| Course Kit | Portable schemas, framework-neutral types, canonicalization, validation, deterministic Learning Pack builds, and feed verification | React UI, persistence, compiler workers, sandbox policy, course copy, or remote execution authority |
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
- Course Kit owns framework-neutral Learning Pack and Question Group schemas,
  not authored course text, React UI, progress, or runtime authorization.
- Model Lab owns deterministic educational training and inference engines, not
  course UI, persistence, worker orchestration, or recorded replay.
- Latent Tensor owns numerical operations; the application generates lesson
  imports and injects the package's generated runtime source into the VFS.
- Artifact Runtime owns immutable artifacts; course-specific artifact adapters
  remain application features.
- Training Replay owns the model-neutral recording contract, validation,
  checkpoint materialization, lazy registry, and presentation view models. The
  application owns trainers, recordings, course placement, and React rendering.
- Python lesson files execute inside the Pyodide worker with NumPy, and
  TypeScript lesson adapters execute inside Browser Lab. Both paths stay inside
  the browser, share host-owned behavioral contracts, and feed the same saved
  project without importing Python into the React bundle.

Pure libraries compile to `dist/` with declarations before the web build.
Browser Lab is intentionally source-exported inside the private workspace so
Vite can discover its compiler and sandbox worker URLs; publishing it outside
the monorepo would require a dedicated worker-bundling build.

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

The built-in `/practice` route currently imports one reviewed library from the
repository. An arbitrary hosted library can use the preview schema and
TypeScript validator, but Latent does not fetch it by URL or grant it access to
privileged runtimes in v0.2.

Practice progress is separate from lesson completion, the cumulative course
project, and flash-card ratings. A leech-focused practice view is a query over
Question Group progress; it is not a fifth content primitive.

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
