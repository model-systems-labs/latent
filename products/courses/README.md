# Latent Courses product

This folder owns the learner-facing identity of Latent Courses. It is separate
from the framework product in the code layout, but it remains in the same
repository today.

## Responsibilities

- Present a clear learner homepage and entry points into the four released
  courses.
- Connect learners to practice, flash cards, sources, projects, and capstones
  without mixing in publisher or platform-maintainer workflows.
- Own course-product branding and deployment metadata.
- Keep learner-facing product decisions separable from framework and
  publishing decisions.

`CoursesLanding.tsx` is mounted at the application root. Course routes, lesson
implementations, runtime adapters, persistence, and reference content remain
shared under root `app/`, `packages/`, and related directories for now.

## Hosting profile

`.openai/hosting.json` in this folder belongs only to the Latent Courses
deployment. The course-specific build selects that nested profile explicitly;
the repository root does not carry a default Sites target.

Run the explicit learner build from the repository root:

```bash
npm run build:courses
```

That build selects this homepage, hosting profile, and learner-specific
`llms.txt`. It still compiles the shared application route tree, including
framework routes; this folder is not an independent application workspace yet.

The profile is deployment metadata, not a secret, an endorsement claim, or a
runtime permission. Access policy is configured at the hosting layer, and all
portable-content security rules still apply.

## Future extraction

This folder is an intended extraction target for moving Latent Courses into
its own repository later. It is not yet a clean dependency seam. That is a
future architectural option, not the current state. A real extraction would
need to make the shared application, runtime, and curriculum dependencies
explicit while preserving the reviewed-source and portable-data boundary.

Until then, prefer product-specific code here and reusable code at the
repository root. Do not duplicate shared runtimes or weaken the content
contracts merely to make the folder appear standalone.
