# ADR-0002: Trusted interactive lesson frames

- Status: Accepted
- Date: 2026-07-29
- Owners: Latent maintainers

## Context

Latent's first-party lessons use a closed union of reviewed React experiments.
That produces consistent built-in experiences, but every new visual mechanism
requires a new component, dispatch branch, and framework-specific integration.
It does not match the way coding agents most naturally create a one-off
interactive: a small composition of HTML, CSS, and JavaScript.

Granting the same authority to hosted Learning Packs or Question Groups would
break the portable-content boundary established in
[ADR-0001](./0001-portable-content-and-trusted-extensions.md). Running authored
JavaScript directly in the application realm would also give every interactive
the full authority of the page and couple it to React internals.

The platform needs an agent-friendly executable seam that remains reviewed
repository source, has bounded host services, saves exact-version state, and
feels native to the lesson.

## Decision

Latent adds trusted interactive frames as an application-owned extension seam.

### Authored source

A trusted definition created with `defineTrustedInteractive` contains:

- lowercase interaction identity, definition version, and state schema
  version;
- authored HTML body fragment, CSS, and JavaScript;
- bounded initial state and host input;
- frame title and height bounds;
- an optional reviewed Course Kit palette;
- explicit capability, event, and completion-checkpoint allowlists; and
- reviewable learning objective, learner action, evidence, and visual intent.

The definition is trusted repository source. A person or coding agent may add
it to a fork, but normal review, validation, compilation, and deployment are
what grant it authority. Portable content can neither contain this source nor
select a trusted definition by remote identifier.

### Frame boundary

The application prepares source- and bundle-hashed bytes and transfers them to
a sandboxed `srcdoc` iframe through a private `MessageChannel`. The `srcdoc`
contains only a fixed hash-authorized bootstrap. The iframe uses
`sandbox="allow-scripts"` without `allow-same-origin`, producing an opaque
origin, and a restrictive CSP denies network connections, workers, child
frames, external resources, and forms while requesting navigation denial.

Authored HTML, CSS, and JavaScript compose the lesson mechanism inside that
boundary subject to fixed byte, JSON, height, and concurrency limits. HTML
document metadata and nested executable or embedding elements are not
accepted. Source admission rejects active navigation and URL-bearing HTML,
external CSS references, and JavaScript navigation, network, worker, dynamic-
import, document-replacement, and external-load mechanisms. Remote imports and
assets are not an extension mechanism. The CSP requests `navigate-to 'none'`,
and the host revokes a session if the frame subsequently loads another
document.

The frame exposes `globalThis.Latent.connect()`. A connected session can read
cloned state and frozen host input, visual context, identity, and storage
status. It can call only explicitly granted host operations:

- `context.get`
- `state.save`
- `events.record`
- `progress.request`

Requests and responses are bounded JSON and schema-checked on both sides.
Events must be declared and are retained only as bounded visit-local
diagnostics; they are never durable evidence or progress. Completion requests
must name a declared checkpoint, and a reviewed host registry validator decides
whether saved state, payload, and host-owned interaction evidence satisfy
lesson policy. The frame cannot mark itself complete.

Interaction evidence remains visit-local. Durable state may restore the
learner's view, but an incomplete checkpoint must collect fresh trusted
transitions after a remount rather than treating restored frame-authored state
as authority. A lesson completion that is already present in the durable
host-owned progress record is accepted idempotently.

### State identity

The host owns persistence under the exact identity:

```text
courseId
+ lessonId
+ interactiveId
+ definitionVersion
+ sourceHash
+ stateSchemaVersion
```

State is bounded JSON, at most 32,000 UTF-8 bytes with depth 16 and 4,000
nodes. Saves use a host-managed monotonic revision and an opaque compare-and-
swap token. A changed source hash, definition version, or state schema starts
from the new definition's initial state rather than applying an implicit
migration. State persistence cannot directly mutate course or lesson progress.

### Visual contract

The host injects a versioned visual foundation derived from Course Kit's
learner UI: semantic palette values, lesson accent, typography, spacing,
breakpoints, reduced-motion and forced-color preferences, focus rules, and a
small set of reviewed element recipes. The authored CSS controls the actual
composition. This keeps agent-generated designs expressive without making each
frame rediscover product color, accessibility, or responsive constraints.

### Trust boundary

The source admission checks, iframe sandbox, CSP, opaque origin, navigation
checks, and private protocol are defense in depth for reviewed trusted
repository source. They are not a hostile-code sandbox and do not provide CPU
or general renderer-resource containment. Authored JavaScript can still loop
forever or consume excessive renderer resources, so code review, automated
validation, and browser testing remain part of granting an interactive
authority.

## Consequences

- Coding agents can use the browser-native medium they handle best for custom
  lesson interactions without adding a new React component kind each time.
- Interaction behavior remains inspectable as ordinary source and does not
  introduce a learner-runtime model dependency.
- Arbitrary presentation does not imply arbitrary application authority; new
  host powers require an explicit reviewed capability.
- Frames pay a message-boundary and iframe cost, and cannot directly consume
  React context or application storage.
- Authors must version behavior and state intentionally, design a meaningful
  checkpoint with a host registry validator, and test hydration, reset, stale
  work, errors, accessibility, resource behavior, and narrow layouts.
- Portable Learning Packs and Question Groups remain declarative and safe to
  render without executing publisher code.

## Rejected alternatives

- **Add every interaction to the React experiment union.** This preserves full
  application coupling and makes simple agent-authored mechanisms expensive.
- **Execute hosted HTML, CSS, or JavaScript.** A content URL, extension field,
  or package identity is not execution authority.
- **Run authored code in the page realm.** This grants unnecessary access to
  DOM, storage, navigation, credentials, and application internals.
- **Expose a general RPC bridge.** A frozen, named capability set is easier to
  reason about, deny, test, and evolve.
- **Treat frame events as completion.** Progress remains a host-owned learning
  decision, not a side effect of arbitrary interaction.
