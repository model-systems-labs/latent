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
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("the canonical Browser Chat template owns a complete provided React surface", () => {
  const files = template.CANONICAL_BROWSER_CHAT_FILES;
  assert.equal(template.CAPSTONE_ENTRY_PATH, "capstone/main.tsx");
  assert.equal(template.CAPSTONE_COMPONENT_PATH, "capstone/BrowserChat.tsx");
  assert.equal(files.length, 6);
  assert.equal(new Set(files.map((file) => file.path)).size, files.length);
  assert.deepEqual(
    files.map((file) => file.path),
    [
      "vendor/react.ts",
      "vendor/react-dom-client.ts",
      "runtime/host-bridge.ts",
      "capstone/BrowserChat.tsx",
      "capstone/main.tsx",
      "capstone/styles.ts",
    ],
  );
  assert.ok(files.every((file) => file.source.trim().length > 0));
  assert.equal(files.find((file) => file.path === template.CAPSTONE_COMPONENT_PATH)?.editable, true);
  assert.equal(files.find((file) => file.path === template.CAPSTONE_ENTRY_PATH)?.kind, "entry");
  assert.equal(template.browserChatProjectFileByPath.size, files.length);
});

test("lesson source remains external while the capstone imports its behavioral seams", () => {
  const catalogPaths = template.CANONICAL_BROWSER_CHAT_FILES.map((file) => file.path);
  assert.ok(catalogPaths.every((path) => !/^(models|systems|backend|product)\//.test(path)));

  const source = template.BROWSER_CHAT_COMPONENT_SOURCE;
  for (const projectPath of [
    "../product/chat-reducer.js",
    "../product/chat-actions.js",
    "../backend/streaming-transport.js",
    "../backend/generation-reliability.js",
    "../product/chat-quality.js",
    "../product/streaming-react.js",
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
  for (const method of ["initialize", "train-student", "load-local", "generate", "cancel", "persist"]) {
    assert.match(template.HOST_BRIDGE_SOURCE, new RegExp(`"${method}"`));
  }
  assert.match(template.CAPSTONE_MAIN_SOURCE, /export function mount\(\)/);
  assert.match(template.CAPSTONE_MAIN_SOURCE, /const root = createRoot\(target\)/);
  assert.match(template.CAPSTONE_MAIN_SOURCE, /mount\(\);/);
  assert.match(source, /const currentUser = \{ id: parentUserId, role: "user", status: "complete", content: userText/);
  assert.match(source, /selectContext\(\{ system: systemContext, history: historicalContext, activeUser: currentUser, budget: 2048 \}\)/);
  assert.match(source, /if \(bounded\.overflow\)/);
  assert.match(source, /Required instructions and the current prompt exceed the 2048-token request budget/);
  assert.match(source, /const requestContext = bounded\.selected/);
  assert.match(source, /messages: requestContext\.map/);
  assert.match(source, /appendMessageDelta\(state\.messages, \{[\s\S]*attemptId: action\.attemptId,[\s\S]*requestId: action\.requestId/);
  assert.doesNotMatch(source, /localStorage/);
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
    contractVersion: "llm-systems-contracts-v16",
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
