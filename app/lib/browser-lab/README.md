# Browser Lab

Browser Lab is the reusable, course-agnostic layer behind Latent's project IDE.

It currently provides:

- versioned device-local stores with change subscriptions;
- virtual source-file and contract types;
- isolated behavioral-contract execution;
- test-suite summaries and last-passing-build gates.

The LLM course supplies the curriculum, source files, assertions, compiler, and
runtime adapters. Browser Lab does not know about Transformers, SSE, React, or
the Latent lesson sequence, so another technical course can reuse the same
authoring and verification lifecycle.

The boundary is intentional:

- **LLM runtime systems** model prefill, decode, KV-cache memory, and scheduling.
- **Mock backend systems** provide deterministic transport, cancellation,
  retry, failure, and observability behavior around that runtime.
- **Product code** consumes the tested boundary without pretending the mock
  backend performs model computation.
