import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createServer } from "vite";

const templateRoot = new URL("../", import.meta.url);
const deckSourceUrl = new URL("../app/components/FlashcardDeck.tsx", import.meta.url);
const deckStylesUrl = new URL("../app/components/FlashcardDeck.module.css", import.meta.url);
const flashcardPageUrl = new URL("../app/flashcards/page.tsx", import.meta.url);
const flashcardPageStylesUrl = new URL("../app/flashcards/page.module.css", import.meta.url);
const learnerHeaderUrl = new URL("../app/components/LearnerHeader.tsx", import.meta.url);
const progressSourceUrl = new URL("../app/lib/flashcard-progress.ts", import.meta.url);
const searchSourceUrl = new URL("../app/lib/flashcard-search.ts", import.meta.url);
const transportSourceUrl = new URL("../app/content/flashcard-transport.ts", import.meta.url);
const coursePageUrl = new URL("../app/course/page.tsx", import.meta.url);
const responsiveStylesUrl = new URL("../app/styles/responsive.css", import.meta.url);
const flashcardLibraryDirectoryUrl = new URL("../app/content/flashcard-library/", import.meta.url);
const flashcardLibraryUrls = (await readdir(flashcardLibraryDirectoryUrl, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry) => new URL(entry.name, flashcardLibraryDirectoryUrl));
const flashcardContentUrls = [
  deckSourceUrl,
  deckStylesUrl,
  progressSourceUrl,
  searchSourceUrl,
  transportSourceUrl,
  new URL("../app/content/flashcard-schema.ts", import.meta.url),
  new URL("../app/content/flashcards.ts", import.meta.url),
  ...flashcardLibraryUrls,
  flashcardPageUrl,
  flashcardPageStylesUrl,
];

let content;
let course;
let progress;
let search;
let vite;

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("flashcards-test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

before(async () => {
  vite = await createServer({
    root: fileURLToPath(templateRoot),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [content, course, progress, search] = await Promise.all([
    vite.ssrLoadModule("/app/content/flashcards.ts"),
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/lib/flashcard-progress.ts"),
    vite.ssrLoadModule("/app/lib/flashcard-search.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("the library has 638 unique, concept-keyed cards across all seven subjects", () => {
  const { flashcardLibrary, flashcards, flashcardSubjects } = content;
  const expectedSubjects = [
    "linear-algebra",
    "machine-learning-basics",
    "model-foundations",
    "inference-runtime",
    "llm-serving",
    "chat-integration",
    "harness-engineering",
  ];

  assert.equal(flashcardSubjects.length, 7);
  assert.deepEqual(flashcardSubjects.map((subject) => subject.id), expectedSubjects);
  assert.equal(new Set(flashcardSubjects.map((subject) => subject.id)).size, 7);
  assert.ok(flashcardSubjects.every((subject) => subject.label && subject.shortLabel && subject.description));

  assert.equal(flashcards.length, 638);
  assert.equal(Object.keys(flashcardLibrary).length, 638);
  assert.equal(new Set(flashcards.map((card) => card.id)).size, 638);
  assert.equal(new Set(flashcards.map((card) => card.concept)).size, 638);
  assert.equal(
    new Set(flashcards.map((card) => search.normalizeFlashcardSearchQuery(card.concept))).size,
    638,
    "concepts must remain unique under the actual search normalizer",
  );
  for (const card of flashcards) {
    assert.match(card.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, card.concept);
    assert.equal(expectedSubjects.includes(card.subjectId), true, card.concept);
    assert.deepEqual(flashcardLibrary[card.concept], {
      subjectId: card.subjectId,
      module: card.module,
      lesson: card.lesson,
      ...(card.source ? { source: card.source } : {}),
      definition: card.definition,
      details: card.details,
      example: card.example,
    });
  }

  const lessons = new Map();
  for (const card of flashcards) {
    const key = `${card.subjectId}:${card.module}:${card.lesson}`;
    lessons.set(key, (lessons.get(key) ?? 0) + 1);
  }
  assert.ok(lessons.size >= 25, "the vocabulary must remain mapped to specific course and paper topics");
  assert.ok([...lessons.values()].every((count) => count >= 2));
  assert.deepEqual(
    Object.fromEntries(expectedSubjects.map((subjectId) => [
      subjectId,
      flashcards.filter((card) => card.subjectId === subjectId).length,
    ])),
    {
      "linear-algebra": 80,
      "machine-learning-basics": 123,
      "model-foundations": 150,
      "inference-runtime": 36,
      "llm-serving": 39,
      "chat-integration": 58,
      "harness-engineering": 152,
    },
  );
});

test("Harness Engineering has at least fifteen source-grounded cards for every new lesson", () => {
  const harnessCards = content.flashcards.filter((card) => card.subjectId === "harness-engineering");
  const lessonTitles = [
    "Agent Loop",
    "Tool Contracts",
    "Context Selection",
    "Permissions and Sandboxes",
    "State and Recovery",
    "Agent Evaluations",
    "Task Orchestration",
    "Integrated Harness",
  ];
  const sourceSignals = {
    "Agent Loop": ["ReAct", "Harness engineering"],
    "Tool Contracts": ["Model Context Protocol", "Tools specification"],
    "Context Selection": ["AGENTS.md", "Context Selection"],
    "Permissions and Sandboxes": ["Sandboxing", "CWE-367"],
    "State and Recovery": ["Checkpointing", "synthetic event logs"],
    "Agent Evaluations": ["SWE-bench", "Inspect metrics"],
    "Task Orchestration": ["Building effective agents", "orchestration fixtures"],
    "Integrated Harness": ["Harness engineering", "integrated harness"],
  };

  assert.equal(harnessCards.length, 152);
  assert.deepEqual([...new Set(harnessCards.map((card) => card.lesson))], lessonTitles);
  for (const lesson of lessonTitles) {
    const lessonCards = harnessCards.filter((card) => card.lesson === lesson);
    assert.ok(lessonCards.length >= 15, `${lesson}: ${lessonCards.length} cards`);
    const lessonSourceTrail = lessonCards.map((card) => card.source).join("; ");
    for (const signal of sourceSignals[lesson]) {
      assert.match(lessonSourceTrail, new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${lesson}: ${signal}`);
    }
  }
});

test("every routed course lesson has exact-title flash-card coverage", () => {
  const coveredLessons = new Set(content.flashcards.map((card) => card.lesson));
  const routedLessons = course.coursePrograms.flatMap((program) => program.lessons.map((lesson) => lesson.title));
  assert.deepEqual(routedLessons.filter((lesson) => !coveredLessons.has(lesson)), []);
});

test("every answer carries a definition, multiple teaching details, and a concrete example", () => {
  let sourcedCards = 0;
  const definitions = new Set();
  const examples = new Set();
  for (const card of content.flashcards) {
    assert.ok(card.module.trim().length >= 3, `${card.concept}: module`);
    assert.ok(card.lesson.trim().length >= 3, `${card.concept}: lesson`);
    assert.ok(card.definition.trim().length >= 40, `${card.concept}: definition`);
    assert.equal(definitions.has(card.definition), false, `${card.concept}: repeated definition`);
    definitions.add(card.definition);
    assert.ok(Array.isArray(card.details), `${card.concept}: details`);
    assert.equal(card.details.length, 3, `${card.concept}: detail count`);
    assert.equal(new Set(card.details).size, card.details.length, `${card.concept}: unique details`);
    assert.ok(card.details.every((detail) => detail.trim().length >= 20), `${card.concept}: useful details`);
    assert.ok(card.example.trim().length >= 20, `${card.concept}: example`);
    assert.equal(examples.has(card.example), false, `${card.concept}: repeated example`);
    examples.add(card.example);
    const teachingText = [card.definition, ...card.details, card.example].join(" ");
    assert.ok(teachingText.length <= 850, `${card.concept}: answer is too dense for a flash card`);
    assert.ok(teachingText.trim().split(/\s+/).length <= 130, `${card.concept}: answer exceeds 130 teaching words`);
    if (card.source) {
      sourcedCards += 1;
      assert.ok(card.source.trim().length >= 10, `${card.concept}: source trail`);
      assert.ok(card.source.length <= 300, `${card.concept}: source trail is too long`);
    }
  }
  assert.equal(sourcedCards, content.flashcards.length, "every card needs a visible source trail");
});

test("the deck includes the essential paper vocabulary as atomic concepts", () => {
  const concepts = new Set(content.flashcards.map((card) => card.concept));
  const requiredConcepts = [
    "Scalar",
    "Hadamard product",
    "Linear independence",
    "Pseudoinverse",
    "Eigendecomposition",
    "Positive semidefinite matrix",
    "IID assumption",
    "Empirical risk",
    "Inductive bias",
    "Backpropagation",
    "Cell state",
    "Constant error carousel",
    "Curse of dimensionality",
    "Continuous Bag-of-Words (CBOW)",
    "Skip-gram",
    "Noise-contrastive estimation",
    "Hierarchical softmax",
    "Huffman tree",
    "Distributed word representation",
    "Morphology",
    "Unigram language-model tokenization",
    "Fixed-length bottleneck",
    "Scaled dot-product attention",
    "Monotonic local attention (local-m)",
    "Predictive local attention (local-p)",
    "Input feeding",
    "Decoder-only Transformer",
    "Generative pretraining",
    "Supervised fine-tuning",
    "Task-aware input transformation",
    "Auxiliary language-model objective",
    "Benchmark contamination",
    "Random-label demonstrations",
    "Ground-truth label mapping",
    "Function class",
    "Prompt distribution",
    "Minimum-norm least squares",
    "Lasso baseline",
    "Nucleus sampling",
    "Trustworthy prediction zone",
    "Zipf distribution",
    "Self-BLEU",
    "HUSE evaluation",
    "Unreliable probability tail",
    "Grouped-query attention (GQA)",
    "KV-cache fragmentation",
    "Copy-on-write KV blocks",
    "Iteration-level scheduling",
    "Chunked prefill",
    "SSE retry field",
    "Stream backpressure",
    "Four golden signals",
    "Error budget",
    "Span context propagation",
    "OpenTelemetry span",
    "Trace sampling",
    "Structural sharing",
    "Frame coalescing",
    "Atomic turn",
    "Fail-closed validation",
    "Interaction to Next Paint (INP)",
    "Agent loop",
    "Response-form invariant",
    "Tool output schema",
    "Protocol identity under compaction",
    "TOCTOU race",
    "External side-effect ambiguity",
    "pass@k (at least one success)",
    "pass^k (all successes)",
    "Orchestrator-worker pattern",
    "Protocol audit",
    "Random variable",
    "Probability distribution",
    "Expected value",
    "Variance",
    "Standard deviation",
    "Joint distribution",
    "Marginal distribution",
    "Conditional probability",
    "Bayes’ rule",
    "Statistical independence",
    "Entropy",
    "Cross-entropy",
    "KL divergence",
    "Mutual information",
    "Total derivative",
    "Directional derivative",
    "Jacobian",
    "Hessian",
    "L1 regularization",
    "L2 regularization",
    "Weight decay",
    "Dropout",
    "Early stopping",
    "Probability calibration",
    "F1 score",
    "Specificity",
    "ROC curve",
    "Precision-recall curve",
    "ROC-AUC",
    "Standard error",
    "Confidence interval",
    "Bootstrap resampling",
    "Wall-clock time budget",
    "Workflow–agent control distinction",
    "Augmented LLM",
    "Tool-call timeout",
    "MCP structuredContent field",
    "MCP error-channel distinction",
    "Tool annotations",
    "Rate limiting",
    "Output sanitization",
    "Agent-computer interface (ACI)",
    "Poka-yoke",
    "Agent legibility",
    "Repository knowledge as system of record",
    "Doc gardening",
    "Knowledge drift",
    "Direct prompt injection (OWASP taxonomy)",
    "Indirect prompt injection",
    "Tool-output injection",
    "Data exfiltration",
    "Least privilege",
    "Execution plan",
    "Structural test",
    "Feedback-loop design",
    "Prompt chaining",
    "Routing workflow",
    "Sectioning",
    "Voting",
    "Evaluator-optimizer",
    "Human-attention bottleneck",
    "Mechanically enforced architectural invariant",
    "Golden principle",
    "Repository garbage collection",
  ];
  assert.deepEqual(requiredConcepts.filter((concept) => !concepts.has(concept)), []);
  assert.equal(
    content.flashcards.some((card) => JSON.stringify(card).includes("Air Canada")),
    false,
    "the reviewed word2vec source example must not reappear",
  );
});

test("search ranks concept matches before topic and answer matches", () => {
  const eigenvalueResults = search.rankFlashcardSearchResults(content.flashcards, "eigenvalue");
  const softmaxResults = search.rankFlashcardSearchResults(content.flashcards, "softmax");
  const attentionResults = search.rankFlashcardSearchResults(content.flashcards, "attention");

  assert.equal(eigenvalueResults[0].concept, "Eigenvalue");
  assert.equal(softmaxResults[0].concept, "Softmax");
  assert.equal(attentionResults[0].concept, "Attention context vector");
  assert.ok(
    attentionResults.slice(0, 17).every((card) => card.concept.toLowerCase().includes("attention")),
    "concept matches should stay ahead of answer-only matches",
  );
  assert.ok(eigenvalueResults.length > 1, "search should still include related answer matches");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "self bleu")[0].concept, "Self-BLEU");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "paged attention")[0].concept, "PagedAttention");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "few shot")[0].concept, "Zero-, one-, and few-shot evaluation");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "cross entropy")[0].concept, "Cross-entropy");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "toctou")[0].concept, "TOCTOU race");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "pass at k")[0].concept, "pass@k (at least one success)");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "pass to the k")[0].concept, "pass^k (all successes)");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "all successes")[0].concept, "pass^k (all successes)");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "orchestrator worker")[0].concept, "Orchestrator-worker pattern");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "bayes rule")[0].concept, "Bayes’ rule");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "structured content")[0].concept, "MCP structuredContent field");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "direct prompt injection")[0].concept, "Direct prompt injection (OWASP taxonomy)");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "indirect prompt injection")[0].concept, "Indirect prompt injection");
  assert.equal(search.rankFlashcardSearchResults(content.flashcards, "agent legibility")[0].concept, "Agent legibility");
  assert.ok(search.rankFlashcardSearchResults(content.flashcards, "word2 vec").length > 0);
  assert.deepEqual(search.rankFlashcardSearchResults(content.flashcards, "  "), content.flashcards);
  assert.deepEqual(search.rankFlashcardSearchResults(content.flashcards, "---"), content.flashcards);
});

test("compact server transport round-trips every card while removing repeated lesson context", async () => {
  const transport = await vite.ssrLoadModule("/app/content/flashcard-transport.ts");
  const deck = transport.compactFlashcardDeck(content.flashcards);
  assert.deepEqual(transport.expandFlashcardDeck(deck), content.flashcards);
  assert.equal(deck[1].length, 638);
  assert.ok(deck[0].length < 65, `shared contexts: ${deck[0].length}`);

  const expandedBytes = Buffer.byteLength(JSON.stringify(content.flashcards));
  const compactBytes = Buffer.byteLength(JSON.stringify(deck));
  assert.ok(compactBytes < expandedBytes * 0.75, `${compactBytes} compact bytes vs ${expandedBytes} expanded bytes`);
});

test("progress is revisioned, migrates safely, and applies concurrent mutations without stale snapshots", () => {
  const [first, second] = content.flashcards;
  const validCardIds = new Set([first.id, second.id]);
  const stored = {
    version: 1,
    results: {
      [first.id]: { successes: 2, failures: 1, lastResult: "success", updatedAt: 10 },
      unknown: { successes: 9, failures: 9, lastResult: "failure", updatedAt: 11 },
      [second.id]: { successes: -1, failures: 0, lastResult: "success", updatedAt: 12 },
    },
  };

  const sanitized = progress.sanitizeFlashcardProgress(stored, validCardIds);
  assert.deepEqual(sanitized, {
    version: 2,
    revision: 0,
    epoch: 0,
    results: {
      [first.id]: {
        successes: 2,
        failures: 1,
        lastResult: "success",
        updatedAt: 10,
        mutationId: `legacy:${first.id}:10:2:1:success`,
      },
    },
  });
  assert.notEqual(sanitized.results[first.id], stored.results[first.id]);
  assert.deepEqual(progress.sanitizeFlashcardProgress(null), {
    version: 2,
    revision: 0,
    epoch: 0,
    results: {},
  });
  assert.deepEqual(progress.sanitizeFlashcardProgress({ version: 3, results: stored.results }), {
    version: 2,
    revision: 0,
    epoch: 0,
    results: {},
  });
  assert.deepEqual(stored.results[first.id], { successes: 2, failures: 1, lastResult: "success", updatedAt: 10 });

  const empty = { version: 2, revision: 0, epoch: 0, results: {} };
  const success = progress.recordFlashcardResult(empty, first.id, "success", 20, "mark-a");
  const failure = progress.recordFlashcardResult(success, first.id, "failure", 30, "mark-b");
  const secondSuccess = progress.recordFlashcardResult(failure, first.id, "success", 40, "mark-c");

  assert.deepEqual(empty, { version: 2, revision: 0, epoch: 0, results: {} });
  assert.deepEqual(success.results[first.id], {
    successes: 1,
    failures: 0,
    lastResult: "success",
    updatedAt: 20,
    mutationId: "mark-a",
  });
  assert.deepEqual(failure.results[first.id], {
    successes: 1,
    failures: 1,
    lastResult: "failure",
    updatedAt: 30,
    mutationId: "mark-b",
  });
  assert.deepEqual(secondSuccess.results[first.id], {
    successes: 2,
    failures: 1,
    lastResult: "success",
    updatedAt: 40,
    mutationId: "mark-c",
  });
  assert.equal(success.results[first.id].failures, 0, "later records must not mutate earlier progress");
  assert.deepEqual(success.results, { [first.id]: success.results[first.id] }, "merging must not mutate either input");

  const firstMutation = progress.applyFlashcardResultMutation(empty, {
    cardId: first.id,
    result: "success",
    updatedAt: 50,
    mutationId: "tab-a",
    expectedEpoch: 0,
  });
  const secondMutation = progress.applyFlashcardResultMutation(firstMutation.progress, {
    cardId: first.id,
    result: "failure",
    updatedAt: 50,
    mutationId: "tab-b",
    expectedEpoch: 0,
  });
  assert.equal(secondMutation.progress.results[first.id].successes, 1);
  assert.equal(secondMutation.progress.results[first.id].failures, 1);
  assert.equal(secondMutation.progress.results[first.id].mutationId, "tab-b");

  const independentMutation = progress.applyFlashcardResultMutation(secondMutation.progress, {
    cardId: second.id,
    result: "success",
    updatedAt: 50,
    mutationId: "tab-c",
    expectedEpoch: 0,
  });
  assert.deepEqual(Object.keys(independentMutation.progress.results).sort(), [first.id, second.id].sort());
  const staleUndo = progress.applyFlashcardUndoMutation(independentMutation.progress, firstMutation.receipt);
  assert.equal(staleUndo.applied, false, "a newer same-card mutation must defeat a stale undo");

  const cleared = progress.applyFlashcardClearMutation(independentMutation.progress).progress;
  assert.equal(cleared.epoch, 1);
  assert.deepEqual(cleared.results, {});
  const staleRating = progress.applyFlashcardResultMutation(cleared, {
    cardId: first.id,
    result: "success",
    updatedAt: 60,
    mutationId: "stale-tab",
    expectedEpoch: 0,
  });
  assert.equal(staleRating.applied, false);
  assert.deepEqual(staleRating.progress.results, {}, "a stale tab must not repopulate cleared results");
  assert.equal(progress.applyFlashcardUndoMutation(cleared, secondMutation.receipt).applied, false);

  const olderView = { ...cleared, revision: cleared.revision - 1 };
  assert.equal(
    progress.chooseNewestFlashcardProgress(olderView, cleared),
    cleared,
    "an older awaited snapshot must not replace newer live progress",
  );
  assert.equal(
    progress.chooseNewestFlashcardProgress(cleared, olderView),
    cleared,
    "the newest transaction result should still be applied",
  );
  assert.equal(
    progress.flashcardResultRecordMatches(secondMutation.progress.results[first.id], secondMutation.receipt.written),
    true,
  );
  assert.equal(progress.flashcardResultRecordMatches(undefined, null), true);
  assert.equal(progress.flashcardResultRecordMatches(secondMutation.progress.results[first.id], null), false);
});

test("the built flash-card route is newer than every flash-card source", async () => {
  const [built, ...sources] = await Promise.all([
    stat(new URL("../dist/server/index.js", import.meta.url)),
    ...flashcardContentUrls.map((url) => stat(url)),
  ]);
  assert.ok(
    built.mtimeMs >= Math.max(...sources.map((source) => source.mtimeMs)),
    "run the web build before testing the flash-card route",
  );
});

test("the built flash-card route renders an accessible unrevealed study deck", async () => {
  const response = await render("/flashcards");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Make the ideas stick/);
  assert.match(html, /Review library · (?:<!-- -->)?638(?:<!-- -->)? cards/);
  assert.match(html, /href="\/course">Courses/);
  assert.match(html, /href="\/flashcards" aria-current="page">Cards/);
  assert.match(html, /aria-label="Study progress"/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-label="Cards reviewed in selected subjects"/);
  assert.match(html, /aria-valuetext="0 of 638 cards reviewed; 0 got it, 0 need work\."/);
  assert.match(html, /<legend>Subjects<\/legend>/);
  assert.match(html, /<legend>Card status<\/legend>/);
  assert.match(html, /<input[^>]+type="search"[^>]+placeholder="Concept, lesson, or term"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="answer-[a-z0-9-]+"/);
  assert.match(html, /Show answer/);
  assert.match(html, /Mix deck/);
  assert.doesNotMatch(html, /aria-label="Rate [^"]+"/);
  assert.doesNotMatch(html, /Hide answer/);
});

test("hundreds of rich cards use a small HTML shell and a cacheable mobile-friendly library asset", async () => {
  const response = await render("/flashcards");
  assert.equal(response.status, 200);
  const html = await response.text();
  const htmlBytes = Buffer.from(html);

  const compressedHtmlBytes = gzipSync(htmlBytes).byteLength;
  assert.ok(htmlBytes.byteLength < 25_000, `raw route payload: ${htmlBytes.byteLength} bytes`);
  assert.ok(compressedHtmlBytes < 7_000, `compressed route payload: ${compressedHtmlBytes} bytes`);

  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const assets = await readdir(assetsUrl);
  const deckAsset = assets.find((name) => /^FlashcardDeck-[\w-]+\.js$/.test(name));
  assert.ok(deckAsset, "expected one built FlashcardDeck client asset");
  const deckBytes = await readFile(new URL(deckAsset, assetsUrl));
  const compressedDeckBytes = gzipSync(deckBytes).byteLength;
  assert.ok(compressedDeckBytes < 135_000, `compressed cacheable deck asset: ${compressedDeckBytes} bytes`);
  assert.ok(
    compressedHtmlBytes + compressedDeckBytes < 140_000,
    `compressed first-load flash-card surface: ${compressedHtmlBytes + compressedDeckBytes} bytes`,
  );
});

test("subject and status toggles, reveal, live feedback, and rating controls retain their accessible source contract", async () => {
  const [source, pageSource, progressSource, searchSource] = await Promise.all([
    readFile(deckSourceUrl, "utf8"),
    readFile(flashcardPageUrl, "utf8"),
    readFile(progressSourceUrl, "utf8"),
    readFile(searchSourceUrl, "utf8"),
  ]);
  const answerToggleSource = source.slice(
    source.indexOf("className={styles.answerToggle}"),
    source.indexOf("</button>", source.indexOf("className={styles.answerToggle}")),
  );
  assert.match(source, /<legend>Subjects<\/legend>[\s\S]*?aria-pressed=\{allSubjectsActive\}/);
  assert.match(source, /flashcards,[\s\S]*?flashcardSubjects,[\s\S]*?from "\.\.\/content\/flashcards"/);
  assert.match(pageSource, /<FlashcardDeck \/>/);
  assert.doesNotMatch(pageSource, /compactFlashcardDeck|deck=\{/);
  assert.match(source, /type="search"[\s\S]*?value=\{query\}[\s\S]*?searchConcepts/);
  assert.match(source, /rankFlashcardSearchResults\(subjectCards, normalizedQuery\)/);
  assert.match(source, /className=\{styles\.filterToggle\}[\s\S]*?aria-expanded=\{filtersOpen\}[\s\S]*?aria-controls="flashcard-filters"/);
  assert.match(source, /subjects\.map[\s\S]*?aria-pressed=\{active\}/);
  assert.match(source, /const allSubjectsActive = activeSubjects\.length === subjects\.length/);
  assert.match(source, /const active = !allSubjectsActive && activeSubjectSet\.has\(subject\.id\)/);
  assert.match(source, /onlyActiveSubject\?\.label \?\? `\$\{activeSubjects\.length\} of \$\{subjects\.length\} subjects`/);
  assert.match(source, /<legend>Card status<\/legend>[\s\S]*?statusFilters\.map[\s\S]*?aria-pressed=\{statusFilter === filter\.id\}/);
  assert.match(source, /aria-controls=\{`answer-\$\{currentCard\.id\}`\}/);
  assert.match(source, /id=\{`answer-\$\{currentCard\.id\}`\}/);
  assert.match(source, /function sourceIndexHref\(subjectId: FlashcardSubjectId\)/);
  assert.match(source, /<cite>\{currentCard\.source\}<\/cite>/);
  assert.match(source, /Browse further reading/);
  assert.match(source, /ref=\{cardFrontRef\}[\s\S]*?className=\{styles\.answerToggle\}/);
  assert.match(source, /className=\{styles\.cardBack\}[\s\S]*?id=\{`answer-\$\{currentCard\.id\}`\}[\s\S]*?hidden=\{!revealed\}/);
  assert.match(source, /className=\{styles\.answerToggle\}[\s\S]*?aria-expanded=\{revealed\}[\s\S]*?aria-controls=\{`answer-\$\{currentCard\.id\}`\}/);
  assert.match(source, /ref=\{answerHeadingRef\} tabIndex=\{-1\}/);
  assert.match(source, /ref=\{emptyHeadingRef\} tabIndex=\{-1\}/);
  assert.match(source, /ref=\{clearSectionRef\}[\s\S]*?tabIndex=\{-1\}/);
  assert.match(source, /aria-live="polite" aria-atomic="true"/);
  assert.match(source, /\{revealed \? \([\s\S]*?className=\{styles\.ratingActions\}/);
  assert.match(source, /markCard\("failure"\)/);
  assert.match(source, /markCard\("success"\)/);
  assert.match(source, /useState<CardStatusFilter>\("new"\)/);
  assert.match(source, /startingSearch && statusFilter === "new"[\s\S]*?setStatusFilter\("all"\)/);
  assert.match(source, /subjectCards\.length > 0[\s\S]*?role: "progressbar"[\s\S]*?"aria-hidden": true/);
  assert.match(source, /"aria-valuetext": `\$\{reviewedCount\} of \$\{subjectCards\.length\} cards reviewed/);
  assert.match(source, /subscribeFlashcardProgress\(/);
  assert.match(source, /chooseNewestFlashcardProgress\([\s\S]*?outcome\.value\.progress,[\s\S]*?progressRef\.current/);
  assert.match(source, /flashcardResultRecordMatches\([\s\S]*?outcomeReceipt\.written/);
  assert.match(source, /flashcardResultRecordMatches\([\s\S]*?mark\.receipt\.previous/);
  assert.match(source, /newerProgressWasKept = nextProgress\.revision > outcome\.value\.progress\.revision/);
  assert.match(source, /expectedEpoch: progress\.epoch/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /aria-busy=\{mutationPending \|\| storageStatus === "loading"\}/);
  assert.match(source, /externalProgressPendingRef\.current = !initial/);
  assert.match(source, /visibleCards\.findIndex\(\(card\) => card\.id === previousCardId\)/);
  assert.match(source, /currentPositionRef\.current % visibleCards\.length/);
  assert.match(source, /const nextVisibleCards = orderCards\([\s\S]*?cardMatchesStatus/);
  assert.match(source, /currentPosition % nextVisibleCards\.length/);
  assert.match(source, /const mixCards = \(\) =>[\s\S]*?setMixSeed[\s\S]*?cards mixed into a new order/);
  assert.match(source, />\s*<span aria-hidden="true">↝<\/span> Mix deck\s*<\/button>/);
  assert.match(source, /prefers-reduced-motion[\s\S]*?deckRef\.current\?\.scrollIntoView/);
  assert.match(source, /className=\{styles\.definition\}[\s\S]*?className=\{styles\.keyPointsLabel\}[\s\S]*?<ol>[\s\S]*?className=\{styles\.example\}[\s\S]*?className=\{styles\.sourceTrail\}/);
  assert.match(source, /disabled=\{mutationPending \|\| storageStatus === "loading"\}/);
  assert.match(source, /disabled=\{mutationPending \|\| \(storageStatus === "loading" && filter\.id !== "all"\)\}/);
  assert.match(source, /lastAnnouncedQueryRef\.current === normalizedQuery/);
  assert.doesNotMatch(source, /interactedBeforeLoad/);
  assert.match(source, /className=\{styles\.markReceipt\}[\s\S]*?Undo/);
  assert.match(source, /Undo last mark/);
  assert.doesNotMatch(answerToggleSource, /setLastMark/);
  assert.match(source, /role="group" aria-label="Confirm resetting flash card progress"/);
  assert.match(source, /disabled=\{mutationPending \|\| totalReviewedCount === 0\}/);
  assert.match(source, /pendingFocusRef\.current = "clear-section"/);
  assert.match(progressSource, /await writeTail;[\s\S]*?getPersistenceContext/);
  assert.match(progressSource, /database\.transaction\("rw", database\.settings/);
  assert.match(progressSource, /expectedEpoch/);
  assert.match(progressSource, /mutationId/);
  assert.match(progressSource, /applyFlashcardResultMutation\(stored, input\)/);
  assert.match(progressSource, /applyFlashcardUndoMutation\(stored, receipt\)/);
  assert.match(progressSource, /clearFlashcardProgress/);
  assert.match(progressSource, /applyFlashcardClearMutation/);
  assert.match(progressSource, /liveQuery/);
  assert.match(progressSource, /writeTail = result\.then\(\(\) => undefined\)/);
  assert.doesNotMatch(progressSource, /saveFlashcardProgress/);
  assert.match(searchSource, /normalize\("NFKD"\)[\s\S]*?field\.compact/);
});

test("flash-card controls keep 44px targets and mobile, safe-area, and reduced-motion rules", async () => {
  const [deckStyles, pageStyles, responsiveStyles] = await Promise.all([
    readFile(deckStylesUrl, "utf8"),
    readFile(flashcardPageStylesUrl, "utf8"),
    readFile(responsiveStylesUrl, "utf8"),
  ]);

  assert.match(cssRule(deckStyles, ".filterScroller button"), /min-height:\s*2\.75rem/);
  assert.match(cssRule(deckStyles, ".conceptSearch input"), /min-height:\s*2\.75rem/);
  assert.match(deckStyles, /\.filterToggle \{[\s\S]*?min-height:\s*3\.25rem/);
  assert.match(cssRule(deckStyles, ".cardFront"), /min-height:\s*clamp\(20rem, 44vh, 25rem\)/);
  assert.match(cssRule(deckStyles, ".cardFront h3,\n.cardBack h3"), /overflow-wrap:\s*anywhere/);
  assert.match(cssRule(deckStyles, ".cardBack > header > div"), /min-width:\s*0/);
  assert.match(cssRule(deckStyles, ".ratingActions button"), /min-height:\s*3\.25rem/);
  assert.match(cssRule(deckStyles, ".cardBack header button,\n.deckHeader button,\n.cardNavigation button,\n.clearSection button"), /min-height:\s*2\.75rem/);
  assert.match(cssRule(deckStyles, ".emptyState button"), /min-height:\s*2\.75rem/);

  assert.match(deckStyles, /@media \(max-width: 959px\)[\s\S]*?overflow-x:\s*auto/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?\.storageNotice\s*\{[^}]*display:\s*block/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?\.ratingActions\s*\{[^}]*position:\s*sticky/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?\.subjectScroller\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 8\.5rem\), 1fr\)\)/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?\.subjectScroller button\s*\{[^}]*white-space:\s*normal/);
  assert.match(cssRule(deckStyles, ".cardBack > header"), /flex-wrap:\s*wrap/);
  assert.match(cssRule(deckStyles, ".cardBack li"), /overflow-wrap:\s*anywhere/);
  assert.match(cssRule(deckStyles, ".ratingActions"), /repeat\(auto-fit, minmax\(min\(100%, 7\.5rem\), 1fr\)\)/);
  assert.match(cssRule(deckStyles, ".ratingActions button"), /min-width:\s*0/);
  assert.match(cssRule(deckStyles, ".sourceTrail a"), /min-height:\s*2\.75rem/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?\.cardNavigation > span\s*\{[^}]*display:\s*none/);
  assert.match(deckStyles, /@media \(max-width: 650px\)[\s\S]*?\.cardNavigation button:last-child\s*\{[^}]*grid-column:\s*2/);
  assert.match(deckStyles, /@media \(max-width: 940px\) and \(max-height: 500px\)/);
  assert.match(deckStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition:\s*none/);
  assert.match(deckStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.markReceipt/);
  assert.match(deckStyles, /@media \(min-width: 960px\)[\s\S]*?grid-template-columns:\s*minmax\(17rem, 0\.72fr\) minmax\(0, 1\.55fr\)/);
  assert.match(cssRule(deckStyles, ".answerToggle[data-revealed=\"false\"]"), /inset:\s*0/);
  assert.match(cssRule(deckStyles, ".markReceipt button"), /min-height:\s*2\.75rem/);
  assert.match(cssRule(deckStyles, ".stats dt"), /12px/);
  assert.match(deckStyles, /\.card\[data-subject="chat-integration"\][^{]*\{[^}]*--card-accent:\s*#486750/);
  assert.match(deckStyles, /\.card\[data-subject="harness-engineering"\][^{]*\{[^}]*--card-accent:\s*#85643c/);
  assert.match(pageStyles, /@media \(max-width: 650px\)[\s\S]*?padding:\s*0\.7rem 0 0\.65rem/);
  assert.match(pageStyles, /@media \(max-width: 430px\) and \(max-height: 700px\)[\s\S]*?clip-path:\s*inset\(50%\)/);
  assert.match(cssRule(pageStyles, ".header > a"), /min-height:\s*2\.75rem/);
  assert.doesNotMatch(responsiveStyles, /\.site-header nav\.course-primary-nav\s*\{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
});

test("course navigation links to the flash-card section", async () => {
  const [source, learnerHeader] = await Promise.all([
    readFile(coursePageUrl, "utf8"),
    readFile(learnerHeaderUrl, "utf8"),
  ]);
  assert.match(source, /<LearnerHeader current="courses" \/>/);
  assert.match(learnerHeader, /\{ id: "cards", href: "\/flashcards", label: "Cards" \}/);
  assert.match(source, /className=\{styles\.reviewCallout\} href="\/flashcards"/);

  const response = await render("/course");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="\/flashcards">Cards<\/a>/);
  assert.match(html, /Review library/);
  assert.match(html, /Study flash cards/);
});
