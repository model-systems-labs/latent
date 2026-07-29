import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("lesson training surfaces distinguish the demo from the recorded course run", async () => {
  const [experiment, artifactPanel, recordedPanel, scenario] = await Promise.all([
    readFile(new URL("app/components/LessonExperiment.tsx", root), "utf8"),
    readFile(new URL("app/features/artifacts/ArtifactRuntimePanel.tsx", root), "utf8"),
    readFile(new URL("app/features/artifacts/RecordedTrainingPanel.tsx", root), "utf8"),
    readFile(new URL("app/features/artifacts/training-scenarios/character-rnn.ts", root), "utf8"),
  ]);

  assert.match(experiment, /Quick browser model\./);
  assert.match(experiment, /does not read your IDE code or save the Python checkpoint used by the chatbot/);
  assert.match(experiment, /"Train and generate a sample"/);
  assert.match(experiment, /32-character windows/);
  assert.match(experiment, /Explore one training pass/);
  assert.match(experiment, /Move through the next-character targets/);
  assert.match(experiment, /Inspect the loss history/);
  assert.match(experiment, /← Earlier 30/);
  assert.match(experiment, /Reveal 32 more characters/);
  assert.match(experiment, /Next-character loss across 600 updates/);
  assert.match(experiment, /Broken words expose the limits of this tiny model and corpus/);
  assert.match(artifactPanel, /Recorded training replay · fixed course run, not your code/);
  assert.match(recordedPanel, /Fixed checkpoints from a repeatable course run; moving between them does not run your code/);
  assert.match(recordedPanel, />Download recorded checkpoint</);
  assert.match(recordedPanel, />Download recorded run</);
  assert.match(scenario, /Recorded character RNN run/);
  assert.match(scenario, /No training happens while you step through them/);
});

test("the Python inspector separates runtime output from one verification hierarchy", async () => {
  const source = await readFile(new URL("app/features/ide/PythonExecution.tsx", root), "utf8");

  assert.match(source, /export type PythonProjectChecks/);
  assert.match(source, />Project checks</);
  assert.match(source, /projectChecks\.buildProject\(\)/);
  assert.match(source, /"Test, build & run"/);
  assert.match(source, />Model checkpoint</);
  assert.match(source, /<header><span>Output<\/span>/);
  assert.match(source, /This only ran the file; it did not run project checks or replace the source-bound checkpoint/);
  assert.match(source, /This source-bound Python checkpoint supplies the model weights/);
  assert.match(source, /the chatbot loads them through its tested JavaScript adapters/);
});
