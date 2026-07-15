import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let runtime;
let persistencePure;
let template;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [runtime, persistencePure, template] = await Promise.all([
    vite.ssrLoadModule("/app/runtime/bindings/index.ts"),
    vite.ssrLoadModule("/app/platform/persistence/pure.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function runtimeConfigFixture(overrides = {}) {
  return {
    version: 1,
    model: { temperature: 0.72, topK: 24, maxTokens: 160, seed: 71 },
    transport: { wordsPerEvent: 1, delayMs: 24 },
    interface: { assistantName: "Build A", responsePrefix: "A: ", showMetrics: true },
    buildNumber: 999,
    builtAt: 999,
    ...overrides,
  };
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
  for (const path of new Set(runtime.LLM_RUNTIME_CAPABILITIES.map((binding) => binding.modulePath))) {
    if (modules.some((module) => module.modulePath === path)) continue;
    const code = "var __capstone = (() => ({ mount() {} }))();";
    modules.push({ modulePath: path, globalName: "__capstone", code, codeHash: sha256(code) });
  }
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
  const bundleHashes = Object.fromEntries(Object.entries(bundles).map(([path, code]) => [path, sha256(code)]));
  const sourceTreeHash = sha256("complete learner source tree");
  const contractVersion = "llm-systems-v1";
  return {
    id: "persisted-build-4",
    promotionKey: persistencePure.promotionKey("browser-chat", sourceTreeHash, contractVersion),
    projectId: "browser-chat",
    projectRevision: 14,
    schemaVersion: 1,
    buildNumber: 4,
    sourceTreeHash,
    contractVersion,
    fileHashes,
    bundles,
    bundleHashes,
    runtimeConfig: runtimeConfigFixture(),
    bindings,
    testReceiptId: "receipt-14",
    checkpointId: null,
    provenance: "validated",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function persistedEvidence(build) {
  const results = [{ contractId: "full-suite", path: "capstone/main.tsx", label: "Full suite", passed: true, detail: "Passed", durationMs: 1 }];
  const run = {
    id: "run-14",
    projectId: build.projectId,
    projectRevision: build.projectRevision,
    sourceTreeHash: build.sourceTreeHash,
    contractVersion: build.contractVersion,
    status: "passed",
    results,
    startedAt: build.createdAt - 1,
    completedAt: build.createdAt,
    runnerVersion: "runner-v1",
    error: null,
  };
  const receipt = {
    id: build.testReceiptId,
    runId: run.id,
    projectId: build.projectId,
    projectRevision: build.projectRevision,
    sourceTreeHash: build.sourceTreeHash,
    contractVersion: build.contractVersion,
    passed: true,
    passedCount: results.length,
    totalCount: results.length,
    runnerVersion: run.runnerVersion,
    moduleHashes: { ...build.bundleHashes },
    origin: "host",
    createdAt: build.createdAt,
  };
  return { receipt, run };
}

function certifiedPersistedFixture(overrides = {}) {
  const build = persistedFixture(overrides);
  const { receipt, run } = persistedEvidence(build);
  return persistencePure.certifyValidatedPersistedBuild(build, receipt, run);
}

test("the course binding manifest exposes real capstone capabilities with only core seams required", () => {
  assert.deepEqual(
    runtime.LLM_RUNTIME_CAPABILITIES.map((binding) => binding.capability),
    [
      "ui.mount",
      "transport.encode-sse",
      "transport.parse-sse",
      "serving.should-retry",
      "chat.select-context",
      "chat.generation-status",
    ],
  );
  assert.deepEqual(runtime.REQUIRED_LLM_RUNTIME_CAPABILITIES, [
    "ui.mount",
    "transport.parse-sse",
    "serving.should-retry",
    "chat.select-context",
  ]);
  assert.equal(runtime.LLM_LESSON_SOURCES.length, 14);
  assert.ok(runtime.LLM_LESSON_SOURCES.every((lesson) => lesson.sourcePath.endsWith(".py")));
  const adapterFiles = new Map(
    template.CANONICAL_BROWSER_CHAT_FILES
      .filter((file) => file.kind === "adapter")
      .map((file) => [file.path, file]),
  );
  for (const binding of runtime.LLM_RUNTIME_CAPABILITIES.filter((candidate) => candidate.capability !== "ui.mount")) {
    assert.equal(adapterFiles.get(binding.modulePath)?.editable, false, binding.capability);
    assert.match(binding.summary, /course-provided JavaScript adapter/i, binding.capability);
    assert.match(binding.summary, /same behavior tests/i, binding.capability);
    assert.ok(!runtime.LLM_LESSON_SOURCES.some((lesson) => lesson.sourcePath === binding.modulePath));
  }
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
    0,
  );
  assert.equal(
    descriptor.contributions.filter((entry) => entry.mode === "provenance-only").length,
    14,
  );
  assert.equal(descriptor.bindings.find((binding) => binding.capability === "ui.mount")?.executionTarget, "sandboxed-preview-frame");
  assert.ok(descriptor.bindings.filter((binding) => binding.capability !== "ui.mount").every((binding) => binding.executionTarget === "isolated-browser-lab-worker"));
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
  const persisted = certifiedPersistedFixture();
  const descriptor = await runtime.createCapstoneRuntimeDescriptor(persisted);
  assert.equal(descriptor.origin, "persisted-build");
  assert.equal(descriptor.compilerVersion, null);
  assert.equal(descriptor.contributions.length, 14);
  assert.equal(descriptor.contributions[0].hashKind, "source-file");
  assert.equal(JSON.stringify(descriptor).includes(Object.values(persisted.bundles)[0]), false);

  const tamperedBuild = persistedFixture();
  tamperedBuild.bindings["chat.select-context"] = {
    modulePath: "product/chat-actions.js",
    exportName: "selectEverything",
  };
  const { receipt, run } = persistedEvidence(tamperedBuild);
  const tampered = persistencePure.certifyValidatedPersistedBuild(tamperedBuild, receipt, run);
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(tampered),
    (error) => error.code === "RUNTIME_BINDING_TAMPERED",
  );
});

test("only the compiler-hashed capstone bundle can enter the preview frame", async () => {
  const persisted = certifiedPersistedFixture();
  const loaded = await runtime.loadValidatedCapstoneBundle(persisted);
  assert.equal(loaded.entryPath, "capstone/main.tsx");
  assert.equal(loaded.codeHash, persisted.bundleHashes[loaded.entryPath]);
  assert.equal(loaded.descriptor.bindings.find((binding) => binding.capability === "ui.mount")?.executionTarget, "sandboxed-preview-frame");

  const tamperedBuild = persistedFixture();
  tamperedBuild.bundles["capstone/main.tsx"] += "\n// changed";
  const { receipt, run } = persistedEvidence(tamperedBuild);
  const tampered = persistencePure.certifyValidatedPersistedBuild(tamperedBuild, receipt, run);
  await assert.rejects(
    runtime.loadValidatedCapstoneBundle(tampered),
    (error) => error.code === "COMPILED_CODE_TAMPERED",
  );
});

test("capstone runtime authority stays on immutable build A when an unbuilt draft changes to B", () => {
  const buildA = certifiedPersistedFixture({ runtimeConfig: runtimeConfigFixture() });
  const certifiedA = runtime.certifiedCapstoneRuntimeConfig(buildA);
  const unbuiltDraftB = runtimeConfigFixture({
    model: { temperature: 1.4, topK: 3, maxTokens: 40, seed: 999 },
    interface: { assistantName: "Draft B", responsePrefix: "B: ", showMetrics: false },
  });
  assert.equal(certifiedA.interface.assistantName, "Build A");
  assert.equal(certifiedA.interface.responsePrefix, "A: ");
  assert.equal(certifiedA.model.temperature, 0.72);
  assert.notEqual(certifiedA.interface.assistantName, unbuiltDraftB.interface.assistantName);
  assert.equal(certifiedA.buildNumber, buildA.buildNumber, "persisted config cannot forge the repository build number");
  assert.equal(certifiedA.builtAt, buildA.createdAt, "persisted config cannot forge the repository build timestamp");
  assert.equal(Object.isFrozen(certifiedA), true);
  assert.equal(Object.isFrozen(certifiedA.model), true);

  const invalid = certifiedPersistedFixture({
    runtimeConfig: runtimeConfigFixture({ model: { temperature: 0.72, topK: 24, maxTokens: 161, seed: 71 } }),
  });
  assert.throws(() => runtime.certifiedCapstoneRuntimeConfig(invalid), (error) => error.code === "INVALID_RUNTIME_CONFIG");
  assert.throws(() => runtime.certifiedCapstoneRuntimeConfig(persistedFixture()), (error) => error.code === "UNVALIDATED_RUNTIME_CONFIG");
});

test("a bare persisted record cannot become a trusted runtime descriptor", async () => {
  const imported = persistedFixture();
  await assert.rejects(
    runtime.createCapstoneRuntimeDescriptor(imported),
    (error) => error.code === "UNVALIDATED_ACTIVE_BUILD",
  );
  await assert.rejects(
    runtime.loadValidatedCapstoneBundle(imported),
    (error) => error.code === "UNVALIDATED_ACTIVE_BUILD",
  );
});
