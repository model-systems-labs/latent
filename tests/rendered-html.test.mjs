import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the six-lesson curriculum", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Language model fundamentals/);
  for (const title of [
    "Character RNNs",
    "Neural Language Models",
    "Subword Tokenization",
    "Additive Attention",
    "Transformers",
    "In-Context Learning",
  ]) assert.match(html, new RegExp(title));
  assert.equal((html.match(/class="lesson-card"/g) ?? []).length, 6);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("every lesson uses the complete reusable learning flow", async () => {
  const lessons = [
    ["character-rnns", "Character RNNs", "Train RNN"],
    ["neural-language-models", "Neural Language Models", "Train language model"],
    ["subword-tokenization", "Subword Tokenization", "Train tokenizer"],
    ["additive-attention", "Additive Attention", "Train attention"],
    ["transformers", "Transformers", "Run attention"],
    ["in-context-learning", "In-Context Learning", "Load model"],
  ];
  for (const [slug, title, action] of lessons) {
    const response = await render(`/papers/${slug}`);
    assert.equal(response.status, 200, slug);
    const html = await response.text();
    assert.match(html, new RegExp(title));
    assert.match(html, /Original source/);
    assert.match(html, /Paper claim/);
    assert.match(html, /Browser reproduction/);
    assert.match(html, /OpenRouter API key/);
    assert.match(html, /Practice all/);
    assert.match(html, /Run cell/);
    assert.match(html, /Run behavioral checks/);
    assert.match(html, new RegExp(action));
  }
});

test("the design kit and numerical engines are reusable", async () => {
  const [page, paperLab, experiment, lessons, engines, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PaperLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LessonExperiment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lessons/course.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/lab-engines.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  for (const component of ["HeaderSection", "ParagraphSection", "DiagramSection", "TextBoxSection", "CodingSection"]) {
    assert.match(paperLab, new RegExp(`export function ${component}`));
  }
  assert.match(page, /courseLessons\.map/);
  assert.match(experiment, /@huggingface\/transformers/);
  assert.match(experiment, /SmolLM2-135M-Instruct/);
  assert.match(lessons, /courseLessons: CourseLesson\[\]/);
  assert.match(engines, /trainCharacterRnn/);
  assert.match(engines, /trainNeuralLanguageModel/);
  assert.match(engines, /trainAdditiveAttention/);
  assert.match(engines, /runCausalAttention/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("all visible reference cells pass their behavioral contracts", async () => {
  const lessons = await readFile(new URL("../app/lessons/course.ts", import.meta.url), "utf8");
  const pairs = [...lessons.matchAll(/code: `([\s\S]*?)`,\n\s*checkCode: `([\s\S]*?)`,/g)];
  assert.equal(pairs.length, 18);
  for (const [index, pair] of pairs.entries()) {
    const result = new Function(`"use strict";\n${pair[1]}\n${pair[2]}`)();
    assert.equal(result.passed, true, `reference cell ${index + 1}: ${result.detail}`);
  }
});
