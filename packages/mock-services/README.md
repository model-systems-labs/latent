# Mock Services

Mock Services is the deterministic backend-simulation layer for Latent. It owns
HTTP handlers, SSE framing, cancellation, retryable failure scenarios, and
timing controls. It has no LMS, React, lesson-content, persistence, or model
runtime dependencies.

The package exposes both the transport primitives and an MSW generation
handler. Product exercises therefore consume a realistic network contract
without coupling course navigation to backend simulation state.
