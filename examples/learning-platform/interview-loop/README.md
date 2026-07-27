# Interview Loop Lab

A Python-first, three-module course for experienced software engineers preparing behavioral
stories, coding solutions, and reusable system-architecture discussions. The
technical exercises share a webhook-delivery scenario so coding decisions can
be carried into failure-mode, scaling, observability, and tradeoff analysis.
All learner-visible code—the lesson sketch, three portable questions, and the
trusted coding-lab exercise—is Python.

Learners move among **Modules**, **Practice**, **Review**, and **Coding lab**,
see module progress, and resume device-local work. Interview Loop keeps its
course-specific lesson, quiz, card, and IDE sections in one vertical document
flow while using the same
typography, navigation, controls, feedback, progress, focus treatment, and
responsive shell as
[Ten Problems](../ten-problems/).

The portable practice questions and trusted coding follow-up each include a
closed, read-only **View example solution** disclosure. Reference source is
reviewed repository input, not Learning Pack or Question Group data; opening
it neither replaces the learner draft nor changes progress.

The page has one learner header: Interview Loop identity, local navigation,
and one **Learning suite** disclosure for the learning suite. On mobile, local
navigation moves into that disclosure; module controls remain inside the
course layout instead of becoming another site header.

This is original, transferable preparation. It does not reproduce or predict
the private interview process, rubric, or questions of Stripe, OpenAI,
Anthropic, or any other employer.

[Open the hosted course](https://model-systems-labs.github.io/latent/interview-loop/).

The current learner UI v2 revision has local production-build, desktop,
mobile, keyboard, Python execution, and persistence evidence recorded in
[AUTHORING.md](./AUTHORING.md). Live evidence is recorded there only after a
deployment has been verified.

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

The reviewed source of truth for the shared presentation is
`packages/course-kit/src/learner-ui.ts`. The example consumes its generated,
dependency-free browser bundle at `tools/vendor/learner-ui.mjs` during a
monorepo build;
`platform.json` explicitly supplies its product name, navigation labels and
hash routes, `sage` appearance palette, and footer. The palette changes color
identity and line tint, while every palette shares the same sparse,
scroll-reactive ethereal atmosphere and component behavior; the other reviewed
choices are `paper`, `cobalt`, `plum`, and `graphite`. The example has no runtime
dependency on a hosted stylesheet, JavaScript service, framework CDN, or model
API.

Read [GUIDE.md](./GUIDE.md) for the course map, shared/specialized source
boundaries, and practice sequence. Read [AGENTS.md](./AGENTS.md) before asking
a coding agent to change the learner experience. The originating prompt and
revision handoffs are preserved in [AUTHORING.md](./AUTHORING.md).

Application source is licensed under Apache-2.0; see [LICENSE](./LICENSE) and
[NOTICE.md](./NOTICE.md). Teaching and practice content is licensed separately
under CC-BY-4.0; see [CONTENT_LICENSE.md](./CONTENT_LICENSE.md).
