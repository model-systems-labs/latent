import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild-wasm";

let temporaryDirectory;
let compiler;

test.before(async () => {
  temporaryDirectory = await mkdtemp(join(fileURLToPath(new URL("../", import.meta.url)), ".virtual-compiler-test-"));
  const output = join(temporaryDirectory, "compiler.mjs");
  await esbuild.build({
    entryPoints: [fileURLToPath(new URL("../app/platform/browser-lab/index.ts", import.meta.url))],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  });
  compiler = await import(`${pathToFileURL(output).href}?test=${Date.now()}`);
});

test.after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

function esbuildAdapter() {
  return { version: esbuild.version, build: esbuild.build };
}

async function createJob(files, entryPoints, overrides = {}) {
  return compiler.createCompileJob({
    jobId: overrides.jobId ?? "compile-1",
    compilerVersion: compiler.compilerVersionForEsbuild(esbuild.version),
    snapshot: {
      projectId: overrides.projectId ?? "project-1",
      revision: overrides.revision ?? 4,
      files,
    },
    entryPoints,
    submittedAt: 100,
  });
}

test("allowlisted lesson declarations become the complete public module surface", async () => {
  const source = `
function add(left, right) {
  return left + right;
}

function hidden(value) {
  return value * 100;
}
`;
  const exposed = compiler.exposeLessonFunctions(source, ["add"]);
  assert.match(exposed, /export \{ add \};/);
  assert.throws(() => compiler.exposeLessonFunctions(source, ["missing"]), (error) => error.code === "MISSING_LESSON_EXPORT");
  assert.throws(() => compiler.exposeLessonFunctions("export function add() {}", ["add"]), (error) => error.code === "EXISTING_EXPORTS");

  const job = await createJob([{ path: "src/lesson.js", loader: "js", contents: exposed }], ["src/lesson.js"]);
  const program = await compiler.compileVirtualProject(job, esbuildAdapter());
  assert.equal(program.diagnostics.length, 0);
  assert.equal(program.modules.length, 1);
  assert.equal(program.modules[0].globalName, compiler.globalNameForModulePath("src/lesson.js"));
  assert.match(program.modules[0].code, /add:/);
  assert.doesNotMatch(program.modules[0].code, /hidden:/, "an unexported declaration must not become part of the IIFE export object");
});

test("the VFS compiler bundles js, jsx, ts, tsx, and json without host imports", async () => {
  const files = [
    { path: "src/value.js", loader: "js", contents: "export const value = 2;" },
    { path: "src/plain.jsx", loader: "jsx", contents: "export function Plain(){ return <b>plain</b>; }" },
    { path: "src/typed.ts", loader: "ts", contents: "import { value } from './value'; export const doubled: number = value * 2;" },
    { path: "src/view.tsx", loader: "tsx", contents: "type Props = { label: string }; export function View(props: Props){ return <strong>{props.label}</strong>; }" },
    { path: "src/config.json", loader: "json", contents: "{\"temperature\":0.7}" },
    { path: "src/config-reader.ts", loader: "ts", contents: "import config from './config'; export function temperature(){ return config.temperature; }" },
  ];
  const entries = ["src/value.js", "src/plain.jsx", "src/typed.ts", "src/view.tsx", "src/config.json", "src/config-reader.ts"];
  const job = await createJob(files, entries);
  const program = await compiler.compileVirtualProject(job, esbuildAdapter());
  assert.equal(program.diagnostics.length, 0);
  assert.deepEqual(program.modules.map((item) => item.modulePath), entries);
  assert.equal(new Set(program.modules.map((item) => item.globalName)).size, entries.length);
  for (const compiledModule of program.modules) {
    assert.match(compiledModule.code, new RegExp(`var ${compiledModule.globalName.replaceAll("$", "\\$")}\\b`));
    assert.match(compiledModule.codeHash, /^sha256:[a-f0-9]{64}$/);
  }
});

test("URL, package, missing, and project-escaping imports fail closed as bounded diagnostics", async () => {
  const files = [{
    path: "src/main.ts",
    loader: "ts",
    contents: [
      "import 'https://example.com/remote.js';",
      "import 'react';",
      "import './missing';",
      "import '../../outside.js';",
      "export const ready = true;",
    ].join("\n"),
  }];
  const job = await createJob(files, ["src/main.ts"]);
  const program = await compiler.compileVirtualProject(job, esbuildAdapter(), { maxDiagnostics: 2 });
  assert.equal(program.modules.length, 0);
  assert.ok(program.diagnostics.length > 0 && program.diagnostics.length <= 2);
  assert.ok(program.diagnostics.every((diagnostic) => diagnostic.severity === "error"));
  assert.match(program.diagnostics.map((diagnostic) => diagnostic.message).join(" "), /allowed|not found|escapes/i);
});

test("source hashes, revisions, compiler versions, and output hashes are validated", async () => {
  assert.equal(compiler.BROWSER_LAB_COMPILER_VERSION, compiler.compilerVersionForEsbuild(esbuild.version));
  const files = [{ path: "src/main.js", loader: "js", contents: "export const ok = true;" }];
  const job = await createJob(files, ["src/main.js"]);
  await assert.rejects(
    () => compiler.compileVirtualProject({ ...job, files: [{ ...files[0], contents: "export const ok = false;" }] }, esbuildAdapter()),
    (error) => error.code === "STALE_COMPILE",
  );
  await assert.rejects(
    () => compiler.compileVirtualProject({ ...job, projectRevision: -1 }, esbuildAdapter()),
    (error) => error.code === "INVALID_REVISION",
  );
  await assert.rejects(
    () => compiler.compileVirtualProject({ ...job, compilerVersion: "esbuild-wasm-0.0.0" }, esbuildAdapter()),
    (error) => error.code === "INVALID_COMPILER",
  );
  const program = await compiler.compileVirtualProject(job, esbuildAdapter());
  await assert.rejects(
    () => compiler.verifyCompiledProgramHashes({ ...program, modules: [{ ...program.modules[0], code: `${program.modules[0].code}\n// changed` }] }),
    (error) => error.code === "COMPILED_CODE_TAMPERED",
  );
});

test("compiler client is lazy, validates worker identity, and terminates on dispose", async () => {
  const files = [{ path: "src/main.js", loader: "js", contents: "export const ok = true;" }];
  const job = await createJob(files, ["src/main.js"]);
  const program = await compiler.compileVirtualProject(job, esbuildAdapter());
  const listeners = { message: new Set(), error: new Set() };
  let created = 0;
  let terminated = 0;
  const worker = {
    postMessage(message) {
      queueMicrotask(() => {
        for (const listener of listeners.message) listener({ data: { type: "browser-lab/compile-completed", jobId: message.payload.jobId, program } });
      });
    },
    terminate() { terminated += 1; },
    addEventListener(type, listener) { listeners[type].add(listener); },
    removeEventListener(type, listener) { listeners[type].delete(listener); },
  };
  const client = new compiler.BrowserLabCompilerClient(() => { created += 1; return worker; });
  assert.equal(created, 0, "the compiler worker must not load until the first build");
  assert.equal((await client.compile(job)).sourceHash, job.sourceHash);
  assert.equal(created, 1);
  client.dispose();
  assert.equal(terminated, 1);
  await assert.rejects(() => client.compile(job), (error) => error.code === "COMPILER_DISPOSED");
});

test("the production compiler has a dedicated URL worker and no dynamic evaluation fallback", async () => {
  const sources = await Promise.all([
    "../app/platform/browser-lab/compiler/client.ts",
    "../app/platform/browser-lab/compiler/compiler.worker.ts",
    "../app/platform/browser-lab/compiler/virtual-project.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const source = sources.join("\n");
  assert.match(source, /new Worker\(new URL\("\.\/compiler\.worker\.ts", import\.meta\.url\)/);
  assert.match(source, /initialize\(\{ wasmURL, worker: false \}\)/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
  assert.doesNotMatch(source, /globalThis\s*\.\s*eval\s*\(/);
  assert.doesNotMatch(source, /https?:\/\//);
});
