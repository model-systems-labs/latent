import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "vite";

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

function createModuleServer() {
  return createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
}

function timeoutAfter(milliseconds, label) {
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), milliseconds);
    timeout.unref?.();
  });
}

let serverA;
let serverB;
let tabA;
let tabB;
let clientA;
let clientB;
let persistence;

before(async () => {
  [serverA, serverB] = await Promise.all([createModuleServer(), createModuleServer()]);
  [tabA, tabB, clientA, clientB, persistence] = await Promise.all([
    serverA.ssrLoadModule("/app/lib/flashcard-progress.ts"),
    serverB.ssrLoadModule("/app/lib/flashcard-progress.ts"),
    serverA.ssrLoadModule("/app/platform/persistence/client.ts"),
    serverB.ssrLoadModule("/app/platform/persistence/client.ts"),
    serverA.ssrLoadModule("/app/platform/persistence/index.ts"),
  ]);
  const { database } = await clientA.getPersistenceContext();
  await database.settings.delete(tabA.FLASHCARD_PROGRESS_KEY);
});

after(async () => {
  await Promise.all([clientA?.closePersistenceContext(), clientB?.closePersistenceContext()]);
  if (persistence) {
    const database = new persistence.BrowserLabDatabase();
    await database.delete();
  }
  await Promise.all([serverA?.close(), serverB?.close()]);
});

async function saved(outcome) {
  assert.equal(outcome.saved, true, "the fake IndexedDB write should succeed");
  return outcome.value;
}

async function clearWith(tab) {
  return saved(await tab.clearFlashcardProgress());
}

test("legacy progress migrates in memory without losing valid card records", async () => {
  const { repositories } = await clientA.getPersistenceContext();
  await repositories.settings.put(tabA.FLASHCARD_PROGRESS_KEY, {
    version: 1,
    results: {
      legacy: { successes: 2, failures: 1, lastResult: "success", updatedAt: 10 },
    },
  });
  const loaded = await tabB.loadFlashcardProgress();
  assert.equal(loaded.version, 2);
  assert.equal(loaded.revision, 0);
  assert.equal(loaded.epoch, 0);
  assert.equal(loaded.results.legacy.successes, 2);
  assert.match(loaded.results.legacy.mutationId, /^legacy:/);
});

test("two tabs preserve concurrent ratings on the same and different cards", async () => {
  const cleared = await clearWith(tabA);
  const epoch = cleared.progress.epoch;
  await Promise.all([
    tabA.saveFlashcardResult({
      cardId: "same-card",
      result: "success",
      updatedAt: 100,
      mutationId: "same-a",
      expectedEpoch: epoch,
    }),
    tabB.saveFlashcardResult({
      cardId: "same-card",
      result: "failure",
      updatedAt: 100,
      mutationId: "same-b",
      expectedEpoch: epoch,
    }),
  ]);
  const sameCard = (await tabA.loadFlashcardProgress()).results["same-card"];
  assert.equal(sameCard.successes, 1);
  assert.equal(sameCard.failures, 1);

  const nextEpoch = (await clearWith(tabB)).progress.epoch;
  await Promise.all([
    tabA.saveFlashcardResult({
      cardId: "card-a",
      result: "success",
      updatedAt: 110,
      mutationId: "different-a",
      expectedEpoch: nextEpoch,
    }),
    tabB.saveFlashcardResult({
      cardId: "card-b",
      result: "failure",
      updatedAt: 110,
      mutationId: "different-b",
      expectedEpoch: nextEpoch,
    }),
  ]);
  assert.deepEqual(
    Object.keys((await tabB.loadFlashcardProgress()).results).sort(),
    ["card-a", "card-b"],
  );
});

test("undo is mutation-specific and preserves newer or independent tab work", async () => {
  const epoch = (await clearWith(tabA)).progress.epoch;
  const first = await saved(await tabA.saveFlashcardResult({
    cardId: "shared",
    result: "success",
    updatedAt: 200,
    mutationId: "shared-a",
    expectedEpoch: epoch,
  }));
  const second = await saved(await tabB.saveFlashcardResult({
    cardId: "shared",
    result: "failure",
    updatedAt: 200,
    mutationId: "shared-b",
    expectedEpoch: epoch,
  }));
  assert.equal((await saved(await tabA.undoFlashcardResult(first.receipt))).applied, false);
  assert.equal((await saved(await tabB.undoFlashcardResult(second.receipt))).applied, true);
  assert.equal((await tabA.loadFlashcardProgress()).results.shared.mutationId, "shared-a");

  const independent = await saved(await tabB.saveFlashcardResult({
    cardId: "independent",
    result: "failure",
    updatedAt: 210,
    mutationId: "independent-b",
    expectedEpoch: epoch,
  }));
  assert.equal(independent.applied, true);
  assert.equal((await saved(await tabA.undoFlashcardResult(first.receipt))).applied, true);
  const final = await tabB.loadFlashcardProgress();
  assert.equal(final.results.shared, undefined);
  assert.equal(final.results.independent.mutationId, "independent-b");
});

test("clear is an epoch barrier against stale ratings and stale undo", async () => {
  const epoch = (await clearWith(tabA)).progress.epoch;
  const marked = await saved(await tabB.saveFlashcardResult({
    cardId: "before-clear",
    result: "success",
    updatedAt: 300,
    mutationId: "before-clear-b",
    expectedEpoch: epoch,
  }));
  const cleared = await clearWith(tabA);
  assert.equal(cleared.progress.epoch, epoch + 1);

  const staleRating = await saved(await tabB.saveFlashcardResult({
    cardId: "stale-after-clear",
    result: "failure",
    updatedAt: 301,
    mutationId: "stale-b",
    expectedEpoch: epoch,
  }));
  assert.equal(staleRating.applied, false);
  assert.equal((await saved(await tabB.undoFlashcardResult(marked.receipt))).applied, false);
  assert.deepEqual((await tabA.loadFlashcardProgress()).results, {});

  const fresh = await saved(await tabB.saveFlashcardResult({
    cardId: "fresh-after-clear",
    result: "success",
    updatedAt: 302,
    mutationId: "fresh-b",
    expectedEpoch: cleared.progress.epoch,
  }));
  assert.equal(fresh.applied, true);
  assert.deepEqual(Object.keys((await tabA.loadFlashcardProgress()).results), ["fresh-after-clear"]);
});

test("live progress observation carries committed ratings and clears across tabs", async () => {
  const epoch = (await clearWith(tabA)).progress.epoch;
  let markedRevision = -1;
  let resolveMarked;
  let resolveCleared;
  const markedObserved = new Promise((resolve) => { resolveMarked = resolve; });
  const clearObserved = new Promise((resolve) => { resolveCleared = resolve; });
  const stop = await tabB.subscribeFlashcardProgress(
    new Set(["live-card"]),
    (value) => {
      if (value.results["live-card"] && markedRevision < 0) {
        markedRevision = value.revision;
        resolveMarked(value);
      } else if (markedRevision >= 0 && value.revision > markedRevision && value.epoch > epoch) {
        resolveCleared(value);
      }
    },
  );
  try {
    await saved(await tabA.saveFlashcardResult({
      cardId: "live-card",
      result: "success",
      updatedAt: 400,
      mutationId: "live-a",
      expectedEpoch: epoch,
    }));
    const observedMark = await Promise.race([
      markedObserved,
      timeoutAfter(3_000, "the cross-tab rating"),
    ]);
    assert.equal(observedMark.results["live-card"].mutationId, "live-a");

    await clearWith(tabA);
    const observedClear = await Promise.race([
      clearObserved,
      timeoutAfter(3_000, "the cross-tab clear"),
    ]);
    assert.deepEqual(observedClear.results, {});
  } finally {
    stop();
  }
});
