import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "#vite-test-server";

const root = new URL("../", import.meta.url);
let vite;
let practiceOutput;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  ({ practiceOutput } = await vite.ssrLoadModule("/app/features/ide/browser-lab-service.ts"));
});

after(async () => {
  await vite?.close();
});

test("browser practice output preserves order, splits streams, and reports truncation", () => {
  const formatted = practiceOutput({
    logs: [
      { sequence: 0, level: "info", text: "alpha" },
      { sequence: 1, level: "error", text: "boom" },
      { sequence: 2, level: "debug", text: "omega" },
      { sequence: 3, level: "warn", text: "caution" },
    ],
    logsTruncated: true,
  });

  assert.deepEqual(formatted.output, [
    { stream: "stdout", text: "alpha\n" },
    { stream: "stderr", text: "boom\n" },
    { stream: "stdout", text: "omega\n" },
    { stream: "stderr", text: "caution\n[Output truncated by the browser lab.]\n" },
  ]);
  assert.equal(formatted.stdout, "alpha\nomega\n");
  assert.equal(formatted.stderr, "boom\ncaution\n[Output truncated by the browser lab.]\n");
});
