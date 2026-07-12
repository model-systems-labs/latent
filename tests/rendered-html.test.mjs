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

test("server-renders one LLM Systems program with four technical modules", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build an LLM system in your browser/);
  assert.match(html, /Model Foundations/);
  assert.match(html, /Inference Runtime/);
  assert.match(html, /LLM Serving/);
  assert.match(html, /Chat Integration/);
  assert.match(html, /Browser Chat/);
  assert.equal((html.match(/class="course-track-card"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Mock Backend Systems/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("each module renders its technical lesson sequence", async () => {
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
    assert.match(html, /id="lesson-sources-title">Sources/);
    assert.match(html, /aria-labelledby="lesson-sources-title"/);
    assert.match(html, /3(?:<!-- -->)? references/);
    assert.equal((html.match(/class="source-entry"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /primary and supporting references|supporting sources/);
    assert.match(html, /Source finding/);
    assert.match(html, /Browser reproduction/);
    assert.match(html, /OpenRouter API key/);
    assert.match(html, /Practice all/);
    assert.match(html, /Run cell/);
    assert.match(html, /Run behavioral checks/);
    assert.match(html, /Artifacts/);
    assert.match(html, /A record of what you built/);
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
  assert.match(html, /lesson files verified/);
  assert.match(html, /runtime\/model.config.js/);
  assert.match(html, /class="code-editor"/);
  assert.match(html, /Unit tests/);
  assert.match(html, /Run all[\s\S]*37/);
  assert.match(html, /Run file tests/);
  assert.match(html, /Test, build &amp; run/);
  assert.match(html, /Last passing build/);
});

test("the design kit, simulations, model engines, and artifact runtime remain reusable", async () => {
  const [paperLab, experiment, capstone, workbench, projectWorkspace, projectTests, browserLabService, quickJsRunner, compilerClient, persistence, artifactRuntime, artifactService, labTypes, engines, extended, sourceSets, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/components/PaperLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LessonExperiment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectWorkbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/project-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/project-tests.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/features/ide/browser-lab-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/browser-lab/src/worker/quickjs-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/browser-lab/src/compiler/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/platform/persistence/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/artifact-runtime/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/features/artifacts/lesson-artifacts.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/browser-lab/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/lab-engines.ts", import.meta.url), "utf8"),
    Promise.all([
      readFile(new URL("../app/lessons/extended-course.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lessons/extended/systems/reliability-observability.ts", import.meta.url), "utf8"),
    ]).then((parts) => parts.join("\n")),
    readFile(new URL("../app/lessons/sources.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  for (const component of ["HeaderSection", "ParagraphSection", "DiagramSection", "TextBoxSection", "CodingSection"]) assert.match(paperLab, new RegExp(`export function ${component}`));
  assert.match(experiment, /function SystemsExperiment/);
  assert.match(experiment, /function ProductExperiment/);
  assert.match(capstone, /createMockServingStream/);
  assert.match(capstone, /chatReducer/);
  assert.doesNotMatch(capstone, /localStorage/);
  assert.match(capstone, /LocalModelClient/);
  assert.match(capstone, /runtime\.model\.temperature/);
  assert.match(capstone, /runtime\.transport\.wordsPerEvent/);
  assert.match(workbench, /Previous build/);
  assert.match(workbench, /saveProjectRuntime/);
  assert.match(workbench, /runProjectUnitTests/);
  assert.match(workbench, /Build blocked/);
  assert.match(projectWorkspace, /latent-project-v1/);
  assert.match(projectWorkspace, /compileProject/);
  assert.match(projectTests, /runLessonContracts/);
  assert.match(projectTests, /Runtime configuration/);
  assert.match(browserLabService, /BrowserLabWorkerClient/);
  assert.doesNotMatch(browserLabService, /new Function|eval\(/);
  assert.match(quickJsRunner, /QuickJSSandboxEngine/);
  assert.match(compilerClient, /BrowserLabCompilerClient/);
  assert.match(persistence, /initializePersistence/);
  assert.match(artifactRuntime, /\.\/core/);
  assert.match(artifactRuntime, /\.\/portable/);
  assert.match(artifactService, /recordValidatedProjectLessonArtifacts/);
  assert.match(artifactService, /recordProjectBuildArtifact/);
  assert.match(labTypes, /BrowserLabFile/);
  assert.match(labTypes, /BrowserLabBuildGate/);
  assert.match(engines, /trainCharacterRnn/);
  assert.match(engines, /topK/);
  assert.match(extended, /systemsLessons/);
  assert.match(extended, /LLM Serving/);
  assert.doesNotMatch(extended, /Mock Backend Systems/);
  assert.match(extended, /productLessons/);
  assert.equal((sourceSets.match(/role: /g) ?? []).length, 42);
  assert.equal((sourceSets.match(/^  (?:"[^"]+"|[a-z-]+): \[$/gm) ?? []).length, 14);
  assert.match(paperLab, /lesson\.sources\.map\(\(source\)/);
  assert.doesNotMatch(paperLab, /supporting-sources|source\.role/);
  assert.match(paperLab, /Synthesize across these sources/);
  assert.match(layout, /og-v2\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("all browser-rendered reference cells route behavior to host-owned contracts", async () => {
  const slugs = [
    "character-rnns", "neural-language-models", "subword-tokenization", "additive-attention", "transformers", "in-context-learning",
    "inference-runtime", "streaming-transport", "scheduling-memory", "reliability-observability",
    "conversation-state", "streaming-react", "chat-actions-context", "chat-product-quality",
  ];
  let cellCount = 0;
  for (const slug of slugs) {
    const html = await (await render(`/lessons/${slug}`)).text();
    cellCount += (html.match(/data-reference-code=/g) ?? []).length;
    assert.doesNotMatch(html, /data-check-code=/, slug);
  }
  assert.equal(cellCount, 34);
});
