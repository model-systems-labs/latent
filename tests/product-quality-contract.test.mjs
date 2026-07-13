import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

let quality;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  quality = await vite.ssrLoadModule("/app/lib/capstone-contract.ts");
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

test("the product audit exposes 16 passing check-specific contracts and a separate manual boundary", () => {
  const checks = quality.runCapstoneQualityAudit();
  assert.equal(checks.length, 16);
  assert.equal(new Set(checks.map((check) => check.label)).size, 16);
  assert.ok(checks.every((check) => check.passed));
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

test("the capstone template and host implement the same safe persistence and status seams", async () => {
  const [template, host] = await Promise.all([
    readFile(new URL("../app/content/browser-chat/project-template.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(template, /messages:\s*messages[\s\S]*filter\(\(message\) => message\.status !== "streaming"\)[\s\S]*map\(\(\{ id, role, backend, content, status, attemptId, parentUserId \}\)/);
  assert.match(template, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(template, /<span>\{generationStatusLabel\(phase\)\}<\/span>/);
  assert.doesNotMatch(template, /phase === "error" \? "Generation failed" : "Ready"/);
  assert.match(template, /composerRef\.current\?\.focus/);
  assert.match(host, /recordKeys\.length !== 3/);
  assert.match(host, /messageKeys\.every/);
  assert.match(host, /message\.content\.length > 20_000/);
});
