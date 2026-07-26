import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let template;
let workspace;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [template, workspace] = await Promise.all([
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("the canonical Browser Chat template owns a complete provided React surface", () => {
  const files = template.CANONICAL_BROWSER_CHAT_FILES;
  const adapterPaths = Object.values(template.BROWSER_CHAT_ADAPTER_PATHS);
  assert.equal(template.CAPSTONE_ENTRY_PATH, "capstone/main.tsx");
  assert.equal(template.CAPSTONE_COMPONENT_PATH, "capstone/BrowserChat.tsx");
  assert.equal(files.length, 13);
  assert.equal(new Set(files.map((file) => file.path)).size, files.length);
  assert.deepEqual(
    files.map((file) => file.path),
    [
      "vendor/react.ts",
      "vendor/react-dom-client.ts",
      "runtime/host-bridge.ts",
      ...adapterPaths,
      "capstone/BrowserChat.tsx",
      "capstone/main.tsx",
      "capstone/styles.ts",
    ],
  );
  assert.ok(files.every((file) => file.source.trim().length > 0));
  assert.equal(files.find((file) => file.path === template.CAPSTONE_COMPONENT_PATH)?.editable, true);
  assert.equal(files.find((file) => file.path === template.CAPSTONE_ENTRY_PATH)?.kind, "entry");
  const adapters = files.filter((file) => file.kind === "adapter");
  assert.equal(adapters.length, adapterPaths.length);
  assert.deepEqual(adapters.map((file) => file.path), adapterPaths);
  assert.ok(adapters.every((file) => !file.editable));
  assert.ok(adapters.every((file) => file.title.startsWith("Provided ")));
  assert.ok(adapters.every((file) => file.source.startsWith("// The course provides this read-only JavaScript adapter.")));
  assert.equal(template.browserChatProjectFileByPath.size, files.length);
});

test("CPython lesson source remains external while provided adapters bridge its behavioral seams", () => {
  const adapterPaths = new Set(Object.values(template.BROWSER_CHAT_ADAPTER_PATHS));
  const adapters = template.CANONICAL_BROWSER_CHAT_FILES.filter((file) => file.kind === "adapter");
  assert.ok(template.CANONICAL_BROWSER_CHAT_FILES.every((file) => !file.path.endsWith(".py")));
  assert.ok(adapters.every((file) => adapterPaths.has(file.path)));

  const source = template.BROWSER_CHAT_COMPONENT_SOURCE;
  for (const projectPath of [
    "../runtime/adapters/chat-reducer.js",
    "../runtime/adapters/chat-actions.js",
    "../runtime/adapters/streaming-transport.js",
    "../runtime/adapters/generation-reliability.js",
    "../runtime/adapters/chat-quality.js",
    "../runtime/adapters/streaming-react.js",
  ]) {
    assert.match(source, new RegExp(projectPath.replaceAll(".", "\\.")));
  }
  for (const exportedFunction of [
    "createMessage",
    "appendMessageDelta",
    "selectContext",
    "createRegeneration",
    "encodeSse",
    "parseSseChunk",
    "shouldRetry",
    "acceptEvent",
    "validConversationRecord",
    "generationStatusLabel",
    "flushTokenBuffer",
    "shouldFollowStream",
  ]) {
    assert.match(source, new RegExp(`\\b${exportedFunction}\\b`));
  }
  assert.match(template.REACT_ADAPTER_SOURCE, /globalThis[\s\S]*__LATENT_REACT__/);
  assert.match(template.REACT_DOM_ADAPTER_SOURCE, /globalThis[\s\S]*__LATENT_REACT__/);
  assert.match(template.HOST_BRIDGE_SOURCE, /globalThis[\s\S]*__LATENT_PREVIEW_HOST__/);
  for (const method of ["initialize", "load-local", "generate", "cancel", "persist"]) {
    assert.match(template.HOST_BRIDGE_SOURCE, new RegExp(`"${method}"`));
  }
  assert.doesNotMatch(template.HOST_BRIDGE_SOURCE, /train-student|trainStudent/);
  assert.doesNotMatch(source, /trainStudent/);
  assert.match(template.CAPSTONE_MAIN_SOURCE, /export function mount\(\)/);
  assert.match(template.CAPSTONE_MAIN_SOURCE, /const root = createRoot\(target\)/);
  assert.match(template.CAPSTONE_MAIN_SOURCE, /mount\(\);/);
  assert.match(source, /const currentUser = \{ id: parentUserId, role: "user", status: "complete", content: userText/);
  assert.match(source, /selectContext\(\{ system: systemContext, history: historicalContext, activeUser: currentUser, budget: 2048 \}\)/);
  assert.match(source, /if \(bounded\.overflow\)/);
  assert.match(source, /The required instructions and your prompt don't fit within the 2048-token limit/);
  assert.match(source, /const requestContext = bounded\.selected/);
  assert.match(source, /messages: requestContext\.map/);
  assert.match(source, /appendMessageDelta\(state\.messages, \{[\s\S]*attemptId: action\.attemptId,[\s\S]*requestId: action\.requestId/);
  assert.match(source, /runGeneration = \(userText: string, parentUserId: string, logicalRequestId: string, attempt: number\)/);
  assert.match(source, /const attemptId = logicalRequestId \+ "\.attempt-" \+ attempt/);
  assert.match(source, /const requestId = logicalRequestId \+ "\.transport-" \+ attempt/);
  assert.match(source, /activeRequest\.current = \{ logicalRequestId, attemptId, requestId, assistantId, status: "queued" \}/);
  assert.match(source, /acceptEvent\(current, \{ attemptId, requestId \}\)/);
  assert.match(source, /runGeneration\(userText, parentUserId, logicalRequestId, attempt \+ 1\)/);
  assert.match(source, /runGeneration\(userText, userId, "logical-" \+ userId, 0\)/);
  assert.match(source, /startGeneration\(\{[\s\S]*logicalRequestId,[\s\S]*attemptId,[\s\S]*requestId,/);
  assert.doesNotMatch(source, /localStorage/);
});

test("the editable capstone exposes branch-aware, frame-batched, bounded streaming behavior", () => {
  const source = template.BROWSER_CHAT_COMPONENT_SOURCE;
  assert.match(source, /activeAttemptByParentUserId: Record<string, string>/);
  assert.match(source, /\[action\.message\.parentUserId\]: action\.message\.id/);
  assert.match(source, /state\.activeAttemptByParentUserId\[message\.parentUserId\] === message\.id/);
  assert.match(source, /data-active-attempt=/);
  assert.match(source, /window\.requestAnimationFrame/);
  assert.match(source, /window\.cancelAnimationFrame/);
  assert.match(source, /flushPendingRender\(\);[\s\S]*handle\.cancel\(\)/);
  assert.match(source, /ANNOUNCEMENT_INTERVAL_MS = 500/);
  assert.match(source, /ANNOUNCEMENT_MAX_CHARACTERS = 160/);
  assert.match(source, /role="log"[\s\S]*aria-live="off"/);
  assert.match(source, /data-stream-announcement=/);
  assert.match(source, /className="sr-only"[\s\S]*role="status"[\s\S]*aria-live="polite"/);
});

test("the capstone keeps the conversation primary on narrow screens", () => {
  const source = template.BROWSER_CHAT_COMPONENT_SOURCE;
  const styles = template.CAPSTONE_STYLES_SOURCE;
  assert.match(source, /const \[controlsOpen, setControlsOpen\] = useState\(false\)/);
  assert.match(source, /className="metrics-panel"[\s\S]*?<details>[\s\S]*?<summary><span className="section-label">Last request/);
  assert.match(source, /const \[mobileControlsOpen, setMobileControlsOpen\] = useState\(false\)/);
  assert.match(source, /className=\{"control-panel" \+ \(mobileControlsOpen \? " mobile-open" : ""\)\}/);
  assert.match(source, /className="mobile-control-toggle"[\s\S]*aria-expanded=\{mobileControlsOpen\}/);
  assert.match(styles, /\.control-panel:not\(\.mobile-open\) > section, \.control-panel:not\(\.mobile-open\) > footer \{ display: none; \}/);
  assert.match(styles, /\.app-header \{ align-items: start; display: grid;/);
  assert.doesNotMatch(styles, /body \{[^}]*min-width: 320px/);
});

test("an invalid restored conversation suspends writes until explicit discard", () => {
  const source = template.BROWSER_CHAT_COMPONENT_SOURCE;
  assert.match(source, /savedConversationIsValid = !hasSavedConversation \|\| validConversationRecord/);
  assert.match(source, /setRestoreBlocked\(true\)/);
  assert.match(source, /if \(!hydrated \|\| restoreBlocked\) return/);
  assert.match(source, /const discardUnreadableConversation = \(\) => \{[\s\S]*setRestoreBlocked\(false\)/);
  assert.match(source, /We left the unreadable copy on this device unchanged/);
  assert.match(source, />Discard saved conversation<\/button>/);
});

async function importAdapter(source, name) {
  const url = `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=${name}`).toString("base64")}`;
  return import(url);
}

test("provided adapters preserve the capstone's JavaScript behavior", async () => {
  const [model, transport, reliability, reducer, actions, quality, streaming] = await Promise.all([
    importAdapter(template.MODEL_SOFTMAX_ADAPTER_SOURCE, "model-softmax.js"),
    importAdapter(template.STREAMING_TRANSPORT_ADAPTER_SOURCE, "streaming-transport.js"),
    importAdapter(template.GENERATION_RELIABILITY_ADAPTER_SOURCE, "generation-reliability.js"),
    importAdapter(template.CHAT_REDUCER_ADAPTER_SOURCE, "chat-reducer.js"),
    importAdapter(template.CHAT_ACTIONS_ADAPTER_SOURCE, "chat-actions.js"),
    importAdapter(template.CHAT_QUALITY_ADAPTER_SOURCE, "chat-quality.js"),
    importAdapter(template.STREAMING_REACT_ADAPTER_SOURCE, "streaming-react.js"),
  ]);

  const probabilities = model.stableSoftmax([1001, 1000, 999]);
  assert.ok(probabilities.every(Number.isFinite));
  assert.ok(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);

  const frame = transport.encodeSse("token", { delta: "hi" });
  const first = transport.parseSseChunk("", frame.slice(0, -2));
  const second = transport.parseSseChunk(first.remainder, frame.slice(-2));
  assert.deepEqual(second, { events: [{ event: "token", data: { delta: "hi" } }], remainder: "" });

  assert.equal(reliability.shouldRetry({ transient: true, tokensEmitted: 0, attempt: 0 }), true);
  assert.equal(reliability.shouldRetry({ transient: true, tokensEmitted: 1, attempt: 0 }), false);
  assert.equal(reliability.acceptEvent(
    { attemptId: "a1", requestId: "r1", status: "streaming" },
    { attemptId: "a1", requestId: "r1" },
  ), true);
  assert.equal(reliability.acceptEvent(
    { attemptId: "a1", requestId: "r1", status: "complete" },
    { attemptId: "a1", requestId: "r1" },
  ), false);
  assert.equal(reliability.acceptEvent(
    { attemptId: "a2", requestId: "r2", status: "streaming" },
    { attemptId: "a1", requestId: "r2" },
  ), false);

  const message = reducer.createMessage({ id: "a1", role: "assistant", status: "streaming", attemptId: "try1", requestId: "r1" });
  const messages = reducer.appendMessageDelta([message], { messageId: "a1", attemptId: "try1", requestId: "r1", delta: "Hello" });
  assert.equal(messages[0].content, "Hello");
  assert.notEqual(messages[0], message);

  const context = actions.selectContext({
    system: [{ id: "s", role: "system", tokens: 4 }],
    history: [
      { id: "u", role: "user", status: "complete", tokens: 3 },
      { id: "a", role: "assistant", status: "complete", tokens: 3 },
    ],
    activeUser: { id: "next", role: "user", status: "complete", tokens: 2 },
    budget: 12,
  });
  assert.deepEqual(context.selected.map((entry) => entry.id), ["s", "u", "a", "next"]);
  assert.equal(actions.createRegeneration({ messageId: "m", parentUserId: "u", attemptId: "a", requestId: "r" }).status, "queued");

  const record = { version: 1, id: "c", messages: [{ id: "u", role: "user", backend: "local", content: "Hi", status: "complete" }] };
  assert.equal(quality.validConversationRecord(record), true);
  assert.equal(quality.validConversationRecord({ ...record, apiKey: "secret" }), false);
  assert.equal(quality.generationStatusLabel("prefill"), "Processing context");

  assert.deepEqual(streaming.flushTokenBuffer(["Hel", "lo"]), { text: "Hello", remaining: [] });
  assert.equal(streaming.shouldFollowStream({ distanceFromBottom: 24, userScrolledUp: false }), true);
  assert.equal(streaming.shouldFollowStream({ distanceFromBottom: 24, userScrolledUp: true }), false);
});

test("editing any project source invalidates source-bound capstone verification", () => {
  const state = workspace.emptyProjectState();
  state.tests = {
    results: {
      "capstone/main.tsx": [{ id: "compile", path: "capstone/main.tsx", label: "Capstone", passed: true, detail: "Passed" }],
      "capstone/BrowserChat.tsx": [{ id: "compile-ui", path: "capstone/BrowserChat.tsx", label: "Capstone", passed: true, detail: "Passed" }],
    },
    ranAt: 100,
    runner: "browser-lab-v1",
    sourceTreeHash: "sha256:tested-tree",
    projectRevision: 7,
    contractVersion: "llm-systems-contracts-v17",
    contractIdsByPath: {
      "capstone/main.tsx": ["compile"],
      "capstone/BrowserChat.tsx": ["compile-ui"],
    },
  };
  const next = workspace.projectStateAfterFileEdit(
    state,
    "capstone/BrowserChat.tsx",
    `${state.files["capstone/BrowserChat.tsx"].content}\n// learner edit`,
    200,
  );
  assert.deepEqual(next.tests, {
    results: {},
    ranAt: 0,
    runner: "none",
    sourceTreeHash: null,
    projectRevision: null,
    contractVersion: null,
    contractIdsByPath: {},
  });
  assert.equal(next.files["capstone/BrowserChat.tsx"].updatedAt, 200);
});
