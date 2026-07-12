import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), configFile: false, logLevel: "silent", server: { middlewareMode: true }, appType: "custom" });
const service = await vite.ssrLoadModule("/src/index.ts");

after(async () => vite.close());

test("SSE framing survives arbitrary chunk boundaries", () => {
  const frame = service.encodeSse({ type: "token", data: { delta: "hello" } });
  const first = service.parseSseChunk("", frame.slice(0, 13));
  const second = service.parseSseChunk(first.remainder, frame.slice(13));
  assert.equal(first.events.length, 0);
  assert.deepEqual(second.events, [{ type: "token", data: { delta: "hello" } }]);
  assert.equal(second.remainder, "");
});

test("retries stop after visible output or the attempt budget", () => {
  assert.equal(service.shouldRetryGeneration({ attempt: 1, maxAttempts: 2, emittedVisibleOutput: false, retryable: true }), true);
  assert.equal(service.shouldRetryGeneration({ attempt: 1, maxAttempts: 2, emittedVisibleOutput: true, retryable: true }), false);
  assert.equal(service.shouldRetryGeneration({ attempt: 2, maxAttempts: 2, emittedVisibleOutput: false, retryable: true }), false);
});

test("MSW generation handlers are created outside the LMS", () => {
  const handler = service.createMockGenerationHandler({ endpoint: "/api/test" });
  assert.ok(handler && typeof handler === "object");
});
