import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "vite";

const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});
const persistence = await vite.ssrLoadModule("/app/platform/persistence/index.ts");

after(async () => {
  await vite.close();
});

function database() {
  return new persistence.BrowserLabDatabase(`persistence-test-${crypto.randomUUID()}`);
}

async function dispose(db) {
  db.close();
  await db.delete();
}

test("bounded parsers reject oversized and circular data before serialization", () => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => persistence.assertStructuredValueWithinLimits(circular), /circular/i);
  assert.throws(
    () => persistence.parseBoundedJson(JSON.stringify({ value: "abcdefgh" }), { maxStringCharacters: 4 }),
    /string exceeds/i,
  );
  assert.equal(persistence.stableFingerprint("same"), persistence.stableFingerprint("same"));
  assert.notEqual(persistence.stableFingerprint("same"), persistence.stableFingerprint("different"));
});

test("legacy capstone decoding excludes streaming state and unknown secret fields", () => {
  const decoded = persistence.decodeLegacySource("latent-capstone-v2", JSON.stringify({
    version: 2,
    selectedBackend: "local",
    apiKey: "must-not-migrate",
    messages: [
      { id: "u1", role: "user", content: "hello", status: "complete", backend: "local" },
      { id: "a1", role: "assistant", content: "partial", status: "streaming", backend: "local" },
      { id: "a2", role: "assistant", content: "done", status: "complete", backend: "local", attemptId: "attempt" },
    ],
  }), 100);
  assert.equal(decoded.bundle.conversationMessages.length, 2);
  assert.deepEqual(decoded.bundle.conversationMessages.map((message) => message.content), ["hello", "done"]);
  assert.equal(JSON.stringify(decoded.bundle).includes("must-not-migrate"), false);
  assert.equal(decoded.bundle.settings.find((setting) => setting.key === "capstone.selectedBackend")?.value, "local");
});

test("legacy import is transactional, idempotent, and preserves every old key", async () => {
  const db = database();
  await db.open();
  const records = new Map([
    ["latent-learner-v2", JSON.stringify({
      version: 2,
      lessons: {
        transformers: { verifiedCells: ["mask"], experimentComplete: true, hiddenBlocks: ["softmax"], answers: { softmax: "return value" }, updatedAt: 10 },
      },
      artifacts: {
        characterRnn: {
          checkpoint: { version: 1, vocabulary: ["a"], hiddenSize: 1, Wxh: [[1]], Whh: [[1]], Why: [[1]], bh: [0], by: [0] },
          finalLoss: 1.2,
          parameters: 5,
          vocabularySize: 1,
          trainedAt: 11,
        },
      },
    })],
    ["latent-project-v1", JSON.stringify({
      version: 1,
      selectedPath: "runtime/model.config.js",
      files: {
        "runtime/model.config.js": { title: "Model", courseId: "runtime", content: "export default {};", referenceContent: "export default {};", updatedAt: 12 },
      },
      runtime: { version: 1, buildNumber: 3, builtAt: 13, model: {}, transport: {}, interface: {} },
      output: { previous: "before", current: "after" },
      tests: {
        ranAt: 13,
        results: { "runtime/model.config.js": [{ id: "config", path: "runtime/model.config.js", label: "Config", passed: true, detail: "Passed" }] },
      },
    })],
    ["latent-capstone-v2", JSON.stringify({
      version: 2,
      selectedBackend: "student",
      messages: [{ id: "u1", role: "user", content: "prompt", status: "complete", backend: "student" }],
    })],
  ]);
  const storage = { getItem: (key) => records.get(key) ?? null };
  const before = new Map(records);

  const first = await persistence.importLegacyLocalStorage(db, storage, 100);
  const countsAfterFirst = {
    projects: await db.projects.count(),
    revisions: await db.fileRevisions.count(),
    builds: await db.builds.count(),
    messages: await db.conversationMessages.count(),
    migrations: await db.migrations.count(),
  };
  const second = await persistence.importLegacyLocalStorage(db, storage, 200);
  const countsAfterSecond = {
    projects: await db.projects.count(),
    revisions: await db.fileRevisions.count(),
    builds: await db.builds.count(),
    messages: await db.conversationMessages.count(),
    migrations: await db.migrations.count(),
  };

  assert.deepEqual(first.map((result) => result.status), ["imported", "imported", "imported"]);
  assert.deepEqual(second.map((result) => result.status), ["already-imported", "already-imported", "already-imported"]);
  assert.deepEqual(countsAfterSecond, countsAfterFirst);
  assert.deepEqual(records, before);
  assert.equal((await db.projects.get(persistence.LEGACY_PROJECT_ID)).activeBuildId?.startsWith("legacy:build:"), true);
  assert.equal((await db.lessonProgress.get(persistence.lessonProgressId("llm-systems", "transformers"))).status, "completed");
  await dispose(db);
});

test("passing promotion is atomic, idempotent, and rejects a stale receipt", async () => {
  const db = database();
  await db.open();
  let nextId = 0;
  const repositories = new persistence.PersistenceRepositories(db, { now: () => 100 + nextId, createId: (prefix) => `${prefix}:${++nextId}` });
  const project = await repositories.projects.create({ id: "project", title: "Browser Chat", courseId: "llm-systems" });
  const file = await repositories.projects.saveFile({ projectId: project.id, path: "model.js", track: "models", title: "Model", content: "export const model = 1" });
  const current = await repositories.projects.get(project.id);
  const run = await repositories.assessments.start({
    projectId: project.id,
    projectRevision: current.draftRevision,
    sourceTreeHash: "sha256:tree-one",
    contractVersion: "contracts-v1",
    runnerVersion: "runner-v1",
  });
  const runtimeBundle = "export const model = 1";
  const runtimeBundleHash = await persistence.hashText(runtimeBundle);
  const receipt = await repositories.assessments.finish(
    run.id,
    [{ contractId: "model", path: file.path, label: "Model", passed: true, detail: "Passed", durationMs: 1 }],
    { runtime: runtimeBundleHash },
  );
  const input = {
    projectId: project.id,
    projectRevision: current.draftRevision,
    sourceTreeHash: "sha256:tree-one",
    contractVersion: "contracts-v1",
    testReceiptId: receipt.id,
    fileHashes: { [file.path]: file.sourceHash },
    bundles: { runtime: runtimeBundle },
    runtimeConfig: { temperature: 0.8 },
    bindings: { model: { modulePath: "model.js", exportName: "model" } },
  };
  await assert.rejects(
    repositories.builds.promotePassing({
      ...input,
      bundleHashes: { runtime: await persistence.hashText("different bundle bytes") },
    }),
    /content-hash integrity/i,
  );
  const untestedBundle = "export const model = 999";
  await assert.rejects(
    repositories.builds.promotePassing({
      ...input,
      bundles: { runtime: untestedBundle },
      bundleHashes: { runtime: await persistence.hashText(untestedBundle) },
    }),
    /tested compiler module hash/i,
  );
  const first = await repositories.builds.promotePassing(input);
  const repeated = await repositories.builds.promotePassing(input);
  assert.equal(first.bundleHashes.runtime, await persistence.hashText(input.bundles.runtime));
  assert.equal(repeated.id, first.id);
  assert.equal(await db.builds.count(), 1);
  assert.equal((await repositories.projects.get(project.id)).activeBuildId, first.id);

  await repositories.projects.saveFile({ projectId: project.id, path: "model.js", track: "models", title: "Model", content: "export const model = 2" });
  await assert.rejects(repositories.builds.promotePassing(input), /stale/i);
  assert.equal((await repositories.projects.get(project.id)).activeBuildId, first.id);
  assert.equal(await db.builds.count(), 1);
  await dispose(db);
});

test("persisted bundle hashes reject changed bytes at database and portable import boundaries", async () => {
  const source = database();
  await source.open();
  const repositories = new persistence.PersistenceRepositories(source);
  await repositories.projects.create({ id: "integrity", title: "Integrity", courseId: "llm-systems" });
  const file = await repositories.projects.saveFile({
    projectId: "integrity",
    path: "model.js",
    track: "models",
    title: "Model",
    content: "export const model = 1",
  });
  const project = await repositories.projects.get("integrity");
  const run = await repositories.assessments.start({
    projectId: project.id,
    projectRevision: project.draftRevision,
    sourceTreeHash: "sha256:integrity-tree",
    contractVersion: "contracts-v1",
    runnerVersion: "runner-v1",
  });
  const bundle = "var model = (() => ({ model: 1 }))();";
  const receipt = await repositories.assessments.finish(
    run.id,
    [{
      contractId: "model",
      path: file.path,
      label: "Model",
      passed: true,
      detail: "Passed",
      durationMs: 1,
    }],
    { "model.js": await persistence.hashText(bundle) },
  );
  const build = await repositories.builds.promotePassing({
    projectId: project.id,
    projectRevision: project.draftRevision,
    sourceTreeHash: "sha256:integrity-tree",
    contractVersion: "contracts-v1",
    testReceiptId: receipt.id,
    fileHashes: { [file.path]: file.sourceHash },
    bundles: { "model.js": bundle },
    runtimeConfig: {},
    bindings: { model: { modulePath: "model.js", exportName: "model" } },
  });
  assert.equal(build.bundleHashes["model.js"], await persistence.hashText(bundle));

  const portable = await persistence.exportPersistenceSnapshot(source);
  const tamperedPortable = structuredClone(portable);
  tamperedPortable.tables.builds[0].bundles["model.js"] += "\n// changed after promotion";
  const destination = database();
  await destination.open();
  await assert.rejects(
    persistence.importPersistenceSnapshot(destination, tamperedPortable, { mode: "replace" }),
    /content-hash integrity/i,
  );
  assert.equal(await destination.builds.count(), 0);

  await source.builds.update(build.id, {
    bundles: { "model.js": `${bundle}\n// changed in storage` },
  });
  await assert.rejects(repositories.builds.active(project.id), /content-hash integrity/i);
  await assert.rejects(repositories.builds.list(project.id), /content-hash integrity/i);
  await assert.rejects(persistence.exportPersistenceSnapshot(source), /content-hash integrity/i);

  await dispose(source);
  await dispose(destination);
});

test("portable snapshot round-trips and detects immutable conflicts", async () => {
  const source = database();
  await source.open();
  const sourceRepositories = new persistence.PersistenceRepositories(source);
  await sourceRepositories.projects.create({ id: "portable", title: "Portable", courseId: "llm-systems" });
  await sourceRepositories.projects.saveFile({ projectId: "portable", path: "index.js", track: "product", title: "Index", content: "export default 1" });
  const snapshot = await persistence.exportPersistenceSnapshot(source);
  const serialized = persistence.serializePersistenceSnapshot(snapshot);
  const parsed = persistence.parsePortableSnapshot(serialized);
  assert.equal(parsed.tables.projects[0].id, "portable");

  const destination = database();
  await destination.open();
  await persistence.importPersistenceSnapshot(destination, serialized, { mode: "replace" });
  assert.equal((await destination.files.toArray())[0].content, "export default 1");

  const conflict = structuredClone(parsed);
  conflict.tables.fileRevisions[0].content = "different immutable content";
  await assert.rejects(persistence.importPersistenceSnapshot(destination, conflict), /immutable record/i);
  assert.equal((await destination.files.toArray())[0].content, "export default 1");
  await dispose(source);
  await dispose(destination);
});
