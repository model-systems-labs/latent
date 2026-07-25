# Browser Lab UI compatibility

This directory contains only the small result and build-gate view models still
used by the IDE. The reusable trust boundary lives in
`@latent/browser-lab`: an esbuild worker, disposable QuickJS workers,
host-owned contracts, source-bound receipts, and immutable build artifacts.

No learner source is evaluated in the React page realm.

Trusted JavaScript and TypeScript exercises should enter through
`app/platform/ide/browser-extension-host.tsx`. That composition injects the
existing CodeMirror editor, the `@latent/browser-lab` runtime adapter, and
application persistence into a framework-neutral Browser IDE session. Course
definitions provide files and host-owned checks; they do not import this
compatibility directory or application-private lesson components.
