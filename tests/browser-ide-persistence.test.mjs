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

let browserLab;
let client;
let host;
let persistence;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [browserLab, client, host, persistence] = await Promise.all([
    vite.ssrLoadModule("/packages/browser-lab/src/index.ts"),
    vite.ssrLoadModule("/app/platform/persistence/client.ts"),
    vite.ssrLoadModule("/app/platform/ide/browser-extension-host.tsx"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
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

async function sourceIdentity(extensionId, revision, files) {
  return {
    revision,
    sourceHash: await browserLab.hashSnapshot({
      projectId: extensionId,
      revision,
      files,
    }),
  };
}

function receiptFor(identity, extensionId, receiptId) {
  return {
    schemaVersion: 1,
    receiptId,
    jobId: `job-${receiptId}`,
    projectId: extensionId,
    projectRevision: identity.revision,
    sourceHash: identity.sourceHash,
    contractVersion: "methods-v1",
    status: "passed",
    startedAt: 10,
    completedAt: 20,
    results: [],
    logs: [],
    logsTruncated: false,
    limits: { ...browserLab.DEFAULT_SANDBOX_LIMITS },
  };
}

test("IndexedDB IDE persistence uses monotonic CAS and an atomic current-receipt pointer", async () => {
  const extensionId = "persistence.methods";
  const definition = browserLab.defineBrowserIdeExtension({
    schemaVersion: 1,
    id: extensionId,
    title: "Persistence methods",
    initialFilePath: "src/main.ts",
    files: [{
      path: "src/main.ts",
      loader: "ts",
      title: "Main",
      editable: true,
      contents: "export const answer = () => 1;",
    }],
    entryPoints: ["src/main.ts"],
    checks: {
      contractVersion: "methods-v1",
      contracts: [{
        id: "answer",
        label: "Answer",
        cases: [{
          id: "one",
          label: "Returns one",
          invoke: { modulePath: "src/main.ts", exportName: "answer", args: [] },
          assertions: [{ id: "value", label: "One", kind: "deep-equal", expected: 1 }],
        }],
      }],
    },
  });
  const definitionFingerprint = await browserLab.browserIdeDefinitionFingerprint(definition);
  const files1 = definition.files.map(({ path, loader, contents }) => ({ path, loader, contents }));
  const state1 = {
    schemaVersion: 1,
    extensionId,
    definitionFingerprint,
    revision: 1,
    selectedPath: "src/main.ts",
    files: files1,
    updatedAt: 10,
  };
  const identity1 = await sourceIdentity(extensionId, state1.revision, state1.files);
  const adapter = host.createLatentBrowserIdePersistence();
  await adapter.save(state1, identity1, null);

  const oldArtifact = await adapter.stageReceipt(
    extensionId,
    receiptFor(identity1, extensionId, "old"),
  );
  const files2 = [{
    ...files1[0],
    contents: "export const answer = () => 2;",
  }];
  const state2 = { ...state1, revision: 2, files: files2, updatedAt: 20 };
  const identity2 = await sourceIdentity(extensionId, state2.revision, state2.files);
  await adapter.save(state2, identity2, identity1);

  assert.equal(
    await adapter.admitReceipt(extensionId, oldArtifact, identity1),
    false,
    "a receipt bound to the previous durable source must not become current",
  );
  await assert.rejects(
    adapter.save(state1, identity1, identity1),
    (error) => error.code === "IDE_WRITE_CONFLICT",
    "an old revision cannot replace the current source",
  );

  const alternateFiles = [{
    ...files1[0],
    contents: "export const answer = () => 3;",
  }];
  const alternateState = { ...state2, files: alternateFiles, updatedAt: 30 };
  const alternateIdentity = await sourceIdentity(
    extensionId,
    alternateState.revision,
    alternateState.files,
  );
  await assert.rejects(
    adapter.save(alternateState, alternateIdentity, identity2),
    (error) => error.code === "IDE_WRITE_CONFLICT",
    "the same revision cannot be reused for different source",
  );

  const currentArtifact = await adapter.stageReceipt(
    extensionId,
    receiptFor(identity2, extensionId, "current"),
  );
  assert.equal(await adapter.admitReceipt(extensionId, currentArtifact, identity2), true);
  const context = await client.getPersistenceContext();
  const stored = await context.repositories.settings.get(host.browserIdeStateKey(extensionId));
  assert.equal(stored.currentReceiptArtifactKey, currentArtifact.artifactKey);
  assert.notEqual(stored.currentReceiptArtifactKey, oldArtifact.artifactKey);

  const state3 = { ...state2, revision: 3, updatedAt: 30 };
  const identity3 = await sourceIdentity(extensionId, state3.revision, state3.files);
  assert.equal(identity3.sourceHash, identity2.sourceHash, "source hashes intentionally exclude revision");
  await adapter.save(state3, identity3, identity2);
  const afterRevisionChange = await context.repositories.settings.get(
    host.browserIdeStateKey(extensionId),
  );
  assert.equal(
    afterRevisionChange.currentReceiptArtifactKey,
    null,
    "receipt retention must require the same revision and hash",
  );
});

test("receipt artifact storage stays bounded and admission removes superseded artifacts", async () => {
  const extensionId = "bounded.receipts";
  const identity = {
    revision: 1,
    sourceHash: await browserLab.hashText("bounded receipt source"),
  };
  const state = {
    schemaVersion: 1,
    extensionId,
    definitionFingerprint: await browserLab.hashText("bounded receipt definition"),
    revision: identity.revision,
    selectedPath: "main.ts",
    files: [{ path: "main.ts", loader: "ts", contents: "export const answer = 1;" }],
    updatedAt: 10,
  };
  const adapter = host.createLatentBrowserIdePersistence();
  await adapter.save(state, identity, null);

  let latestArtifact;
  for (
    let index = 0;
    index < host.BROWSER_IDE_MAX_RECEIPT_ARTIFACTS_PER_EXTENSION + 4;
    index += 1
  ) {
    latestArtifact = await adapter.stageReceipt(
      extensionId,
      receiptFor(identity, extensionId, `bounded-${index}`),
    );
  }
  const context = await client.getPersistenceContext();
  const beforeAdmission = await context.database.settings
    .where("key")
    .startsWith(host.browserIdeReceiptArtifactPrefix(extensionId))
    .toArray();
  assert.equal(
    beforeAdmission.length,
    host.BROWSER_IDE_MAX_RECEIPT_ARTIFACTS_PER_EXTENSION,
  );

  assert.equal(await adapter.admitReceipt(extensionId, latestArtifact, identity), true);
  const afterAdmission = await context.database.settings
    .where("key")
    .startsWith(host.browserIdeReceiptArtifactPrefix(extensionId))
    .toArray();
  assert.deepEqual(afterAdmission.map((row) => row.key), [latestArtifact.artifactKey]);

  const loaded = await adapter.load(extensionId);
  assert.equal(await adapter.reset(extensionId, loaded.token), true);
  assert.equal(await adapter.load(extensionId), null);
  assert.equal(
    await context.database.settings
      .where("key")
      .startsWith(host.browserIdeReceiptArtifactPrefix(extensionId))
      .count(),
    0,
  );
});

test("compare-and-delete reset cannot remove a concurrent valid repair", async () => {
  const extensionId = "reset.race";
  const adapter = host.createLatentBrowserIdePersistence();
  const context = await client.getPersistenceContext();
  await context.repositories.settings.put(
    host.browserIdeStateKey(extensionId),
    { invalid: true },
  );
  const rejected = await adapter.load(extensionId);
  const identity = {
    revision: 2,
    sourceHash: await browserLab.hashText("repaired source"),
  };
  const repaired = {
    schemaVersion: 1,
    extensionId,
    definitionFingerprint: await browserLab.hashText("repaired definition"),
    revision: identity.revision,
    selectedPath: "main.ts",
    files: [{ path: "main.ts", loader: "ts", contents: "export const repaired = true;" }],
    updatedAt: 20,
  };
  await adapter.save(repaired, identity, null);

  assert.equal(await adapter.reset(extensionId, rejected.token), false);
  const current = await adapter.load(extensionId);
  assert.equal(current.value.revision, 2);
  assert.equal(current.value.files[0].contents, "export const repaired = true;");
});
