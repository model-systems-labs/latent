import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let guards;
let lifecycle;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [guards, lifecycle] = await Promise.all([
    vite.ssrLoadModule("/app/lib/ide-async-guards.ts"),
    vite.ssrLoadModule("/app/lib/pipeline-load-lifecycle.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("a deferred autosave may announce only the exact path, bytes, and edit epoch it flushed", () => {
  const expected = { path: "models/a.js", content: "newest bytes", epoch: 4 };
  assert.equal(guards.draftSnapshotIsCurrent({ path: "models/a.js", content: "newest bytes" }, 4, expected), true);
  assert.equal(guards.draftSnapshotIsCurrent({ path: "models/a.js", content: "later bytes" }, 4, expected), false);
  assert.equal(guards.draftSnapshotIsCurrent({ path: "models/a.js", content: "newest bytes" }, 5, expected), false);
  assert.equal(guards.draftSnapshotIsCurrent({ path: "models/b.js", content: "newest bytes" }, 4, expected), false);
});

test("a late revision query and a revision from another file cannot overwrite the current file", () => {
  assert.equal(guards.revisionResponseIsCurrent({
    requestedPath: "models/a.js",
    requestId: 1,
    selectedPath: "models/b.js",
    currentRequestId: 2,
  }), false);
  assert.equal(guards.revisionResponseIsCurrent({
    requestedPath: "models/b.js",
    requestId: 2,
    selectedPath: "models/b.js",
    currentRequestId: 2,
  }), true);
  assert.equal(guards.revisionCanRestore("models/b.js", "models/a.js"), false);
  assert.equal(guards.revisionCanRestore("models/b.js", "models/b.js"), true);
});

test("a read-only compile failure routes to the editable capstone integration file", () => {
  assert.equal(guards.actionableBuildFailurePath({
    failurePath: "capstone/main.tsx",
    readOnly: true,
    editableFallbackPath: "capstone/BrowserChat.tsx",
  }), "capstone/BrowserChat.tsx");
  assert.equal(guards.actionableBuildFailurePath({
    failurePath: "models/transformer.js",
    readOnly: false,
    editableFallbackPath: "capstone/BrowserChat.tsx",
  }), "models/transformer.js");
});

test("navigation during an unabortable pipeline load marks disposal pending and disposes on resolution", () => {
  const state = lifecycle.createPipelineLoadLifecycle();
  lifecycle.mountPipelineLoad(state);
  const operation = lifecycle.beginPipelineLoad(state);
  assert.equal(state.phase, "loading");
  assert.deepEqual(lifecycle.requestPipelineLoadCleanup(state), { disposalPending: true });
  assert.equal(state.phase, "dispose-after-load");
  assert.equal(lifecycle.settlePipelineLoad(state, operation), "dispose");
  assert.equal(state.phase, "idle");
});

test("a mounted pipeline commits normally while a post-navigation rejection stays silent", () => {
  const ready = lifecycle.createPipelineLoadLifecycle();
  lifecycle.mountPipelineLoad(ready);
  const readyOperation = lifecycle.beginPipelineLoad(ready);
  assert.equal(lifecycle.settlePipelineLoad(ready, readyOperation), "commit");
  assert.equal(ready.phase, "ready");

  const rejected = lifecycle.createPipelineLoadLifecycle();
  lifecycle.mountPipelineLoad(rejected);
  const rejectedOperation = lifecycle.beginPipelineLoad(rejected);
  lifecycle.requestPipelineLoadCleanup(rejected);
  assert.equal(lifecycle.settlePipelineLoadFailure(rejected, rejectedOperation), false);
  assert.equal(rejected.phase, "idle");
});
