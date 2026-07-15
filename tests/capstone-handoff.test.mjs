import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

let vite;
let capstone;
let bindings;
let template;
let fileStatus;
let contracts;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [capstone, bindings, template, fileStatus, contracts] = await Promise.all([
    vite.ssrLoadModule("/app/components/BrowserChatCapstone.tsx"),
    vite.ssrLoadModule("/app/runtime/bindings/manifest.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function projectFixture({ complete = false, failedPath = null, runner = "browser-lab-v1" } = {}) {
  const lesson = (path, title, verified) => ({
    path,
    courseId: "models",
    title,
    content: `verified source for ${path}`,
    referenceContent: `verified source for ${path}`,
    lessonId: path,
    verifiedCells: verified,
    totalCells: 1,
    updatedAt: 1,
  });
  const titles = {
    "models/character-rnn.js": "Character RNNs",
    "backend/streaming-transport.js": "Streaming Transport",
    "product/chat-actions.js": "Actions and Context",
  };
  const files = Object.fromEntries(bindings.LLM_LESSON_SOURCES.map((source, index) => [
    source.sourcePath,
    lesson(source.sourcePath, titles[source.sourcePath] ?? source.sourcePath.split("/").at(-1), complete || index === 0 ? 1 : 0),
  ]));
  const results = failedPath
    ? {
        [failedPath]: fileStatus.expectedProjectTestIdsForPath(failedPath).map((id) => ({
          id,
          path: failedPath,
          label: "Required export",
          passed: false,
          detail: "The expected export is missing.",
        })),
      }
    : {};
  const contractIdsByPath = failedPath
    ? { [failedPath]: fileStatus.expectedProjectTestIdsForPath(failedPath) }
    : {};
  return {
    files,
    tests: {
      results,
      ranAt: Object.keys(results).length ? 1 : 0,
      runner,
      sourceTreeHash: runner === "browser-lab-v1" ? "sha256:fixture-source-tree" : null,
      projectRevision: runner === "browser-lab-v1" ? 1 : null,
      contractVersion: runner === "browser-lab-v1" ? contracts.llmSystemsContractSuite.contractVersion : null,
      contractIdsByPath,
    },
  };
}

function lessonPath(lessonId) {
  const source = bindings.LLM_LESSON_SOURCES.find((candidate) => candidate.lessonId === lessonId);
  assert.ok(source, `Expected curriculum lesson ${lessonId}`);
  return source.sourcePath;
}

function verifiedLessonEvidence(project) {
  return Object.fromEntries(bindings.LLM_LESSON_SOURCES.map(({ sourcePath }) => [
    sourcePath,
    {
      content: `verified source for ${sourcePath}`,
      verifiedCells: project.files[sourcePath]?.verifiedCells ?? 0,
      totalCells: project.files[sourcePath]?.totalCells ?? 1,
    },
  ]));
}

function summarize(project) {
  return capstone.summarizeCapstoneProgress(project, verifiedLessonEvidence(project));
}

test("an incomplete project follows curriculum order instead of leapfrogging to a later failure", () => {
  const failedPath = lessonPath("chat-actions-context");
  const project = projectFixture({ failedPath });
  const progress = summarize(project);
  assert.equal(progress.verifiedLessonFiles, 1);
  assert.equal(progress.totalLessonFiles, 14);
  assert.equal(progress.passingTests, 0);
  assert.equal(progress.totalTests, fileStatus.expectedProjectTestIdsForPath(failedPath).length);
  assert.equal(progress.nextPath, bindings.LLM_LESSON_SOURCES[1].sourcePath);

  const recovery = capstone.capstoneMissingBuildRecovery(progress);
  assert.equal(recovery.blockedStage, "source");
  assert.equal(recovery.path, bindings.LLM_LESSON_SOURCES[1].sourcePath);
  assert.equal(recovery.href, `/workspace?file=${encodeURIComponent(bindings.LLM_LESSON_SOURCES[1].sourcePath)}`);
  assert.match(recovery.summary, /1 of 14 lesson files are verified/);
  assert.match(recovery.actionLabel, new RegExp(bindings.LLM_LESSON_SOURCES[1].sourcePath.split("/").at(-1).replaceAll(".", "\\.")));
});

test("a trusted failure disqualifies an otherwise verified file and becomes the repair target", () => {
  const failedPath = lessonPath("chat-actions-context");
  const progress = summarize(projectFixture({ complete: true, failedPath }));
  assert.equal(progress.verifiedLessonFiles, 13);
  assert.equal(progress.nextPath, failedPath);
  const recovery = capstone.capstoneMissingBuildRecovery(progress);
  assert.equal(recovery.blockedStage, "source");
  assert.equal(recovery.path, failedPath);
  assert.equal(recovery.href, `/workspace?file=${encodeURIComponent(failedPath)}`);
});

test("all four project surfaces derive their numerator from the same source-bound predicate", async () => {
  const failedPath = bindings.LLM_LESSON_SOURCES[2].sourcePath;
  const driftedPath = bindings.LLM_LESSON_SOURCES[5].sourcePath;
  const project = projectFixture({ complete: true, failedPath });
  project.files[driftedPath] = { ...project.files[driftedPath], content: "edited after verification" };
  const verifiedSources = verifiedLessonEvidence(project);
  const evidence = bindings.LLM_LESSON_SOURCES.map(({ sourcePath }) => ({
    projectSource: project.files[sourcePath].content,
    verifiedSource: verifiedSources[sourcePath].content,
    verifiedCells: verifiedSources[sourcePath].verifiedCells,
    totalCells: project.files[sourcePath].totalCells,
    trustedResults: project.tests.results[sourcePath] ?? [],
    expectedContractIds: fileStatus.expectedProjectContractIdsForPath(sourcePath),
  }));
  const expected = evidence.filter((entry) => fileStatus.projectLessonIsBuildReady(entry)).length;
  const statusNumerator = evidence.filter((entry) => fileStatus.projectLessonBuildStatus(entry).complete).length;
  const timelineNumerator = evidence.filter((entry) => fileStatus.projectLessonIsComplete({
    ...entry,
    learnerComplete: true,
  })).length;
  const capstoneNumerator = capstone.summarizeCapstoneProgress(project, verifiedSources).verifiedLessonFiles;
  assert.deepEqual(
    { structure: statusNumerator, workbench: statusNumerator, timeline: timelineNumerator, capstone: capstoneNumerator },
    { structure: expected, workbench: expected, timeline: expected, capstone: expected },
  );
  assert.equal(expected, 12, "one edited source and one trusted failing receipt must both leave the numerator");

  const [structureSource, workbenchSource, timelineSource, capstoneSource] = await Promise.all([
    readFile(new URL("../app/components/ProjectStructureMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectWorkbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectTimeline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(structureSource, /projectLessonBuildStatus/);
  assert.match(workbenchSource, /projectLessonBuildStatus/);
  assert.match(timelineSource, /projectLessonIsComplete/);
  assert.match(capstoneSource, /projectLessonBuildStatus/);
  assert.match(capstoneSource, /trustedProjectResults\(project\.tests\)/);
  assert.doesNotMatch(capstoneSource, /verifiedLessonFiles:\s*descriptor\.contributions\.length/);
  assert.deepEqual(capstone.capstonePathPresentation("ready", capstone.summarizeCapstoneProgress(project, verifiedSources)), {
    sourceState: "pending",
    buildState: "complete",
    previewState: "current",
    previewDetail: "ready to run",
  }, "an older active build must not overwrite current workspace drift");
});

test("untrusted legacy results cannot change capstone progress or saved receipt counts", () => {
  const project = projectFixture({
    complete: true,
    failedPath: lessonPath("chat-actions-context"),
    runner: "legacy",
  });
  const progress = summarize(project);
  assert.equal(progress.verifiedLessonFiles, 14);
  assert.equal(progress.totalTests, 0);
  assert.equal(progress.passingTests, 0);
  assert.equal(progress.nextPath, "capstone/BrowserChat.tsx");
});

test("a complete current IDE receipt admits an alternative lesson implementation", () => {
  const path = bindings.LLM_LESSON_SOURCES[0].sourcePath;
  const project = projectFixture({ complete: true });
  project.files[path] = { ...project.files[path], content: "behaviorally correct alternative", verifiedCells: 0 };
  const expectedIds = fileStatus.expectedProjectTestIdsForPath(path);
  project.tests.results[path] = expectedIds.map((id) => ({
    id,
    path,
    label: "Alternative implementation",
    passed: true,
    detail: "Passed",
  }));
  project.tests.contractIdsByPath[path] = expectedIds;
  const verified = verifiedLessonEvidence(projectFixture({ complete: true }));
  const progress = capstone.summarizeCapstoneProgress(project, verified);
  assert.equal(progress.verifiedLessonFiles, 14);
  assert.equal(progress.nextPath, "capstone/BrowserChat.tsx");
});

test("direct capstone progress ignores denormalized file verification counts", () => {
  const project = projectFixture({ complete: true });
  const verified = verifiedLessonEvidence(project);
  const path = bindings.LLM_LESSON_SOURCES[0].sourcePath;
  verified[path] = { ...verified[path], verifiedCells: 0 };
  const progress = capstone.summarizeCapstoneProgress(project, verified);
  assert.equal(project.files[path].verifiedCells, 1, "fixture contains a stale denormalized count");
  assert.equal(progress.verifiedLessonFiles, 13, "capstone must use restored canonical proof instead");
});

test("verified lesson files lead to the integration file and one explicit full-build action", () => {
  const progress = summarize(projectFixture({ complete: true }));
  const recovery = capstone.capstoneMissingBuildRecovery(progress);
  assert.equal(progress.verifiedLessonFiles, 14);
  assert.equal(recovery.blockedStage, "build");
  assert.equal(recovery.path, "capstone/BrowserChat.tsx");
  assert.equal(recovery.href, "/workspace?file=capstone%2FBrowserChat.tsx");
  assert.match(recovery.summary, /All 14 lesson files are verified/);
  assert.match(recovery.actionLabel, /Test, build & run/);
});

test("a complete active build presents verified evidence and one honest run action", () => {
  const progress = summarize(projectFixture({ complete: true }));
  const copy = capstone.capstoneReadyGateCopy(8);
  assert.equal(copy.eyebrow, "Verified build 8");
  assert.equal(copy.title, "Run your verified build.");
  assert.match(copy.summary, /lesson files and the React app passed together/);
  assert.match(copy.summary, /isolated frame/);
  assert.deepEqual(capstone.capstonePathPresentation("ready", progress), {
    sourceState: "complete",
    buildState: "complete",
    previewState: "current",
    previewDetail: "ready to run",
  });
});

test("saved test receipts are not mislabeled as one test run", () => {
  const progress = {
    ...summarize(projectFixture()),
    passingTests: 12,
    totalTests: 18,
  };
  assert.deepEqual(capstone.capstoneTestEvidence("missing", null, progress), {
    label: "Saved test results",
    value: "12/18 currently passing",
  });
  assert.deepEqual(capstone.capstoneTestEvidence("ready", 9, progress), {
    label: "Build test results",
    value: "Every test passed for build #9",
  });
});

test("a missing UI mount is translated into a safe entrypoint rebuild instead of leaking capability jargon", () => {
  const progress = summarize(projectFixture({ complete: true }));
  const recovery = capstone.capstoneRecoveryForFailure({
    code: "MISSING_REQUIRED_CAPABILITY",
    message: "The active build is missing required capability ui.mount.",
  }, progress);
  assert.equal(recovery.path, "capstone/main.tsx");
  assert.equal(recovery.blockedStage, "build");
  assert.equal(recovery.actionPath, "capstone/BrowserChat.tsx");
  assert.equal(recovery.href, "/workspace?file=capstone%2FBrowserChat.tsx");
  assert.equal(template.CANONICAL_BROWSER_CHAT_FILES.find((file) => file.path === recovery.path)?.editable, false);
  assert.equal(template.CANONICAL_BROWSER_CHAT_FILES.find((file) => file.path === recovery.actionPath)?.editable, true);
  assert.match(recovery.pathLabel, /React preview entrypoint/);
  assert.match(recovery.why, /provided entrypoint/);
  assert.match(recovery.why, /editable BrowserChat/);
  assert.match(recovery.actionLabel, /Test, build & run/);
  assert.doesNotMatch(`${recovery.title} ${recovery.summary} ${recovery.actionLabel}`, /ui\.mount|missing required capability/i);
});

test("other required capabilities route to their course-provided read-only adapter", () => {
  const progress = summarize(projectFixture({ complete: true }));
  for (const definition of bindings.LLM_RUNTIME_CAPABILITIES.filter((candidate) => candidate.required)) {
    const recovery = capstone.capstoneRecoveryForFailure({
      code: "MISSING_REQUIRED_CAPABILITY",
      message: `The active build is missing required capability ${definition.capability}.`,
    }, progress);
    assert.equal(recovery.path, definition.modulePath, definition.capability);
    if (definition.capability === "ui.mount") {
      assert.equal(recovery.actionPath, "capstone/BrowserChat.tsx");
      assert.equal(recovery.href, "/workspace?file=capstone%2FBrowserChat.tsx");
    } else {
      const adapter = template.CANONICAL_BROWSER_CHAT_FILES.find((file) => file.path === definition.modulePath);
      assert.equal(adapter?.kind, "adapter", definition.capability);
      assert.equal(adapter?.editable, false, definition.capability);
      assert.equal(recovery.actionPath, definition.modulePath, definition.capability);
      assert.equal(recovery.href, `/workspace?file=${encodeURIComponent(definition.modulePath)}`, definition.capability);
    }
    assert.doesNotMatch(recovery.pathLabel, new RegExp(definition.capability.replaceAll(".", "\\.")), definition.capability);
  }
});

test("an incomplete-contribution error routes the exact known lesson path named by the verifier", () => {
  const progress = summarize(projectFixture());
  const missingPath = lessonPath("reliability-observability");
  const recovery = capstone.capstoneRecoveryForFailure({
    code: "INCOMPLETE_BUILD_CONTRIBUTIONS",
    message: `The active build does not include tested lesson source ${missingPath}.`,
  }, progress);
  assert.equal(recovery.path, missingPath);
  assert.equal(recovery.actionPath, missingPath);
  assert.equal(recovery.href, `/workspace?file=${encodeURIComponent(missingPath)}`);
  assert.match(recovery.pathLabel, /Missing contribution/);
});

test("a host runtime outage preserves the passing build and offers a retry rather than a source edit", () => {
  const progress = summarize(projectFixture({ complete: true }));
  const recovery = capstone.capstoneRecoveryForFailure(new Error("The trusted React preview runtime is unavailable."), progress);
  assert.equal(recovery.action, "retry");
  assert.equal(recovery.path, null);
  assert.equal(recovery.blockedStage, "preview");
  assert.match(recovery.summary, /passing project build is still safe/);
});

test("generation admission verifies the React-authored request frame byte for byte", () => {
  const messages = [
    { role: "system", content: "Answer technically." },
    { role: "user", content: "Explain softmax." },
  ];
  const requestFrame = capstone.canonicalGenerationRequestFrame(
    "logical-1",
    "attempt-1",
    "transport-1",
    "student",
    messages,
  );
  const payload = {
    logicalRequestId: "logical-1",
    attemptId: "attempt-1",
    requestId: "transport-1",
    backend: "student",
    messages,
    requestFrame,
    options: { temperature: 0.8, topK: 12, maxTokens: 80 },
  };
  assert.ok(capstone.generationPayload(payload));
  assert.equal(capstone.generationPayload({ ...payload, requestFrame: requestFrame.replace("Explain softmax.", "Explain attention.") }), null);
  assert.equal(capstone.generationPayload({ ...payload, messages: [...messages, { role: "assistant", content: "extra" }] }), null);
});

test("a missing source-bound Python checkpoint routes directly to the model training action", () => {
  const progress = summarize(projectFixture({ complete: true }));
  const recovery = capstone.capstoneRecoveryForFailure({
    code: "MISSING_SOURCE_BOUND_CHECKPOINT",
    message: "The active build has no exact Python checkpoint.",
  }, progress);
  assert.equal(recovery.path, "models/character-rnn.py");
  assert.equal(recovery.actionPath, "models/character-rnn.py");
  assert.equal(recovery.href, "/workspace?file=models%2Fcharacter-rnn.py");
  assert.match(recovery.why, /imported checkpoints, checkpoints trained in JavaScript, or checkpoints from older source/);
});

test("the learner-facing component no longer emits the old dead-end or raw capability failure", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/capstone.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /Canonical project required|Build the repository in the IDE/);
  assert.doesNotMatch(source, /Restore the capstone build/);
  assert.match(source, /Verifying your active build/);
  assert.doesNotMatch(source, /setDetail\(error instanceof Error \? error\.message/);
  assert.doesNotMatch(source, /Last test run|passing in the last run/);
  assert.match(source, /Current lesson files/);
  assert.match(source, /<strong>Active build<\/strong>/);
  assert.match(source, /await reconcileCanonicalProject\(\)/);
  assert.match(source, /Sandboxed React preview/);
  assert.match(source, /aria-label="Verified lesson files"/);
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true">\{detail\}/);
  assert.match(source, /const restoreRunFocusRef = useRef\(false\)/);
  assert.match(source, /resetPreviewButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /runPreviewButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /ref=\{resetPreviewButtonRef\}[\s\S]*?restoreRunFocusRef\.current = true; setRunRequested\(false\)/);
  assert.match(source, /ref=\{runPreviewButtonRef\}[\s\S]*?setRunRequested\(true\)/);
  assert.match(styles, /height: calc\(100dvh - 4\.8rem\)/);
  assert.match(styles, /grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.compiled-capstone-runtime iframe[\s\S]*height: 100%;[\s\S]*min-height: 0/);
  assert.match(styles, /\.compiled-capstone-runtime > header button[\s\S]*min-height: 2\.75rem/);
  const gateStyles = styles.slice(styles.indexOf(".capstone-gate-copy"), styles.indexOf("@media (max-width: 700px)"));
  assert.ok(gateStyles.length > 0, "capstone gate styles must remain a distinct scoped surface");
  assert.doesNotMatch(gateStyles, /font-size:\s*0\.(?:[0-5]\d*|6[0-7]?)rem/, "gate microcopy must retain an 11px minimum");
  assert.match(gateStyles, /\.capstone-progress-line span[\s\S]*font-size: max\(0\.68rem, 11px\)/);
  assert.match(gateStyles, /\.capstone-build-path li > span[^\n]*font-size: max\(0\.68rem, 11px\)/);
  assert.match(gateStyles, /\.capstone-build-path code[^\n]*font-size: max\(0\.68rem, 11px\)/);
  assert.match(gateStyles, /\.capstone-next-step > button[\s\S]*font-size: max\(0\.68rem, 11px\)/);
});
