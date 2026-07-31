import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "#vite-test-server";

const storage = new Map();
const storageAdapter = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  get length() { return storage.size; },
  key: (index) => [...storage.keys()][index] ?? null,
};

globalThis.window = {
  localStorage: storageAdapter,
  sessionStorage: storageAdapter,
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

let browserLab;
let client;
let persistence;
let trustedState;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [browserLab, client, persistence, trustedState] = await Promise.all([
    vite.ssrLoadModule("/packages/browser-lab/src/index.ts"),
    vite.ssrLoadModule("/app/platform/persistence/client.ts"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
    vite.ssrLoadModule("/app/features/trusted-interactives/persistence.ts"),
  ]);
});

after(async () => {
  await client?.closePersistenceContext();
  if (persistence) {
    const database = new persistence.BrowserLabDatabase();
    await database.delete();
  }
  await vite?.close();
});

async function identity(overrides = {}) {
  return {
    courseId: "llm-systems",
    lessonId: "attention-mechanisms",
    interactiveId: "attention-flow",
    definitionVersion: 1,
    sourceHash: await browserLab.hashText("trusted interactive source v1"),
    stateSchemaVersion: 1,
    ...overrides,
  };
}

test("trusted interactive state restores only for its exact source identity without mutating course progress", async () => {
  const adapter = trustedState.createTrustedInteractiveStatePersistence();
  const exact = await identity();
  const { database } = await client.getPersistenceContext();
  const progressBefore = await database.lessonProgress.count();

  const saved = await adapter.save(exact, {
    selectedToken: 2,
    maskEnabled: true,
  }, null);
  assert.equal(saved.record.revision, 1);
  assert.deepEqual(saved.record.identity, exact);
  assert.deepEqual(saved.record.state, {
    selectedToken: 2,
    maskEnabled: true,
  });
  assert.deepEqual(await adapter.load(exact), saved);

  assert.equal(
    await adapter.load(await identity({
      sourceHash: await browserLab.hashText("trusted interactive source v2"),
    })),
    null,
    "changed source bytes must not inherit state",
  );
  assert.equal(await adapter.load(await identity({ definitionVersion: 2 })), null);
  assert.equal(await adapter.load(await identity({ stateSchemaVersion: 2 })), null);
  assert.equal(
    await database.lessonProgress.count(),
    progressBefore,
    "interactive state is not course completion evidence",
  );
});

test("trusted interactive saves and resets use opaque CAS tokens and tight JSON limits", async () => {
  const adapter = trustedState.createTrustedInteractiveStatePersistence();
  const exact = await identity({
    lessonId: "state-cas",
    interactiveId: "state-cas-demo",
  });
  const base = await adapter.save(exact, { value: "base" }, null);

  const attempts = await Promise.allSettled([
    adapter.save(exact, { value: "tab-a" }, base.token),
    adapter.save(exact, { value: "tab-b" }, base.token),
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
  assert.equal(
    attempts.find((result) => result.status === "rejected").reason.code,
    "WRITE_CONFLICT",
  );

  const current = await adapter.load(exact);
  assert.equal(current.record.revision, 2);
  assert.equal(await adapter.reset(exact, base.token), false, "a stale reset cannot delete a newer save");
  assert.equal(await adapter.reset(exact, current.token), true);
  assert.equal(await adapter.load(exact), null);

  await assert.rejects(
    adapter.save(exact, { text: "x".repeat(trustedState.TRUSTED_INTERACTIVE_MAX_STATE_BYTES) }, null),
    (error) => error.code === "INVALID_STATE" && /UTF-8 bytes/i.test(error.message),
  );
  await assert.rejects(
    adapter.save(exact, { value: Number.POSITIVE_INFINITY }, null),
    (error) => error.code === "INVALID_STATE" && /finite/i.test(error.message),
  );

  let deep = "leaf";
  for (let index = 0; index <= trustedState.TRUSTED_INTERACTIVE_MAX_STATE_DEPTH; index += 1) {
    deep = { child: deep };
  }
  await assert.rejects(
    adapter.save(exact, deep, null),
    (error) => error.code === "INVALID_STATE" && /nested/i.test(error.message),
  );

  await assert.rejects(
    adapter.save(
      exact,
      Array.from({ length: trustedState.TRUSTED_INTERACTIVE_MAX_STATE_NODES }, () => null),
      null,
    ),
    (error) => error.code === "INVALID_STATE" && /JSON values/i.test(error.message),
  );
});
