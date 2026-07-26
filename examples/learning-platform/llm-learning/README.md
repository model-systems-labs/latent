# Full browser-course example

This folder owns the full, reviewed learning project demonstrated by Latent
Courses: the foundation courses, Harness Engineering, and the cumulative LLM
Systems course. It is example source consumed by the reference deployment, not
part of the reusable application or a storage location for courses published
through Open Learning.

- `content/` owns curriculum manifests, learning outcomes, flash cards,
  programming-practice data, project templates, and host-owned exercise
  contracts.
- `lessons/` owns the bundled lesson definitions and catalog composition.

These files are trusted repository source because the reference courses include
browser IDE integrations and executable behavioral checks. Changes pass normal
source review and repository validation before deployment.

## Dependency direction

The reusable application may mount this example to produce the Latent Courses
showcase. This example may import public `@latent/*` packages, but it must not
import `app/` or `products/`. Application-specific composition, persistence,
and UI policy stay in the application and are injected where the example needs
them.

That one-way dependency makes the intent explicit:

```text
app + products/courses
          ↓ mounts
examples/learning-platform/llm-learning
          ↓ uses
public @latent/* packages
```

Portable courses that a publisher owns belong in `courses/authored/` (or any
publisher-controlled working directory), use the public Learning Pack format,
and are hosted independently. They are never activated as trusted source merely
because their files or URLs are available.

This example is deliberately more capable than a portable Learning Pack because
its executable checks are reviewed and compiled with the host. The smaller
`examples/learning-platform/javascript-array-methods/` example shows the
generated dependency-free platform shape.
