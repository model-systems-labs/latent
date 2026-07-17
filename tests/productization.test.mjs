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
let contracts;
let template;
let provenance;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, learning, portfolio, projectWorkspace, learnerState, canonicalProject, fileStatus, contracts, template, provenance] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/learning.ts"),
    vite.ssrLoadModule("/app/lib/portfolio-export.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
    vite.ssrLoadModule("/app/lib/learner-state.ts"),
    vite.ssrLoadModule("/app/lib/canonical-project.ts"),
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lessons/provenance.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function manifestLessonPaths() {
  return course.llmSystemsCurriculum.lessons.map((entry) => entry.projectPath);
}

function courseProvidedAdapters() {
  return template.CANONICAL_BROWSER_CHAT_FILES.filter((file) => file.kind === "adapter");
}

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
  assert.deepEqual(
    Object.keys(provenance.lessonContentProvenance).sort(),
    course.courseLessons.map((lesson) => lesson.id).sort(),
  );
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
    assert.match(lesson.dataset.source, /^Course-authored synthetic /, lesson.id);
    assert.equal(lesson.dataset.license, "Not separately licensed", lesson.id);
    assert.ok(lesson.dataset.size.trim());
    const record = provenance.getLessonContentProvenance(lesson.id);
    assert.equal(record.prose, "course-authored", lesson.id);
    assert.equal(record.diagrams, "course-authored", lesson.id);
    assert.equal(record.exercises, "course-authored", lesson.id);
    assert.equal(record.implementation, "independent-course-implementation", lesson.id);
    assert.equal(record.dataset, "course-authored-synthetic", lesson.id);
    assert.equal(record.reviewedAt, "2026-07-17", lesson.id);
    assert.ok(record.note.length > 50, lesson.id);
  }
});

test("reviewed lessons do not reintroduce the two remediated source patterns", async () => {
  const root = new URL("../", import.meta.url);
  const rnnTrainerSources = await Promise.all([
    "app/lessons/model/character-rnn-training.ts",
    "packages/model-lab/src/character-rnn.ts",
  ].map((path) => readFile(new URL(path, root), "utf8")));
  for (const source of rnnTrainerSources) {
    assert.doesNotMatch(source, /Adagrad|mWxh|mWhh|mWhy|dhnext|lossFun|smooth_loss/);
  }

  const bpeSources = await Promise.all([
    "app/lessons/model/subword-tokenization.ts",
    "app/lessons/lesson-flair.ts",
    "app/lessons/exercise-contracts.ts",
    "app/content/llm-systems/contracts.ts",
  ].map((path) => readFile(new URL(path, root), "utf8")));
  for (const source of bpeSources) {
    assert.doesNotMatch(source, /\blower\b|low\|er/);
  }

  const [policy, record] = await Promise.all([
    readFile(new URL("app/sources/page.tsx", root), "utf8"),
    readFile(new URL("CONTENT_PROVENANCE.md", root), "utf8"),
  ]);
  assert.match(policy, /Their prose, figures, tutorial code, and datasets are not republished here/);
  assert.match(record, /character-RNN trainers had followed the organization/);
  assert.match(record, /BPE lesson used the paper's recognizable/);
});

test("model lesson headers describe mechanisms without implying author endorsement", () => {
  const authorNames = /Karpathy|Bengio|Sennrich|Haddow|Birch|Bahdanau|Cho|Vaswani|Brown|et al\.|\b(?:19|20)\d{2}\b/i;
  for (const lesson of course.getTrackLessons("models")) {
    assert.doesNotMatch(lesson.eyebrow, authorNames, lesson.id);
    assert.ok(lesson.authors.trim(), `${lesson.id} still needs explicit attribution in its source metadata`);
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
  assert.equal("pytorchFiles" in manifest, false);
  assert.equal(Object.keys(files).some((path) => path.startsWith("pytorch/")), false);
  assert.doesNotMatch(Object.values(files).join("\n"), /Colab|Download notebook|native Python track|native runtime/i);
  for (const adapter of courseProvidedAdapters()) {
    assert.ok(files[`src/${adapter.path}`], adapter.path);
    assert.ok(manifest.sourceFiles.includes(adapter.path), `${adapter.path} must be declared in the portable source manifest`);
  }
  assert.equal(manifest.portableBuildReady, false);
  assert.equal(manifest.buildNumber, null, "an unfinished workspace must not invent active build #1");
  assert.match(files["README.md"], /archive isn't finished yet/i);
  assert.match(files["README.md"], /current build: none yet/i);
});

function completePortfolioInput() {
  const learner = learnerState.emptyLearnerState();
  for (const lesson of course.courseLessons) {
    const answers = Object.fromEntries(lesson.implementation.codeBlocks.map((block) => [block.id, block.code]));
    const checkId = learning.lessonLearningOutcome(lesson.id).check.id;
    learner.lessons[lesson.id] = {
      verifiedCells: lesson.implementation.codeBlocks.map((block) => block.id),
      verifiedSources: { ...answers },
      verifiedContractVersion: contracts.llmSystemsContractSuite.contractVersion,
      experimentComplete: true,
      hiddenBlocks: lesson.implementation.codeBlocks.map((block) => block.id),
      answers,
      knowledgeAnswers: {},
      knowledgeVerified: [checkId],
      updatedAt: 1,
    };
  }
  const project = projectWorkspace.emptyProjectState();
  for (const seed of canonicalProject.completeCanonicalProjectSeeds(learner)) {
    project.files[seed.path] = { ...seed, updatedAt: 1 };
  }
  const requiredTests = contracts.llmSystemsContractSuite.contracts.length + 6;
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
    contractVersion: contracts.llmSystemsContractSuite.contractVersion,
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
  const path = template.CAPSTONE_COMPONENT_PATH;
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
  const manifest = JSON.parse(files["portfolio-manifest.json"]);
  assert.equal(manifest.portableBuildReady, true);
  assert.equal(manifest.buildNumber, 2);
  assert.doesNotMatch(files["README.md"], /copy isn't finished yet/i);
  const lessonPaths = manifestLessonPaths();
  assert.equal(lessonPaths.length, course.llmSystemsCurriculum.lessonCount);
  assert.equal(lessonPaths.every((path) => path.endsWith(".py")), true);
  for (const path of lessonPaths) {
    assert.ok(files[`src/${path}`], path);
    assert.ok(manifest.sourceFiles.includes(path), `${path} must be declared in the portable source manifest`);
    assert.equal(files[`src/${path.replace(/\.py$/, ".js")}`], undefined, `${path} must not regain a synthetic JavaScript lesson twin`);
  }
  for (const adapter of courseProvidedAdapters()) {
    const exportedPath = `src/${adapter.path}`;
    assert.match(files[exportedPath], /course provides this read-only JavaScript adapter/i);
    assert.match(files[exportedPath], /export (?:function|const|\{)/, exportedPath);
    assert.ok(manifest.sourceFiles.includes(adapter.path));
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
    assert.ok(result.outputFiles?.[0]?.text.includes("This portable demo received"));
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
