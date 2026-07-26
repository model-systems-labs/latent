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
    serverA.ssrLoadModule("/app/lib/question-progress.ts"),
    serverB.ssrLoadModule("/app/lib/question-progress.ts"),
    serverA.ssrLoadModule("/app/platform/persistence/client.ts"),
    serverB.ssrLoadModule("/app/platform/persistence/client.ts"),
    serverA.ssrLoadModule("/app/platform/persistence/index.ts"),
  ]);
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

test("question progress sanitizes identity, epoch, counters, drafts, and receipts independently", () => {
  const identity = { libraryId: "latent/methods@1.0.0", questionId: "pair-indices" };
  assert.deepEqual(
    tabA.sanitizeQuestionProgress(null, identity, 4),
    tabA.emptyQuestionProgress(identity, 4),
  );
  assert.deepEqual(
    tabA.sanitizeQuestionProgress({
      version: 1,
      ...identity,
      epoch: 3,
      revision: 8,
      draft: "stale",
    }, identity, 4),
    tabA.emptyQuestionProgress(identity, 4),
    "a previous library epoch must not restore stale work",
  );

  const sanitized = tabA.sanitizeQuestionProgress({
    version: 1,
    ...identity,
    epoch: 4,
    revision: 7,
    draft: "class Solution:\n    pass",
    attemptedAt: "invalid",
    attemptCount: 2,
    failureCount: 99,
    lastAttempt: {
      source: "class Solution:\n    pass",
      contractVersion: "pair-indices-v1",
      passed: false,
      attemptedAt: 12,
      mutationId: "attempt-1",
    },
    solvedReceipt: {
      source: 42,
      contractVersion: "pair-indices-v1",
      solvedAt: 11,
      mutationId: "solve-1",
    },
    lastMutationId: "",
    updatedAt: -1,
  }, identity, 4);

  assert.equal(sanitized.revision, 7);
  assert.equal(sanitized.draft, "class Solution:\n    pass");
  assert.equal(sanitized.attemptedAt, 12);
  assert.equal(sanitized.attemptCount, 2);
  assert.equal(sanitized.failureCount, 2);
  assert.equal(sanitized.lastAttempt.mutationId, "attempt-1");
  assert.equal(sanitized.solvedReceipt, null);
  assert.equal(sanitized.lastMutationId, null);
  assert.equal(sanitized.updatedAt, 0);
});

test("solved status is bound to the exact source and contract version", () => {
  const identity = { libraryId: "latent/methods@1.0.0", questionId: "unique-values" };
  const empty = tabA.emptyQuestionProgress(identity, 2);
  const solved = tabA.applyQuestionAttemptMutation(empty, {
    source: "class Solution:\n    def unique(self, values):\n        return len(values) == len(set(values))",
    contractVersion: "unique-values-v1",
    passed: true,
    expectedEpoch: 2,
    expectedRevision: 0,
    mutationId: "solve",
    updatedAt: 10,
  }).progress;

  assert.equal(tabA.questionProgressStatus(solved, "unique-values-v1"), "solved");
  assert.equal(tabA.questionProgressStatus(solved, "unique-values-v2"), "attempted");
  assert.equal(
    tabA.questionProgressStatus(solved, "unique-values-v1", `${solved.draft}\n# changed`),
    "attempted",
  );

  const edited = tabA.applyQuestionDraftMutation(solved, {
    source: `${solved.draft}\n# changed`,
    expectedEpoch: 2,
    expectedRevision: 1,
    mutationId: "edit",
    updatedAt: 11,
  }).progress;
  assert.equal(tabA.questionProgressStatus(edited, "unique-values-v1"), "attempted");
  assert.equal(edited.solvedReceipt.source, solved.draft, "editing keeps the exact prior receipt");

  const restored = tabA.applyQuestionDraftMutation(edited, {
    source: solved.draft,
    expectedEpoch: 2,
    expectedRevision: 2,
    mutationId: "restore",
    updatedAt: 12,
  }).progress;
  assert.equal(tabA.questionProgressStatus(restored, "unique-values-v1"), "solved");

  const failedRecheck = tabA.applyQuestionAttemptMutation(restored, {
    source: restored.draft,
    contractVersion: "unique-values-v1",
    passed: false,
    expectedEpoch: 2,
    expectedRevision: 3,
    mutationId: "failed-recheck",
    updatedAt: 13,
  }).progress;
  assert.equal(failedRecheck.solvedReceipt, null);
  assert.equal(tabA.questionProgressStatus(failedRecheck, "unique-values-v1"), "attempted");
});

test("pure mutation helpers reject stale revisions and epochs without changing progress", () => {
  const identity = { libraryId: "latent/methods@1.0.0", questionId: "balanced-delimiters" };
  const empty = tabA.emptyQuestionProgress(identity, 5);
  const first = tabA.applyQuestionDraftMutation(empty, {
    source: "class Solution:\n    pass",
    expectedEpoch: 5,
    expectedRevision: 0,
    mutationId: "first",
    updatedAt: 20,
  });
  assert.equal(first.applied, true);
  assert.equal(first.progress.revision, 1);

  const staleRevision = tabA.applyQuestionDraftMutation(first.progress, {
    source: "stale",
    expectedEpoch: 5,
    expectedRevision: 0,
    mutationId: "stale-revision",
    updatedAt: 21,
  });
  assert.equal(staleRevision.applied, false);
  assert.equal(staleRevision.reason, "stale-revision");
  assert.equal(staleRevision.progress, first.progress);

  const staleEpoch = tabA.applyQuestionDraftMutation(first.progress, {
    source: "stale",
    expectedEpoch: 4,
    expectedRevision: 1,
    mutationId: "stale-epoch",
    updatedAt: 21,
  });
  assert.equal(staleEpoch.applied, false);
  assert.equal(staleEpoch.reason, "stale-epoch");
  assert.equal(staleEpoch.progress, first.progress);
});

test("different questions save concurrently without sharing a revision", async () => {
  const libraryId = "tests/concurrent-questions@1.0.0";
  const epoch = await saved(await tabA.resetQuestionLibrary(libraryId));
  const left = { libraryId, questionId: "left" };
  const right = { libraryId, questionId: "right" };

  const [leftSave, rightSave] = await Promise.all([
    tabA.saveQuestionDraft(left, {
      source: "left source",
      expectedEpoch: epoch,
      expectedRevision: 0,
      mutationId: "left-edit",
      updatedAt: 30,
    }),
    tabB.saveQuestionDraft(right, {
      source: "right source",
      expectedEpoch: epoch,
      expectedRevision: 0,
      mutationId: "right-edit",
      updatedAt: 30,
    }),
  ]);
  assert.equal((await saved(leftSave)).applied, true);
  assert.equal((await saved(rightSave)).applied, true);

  const library = await tabA.loadQuestionLibraryProgress(libraryId);
  assert.deepEqual(
    Object.fromEntries(library.map((progress) => [progress.questionId, progress.draft])),
    { left: "left source", right: "right source" },
  );
  assert.deepEqual(library.map((progress) => progress.revision), [1, 1]);
});

test("same-question compare-and-save preserves one concurrent winner", async () => {
  const libraryId = "tests/same-question@1.0.0";
  const identity = { libraryId, questionId: "shared" };
  const epoch = await saved(await tabA.resetQuestionLibrary(libraryId));

  const outcomes = await Promise.all([
    tabA.saveQuestionDraft(identity, {
      source: "source from tab A",
      expectedEpoch: epoch,
      expectedRevision: 0,
      mutationId: "tab-a",
      updatedAt: 40,
    }),
    tabB.saveQuestionDraft(identity, {
      source: "source from tab B",
      expectedEpoch: epoch,
      expectedRevision: 0,
      mutationId: "tab-b",
      updatedAt: 40,
    }),
  ]);
  const results = await Promise.all(outcomes.map(saved));
  assert.equal(results.filter((result) => result.applied).length, 1);
  assert.equal(results.filter((result) => result.reason === "stale-revision").length, 1);

  const stored = await tabA.loadQuestionProgress(identity);
  assert.equal(stored.revision, 1);
  assert.ok(["source from tab A", "source from tab B"].includes(stored.draft));
});

test("library reset is an epoch barrier against a stale tab", async () => {
  const libraryId = "tests/reset-barrier@1.0.0";
  const identity = { libraryId, questionId: "stale" };
  const initialEpoch = await saved(await tabA.resetQuestionLibrary(libraryId));
  const staleSnapshot = await tabB.loadQuestionProgress(identity);
  assert.equal(staleSnapshot.epoch, initialEpoch);

  const nextEpoch = await saved(await tabA.resetQuestionLibrary(libraryId));
  assert.equal(nextEpoch, initialEpoch + 1);
  const staleSave = await saved(await tabB.saveQuestionAttempt(identity, {
    source: "stale solution",
    contractVersion: "stale-v1",
    passed: true,
    expectedEpoch: staleSnapshot.epoch,
    expectedRevision: staleSnapshot.revision,
    mutationId: "stale-save",
    updatedAt: 50,
  }));
  assert.equal(staleSave.applied, false);
  assert.equal(staleSave.reason, "stale-epoch");

  const current = await tabA.loadQuestionProgress(identity);
  assert.equal(current.epoch, nextEpoch);
  assert.equal(current.draft, null);
  assert.equal(tabA.questionProgressStatus(current, "stale-v1"), "new");
});

test("live question subscriptions publish committed drafts and resets", async () => {
  const libraryId = "tests/live-question@1.0.0";
  const identity = { libraryId, questionId: "live" };
  const epoch = await saved(await tabA.resetQuestionLibrary(libraryId));
  let stop = () => undefined;
  const observed = [];
  const target = new Promise((resolve) => {
    void tabB.subscribeQuestionProgress(identity, (progress) => {
      observed.push(progress);
      if (progress.draft === "committed") resolve();
    }).then((unsubscribe) => { stop = unsubscribe; });
  });

  try {
    const initial = await tabA.loadQuestionProgress(identity);
    await saved(await tabA.saveQuestionDraft(identity, {
      source: "committed",
      expectedEpoch: epoch,
      expectedRevision: initial.revision,
      mutationId: "live-edit",
      updatedAt: 60,
    }));
    await Promise.race([target, timeoutAfter(2_000, "the live question draft")]);
    assert.equal(observed.at(-1).draft, "committed");

    const resetTarget = new Promise((resolve) => {
      const poll = setInterval(() => {
        if (observed.at(-1)?.epoch === epoch + 1 && observed.at(-1)?.draft === null) {
          clearInterval(poll);
          resolve();
        }
      }, 5);
      poll.unref?.();
    });
    await saved(await tabA.resetQuestionLibrary(libraryId));
    await Promise.race([resetTarget, timeoutAfter(2_000, "the live question reset")]);
  } finally {
    stop();
  }
});
