# Agent course demo

This is a browser replay of a real, three-turn agent authoring run. Idle time
is compressed; the prompts, course files, validation results, and browser
output are real.

The video intentionally avoids product-specific agent UI. Its opening cards
replay excerpts from the actual prompts, then the capture navigates the
generated course running from its built static output. It does not present a
simulated transcript as a live screen recording.

The complete originating prompt, first-pass result, verbatim revision
feedback, before/after counts, and validation evidence are preserved in
[`examples/learning-platform/interview-loop/AUTHORING.md`](../../examples/learning-platform/interview-loop/AUTHORING.md).

## Reproduce the capture

Start the example preview:

```bash
cd examples/learning-platform/interview-loop
npm run preview
```

Pass the printed loopback URL to the capture script:

```bash
node docs/readme/capture-agent-course-demo.mjs http://127.0.0.1:PORT/
```

The script writes:

- `agent-course-demo.webm`
- `agent-course-demo-poster.png`

Both outputs are 1280 × 720. The video is VP8 WebM recorded by Playwright.
