import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const lessonExperimentUrl = new URL("app/components/LessonExperiment.tsx", root);
const harnessExperimentUrl = new URL("app/components/HarnessExperiment.tsx", root);
const replayUrl = new URL("app/components/ExperimentReplay.tsx", root);
const learningFlowUrl = new URL("app/styles/learning-flow.css", root);
const responsiveUrl = new URL("app/styles/responsive.css", root);

function section(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

test("the shared replay controller supports pause, direct inspection, cleanup, and reduced motion", async () => {
  const source = await readFile(replayUrl, "utf8");
  assert.match(source, /export function useReplaySequence/);
  assert.match(source, /setPlaying\(true\)/);
  assert.match(source, /const pause = useCallback/);
  assert.match(source, /const select = useCallback/);
  assert.match(source, /const reset = useCallback/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /useEffect\(\(\) => clear, \[clear\]\)/);
  assert.match(source, /aria-current=\{index === current \? "step" : undefined\}/);
  assert.match(source, /Waiting in replay…/);
});

test("every instant model experiment exposes an inspectable mechanism instead of only final output", async () => {
  const source = await readFile(lessonExperimentUrl, "utf8");
  const bpe = section(source, "function BpeExperiment", "function AttentionExperiment");
  const attention = section(source, "function AttentionExperiment", "function TransformerExperiment");
  const transformer = section(source, "function TransformerExperiment", "function IclExperiment");
  const icl = section(source, "function IclExperiment", "type SystemsVariant");

  assert.match(bpe, /useReplaySequence/);
  assert.match(bpe, /aria-label="Inspect learned merge"/);
  assert.match(bpe, /replay-merge-list/);
  assert.match(attention, /useReplaySequence/);
  assert.match(attention, /Inspect alignment training checkpoint/);
  assert.match(attention, /pointNumber=\{\(point\) => 1 \+ \(point - 1\) \* 20\}/);
  assert.match(transformer, /useReplaySequence/);
  assert.match(transformer, /Inspect one causal attention query/);
  assert.match(transformer, /pending-query/);
  assert.match(icl, /role="status" aria-live="polite"/);
  assert.match(icl, /className="icl-result-stack" aria-live="polite"/);
});

test("systems, product, fundamentals, and harness runs replay their internal steps", async () => {
  const [source, harness] = await Promise.all([
    readFile(lessonExperimentUrl, "utf8"),
    readFile(harnessExperimentUrl, "utf8"),
  ]);
  const systems = section(source, "function SystemsExperiment", "function ProductExperiment");
  const product = section(source, "function ProductExperiment", "type FundamentalsResult");
  const fundamentals = section(source, "function FundamentalsExperiment", "export function LessonExperiment");

  assert.match(systems, /showResult = \(nextResult/);
  assert.match(systems, /<ReplayTrace/);
  assert.match(systems, /Pause trace/);
  assert.match(product, /stateReplay = useReplaySequence/);
  assert.match(product, /streamReplay = useReplaySequence/);
  assert.match(product, /contextReplay = useReplaySequence/);
  assert.match(product, /qualityReplay = useReplaySequence/);
  assert.match(product, /Pause reducer replay/);
  assert.match(product, /Pause stream replay/);
  assert.match(product, /Inspect request construction stage/);
  assert.match(product, /Inspect product contract category/);
  assert.doesNotMatch(product, /setRan\(true\)/);
  assert.match(fundamentals, /<ReplayTrace/);
  assert.match(fundamentals, /Pause example/);
  assert.match(harness, /useReplaySequence/);
  assert.match(harness, /<ReplayTrace/);
  assert.match(harness, /Pause trace/);
});

test("replay controls remain legible and selectable at compact widths", async () => {
  const [learningFlow, responsive] = await Promise.all([
    readFile(learningFlowUrl, "utf8"),
    readFile(responsiveUrl, "utf8"),
  ]);
  assert.match(learningFlow, /\.replay-stage-bar\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/);
  assert.match(learningFlow, /\.replay-stage-bar button\[aria-pressed="true"\]/);
  assert.match(learningFlow, /\.experiment-lab \.trace-list\.replay-trace > button\.active/);
  assert.match(learningFlow, /\.replay-merge-list > button\.pending/);
  assert.match(responsive, /\.replay-stage-bar\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(responsive, /\.experiment-lab \.trace-list\.replay-trace > button\s*\{[^}]*grid-template-columns:\s*4\.5rem/);
});
