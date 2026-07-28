---
name: author-ide-exercise
description: Add or improve a trusted JavaScript or TypeScript browser IDE exercise in a Latent platform. Use when a user asks an agent to create an editable coding exercise, starter files, application-owned behavioral checks, or a lesson-specific editor integration.
---

# Author IDE Exercise

Work in the **trusted platform source layer**. IDE exercises are reviewed code,
not remotely loaded content.

## Read the seam

Read `docs/architecture.md`,
`packages/browser-lab/src/ide-extension.ts`, and the nearest existing exercise.
Use `defineBrowserIdeExtension` for the reviewed definition and
`createBrowserIdeSession` with `createBrowserLabIdeRuntime` for execution. The
full application composes that definition through
`app/platform/ide/browser-extension-host.tsx`; do not import
application-private lesson components from a reusable package.

Define:

- one observable programming outcome;
- TypeScript source files by default, or JavaScript when the learning objective
  is specifically JavaScript, plus an explicit entrypoint;
- small starter code with typed parameters and a typed return value and no
  hidden dependency;
- deterministic host-owned checks, including a boundary case;
- persistence identity and contract version;
- accessible instructions and expected failure feedback.

Use native annotations in TypeScript and in a host-reviewed Python exercise.
In an intentionally JavaScript-only exercise, put JSDoc `@param` and `@returns`
annotations immediately above the entrypoint. Keep the types local and
dependency-free; runtime behavior is still established by the host-owned
checks.

Prefer the hardened browser runtime. Do not claim remote Python execution or a
hostile-code security sandbox.

## Respect the layer

Edit trusted exercise definitions, adapters, UI composition, and tests. Do not
place executable checks in Learning Pack or Question Group JSON. Do not let
remote metadata select workers, imports, network access, or application
capabilities.

In the tiny starter, edit `trusted/ide-exercises.mjs`. In the full reference
application, inject editor, runtime, files, checks, and persistence through the
supported exercise seam.

## Validate

Run the narrow package and exercise tests, then the repository validation gate:

```bash
npm run validate --workspace @latent/browser-lab
node --test tests/ide-extension-seam.test.mjs
npm run validate
```

Exercise the starter state, a representative failure, every check, timeout or
cancellation, stale-result rejection, reload persistence, and keyboard flow.
Report changed trusted files, runtime used, contract identity, automated
results, and unverified browser behavior.
