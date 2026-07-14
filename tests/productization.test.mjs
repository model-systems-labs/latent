import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import { createServer } from "vite";

let vite;
let course;
let learning;
let portfolio;
let projectWorkspace;
let learnerState;
let canonicalProject;
let fileStatus;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, learning, portfolio, projectWorkspace, learnerState, canonicalProject, fileStatus] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/learning.ts"),
    vite.ssrLoadModule("/app/lib/portfolio-export.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
    vite.ssrLoadModule("/app/lib/learner-state.ts"),
    vite.ssrLoadModule("/app/lib/canonical-project.ts"),
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("every lesson has one valid prediction check and one concrete behavior change", () => {
  assert.equal(Object.keys(learning.lessonLearningOutcomes).length, course.courseLessons.length);
  for (const lesson of course.courseLessons) {
    const outcome = learning.lessonLearningOutcome(lesson.id);
    assert.ok(outcome.concept.length > 40, lesson.id);
    assert.ok(outcome.before.length > 30, lesson.id);
    assert.ok(outcome.after.length > 30, lesson.id);
    assert.equal(outcome.check.choices.length, 3, lesson.id);
    assert.equal(new Set(outcome.check.choices.map((choice) => choice.id)).size, 3, lesson.id);
    assert.ok(outcome.check.choices.some((choice) => choice.id === outcome.check.correctChoiceId), lesson.id);
    assert.ok(outcome.check.explanation.length > 45, lesson.id);
  }
});

test("the four module checkpoints cover the canonical curriculum exactly", () => {
  assert.deepEqual(
    learning.moduleCheckpointDefinitions.map((checkpoint) => checkpoint.courseId),
    course.courseTracks.map((track) => track.id),
  );
  assert.deepEqual(
    learning.moduleCheckpointDefinitions.map((checkpoint) => checkpoint.moduleId),
    course.llmSystemsCurriculum.modules.map((module) => module.id),
  );
  for (const checkpoint of learning.moduleCheckpointDefinitions) {
    assert.ok(checkpoint.objective.length > 60);
    assert.ok(checkpoint.before.length > 30);
    assert.ok(checkpoint.after.length > 30);
  }
});

test("lesson source and dataset attribution is complete and reviewable", () => {
  for (const lesson of course.courseLessons) {
    assert.ok(lesson.sources.length >= 2, lesson.id);
    assert.equal(new Set(lesson.sources.map((source) => source.url)).size, lesson.sources.length, lesson.id);
    for (const source of lesson.sources) {
      assert.match(source.url, /^https:\/\//, `${lesson.id}: ${source.url}`);
      assert.ok(source.title.trim().length > 5);
      assert.ok(source.authors.trim().length > 2);
      assert.ok(source.relevance.trim().length > 25);
    }
    assert.ok(lesson.dataset.name.trim());
    assert.ok(lesson.dataset.source.trim());
    assert.ok(lesson.dataset.license.trim());
    assert.ok(lesson.dataset.size.trim());
  }
});

test("portfolio export contains source, evidence, runnable scaffolding, and a portable host boundary", () => {
  const project = projectWorkspace.emptyProjectState();
  const learner = learnerState.emptyLearnerState();
  const files = portfolio.portfolioProjectFiles({
    project,
    learner,
    lessons: course.courseLessons,
    exportedAt: "2026-07-13T00:00:00.000Z",
  });
  for (const path of ["README.md", "BACKEND_INTEGRATION.md", "TEST_REPORT.md", "THIRD_PARTY_NOTICES.md", "portfolio-manifest.json", "package.json", "index.html", "vite.config.ts"]) {
    assert.ok(files[path], path);
  }
  assert.ok(files["src/capstone/BrowserChat.tsx"]);
  assert.ok(files["src/runtime/host-bridge.ts"]);
  assert.doesNotMatch(files["src/runtime/host-bridge.ts"], /__LATENT_PREVIEW_HOST__/);
  assert.match(files["src/runtime/host-bridge.ts"], /encodeSse/);
  assert.match(files["src/runtime/host-bridge.ts"], /parseSseChunk/);
  assert.match(files["src/capstone/BrowserChat.tsx"], /from "react"/);
  assert.equal(Object.keys(files).some((path) => path.startsWith("src/vendor/")), false);
  const manifest = JSON.parse(files["portfolio-manifest.json"]);
  assert.equal(manifest.sourceFiles.length, Object.values(project.files).filter((file) => !file.path.startsWith("vendor/")).length);
  assert.equal(manifest.portableBuildReady, false);
  assert.equal(manifest.buildNumber, null, "an unfinished workspace must not invent active build #1");
  assert.match(files["README.md"], /snapshot is unfinished/i);
  assert.match(files["README.md"], /active build: none yet/i);
});

function completePortfolioInput() {
  const learner = learnerState.emptyLearnerState();
  for (const lesson of course.courseLessons) {
    learner.lessons[lesson.id] = {
      verifiedCells: lesson.implementation.codeBlocks.map((block) => block.id),
      verifiedSources: {},
      verifiedContractVersion: "browser-lab-v1",
      experimentComplete: true,
      hiddenBlocks: [],
      answers: {},
      knowledgeAnswers: {},
      knowledgeVerified: [],
      updatedAt: 1,
    };
  }
  const project = projectWorkspace.emptyProjectState();
  for (const seed of canonicalProject.completeCanonicalProjectSeeds(learner)) {
    project.files[seed.path] = { ...seed, updatedAt: 1 };
  }
  const requiredTests = course.llmSystemsCurriculum.testCount + 6;
  const contractIdsByPath = Object.fromEntries(Object.keys(project.files).flatMap((path) => {
    const ids = fileStatus.expectedProjectTestIdsForPath(path);
    return ids.length ? [[path, ids]] : [];
  }));
  const results = Object.fromEntries(Object.entries(contractIdsByPath).map(([path, ids]) => [path, ids.map((id) => ({
    id,
    path,
    label: id,
    passed: true,
    detail: "Verified by the host-owned suite.",
  }))]));
  assert.equal(Object.values(results).flat().length, requiredTests);
  project.tests = {
    results,
    ranAt: 1,
    runner: "browser-lab-v1",
    sourceTreeHash: "sha256:portable",
    projectRevision: 1,
    contractVersion: "llm-systems-contracts-v17",
    contractIdsByPath,
  };
  project.runtime = { ...project.runtime, buildNumber: 2, builtAt: 1 };
  project.activeBuild = {
    id: "build-2",
    buildNumber: 2,
    sourceTreeHash: project.tests.sourceTreeHash,
    projectRevision: project.tests.projectRevision,
    contractVersion: project.tests.contractVersion,
  };
  return { project, learner, lessons: course.courseLessons, exportedAt: "2026-07-13T00:00:00.000Z" };
}

test("portfolio readiness requires current receipts to match the active build snapshot", () => {
  const historical = completePortfolioInput();
  historical.project.activeBuild = {
    ...historical.project.activeBuild,
    id: "build-1",
    buildNumber: 1,
    sourceTreeHash: "sha256:historical-build-a",
    projectRevision: 0,
  };
  const staleBuild = portfolio.portfolioReadiness(historical);
  assert.equal(staleBuild.fullSuitePasses, true, "current workspace receipts B still pass");
  assert.equal(staleBuild.activeBuildExists, true, "historical build A still exists");
  assert.equal(staleBuild.activeBuildMatchesTests, false);
  assert.equal(staleBuild.ready, false, "build A plus receipts B must remain locked");

  const fileOnly = completePortfolioInput();
  fileOnly.project.activeBuild = null;
  const noPromotedSnapshot = portfolio.portfolioReadiness(fileOnly);
  assert.equal(noPromotedSnapshot.fullSuitePasses, true, "all current file buckets can be present");
  assert.equal(noPromotedSnapshot.activeBuildExists, false);
  assert.equal(noPromotedSnapshot.activeBuildMatchesTests, false);
  assert.equal(noPromotedSnapshot.ready, false, "file-only receipts cannot substitute for a promoted build");
});

test("portfolio readiness requires the exact mounted BrowserChat behavior receipt", () => {
  const input = completePortfolioInput();
  const path = "capstone/BrowserChat.tsx";
  assert.deepEqual(input.project.tests.contractIdsByPath[path], ["capstone/BrowserChat.tsx:host-behavior-v1"]);
  assert.equal(portfolio.portfolioReadiness(input).ready, true);
  delete input.project.tests.results[path];
  delete input.project.tests.contractIdsByPath[path];
  const missingBehavior = portfolio.portfolioReadiness(input);
  assert.equal(missingBehavior.fullSuitePasses, false);
  assert.equal(missingBehavior.ready, false, "compile-only capstone evidence must not unlock a portfolio export");
});

test("a completed portfolio exposes lesson modules and bundles as a standalone browser app", async () => {
  const input = completePortfolioInput();
  const readiness = portfolio.portfolioReadiness(input);
  assert.equal(readiness.ready, true);
  const files = portfolio.portfolioProjectFiles(input);
  assert.equal(JSON.parse(files["portfolio-manifest.json"]).portableBuildReady, true);
  assert.equal(JSON.parse(files["portfolio-manifest.json"]).buildNumber, 2);
  assert.doesNotMatch(files["README.md"], /snapshot is unfinished/i);
  for (const path of [
    "src/backend/streaming-transport.js",
    "src/backend/generation-reliability.js",
    "src/product/chat-reducer.js",
    "src/product/streaming-react.js",
    "src/product/chat-actions.js",
    "src/product/chat-quality.js",
  ]) {
    assert.match(files[path], /export \{[^}]+\};/, path);
  }

  const root = await mkdtemp(join(tmpdir(), "latent-portfolio-test-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source, "utf8");
    }
    const result = await esbuild.build({
      entryPoints: [join(root, "src/capstone/main.tsx")],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      target: "es2022",
      external: ["react", "react-dom/client"],
      logLevel: "silent",
    });
    assert.equal(result.errors.length, 0);
    assert.ok(result.outputFiles?.[0]?.text.includes("Portable mock response"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("device-local analytics has no network or free-form content fields", async () => {
  const source = await readFile(new URL("../app/lib/learning-analytics.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(source, /prompt\??:|source\??:|code\??:|content\??:/);
  assert.match(source, /MAX_EVENTS = 500/);
  assert.match(source, /device-local-no-code-no-prompts/);
});
