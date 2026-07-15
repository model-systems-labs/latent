import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const tokensUrl = new URL("app/styles/tokens.css", root);
const learningFlowUrl = new URL("app/styles/learning-flow.css", root);
const codingWorkspaceUrl = new URL("app/styles/coding-workspace.css", root);
const responsiveUrl = new URL("app/styles/responsive.css", root);
const selectionAskUrl = new URL("app/components/SelectionAsk.tsx", root);
const selectionAskCssUrl = new URL("app/components/SelectionAsk.module.css", root);

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function cssRules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.trim()),
    declarations: match[2],
  }));
}

function assertTouchTarget(source, selector) {
  const matchingRules = cssRules(source).filter((rule) => rule.selectors.includes(selector));
  assert.ok(matchingRules.length, `Expected a CSS rule for ${selector}`);
  const minimums = matchingRules.flatMap((rule) => (
    [...rule.declarations.matchAll(/min-height:\s*([\d.]+)rem/g)].map((match) => Number(match[1]) * 16)
  ));
  assert.ok(minimums.some((height) => height >= 44), `${selector} must expose a 44px touch-height floor`);
}

async function renderLesson() {
  const workerUrl = new URL("dist/server/index.js", root);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-paper-lab-accessibility`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/lessons/character-rnns", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("selection handoff and practice states expose stable accessible semantics", async () => {
  const [source, selectionAsk] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(selectionAskUrl, "utf8"),
  ]);
  assert.match(source, /data-selection-ask/);
  assert.match(source, /<SelectionAsk lessonTitle=\{lesson\.title\} \/>/);
  assert.doesNotMatch(source, /paper-chat|OpenRouter|paper-question-status/);
  assert.match(selectionAsk, /role="group"/);
  assert.match(selectionAsk, /role="status" aria-live="polite"/);
  assert.match(selectionAsk, /document\.addEventListener\("mouseup", captureSelection\)/);
  assert.match(selectionAsk, /document\.addEventListener\("keyup", captureSelection\)/);
  assert.match(selectionAsk, /document\.addEventListener\("touchend", captureSelection\)/);
  assert.match(selectionAsk, /startRoot !== endRoot/);
  assert.match(selectionAsk, /event\.key !== "Escape"/);
  assert.match(selectionAsk, /window\.addEventListener\("resize", dismissForViewportChange\)/);
  assert.match(selectionAsk, /window\.addEventListener\("scroll", dismissForViewportChange, true\)/);
  assert.match(selectionAsk, /Prompt copied\. Paste it if \$\{providerName\} did not open\./);
  assert.match(selectionAsk, /claude:\/\/claude\.ai\/new\?q=\$\{encoded\}/);
  assert.match(selectionAsk, /codex:\/\/new\?prompt=\$\{encoded\}/);
  assert.match(source, /className="practice-editor" aria-busy=\{!practiceReady \|\| runningBlockIds\.length > 0\}/);
  assert.match(source, /aria-busy=\{runningBlockIds\.includes\(block\.id\)\}/);
  assert.match(source, /className=\{`cell-footer[^`]*`\} role="status"[^>]*aria-live="polite" aria-atomic="true"/);
  assert.match(source, /id=\{`practice-status-\$\{lesson\.id\}`\} role="status" aria-live="polite" aria-atomic="true"/);
});

test("unsafe lesson recovery remains an explicit accessible choice", async () => {
  const [source, learningFlow] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
  ]);
  assert.match(source, /A journal from another tab or an interrupted save differs from the saved lesson\. It was not loaded automatically\./);
  assert.match(source, /loadLearnerRecoveryCandidate\(candidate\.sessionId, lessonId\)/);
  assert.match(source, /discardLearnerRecoveryCandidate\(candidate\.sessionId, lessonId\)/);
  assert.match(source, /"Loading…" : "Load copy"/);
  assert.match(source, />Discard copy<\/button>/);
  assert.match(source, /className="lesson-recovery-status" role="status" aria-live="polite"/);
  assertTouchTarget(learningFlow, ".lesson-recovery-list button");
});

test("server-rendered lessons retain the async status relationships before hydration", async () => {
  const response = await renderLesson();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Highlight a passage to ask Claude or Codex/);
  assert.doesNotMatch(html, /paper-chat|Questions and answers|paper-question-status/);
  assert.match(html, /class="practice-editor" aria-busy="true"/);
  assert.match(html, /class="practice-block [^"]*"[^>]*aria-busy="false"/);
  assert.match(html, /class="cell-footer is-idle" role="status" aria-label="[^\"]+ check status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="practice-status-character-rnns" role="status" aria-live="polite" aria-atomic="true"/);
});

test("technical diagram labels keep an 11px floor and AA text contrast", async () => {
  const [tokens, learningFlow, responsive] = await Promise.all([
    readFile(tokensUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(responsiveUrl, "utf8"),
  ]);
  const start = learningFlow.indexOf(".concept-diagram,\n.fidelity-record {");
  const end = learningFlow.indexOf(".experiment-lab {", start);
  assert.ok(start >= 0 && end > start, "Expected the bounded technical-diagram stylesheet section");
  const diagrams = learningFlow.slice(start, end);
  const undersized = [...diagrams.matchAll(/font-size:\s*0\.([\d]+)rem/g)]
    .map((match) => Number(`0.${match[1]}`))
    .filter((size) => size < 0.68);
  assert.deepEqual(undersized, [], "Technical labels must not regress below the 0.68rem floor");
  assert.ok(
    (diagrams.match(/font-size:\s*max\(0\.68rem, 11px\)/g) ?? []).length >= 60,
    "The floor must cover the complete cross-lesson diagram kit",
  );
  assert.match(responsive, /\.icl-measurement-table\s*\{[^}]*font-size:\s*max\(0\.68rem, 11px\)/);

  const palette = Object.fromEntries(
    [...tokens.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]),
  );
  const foregroundTokens = new Set(
    [...diagrams.matchAll(/color:\s*var\(--([\w-]+)\)/g)].map((match) => match[1]),
  );
  for (const token of foregroundTokens) {
    assert.match(palette[token] ?? "", /^#[0-9a-f]{6}$/i, `${token} must resolve to a reviewable hex color`);
    assert.ok(
      contrastRatio(palette[token], palette.paper) >= 4.5,
      `${token} (${palette[token]}) must clear AA contrast on ${palette.paper}`,
    );
  }
});

test("technical diagrams preserve their native list and table semantics", async () => {
  const source = await readFile(paperLabUrl, "utf8");
  assert.doesNotMatch(source, /role="img"/);
  assert.ok(
    (source.match(/role="group" aria-label=/g) ?? []).length >= 14,
    "each worked mechanism should be named without flattening its descendants into an image",
  );
  assert.match(source, /<table aria-label="Three-token causal attention probability matrix">/);
  assert.match(source, /<table className="icl-measurement-table" aria-label=/);
});

test("selection handoff and coding controls retain 44px touch-height floors", async () => {
  const [selectionAskCss, codingWorkspace] = await Promise.all([
    readFile(selectionAskCssUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
  ]);
  for (const selector of [".toolbar a", ".toolbar button"]) assertTouchTarget(selectionAskCss, selector);
  assert.match(selectionAskCss, /env\(safe-area-inset-bottom\)/);
  for (const selector of [
    ".toolbar-actions button",
    ".toolbar-actions a",
    ".block-actions button",
    ".editor-footer button",
  ]) assertTouchTarget(codingWorkspace, selector);
});

test("visible async status copy remains readable as well as announced", async () => {
  const [tokens, codingWorkspace] = await Promise.all([
    readFile(tokensUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
  ]);
  const palette = Object.fromEntries(
    [...tokens.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]),
  );
  assert.ok(contrastRatio(palette.muted, palette.paper) >= 4.5, "contextual help copy must clear AA contrast");
  const practiceStatus = cssRules(codingWorkspace).find((rule) => (
    rule.selectors.includes(".cell-footer > span") && rule.selectors.includes(".editor-footer p")
  ));
  assert.ok(practiceStatus, "Expected a shared readable practice-status rule");
  assert.match(practiceStatus.declarations, /color:\s*#a9a19a/);
  assert.match(practiceStatus.declarations, /font-size:\s*max\(0\.68rem, 11px\)/);
  assert.ok(contrastRatio("#a9a19a", "#19181b") >= 4.5, "practice status copy must clear AA contrast");
});
