# Trusted lesson interactives

Trusted interactives let a repository author build a purpose-made lesson
experience with ordinary HTML, CSS, and JavaScript. They are the natural
authoring seam for a simulator, worked trace, explorable diagram, or other UI
that does not fit the closed set of first-party React experiments.

This is an application-internal trusted source contract. It does not add
executable fields to Learning Packs, Question Groups, feeds, or namespaced
extensions, and it is not a remote plugin API. See
[ADR-0001](./decisions/0001-portable-content-and-trusted-extensions.md)
and
[ADR-0002](./decisions/0002-trusted-interactive-frames.md).

## Data and execution flow

```text
person or coding agent
        |
        | writes reviewed .html + .css + .js and a typed definition
        v
defineTrustedInteractive()
        |
        | validates identity, limits, capabilities, events, and checkpoints
        v
source-hashed bundle + injected visual contract
        |
        | private MessageChannel
        v
opaque-origin iframe: sandbox="allow-scripts"
        |
        | context.get · state.save · events.record · progress.request
        v
host-owned state, visit diagnostics, checkpoint policy, progress,
resizing, and error handling
```

Agents act in the first step. The deployed learner runtime never invokes a
model or downloads authored executable code.

## Author a definition

Keep the three authored sources in separate files when that makes them easier
to generate and review:

```text
app/features/trusted-interactives/request-context/
  definition.ts
  interactive.html
  interactive.css
  interactive.js
```

The first reference implementation is the
[causal-attention definition](../app/features/trusted-interactives/definitions/causal-attention/definition.ts),
which keeps deterministic model output in host input and uses raw source files
for the frame.

Vite raw imports preserve those files as source strings:

```ts
import {
  TRUSTED_INTERACTIVE_SCHEMA_VERSION,
  defineTrustedInteractive,
} from "@/app/features/trusted-interactives/contract";
import html from "./interactive.html?raw";
import css from "./interactive.css?raw";
import javascript from "./interactive.js?raw";

export const requestContextInteractive = defineTrustedInteractive({
  schemaVersion: TRUSTED_INTERACTIVE_SCHEMA_VERSION,
  id: "request-context-ledger",
  definitionVersion: 1,
  stateSchemaVersion: 1,
  title: "Request context ledger",
  description: "Compare three actions that share one message snapshot.",
  source: { html, css, javascript },
  initialState: { mode: "idle", comparedModes: [] },
  input: { messageId: "m-u3", requestIds: ["r-31", "r-32", "r-33"] },
  frame: {
    title: "Interactive request context comparison",
    minimumHeight: 420,
    maximumHeight: 900,
  },
  appearance: { palette: "paper" },
  capabilities: [
    "context.get",
    "state.save",
    "events.record",
    "progress.request",
  ],
  events: ["comparison-run"],
  completionCheckpoints: ["compare-two-modes"],
  authoring: {
    learningObjective: "Explain which state belongs to a message and which belongs to each action.",
    learnerAction: "Run isolated and shared context while holding the message and actions fixed.",
    evidence: "Two trusted transitions that record isolated and then shared mode.",
    requestedVisualElements: ["stage", "control-row", "metric", "status"],
  },
});
```

Register the definition in the host-owned registry **and add an executable
checkpoint validator there**. A lesson carries only a trusted
`{ id, definitionVersion }` reference; it does not carry executable source,
choose runtime authority, or define its own completion policy. Declaring a
checkpoint in `completionCheckpoints` only allowlists the request name; it does
not make the checkpoint valid.

For example, add the definition import and a typed registration beside the
registry's reviewed entries:

```ts
const requestContextRegistration = {
  definition: requestContextInteractive,
  validateCheckpoint: ({
    checkpointId,
    payload,
    savedState,
    evidence,
  }) => {
    const completion = evidence.completionInteraction;
    if (
      checkpointId !== "compare-two-modes"
      || !completion
      || !isPlainRecord(payload)
      || !isPlainRecord(savedState)
      || !Array.isArray(payload.comparedModes)
      || !Array.isArray(savedState.comparedModes)
    ) return false;

    const isolated = evidence.transitions.find((transition) =>
      isPlainRecord(transition.beforeState)
      && transition.beforeState.mode === "idle"
      && isPlainRecord(transition.afterState)
      && transition.afterState.mode === "isolated"
      && Array.isArray(transition.afterState.comparedModes)
      && transition.afterState.comparedModes.length === 1
      && transition.afterState.comparedModes[0] === "isolated"
    );
    if (!isolated) return false;

    return savedState.mode === "shared"
      && payload.comparedModes.length === 2
      && savedState.comparedModes.length === 2
      && ["isolated", "shared"].every((mode) =>
        payload.comparedModes.includes(mode)
        && savedState.comparedModes.includes(mode)
      )
      && evidence.transitions.some((transition) =>
        transition.interaction.sequence > isolated.interaction.sequence
        && transition.interaction.sequence === completion.sequence
        && transition.interaction.kind === completion.kind
        && isPlainRecord(transition.beforeState)
        && transition.beforeState.mode === "isolated"
        && Array.isArray(transition.beforeState.comparedModes)
        && transition.beforeState.comparedModes.length === 1
        && transition.beforeState.comparedModes[0] === "isolated"
        && isPlainRecord(transition.afterState)
        && transition.afterState.mode === "shared"
        && Array.isArray(transition.afterState.comparedModes)
        && transition.afterState.comparedModes.length === 2
        && transition.afterState.comparedModes.includes("isolated")
        && transition.afterState.comparedModes.includes("shared")
      );
  },
} satisfies TrustedInteractiveRegistration;
```

Add `requestContextRegistration` to `registrations`. Validate the payload and
saved state, then require the host-owned trusted-interaction transitions that
demonstrate the named learner action. Do not accept a frame-authored boolean,
event record, or first click as completion evidence.

Use lowercase hyphenated identifiers. Increment `definitionVersion` for a
behavioral definition change and `stateSchemaVersion` when saved state changes
shape or meaning. The build derives a SHA-256 source identity from the authored
HTML, CSS, and JavaScript. A changed version, schema, or source hash does not
silently restore old state.

## Use the frame API

The fixed bootstrap exposes one frozen global:

```js
const session = await globalThis.Latent.connect();

render(session.state, session.input, session.visual);

document.querySelector("#run-mode").addEventListener("click", async () => {
  const prior = session.state;
  if (prior.mode === "shared") return;
  const nextMode = prior.mode === "idle" ? "isolated" : "shared";
  const nextState = {
    ...prior,
    mode: nextMode,
    comparedModes: [...prior.comparedModes, nextMode],
  };
  await session.saveState(nextState);
  await session.record("comparison-run", { mode: nextMode });
  render(nextState, session.input, session.visual);

  if (nextMode === "shared") {
    const result = await session.requestCompletion("compare-two-modes", {
      comparedModes: nextState.comparedModes,
    });
    showCompletionResult(result);
  }
});
```

`connect()` hydrates before it resolves. Do not enable stateful controls until
that promise succeeds.

| Frame API | Contract |
| --- | --- |
| `state` | A cloned snapshot restored for the exact definition identity |
| `input` | Frozen, bounded host input for the lesson instance |
| `visual` | Frozen semantic colors, type, spacing, breakpoints, preferences, and reviewed element recipes |
| `identity` | Frozen course, lesson, interactive, version, schema, and source identity |
| `storage` | Host-reported storage status; inspect it but do not treat it as authority |
| `saveState(nextState)` | Queued compare-and-swap save of bounded JSON; resolves with the accepted snapshot |
| `record(event, payload)` | Records an allowlisted, visit-local diagnostic event |
| `requestCompletion(checkpointId, payload)` | Asks the host to validate an allowlisted checkpoint after pending saves |

The definition must request `context.get` and each optional capability it uses.
Event and checkpoint identifiers must also appear in their definition
allowlists. `events.record` retains only bounded diagnostics for the current
visit; it is never durable learning evidence and can never update progress.
A completion request is not a grant: the host validates the checkpoint,
payload, saved state, host-owned interaction evidence, definition identity,
and lesson policy.

Host-owned interaction evidence is scoped to the mounted visit even though
interactive state can survive a reload. A restored but incomplete activity
must therefore collect fresh trusted transitions before requesting completion;
for example, a Replay action can increment a saved run counter and reset the
comparison set before the learner makes the second choice. Once lesson
completion has been durably recorded, the host treats the same allowlisted
checkpoint as idempotently accepted after a remount.

The host renders the durable **Reset interactive** control outside the frame.
It compare-and-deletes the exact saved record and remounts from the
definition's initial state without revoking lesson completion. An authored
control may reset a narrower domain state through `saveState`, but it must not
pretend to clear host storage or progress. Keep asynchronous run identities in
state or local control flow so that a result from before reset cannot
overwrite the new run.

## Limits

The v1 contract rejects input outside these bounds:

| Resource | Limit |
| --- | ---: |
| HTML | 180,000 UTF-8 bytes |
| CSS | 180,000 UTF-8 bytes |
| JavaScript | 320,000 UTF-8 bytes |
| Injected visual CSS | 80,000 UTF-8 bytes |
| Complete bundle | 700,000 UTF-8 bytes |
| Saved state | 32,000 UTF-8 bytes |
| One frame request | 64,000 UTF-8 bytes |
| One host response | 160,000 UTF-8 bytes |
| JSON depth / nodes | 16 / 4,000 |
| Active host requests | 12 |
| Declared frame height | 240–2,000 px |

HTML is a body fragment; put CSS and JavaScript in their separate source
fields. Script, style, base, metadata, link, iframe, object, embed, anchor, and
form elements are rejected, as are inline event handlers and `srcdoc`.
URL-bearing HTML attributes are rejected except fragment-only `href` values.
CSS cannot use `@import` or `url(...)` except for fragment references.
JavaScript source admission rejects direct navigation, external-load
attributes and elements, window opening, network APIs, workers, dynamic
imports, and document replacement. Use a narrow reviewed host capability if a
future interaction genuinely needs new authority.

The frame CSP denies network connections, workers, child frames, navigation
bases, forms, external fonts, general object loading, and navigation where
supported. The host also treats any subsequent frame load as a navigation
attempt and revokes that frame session. Data and blob image or media directives
remain available inside the CSP, but source admission prevents authored code
from constructing or assigning general external-load elements.

## Isolation and authority

The host creates a fixed `srcdoc` containing only the hash-authorized
bootstrap. It transfers the verified source bundle over a per-frame
`MessageChannel`, and the frame verifies both its source hash and bundle hash
before installing authored CSS and running authored JavaScript from a blob.

The iframe has `sandbox="allow-scripts"` without `allow-same-origin`, so it has
an opaque origin and cannot share application storage. The host ignores
authored global messages after transferring the private port. Every request is
schema checked, size checked, allowlist checked, bounded in concurrency, and
answered or rejected by host code.

These source checks, the sandbox, CSP, opaque origin, and private protocol are
defense in depth around reviewed source. They are not a hostile-code sandbox
and do not provide CPU or general resource containment: authored JavaScript can
still loop forever or exhaust the frame's renderer resources. Do not run
remote or unreviewed source, and do not weaken the boundary to make an
interactive convenient. Add a narrow host capability and review it when the
learning experience genuinely needs new authority.

## Visual and learning contract

The host injects a Course Kit palette, the lesson accent, type stacks, an
eight-step spacing scale, focus and motion rules, and a few optional utility
classes:

- `.latent-stage`
- `.latent-control-row`
- `.latent-segments`
- `.latent-metric`
- `.latent-status`
- `.latent-code`

Authored CSS remains free to construct the right visual model. Start with
semantic `--latent-*` variables and the injected context instead of copying
page colors. Prefer one border-led evidence plane, exact values, restrained
depth, native controls, and a real mobile recomposition. Do not reproduce the
page header or turn every value into a card.

The authoring metadata is reviewable intent, not learner copy and not progress
logic. It should make the objective, learner action, expected evidence, and
requested visual elements explicit enough that a reviewer can compare the
implementation with its teaching claim.

## Validation

Test the definition, source and bundle hashes, protocol validation, capability
denials, state compare-and-swap, checkpoint policy, resize clamping, error
reporting, and disposal. Then run:

```bash
npm run validate
```

In a browser, exercise desktop and 390 px layouts, keyboard-only flow, reduced
motion, refresh, reset, success, failure or cancellation, and late results.
Inspect console errors and verify that completion happens only after the named
evidence. Report automated checks separately from manual browser observations.
