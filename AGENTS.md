# Repository guidance for coding agents

## Platform extension modes

Read these before changing a public format, runtime boundary, or extension
workflow:

- `docs/v0.2-launch-contract.md`
- `docs/release-status.json`
- `docs/architecture.md`
- `docs/decisions/0001-portable-content-and-trusted-extensions.md`

Latent has two extension paths:

- Portable content is untrusted declarative data owned by Course Kit.
- IDE integrations, runtime adapters, behavioral checks, UI, and persistence
  are trusted repository source that must pass normal review and validation.

Agents act at authoring and build time. Do not add a model-specific generation
dependency, an implicit agent call, or a remote executable plugin to the
learner runtime.

## Open learning

Use the public Learning Pack v1 seam for user-hosted lessons and flash cards. Do not add model-specific generation code to the learner runtime.

Read these before changing the format or publishing workflow:

- `docs/open-learning.md`
- `docs/learning-pack.schema.json`
- `docs/learning-feed.schema.json`
- `docs/learning-pack-quality-rubric.md`
- `examples/open-learning/reliable-llm-changes/learning-pack.json`
- `docs/question-groups.md`
- `packages/course-kit/schema/question-group-library.schema.json`

Core rules:

- Preserve existing compiled first-party lessons and their privileged browser runtimes.
- Keep community packs declarative. Never execute remote JavaScript, HTML, CSS, MDX, React, Python, workers, iframes, npm packages, or authored tests.
- Render authored strings as text.
- Require HTTPS outside loopback preview, no redirects, same-origin relative package URLs, streamed byte limits, canonical UTF-8, exact metadata, and SHA-256 integrity.
- Treat `package-id@version` as immutable.
- Namespace saved content by publisher origin, package, and version; bind progress to the exact digest.
- Keep CLI builds and previews inside fresh, marker-owned directories; never follow output or served-file symlinks.
- Keep integrity, publisher identity, editorial review, and certification as separate claims.
- Keep a central directory optional. A valid pack must work from a publisher-controlled static URL without Latent.
- Use namespaced metadata for experimental extensions; unknown extensions receive no new runtime capability.
- Treat Question Groups as a preview data contract. Hosting a library does not
  authorize Latent to execute it.
- Keep publisher-authored tests data-only. The application owns executable
  behavioral contracts and runtime adapters.
- Do not describe Python Lab as a hostile-code security sandbox.
- Preserve the data and execution flow: Course Kit validation → application
  adapter → host-owned contract → sandbox worker → UI and progress. Module
  dependencies point from the application to leaf packages, never the reverse.

Before committing open-learning changes:

```bash
npm run open-learning:validate
npm run open-learning:schema
npm run open-learning:generate
npm run validate
```

The generated schema and example static site are committed. Regenerate them and verify there is no unexplained diff.
