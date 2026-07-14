import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "vite";

const storage = new Map();
const sessionStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    get length() { return storage.size; },
    key: (index) => [...storage.keys()][index] ?? null,
  },
  sessionStorage: {
    getItem: (key) => sessionStorage.get(key) ?? null,
    setItem: (key, value) => sessionStorage.set(key, String(value)),
    removeItem: (key) => sessionStorage.delete(key),
  },
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

let canonical;
let client;
let contracts;
let course;
let persistence;
let snapshot;
let template;
let workspace;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [canonical, client, contracts, course, persistence, snapshot, template, workspace] = await Promise.all([
    vite.ssrLoadModule("/app/lib/canonical-project.ts"),
    vite.ssrLoadModule("/app/platform/persistence/client.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
    vite.ssrLoadModule("/app/features/ide/project-snapshot.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
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

test("canonical lesson seeds accept only current source-bound verification", () => {
  const lesson = course.courseLessons[0];
  const block = lesson.implementation.codeBlocks[0];
  const lessonState = {
    verifiedCells: [block.id],
    verifiedSources: { [block.id]: block.code },
    verifiedContractVersion: contracts.llmSystemsContractSuite.contractVersion,
    experimentComplete: true,
    hiddenBlocks: [],
    answers: {},
    knowledgeAnswers: {},
    knowledgeVerified: [],
    updatedAt: 0,
  };
  const seedFor = (local) => canonical.canonicalLessonSeeds({
    version: 2,
    lessons: { [lesson.id]: local },
    artifacts: {},
  })[0];

  assert.equal(seedFor(lessonState).verifiedCells, 1);
  assert.equal(seedFor({
    ...lessonState,
    verifiedSources: { [block.id]: "// changed after verification" },
  }).verifiedCells, 0);
  assert.equal(seedFor({
    ...lessonState,
    verifiedContractVersion: "llm-systems-contracts-v0",
  }).verifiedCells, 0);
});

test("hydration rejects same-revision receipts when restored source bytes differ", async () => {
  const original = workspace.emptyProjectState();
  const sourceTreeHash = await snapshot.hashProjectSnapshotSources(original.files);
  const tests = {
    results: {
      [workspace.RUNTIME_PATHS.model]: [{
        id: `${workspace.RUNTIME_PATHS.model}:contract`,
        path: workspace.RUNTIME_PATHS.model,
        label: "Runtime configuration",
        passed: true,
        detail: "Passed",
      }],
    },
    ranAt: 1,
    runner: "browser-lab-v1",
    sourceTreeHash,
    projectRevision: 7,
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
    contractIdsByPath: {
      [workspace.RUNTIME_PATHS.model]: [`${workspace.RUNTIME_PATHS.model}:contract`],
    },
  };
  assert.deepEqual(
    await workspace.projectTestsForRestoredSnapshot(tests, original.files, 7),
    tests,
    "matching revision and bytes preserve the receipt",
  );

  const changedFiles = {
    ...original.files,
    [workspace.RUNTIME_PATHS.model]: {
      ...original.files[workspace.RUNTIME_PATHS.model],
      content: `${original.files[workspace.RUNTIME_PATHS.model].content}\n// imported bytes differ`,
    },
  };
  assert.deepEqual(await workspace.projectTestsForRestoredSnapshot(tests, changedFiles, 7), {
    results: {},
    ranAt: 0,
    runner: "none",
    sourceTreeHash: null,
    projectRevision: null,
    contractVersion: null,
    contractIdsByPath: {},
  }, "equal numeric revision cannot authorize different imported source bytes");
});

test("route-independent reconciliation persists the complete canonical tree and preserves edits", async () => {
  await canonical.reconcileCanonicalProject();
  const { repositories } = await client.getPersistenceContext();
  const freshFiles = await repositories.projects.listFiles("browser-chat");
  const expectedSeedPaths = canonical.completeCanonicalProjectSeeds().map((seed) => seed.path);
  const expectedPaths = new Set([
    ...Object.values(workspace.RUNTIME_PATHS),
    ...expectedSeedPaths,
  ]);

  assert.equal(freshFiles.length, expectedPaths.size);
  assert.deepEqual(new Set(freshFiles.map((file) => file.path)), expectedPaths);
  assert.equal(canonical.canonicalLessonSeeds().length, 14);
  assert.equal(template.CANONICAL_BROWSER_CHAT_FILES.length, 6);

  const metadataSeed = canonical.canonicalLessonSeeds()[0];
  workspace.ensureProjectWorkspace([{ ...metadataSeed, verifiedCells: 2 }]);
  await workspace.flushProjectPersistence();
  assert.equal(workspace.loadProjectState().files[metadataSeed.path].verifiedCells, 2);
  assert.equal((await repositories.projects.getFile("browser-chat", metadataSeed.path)).verifiedCells, 2);

  const editedLessonSource = `${workspace.loadProjectState().files[metadataSeed.path].content}\n// valid alternative under test`;
  workspace.saveProjectFile(metadataSeed.path, editedLessonSource);
  assert.equal(workspace.loadProjectState().files[metadataSeed.path].verifiedCells, 0);
  workspace.ensureProjectWorkspace([{ ...metadataSeed, verifiedCells: 2 }]);
  assert.equal(workspace.loadProjectState().files[metadataSeed.path].content, editedLessonSource);
  assert.equal(
    workspace.loadProjectState().files[metadataSeed.path].verifiedCells,
    0,
    "reconciliation must not restore learner-cell verification onto different IDE source",
  );

  workspace.updateProjectState((state) => ({
    ...state,
    files: {
      ...state.files,
      [metadataSeed.path]: {
        ...state.files[metadataSeed.path],
        verifiedCells: 2,
      },
    },
  }));
  workspace.ensureProjectWorkspace([{ ...metadataSeed, verifiedCells: 2 }]);
  assert.equal(
    workspace.loadProjectState().files[metadataSeed.path].verifiedCells,
    0,
    "reconciliation must normalize a previously persisted stale count",
  );

  workspace.updateProjectState((state) => ({
    ...state,
    files: {
      ...state.files,
      [metadataSeed.path]: {
        ...state.files[metadataSeed.path],
        verifiedCells: 2,
      },
    },
  }));
  const migratedSeed = {
    ...metadataSeed,
    content: `${metadataSeed.content}\n// canonical migration`,
    referenceContent: `${metadataSeed.referenceContent}\n// canonical migration`,
    verifiedCells: 2,
  };
  workspace.ensureProjectWorkspace([migratedSeed]);
  assert.equal(workspace.loadProjectState().files[metadataSeed.path].content, editedLessonSource);
  assert.equal(
    workspace.loadProjectState().files[metadataSeed.path].verifiedCells,
    0,
    "reference migration must not carry stale verification onto preserved learner source",
  );

  const editedSource = "// Learner-owned Browser Chat edit\nexport function BrowserChat() { return null; }";
  workspace.saveProjectFile(template.CAPSTONE_COMPONENT_PATH, editedSource);
  await workspace.flushProjectPersistence();
  await canonical.reconcileCanonicalProject();

  const reconciled = await repositories.projects.listFiles("browser-chat");
  const browserChat = reconciled.find((file) => file.path === template.CAPSTONE_COMPONENT_PATH);
  assert.equal(browserChat?.content, editedSource);
  assert.equal(browserChat?.referenceContent, template.BROWSER_CHAT_COMPONENT_SOURCE);
  assert.equal(reconciled.length, expectedPaths.size);
});

test("test evidence commits only for the exact current project snapshot and host scope", async () => {
  await canonical.reconcileCanonicalProject();
  await workspace.flushProjectPersistence();
  const { repositories } = await client.getPersistenceContext();
  const lessonSeed = canonical.canonicalLessonSeeds()[0];
  const expectedIds = contracts.llmSystemsContractSuite.contracts
    .filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === lessonSeed.path))
    .map((contract) => contract.id);
  const result = (id, path = lessonSeed.path) => ({ id, path, label: id, passed: true, detail: "Passed" });
  const results = expectedIds.map((id) => result(id));
  const scope = { [lessonSeed.path]: expectedIds };

  assert.equal(workspace.projectTestResultScopeIsExact(results, scope), true);
  assert.equal(workspace.projectTestResultScopeIsExact(results.slice(1), scope), false, "missing result");
  assert.equal(workspace.projectTestResultScopeIsExact([...results, result("extra")], scope), false, "extra result");
  assert.equal(workspace.projectTestResultScopeIsExact([...results.slice(0, -1), results[0]], scope), false, "duplicate result");
  assert.equal(workspace.projectTestResultScopeIsExact(results.map((item, index) => index ? item : { ...item, path: "models/wrong.js" }), scope), false, "wrong path");

  const initialProject = await repositories.projects.get("browser-chat");
  const initialHash = await snapshot.hashProjectSnapshotSources(workspace.loadProjectState().files);
  assert.deepEqual(await workspace.saveProjectTestResults({
    results: results.slice(1),
    expectedIdsByPath: scope,
    sourceTreeHash: initialHash,
    projectRevision: initialProject.draftRevision,
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
  }), { accepted: false, reason: "invalid-scope" });
  assert.deepEqual(await workspace.saveProjectTestResults({
    results,
    expectedIdsByPath: scope,
    sourceTreeHash: initialHash,
    projectRevision: initialProject.draftRevision,
    contractVersion: "llm-systems-contracts-v0",
  }), { accepted: false, reason: "contract-version" });
  const accepted = await workspace.saveProjectTestResults({
    results,
    expectedIdsByPath: scope,
    sourceTreeHash: initialHash,
    projectRevision: initialProject.draftRevision,
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
  });
  assert.deepEqual(accepted, { accepted: true });
  assert.deepEqual(workspace.loadProjectState().tests.contractIdsByPath, {
    [lessonSeed.path]: [...expectedIds].sort((left, right) => left.localeCompare(right)),
  });
  const failingReplacement = results.map((item, index) => index === 0 ? { ...item, passed: false, detail: "Expected failure" } : item);
  assert.deepEqual(await workspace.saveProjectTestResults({
    results: failingReplacement,
    expectedIdsByPath: scope,
    sourceTreeHash: initialHash,
    projectRevision: initialProject.draftRevision,
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
  }), { accepted: true });
  assert.equal(workspace.loadProjectState().tests.results[lessonSeed.path].length, expectedIds.length);
  assert.equal(workspace.loadProjectState().tests.results[lessonSeed.path][0].passed, false, "a file-only rerun replaces its prior bucket");

  const runRevision = initialProject.draftRevision;
  const runHash = initialHash;
  workspace.saveProjectFile(
    lessonSeed.path,
    `${workspace.loadProjectState().files[lessonSeed.path].content}\n// edit while tests are running`,
  );
  const stale = await workspace.saveProjectTestResults({
    results,
    expectedIdsByPath: scope,
    sourceTreeHash: runHash,
    projectRevision: runRevision,
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
  });
  assert.deepEqual(stale, { accepted: false, reason: "stale-source" });
  assert.deepEqual(workspace.loadProjectState().tests.results, {}, "a stale in-flight result must never be committed");

  await workspace.flushProjectPersistence();
  const currentProject = await repositories.projects.get("browser-chat");
  const currentHash = await snapshot.hashProjectSnapshotSources(workspace.loadProjectState().files);
  const unsavedDraft = await workspace.saveProjectTestResults({
    results,
    expectedIdsByPath: scope,
    sourceTreeHash: currentHash,
    projectRevision: currentProject.draftRevision,
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
    isClientSnapshotCurrent: () => false,
  });
  assert.deepEqual(unsavedDraft, { accepted: false, reason: "client-draft" });
  assert.deepEqual(workspace.loadProjectState().tests.results, {});
});

test("rapid lesson edits coalesce into one durable file revision", async () => {
  await workspace.flushProjectPersistence();
  const { repositories } = await client.getPersistenceContext();
  const path = `models/coalesced-${crypto.randomUUID()}.js`;
  const seed = (content) => ({
    path,
    courseId: "models",
    lessonId: `coalesced-${path}`,
    title: "Coalesced persistence probe",
    content,
    referenceContent: "export const value = 0;",
    verifiedCells: 0,
    totalCells: 1,
  });

  for (let value = 1; value <= 40; value += 1) {
    workspace.saveLessonProjectFile(seed(`export const value = ${value};`));
  }
  await workspace.flushProjectPersistence();

  const revisions = await repositories.projects.listFileRevisions("browser-chat", path);
  assert.equal(revisions.length, 1, "the latest recovery snapshot should create one debounced durable checkpoint");
  assert.equal(revisions[0].content, "export const value = 40;");
});

test("a local file edit cannot overwrite a newer file from another tab", async () => {
  const { repositories } = await client.getPersistenceContext();
  const localPath = `models/local-${crypto.randomUUID()}.js`;
  const remotePath = `models/remote-${crypto.randomUUID()}.js`;
  const seed = (path, content) => ({
    path,
    courseId: "models",
    title: path,
    content,
    referenceContent: "export const value = 0;",
    verifiedCells: 0,
    totalCells: 1,
  });
  workspace.saveLessonProjectFile(seed(localPath, "export const local = 1;"));
  workspace.saveLessonProjectFile(seed(remotePath, "export const remote = 1;"));
  await workspace.flushProjectPersistence();

  await repositories.projects.saveFile({
    projectId: "browser-chat",
    path: remotePath,
    track: "models",
    title: remotePath,
    content: "export const remote = 2;",
    referenceContent: "export const value = 0;",
    verifiedCells: 0,
    totalCells: 1,
    reason: "edit",
  });
  workspace.saveProjectFile(localPath, "export const local = 2;");
  await workspace.flushProjectPersistence();

  assert.equal((await repositories.projects.getFile("browser-chat", remotePath)).content, "export const remote = 2;", "saving another path must not rewrite a stale full VFS snapshot");
});

test("same-file cross-tab conflicts fail visibly while keeping the recovery copy", async () => {
  const { repositories } = await client.getPersistenceContext();
  const path = `models/conflict-${crypto.randomUUID()}.js`;
  const safePath = `models/post-conflict-${crypto.randomUUID()}.js`;
  const referenceContent = "export const value = 0;";
  workspace.saveLessonProjectFile({ path, courseId: "models", title: path, content: "export const value = 1;", referenceContent, verifiedCells: 0, totalCells: 1 });
  workspace.saveLessonProjectFile({ path: safePath, courseId: "models", title: safePath, content: "export const safe = 1;", referenceContent, verifiedCells: 0, totalCells: 1 });
  await workspace.flushProjectPersistence();
  await repositories.projects.saveFile({ projectId: "browser-chat", path, track: "models", title: path, content: "export const value = 2;", referenceContent, verifiedCells: 0, totalCells: 1, reason: "edit" });

  workspace.saveProjectFile(path, "export const value = 3;");
  await assert.rejects(workspace.flushProjectPersistence(), /changed in another tab/i);
  assert.equal((await repositories.projects.getFile("browser-chat", path)).content, "export const value = 2;", "the durable remote version must not be overwritten");
  assert.match(storage.get(workspace.projectDraftRecoveryStorageKey()), /value = 3/, "the conflicting local bytes remain in this tab's synchronous recovery journal");

  workspace.saveProjectFile(safePath, "export const safe = 2;");
  await workspace.flushProjectPersistence();
  assert.match(storage.get(workspace.projectDraftRecoveryStorageKey()), /value = 3/, "an unrelated successful save must not clear the unresolved conflict recovery");
});

test("project recovery journals remain isolated per tab until the learner explicitly resolves them", async () => {
  const { repositories } = await client.getPersistenceContext();
  const path = `models/recovery-tabs-${crypto.randomUUID()}.js`;
  const referenceContent = "export const value = 0;";
  workspace.saveLessonProjectFile({ path, courseId: "models", title: path, content: "export const value = 1;", referenceContent, verifiedCells: 0, totalCells: 1 });
  await workspace.flushProjectPersistence();

  const remoteUpdatedAt = Date.now() + 1_000;
  const durable = await repositories.projects.getFile("browser-chat", path);
  await repositories.projects.saveFile({
    projectId: "browser-chat",
    path,
    track: "models",
    title: path,
    content: "export const value = 2;",
    referenceContent,
    verifiedCells: 0,
    totalCells: 1,
    reason: "edit",
  });
  const tabAKey = workspace.projectDraftRecoveryStorageKey("tab-a");
  const tabBKey = workspace.projectDraftRecoveryStorageKey("tab-b");
  storage.set(tabAKey, JSON.stringify({ [path]: { content: "export const value = 3;", updatedAt: durable.updatedAt } }));
  storage.set(tabBKey, JSON.stringify({ [path]: { content: "export const value = 4;", updatedAt: remoteUpdatedAt } }));

  const candidates = workspace.listProjectDraftRecoveryCandidates(path);
  assert.deepEqual(
    candidates.filter((candidate) => candidate.sessionId === "tab-a" || candidate.sessionId === "tab-b").map((candidate) => candidate.sessionId).sort(),
    ["tab-a", "tab-b"],
    "both tab-owned recovery copies remain visible without being merged",
  );

  workspace.discardProjectDraftRecoveryCandidate("tab-a", path);
  assert.equal(storage.has(tabAKey), false, "discarding one tab removes only that tab's candidate");
  assert.match(storage.get(tabBKey), /value = 4/, "another tab's recovery journal must remain intact");
});

test("loading an older cross-tab recovery re-stages it as a new edit before the debounce can persist", async () => {
  const { repositories } = await client.getPersistenceContext();
  const path = `models/recovery-load-${crypto.randomUUID()}.js`;
  const referenceContent = "export const value = 0;";
  workspace.saveLessonProjectFile({ path, courseId: "models", title: path, content: "export const value = 1;", referenceContent, verifiedCells: 0, totalCells: 1 });
  await workspace.flushProjectPersistence();
  const durable = await repositories.projects.getFile("browser-chat", path);
  assert.ok(durable);

  const loadedContent = "export const value = 7;";
  const olderKey = workspace.projectDraftRecoveryStorageKey("older-tab");
  storage.set(olderKey, JSON.stringify({ [path]: { content: loadedContent, updatedAt: durable.updatedAt - 1_000 } }));
  const crossSessionCandidate = workspace.listProjectDraftRecoveryCandidates(path).find((candidate) => candidate.sessionId === "older-tab");
  assert.ok(crossSessionCandidate);
  assert.equal(workspace.loadProjectDraftRecoveryCandidate(crossSessionCandidate, durable.updatedAt + 1), true);
  const currentSessionId = workspace.projectDraftRecoveryStorageKey().slice(workspace.PROJECT_DRAFT_RECOVERY_KEY.length);
  const sameSessionCandidate = workspace.listProjectDraftRecoveryCandidates(path).find((candidate) => candidate.sessionId === currentSessionId);
  assert.ok(sameSessionCandidate);
  assert.equal(workspace.loadProjectDraftRecoveryCandidate(sameSessionCandidate, durable.updatedAt + 2), true, "reloading the current tab candidate must not delete its newly staged journal");
  const restoredBeforeDebounce = await workspace.projectStateFromPersistence();

  assert.equal(restoredBeforeDebounce.files[path].content, loadedContent, "a reload before the 650ms autosave must hydrate the explicitly loaded bytes");
  assert.ok(JSON.parse(storage.get(workspace.projectDraftRecoveryStorageKey()))[path].updatedAt > durable.updatedAt, "the new tab journal owns a fresh timestamp");
  assert.equal(storage.has(olderKey), false, "the superseded cross-tab journal is removed only after re-staging succeeds");
  assert.equal(JSON.parse(storage.get(workspace.projectDraftRecoveryStorageKey()))[path].content, loadedContent, "same-session loading preserves the freshly staged bytes");
});

test("invalid saved build authority fails closed without hiding durable project source", async () => {
  const { database, repositories } = await client.getPersistenceContext();
  const path = `models/invalid-build-recovery-${crypto.randomUUID()}.js`;
  workspace.saveLessonProjectFile({
    path,
    courseId: "models",
    title: path,
    content: "export const sourceSurvives = true;",
    referenceContent: "export const sourceSurvives = true;",
    verifiedCells: 0,
    totalCells: 1,
  });
  await workspace.flushProjectPersistence();
  await database.projects.update("browser-chat", { activeBuildId: "build:missing-invalid-authority" });

  const restored = await workspace.projectStateFromPersistence();
  assert.equal(restored.activeBuild, null, "missing or uncertified runtime authority must not hydrate");
  assert.equal(restored.files[path].content, "export const sourceSurvives = true;", "source and history remain recoverable even when the active build is rejected");

  await database.projects.update("browser-chat", { activeBuildId: null });
  assert.equal(await repositories.builds.activeValidated("browser-chat"), undefined);
});
