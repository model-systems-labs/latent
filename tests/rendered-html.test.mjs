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

test("server-renders the complete four-course curriculum", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build an LLM chat system/);
  assert.match(html, /Language Models/);
  assert.match(html, /LLM Runtime Systems/);
  assert.match(html, /Mock Backend Systems/);
  assert.match(html, /Chat Product/);
  assert.match(html, /Browser Chat/);
  assert.equal((html.match(/class="course-track-card"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("each course renders its technical lesson sequence", async () => {
  const courses = [
    ["models", ["Character RNNs", "Neural Language Models", "Subword Tokenization", "Additive Attention", "Transformers", "In-Context Learning"]],
    ["systems", ["Inference Runtime", "Scheduling and Memory"]],
    ["backend", ["Streaming Transport", "Reliability and Observability"]],
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
    assert.match(html, /Source set/);
    assert.match(html, /aria-label="3 sources for/);
    assert.match(html, /primary and supporting references/);
    assert.match(html, /Primary claim/);
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
  assert.match(html, /href="\/workspace"/);
  assert.doesNotMatch(html, /Project file editor/);
  assert.match(html, /Enter to send/);
  assert.match(html, /Clear current backend/);
});

test("the project IDE is a dedicated tested authoring surface", async () => {
  const response = await render("/workspace");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Project IDE/);
  assert.match(html, /Your project/);
  assert.match(html, /runtime\/model.config.js/);
  assert.match(html, /Project file editor/);
  assert.match(html, /Unit tests/);
  assert.match(html, /Run all 37/);
  assert.match(html, /Run file tests/);
  assert.match(html, /Test, build &amp; run/);
  assert.match(html, /Last passing build/);
});

test("the design kit, simulations, and model engines remain reusable", async () => {
  const [paperLab, experiment, capstone, workbench, projectWorkspace, projectTests, labStore, labRunner, labTypes, engines, extended, sourceSets, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/components/PaperLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LessonExperiment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectWorkbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/project-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/project-tests.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/browser-lab/local-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/browser-lab/test-runner.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/browser-lab/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/lab-engines.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lessons/extended-course.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lessons/sources.ts", import.meta.url), "utf8"),
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
  assert.match(capstone, /runtime\.model\.temperature/);
  assert.match(capstone, /runtime\.transport\.wordsPerEvent/);
  assert.match(workbench, /Previous build/);
  assert.match(workbench, /saveProjectRuntime/);
  assert.match(workbench, /runProjectUnitTests/);
  assert.match(workbench, /Build blocked/);
  assert.match(projectWorkspace, /latent-project-v1/);
  assert.match(projectWorkspace, /compileProject/);
  assert.match(projectTests, /runBrowserLabContract/);
  assert.match(projectTests, /Runtime contract/);
  assert.match(labStore, /createDeviceLocalStore/);
  assert.match(labStore, /localStorage/);
  assert.match(labRunner, /runBrowserLabContract/);
  assert.match(labRunner, /gateBrowserLabBuild/);
  assert.match(labTypes, /BrowserLabFile/);
  assert.match(labTypes, /BrowserLabBuildGate/);
  assert.match(engines, /trainCharacterRnn/);
  assert.match(engines, /topK/);
  assert.match(extended, /systemsLessons/);
  assert.match(extended, /Mock Backend Systems/);
  assert.match(extended, /productLessons/);
  assert.equal((sourceSets.match(/role: /g) ?? []).length, 42);
  assert.equal((sourceSets.match(/^  (?:"[^"]+"|[a-z-]+): \[$/gm) ?? []).length, 14);
  assert.match(paperLab, /supporting\.map\(sourceCard\)/);
  assert.match(paperLab, /Synthesize across these sources/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("all browser-rendered reference cells pass their behavioral contracts", async () => {
  const slugs = [
    "character-rnns", "neural-language-models", "subword-tokenization", "additive-attention", "transformers", "in-context-learning",
    "inference-runtime", "streaming-transport", "scheduling-memory", "reliability-observability",
    "conversation-state", "streaming-react", "chat-actions-context", "chat-product-quality",
  ];
  const cells = [];
  for (const slug of slugs) {
    const html = await (await render(`/lessons/${slug}`)).text();
    cells.push(...[...html.matchAll(/data-reference-code="([^"]*)" data-check-code="([^"]*)"/g)].map((match) => ({
      slug,
      reference: decodeURIComponent(match[1]),
      check: decodeURIComponent(match[2]),
    })));
  }
  assert.equal(cells.length, 34);
  for (const [index, cell] of cells.entries()) {
    try {
      const result = new Function(`"use strict";\n${cell.reference}\n${cell.check}`)();
      assert.equal(result.passed, true, `${cell.slug} cell ${index + 1}: ${result.detail}`);
    } catch (error) {
      assert.fail(`${cell.slug} cell ${index + 1}: ${error instanceof Error ? error.message : error}\n${cell.reference}\n${cell.check}`);
    }
  }
});
