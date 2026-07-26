import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "#vite-test-server";

let vite;
let preview;
let browserLab;
let capstone;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [preview, browserLab, capstone] = await Promise.all([
    vite.ssrLoadModule("/app/runtime/capstone/preview-frame.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/index.ts"),
    vite.ssrLoadModule("/app/components/BrowserChatCapstone.tsx"),
  ]);
});

after(async () => {
  await vite?.close();
});

async function validBundle(overrides = {}) {
  const code = overrides.code ?? "globalThis.__previewExecuted = true;";
  return {
    projectId: "browser-chat",
    buildId: "build-7",
    buildNumber: 7,
    projectRevision: 42,
    sourceHash: await browserLab.hashText("source tree"),
    entryPath: "capstone/BrowserChat.tsx",
    code,
    codeHash: await browserLab.hashText(code),
    ...overrides,
  };
}

async function validRuntime() {
  return preview.verifyPreviewRuntime("globalThis.__LATENT_REACT__ = Object.freeze({ React: {}, createRoot() {} });");
}

test("srcdoc is an opaque-frame bootstrap with no learner bundle interpolation", () => {
  const marker = "LEARNER_BUNDLE_MUST_NOT_ENTER_SRCDOC";
  const html = preview.createPreviewFrameSrcdoc();
  const actualHash = `sha256-${createHash("sha256").update(preview.PREVIEW_BOOTSTRAP_SOURCE).digest("base64")}`;
  assert.equal(preview.PREVIEW_FRAME_SANDBOX, "allow-scripts");
  assert.equal(preview.PREVIEW_BOOTSTRAP_SHA256, actualHash);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /worker-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, new RegExp(`script-src '${preview.PREVIEW_BOOTSTRAP_SHA256.replaceAll("+", "\\+")}' blob:`));
  assert.doesNotMatch(html, /nonce-|nonce=|script-src[^;]*(?:https?:|'self'|data:)/);
  assert.doesNotMatch(html, /src="\/capstone-react-runtime\.js"/);
  assert.match(html, /createObjectURL\(new Blob/);
  assert.match(html, /URL\.revokeObjectURL/);
  assert.match(html, /event\.ports\.length !== 1/);
  assert.match(html, /event\.source !== parent/);
  assert.match(html, /item\.onEvent\(data\.payload, data\.event\)/);
  assert.doesNotMatch(html, /allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
  assert.doesNotMatch(html, new RegExp(marker));
});

test("only a source-bound bundle matching its compiler hash becomes validated", async () => {
  const input = await validBundle();
  const verified = await preview.verifyPreviewBundle(input);
  assert.equal(preview.isValidatedPreviewBundle(verified), true);
  assert.equal(Object.isFrozen(verified), true);

  await assert.rejects(
    preview.verifyPreviewBundle({ ...input, code: `${input.code}\n// tampered` }),
    (error) => error.code === "BUNDLE_HASH_MISMATCH",
  );
  await assert.rejects(
    preview.verifyPreviewBundle({ ...input, entryPath: "../host.tsx" }),
    (error) => error.code === "INVALID_BUNDLE",
  );
  await assert.rejects(
    preview.verifyPreviewBundle({ ...input, code: "x".repeat(65), codeHash: await browserLab.hashText("x".repeat(65)) }, { maxBundleBytes: 64 }),
    (error) => error.code === "BUNDLE_TOO_LARGE",
  );
});

test("generic frame and host guards enforce bounded JSON and method identities", async () => {
  const allowed = new Set(["initialize", "train-student", "model.generate"]);
  const request = {
    schemaVersion: 1,
    type: "latent-preview/request",
    requestId: "request:1",
    method: "model.generate",
    payload: { prompt: "hello" },
  };
  assert.equal(preview.isPreviewFrameMessage(request, {}, allowed), true);
  assert.equal(preview.isPreviewFrameMessage({ ...request, method: "initialize" }, {}, allowed), true);
  assert.equal(preview.isPreviewFrameMessage({ ...request, method: "train-student" }, {}, allowed), true);
  assert.equal(preview.isPreviewFrameMessage({ ...request, method: "storage.exfiltrate" }, {}, allowed), false);
  assert.equal(preview.isPreviewFrameMessage({ ...request, requestId: "bad id" }, {}, allowed), false);
  assert.equal(preview.isPreviewFrameMessage({ ...request, payload: { prompt: "x".repeat(200) } }, { maxMessageBytes: 128 }, allowed), false);
  const circular = {};
  circular.self = circular;
  assert.equal(preview.isBoundedPreviewJson(circular), false);
  assert.equal(preview.isBoundedPreviewJson({ value: Number.POSITIVE_INFINITY }), false);

  const input = await validBundle();
  const runtime = await validRuntime();
  assert.equal(preview.isPreviewHostMessage({ schemaVersion: 1, type: "latent-preview/load", channelId: "preview:1234567890", runtime, bundle: input }), true);
  assert.equal(preview.isPreviewHostMessage({ schemaVersion: 1, type: "latent-preview/load", channelId: "preview:1234567890", bundle: input }), false);
  assert.equal(preview.isPreviewHostMessage({ schemaVersion: 1, type: "latent-preview/event", requestId: "request:1", event: "token.delta", payload: { text: "hi" } }), true);
  assert.equal(preview.isPreviewHostMessage({ schemaVersion: 1, type: "latent-preview/event", requestId: "request:1", event: "bad event", payload: null }), false);
});

test("the request gate rejects duplicates, unauthorized methods, and excess concurrency", () => {
  const gate = new preview.PreviewRequestGate({
    allowedMethods: new Set(["model.generate"]),
    limits: { maxActiveRequests: 1 },
  });
  const first = { schemaVersion: 1, type: "latent-preview/request", requestId: "r:1", method: "model.generate", payload: null };
  const second = { ...first, requestId: "r:2" };
  assert.equal(gate.accept(first), true);
  assert.equal(gate.size, 1);
  assert.equal(gate.accept(first), false, "a duplicate request id must be rejected");
  assert.equal(gate.accept(second), false, "the concurrent request cap must be enforced");
  assert.equal(gate.settle(first.requestId), true);
  assert.equal(gate.accept(second), true);
  assert.equal(gate.accept({ ...second, requestId: "r:3", method: "network.fetch" }), false);
  gate.clear();
  assert.equal(gate.size, 0);
});

test("model capabilities are single-flight and reject duplicate generation ids", () => {
  const gate = new capstone.CapstoneCapabilityGate();

  assert.equal(gate.beginPreparation("train"), "accepted");
  assert.equal(gate.beginPreparation("load"), "model-preparation-busy");
  assert.equal(gate.beginGeneration("generation:1"), "model-preparation-busy");
  gate.finishPreparation("train");

  assert.equal(gate.beginGeneration("generation:1"), "accepted");
  assert.equal(gate.beginGeneration("generation:1"), "duplicate-generation");
  assert.equal(gate.beginGeneration("generation:2"), "generation-busy");
  assert.equal(gate.beginPreparation("load"), "generation-busy");
  gate.finishGeneration("generation:1");

  assert.equal(gate.beginPreparation("load"), "accepted");
  gate.finishPreparation("load");
  assert.equal(gate.beginGeneration("generation:2"), "accepted");
  gate.reset();
  assert.equal(gate.beginPreparation("train"), "accepted");
});

test("resetting the preview during local-model prefill cancels the worker request", async () => {
  const controller = new AbortController();
  const requests = new Map([
    ["local-prefill:1", {
      controller,
      reader: null,
      decoder: null,
      frameRemainder: "",
    }],
  ]);
  const cancelled = [];

  await capstone.cancelActiveGenerationResources(requests, (requestId) => cancelled.push(requestId));

  assert.equal(controller.signal.aborted, true);
  assert.deepEqual(cancelled, ["local-prefill:1"]);
  assert.equal(requests.size, 0);
});

test("session construction rejects an unverified bundle before touching an iframe", async () => {
  const input = await validBundle();
  assert.throws(
    () => new preview.PreviewFrameSession({ iframe: {}, bundle: input, runtime: {} }),
    (error) => error.code === "UNVALIDATED_BUNDLE",
  );
  const bundle = await preview.verifyPreviewBundle(input);
  assert.throws(
    () => new preview.PreviewFrameSession({ iframe: {}, bundle, runtime: {} }),
    (error) => error.code === "UNVALIDATED_RUNTIME",
  );
});
