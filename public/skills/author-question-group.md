---
name: author-question-group
description: Create or improve a portable Latent Question Group library for programming practice. Use when a user asks an agent to write method-style coding problems, group practice questions, add declarative cases and assertions, or prepare self-hosted practice content.
---

# Author Question Group

Work in the **portable content layer**. A Question Group describes learner
code, cases, and bounded assertions; it never grants runtime authority.

## Read the contract

Read `docs/question-groups.md`, the checked-in Question Group schema, and a
complete example. Use the exact Course Kit commands documented there.

Define the audience and two to five observable objectives. Record authorship,
license, provenance, and source support at the library level. Map every group
and question to relevant objectives and sources.

For each question:

- use JavaScript or TypeScript unless the host explicitly supports Python;
- name one function or class-method entrypoint;
- provide a small starter file and concrete constraints;
- include at least one visible example and one non-example check;
- express expected behavior only with supported declarative assertions;
- include boundaries that distinguish a robust solution from the obvious
  partial implementation.

## Respect the layer

Edit `question-groups.json` or another library JSON file. Do not edit the
runtime, practice player, persistence, host contracts, or trusted IDE checks.
Do not add arbitrary scripts, dependency imports, network access, time-based
checks, or model calls. A reader decides whether to execute validated content.

## Validate and build

Run the full Question Group validation and static-player build commands from
`docs/question-groups.md`; JSON Schema alone is not the release gate:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-course-kit-0.2.0.tgz

npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning questions validate <library.json> --strict --json
npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning questions build <library.json> --out-dir <site> --json
npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning questions serve <site>
```

When working in the Latent source tree, build Course Kit and replace
each `npm exec ... -- latent-learning` prefix with
`node packages/course-kit/bin/latent-learning.mjs`. In the tiny platform, also
run:

```bash
npm run validate
npm run build
```

Preview the visible example, failing and passing submissions, progress, and the
leech-only query. Report library identity, group/question/case counts,
objective coverage, exact validation result, build path, and unverified
runtime behavior.
