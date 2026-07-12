import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { createServer } from "vite";

let vite;
let course;
let implementation;
let contracts;
let template;
let compiler;
let browserLab;
let tensor;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, implementation, contracts, template, compiler, browserLab, tensor] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/lessons/implementation-source.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/compiler/index.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/index.ts"),
    vite.ssrLoadModule("/packages/tensor/src/browser-source.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function loaderFor(path) {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".json")) return "json";
  return "js";
}

function canonicalFiles(overrides = new Map()) {
  const exportsByPath = new Map();
  for (const contract of contracts.llmSystemsContractSuite.contracts) {
    for (const exerciseCase of contract.cases) {
      const names = exportsByPath.get(exerciseCase.invoke.modulePath) ?? new Set();
      names.add(exerciseCase.invoke.exportName);
      exportsByPath.set(exerciseCase.invoke.modulePath, names);
    }
  }
  const lessonFiles = course.courseLessons.map((lesson) => {
    const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
    const source = implementation.lessonImplementationSource(lesson, lesson.implementation.codeBlocks.map((block) => block.code));
    const names = [...(exportsByPath.get(path) ?? [])];
    return {
      path,
      contents: overrides.get(path) ?? (names.length ? compiler.exposeLessonFunctions(source, names) : source),
      loader: loaderFor(path),
    };
  });
  return [
    ...lessonFiles,
    ...template.CANONICAL_BROWSER_CHAT_FILES.map((file) => ({
      path: file.path,
      contents: overrides.get(file.path) ?? file.source,
      loader: loaderFor(file.path),
    })),
    { path: tensor.LATENT_TENSOR_PATH, contents: tensor.LATENT_TENSOR_SOURCE, loader: "js" },
  ];
}

async function compileCanonical(files, jobId) {
  const snapshot = { projectId: "browser-chat", revision: 1, files };
  const job = await browserLab.createCompileJob({
    jobId,
    snapshot,
    compilerVersion: compiler.compilerVersionForEsbuild(esbuild.version),
    entryPoints: [template.CAPSTONE_ENTRY_PATH],
  });
  return compiler.compileVirtualProject(job, esbuild);
}

test("the canonical IDE repository compiles its real React capstone entry", async () => {
  const program = await compileCanonical(canonicalFiles(), "canonical-capstone-compile");
  assert.equal(program.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0);
  assert.equal(program.modules.length, 1);
  assert.equal(program.modules[0].modulePath, template.CAPSTONE_ENTRY_PATH);
  assert.match(program.modules[0].code, /Browser Chat/);
  assert.match(program.modules[0].code, /__LATENT_PREVIEW_HOST__/);
});

test("an editable capstone source change produces a different runnable bundle", async () => {
  const baseline = await compileCanonical(canonicalFiles(), "canonical-capstone-baseline");
  const component = template.CANONICAL_BROWSER_CHAT_FILES.find((file) => file.path === template.CAPSTONE_COMPONENT_PATH);
  assert.ok(component);
  const editedSource = component.source.replace("Ask the system you built.", "Ask your compiled project.");
  assert.notEqual(editedSource, component.source);

  const edited = await compileCanonical(
    canonicalFiles(new Map([[template.CAPSTONE_COMPONENT_PATH, editedSource]])),
    "canonical-capstone-edited",
  );
  assert.equal(edited.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0);
  assert.notEqual(edited.modules[0].codeHash, baseline.modules[0].codeHash);
  assert.match(edited.modules[0].code, /Ask your compiled project\./);
});
