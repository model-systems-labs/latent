import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let LESSON_ILLUSTRATION_CHANCE_SCALE;
let LESSON_ILLUSTRATION_MIN_USEFULNESS;
let lessonIllustrationDraw;
let lessonIllustrations;
let lessonIllustrationUsefulness;
let lessonPassesIllustrationDraw;
let selectedLessonIllustrationIds;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  const illustrationsModule = await vite.ssrLoadModule(
    "/examples/learning-platform/llm-learning/lessons/lesson-illustrations.ts",
  );
  ({
    LESSON_ILLUSTRATION_CHANCE_SCALE,
    LESSON_ILLUSTRATION_MIN_USEFULNESS,
    lessonIllustrationDraw,
    lessonIllustrations,
    lessonIllustrationUsefulness,
    lessonPassesIllustrationDraw,
    selectedLessonIllustrationIds,
  } = illustrationsModule);
});

after(async () => {
  await vite?.close();
});

const expectedLessonIds = [
  "arrays-and-shapes",
  "vector-operations",
  "dot-products",
  "matrix-multiplication",
  "batches-and-broadcasting",
  "ml-training-data",
  "ml-linear-regression",
  "ml-gradient-descent",
  "ml-binary-classification",
  "ml-neural-networks",
  "agent-loop",
  "tool-contracts",
  "context-selection",
  "permissions-and-sandboxes",
  "state-and-recovery",
  "agent-evaluations",
  "task-orchestration",
  "integrated-harness",
  "character-rnns",
  "neural-language-models",
  "subword-tokenization",
  "additive-attention",
  "transformers",
  "in-context-learning",
  "inference-runtime",
  "streaming-transport",
  "scheduling-memory",
  "reliability-observability",
  "conversation-state",
  "streaming-react",
  "chat-actions-context",
  "chat-product-quality",
].sort();

test("every lesson participates in one reproducible usefulness-weighted draw", () => {
  assert.deepEqual(Object.keys(lessonIllustrationUsefulness).sort(), expectedLessonIds);
  assert.equal(LESSON_ILLUSTRATION_MIN_USEFULNESS, 0.75);
  assert.equal(LESSON_ILLUSTRATION_CHANCE_SCALE, 0.5);

  for (const [lessonId, usefulness] of Object.entries(lessonIllustrationUsefulness)) {
    const draw = lessonIllustrationDraw(lessonId);
    assert.ok(draw >= 0 && draw < 1, `${lessonId} has a unit-interval draw`);
    assert.equal(
      lessonPassesIllustrationDraw(lessonId),
      usefulness >= LESSON_ILLUSTRATION_MIN_USEFULNESS
        && draw < usefulness * LESSON_ILLUSTRATION_CHANCE_SCALE,
      `${lessonId} follows the documented selection rule`,
    );
  }
});

test("only the seeded winners have editorial artwork", () => {
  assert.equal(selectedLessonIllustrationIds.length, 10);
  assert.deepEqual(Object.keys(lessonIllustrations).sort(), [...selectedLessonIllustrationIds].sort());
});

test("selected illustrations are local, compressed, and meaningfully described", async () => {
  const alts = new Set();
  for (const [lessonId, illustration] of Object.entries(lessonIllustrations)) {
    assert.match(illustration.src, /^\/lesson-diagrams\/[a-z0-9-]+\.jpg$/);
    assert.ok(illustration.title.length >= 20, `${lessonId} has a useful title`);
    assert.ok(illustration.caption.length >= 70, `${lessonId} has a useful caption`);
    assert.ok(illustration.alt.length >= 80, `${lessonId} has meaningful alt text`);
    assert.equal(alts.has(illustration.alt), false, `${lessonId} has unique alt text`);
    alts.add(illustration.alt);

    const assetUrl = new URL(`../public${illustration.src}`, import.meta.url);
    const [metadata, bytes] = await Promise.all([stat(assetUrl), readFile(assetUrl)]);
    assert.ok(metadata.size < 600 * 1024, `${lessonId} stays below 600 KiB`);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], `${lessonId} is a JPEG`);
  }
});
