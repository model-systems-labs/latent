# Latent

**Ask an agent to build the course you wish existed.**

Latent is an open-source framework for creating interactive courses with
coding agents. Describe what you want, preview it, critique it, and revise it.
The finished course is a static site you own—no Latent account, hosted model,
or execution server required.

[![Validate](https://github.com/model-systems-labs/latent/actions/workflows/ci.yml/badge.svg)](https://github.com/model-systems-labs/latent/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue.svg)](./LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey.svg)](./CONTENT_LICENSE.md)

[![Watch an agent create and revise Interview Loop Lab](./docs/readme/agent-course-demo-poster.png)](./docs/readme/agent-course-demo.webm)

**Live examples:** [Learning Studio](https://model-systems-labs.github.io/latent/)
— choose a complete course or focused practice ·
[Build an LLM System](https://model-systems-labs.github.io/latent/llm-systems/)
— 14 browser labs that become a working chat capstone ·
[Interview Loop Lab](https://model-systems-labs.github.io/latent/interview-loop/)
— behavioral, coding, and architecture preparation ·
[Ten Problems](https://model-systems-labs.github.io/latent/practice/)
— focused Python practice with saved drafts and review.

[Watch the Interview Loop demo](./docs/readme/agent-course-demo.webm) ·
[Source](./examples/learning-platform/interview-loop) ·
[Authoring record](./examples/learning-platform/interview-loop/AUTHORING.md)

## Make a course

```bash
git clone https://github.com/model-systems-labs/latent.git
cd latent
npm ci
```

Open the folder in your coding agent. Then ask:

```text
Read skills/author-learning-platform/SKILL.md and use that workflow to create
an interview course for experienced engineers preparing for high-bar product
and AI infrastructure companies. Include behavioral drills, progressive
coding practice, and a worked system-design framework. Build it, validate it,
and start a preview.
```

Preview the result and respond like an editor:

```text
This still feels like one long lesson. Split it into three modules with
progress and resume. Show a weak behavioral answer and coached rewrite.
Add a harder coding boundary case and make the architecture tradeoffs explicit.
```

Keep going until it is yours. The agent changes the content and platform
source, runs the validation gates, and leaves behind a project you can inspect,
version, and deploy. The workflow lives in
[`skills/author-learning-platform/SKILL.md`](./skills/author-learning-platform/SKILL.md),
so any agent that can read and edit the repository can follow it.

## What you get

- Lessons, knowledge checks, flash cards, coding practice, and browser IDEs.
- Browser-local workers and reviewed WebAssembly runtime adapters, so coding
  practice can run without a hosted execution service.
- Device-local learner progress and a deterministic static build deployable to
  GitHub Pages, S3, Cloudflare Pages, Netlify, or any static host.

Agents act during authoring and build, not inside the learner runtime. Portable
course packs stay declarative; executable checks, runtimes, UI, and persistence
remain reviewed repository source.

Start with the [five-minute guide](./docs/getting-started.md), read the
[architecture](./docs/architecture.md), or [contribute](./CONTRIBUTING.md).
Run `npm run validate` before opening a pull request.

Course Kit v0.2.0 is available as a
[pinned release artifact](https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-course-kit-0.2.0.tgz).
Code is [Apache-2.0](./LICENSE). Identified educational content is
[CC BY 4.0](./CONTENT_LICENSE.md).
