# Browser Lab UI compatibility

This directory contains only the small result and build-gate view models still
used by the IDE. The reusable trust boundary lives in
`@latent/browser-lab`: an esbuild worker, disposable QuickJS workers,
host-owned contracts, source-bound receipts, and immutable build artifacts.

No learner source is evaluated in the React page realm.
