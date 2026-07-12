# Artifact Runtime

Artifact Runtime is independent from the LMS and the learner-code sandbox. It
stores immutable, content-addressed artifacts produced by recorded runs,
host-validated learner implementations, and passing project builds.

The core package provides:

- stable SHA-256 identities and tamper validation;
- explicit lineage links between inputs, checkpoints, and derived outputs;
- deterministic replay frames with domain-neutral clocks;
- metric and payload comparison;
- a portable `latent-artifact` JSON bundle; and
- an optional Dexie storage adapter.

Course-specific titles, lesson order, and recorded model checkpoints live in
`app/features/artifacts`. The runtime itself does not import curriculum or React
code, so it can be extracted into a standalone package without changing its
contracts.
