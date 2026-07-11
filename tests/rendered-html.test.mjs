import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete paper lab", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Neural Text Degeneration/);
  assert.match(html, /Original paper/);
  assert.match(html, /OpenRouter API key/);
  assert.match(html, /Hide all blocks/);
  assert.match(html, /Run cell/);
  assert.match(html, /safeTemperature/);
  assert.match(html, /Run behavioral checks/);
  assert.match(html, /Compare full sampling with your nucleus policy/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("removes all starter-preview artifacts", async () => {
  const [page, paperLab, lesson, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PaperLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lessons/neural-text-degeneration.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<PaperLab lesson=\{neuralTextDegenerationLesson\}/);
  assert.match(paperLab, /@huggingface\/transformers/);
  assert.match(paperLab, /openrouter\/auto/);
  assert.match(paperLab, /TextStreamer/);
  assert.match(lesson, /function nucleus/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("the visible reference solution passes its behavioral contract", async () => {
  const lesson = await readFile(new URL("../app/lessons/neural-text-degeneration.ts", import.meta.url), "utf8");
  const blocks = [...lesson.matchAll(/code: `([\s\S]*?)`,\n\s*}/g)]
    .slice(0, 4)
    .map((match) => new Function(`return \`${match[1]}\`;`)());

  assert.equal(blocks.length, 4);
  const implementation = new Function(
    `"use strict";\n${blocks.join("\n\n")}\nreturn { softmax, nucleus, policy, enforceOutputContract };`,
  )();
  const probabilities = implementation.softmax([2.2, 1.1, 0.3]);
  const sum = probabilities.reduce((total, probability) => total + probability, 0);
  const nucleus = implementation.nucleus(["A", "B", "C", "D"], [0.55, 0.3, 0.1, 0.05], 0.82);
  const contracted = implementation.enforceOutputContract(
    "Certainly, this is a deliberately long answer with several words that should be restricted.",
    { maxWords: 8, banned: ["certainly"] },
  );

  assert.ok(Math.abs(sum - 1) < 1e-6);
  assert.deepEqual(nucleus.map((candidate) => candidate.token), ["A", "B"]);
  assert.doesNotMatch(contracted, /certainly/i);
  assert.ok(contracted.split(/\s+/).filter(Boolean).length <= 8);
  assert.equal(implementation.policy.top_p, 0.9);
});
