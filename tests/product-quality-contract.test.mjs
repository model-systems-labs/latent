import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

let quality;
let conversationStore;
let capstone;
let localModel;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [quality, conversationStore, capstone, localModel] = await Promise.all([
    vite.ssrLoadModule("/app/lib/capstone-contract.ts"),
    vite.ssrLoadModule("/app/features/capstone/conversation-store.ts"),
    vite.ssrLoadModule("/app/components/BrowserChatCapstone.tsx"),
    vite.ssrLoadModule("/app/runtime/model/local-model-client.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("the canonical v1 validator accepts only bounded exact terminal records", () => {
  const safe = {
    version: 1,
    id: "active",
    messages: [{ id: "a1", role: "assistant", backend: "local", content: "done", status: "complete", attemptId: "try-1", parentUserId: "u1" }],
  };
  assert.equal(quality.validCapstoneRecord(safe), true);
  assert.equal(quality.validCapstoneRecord({ ...safe, apiKey: "never" }), false);
  assert.equal(quality.validCapstoneRecord({ ...safe, messages: [{ ...safe.messages[0], providerKey: "never" }] }), false);
  assert.equal(quality.validCapstoneRecord({ ...safe, messages: [{ ...safe.messages[0], status: "streaming" }] }), false);
  assert.equal(quality.validCapstoneRecord({ ...safe, messages: [{ ...safe.messages[0], id: "" }] }), false);
  assert.equal(quality.validCapstoneRecord({ ...safe, messages: [{ ...safe.messages[0], content: "x".repeat(20_001) }] }), false);
  assert.equal(quality.validCapstoneRecord({ ...safe, messages: Array.from({ length: 201 }, (_, index) => ({ ...safe.messages[0], id: `m${index}` })) }), false);
  assert.equal(quality.validCapstoneRecord({ ...safe, messages: Array.from({ length: 11 }, (_, index) => ({ ...safe.messages[0], id: `m${index}`, content: "x".repeat(20_000) })) }), false);
  assert.equal(quality.validCapstoneRecord([safe]), false);
});

test("serialization drops in-flight state and parse rejects injected nested fields", () => {
  const serialized = quality.serializeCapstoneRecord({
    version: 1,
    id: "active",
    messages: [
      { id: "u1", role: "user", backend: "student", content: "hello", status: "complete" },
      { id: "a1", role: "assistant", backend: "student", content: "partial", status: "streaming" },
    ],
  });
  assert.equal(serialized.includes("streaming"), false);
  assert.deepEqual(quality.parseCapstoneRecord(serialized)?.messages.map((message) => message.id), ["u1"]);
  assert.equal(quality.parseCapstoneRecord(JSON.stringify({
    version: 1,
    id: "active",
    messages: [{ id: "u1", role: "user", backend: "student", content: "hello", status: "complete", apiKey: "never" }],
  })), null);
});

test("the product audit separates executable checks, unexecuted specifications, and manual work", () => {
  const checks = quality.runCapstoneQualityAudit();
  assert.equal(checks.length, 16);
  assert.equal(new Set(checks.map((check) => check.label)).size, 16);
  const automated = checks.filter((check) => check.verification === "automated-pure");
  const specifications = checks.filter((check) => check.verification === "specification");
  assert.equal(automated.length, 11);
  assert.ok(automated.every((check) => check.passed === true));
  assert.equal(specifications.length, 5);
  assert.ok(specifications.every((check) => check.passed === null));
  assert.deepEqual(
    Object.fromEntries([...new Set(checks.map((check) => check.category))].map((category) => [category, checks.filter((check) => check.category === category).length])),
    {
      "Input and focus": 4,
      "Persistence and context": 4,
      "Lifecycle and recovery": 4,
      "Accessibility and responsive contract": 4,
    },
  );
  assert.equal(quality.MANUAL_PRODUCT_VERIFICATION.length, 3);
  assert.match(quality.MANUAL_PRODUCT_VERIFICATION.map((check) => check.detail).join(" "), /VoiceOver or NVDA/);
  assert.match(quality.MANUAL_PRODUCT_VERIFICATION.map((check) => check.detail).join(" "), /320 px and 390 px/);
});

test("latest-wins conversation writes cannot let an older rewrite erase the terminal answer", async () => {
  const writes = [];
  let releaseFirst;
  const firstBlocked = new Promise((resolve) => { releaseFirst = resolve; });
  const writer = conversationStore.createLatestConversationWriter(async (_backend, messages) => {
    if (!writes.length) await firstBlocked;
    writes.push(messages.map((message) => `${message.id}:${message.content}`).join("|"));
  });
  const userOnly = [{ id: "u1", role: "user", backend: "local", content: "hello", status: "complete" }];
  const partialReplacement = [...userOnly, { id: "a1", role: "assistant", backend: "local", content: "partial", status: "cancelled" }];
  const terminal = [...userOnly, { id: "a1", role: "assistant", backend: "local", content: "final answer", status: "complete" }];
  const first = writer.enqueue("local", userOnly);
  const second = writer.enqueue("local", partialReplacement);
  const third = writer.enqueue("local", terminal);
  releaseFirst();
  await Promise.all([first, second, third]);
  assert.deepEqual(writes, ["u1:hello", "u1:hello|a1:final answer"]);
  assert.match(writes.at(-1), /final answer/);
  assert.doesNotMatch(writes.at(-1), /partial/);
});

test("local model samples remain model-derived and fixed course references stay separately labeled", () => {
  const draft = "MODEL-DERIVED-7f31";
  const composed = capstone.composeLocalModelResponse("Why does a causal mask block future tokens?", draft);
  assert.equal(composed.modelDraft, draft);
  assert.ok(composed.reference);
  assert.match(composed.response, /Local Transformer sample · using your generation settings/);
  assert.match(composed.response, /MODEL-DERIVED-7f31/);
  assert.match(composed.response, /Course note · fixed explanation · generation settings don’t change this section · not counted in generated units/);
  assert.ok(composed.response.indexOf(draft) < composed.response.indexOf("Course note"));
  assert.equal(capstone.applyInterfaceResponsePrefix("configured: ", composed.response).startsWith("configured: Local Transformer sample"), true);
});

test("a dead or stalled local-model worker is discarded so an explicit retry starts fresh", async () => {
  class FakeWorker {
    onmessage = null;
    onerror = null;
    messages = [];
    terminated = false;
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    fail(message) { this.onerror?.({ message, preventDefault() {} }); }
    ready() { this.onmessage?.({ data: { type: "ready", detail: "fixture ready", device: "wasm" } }); }
  }
  const workers = [];
  const client = new localModel.LocalModelClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  }, 1000);
  const unavailable = [];
  client.setUnavailableHandler((error) => unavailable.push(error.message));
  const firstLoad = client.load({ onProgress() {} });
  workers[0].fail("fixture worker crashed");
  await assert.rejects(firstLoad, /fixture worker crashed/);
  assert.equal(workers[0].terminated, true);
  const retry = client.load({ onProgress() {} });
  assert.equal(workers.length, 2, "retry must create a fresh worker rather than reuse the rejected promise");
  workers[1].ready();
  assert.deepEqual(await retry, { detail: "fixture ready", device: "wasm" });
  let localDraft = "";
  const generation = client.generate("r1", [{ role: "user", content: "hello" }], { maxTokens: 160, temperature: 0.7, topK: 24 }, { onDelta(delta) { localDraft += delta; } });
  workers[1].onmessage?.({ data: { type: "delta", requestId: "r1", delta: "model " } });
  workers[1].onmessage?.({ data: { type: "delta", requestId: "r1", delta: "output" } });
  workers[1].onmessage?.({ data: { type: "done", requestId: "r1", generatedUnits: 2, unit: "stream-chunks" } });
  assert.equal(localDraft, "model output");
  assert.deepEqual(await generation, { generatedUnits: 2, unit: "stream-chunks" });
  assert.equal(client.isReady(), true);
  workers[1].fail("fixture worker crashed after ready");
  assert.equal(client.isReady(), false);
  await assert.rejects(
    client.generate("r2", [{ role: "user", content: "must reload" }], { maxTokens: 160, temperature: 0.7, topK: 24 }, { onDelta() {} }),
    /Load it before you start generating/,
  );
  assert.equal(workers.length, 2, "generation must not create or implicitly load a replacement worker");
  const explicitReload = client.load({ onProgress() {} });
  assert.equal(workers.length, 3, "the explicit load action may create the replacement worker");
  workers[2].ready();
  await explicitReload;
  assert.equal(client.isReady(), true);
  assert.match(unavailable.join(" "), /crashed after ready/);
  client.dispose();

  const stalledWorkers = [];
  const stalled = new localModel.LocalModelClient(() => {
    const worker = new FakeWorker();
    stalledWorkers.push(worker);
    return worker;
  }, 5);
  await assert.rejects(stalled.load({ onProgress() {} }), /within 5 ms/);
  assert.equal(stalledWorkers[0].terminated, true);
  const afterTimeout = stalled.load({ onProgress() {} });
  assert.equal(stalledWorkers.length, 2);
  stalledWorkers[1].ready();
  await afterTimeout;
  stalled.dispose();
});

test("the capstone template and host implement the same safe persistence and status seams", async () => {
  const [template, host, worker, protocol, workspace] = await Promise.all([
    readFile(new URL("../products/courses/reference-curriculum/content/browser-chat/project-template.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime/model/model.worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime/model/protocol.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/project-workspace.ts", import.meta.url), "utf8"),
  ]);
  assert.match(template, /messages:\s*messages[\s\S]*filter\(\(message\) => message\.status !== "streaming"\)[\s\S]*map\(\(\{ id, role, backend, content, status, attemptId, parentUserId \}\)/);
  assert.match(template, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(template, /<span>\{generationStatusLabel\(phase\)\}<\/span>/);
  assert.doesNotMatch(template, /phase === "error" \? "Generation failed" : "Ready"/);
  assert.match(template, /composerRef\.current\?\.focus/);
  assert.match(template, /terminalConversationIdentity/);
  assert.match(template, /latest finished copy is still here/);
  assert.match(template, /Retry save/);
  assert.doesNotMatch(template, /persistConversation\(record\)\.catch\(\(\) => undefined\)/);
  assert.match(template, /Maximum generated units/);
  assert.match(template, /max="160"/);
  assert.match(template, /seed in model\.config\.js only affects Student RNN sampling/);
  assert.match(template, /preview\?\.runtime\.interface\.showMetrics !== false/);
  assert.match(template, /preview\?\.runtime\.interface\.assistantName/);
  assert.match(template, /setBackend\(initialization\.selectedBackend\)/);
  assert.match(host, /recordKeys\.length !== 3/);
  assert.match(host, /messageKeys\.every/);
  assert.match(host, /message\.content\.length > 20_000/);
  assert.doesNotMatch(host, /queueMs:\s*12/);
  assert.doesNotMatch(host, /response\.match\(\/\\S\+\/g\)/);
  assert.match(host, /generatedUnitLabel = "Generated characters"/);
  assert.match(host, /generatedUnitLabel = generation\.unit === "stream-chunks" \? "Model stream chunks"/);
  assert.match(host, /selectedBackend: saved\.selectedBackend/);
  assert.match(host, /client\.setUnavailableHandler\(\(\) => \{ localReadyRef\.current = false; \}\)/);
  assert.match(host, /!client\.isReady\(\)/);
  assert.match(host, /const certifiedRuntime = certifiedCapstoneRuntimeConfig\(build\)/);
  assert.match(host, /runtime: buildRuntime as unknown as PreviewJson/);
  assert.match(host, /buildRuntime\.model\.seed/);
  assert.match(host, /buildRuntime\.interface\.responsePrefix/);
  assert.match(host, /buildRuntime\.transport/);
  assert.doesNotMatch(host, /project\.runtime/);
  assert.match(host, /applyInterfaceResponsePrefix\(buildRuntime\.interface\.responsePrefix, response\)/);
  assert.match(host, /LOCAL_MODEL_MAX_NEW_TOKENS, 40, LOCAL_MODEL_MAX_NEW_TOKENS/);
  assert.match(protocol, /LOCAL_MODEL_MAX_NEW_TOKENS = 160/);
  assert.match(workspace, /maxTokens: 160/);
  assert.match(workspace, /"maxTokens", 40, 160, true/);
  assert.doesNotMatch(workspace, /maxTokens: 180|"maxTokens", 40, 240/);
  assert.match(worker, /max_new_tokens: Math\.min\(message\.options\.maxTokens, LOCAL_MODEL_MAX_NEW_TOKENS\)/);
  assert.match(worker, /generatedUnits: emittedChunks, unit: "stream-chunks"/);
  assert.doesNotMatch(worker, /async function generate\([^\n]+\) \{\s*await ensureLoaded\(\)/);
  assert.match(worker, /Load the local model before you start generating/);
  assert.match(template, /initializePreview\(\)\.then\(setPreview\)/);
});
