---
name: author-question-group
description: Create or improve a portable Neural Chalk Question Group library for programming practice. Use when a user asks an agent to write method-style coding problems, group practice questions, add declarative cases and assertions, or prepare self-hosted practice content.
---

# Author Question Group

Work in the **portable content layer**. A Question Group describes learner
code, cases, and bounded assertions; it never grants runtime authority.

## Read the contract

Resolve the contract before authoring:

- In a Neural Chalk checkout, read `docs/question-groups.md`,
  `packages/course-kit/schema/question-group-library.schema.json`, and
  `examples/learning-platform/javascript-array-methods/content/question-groups.json`.
- From the installed Neural Chalk plugin, read
  `../../references/question-groups.md`,
  `../../references/question-group-library.schema.json`, and
  `../../references/question-group-library.example.json`, resolving those
  paths from this `SKILL.md` directory.

Use the checkout files when both locations exist. The plugin bundle records
the exact source digests for its copies in `../../references/bundle-manifest.json`.
Use the exact Course Kit commands documented in the guide.

Define the audience and two to five observable objectives. Record authorship,
license, provenance, and source support at the library level. Map every group
and question to relevant objectives and sources.

For each question:

- prefer TypeScript for new browser questions; use JavaScript when the learning
  objective is specifically JavaScript, and use Python only when the host
  explicitly supports it;
- name one function or class-method entrypoint;
- provide a small starter file with typed parameters and a typed return value,
  plus concrete constraints;
- include at least one visible example and one non-example check;
- express expected behavior only with supported declarative assertions;
- include boundaries that distinguish a robust solution from the obvious
  partial implementation.

Type-bearing starter signatures are the default. Use native annotations in
TypeScript and Python. In an intentionally JavaScript-only question, add JSDoc
`@param` and `@returns` annotations immediately above the entrypoint. Keep the
types local and dependency-free; a type hint guides the learner but does not
grant runtime authority or replace behavioral cases.

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

When working in the Neural Chalk source tree, build Course Kit and replace
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
