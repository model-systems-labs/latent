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

test("the mock producer splits encoded UTF-8 bytes inside a multibyte code point", async () => {
  const controller = new AbortController();
  const reader = service.createMockServingStream("€", controller.signal, {
    wordsPerEvent: 1,
    delayMs: 0,
  }).getReader();
  const first = await reader.read();
  const second = await reader.read();
  assert.equal(first.done, false);
  assert.equal(second.done, false);
  assert.deepEqual([...first.value.slice(-2)], [0xe2, 0x82]);
  assert.equal(second.value[0], 0xac);

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const prefix = decoder.decode(first.value, { stream: true });
  assert.equal(prefix.includes("€"), false);
  assert.match(prefix + decoder.decode(second.value, { stream: true }), /€/);
  await reader.cancel();

  const events = [];
  const servingStream = service.createMockServingStream("€", new AbortController().signal, { wordsPerEvent: 1, delayMs: 0 });
  await service.consumeSse(
    servingStream,
    (event) => events.push(event),
  );
  assert.deepEqual(events, [
    { type: "token", data: { delta: "€" } },
    { type: "done", data: { tokens: 1 } },
  ]);
  assert.equal(servingStream.locked, false);
});

test("the stream consumer flushes UTF-8 and rejects incomplete terminal bytes or frames", async () => {
  const utf8Prefix = new TextEncoder().encode('event: token\ndata: {"delta":"');
  const incompleteUtf8 = new ReadableStream({
    start(controller) {
      controller.enqueue(utf8Prefix);
      controller.enqueue(new Uint8Array([0xe2, 0x82]));
      controller.close();
    },
  });
  await assert.rejects(
    service.consumeSse(incompleteUtf8, () => undefined),
    /incomplete or invalid UTF-8 bytes/,
  );

  const incompleteFrame = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event: token\ndata: {"delta":"ok"}'));
      controller.close();
    },
  });
  await assert.rejects(
    service.consumeSse(incompleteFrame, () => undefined),
    /incomplete SSE frame/,
  );

  let cancelled = false;
  const malformedLiveStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("event: token\ndata: {not-json}\n\n"));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(service.consumeSse(malformedLiveStream, () => undefined), /JSON/);
  assert.equal(cancelled, true, "a parser failure must cancel a source that could keep producing bytes");

  const producerController = new AbortController();
  const malformedProducer = service.createMockServingStream("first second", producerController.signal, {
    wordsPerEvent: 1,
    delayMs: 0,
    scenario: "malformed-frame",
  });
  await assert.rejects(service.consumeSse(malformedProducer, () => undefined), /JSON/);
  assert.equal(malformedProducer.locked, false);
  producerController.abort();
  await new Promise((resolve) => setTimeout(resolve, 0));
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
