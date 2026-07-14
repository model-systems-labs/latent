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

async function validatedPersistenceFixture(projectId = `validated-${crypto.randomUUID()}`) {
  const db = database();
  await db.open();
  let timestamp = 1_000;
  const repositories = new persistence.PersistenceRepositories(db, { now: () => timestamp++ });
  await repositories.projects.create({ id: projectId, title: "Validated project", courseId: "llm-systems" });
  const file = await repositories.projects.saveFile({
    projectId,
    path: "model.js",
    track: "models",
    title: "Model",
    content: "export const model = 1",
  });
  const project = await repositories.projects.get(projectId);
  const sourceTreeHash = await persistence.hashText(`${projectId}:source-tree`);
  const contractVersion = "contracts-v1";
  const run = await repositories.assessments.start({
    projectId,
    projectRevision: project.draftRevision,
    sourceTreeHash,
    contractVersion,
    runnerVersion: "browser-lab-quickjs-v1",
  });
  const bundle = "var model = (() => ({ model: 1 }))();";
  const bundleHash = await persistence.hashText(bundle);
  const receipt = await repositories.assessments.finish(
    run.id,
    [{ contractId: "model", path: file.path, label: "Model", passed: true, detail: "Passed", durationMs: 1 }],
    { "model.js": bundleHash },
  );
  const build = await repositories.builds.promotePassing({
    projectId,
    projectRevision: project.draftRevision,
    sourceTreeHash,
    contractVersion,
    testReceiptId: receipt.id,
    fileHashes: { [file.path]: file.sourceHash },
    bundles: { "model.js": bundle },
    runtimeConfig: { temperature: 0.8 },
    bindings: { model: { modulePath: "model.js", exportName: "model" } },
  });
  const checkpoint = await repositories.checkpoints.add({
    projectId,
    buildId: build.id,
    kind: "training",
    formatVersion: 1,
    payload: { weights: [1] },
    metrics: { loss: 1 },
  });
  await repositories.progress.put({
    id: persistence.lessonProgressId("llm-systems", `${projectId}-lesson`),
    courseId: "llm-systems",
    moduleId: "models",
    lessonId: `${projectId}-lesson`,
    status: "completed",
    verifiedCellIds: ["model"],
    verifiedSources: { model: file.content },
    verifiedContractVersion: contractVersion,
    experimentComplete: true,
    hiddenBlockIds: [],
    answers: {},
    lastProjectPath: file.path,
    updatedAt: timestamp,
  });
  await repositories.settings.put("project.tests", { passed: true, receiptId: receipt.id });
  await repositories.settings.put("project.runtime", {
    version: 1,
    model: { temperature: 0.61 },
    transport: { wordsPerEvent: 2 },
    interface: { assistantName: "Imported" },
    buildNumber: 7,
    builtAt: 9_999,
    testReceiptId: receipt.id,
    activeBuild: { id: build.id },
  });
  await repositories.settings.put("project.output", {
    previous: "prior imported output",
    current: "claimed passing output",
  });
  return { db, repositories, project: await repositories.projects.get(projectId), file, run, receipt, build, checkpoint };
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
        transformers: {
          verifiedCells: ["mask"],
          verifiedSources: { mask: "function mask() { return true; }" },
          verifiedContractVersion: "llm-systems-contracts-v2",
          experimentComplete: true,
          hiddenBlocks: ["softmax"],
          answers: { softmax: "return value" },
          updatedAt: 10,
        },
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
  const lessonProgress = await db.lessonProgress.get(persistence.lessonProgressId("llm-systems", "transformers"));
  assert.equal(lessonProgress.status, "completed");
  assert.equal(lessonProgress.verifiedContractVersion, "llm-systems-contracts-v2");
  assert.equal(lessonProgress.verifiedSources.mask, "function mask() { return true; }");
  await dispose(db);
});

test("progress repository preserves source-and-contract-bound lesson verification", async () => {
  const db = database();
  await db.open();
  const repositories = new persistence.PersistenceRepositories(db, { now: () => 200 });
  const saved = await repositories.progress.put({
    id: persistence.lessonProgressId("llm-systems", "subword-tokenization"),
    courseId: "llm-systems",
    moduleId: "model-foundations",
    lessonId: "subword-tokenization",
    status: "in-progress",
    verifiedCellIds: ["merge-pair"],
    verifiedSources: { "merge-pair": "function mergePair() { return []; }" },
    verifiedContractVersion: "llm-systems-contracts-v3",
    experimentComplete: false,
    hiddenBlockIds: ["merge-pair"],
    answers: { "merge-pair": "function mergePair() { return []; }" },
    knowledgeAnswers: { "merge-order": "dependencies" },
    knowledgeVerifiedIds: ["merge-order"],
    lastProjectPath: "models/bpe-tokenizer.js",
    updatedAt: 100,
  });
  const restored = await repositories.progress.get(saved.id);
  assert.equal(restored.verifiedContractVersion, "llm-systems-contracts-v3");
  assert.deepEqual(restored.verifiedCellIds, ["merge-pair"]);
  assert.deepEqual(restored.verifiedSources, { "merge-pair": "function mergePair() { return []; }" });
  assert.deepEqual(restored.knowledgeAnswers, { "merge-order": "dependencies" });
  assert.deepEqual(restored.knowledgeVerifiedIds, ["merge-order"]);
  await dispose(db);
});

test("project repository exposes immutable file history for learner recovery", async () => {
  const db = database();
  await db.open();
  let now = 10;
  const repositories = new persistence.PersistenceRepositories(db, { now: () => now++ });
  await repositories.projects.create({ id: "history", title: "History", courseId: "llm-systems" });
  await repositories.projects.saveFile({ projectId: "history", path: "models/model.js", track: "models", title: "Model", content: "export const value = 1", verifiedCells: 1, totalCells: 3 });
  await repositories.projects.saveFile({ projectId: "history", path: "models/model.js", track: "models", title: "Model", content: "export const value = 2", reason: "edit" });
  await repositories.projects.saveFile({ projectId: "history", path: "models/model.js", track: "models", title: "Model", content: "export const value = 1", reason: "restore" });
  const revisions = await repositories.projects.listFileRevisions("history", "models/model.js");
  assert.deepEqual(revisions.map((revision) => revision.revision), [1, 2, 3]);
  assert.deepEqual(revisions.map((revision) => revision.reason), ["seed", "edit", "restore"]);
  assert.equal(revisions[0].content, revisions[2].content);
  const currentFile = await repositories.projects.getFile("history", "models/model.js");
  assert.equal(currentFile.verifiedCells, 1);
  assert.equal(currentFile.totalCells, 3);
  await dispose(db);
});

test("project archival removes only the live file while preserving history and a valid selection", async () => {
  const db = database();
  await db.open();
  let now = 100;
  const repositories = new persistence.PersistenceRepositories(db, { now: () => now++ });
  await repositories.projects.create({ id: "archive", title: "Archive", courseId: "llm-systems" });
  const first = await repositories.projects.saveFile({
    projectId: "archive",
    path: "models/model.js",
    track: "models",
    title: "JavaScript model",
    content: "export const value = 1;",
  });
  const current = await repositories.projects.saveFile({
    projectId: "archive",
    path: first.path,
    track: "models",
    title: "JavaScript model",
    content: "export const value = 2;",
    expected: { revision: first.revision, sourceHash: first.sourceHash },
  });
  await repositories.projects.saveFile({
    projectId: "archive",
    path: "models/model.py",
    track: "models",
    title: "Python model",
    content: "value = 2",
  });
  await repositories.projects.selectFile("archive", current.path);
  const beforeArchive = await repositories.projects.get("archive");

  await assert.rejects(
    repositories.projects.archiveFile({
      projectId: "archive",
      path: current.path,
      expected: { revision: current.revision, sourceHash: current.sourceHash },
      replacementPath: "models/missing.py",
    }),
    /cannot select missing file/i,
  );
  assert.ok(await repositories.projects.getFile("archive", current.path), "a rejected archive leaves the current file intact");
  assert.equal((await repositories.projects.get("archive")).draftRevision, beforeArchive.draftRevision);

  const archived = await repositories.projects.archiveFile({
    projectId: "archive",
    path: current.path,
    expected: { revision: current.revision, sourceHash: current.sourceHash },
    replacementPath: "models/model.py",
  });
  assert.equal(archived.selectedPath, "models/model.py");
  assert.equal(archived.draftRevision, beforeArchive.draftRevision + 1);
  assert.equal(await repositories.projects.getFile("archive", current.path), undefined);
  assert.equal((await repositories.projects.get("archive")).selectedPath, "models/model.py");
  assert.deepEqual(
    (await repositories.projects.listFileRevisions("archive", current.path)).map((revision) => revision.content),
    ["export const value = 1;", "export const value = 2;"],
  );

  const restored = await repositories.projects.saveFile({
    projectId: "archive",
    path: current.path,
    track: "models",
    title: "Recovered JavaScript model",
    content: "export const value = 3;",
    expected: null,
    reason: "restore",
  });
  assert.equal(restored.revision, 3, "restoring an archived path continues its immutable revision sequence");
  assert.deepEqual(
    (await repositories.projects.listFileRevisions("archive", current.path)).map((revision) => revision.revision),
    [1, 2, 3],
  );
  await dispose(db);
});

test("competing project archives use revision-and-hash CAS so only one tab can commit", async () => {
  const db = database();
  await db.open();
  const firstTab = new persistence.PersistenceRepositories(db);
  const secondTab = new persistence.PersistenceRepositories(db);
  await firstTab.projects.create({ id: "archive-cas", title: "Archive CAS", courseId: "llm-systems" });
  const file = await firstTab.projects.saveFile({
    projectId: "archive-cas",
    path: "models/shared.js",
    track: "models",
    title: "Shared",
    content: "export const value = 1;",
  });
  const input = {
    projectId: "archive-cas",
    path: file.path,
    expected: { revision: file.revision, sourceHash: file.sourceHash },
    replacementPath: null,
  };

  const outcomes = await Promise.allSettled([
    firstTab.projects.archiveFile(input),
    secondTab.projects.archiveFile(input),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.match(String(outcomes.find((outcome) => outcome.status === "rejected").reason), /changed in another tab/i);
  assert.equal(await firstTab.projects.getFile("archive-cas", file.path), undefined);
  assert.equal((await firstTab.projects.get("archive-cas")).draftRevision, 2);
  assert.equal((await firstTab.projects.listFileRevisions("archive-cas", file.path)).length, 1);
  await dispose(db);
});

test("project compare-and-save serializes simultaneous same-file tab edits", async () => {
  const db = database();
  await db.open();
  const firstTab = new persistence.PersistenceRepositories(db);
  const secondTab = new persistence.PersistenceRepositories(db);
  await firstTab.projects.create({ id: "project-cas", title: "Project CAS", courseId: "llm-systems" });
  const base = await firstTab.projects.saveFile({
    projectId: "project-cas",
    path: "models/shared.js",
    track: "models",
    title: "Shared",
    content: "export const value = 1;",
  });
  const expected = { revision: base.revision, sourceHash: base.sourceHash };
  const write = (repositories, value) => repositories.projects.saveFile({
    projectId: "project-cas",
    path: "models/shared.js",
    track: "models",
    title: "Shared",
    content: `export const value = ${value};`,
    expected,
    reason: "edit",
  });

  const outcomes = await Promise.allSettled([write(firstTab, 2), write(secondTab, 3)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.match(String(outcomes.find((outcome) => outcome.status === "rejected").reason), /changed in another tab/i);
  const final = await firstTab.projects.getFile("project-cas", "models/shared.js");
  assert.ok(final.content === "export const value = 2;" || final.content === "export const value = 3;");
  assert.equal(final.revision, 2, "only one competing edit becomes a durable revision");
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

  const rerun = await repositories.assessments.start({
    projectId: project.id,
    projectRevision: current.draftRevision,
    sourceTreeHash: input.sourceTreeHash,
    contractVersion: input.contractVersion,
    runnerVersion: "runner-v1",
  });
  const rerunReceipt = await repositories.assessments.finish(
    rerun.id,
    [{ contractId: "model", path: file.path, label: "Model", passed: true, detail: "Passed again", durationMs: 1 }],
    { runtime: runtimeBundleHash },
  );
  const reactivated = await repositories.builds.promotePassing({ ...input, testReceiptId: rerunReceipt.id });
  assert.equal(reactivated.id, first.id);
  assert.equal(reactivated.testReceiptId, receipt.id, "the immutable build keeps its original exact receipt");
  assert.equal(await db.builds.count(), 1);

  await repositories.projects.saveFile({ projectId: project.id, path: "model.js", track: "models", title: "Model", content: "export const model = 2" });
  await assert.rejects(repositories.builds.promotePassing(input), /stale/i);
  assert.equal((await repositories.projects.get(project.id)).activeBuildId, first.id);
  assert.equal(await db.builds.count(), 1);
  await dispose(db);
});

test("portable validation rejects crafted build lineage and cross-project active ids", async () => {
  const source = await validatedPersistenceFixture("portable-adversarial");
  const snapshot = await persistence.exportPersistenceSnapshot(source.db);
  const destination = database();
  await destination.open();
  const cases = [
    ["receipt project", /different projects/i, (draft) => { draft.tables.testReceipts[0].projectId = "another-project"; }],
    ["receipt revision", /different project revisions/i, (draft) => { draft.tables.testReceipts[0].projectRevision += 1; }],
    ["receipt source", /different source trees/i, (draft) => { draft.tables.testReceipts[0].sourceTreeHash = "sha256:other"; }],
    ["receipt contract", /different contract versions/i, (draft) => { draft.tables.testReceipts[0].contractVersion = "contracts-other"; }],
    ["receipt id", /missing test receipt/i, (draft) => { draft.tables.builds[0].testReceiptId = "receipt:missing"; }],
    ["host origin", /host-owned/i, (draft) => { draft.tables.testReceipts[0].origin = "legacy"; }],
    ["complete pass", /complete passing/i, (draft) => { draft.tables.testReceipts[0].passedCount = 0; }],
    ["module manifest", /receipt hash/i, (draft) => { draft.tables.testReceipts[0].moduleHashes["model.js"] = "sha256:other"; }],
    ["promotion key", /promotion key/i, (draft) => { draft.tables.builds[0].promotionKey = "forged"; }],
    ["host run", /passing host test run/i, (draft) => { draft.tables.testRuns[0].status = "failed"; }],
    ["unknown provenance", /invalid provenance/i, (draft) => { draft.tables.builds[0].provenance = "claimed-host"; }],
    ["missing active build", /missing active build/i, (draft) => { draft.tables.projects[0].activeBuildId = "build:missing"; }],
    ["cross-project active build", /another project's active build/i, (draft) => {
      draft.tables.projects.push({ ...draft.tables.projects[0], id: "other-project", activeBuildId: draft.tables.builds[0].id });
    }],
  ];
  for (const [label, pattern, mutate] of cases) {
    const crafted = structuredClone(snapshot);
    mutate(crafted);
    await assert.rejects(
      persistence.importPersistenceSnapshot(destination, crafted, { mode: "replace" }),
      pattern,
      label,
    );
    assert.equal(await destination.projects.count(), 0, `${label} must fail before the import transaction`);
  }
  await dispose(source.db);
  await dispose(destination);
});

test("portable import restores work but strips every imported build authority", async () => {
  const source = await validatedPersistenceFixture("portable-untrusted-authority");
  const snapshot = await persistence.exportPersistenceSnapshot(source.db);
  const originalActiveBuildId = snapshot.tables.projects[0].activeBuildId;
  assert.equal(snapshot.tables.builds.length, 1);
  assert.equal(snapshot.tables.testReceipts[0].origin, "host");
  assert.ok(snapshot.tables.settings.some((setting) => setting.key === "project.tests"));

  const destination = database();
  await destination.open();
  const imported = await persistence.importPersistenceSnapshot(destination, snapshot, { mode: "replace" });
  const repositories = new persistence.PersistenceRepositories(destination);
  assert.equal(imported.tables.projects[0].activeBuildId, null);
  assert.deepEqual(imported.tables.testRuns, []);
  assert.deepEqual(imported.tables.testReceipts, []);
  assert.deepEqual(imported.tables.builds, []);
  assert.equal(imported.tables.checkpoints[0].buildId, null);
  assert.equal(imported.tables.settings.some((setting) => setting.key === "project.tests"), false);
  assert.equal(snapshot.tables.projects[0].activeBuildId, originalActiveBuildId, "normalization must not mutate the caller's export");

  assert.equal((await destination.projects.get("portable-untrusted-authority")).activeBuildId, null);
  assert.equal(await destination.testRuns.count(), 0);
  assert.equal(await destination.testReceipts.count(), 0);
  assert.equal(await destination.builds.count(), 0);
  assert.equal(await destination.files.count(), 1);
  assert.equal(await destination.lessonProgress.count(), 1);
  assert.equal((await destination.checkpoints.toArray())[0].buildId, null);
  assert.equal(await repositories.settings.get("project.tests"), undefined);
  assert.deepEqual(await repositories.settings.get("project.runtime"), {
    version: 1,
    model: { temperature: 0.61 },
    transport: { wordsPerEvent: 2 },
    interface: { assistantName: "Imported" },
    buildNumber: 1,
    builtAt: 0,
  });
  assert.deepEqual(await repositories.settings.get("project.output"), {
    previous: "",
    current: "",
  });
  assert.equal(await repositories.builds.activeValidated("portable-untrusted-authority"), undefined);

  const project = await repositories.projects.get("portable-untrusted-authority");
  const file = await repositories.projects.getFile(project.id, "model.js");
  const sourceTreeHash = await persistence.hashText("fresh-local-run");
  const run = await repositories.assessments.start({
    projectId: project.id,
    projectRevision: project.draftRevision,
    sourceTreeHash,
    contractVersion: "contracts-v1",
    runnerVersion: "browser-lab-quickjs-v1",
  });
  const bundle = "var model = (() => ({ model: 2 }))();";
  const receipt = await repositories.assessments.finish(
    run.id,
    [{ contractId: "model", path: file.path, label: "Model", passed: true, detail: "Passed locally", durationMs: 1 }],
    { "model.js": await persistence.hashText(bundle) },
  );
  const promoted = await repositories.builds.promotePassing({
    projectId: project.id,
    projectRevision: project.draftRevision,
    sourceTreeHash,
    contractVersion: "contracts-v1",
    testReceiptId: receipt.id,
    fileHashes: { [file.path]: file.sourceHash },
    bundles: { "model.js": bundle },
    runtimeConfig: {},
    bindings: { model: { modulePath: "model.js", exportName: "model" } },
  });
  assert.equal((await repositories.builds.activeValidated(project.id)).id, promoted.id);

  await dispose(source.db);
  await dispose(destination);
});

test("active build lookup fails closed for missing, cross-project, and receipt-invalid records", async () => {
  const fixture = await validatedPersistenceFixture("active-lineage");
  const { db, repositories, build, receipt } = fixture;
  const active = await repositories.builds.activeValidated("active-lineage");
  assert.equal(active.id, build.id);
  assert.equal(Object.isFrozen(active), true);
  assert.equal(Object.isFrozen(active.bundleHashes), true);

  await repositories.projects.create({ id: "other-active-project", title: "Other", courseId: "llm-systems" });
  await db.projects.update("other-active-project", { activeBuildId: "build:missing" });
  await assert.rejects(repositories.builds.active("other-active-project"), /missing active build/i);
  await db.projects.update("other-active-project", { activeBuildId: build.id });
  await assert.rejects(repositories.builds.active("other-active-project"), /another project's active build/i);

  await db.testReceipts.update(receipt.id, { passedCount: 0 });
  await assert.rejects(repositories.builds.active("active-lineage"), /complete passing/i);
  await assert.rejects(repositories.builds.activeValidated("active-lineage"), /complete passing/i);
  await assert.rejects(repositories.builds.list("active-lineage"), /complete passing/i);

  await db.testReceipts.update(receipt.id, { passedCount: 1 });
  await db.builds.update(build.id, { provenance: "claimed-host" });
  await assert.rejects(repositories.builds.active("active-lineage"), /invalid provenance/i);
  await assert.rejects(repositories.builds.list("active-lineage"), /invalid provenance/i);
  await dispose(db);
});

test("a certification epoch supersedes an invalid same-source legacy promotion without rewriting history", async () => {
  const fixture = await validatedPersistenceFixture("certification-epoch-rebuild");
  const { db, repositories, project, file, receipt, build } = fixture;
  const legacyKey = persistence.legacyPromotionKeyV1(project.id, build.sourceTreeHash, build.contractVersion);
  await db.builds.update(build.id, { promotionKey: legacyKey });
  await db.testReceipts.update(receipt.id, { moduleHashes: undefined });
  await assert.rejects(repositories.builds.activeValidated(project.id), /exact compiler module manifests/i);

  const replacementRun = await repositories.assessments.start({
    projectId: project.id,
    projectRevision: project.draftRevision,
    sourceTreeHash: build.sourceTreeHash,
    contractVersion: build.contractVersion,
    runnerVersion: "browser-lab-quickjs-v1",
  });
  const replacementBundle = build.bundles["model.js"];
  const replacementReceipt = await repositories.assessments.finish(
    replacementRun.id,
    [{ contractId: "model", path: file.path, label: "Model", passed: true, detail: "Passed under the current certification epoch", durationMs: 1 }],
    { "model.js": await persistence.hashText(replacementBundle) },
  );
  const promotion = {
    projectId: project.id,
    projectRevision: project.draftRevision,
    sourceTreeHash: build.sourceTreeHash,
    contractVersion: build.contractVersion,
    testReceiptId: replacementReceipt.id,
    fileHashes: { [file.path]: file.sourceHash },
    bundles: { "model.js": replacementBundle },
    runtimeConfig: build.runtimeConfig,
    bindings: build.bindings,
  };
  const replacement = await repositories.builds.promotePassing(promotion);

  assert.notEqual(replacement.id, build.id);
  assert.equal(replacement.buildNumber, build.buildNumber + 1);
  assert.equal(replacement.promotionKey, persistence.promotionKey(project.id, build.sourceTreeHash, build.contractVersion));
  assert.equal((await repositories.builds.activeValidated(project.id)).id, replacement.id);
  assert.equal((await db.builds.get(build.id)).promotionKey, legacyKey, "the rejected historical record remains immutable");
  assert.equal((await db.testReceipts.get(receipt.id)).moduleHashes, undefined);
  assert.equal((await repositories.builds.promotePassing(promotion)).id, replacement.id, "the current epoch remains idempotent");
  await dispose(db);
});

test("merge import cannot replace existing local build authority", async () => {
  const local = await validatedPersistenceFixture("portable-merge-authority");
  const external = await validatedPersistenceFixture("portable-merge-authority");
  const localActiveId = (await local.repositories.projects.get("portable-merge-authority")).activeBuildId;
  const localTests = await local.repositories.settings.get("project.tests");
  const localRuntime = await local.repositories.settings.get("project.runtime");
  const localOutput = await local.repositories.settings.get("project.output");
  const localCheckpoint = await local.db.checkpoints.where("projectId").equals("portable-merge-authority").first();

  const selfSnapshot = await persistence.exportPersistenceSnapshot(local.db);
  await persistence.importPersistenceSnapshot(local.db, selfSnapshot, { mode: "merge" });
  assert.equal((await local.db.checkpoints.get(localCheckpoint.id)).buildId, localActiveId);

  await external.db.projects.update("portable-merge-authority", { updatedAt: 50_000 });
  await external.repositories.settings.put("project.tests", { passed: true, receiptId: "forged-import" });
  await external.repositories.settings.put("project.runtime", {
    version: 1,
    model: { temperature: 0.99 },
    transport: { wordsPerEvent: 20 },
    interface: { assistantName: "External" },
    buildNumber: 99,
    builtAt: 50_000,
  });
  await external.repositories.settings.put("project.output", {
    previous: "external previous",
    current: "external current",
  });
  const snapshot = await persistence.exportPersistenceSnapshot(external.db);

  await persistence.importPersistenceSnapshot(local.db, snapshot, { mode: "merge" });
  assert.equal((await local.repositories.projects.get("portable-merge-authority")).activeBuildId, localActiveId);
  assert.equal((await local.repositories.builds.activeValidated("portable-merge-authority")).id, localActiveId);
  assert.deepEqual(await local.repositories.settings.get("project.tests"), localTests);
  assert.deepEqual(await local.repositories.settings.get("project.runtime"), localRuntime);
  assert.deepEqual(await local.repositories.settings.get("project.output"), localOutput);
  assert.equal(await local.db.builds.count(), 1);
  assert.equal(await local.db.testReceipts.count(), 1);
  await dispose(local.db);
  await dispose(external.db);
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
