# Interview Loop Lab

A Python-first Latent example for experienced software engineers preparing
behavioral stories, coding practice, and reusable system-architecture
discussions. The technical exercises share a webhook-delivery scenario so
coding decisions can be carried into failure-mode, scaling, observability, and
tradeoff analysis. All learner-visible code—the lesson sketch, three portable
questions, and the trusted IDE exercise—is Python.

This is original, transferable preparation. It does not reproduce or predict
the private interview process, rubric, or questions of Stripe, OpenAI,
Anthropic, or any other employer.

[Open the hosted course](https://model-systems-labs.github.io/latent/interview-loop/).

```bash
npm run validate
npm run preview
```

Run these commands from a Latent monorepo checkout with its workspace
dependencies installed; Node 22.13 or newer is required. Validation is
offline. The preview command validates, packages the same-origin Pyodide
314.0.2 runtime, builds `dist/`, and serves that exact static artifact on
loopback. Once built, the learner experience does not fetch Python from a CDN.

The Python exercises run through the trusted Python Lab adapter with
host-owned result, post-call input-equality, and nested-alias checks. The
input check compares values when the call returns; it does not claim to detect
transient mutate-then-restore operations. Python Lab is not a hostile-code
security sandbox.

Read [GUIDE.md](./GUIDE.md) for the project map and practice sequence. Read
[AGENTS.md](./AGENTS.md) before asking a coding agent to change the platform.
The originating prompt and validated first-pass handoff are preserved in
[AUTHORING.md](./AUTHORING.md).

Platform source is licensed under Apache-2.0; see [LICENSE](./LICENSE) and
[NOTICE.md](./NOTICE.md). Teaching and practice content is licensed separately
under CC-BY-4.0; see [CONTENT_LICENSE.md](./CONTENT_LICENSE.md).
