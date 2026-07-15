import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let fileStatus;
let template;
let workspace;
let contracts;
let course;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [fileStatus, template, workspace, contracts, course] = await Promise.all([
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/lessons/course.ts"),
  ]);
});

test("a synchronous recovery journal restores unsaved editable bytes and invalidates stale receipts", () => {
  const base = workspace.emptyProjectState();
  const editablePath = workspace.RUNTIME_PATHS.model;
  const readOnlyPath = workspace.RUNTIME_PATHS.tensor;
  const recoveryTime = base.files[editablePath].updatedAt + 100;
  const withReceipt = {
    ...base,
    selectedPath: workspace.RUNTIME_PATHS.transport,
    tests: {
      results: { [editablePath]: [{ id: "old", path: editablePath, label: "Old", passed: true, detail: "Old" }] },
      ranAt: 1,
      runner: "browser-lab-v1",
      sourceTreeHash: "sha256:old",
      projectRevision: 1,
      contractVersion: contracts.llmSystemsContractSuite.contractVersion,
      contractIdsByPath: { [editablePath]: ["old"] },
    },
  };
  const recovered = workspace.projectStateWithRecoveredDrafts(withReceipt, {
    [editablePath]: { content: "export default { \"temperature\": 0.42 };", updatedAt: recoveryTime },
    [readOnlyPath]: { content: "tampered", updatedAt: recoveryTime + 1 },
  });

  assert.equal(recovered.files[editablePath].content, "export default { \"temperature\": 0.42 };");
  assert.equal(recovered.files[editablePath].updatedAt, recoveryTime);
  assert.equal(recovered.files[readOnlyPath].content, base.files[readOnlyPath].content, "read-only sources cannot be recovered over canonical bytes");
  assert.equal(recovered.selectedPath, workspace.RUNTIME_PATHS.transport, "recovery must not steal the selected file");
  assert.deepEqual(recovered.tests, {
    results: {},
    ranAt: 0,
    runner: "none",
    sourceTreeHash: null,
    projectRevision: null,
    contractVersion: null,
    contractIdsByPath: {},
  });
});

after(async () => {
  await vite?.close();
});

test("source verification remains distinct from an independent passing test receipt", () => {
  assert.deepEqual(
    fileStatus.projectFileStatus({
      isLessonFile: true,
      verifiedCells: 1,
      totalCells: 3,
    }),
    { tone: "in-progress", label: "1 of 3 checks verified", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({
      isLessonFile: false,
      requiresPassingTests: true,
      results: [{ passed: true }],
    }),
    { tone: "passed", label: "IDE tests pass", complete: true },
  );
});

test("a trusted IDE failure takes precedence over completed learner source checks", () => {
  assert.deepEqual(
    fileStatus.projectFileStatus({
      isLessonFile: true,
      verifiedCells: 3,
      totalCells: 3,
      results: [{ passed: false }],
    }),
    { tone: "failed", label: "IDE tests failing", complete: false },
  );
  assert.equal(fileStatus.projectLessonIsComplete({
    learnerComplete: true,
    projectSource: "verified source",
    verifiedSource: "verified source",
    verifiedCells: 3,
    totalCells: 3,
    trustedResults: [{ passed: false }],
  }), false);
});

test("historical learner completion survives an edit without claiming the current lesson is complete", () => {
  const expectedContractIds = ["contract-a", "contract-b", "contract-c"];
  const passingReceipt = expectedContractIds.map((id) => ({ id, passed: true }));
  assert.equal(fileStatus.projectLessonIsComplete({
    learnerComplete: true,
    projectSource: "verified source",
    verifiedSource: "verified source",
    verifiedCells: 3,
    totalCells: 3,
  }), true);
  assert.equal(fileStatus.projectLessonIsComplete({
    learnerComplete: true,
    projectSource: "edited source",
    verifiedSource: "verified source",
    verifiedCells: 3,
    totalCells: 3,
  }), false, "editing source must invalidate current completion even when learner history remains complete");
  assert.equal(fileStatus.projectLessonIsComplete({
    learnerComplete: true,
    projectSource: "edited source",
    verifiedSource: "verified source",
    verifiedCells: 0,
    totalCells: 3,
    trustedResults: [passingReceipt[0]],
    expectedContractIds,
  }), false, "a partial IDE receipt cannot stand in for the complete lesson contract set");
  assert.equal(fileStatus.projectLessonIsComplete({
    learnerComplete: true,
    projectSource: "edited source",
    verifiedSource: "verified source",
    verifiedCells: 0,
    totalCells: 3,
    trustedResults: passingReceipt,
    expectedContractIds,
  }), true, "a current passing IDE receipt must admit a behaviorally correct alternative implementation");
  assert.deepEqual(
    fileStatus.projectFileStatus({
      isLessonFile: true,
      sourceMatchesVerification: false,
      verifiedCells: 3,
      totalCells: 3,
    }),
    { tone: "in-progress", label: "Source changed · run IDE tests", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectLessonBuildStatus({
      projectSource: "edited source",
      verifiedSource: "verified source",
      verifiedCells: 0,
      totalCells: 3,
      trustedResults: passingReceipt,
      expectedContractIds,
    }),
    { tone: "passed", label: "IDE tests pass", complete: true },
  );
});

test("shared capstone entry receipts are labeled as integrated rather than file-local", () => {
  const receipt = [{ id: "compile", path: "capstone/main.tsx", label: "Compile", passed: true, detail: "Passed" }];
  const results = { "capstone/main.tsx": receipt };
  assert.equal(fileStatus.projectResultsForFile(results, "capstone/BrowserChat.tsx", "capstone/main.tsx"), receipt);
  assert.equal(fileStatus.projectUsesIntegratedEntryReceipt(results, "capstone/BrowserChat.tsx", "capstone/main.tsx"), true);
  assert.deepEqual(
    fileStatus.projectFileStatus({
      isLessonFile: false,
      requiresPassingTests: true,
      integratedEntryReceipt: true,
      results: receipt,
    }),
    { tone: "assembled", label: "Integrated entry tests pass", complete: true },
  );
});

test("only source-bound browser-lab receipts can affect project readiness", () => {
  const contractVersion = contracts.llmSystemsContractSuite.contractVersion;
  const path = course.llmSystemsCurriculum.lessonById["character-rnns"].projectPath;
  const ids = fileStatus.expectedProjectTestIdsForPath(path);
  assert.match(path, /\.py$/);
  assert.ok(ids.length > 0, "the manifest-owned Python path must retain its host contract scope");
  const results = { [path]: ids.map((id) => ({ id, path, label: id, passed: true, detail: "Passed" })) };
  const contractIdsByPath = { [path]: ids };
  assert.deepEqual(fileStatus.trustedProjectResults({
    runner: "browser-lab-v1",
    results,
    sourceTreeHash: null,
    projectRevision: 4,
    contractVersion,
    contractIdsByPath,
  }), {});
  assert.deepEqual(fileStatus.trustedProjectResults({
    runner: "browser-lab-v1",
    results,
    sourceTreeHash: "sha256:fixture",
    projectRevision: null,
    contractVersion,
    contractIdsByPath,
  }), {});
  assert.deepEqual(fileStatus.trustedProjectResults({
    runner: "browser-lab-v1",
    results,
    sourceTreeHash: "sha256:fixture",
    projectRevision: 4,
    contractVersion: "outdated-contract-version",
    contractIdsByPath,
  }), {});
  assert.deepEqual(fileStatus.trustedProjectResults({
    runner: "browser-lab-v1",
    results,
    sourceTreeHash: "sha256:fixture",
    projectRevision: 4,
    contractVersion,
    contractIdsByPath,
  }), results);
  assert.deepEqual(fileStatus.trustedProjectResults({
    runner: "browser-lab-v1",
    results,
    sourceTreeHash: "sha256:fixture",
    projectRevision: 4,
    contractVersion,
    contractIdsByPath: {},
  }), {}, "old receipts without an authoritative scope manifest are untrusted");
});

test("a passing IDE receipt covers the exact unique contract IDs for its file", () => {
  const expectedContractIds = ["a", "b", "c"];
  const result = (id, path = "models/example.py") => ({ id, path, label: id, passed: true, detail: "Passed" });
  const evidence = (trustedResults) => ({
    projectSource: "edited source",
    verifiedSource: "verified source",
    verifiedCells: 0,
    totalCells: 3,
    trustedResults,
    expectedContractIds,
  });
  assert.equal(fileStatus.projectLessonIsBuildReady(evidence([result("a"), result("b"), result("c")])), true);
  assert.equal(fileStatus.projectLessonIsBuildReady(evidence([result("a"), result("b")])), false, "missing ID");
  assert.equal(fileStatus.projectLessonIsBuildReady(evidence([result("a"), result("b"), result("c"), result("extra")])), false, "extra ID");
  assert.equal(fileStatus.projectLessonIsBuildReady(evidence([result("a"), result("b"), result("b")])), false, "duplicate ID");
  assert.equal(fileStatus.projectLessonIsBuildReady(evidence([result("a"), result("b"), result("wrong")])), false, "wrong ID");
});

test("timeline completion intentionally adds the learner-lab gate to build-ready source", () => {
  const evidence = {
    projectSource: "verified source",
    verifiedSource: "verified source",
    verifiedCells: 1,
    totalCells: 1,
  };
  assert.equal(fileStatus.projectLessonIsBuildReady(evidence), true);
  assert.equal(fileStatus.projectLessonBuildStatus(evidence).complete, true);
  assert.equal(fileStatus.projectLessonIsComplete({ ...evidence, learnerComplete: false }), false);
  assert.equal(fileStatus.projectLessonIsComplete({ ...evidence, learnerComplete: true }), true);
});

test("source progress categories are mutually exclusive and sum to the visible lesson files", () => {
  const summary = fileStatus.projectSourceProgress([
    { tone: "complete", label: "2 of 2 checks verified", complete: true },
    { tone: "in-progress", label: "1 of 3 checks verified", complete: false },
    { tone: "failed", label: "IDE tests failing", complete: false },
    { tone: "pending", label: "0 of 2 checks verified", complete: false },
  ]);
  assert.deepEqual(summary, {
    total: 4,
    verified: 1,
    partial: 1,
    needsWork: 1,
    notStarted: 1,
    percentage: 25,
  });
  assert.equal(summary.verified + summary.partial + summary.needsWork + summary.notStarted, summary.total);
  assert.deepEqual(fileStatus.projectSourceProgress([]), {
    total: 0,
    verified: 0,
    partial: 0,
    needsWork: 0,
    notStarted: 0,
    percentage: 0,
  });
});

test("timeline file counts include every provided runtime, application-shell, and lesson file", () => {
  const providedRuntimeFileCount = Object.values(workspace.RUNTIME_PATHS).length;
  const applicationShellFileCount = template.CANONICAL_BROWSER_CHAT_FILES.length;
  const lessonFileCount = course.llmSystemsCurriculum.lessonCount;
  assert.ok(template.CANONICAL_BROWSER_CHAT_FILES.some((file) => file.kind === "adapter"));
  assert.equal(
    fileStatus.projectTimelineVisibleFileCount(0, providedRuntimeFileCount, applicationShellFileCount),
    providedRuntimeFileCount + applicationShellFileCount,
  );
  assert.equal(
    fileStatus.projectTimelineVisibleFileCount(lessonFileCount, providedRuntimeFileCount, applicationShellFileCount),
    lessonFileCount + providedRuntimeFileCount + applicationShellFileCount,
  );
});

test("project views expose current completion, repository history, and accessible progress semantics", async () => {
  const [structure, timeline, workbench, projectWorkspaceSource, projectPage, responsiveCss] = await Promise.all([
    readFile(new URL("../app/components/ProjectStructureMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectTimeline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectWorkbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/project-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/project/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/responsive.css", import.meta.url), "utf8"),
  ]);
  assert.match(structure, /lesson source files are build-ready/);
  assert.doesNotMatch(structure, /saved lesson result still matches the file|current IDE run passes every expected check|A trusted failure overrides either one/);
  assert.match(structure, /role="status" aria-label=/);
  assert.doesNotMatch(structure, /role="progressbar"|aria-valuemin|aria-valuemax|aria-valuenow|project-structure-progress/);
  assert.doesNotMatch(structure, /Lesson files[\s\S]{0,80}complete/);

  assert.match(timeline, /My course position · \$\{currentPosition \|\| "start"\}/);
  assert.match(timeline, /Project history/);
  assert.match(timeline, /projectLessonIsComplete/);
  assert.match(timeline, /Lesson done/);
  assert.match(timeline, /Current code needs another check/);
  assert.match(timeline, /File added here/);
  assert.doesNotMatch(timeline, /My progress/);
  assert.doesNotMatch(timeline, /aria-pressed|Lesson 01|Lesson 07|Lesson 14|files visible|provided application shell/);
  assert.match(timeline, /Return to my progress/);
  assert.match(timeline, /aria-valuetext/);
  assert.match(timeline, /aria-current=\{lesson\.id === active\?\.id \? "step" : undefined\}/);
  assert.doesNotMatch(timeline, /RUNTIME_PATHS|PROVIDED_RUNTIME_FILE_COUNT/);

  assert.match(workbench, /aria-label=\{`\$\{file\.path\}, \$\{status\.label\}`\}/);
  assert.doesNotMatch(workbench, /status\.label\}.*verifiedCells.*checks verified/);
  assert.match(workbench, /projectUsesIntegratedEntryReceipt/);
  assert.match(workbench, /Every test passes in the current workspace, but those results aren’t part of the matching active build yet/);
  assert.doesNotMatch(workbench, /repositories\.builds\.list\(/, "a stale historical build must not block a fresh promotion");
  assert.match(projectWorkspaceSource, /repositories\.builds\.activeValidated\(PROJECT_ID\)\.catch/, "hydration must reject legacy or invalid runtime authority without dropping source history");
  assert.match(workbench, /Import failed: \$\{detail\}/);
  assert.match(workbench, /Nothing was imported\. The current project remains open and unchanged\./);
  assert.match(workbench, /await importPersistenceSnapshot[\s\S]*?catch \(error\)/, "malformed or conflicting backups must be handled without an unhandled rejection");
  assert.match(structure, /trustedProjectResults\(project\.tests\)/);
  assert.match(structure, /function ProjectGroup[\s\S]*?useState\(false\)/, "project folders must not paint fully expanded before the mobile viewport is known");
  assert.match(timeline, /trustedProjectResults\(project\.tests\)/);
  assert.match(workbench, /trustedProjectResults\(project\.tests\)/);

  assert.match(projectPage, /The files you work on across the course become one browser-chat project/);
  assert.match(projectPage, /History and privacy/);
  assert.doesNotMatch(projectPage, /When you edit a lesson file|latest full-project test result|Other unchanged lesson results|last active build stays in place/);

  const mobileRules = responsiveCss.slice(responsiveCss.indexOf("@media (max-width: 650px)"));
  assert.match(mobileRules, /\.project-timeline-controls button\s*\{[\s\S]*?min-height:\s*2\.75rem/);
});
