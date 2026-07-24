import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let lessonFlairRegistry;
let llmSystemsManifest;
let vite;

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const paperLabCssUrl = new URL("app/components/PaperLab.module.css", root);

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  const [flairModule, manifestModule] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/lesson-flair.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/manifest.ts"),
  ]);
  lessonFlairRegistry = flairModule.lessonFlairRegistry;
  llmSystemsManifest = manifestModule.llmSystemsManifest;
});

after(async () => {
  await vite?.close();
});

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test("every curriculum lesson has exactly two restrained flair fields", () => {
  const lessonIds = llmSystemsManifest.modules.flatMap((module) => module.lessons.map((lesson) => lesson.lessonId)).sort();
  const flairIds = Object.keys(lessonFlairRegistry).sort();

  assert.deepEqual(flairIds, lessonIds);
  for (const [lessonId, flair] of Object.entries(lessonFlairRegistry)) {
    assert.deepEqual(Object.keys(flair).sort(), ["notation", "tone"], lessonId);
  }
});

test("lesson signatures use unique technical notation within the brand palette", () => {
  const allowedTones = new Set(["plum", "rust", "forest", "blue", "slate"]);
  const signatures = Object.values(lessonFlairRegistry).map((flair) => flair.notation);

  assert.equal(new Set(signatures).size, signatures.length);
  assert.ok(Object.values(lessonFlairRegistry).every((flair) => allowedTones.has(flair.tone)));
  assert.ok(signatures.every((signature) => signature.length > 5));
});

test("flair tones identify course families rather than rotating by lesson", () => {
  const expectedTones = {
    "character-rnns": "plum",
    "neural-language-models": "plum",
    "subword-tokenization": "plum",
    "additive-attention": "plum",
    transformers: "plum",
    "in-context-learning": "plum",
    "inference-runtime": "blue",
    "scheduling-memory": "blue",
    "streaming-transport": "rust",
    "reliability-observability": "rust",
    "conversation-state": "forest",
    "streaming-react": "forest",
    "chat-actions-context": "forest",
    "chat-product-quality": "forest",
  };

  assert.deepEqual(
    Object.fromEntries(Object.entries(lessonFlairRegistry).map(([lessonId, flair]) => [lessonId, flair.tone])),
    expectedTones,
  );
});

test("the restrained course tone stays decorative and does not add lesson-header chrome", async () => {
  const [paperLab, css] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(paperLabCssUrl, "utf8"),
  ]);
  assert.doesNotMatch(paperLab, /lesson-notation|lesson-kicker|hero-record/);
  assert.match(paperLab, /data-flair-tone=\{flair\?\.tone\}/);
  assert.doesNotMatch(`${paperLab}\n${css}`, /<svg|dangerouslySetInnerHTML/i);
  assert.doesNotMatch(css, /lesson-notation|lesson-kicker|hero-record/);
  assert.doesNotMatch(css, /@keyframes|animation:/);

  for (const tone of ["plum", "rust", "forest", "blue", "slate"]) {
    const accent = css.match(new RegExp(`data-flair-tone="${tone}"\\]\\s*\\{\\s*--lesson-accent:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    assert.ok(accent, `${tone} accent is declared`);
    assert.ok(contrast(accent, "#f1eee8") >= 4.5, `${tone} accent clears AA contrast`);
  }
});
