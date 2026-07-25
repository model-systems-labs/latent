# ADR-0001: Portable content and trusted executable extensions

- Status: Accepted for v0.2
- Date: 2026-07-25
- Owners: Latent maintainers

## Context

Latent is both an open publishing framework and a demanding browser learning
application. Outside authors need a way to create and host learning material
without Latent, while the reference application needs compilers, sandboxes,
behavioral checks, persistence, and executable IDE exercises.

Treating remote content and executable application code as one plugin system
would either make simple content difficult to publish or grant unreviewed
publishers unsafe runtime authority. Agent support adds a second concern:
models should be able to extend a project without becoming an invisible
dependency of the learner runtime.

## Decision

Latent has two extension paths.

### 1. Portable declarative content

Learning Packs and Question Group libraries are bounded JSON data. Course Kit
owns their schemas, canonicalization, validation, and framework-neutral types.
Course Kit has no dependency on React, application persistence, compilers,
workers, or learner sandboxes.

Portable content:

- can be authored by a person or any capable coding agent;
- can be inspected and validated without trusting its publisher;
- cannot load external scripts, components, workers, packages, credentials, or
  publisher-defined runtime hooks, and cannot request execution authority for
  the starter source it carries; and
- receives no capability merely because a reader understands a namespaced
  extension field.

Learning Packs are render-only. A hosted Question Group library describes
starter source, entrypoints, cases, and data-only assertions, but hosting that
JSON does not authorize Latent to execute it.

### 2. Trusted platform source

IDE integrations, runtime adapters, behavioral contracts, application UI, and
custom persistence are repository source. A human or coding agent may add them
to a fork, but they become trusted only through normal review, validation, and
deployment. They are never downloaded and activated as remote executable
plugins.

Models and agents operate at authoring and build time. The learner application
does not require a model provider and does not implicitly ask an agent to
generate or execute code.

## Layer ownership

```text
people and coding agents
        |
        +---------------- portable content -----------------+
        |                                                   |
        |       Learning Packs / Question Group JSON        |
        |                       |                           |
        |              @latent/course-kit                   |
        |        schema · canonical bytes · validation      |
        |                       |                           |
        +---------------- trusted source -------------------+
                                |
                    application-owned adapters
                                |
                    host-owned exercise contracts
                                |
                 Browser Lab / Python Lab workers
                                |
                     bounded runtime result
                                |
               application source + contract binding
                                |
                 application UI · navigation · progress
                                |
                   compiled, self-hosted application
```

The diagram shows data and execution flow, not module imports. Module
dependencies point from `@latent/web` to leaf packages. Packages do not import
the application, course content, React UI, or persistence orchestration. The
application composes package exports and injects trusted contracts into the
runtimes.

## Runtime boundary

- JavaScript and TypeScript learner source is compiled outside the page realm
  and runs in QuickJS with explicit CPU, memory, output, and host-capability
  limits.
- Python learner source runs in a dedicated Pyodide worker with guardrails.
  Python Lab is not a hostile-code security sandbox and must not be advertised
  as one.
- Host-owned `ExerciseContract` values are fixed data interpreted by trusted
  application adapters and runtime code. Publisher-authored executable tests
  are not part of a portable format.
- Browser Lab can emit a source-bound receipt. Python Lab returns guarded
  runtime results, which the application binds to submitted source and contract
  version before they affect progress.
- The built-in practice site executes only its reviewed, bundled Question Group
  library in v0.2.

Any future remote Question Group installation must add immutable publisher
identity, exact byte integrity, digest-bound progress, resource limits, and a
separate capability review before execution.

## Distribution boundary

A publisher-controlled static URL remains sufficient to publish portable
content bytes. A Learning Pack build is also a complete static learning site.
A Question Group library needs a compatible player to become a usable practice
experience; publishing its JSON alone does not make an unrelated Latent
deployment execute it. Discovery, verified identity, editorial review, and
certification may be centralized later, but they remain independent claims and
cannot become requirements for authoring, reading, or publishing portable
content.

## Consequences

- Latent can truthfully support courses, an IDE, flash cards, and programming
  practice without claiming four equivalent plugin APIs.
- Learning Packs remain easy to host and safe to inspect.
- Question Groups can evolve as a declarative interoperability format before a
  remote execution or standalone-player contract is frozen.
- Repository forks are the supported v0.2 path for custom executable learning
  experiences.
- A future managed product must consume and export the same public artifacts;
  it cannot become the only way to publish.
- New executable extension mechanisms require a new architecture decision and
  cannot be smuggled through a schema extension.
