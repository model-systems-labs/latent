import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "vite";

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

let canonical;
let client;
let persistence;
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
  [canonical, client, persistence, template, workspace] = await Promise.all([
    vite.ssrLoadModule("/app/lib/canonical-project.ts"),
    vite.ssrLoadModule("/app/platform/persistence/client.ts"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/app/lib/project-workspace.ts"),
  ]);
});

after(async () => {
  await client?.closePersistenceContext();
  if (persistence) {
    const database = new persistence.BrowserLabDatabase();
    await database.delete();
  }
  await vite?.close();
});

test("route-independent reconciliation persists the complete canonical tree and preserves edits", async () => {
  await canonical.reconcileCanonicalProject();
  const { repositories } = await client.getPersistenceContext();
  const freshFiles = await repositories.projects.listFiles("browser-chat");
  const expectedSeedPaths = canonical.completeCanonicalProjectSeeds().map((seed) => seed.path);
  const expectedPaths = new Set([
    ...Object.values(workspace.RUNTIME_PATHS),
    ...expectedSeedPaths,
  ]);

  assert.equal(freshFiles.length, expectedPaths.size);
  assert.deepEqual(new Set(freshFiles.map((file) => file.path)), expectedPaths);
  assert.equal(canonical.canonicalLessonSeeds().length, 14);
  assert.equal(template.CANONICAL_BROWSER_CHAT_FILES.length, 6);

  const editedSource = "// Learner-owned Browser Chat edit\nexport function BrowserChat() { return null; }";
  workspace.saveProjectFile(template.CAPSTONE_COMPONENT_PATH, editedSource);
  await workspace.flushProjectPersistence();
  await canonical.reconcileCanonicalProject();

  const reconciled = await repositories.projects.listFiles("browser-chat");
  const browserChat = reconciled.find((file) => file.path === template.CAPSTONE_COMPONENT_PATH);
  assert.equal(browserChat?.content, editedSource);
  assert.equal(browserChat?.referenceContent, template.BROWSER_CHAT_COMPONENT_SOURCE);
  assert.equal(reconciled.length, expectedPaths.size);
});
