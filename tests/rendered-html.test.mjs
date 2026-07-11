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

test("server-renders the complete three-course curriculum", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build an LLM chat system/);
  assert.match(html, /Language Models/);
  assert.match(html, /LLM Systems/);
  assert.match(html, /Chat Product/);
  assert.match(html, /Browser Chat/);
  assert.equal((html.match(/class="course-track-card"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("each course renders its technical lesson sequence", async () => {
  const courses = [
    ["models", ["Character RNNs", "Neural Language Models", "Subword Tokenization", "Additive Attention", "Transformers", "In-Context Learning"]],
    ["systems", ["Inference Runtime", "Streaming Transport", "Scheduling and Memory", "Reliability and Observability"]],
    ["product", ["Conversation State", "Streaming React", "Actions and Context", "Product Quality"]],
  ];
  for (const [slug, titles] of courses) {
    const response = await render(`/courses/${slug}`);
    assert.equal(response.status, 200, slug);
    const html = await response.text();
    for (const title of titles) assert.match(html, new RegExp(title));
  }
});

test("all fourteen lessons use the reusable learning flow", async () => {
  const lessons = [
    ["character-rnns", "Character RNNs"],
    ["neural-language-models", "Neural Language Models"],
    ["subword-tokenization", "Subword Tokenization"],
    ["additive-attention", "Additive Attention"],
    ["transformers", "Transformers"],
    ["in-context-learning", "In-Context Learning"],
    ["inference-runtime", "Inference Runtime"],
    ["streaming-transport", "Streaming Transport"],
    ["scheduling-memory", "Scheduling and Memory"],
    ["reliability-observability", "Reliability and Observability"],
    ["conversation-state", "Conversation State"],
    ["streaming-react", "Streaming React"],
    ["chat-actions-context", "Actions and Context"],
    ["chat-product-quality", "Product Quality"],
  ];
  for (const [slug, title] of lessons) {
    const response = await render(`/lessons/${slug}`);
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
  }
});

test("the capstone contains the complete React chat system", async () => {
  const response = await render("/capstone");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Browser Chat/);
  assert.match(html, /Student model/);
  assert.match(html, /Local chat model/);
  assert.match(html, /SSE-compatible ReadableStream/);
  assert.match(html, /Request lifecycle/);
  assert.match(html, /Train model/);
  assert.match(html, /Enter to send/);
  assert.match(html, /Clear conversation/);
});

test("the design kit, simulations, and model engines remain reusable", async () => {
  const [paperLab, experiment, capstone, engines, extended, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/components/PaperLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LessonExperiment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/lab-engines.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lessons/extended-course.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  for (const component of ["HeaderSection", "ParagraphSection", "DiagramSection", "TextBoxSection", "CodingSection"]) assert.match(paperLab, new RegExp(`export function ${component}`));
  assert.match(experiment, /function SystemsExperiment/);
  assert.match(experiment, /function ProductExperiment/);
  assert.match(capstone, /createSseStream/);
  assert.match(capstone, /chatReducer/);
  assert.match(capstone, /localStorage/);
  assert.match(capstone, /@huggingface\/transformers/);
  assert.match(engines, /trainCharacterRnn/);
  assert.match(extended, /systemsLessons/);
  assert.match(extended, /productLessons/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("all visible reference cells pass their behavioral contracts", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/lessons/course.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lessons/extended-course.ts", import.meta.url), "utf8"),
  ]);
  const pairs = sources.flatMap((source) => [...source.matchAll(/code: `([\s\S]*?)`,\n\s*checkCode: `([\s\S]*?)`,/g)]);
  assert.equal(pairs.length, 34);
  for (const [index, pair] of pairs.entries()) {
    const result = new Function(`"use strict";\n${pair[1]}\n${pair[2]}`)();
    assert.equal(result.passed, true, `reference cell ${index + 1}: ${result.detail}`);
  }
});
