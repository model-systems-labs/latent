import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { lessonFlairRegistry } from "../app/lessons/lesson-flair.ts";
import { llmSystemsManifest } from "../app/content/llm-systems/manifest.ts";

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const paperLabCssUrl = new URL("app/components/PaperLab.module.css", root);

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`, "s"))?.[0] ?? "";
}

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

test("the flair stays decorative, full-width, unboxed, and mobile-safe", async () => {
  const [paperLab, css] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(paperLabCssUrl, "utf8"),
  ]);
  const kickerRule = rule(css, ".lessonShell :global(.lesson-kicker)");

  assert.match(paperLab, /className="lesson-notation" aria-hidden="true"/);
  assert.match(paperLab, /data-flair-tone=\{flair\?\.tone\}/);
  assert.doesNotMatch(`${paperLab}\n${css}`, /<svg|dangerouslySetInnerHTML/i);
  assert.match(kickerRule, /width:\s*100%/);
  assert.doesNotMatch(kickerRule, /background:|border:|border-radius:|box-shadow:/);
  assert.match(css, /\.lessonShell :global\(\.lesson-notation\)\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.doesNotMatch(css, /@keyframes|animation:/);

  for (const tone of ["plum", "rust", "forest", "blue", "slate"]) {
    const accent = css.match(new RegExp(`data-flair-tone="${tone}"\\]\\s*\\{\\s*--lesson-accent:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    assert.ok(accent, `${tone} accent is declared`);
    assert.ok(contrast(accent, "#f1eee8") >= 4.5, `${tone} accent clears AA contrast`);
  }
});
