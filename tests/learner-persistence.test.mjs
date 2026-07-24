import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "vite";

const storage = new Map();
const defaultSessionStorage = new Map();
const storageAdapter = (records) => ({
  getItem: (key) => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, String(value)),
  removeItem: (key) => records.delete(key),
  get length() { return records.size; },
  key: (index) => [...records.keys()][index] ?? null,
});
globalThis.window = {
  localStorage: storageAdapter(storage),
  sessionStorage: storageAdapter(defaultSessionStorage),
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

let client;
let learner;
let persistence;
let vite;

function createModuleServer() {
  return createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
}

before(async () => {
  vite = await createModuleServer();
  [client, learner, persistence] = await Promise.all([
    vite.ssrLoadModule("/app/platform/persistence/client.ts"),
    vite.ssrLoadModule("/app/lib/learner-state.ts"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
  ]);
  await learner.initializeLearnerPersistence();
  await learner.flushLearnerPersistence();
});

after(async () => {
  await client?.closePersistenceContext();
  if (persistence) {
    const database = new persistence.BrowserLabDatabase();
    await database.delete();
  }
  await vite?.close();
});

test("learner recovery merges independent lessons and keeps the newest same-lesson state", () => {
  const lesson = (answer, updatedAt) => ({
    verifiedCells: [],
    verifiedSources: {},
    verifiedContractVersion: null,
    experimentComplete: false,
    hiddenBlocks: ["cell"],
    answers: { cell: answer },
    knowledgeAnswers: {},
    knowledgeVerified: [],
    updatedAt,
  });
  const merged = learner.mergeLearnerStates(
    { version: 2, lessons: { a: lesson("old", 1), b: lesson("b", 3) }, artifacts: {} },
    { version: 2, lessons: { a: lesson("new", 2), c: lesson("c", 4) }, artifacts: {} },
  );
  assert.equal(merged.lessons.a.answers.cell, "new");
  assert.equal(merged.lessons.b.answers.cell, "b");
  assert.equal(merged.lessons.c.answers.cell, "c");
});

test("standalone-course progress stays out of the Browser Chat project", async () => {
  learner.saveLessonPractice("arrays-and-shapes", ["describe-array"], {
    "describe-array": "def describe_array(values):\n    return {}",
  });
  learner.saveLessonPractice("ml-training-data", ["features-targets"], {
    "features-targets": "def features_and_targets(rows):\n    return {}",
  });
  learner.saveLessonPractice("agent-loop", ["parse-model-response"], {
    "parse-model-response": "def parse_model_response(response, tool_names):\n    return {}",
  });
  await learner.flushLearnerPersistence();

  const { repositories } = await client.getPersistenceContext();
  const linearAlgebra = await repositories.progress.get(
    persistence.lessonProgressId("linear-algebra", "arrays-and-shapes"),
  );
  const machineLearning = await repositories.progress.get(
    persistence.lessonProgressId("machine-learning-basics", "ml-training-data"),
  );
  const harnessEngineering = await repositories.progress.get(
    persistence.lessonProgressId("harness-engineering", "agent-loop"),
  );
  assert.equal(linearAlgebra.courseId, "linear-algebra");
  assert.equal(linearAlgebra.moduleId, "linear-algebra-basics");
  assert.equal(machineLearning.courseId, "machine-learning-basics");
  assert.equal(machineLearning.moduleId, "machine-learning-basics");
  assert.equal(harnessEngineering.courseId, "harness-engineering");
  assert.equal(harnessEngineering.moduleId, "harness-engineering");
  assert.equal(await repositories.projects.get("browser-chat"), undefined);
});

test("lesson keystrokes create an immediate recovery copy and coalesce to the latest durable row", async () => {
  for (let value = 1; value <= 40; value += 1) {
    learner.saveLessonPractice("coalesced-lesson", ["cell"], { cell: `answer ${value}` });
  }
  assert.match(storage.get(learner.learnerRecoveryStorageKey()), /answer 40/, "the latest bytes are synchronously recoverable before IndexedDB flushes");
  await learner.flushLearnerPersistence();

  const { repositories } = await client.getPersistenceContext();
  const saved = await repositories.progress.get(persistence.lessonProgressId("llm-systems", "coalesced-lesson"));
  assert.equal(saved.answers.cell, "answer 40");
});

test("optional repetition drafts persist without replacing the required project answer", async () => {
  const lessonId = `practice-repetitions-${crypto.randomUUID()}`;
  learner.saveLessonPracticeAndVerification(
    lessonId,
    ["cell"],
    { cell: "def required_answer():\n    return 1" },
    ["cell"],
    { cell: "def required_answer():\n    return 1" },
    "contracts-v1",
  );
  learner.saveLessonPracticeRepetitions(lessonId, {
    answers: { "cell::round-2": "def required_answer():\n    pass" },
    verifiedSources: {},
    verifiedContractVersion: null,
  });
  assert.match(storage.get(learner.learnerRecoveryStorageKey()), /cell::round-2/);
  await learner.flushLearnerPersistence();

  const { repositories } = await client.getPersistenceContext();
  const saved = await repositories.progress.get(persistence.lessonProgressId("llm-systems", lessonId));
  assert.equal(saved.answers.cell, "def required_answer():\n    return 1");
  assert.deepEqual(saved.verifiedCellIds, ["cell"]);
  assert.deepEqual(saved.practiceRepetitions, {
    answers: { "cell::round-2": "def required_answer():\n    pass" },
    verifiedSources: {},
    verifiedContractVersion: null,
  });
});

test("editing one lesson cannot rewrite a newer lesson from another tab", async () => {
  const { repositories } = await client.getPersistenceContext();
  learner.saveLessonPractice("local-lesson", ["cell"], { cell: "local 1" });
  learner.saveLessonPractice("remote-lesson", ["cell"], { cell: "remote 1" });
  await learner.flushLearnerPersistence();

  const remote = await repositories.progress.get(persistence.lessonProgressId("llm-systems", "remote-lesson"));
  await repositories.progress.put({ ...remote, answers: { cell: "remote 2" }, updatedAt: Date.now() + 100 });
  learner.saveLessonPractice("local-lesson", ["cell"], { cell: "local 2" });
  await learner.flushLearnerPersistence();

  assert.equal((await repositories.progress.get(remote.id)).answers.cell, "remote 2");
});

test("same-lesson cross-tab conflicts fail visibly without deleting the local recovery copy", async () => {
  const { repositories } = await client.getPersistenceContext();
  learner.saveLessonPractice("conflict-lesson", ["cell"], { cell: "base" });
  await learner.flushLearnerPersistence();
  const id = persistence.lessonProgressId("llm-systems", "conflict-lesson");
  const base = await repositories.progress.get(id);
  await repositories.progress.put({ ...base, answers: { cell: "remote" }, updatedAt: Date.now() + 100 });

  learner.saveLessonPractice("conflict-lesson", ["cell"], { cell: "local recovery" });
  await assert.rejects(learner.flushLearnerPersistence(), /changed in another tab/i);
  assert.equal((await repositories.progress.get(id)).answers.cell, "remote");
  assert.match(storage.get(learner.learnerRecoveryStorageKey()), /local recovery/);
});

test("simultaneous same-lesson tabs produce one durable winner and an explicit recovery candidate", async () => {
  const lessonId = `two-tab-${crypto.randomUUID()}`;
  const id = persistence.lessonProgressId("llm-systems", lessonId);
  const { repositories } = await client.getPersistenceContext();
  await repositories.progress.put({
    id,
    courseId: "llm-systems",
    moduleId: "chat-integration",
    lessonId,
    status: "in-progress",
    verifiedCellIds: [],
    verifiedSources: {},
    experimentComplete: false,
    hiddenBlockIds: ["cell"],
    answers: { cell: "base" },
    knowledgeAnswers: {},
    knowledgeVerifiedIds: [],
    lastProjectPath: null,
    updatedAt: Date.now(),
  });

  const [serverA, serverB] = await Promise.all([createModuleServer(), createModuleServer()]);
  let reloadServer;
  try {
    const [tabA, tabB] = await Promise.all([
      serverA.ssrLoadModule("/app/lib/learner-state.ts"),
      serverB.ssrLoadModule("/app/lib/learner-state.ts"),
    ]);
    const sessionA = new Map();
    const sessionB = new Map();
    window.sessionStorage = storageAdapter(sessionA);
    const keyA = tabA.learnerRecoveryStorageKey();
    window.sessionStorage = storageAdapter(sessionB);
    const keyB = tabB.learnerRecoveryStorageKey();
    await Promise.all([tabA.initializeLearnerPersistence(), tabB.initializeLearnerPersistence()]);

    let release;
    const barrier = new Promise((resolve) => { release = resolve; });
    const attempt = (tab, answer) => barrier.then(async () => {
      tab.saveLessonPractice(lessonId, ["cell"], { cell: answer });
      await tab.flushLearnerPersistence();
      return answer;
    });
    const attempts = [attempt(tabA, "tab A recovery"), attempt(tabB, "tab B recovery")];
    release();
    const results = await Promise.allSettled(attempts);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const winningAnswer = results.find((result) => result.status === "fulfilled").value;
    const losingAnswer = winningAnswer === "tab A recovery" ? "tab B recovery" : "tab A recovery";
    const losingKey = winningAnswer === "tab A recovery" ? keyB : keyA;
    const losingSession = winningAnswer === "tab A recovery" ? sessionB : sessionA;
    assert.equal((await repositories.progress.get(id)).answers.cell, winningAnswer);
    assert.match(storage.get(losingKey), new RegExp(losingAnswer));
    assert.equal(storage.has(winningAnswer === "tab A recovery" ? keyA : keyB), false, "the winner clears only its own tab journal");

    window.sessionStorage = storageAdapter(losingSession);
    reloadServer = await createModuleServer();
    const reloaded = await reloadServer.ssrLoadModule("/app/lib/learner-state.ts");
    assert.equal(reloaded.learnerRecoveryStorageKey(), losingKey);
    await reloaded.initializeLearnerPersistence();
    assert.equal(reloaded.loadLearnerState().lessons[lessonId].answers.cell, winningAnswer, "reload must keep the newer durable winner active");
    assert.equal((await repositories.progress.get(id)).answers.cell, winningAnswer, "hydration must not write the stale branch back");
    const [candidate] = reloaded.listLearnerRecoveryCandidates(lessonId);
    assert.ok(candidate);
    assert.equal(candidate.value.answers.cell, losingAnswer);

    assert.equal(await reloaded.loadLearnerRecoveryCandidate(candidate.sessionId, lessonId), true);
    await reloaded.flushLearnerPersistence();
    assert.equal((await repositories.progress.get(id)).answers.cell, losingAnswer, "only explicit Load may replace the durable winner");

    const [clientA, clientB, reloadClient] = await Promise.all([
      serverA.ssrLoadModule("/app/platform/persistence/client.ts"),
      serverB.ssrLoadModule("/app/platform/persistence/client.ts"),
      reloadServer.ssrLoadModule("/app/platform/persistence/client.ts"),
    ]);
    await Promise.all([clientA.closePersistenceContext(), clientB.closePersistenceContext(), reloadClient.closePersistenceContext()]);
  } finally {
    await Promise.all([serverA.close(), serverB.close(), reloadServer?.close()]);
  }
});

test("legacy shared recovery migrates into the current tab journal", async () => {
  const lessonId = `legacy-recovery-${crypto.randomUUID()}`;
  storage.set(learner.LEARNER_STATE_KEY, JSON.stringify({
    version: 2,
    lessons: {
      [lessonId]: {
        verifiedCells: [],
        verifiedSources: {},
        verifiedContractVersion: null,
        experimentComplete: false,
        hiddenBlocks: ["cell"],
        answers: { cell: "legacy unsynced" },
        knowledgeAnswers: {},
        knowledgeVerified: [],
        updatedAt: Date.now(),
      },
    },
    artifacts: {},
  }));
  const legacySession = new Map();
  window.sessionStorage = storageAdapter(legacySession);
  const legacyTab = await vite.ssrLoadModule(`/app/lib/learner-state.ts?legacy-${crypto.randomUUID()}`);
  const recoveryKey = legacyTab.learnerRecoveryStorageKey();
  await legacyTab.initializeLearnerPersistence();
  assert.equal(storage.has(learner.LEARNER_STATE_KEY), false);
  assert.match(storage.get(recoveryKey), /legacy unsynced/);
  await legacyTab.flushLearnerPersistence();
  assert.equal((await (await client.getPersistenceContext()).repositories.progress.get(
    persistence.lessonProgressId("llm-systems", lessonId),
  )).answers.cell, "legacy unsynced");
});
