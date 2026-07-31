---
name: author-interactive
description: Create or improve a trusted, stateful HTML/CSS/JavaScript interactive inside a Latent lesson. Use when a user asks for a simulator, explorable diagram, visualizer, worked trace, custom lesson UI, or other arbitrary browser interaction that must save state, submit checkpoint evidence, or complete a learning checkpoint.
---

# Author Interactive

Work only in the **trusted platform source layer**. The frame source is
reviewed, tested, and compiled with the application; it is not portable
content or a remotely loaded plugin.

## Read the contract

Read `docs/decisions/0001-portable-content-and-trusted-extensions.md`,
`docs/decisions/0002-trusted-interactive-frames.md`,
`docs/trusted-interactives.md`, and
[`references/visual-and-learning-contract.md`](author-interactive-visual-and-learning-contract.md).
Inspect the nearest trusted interactive and its tests before editing.

Never put executable HTML, CSS, or JavaScript in a Learning Pack, Question
Group, feed, or namespaced extension. Do not add a model call, downloaded code,
CDN asset, package loader, or authored test to the learner runtime.

## Define the learning contract

Before styling, name:

- one observable objective and the misconception it should expose;
- one concrete worked trace with numerically consistent inputs and outputs;
- the learner-controlled variable, the invariant, and the inference limit;
- the smallest meaningful checkpoint that can affect progress; and
- the state identity, schema version, defaults, and reset behavior.

Prefer one coherent causal model over a generic collection of controls.
Include success, failure or cancellation, cleanup, and stale-result behavior
when the concept has those paths.

## Build through the trusted frame seam

Keep the frame self-contained. Use arbitrary semantic HTML, authored CSS, and
JavaScript inside the reviewed definition, then register that definition in
the host-owned lesson mapping. Add a host registry checkpoint validator for
every meaningful completion request; declaring a checkpoint only allowlists
its name and never makes a frame claim authoritative.

Add a typed registration to
`app/features/trusted-interactives/registry.ts`; validate payload and saved
state, then require the host-owned trusted-interaction transition that
demonstrates the learner action. For a definition whose initial state is
`{ mode: "idle", comparedModes: [] }`:

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

Add that registration to `registrations`. Do not accept a frame-authored
boolean, event record, or first click as completion evidence.

Request only the capabilities the interaction needs. Connect through
`globalThis.Latent.connect()` for context, bounded JSON state, allowlisted
events, and checkpoint requests. Let the fixed bootstrap report height and
runtime errors. Do not reach through `parent`, use browser storage, navigate,
open windows, fetch, import remote modules, or treat message events as
authority.

Keep HTML to a body fragment without active links, forms, inline handlers, or
URL-bearing attributes other than fragment `href`; keep CSS free of `@import`
and non-fragment `url(...)`. Source admission rejects direct JavaScript
navigation, networking, workers, dynamic import, document replacement, and
external-load construction or assignment. Any later iframe load revokes the
session.

Treat source admission, sandbox, CSP, navigation checks, and the private bridge
as defense in depth for reviewed source. This is not a hostile-code or
CPU/resource-containment sandbox: authored JavaScript can still loop forever.
Never load remote or unreviewed executable source.

Hydrate state before enabling stateful controls. Persist after meaningful
transitions, provide an explicit reset, and ignore late asynchronous results
after reset or replacement. Let the host decide whether a valid checkpoint
updates progress; mounting the frame is never completion. Use `events.record`
only for bounded visit-local diagnostics, never as durable evidence or
progress.

## Match the lesson

Use the injected visual tokens first while retaining freedom to compose a
purpose-built visualization. Keep the surface editorial, border-led, readable,
and responsive. Use native controls, visible labels, keyboard focus, status
announcements, reduced-motion behavior, and an honest narrow-screen layout.
Do not recreate page navigation or surround every element with a card.

## Validate

Run the focused definition, protocol, and lesson rendering tests, then:

```bash
npm run validate
```

Exercise the interaction at desktop width and 390 px, with keyboard only,
reduced motion, reload, reset, and every advertised terminal path. Check
malformed and oversized bridge calls, denied capabilities, stale messages,
console errors, and height changes. Report changed trusted files, frame
identity and version, requested capabilities, checkpoint semantics, automated
results, and any browser behavior not exercised.
