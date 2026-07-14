import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let attempts;
let sse;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  attempts = await vite.ssrLoadModule("/app/lib/module-checkpoint-attempt.ts");
  sse = await vite.ssrLoadModule("/packages/mock-services/src/sse.ts");
});

after(async () => {
  await vite?.close();
});

function createDeferredServingStream(signal) {
  const encoder = new TextEncoder();
  let release;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse.encodeSse({ type: "token", data: { delta: "first " } })));
      release = () => {
        controller.enqueue(encoder.encode(signal.aborted
          ? sse.encodeSse({ type: "cancelled", data: {} })
          : sse.encodeSse({ type: "done", data: { tokens: 1 } })));
        controller.close();
      };
    },
  });
  return { stream, release: () => release() };
}

test("a cancelled deferred checkpoint stream must settle before an immediate rerun can begin", async () => {
  const coordinator = new attempts.ModuleCheckpointAttemptCoordinator();
  const first = coordinator.begin();
  assert.ok(first);

  const events = [];
  let resolveFirstEvent;
  const firstEvent = new Promise((resolve) => { resolveFirstEvent = resolve; });
  const deferred = createDeferredServingStream(first.controller.signal);
  const firstRun = (async () => {
    await sse.consumeSse(deferred.stream, (event) => {
      if (!coordinator.owns(first)) return;
      events.push(event.type);
      resolveFirstEvent();
    });
    const terminal = first.controller.signal.aborted ? "cancelled" : "passed";
    const ownedAtTerminal = coordinator.owns(first);
    const settled = coordinator.settle(first);
    return { terminal, ownedAtTerminal, settled };
  })();

  await firstEvent;
  assert.deepEqual(events, ["token"]);
  assert.equal(coordinator.cancelCurrent(), first);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(coordinator.begin(), null, "cancel must not release ownership while the stream is still unwinding");
  assert.equal(coordinator.cancelCurrent(), null, "a repeated cancel is idempotent");

  deferred.release();
  assert.deepEqual(await firstRun, { terminal: "cancelled", ownedAtTerminal: true, settled: true });
  assert.deepEqual(events, ["token", "cancelled"]);

  const rerun = coordinator.begin();
  assert.ok(rerun, "rerun becomes available only after the cancelled stream has closed");
  assert.ok(rerun.id > first.id);
  assert.equal(coordinator.settle(first), false, "late cleanup from the old attempt cannot clear the rerun");
  assert.equal(coordinator.owns(rerun), true);
  assert.equal(coordinator.settle(rerun), true);
});

test("the checkpoint UI keeps cancellation pending and gates async writes to the attempt owner", async () => {
  const source = await readFile(new URL("../app/components/ModuleCheckpoint.tsx", import.meta.url), "utf8");
  assert.match(source, /status === "running"[\s\S]*disabled=\{cancelRequested\}/);
  assert.match(source, /Waiting for the stream to close; rerun stays unavailable until it settles/);
  assert.match(source, /if \(ownsAttempt\(attempt\)\) setStatus\(next\)/);
  assert.match(source, /if \(ownsAttempt\(attempt\)\) setDetail\(next\)/);
  assert.match(source, /if \(coordinator\.settle\(attempt\)\) setCancelRequested\(false\)/);
});
