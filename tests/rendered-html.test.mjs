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
  assert.match(html, /href="\/project"/);
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
    assert.match(html, /Module progress/);
    assert.match(html, /href="\/project"/);
    assert.doesNotMatch(html, /Project structure|BrowserChat\.tsx/);
  }
});

test("the dedicated project route renders the complete progressive source tree", async () => {
  const response = await render("/project");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Project structure/);
  assert.match(html, /browser-chat\//);
  assert.match(html, /14(?:<!-- -->)? pending/);
  assert.match(html, /model\.config\.js/);
  assert.match(html, /character-rnn\.js/);
  assert.match(html, /inference-runtime\.js/);
  assert.match(html, /streaming-transport\.js/);
  assert.match(html, /chat-reducer\.js/);
  assert.match(html, /BrowserChat\.tsx/);
  assert.match(html, /href="\/workspace/);
  assert.match(html, /href="\/capstone"/);
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

test("Character RNNs teaches the unrolled mechanism and gates practice until restoration", async () => {
  const response = await render("/lessons/character-rnns");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Represent the sequence/);
  assert.match(html, /Assign credit through time/);
  assert.match(html, /recurrence-unroll/);
  assert.match(html, /Hidden-state flow/);
  assert.match(html, /Generation loop/);
  assert.match(html, /Shared at every position/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Restoring saved work/);
  assert.match(html, /Restoring your saved practice before editing is enabled/);
});

test("Neural Language Models teaches the complete numeric prediction path", async () => {
  const response = await render("/lessons/neural-language-models");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Discrete n-gram estimate/);
  assert.match(html, /Vocabulary logits/);
  assert.match(html, /ln\(30\)/);
  assert.match(html, /neural-probability-path/);
  assert.match(html, /Exact count/);
  assert.match(html, /Learned coordinates/);
  assert.match(html, /Stable softmax/);
  assert.match(html, /−log \.65 = \.43/);
  assert.match(html, /Output order/);
});

test("Subword Tokenization teaches pair identity, recounting, and ordered replay", async () => {
  const response = await render("/lessons/subword-tokenization");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Pair identity/);
  assert.match(html, /JSON\.stringify\(\[left, right\]\)/);
  assert.match(html, /Two BPE training rounds/);
  assert.match(html, /bpe-worked-example/);
  assert.match(html, /Round 1 counts/);
  assert.match(html, /then recount the modified words/);
  assert.match(html, /Learned order/);
  assert.match(html, /Reversed order/);
  assert.match(html, /abc/);
});

test("Additive Attention works through one decoder step and distinguishes scoring families", async () => {
  const response = await render("/lessons/additive-attention");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One decoder step/);
  assert.match(html, /Normalize over positions/);
  assert.match(html, /Construct the context/);
  assert.match(html, /One output step: emit year/);
  assert.match(html, /attention-worked-example/);
  assert.match(html, /q_year \[d_s\]/);
  assert.match(html, /softmax\(e\) = \[\.014, \.035, \.951\]/);
  assert.match(html, /Additive/);
  assert.match(html, /Dot product/);
  assert.match(html, /uniform attention stays at 0\.333/);
});

test("Transformers works through a shaped causal attention matrix before the live experiment", async () => {
  const response = await render("/lessons/transformers");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Tensor shapes/);
  assert.match(html, /QKᵀ/);
  assert.match(html, /transformer-worked-example/);
  assert.match(html, /Rows are queries · columns are keys/);
  assert.match(html, /Three-token causal attention probability matrix/);
  assert.match(html, /decoded/);
  assert.match(html, /0\.46/);
  assert.match(html, /Complete decoder block/);
  assert.match(html, /Run causal self-attention/);
});

test("In-Context Learning renders a controlled comparison and explicit inference boundary", async () => {
  const response = await render("/lessons/in-context-learning");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /hidden activations and KV cache/);
  assert.match(html, /icl-comparison/);
  assert.match(html, /Same held-out queries/);
  assert.match(html, /0 demonstrations/);
  assert.match(html, /1 demonstration/);
  assert.match(html, /4 demonstrations/);
  assert.match(html, /weights updated: 0/);
  assert.match(html, /Exact-match measurement plan for two held-out items/);
  assert.match(html, /Cannot infer/);
  assert.match(html, /Load model · ~181 MB/);
});

test("Inference Runtime renders one unambiguous request timeline and KV formula", async () => {
  const response = await render("/lessons/inference-runtime");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /runtime-worked-example/);
  assert.match(html, /Worked inference timeline for request r-104/);
  assert.match(html, /queue \+ prefill = 18 \+ 74 = 92 ms/);
  assert.match(html, /31 forwards · tokens 2–32 · 6 → 8 pages/);
  assert.match(html, /2 × layers × KV heads × cached tokens × head dimension × bytes \/ value/);
  assert.match(html, /generatedTokens/);
  assert.match(html, /decodeForwards/);
  assert.match(html, /processedTokenPositions/);
  assert.match(html, /finalSequenceLength/);
  assert.match(html, /function kvCacheBytes\(\{ layers, kvHeads, headDimension, tokens, bytesPerValue = 2 \}\)/);
});

test("Scheduling and Memory renders a controlled policy comparison and completion-aware API", async () => {
  const response = await render("/lessons/scheduling-memory");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /scheduler-worked-comparison/);
  assert.match(html, /A controlled scheduling comparison with the same arrivals and resource limits/);
  assert.match(html, /Static batch/);
  assert.match(html, /membership fixed/);
  assert.match(html, /Continuous/);
  assert.match(html, /membership per iteration/);
  assert.match(html, /<dd>116<\/dd>/);
  assert.match(html, /<dd>61%<\/dd>/);
  assert.match(html, /<dd>19<\/dd>/);
  assert.match(html, /<dd>88<\/dd>/);
  assert.match(html, /<dd>86%<\/dd>/);
  assert.match(html, /<dd>7<\/dd>/);
  assert.match(html, /Can infer/);
  assert.match(html, /Cannot infer/);
  assert.match(html, /return \{ active, completed \}/);
  assert.match(html, /pages × pageSize/);
  assert.match(html, /capacity − tokens/);
});

test("the consent-gated local model runtime has a statically prebundled client boundary", async () => {
  const [experiment, runtimeBoundary, viteConfig] = await Promise.all([
    readFile(new URL("../app/components/LessonExperiment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/local-transformer-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(experiment, /await import\("\.\.\/lib\/local-transformer-runtime"\)/);
  assert.doesNotMatch(experiment, /await import\("@huggingface\/transformers"\)/);
  assert.match(runtimeBoundary, /export \{ pipeline \} from "@huggingface\/transformers"/);
  assert.match(viteConfig, /optimizeDeps: \{ include: \["@huggingface\/transformers"\] \}/);
});

test("the capstone contains the complete React chat system", async () => {
  const response = await render("/capstone");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Browser Chat/);
  assert.match(html, /compiled-capstone-shell/);
  assert.match(html, /Loading Browser Chat/);
  assert.match(html, /Restoring project/);
  assert.match(html, /href="\/workspace"/);
  assert.match(html, /href="\/project"/);
  assert.doesNotMatch(html, /Project file editor/);
  assert.doesNotMatch(html, /Student model|Local chat model|Enter to send/);
});

test("the project IDE is a dedicated tested authoring surface", async () => {
  const response = await render("/workspace");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Project IDE/);
  assert.match(html, /href="\/project"/);
  assert.match(html, /lesson files verified/);
  assert.match(html, /runtime\/model.config.js/);
  assert.match(html, /character-rnn\.js/);
  assert.match(html, /inference-runtime\.js/);
  assert.match(html, /streaming-transport\.js/);
  assert.match(html, /chat-reducer\.js/);
  assert.match(html, /BrowserChat\.tsx/);
  assert.match(html, /Pending/);
  assert.match(html, /class="code-editor"/);
  assert.match(html, /Unit tests/);
  assert.match(html, /Run all\s*(?:<!-- -->)?39/);
  assert.match(html, /Run file tests/);
  assert.match(html, /Test, build &amp; run/);
  assert.match(html, /Last passing build/);
});

test("the design kit, simulations, model engines, and artifact runtime remain reusable", async () => {
  const [paperLab, experiment, capstone, capstoneTemplate, previewFrame, workbench, projectWorkspace, projectTests, browserLabService, quickJsRunner, compilerClient, persistence, artifactRuntime, artifactService, labTypes, engines, extended, sourceSets, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/components/PaperLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LessonExperiment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content/browser-chat/project-template.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime/capstone/preview-frame.ts", import.meta.url), "utf8"),
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
  assert.match(capstone, /mountPreviewFrame/);
  assert.match(capstone, /loadValidatedCapstoneBundle/);
  assert.doesNotMatch(capstone, /localStorage/);
  assert.match(capstone, /LocalModelClient/);
  assert.match(capstoneTemplate, /function chatReducer/);
  assert.match(capstoneTemplate, /__LATENT_PREVIEW_HOST__/);
  assert.match(capstoneTemplate, /export function mount/);
  assert.match(capstoneTemplate, /role="log"/);
  assert.match(previewFrame, /MessageChannel/);
  assert.match(previewFrame, /PREVIEW_FRAME_SANDBOX/);
  assert.doesNotMatch(previewFrame, /new Function|eval\(/);
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

test("Streaming Transport renders the worked byte path and both stream policies", async () => {
  const response = await render("/lessons/streaming-transport");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One token across arbitrary chunks/);
  assert.match(html, /Byte chunk A/);
  assert.match(html, /TextDecoder/);
  assert.match(html, /parseSseChunk\(textRemainder, decodedText\)/);
  assert.match(html, /Complete stream/);
  assert.match(html, /Cancel after 4 tokens/);
  assert.match(html, /decoded text chunks/);
});

test("Reliability and Observability renders an attempt-aware worked trace", async () => {
  const response = await render("/lessons/reliability-observability");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One request across two attempts/);
  assert.match(html, /Logical request/);
  assert.match(html, /r-201\.1/);
  assert.match(html, /r-201\.2/);
  assert.match(html, /Counterfactual · stop/);
  assert.match(html, /Attempt 1 queue/);
  assert.match(html, /End to end/);
  assert.match(html, /Stale attempt/);
  assert.match(html, /Queue timeout/);
  assert.match(html, /Malformed frame/);
  assert.match(html, /Worker crash/);
  assert.match(html, /User abort/);
  assert.match(html, /request and attempt ids · phase timing · terminal and resource evidence/);
});

test("Conversation State renders a normalized update and all 18 reducer actions", async () => {
  const response = await render("/lessons/conversation-state");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One delta through normalized state/);
  assert.match(html, /conversation · c-17/);
  assert.match(html, /messagesById · m-u1/);
  assert.match(html, /messagesById · m-a1/);
  assert.match(html, /a-17\.2/);
  assert.match(html, /r-17\.2/);
  assert.match(html, /canStop: true · canRegenerate: false/);
  assert.match(html, /18 reducer actions · 3 generation attempts/);
  assert.match(html, /Complete · 01–06/);
  assert.match(html, /Cancel \+ late · 07–12/);
  assert.match(html, /Edit \+ regenerate · 13–18/);
  assert.match(html, /messageId/);
  assert.match(html, /attemptId/);
  assert.match(html, /requestId/);
  assert.match(html, /Identity evidence/);
});
