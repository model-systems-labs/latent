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

test("the landing page frames the course as a personal academic notebook", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /I built this to understand LLM systems/);
  assert.match(html, /Latent is a set of courses, notes, and browser experiments/);
  assert.match(html, /Two short courses cover the mathematical and machine-learning foundations/);
  assert.match(html, /Harness Engineering/);
  assert.match(html, /studies the deterministic software around an agent/);
  assert.match(html, /Model, runtime, serving, and interface/);
  assert.match(html, /Browser-native LLM system/);
  assert.match(html, /Prompt \+ messages/);
  assert.match(html, /Tokenizer/);
  assert.match(html, /Prefill/);
  assert.match(html, /Decode loop/);
  assert.match(html, /KV cache/);
  assert.match(html, /Scheduler/);
  assert.match(html, /SSE stream/);
  assert.match(html, /Streaming transport/);
  assert.match(html, /React reducer/);
  assert.match(html, /Browser persistence/);
  assert.match(html, /Browser Chat/);
  assert.match(html, /aria-label="System boundaries"/);
  assert.match(html, /aria-label="Request and token event flow"/);
  assert.match(html, /The implementation accumulates/);
  assert.match(html, /This is not a production-scale model or serving stack/);
  assert.match(html, /models\/character-rnn\.py/);
  assert.match(html, /capstone\/BrowserChat\.tsx/);
  assert.match(html, /href="\/course"/);
  assert.doesNotMatch(html, /Open the course|Build the system|Token generation is the midpoint|It is free to use/);
  assert.doesNotMatch(html, /Character-level RNN training|course-track-card catalog-track-card|Run the first model/);
});

test("the course catalog separates foundations, agent systems, and the cumulative LLM project", async () => {
  const response = await render("/course");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /id="foundations-title">Foundations/);
  assert.match(html, /id="agent-systems-title">Agent systems/);
  assert.match(html, /id="project-course-title">LLM systems project/);
  assert.match(html, /Linear Algebra Basics/);
  assert.match(html, /Machine Learning Basics/);
  assert.match(html, /Harness Engineering/);
  assert.match(html, /Build an LLM System in Your Browser/);
  assert.match(html, /href="\/courses\/harness-engineering"/);
  assert.match(html, /Exercises and progress stay separate from Browser Chat/);
  assert.equal((html.match(/class="course-track-card catalog-program-card"/g) ?? []).length, 4);
});

test("Harness Engineering renders as an eight-lesson applied course with its own project", async () => {
  const response = await render("/courses/harness-engineering");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Applied(?:<!-- -->)? course/);
  assert.match(html, /Harness Engineering/);
  assert.match(html, /Each lesson adds tested Python to a separate project saved in this browser/);
  assert.match(html, /href="\/lessons\/agent-loop"/);
  assert.match(html, /href="\/courses\/harness-engineering\/workspace"/);
  for (const title of [
    "Agent Loop",
    "Tool Contracts",
    "Context Selection",
    "Permissions and Sandboxes",
    "State and Recovery",
    "Agent Evaluations",
    "Task Orchestration",
    "Integrated Harness",
  ]) {
    assert.match(html, new RegExp(title));
  }
  assert.equal((html.match(/class="lesson-card lesson-card-simple/g) ?? []).length, 8);
  assert.doesNotMatch(html, /href="\/(?:project|capstone)(?:[/?#"])/);
  assert.doesNotMatch(html, /Open in IDE|BrowserChat\.tsx/);
});

test("Agent Loop combines technical reading with two isolated runnable cells", async () => {
  const response = await render("/lessons/agent-loop");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /The model proposes; the harness executes/);
  assert.match(html, /Each action produces the next observation/);
  assert.match(html, /Termination is part of the protocol/);
  assert.match(html, /Parse a model response/);
  assert.match(html, /Append a tool result/);
  assert.equal((html.match(/class="exercise-summary"/g) ?? []).length, 2);
  assert.match(html, /Run cell/);
  assert.match(html, /Run all tests/);
  assert.match(html, /id="lesson-sources-title">Sources/);
  assert.equal((html.match(/class="source-entry"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Open in IDE|Saved results|href="#artifacts"/);
});

test("Integrated Harness renders the composed loop and links to its cumulative project", async () => {
  const response = await render("/lessons/integrated-harness");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /The loop does not depend on one model/);
  assert.match(html, /The host code controls every action/);
  assert.match(html, /Run the harness/);
  assert.match(html, /Audit a harness run/);
  assert.equal((html.match(/class="exercise-summary"/g) ?? []).length, 2);
  assert.match(html, /Open project/);
  assert.match(html, /\/courses\/harness-engineering\/workspace\?file=harness%2Fharness\.py/);
  assert.doesNotMatch(html, /Open in IDE|Saved results|href="#artifacts"/);
});

test("the LLM Systems home renders one project course with four technical modules", async () => {
  const response = await render("/courses/llm-systems");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build an LLM System in Your Browser/);
  assert.match(html, /Model Foundations/);
  assert.match(html, /Inference Runtime/);
  assert.match(html, /LLM Serving/);
  assert.match(html, /Chat Integration/);
  assert.match(html, /Browser Chat/);
  assert.match(html, /href="\/project"/);
  assert.equal((html.match(/class="course-track-card catalog-track-card"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /environment-readiness|Capstone setup|Final project|Module 0[1-4]/);
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
    const response = await render(`/courses/llm-systems/${slug}`);
    assert.equal(response.status, 200, slug);
    const html = await response.text();
    for (const title of titles) assert.match(html, new RegExp(title));
    assert.match(html, /class="course-progress-record"/);
    assert.match(html, /aria-label="Restoring lesson progress"/);
    assert.match(html, /Restoring progress/);
    assert.doesNotMatch(html, /Your progress|lesson-build|track-outcome|Module 0[1-4]/);
    assert.doesNotMatch(html, /Project structure|BrowserChat\.tsx/);
  }
});

test("the dedicated project route renders the complete progressive source tree", async () => {
  const response = await render("/project");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Project structure/);
  assert.match(html, /browser-chat\//);
  assert.match(html, /0(?:<!-- -->)? of (?:<!-- -->)?14(?:<!-- -->)? lesson files ready/);
  assert.match(html, /model\.config\.js/);
  assert.match(html, /character-rnn\.py/);
  assert.match(html, /inference-runtime\.py/);
  assert.match(html, /streaming-transport\.py/);
  assert.match(html, /chat-reducer\.py/);
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
    assert.equal((html.match(/class="source-entry"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /primary and supporting references|supporting sources/);
    assert.doesNotMatch(html, /tensor-runtime-strip|Python runtime|Tensor runtime|CPython · NumPy|NumPy handles the array operations|What the source says|What this browser lab shows|What it doesn.t cover|How it works|Highlight a passage|data-selection-ask|Ask Claude|Ask Codex/);
    assert.match(html, /<h2 class="sr-only">Summary<\/h2>/);
    assert.doesNotMatch(html, /class="section-title"><span>0[123]<\/span>/);
    assert.doesNotMatch(html, /OpenRouter API key|openrouter\.ai|paper-chat|Questions and answers/);
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length >= 1, true, `${slug} must server-render its first exercise open`);
    assert.equal((html.match(/class="exercise-body"/g) ?? []).length, 1, `${slug} must render exactly one active exercise body`);
    assert.match(html, /class="exercise-summary"[^>]*aria-expanded="true"[^>]*aria-controls="exercise-/);
    const exerciseControls = [...html.matchAll(/class="exercise-summary"[^>]*aria-expanded="(true|false)"[^>]*aria-controls="([^"]+)"/g)]
      .map((match) => ({ expanded: match[1] === "true", id: match[2] }));
    assert.ok(exerciseControls.length > 0, `${slug} must expose exercise disclosure controls`);
    for (const control of exerciseControls) {
      const panel = html.match(new RegExp(`<div[^>]*id="${control.id}"[^>]*>`))?.[0];
      assert.ok(panel, `${slug}: ${control.id} must resolve to a rendered panel`);
      if (!control.expanded) assert.match(panel, /\shidden=""/, `${slug}: collapsed panel ${control.id} must be hidden`);
    }
    assert.match(html, /class="practice-block is-active"[^>]*aria-busy="false"/);
    assert.doesNotMatch(html, /Complete the TODO below|Your draft|>Editing</);
    assert.match(html, /data-direct-edit="true"/);
    assert.match(html, /data-edit-state="starter"/);
    assert.match(html, /Restoring saved code/);
    assert.doesNotMatch(html, /NotImplementedError/);
    assert.doesNotMatch(html, /Practice all|Practice cell|Run example|Reset all|Restore all|Restore reference|Restore draft|Run all examples|Run practice checks/);
    assert.match(html, /Run cell/);
    assert.match(html, /Run all tests/);
    assert.match(html, /Reference solution/);
    assert.doesNotMatch(html, /Compare with reference|Your draft stays unchanged/);
    assert.match(html, /Open in IDE/);
    assert.match(html, /Saved results/);
    assert.doesNotMatch(html, /Proof tied to the exact code you ran|Take a look|Course-provided runtime|Fixed worked example|Dataset included with the lesson/);
  }
});

test("every lesson keeps its executable work inside the browser", async () => {
  for (const slug of ["character-rnns", "neural-language-models", "additive-attention", "transformers", "inference-runtime"]) {
    const response = await render(`/lessons/${slug}`);
    assert.equal(response.status, 200, slug);
    const html = await response.text();
    assert.match(html, /Run cell/);
    assert.match(html, /Open in IDE/);
    assert.doesNotMatch(html, /Colab|Download notebook|Open notebook|native Python|native runtime|PyTorch version/i);
  }
});

test("the server-rendered editor stays neutral while the reference remains syntax highlighted", async () => {
  const response = await render("/lessons/streaming-transport");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Restoring saved code/);
  assert.match(html, /class="syntax-code"/);
  assert.match(html, /tok-keyword/);
  assert.doesNotMatch(html, /NotImplementedError/);
  assert.match(html, /Reference solution/);
  assert.doesNotMatch(html, /syntax-code-fallback/);
});

test("Character RNNs teaches the unrolled mechanism while saved work restores before direct editing", async () => {
  const response = await render("/lessons/character-rnns");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Represent each character/);
  assert.match(html, /Send credit back through time/);
  assert.match(html, /recurrence-unroll/);
  assert.match(html, /Memory flow/);
  assert.match(html, /Teacher-forced training/);
  assert.match(html, /real x_\(t\+1\).*loss target \+ next input/);
  assert.match(html, />Generation</);
  assert.match(html, /Same at every position/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Loading saved work/);
  assert.doesNotMatch(html, /Loading your saved practice before editing turns on/);
});

test("Neural Language Models teaches the complete numeric prediction path", async () => {
  const response = await render("/lessons/neural-language-models");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /How an n-gram counts/);
  assert.match(html, /Vocabulary logits/);
  assert.match(html, /ln\(30\)/);
  assert.match(html, /neural-probability-path/);
  assert.match(html, /Exact count/);
  assert.match(html, /Learned vectors/);
  assert.match(html, /Stable softmax/);
  assert.match(html, /−log \.65 = \.43/);
  assert.match(html, /Output order/);
});

test("Subword Tokenization teaches pair identity, recounting, and ordered replay", async () => {
  const response = await render("/lessons/subword-tokenization");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Keep pairs distinct/);
  assert.match(html, /json\.dumps\(\[left, right\]\)/);
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
  assert.match(html, /One decoding step/);
  assert.match(html, /The encoder reads the source sequence/);
  assert.match(html, /current state becomes the query q_t/);
  assert.match(html, /Normalize across positions/);
  assert.match(html, /Build the context/);
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
  assert.match(html, /Keep track of the shapes/);
  assert.match(html, /QKᵀ/);
  assert.match(html, /transformer-worked-example/);
  assert.match(html, /Rows are queries · columns are keys/);
  assert.match(html, /Three-token causal attention probability matrix/);
  assert.match(html, /decoded/);
  assert.match(html, /0\.46/);
  assert.match(html, /The full decoder block/);
  assert.match(html, /Non-affine layer normalization/);
  assert.match(html, /learned gain gamma and bias beta/);
  assert.match(html, /Run causal self-attention/);
});

test("In-Context Learning renders a controlled comparison and explicit inference boundary", async () => {
  const response = await render("/lessons/in-context-learning");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /hidden activations and KV cache/);
  assert.match(html, /icl-comparison/);
  assert.match(html, /Same test questions/);
  assert.match(html, /0 demonstrations/);
  assert.match(html, /1 demonstration/);
  assert.match(html, /4 demonstrations/);
  assert.match(html, /weights updated: 0/);
  assert.match(html, /Exact-match measurement plan for two held-out items/);
  assert.match(html, /provided local evaluator runs that whole comparison/);
  assert.match(html, /same two held-out items/);
  assert.match(html, /Load model · ~181 MB/);
});

test("Inference Runtime renders one unambiguous request timeline and KV formula", async () => {
  const response = await render("/lessons/inference-runtime");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /runtime-worked-example/);
  assert.match(html, /Inference timeline for request r-104/);
  assert.match(html, /queue \+ prefill = 18 \+ 74 = 92 ms/);
  assert.match(html, /31 forwards · tokens 2–32 · 6 → 8 pages/);
  assert.match(html, /2 × layers × KV heads × cached tokens × head dimension × bytes \/ value/);
  assert.match(html, /generatedTokens/);
  assert.match(html, /decodeForwards/);
  assert.match(html, /processedTokenPositions/);
  assert.match(html, /finalSequenceLength/);
  assert.match(html, /def kv_cache_bytes\(config\):/);
});

test("Scheduling and Memory renders a controlled policy comparison and completion-aware API", async () => {
  const response = await render("/lessons/scheduling-memory");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /scheduler-worked-comparison/);
  assert.match(html, /A scheduling comparison with the same arrivals and resource limits/);
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
  assert.match(html, /same arrivals and resource limits/);
  assert.match(html, /def decode_iteration\(active_requests\):/);
  assert.match(html, /pages × page_size/);
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
  assert.match(viteConfig, /optimizeDeps:\s*\{/);
  assert.match(viteConfig, /include: \["@huggingface\/transformers", "@codemirror\/lang-python"\]/);
});

test("the capstone contains the complete React chat system", async () => {
  const response = await render("/capstone");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Browser Chat/);
  assert.match(html, /compiled-capstone-shell/);
  assert.match(html, /Checking your build/);
  assert.match(html, /Verifying the current test result and preview bundle/);
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
  assert.doesNotMatch(html, /<span>Project IDE<\/span>/);
  assert.match(html, /href="\/project"/);
  assert.match(html, /aria-label="0 of 14 lessons complete"/);
  assert.match(html, /runtime\/model.config.js/);
  assert.match(html, /character-rnn\.py/);
  assert.match(html, /inference-runtime\.py/);
  assert.match(html, /streaming-transport\.py/);
  assert.match(html, /chat-reducer\.py/);
  assert.match(html, /BrowserChat\.tsx/);
  assert.match(html, /0 of \d+ checks verified/);
  assert.match(html, /class="code-editor"/);
  assert.match(html, /Unit tests/);
  assert.match(html, /data-inspector-view="tests"/);
  assert.match(html, /aria-label="Results panel"/);
  assert.match(html, /<summary>Actions<\/summary>/);
  assert.match(html, /Run all\s*(?:<!-- -->)?40/);
  assert.match(html, /Run file tests/);
  assert.match(html, /Test, build &amp; run/);
  assert.match(html, /<span>Build<\/span>/);
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
    readFile(new URL("../packages/model-lab/src/character-rnn.ts", import.meta.url), "utf8"),
    Promise.all([
      readFile(new URL("../app/lessons/extended-course.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lessons/extended/systems/reliability-observability.ts", import.meta.url), "utf8"),
    ]).then((parts) => parts.join("\n")),
    readFile(new URL("../app/lessons/sources.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  for (const component of ["HeaderSection", "ParagraphSection", "DiagramSection", "CodingSection"]) assert.match(paperLab, new RegExp(`export function ${component}`));
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
  assert.doesNotMatch(workbench, /Previous build|Active build|Portable build file/);
  assert.match(workbench, /project-build-artifact/);
  assert.match(workbench, /saveProjectRuntime/);
  assert.match(workbench, /runProjectUnitTests/);
  assert.match(workbench, /Build blocked/);
  assert.match(projectWorkspace, /latent-project-v1/);
  assert.match(projectWorkspace, /compileProject/);
  assert.match(projectTests, /runLessonContracts/);
  assert.match(projectTests, /Runtime settings/);
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
  assert.doesNotMatch(paperLab, /SelectionAsk|selection-ask|data-selection-ask|Highlight a passage/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("the capstone host flushes framed UTF-8 and owns reader teardown", async () => {
  const capstone = await readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8");
  assert.match(capstone, /new TextDecoder\("utf-8", \{ fatal: true \}\)/);
  assert.match(capstone, /finalDecoded = decoder\.decode\(\)/);
  assert.match(capstone, /frameRemainder\.trim\(\).*incomplete SSE frame/);
  assert.match(capstone, /if \(controller\.signal\.aborted \|\| resource\.decoder !== decoder\) throw new DOMException\("Aborted", "AbortError"\);[\s\S]*finalDecoded = decoder\.decode\(\)/);
  assert.match(capstone, /resource\.reader = null;[\s\S]*resource\.decoder = null;[\s\S]*resource\.frameRemainder = ""/);
  assert.match(capstone, /await reader\.cancel\("Generation lifecycle ended\."\)/);
  assert.match(capstone, /reader\.releaseLock\(\)/);
  assert.match(capstone, /resource\.controller\.abort\(\);[\s\S]*await releaseGenerationResource\(resource, true\)/);
});

test("each lesson server-renders one read-only reference comparison without embedding executable check code", async () => {
  const slugs = [
    "character-rnns", "neural-language-models", "subword-tokenization", "additive-attention", "transformers", "in-context-learning",
    "inference-runtime", "streaming-transport", "scheduling-memory", "reliability-observability",
    "conversation-state", "streaming-react", "chat-actions-context", "chat-product-quality",
  ];
  let comparisonCount = 0;
  for (const slug of slugs) {
    const html = await (await render(`/lessons/${slug}`)).text();
    const comparisons = html.match(/class="reference-comparison"/g) ?? [];
    assert.equal(comparisons.length, 1, `${slug} must expose reference code only for its single active exercise`);
    comparisonCount += comparisons.length;
    assert.match(html, /Reference solution/);
    assert.doesNotMatch(html, /Compare with reference|Your draft stays unchanged/);
    assert.match(html, /reference implementation/);
    assert.doesNotMatch(html, /data-reference-code=/, slug);
    assert.doesNotMatch(html, /data-check-code=/, slug);
  }
  assert.equal(comparisonCount, 14);
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
  assert.match(html, /If a token were visible · stop/);
  assert.match(html, /Attempt 1 queue/);
  assert.match(html, /End to end/);
  assert.match(html, /Stale attempt/);
  assert.match(html, /Queue timeout/);
  assert.match(html, /Malformed frame/);
  assert.match(html, /Worker crash/);
  assert.match(html, /User abort/);
  assert.match(html, /Request and attempt ids · phase timing · cleanup/);
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
  assert.match(html, /Complete · 1–6/);
  assert.match(html, /Cancel \+ late · 7–12/);
  assert.match(html, /Edit \+ regenerate · 13–18/);
  assert.match(html, /messageId/);
  assert.match(html, /attemptId/);
  assert.match(html, /requestId/);
  assert.match(html, /What changed/);
  assert.match(html, /Replay selected flow/);
});

test("Streaming React renders the frame timing trace and four honest profiles", async () => {
  const response = await render("/lessons/streaming-react");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One animation-frame commit/);
  assert.match(html, /t = 2 ms/);
  assert.match(html, /Pending render-delta queue/);
  assert.match(html, /requestAnimationFrame/);
  assert.match(html, /TOKEN_BATCH/);
  assert.match(html, /Scroll-follow check/);
  assert.match(html, /drop pending text → cancel scheduled frame → reject late deltas/);
  assert.match(html, /Burst/);
  assert.match(html, /Steady/);
  assert.match(html, /Stalled/);
  assert.match(html, /Cancelled/);
  assert.match(html, /Replay burst trace/);
  assert.match(html, /same fixed 60-delta response/);
  assert.match(html, /short live-region announcements/);
});

test("Actions and Context renders a concrete branch, actionable flows, and an exact request ledger", async () => {
  const response = await render("/lessons/chat-actions-context");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One prefix, three actions, one request boundary/);
  assert.match(html, /m-a3 · a-31 · r-31/);
  assert.match(html, /partial “Set future logits” retained/);
  assert.match(html, /m-a4 · a-32 · r-32/);
  assert.match(html, /m-u3-e1 → m-a5 · a-33 · r-33/);
  assert.match(html, /Request assembly · budget 26/);
  assert.match(html, /m-u2 \+ m-a2/);
  assert.match(html, /20 tokens · skip/);
  assert.match(html, /s1 → m-u1 → m-a1 → m-u3/);
  assert.match(html, /overflow: true/);
  assert.match(html, /3 action flows · 29 budgets \(14–42\)/);
  assert.match(html, />Stop</);
  assert.match(html, />Retry \/ regenerate</);
  assert.match(html, />Edit prompt</);
  assert.match(html, /Request budget · (?:<!-- -->)?26(?:<!-- -->)? tokens/);
  assert.match(html, /Messages sent to the model/);
  assert.match(html, /Saved partial answer/);
  assert.match(html, /Full attempt record/);
  assert.match(html, /latent-local-135m/);
  assert.match(html, /chat-v3/);
  assert.match(html, /temperature/);
  assert.match(html, /includedMessageIds/);
  assert.match(html, /Replay selected request/);
  assert.match(html, /exact token counts/);
});

test("Product Quality separates executed checks, unexecuted specifications, and manual verification", async () => {
  const response = await render("/lessons/chat-product-quality");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One send through reload/);
  assert.match(html, /Visual state/);
  assert.match(html, /Programmatic state/);
  assert.match(html, /abort transport · cancel frame · reject late event · release request · focus composer/);
  assert.match(html, /v1 · exact keys · ≤200 terminal messages/);
  assert.match(html, /Automated · 11 checks/);
  assert.match(html, /Written specs · 5/);
  assert.match(html, /Hands-on · 3 groups/);
  assert.match(html, /11 executable pure checks · 5 specifications · 3 manual verification groups/);
  assert.match(html, /Run checks \+ review specs/);
  assert.match(html, /browser, assistive-technology, and device behavior still need hands-on testing/);
  assert.match(html, /Run the 11 executable checks, review the 5 specifications that don.t run here/);
  assert.doesNotMatch(html, /Automated · 16 contracts|all 16 check-specific results/);
});

test("LLM Systems home keeps the first-run area neutral until browser progress restores", async () => {
  const response = await render("/courses/llm-systems");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Restoring your place/);
  assert.doesNotMatch(html, /Introductory JavaScript RNN|Train and generate/);
  assert.doesNotMatch(html, /temperature 1\.05 · top-k off|temperature 0\.72 · top-k 5|No output yet/);
  assert.doesNotMatch(html, /environment-readiness|First run · real training|This tiny model|Run the model to generate/);
});

test("every lesson ends with one focused knowledge check and quiet lesson navigation", async () => {
  for (const lessonId of ["character-rnns", "inference-runtime", "streaming-transport", "chat-product-quality"]) {
    const response = await render(`/lessons/${lessonId}`);
    assert.equal(response.status, 200, lessonId);
    const html = await response.text();
    assert.match(html, /<h2 class="sr-only">Knowledge check<\/h2>/, lessonId);
    assert.match(html, /Check answer/, lessonId);
    assert.match(html, /class="paper-footer lesson-footer"/, lessonId);
    assert.doesNotMatch(html, /Quick prediction|Project file|What you built|Open changed file|Prediction still to do/, lessonId);
  }
});

test("all four executable module checkpoints render their exact project boundary", async () => {
  for (const [slug, title] of [
    ["models", "Generate from learned state"],
    ["systems", "Trace one inference request"],
    ["backend", "Stream across the serving boundary"],
    ["product", "Assemble the product state machine"],
  ]) {
    const response = await render(`/checkpoints/${slug}`);
    assert.equal(response.status, 200, slug);
    const html = await response.text();
    assert.match(html, new RegExp(title), slug);
    assert.doesNotMatch(html, />Ready<\/strong>/, slug);
    assert.match(html, /Restoring project/, slug);
    assert.match(html, /Module files/, slug);
    assert.doesNotMatch(html, /Before this module|After this module|Live checkpoint/, slug);
  }
});

test("project route exposes the timeline, local learning data, and recovery language", async () => {
  const response = await render("/project");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Project history/);
  assert.match(html, /My course position/);
  assert.doesNotMatch(html, /Lesson 01|Lesson 07|Lesson 14|Project snapshots/);
  assert.match(html, /Learning data/);
  assert.match(html, /It does not include code, prompts, messages, API keys, or written answers/);
});

test("sources route lists the research, dataset, model, and runtime boundaries", async () => {
  const response = await render("/sources");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Sources<\/h1>/);
  assert.match(html, /Their prose, figures, tutorial code, and datasets are not republished here/);
  assert.match(html, /SmolLM2-135M-Instruct/);
  assert.match(html, /Transformers\.js/);
  assert.match(html, /Apache-2\.0/);
  assert.match(html, /Lesson sources/);
  assert.match(html, /Flash-card reference shelf/);
  assert.match(html, /Mathematics for Machine Learning/);
  assert.match(html, /Decoupled Weight Decay Regularization/);
  assert.match(html, /Character RNNs/);
  assert.match(html, /Product Quality/);
  assert.match(html, /Course-authored synthetic corpus/);
  assert.match(html, /Course-authored synthetic checklist/);
  assert.match(html, /Not separately licensed/);
});
