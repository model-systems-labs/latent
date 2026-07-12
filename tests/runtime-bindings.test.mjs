import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let runtime;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  runtime = await vite.ssrLoadModule("/app/runtime/bindings/index.ts");
});

after(async () => {
  await vite?.close();
});

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function artifactFixture(overrides = {}) {
  const modules = runtime.LLM_LESSON_SOURCES.map((lesson, index) => {
    const code = `var __lesson_${index} = (() => ({}))();`;
    return {
      modulePath: lesson.sourcePath,
      globalName: `__lesson_${index}`,
      code,
      codeHash: sha256(code),
    };
  });
  const sourceHash = sha256("complete learner source tree");
  const program = {
    schemaVersion: 1,
    format: "browser-lab-iife-v1",
    compileJobId: "compile-1",
    projectId: "browser-chat",
    projectRevision: 14,
    sourceHash,
    compilerVersion: "esbuild-0.28.1",
    modules,
    diagnostics: [],
  };
  return {
    schemaVersion: 1,
    artifactId: "artifact-14",
    projectId: program.projectId,
    buildNumber: 4,
    projectRevision: program.projectRevision,
    sourceHash,
    contractVersion: "llm-systems-v1",
    compilerVersion: program.compilerVersion,
    createdAt: 1_700_000_000_000,
    testReceiptId: "receipt-14",
    program,
    bindingManifest: structuredClone(runtime.llmRuntimeBindingManifest),
    ...overrides,
  };
}

function persistedFixture(overrides = {}) {
  const fileHashes = Object.fromEntries(
    runtime.LLM_LESSON_SOURCES.map((lesson) => [
      lesson.sourcePath,
      sha256(`source:${lesson.sourcePath}`),
    ]),
  );
  const bindings = Object.fromEntries(
    runtime.LLM_RUNTIME_CAPABILITIES.map((binding) => [
      binding.capability,
      { modulePath: binding.modulePath, exportName: binding.exportName },
    ]),
  );
  const bundles = Object.fromEntries(
    runtime.LLM_RUNTIME_CAPABILITIES.map((binding) => [
      binding.modulePath,
      `var ${binding.bindingId.replaceAll("-", "_")} = (() => ({}))();`,
    ]),
  );
  return {
    id: "persisted-build-4",
    promotionKey: "browser-chat:source:contracts",
    projectId: "browser-chat",
    projectRevision: 14,
    schemaVersion: 1,
    buildNumber: 4,
    sourceTreeHash: sha256("complete learner source tree"),
    contractVersion: "llm-systems-v1",
    fileHashes,
    bundles,
    runtimeConfig: {},
    bindings,
    testReceiptId: "receipt-14",
    checkpointId: null,
    provenance: "validated",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

test("the course binding manifest exposes real capstone capabilities with only core seams required", () => {
  assert.deepEqual(
    runtime.LLM_RUNTIME_CAPABILITIES.map((binding) => binding.capability),
    [
      "model.softmax",
      "transport.encode-sse",
      "transport.parse-sse",
      "serving.should-retry",
      "chat.select-context",
      "chat.generation-status",
    ],
  );
  assert.deepEqual(runtime.REQUIRED_LLM_RUNTIME_CAPABILITIES, [
    "transport.parse-sse",
    "serving.should-retry",
    "chat.select-context",
  ]);
  assert.equal(runtime.LLM_LESSON_SOURCES.length, 14);
});

test("an artifact becomes a source-free descriptor with complete and honest contribution coverage", async () => {
  const artifact = artifactFixture();
  const descriptor = await runtime.createCapstoneRuntimeDescriptor(artifact);
  assert.equal(descriptor.origin, "browser-lab-artifact");
  assert.equal(descriptor.executionPolicy.pageEvaluationAllowed, false);
  assert.equal(descriptor.executionPolicy.sourceIncluded, false);
  assert.equal(descriptor.contributions.length, 14);
  assert.equal(new Set(descriptor.contributions.map((entry) => entry.sourcePath)).size, 14);
  assert.deepEqual(
    descriptor.contributions.map((entry) => entry.sourcePath),
    runtime.LLM_LESSON_SOURCES.map((entry) => entry.sourcePath),
  );
  assert.ok(descriptor.contributions.every((entry) => entry.enteredActiveBuild));
  assert.equal(
    descriptor.contributions.filter((entry) => entry.mode === "executable-binding").length,
    5,
  );
  assert.equal(
    descriptor.contributions.filter((entry) => entry.mode === "provenance-only").length,
    9,
  );
  assert.ok(descriptor.bindings.every((binding) => binding.executionTarget === "isolated-browser-lab-worker"));
  assert.match(descriptor.fingerprints.lessonSources, /^sha256:[a-f0-9]{64}$/);
  assert.match(descriptor.fingerprints.executableModules, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(descriptor), /var __lesson_/);
  assert.equal("program" in descriptor, false);
  assert.equal("bundles" in descriptor, false);
});

test("missing required and tampered course bindings are rejected", async () => {
  const missing = artifactFixture();
  missing.bindingManifest.bindings = missing.bindingManifest.bindings.filter(
    (binding) => binding.capability !== "chat.select-context",
  );
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(missing),
    (error) => error.code === "MISSING_REQUIRED_CAPABILITY",
  );

  const tampered = artifactFixture();
  tampered.bindingManifest.bindings = tampered.bindingManifest.bindings.map((binding) =>
    binding.capability === "serving.should-retry"
      ? { ...binding, exportName: "alwaysRetry" }
      : binding,
  );
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(tampered),
    (error) => error.code === "RUNTIME_BINDING_TAMPERED",
  );
});

test("tampered compiled code and incomplete lesson coverage cannot enter the active runtime", async () => {
  const tamperedCode = artifactFixture();
  tamperedCode.program.modules[0].code += "\n// changed after promotion";
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(tamperedCode),
    (error) => error.code === "COMPILED_CODE_TAMPERED",
  );

  const incomplete = artifactFixture();
  incomplete.program.modules = incomplete.program.modules.slice(1);
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(incomplete),
    (error) => error.code === "INCOMPLETE_BUILD_CONTRIBUTIONS",
  );
});

test("validated persisted builds produce the same safe surface and reject binding drift", async () => {
  const persisted = persistedFixture();
  const descriptor = await runtime.createCapstoneRuntimeDescriptor(persisted);
  assert.equal(descriptor.origin, "persisted-build");
  assert.equal(descriptor.compilerVersion, null);
  assert.equal(descriptor.contributions.length, 14);
  assert.equal(descriptor.contributions[0].hashKind, "source-file");
  assert.equal(JSON.stringify(descriptor).includes(Object.values(persisted.bundles)[0]), false);

  const tampered = persistedFixture();
  tampered.bindings["chat.select-context"] = {
    modulePath: "product/chat-actions.js",
    exportName: "selectEverything",
  };
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(tampered),
    (error) => error.code === "RUNTIME_BINDING_TAMPERED",
  );
});

