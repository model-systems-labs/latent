"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CourseLesson } from "@latent/course-kit";
import {
  runCausalAttention,
  trainAdditiveAttention,
  trainBpe,
  trainCharacterRnn,
  trainNeuralLanguageModel,
  type AttentionResult,
  type BpeResult,
  type NeuralLmResult,
  type RnnResult,
  type TransformerResult,
} from "@latent/model-lab";
import { markExperimentComplete, saveCharacterRnnArtifact } from "@/app/lib/learner-state";
import { MANUAL_PRODUCT_VERIFICATION, runCapstoneQualityAudit } from "@/app/lib/capstone-contract";
import {
  beginPipelineLoad,
  createPipelineLoadLifecycle,
  mountPipelineLoad,
  pipelineLoadIsCurrent,
  requestPipelineLoadCleanup,
  settlePipelineLoad,
  settlePipelineLoadFailure,
} from "@/app/lib/pipeline-load-lifecycle";
import { ReplayStages, ReplayTrace, useReplaySequence } from "@/app/components/ExperimentReplay";
import styles from "@/app/components/LessonExperiment.module.css";
import "@/app/styles/experiments-models.css";
import "@/app/styles/experiments-systems-product.css";
import { isHarnessExperimentVariant } from "@/examples/learning-platform/llm-learning/content/harness-engineering/experiments";

const HarnessExperiment = lazy(() => import("@/app/components/HarnessExperiment"));

type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type TextGenerator = {
  (
    input: ModelMessage[] | string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  dispose?: () => Promise<void> | void;
};
type IclCondition = "Zero-shot" | "One-shot" | "Few-shot";
const qualityCategoryLabels: Record<string, string> = {
  "Input and focus": "Typing and keyboard focus",
  "Persistence and context": "Saving and context",
  "Lifecycle and recovery": "Request flow and recovery",
  "Accessibility and responsive contract": "Accessibility and mobile layout",
};
type IclRow = {
  condition: IclCondition;
  correct: number;
  total: number;
  outputs: Array<{ input: string; expected: string; predicted: string | null; raw: string }>;
};

function extractGeneratedText(result: unknown) {
  if (!Array.isArray(result) || result.length === 0) return "";
  const generated = (result[0] as { generated_text?: unknown }).generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const finalMessage = generated.at(-1) as { content?: unknown } | undefined;
    return typeof finalMessage?.content === "string" ? finalMessage.content : "";
  }
  return "";
}

function disposeTextGenerator(generator: TextGenerator | null) {
  try {
    void Promise.resolve(generator?.dispose?.()).catch(() => undefined);
  } catch {
    // Disposal is best-effort during navigation; lifecycle guards still reject late UI updates.
  }
}

function LossChart({
  values,
  title = "Loss during training",
  startLabel = "First update",
  endLabel = "Last update",
  pointLabel = "Checkpoint",
  pointNumber = (point) => point,
}: {
  values: number[];
  title?: string;
  startLabel?: string;
  endLabel?: string;
  pointLabel?: string;
  pointNumber?: (point: number) => number;
}) {
  const [selectedPoint, setSelectedPoint] = useState(Math.max(values.length, 1));
  if (!values.length) return null;
  const boundedPoint = Math.min(selectedPoint, values.length);
  const selectedPointNumber = pointNumber(boundedPoint);
  const selectedValue = values[boundedPoint - 1];
  const selectedPosition = values.length === 1 ? 100 : ((boundedPoint - 1) / (values.length - 1)) * 100;
  const stride = Math.max(1, Math.ceil(values.length / 36));
  const sample = values
    .map((value, index) => ({ value, update: index + 1 }))
    .filter((_, index) => index % stride === 0 || index === values.length - 1);
  const minimum = Math.min(...sample.map(({ value }) => value));
  const maximum = Math.max(...sample.map(({ value }) => value));
  const range = Math.max(maximum - minimum, 1e-9);
  return (
    <figure className="loss-figure">
      <figcaption>
        <strong>{title}</strong>
        <span>Lower bars mean the model made better predictions; small bumps are normal.</span>
      </figcaption>
      <div
        className="loss-chart"
        aria-label={`${title}, from ${values[0].toFixed(3)} on the first update to ${values.at(-1)?.toFixed(3)} on the last update`}
      >
        <span className="loss-chart-marker" style={{ left: `${selectedPosition}%` }} />
        {sample.map(({ value, update }) => (
          <i
            key={`${update}-${value}`}
            title={`${pointLabel} ${pointNumber(update).toLocaleString()}: ${value.toFixed(3)}`}
            style={{ height: `${18 + ((value - minimum) / range) * 82}%` }}
          />
        ))}
      </div>
      <div className="loss-chart-axis" aria-hidden="true">
        <span>{startLabel}</span>
        <span>Training progress →</span>
        <span>{endLabel}</span>
      </div>
      <div className="loss-chart-inspector">
        <label>
          <span>Inspect the loss history</span>
          <input
            type="range"
            min="1"
            max={values.length}
            value={boundedPoint}
            onInput={(event) => setSelectedPoint(Number(event.currentTarget.value))}
          />
        </label>
        <output>
          <span>
            {pointLabel} {selectedPointNumber.toLocaleString()}
            {pointNumber(boundedPoint) === boundedPoint ? ` of ${values.length}` : ` · check ${boundedPoint} of ${values.length}`}
          </span>
          <strong>Loss {selectedValue.toFixed(3)}</strong>
        </output>
        <div className="loss-inspector-actions">
          <button type="button" disabled={boundedPoint === 1} onClick={() => setSelectedPoint(Math.max(1, boundedPoint - 30))}>← Earlier 30</button>
          <button type="button" disabled={boundedPoint === values.length} onClick={() => setSelectedPoint(Math.min(values.length, boundedPoint + 30))}>Later 30 →</button>
        </div>
      </div>
    </figure>
  );
}

function DatasetRecord({ lesson }: { lesson: CourseLesson }) {
  return (
    <aside className={styles.dataset} aria-label={`Dataset sample: ${lesson.dataset.name}`}>
      <div>
        <em>{lesson.experiment.kind === "rnn" ? "Training text" : "Dataset sample"}</em>
        <strong>{lesson.dataset.name}</strong>
      </div>
      <span>{lesson.dataset.preview}</span>
    </aside>
  );
}

type ExperimentProps = { onComplete: () => void };

type RnnPhase = "read" | "learn" | "generate";

function visibleCharacter(character: string) {
  return character === " " ? "·" : character;
}

function RnnExperiment({ onComplete, trainingText }: ExperimentProps & { trainingText: string }) {
  const [result, setResult] = useState<RnnResult | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<RnnPhase>("read");
  const [windowStart, setWindowStart] = useState(0);
  const [focusOffset, setFocusOffset] = useState(8);
  const [sampleCursor, setSampleCursor] = useState(24);
  const trainingWindowSize = 32;
  const maximumWindowStart = Math.max(0, trainingText.length - trainingWindowSize);
  const boundedWindowStart = Math.min(windowStart, maximumWindowStart);
  const trainingWindow = trainingText.slice(boundedWindowStart, boundedWindowStart + trainingWindowSize);
  const maximumFocusOffset = Math.max(0, Math.min(trainingWindowSize - 2, trainingText.length - boundedWindowStart - 2));
  const boundedFocusOffset = Math.min(focusOffset, maximumFocusOffset);
  const currentIndex = boundedWindowStart + boundedFocusOffset;
  const visibleContext = trainingText.slice(boundedWindowStart, currentIndex + 1);
  const targetCharacter = trainingText[currentIndex + 1] ?? "";
  const visibleSampleLength = result ? Math.min(sampleCursor, result.sample.length) : 0;

  const run = () => {
    setRunning(true);
    setPhase("learn");
    window.setTimeout(() => {
      const trained = trainCharacterRnn();
      setResult(trained);
      setSampleCursor(Math.min(24, trained.sample.length));
      setPhase("generate");
      saveCharacterRnnArtifact(trained);
      onComplete();
      setRunning(false);
    }, 30);
  };
  return (
    <>
      <section className="rnn-training-display" aria-labelledby="rnn-training-display-title">
        <header>
          <div>
            <span id="rnn-training-display-title">Explore one training pass</span>
            <p>Choose a stage, then move its controls to see what the model receives and produces.</p>
          </div>
          <div className="rnn-phase-controls" role="group" aria-label="Training stages">
            <button type="button" aria-pressed={phase === "read"} onClick={() => setPhase("read")}><span>1</span> Read</button>
            <button type="button" aria-pressed={phase === "learn"} onClick={() => setPhase("learn")}><span>2</span> Learn</button>
            <button type="button" aria-pressed={phase === "generate"} onClick={() => setPhase("generate")}><span>3</span> Generate</button>
          </div>
        </header>

        <div className="rnn-stage" aria-live="polite">
          {phase === "read" ? (
            <>
              <div className="rnn-stage-heading">
                <div><span>Input to the RNN</span><strong>A 32-character window</strong></div>
                <small>Characters {boundedWindowStart + 1}–{boundedWindowStart + trainingWindow.length}</small>
              </div>
              <code className="rnn-character-window" aria-label={trainingWindow}>
                {trainingWindow.split("").map((character, index) => (
                  <i key={`${boundedWindowStart}-${index}`}>{visibleCharacter(character)}</i>
                ))}
              </code>
              <label className="rnn-stage-slider">
                <span>Move the training window through Signal Notes</span>
                <input
                  type="range"
                  min="0"
                  max={maximumWindowStart}
                  value={boundedWindowStart}
                  onInput={(event) => setWindowStart(Number(event.currentTarget.value))}
                />
              </label>
              <p className="rnn-stage-note">The model never sees the whole corpus at once. It carries a small hidden state from one character to the next inside this window.</p>
            </>
          ) : null}

          {phase === "learn" ? (
            <>
              <div className="rnn-stage-heading">
                <div><span>One prediction target</span><strong>Current context → real next character</strong></div>
                <small>Pair {boundedFocusOffset + 1} of {maximumFocusOffset + 1}</small>
              </div>
              <div className="rnn-prediction-readout">
                <div><span>Model has read</span><code>{visibleContext.replaceAll(" ", "·")}</code></div>
                <i aria-hidden="true">→</i>
                <div><span>Must predict</span><code>{visibleCharacter(targetCharacter)}</code></div>
              </div>
              <label className="rnn-stage-slider">
                <span>Move through the next-character targets</span>
                <input
                  type="range"
                  min="0"
                  max={maximumFocusOffset}
                  value={boundedFocusOffset}
                  onInput={(event) => setFocusOffset(Number(event.currentTarget.value))}
                />
              </label>
              <p className="rnn-stage-note">A wrong or uncertain guess creates more loss. Backpropagation sends that error through this window and adjusts the same weights used at every position.</p>
            </>
          ) : null}

          {phase === "generate" ? (
            result ? (
              <>
                <div className="rnn-stage-heading">
                  <div><span>New text from the trained model</span><strong>One sampled character becomes the next input</strong></div>
                  <small>Temperature 0.78 · {visibleSampleLength} of {result.sample.length} characters</small>
                </div>
                <p className="rnn-generated-text">{result.sample.slice(0, visibleSampleLength)}<i aria-hidden="true" /></p>
                <label className="rnn-stage-slider">
                  <span>Reveal the generated sequence character by character</span>
                  <input
                    type="range"
                    min="1"
                    max={result.sample.length}
                    value={Math.max(visibleSampleLength, 1)}
                    onInput={(event) => setSampleCursor(Number(event.currentTarget.value))}
                  />
                </label>
                <div className="rnn-generate-footer">
                  <p><strong>How to read this:</strong> Familiar fragments are learned local patterns. Broken words expose the limits of this tiny model and corpus.</p>
                  <button
                    type="button"
                    onClick={() => setSampleCursor(visibleSampleLength >= result.sample.length ? Math.min(24, result.sample.length) : Math.min(visibleSampleLength + 32, result.sample.length))}
                  >
                    {visibleSampleLength >= result.sample.length ? "Replay from the start" : "Reveal 32 more characters"}
                  </button>
                </div>
              </>
            ) : (
              <div className="rnn-generate-empty">
                <span>Generation is locked to the learned weights</span>
                <strong>Train the model to create a sample.</strong>
                <p>The output will appear here, then you can reveal it one character at a time.</p>
              </div>
            )
          ) : null}
        </div>
      </section>
      <p className={styles.runScope}>
        <strong>Quick browser model.</strong> The course&apos;s small JavaScript RNN runs here. It does not read your IDE code or save the Python checkpoint used by the chatbot.
      </p>
      <div className="experiment-action rnn-action">
        <div>
          <strong>{result ? "Training complete" : "Ready to train in this tab"}</strong>
          <p>18 hidden units · 32-character windows · 600 weight updates · repeatable fixed seed</p>
        </div>
        <button type="button" onClick={run} disabled={running}>{running ? "Training 600 updates…" : result ? "Run the same training again" : "Train and generate a sample"}</button>
      </div>
      {result ? (
        <div className="experiment-results" aria-live="polite">
          <p className="rnn-result-summary">
            <strong>It learned a recognizable pattern.</strong>
            Average next-character loss fell {Math.max(0, (1 - result.finalLoss / result.initialLoss) * 100).toFixed(0)}%, from {result.initialLoss.toFixed(3)} to {result.finalLoss.toFixed(3)}. Lower is better.
          </p>
          <div className="metric-grid">
            <span><em>Loss near the start</em><strong>{result.initialLoss.toFixed(3)}</strong><small>Average of the first 12 updates</small></span>
            <span><em>Loss near the end</em><strong>{result.finalLoss.toFixed(3)}</strong><small>Average of the last 12 updates</small></span>
            <span><em>Trainable weights</em><strong>{result.parameters.toLocaleString()}</strong><small>Numbers adjusted during training</small></span>
            <span><em>Character vocabulary</em><strong>{result.vocabularySize}</strong><small>Unique letters, spaces, and punctuation</small></span>
          </div>
          <LossChart
            values={result.losses}
            title="Next-character loss across 600 updates"
            startLabel="Update 1"
            endLabel="Update 600"
            pointLabel="Update"
          />
        </div>
      ) : null}
    </>
  );
}

function NeuralLmExperiment({ onComplete }: ExperimentProps) {
  const [checkpoints, setCheckpoints] = useState<Array<{ label: string; steps: number; result: NeuralLmResult }>>([]);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const replayTimers = useRef<number[]>([]);
  const result = checkpoints[checkpointIndex]?.result ?? null;
  const checkpoint = checkpoints[checkpointIndex] ?? null;
  const bestCheckpointIndex = checkpoints.reduce(
    (bestIndex, candidate, index) =>
      candidate.result.finalValidationLoss < checkpoints[bestIndex].result.finalValidationLoss ? index : bestIndex,
    0,
  );
  const clearReplay = () => {
    replayTimers.current.forEach((timer) => window.clearTimeout(timer));
    replayTimers.current = [];
  };
  const selectCheckpoint = (index: number) => {
    clearReplay();
    setRunning(false);
    setCheckpointIndex(index);
  };
  const run = () => {
    clearReplay();
    setRunning(true);
    const preparationTimer = window.setTimeout(() => {
      const nextCheckpoints = [
        { label: "Start", steps: 1 },
        { label: "Early", steps: 400 },
        { label: "Learning", steps: 1_200 },
        { label: "Best", steps: 2_880 },
        { label: "Too far", steps: 4_000 },
      ].map((item) => ({ ...item, result: trainNeuralLanguageModel(item.steps) }));
      setCheckpoints(nextCheckpoints);
      setCheckpointIndex(0);
      onComplete();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setCheckpointIndex(nextCheckpoints.length - 1);
        setRunning(false);
        return;
      }
      replayTimers.current = nextCheckpoints.slice(1).map((_, index) => window.setTimeout(() => {
        setCheckpointIndex(index + 1);
        if (index === nextCheckpoints.length - 2) {
          setRunning(false);
          replayTimers.current = [];
        }
      }, (index + 1) * 850));
    }, 30);
    replayTimers.current = [preparationTimer];
  };
  useEffect(() => () => clearReplay(), []);
  const previousLoss = checkpointIndex > 0 ? checkpoints[checkpointIndex - 1].result.finalValidationLoss : null;
  const checkpointNote = checkpointIndex === 0
    ? "The model begins near a uniform guess across the 30-word vocabulary."
    : checkpointIndex === bestCheckpointIndex
      ? "This checkpoint has the lowest held-out loss in the replay."
      : previousLoss !== null && result && result.finalValidationLoss > previousLoss
        ? "Training loss can keep improving while held-out loss rises. This late turn is overfitting."
        : "The held-out loss is falling as useful word and context patterns form.";
  return (
    <>
      <div className="experiment-action neural-lm-action">
        <div>
          <strong>{running ? "Replaying training checkpoints" : result ? "Training replay ready" : "Ready to train in this tab"}</strong>
          <p>Two-word context · 8-dimensional embeddings · fixed train/validation split</p>
        </div>
        <button type="button" onClick={running ? () => { clearReplay(); setRunning(false); } : run}>
          {running ? "Pause replay" : result ? "Replay training" : "Train language model"}
        </button>
      </div>
      {result ? (
        <div className="experiment-results neural-lm-results">
          <section className="neural-replay" aria-label="Training checkpoint replay">
            <header>
              <div>
                <span>Training checkpoint</span>
                <output aria-live="polite">
                  <strong>{checkpoint.steps.toLocaleString()} {checkpoint.steps === 1 ? "update" : "updates"}</strong>
                  <small>{running ? "Playing automatically" : "Choose any checkpoint"}</small>
                </output>
              </div>
              <div className="neural-replay-steps" role="group" aria-label="Inspect a training checkpoint">
                {checkpoints.map((item, index) => (
                  <button
                    type="button"
                    key={item.steps}
                    aria-pressed={index === checkpointIndex}
                    onClick={() => selectCheckpoint(index)}
                  >
                    <span>{item.label}</span>
                    <small>{item.steps.toLocaleString()}</small>
                  </button>
                ))}
              </div>
            </header>
            <p className={checkpointIndex > bestCheckpointIndex ? "neural-checkpoint-note is-warning" : "neural-checkpoint-note"}>
              {checkpointNote}
            </p>
          </section>
          <div className="metric-grid">
            <span><em>Starting validation NLL</em><strong>{result.initialValidationLoss.toFixed(3)}</strong><small>Before weight updates</small></span>
            <span><em>Checkpoint validation NLL</em><strong>{result.finalValidationLoss.toFixed(3)}</strong><small>Lower is better on held-out text</small></span>
            <span><em>Trainable weights</em><strong>{result.parameters.toLocaleString()}</strong><small>Embedding, output, and bias values</small></span>
            <span><em>Word vocabulary</em><strong>{result.vocabularySize}</strong><small>Possible next-word choices</small></span>
          </div>
          <LossChart
            key={checkpoint.steps}
            values={result.losses}
            title={`Validation loss through ${checkpoint.steps.toLocaleString()} ${checkpoint.steps === 1 ? "update" : "updates"}`}
            startLabel="First check"
            endLabel="Latest check"
            pointLabel="Update"
            pointNumber={(point) => 1 + (point - 1) * 40}
          />
          <div className="artifact-grid">
            <article>
              <span>p(next word | “the model”)</span>
              <p className="artifact-intro">Watch probability move toward words that follow this exact two-word context.</p>
              {result.predictions.map((prediction) => (
                <div className="artifact-row" key={prediction.word}>
                  <strong>{prediction.word}</strong>
                  <i aria-hidden="true"><b style={{ width: `${prediction.probability * 100}%` }} /></i>
                  <code>{prediction.probability.toFixed(3)}</code>
                </div>
              ))}
            </article>
            <article>
              <span>Nearest to “model”</span>
              <p className="artifact-intro">Similar embeddings emerge for words used in similar sentence positions.</p>
              {result.neighbors.map((neighbor) => (
                <div className="neighbor-row" key={neighbor.word}>
                  <strong>{neighbor.word}</strong>
                  <i aria-hidden="true"><b style={{ width: `${Math.max(0, neighbor.similarity) * 100}%` }} /></i>
                  <code>{neighbor.similarity.toFixed(3)}</code>
                </div>
              ))}
            </article>
          </div>
        </div>
      ) : null}
    </>
  );
}

function BpeExperiment({ onComplete }: ExperimentProps) {
  const [budget, setBudget] = useState(10);
  const [result, setResult] = useState<BpeResult | null>(null);
  const replay = useReplaySequence(onComplete, 360);
  const visibleResult = result ? trainBpe(Math.min(replay.step, result.merges.length)) : null;
  const run = () => {
    const trained = trainBpe(budget);
    setResult(trained);
    replay.start(trained.merges.length + 1);
  };
  return (
    <>
      <div className="experiment-action bpe-action">
        <label><span>Merge budget · {budget}</span><input type="range" min="2" max="24" value={budget} onChange={(event) => { setBudget(Number(event.target.value)); setResult(null); replay.reset(); }} /></label>
        <button type="button" onClick={replay.playing ? replay.pause : run}>{replay.playing ? "Pause merge replay" : result ? "Replay tokenizer" : "Train tokenizer"}</button>
      </div>
      {result && visibleResult ? (
        <div className="experiment-results">
          <div className="replay-scrubber">
            <label>
              <span>{replay.step === 0 ? "Before any merges" : `Merge ${replay.step} of ${result.merges.length}`}</span>
              <input
                aria-label="Inspect learned merge"
                type="range"
                min="0"
                max={result.merges.length}
                value={Math.min(replay.step, result.merges.length)}
                onChange={(event) => replay.select(Number(event.target.value))}
              />
            </label>
            <output aria-live="polite">
              <strong>{visibleResult.finalTokenCount} symbols</strong>
              <small>{replay.playing ? "Replaying learned merges" : "Move the slider or select a merge"}</small>
            </output>
          </div>
          <div className="metric-grid">
            <span><em>Initial symbols</em><strong>{visibleResult.initialTokenCount}</strong></span>
            <span><em>Symbols now</em><strong>{visibleResult.finalTokenCount}</strong></span>
            <span><em>Merges applied</em><strong>{visibleResult.merges.length}/{result.merges.length}</strong></span>
            <span><em>Vocabulary now</em><strong>{visibleResult.vocabularySize}</strong></span>
          </div>
          <div className="token-artifact"><span>“modeling signals” at this step</span><div>{visibleResult.encoded.map((token, index) => <code key={`${token}-${index}`}>{token}</code>)}</div></div>
          <div className="merge-list replay-merge-list" aria-label="Learned merge sequence">
            {result.merges.map((merge, index) => (
              <button
                type="button"
                className={index + 1 === replay.step ? "active" : index + 1 < replay.step ? "complete" : "pending"}
                aria-current={index + 1 === replay.step ? "step" : undefined}
                onClick={() => replay.select(index + 1)}
                key={`${merge.pair.join("-")}-${index}`}
              >
                <em>{index + 1}</em>
                <code>{merge.pair[0]} + {merge.pair[1]} → {merge.pair.join("")}</code>
                <strong>{index + 1 <= replay.step ? `${merge.count}×` : "waiting"}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function AttentionExperiment({ onComplete }: ExperimentProps) {
  const [checkpoints, setCheckpoints] = useState<Array<{ label: string; epochs: number; result: AttentionResult }>>([]);
  const replay = useReplaySequence(onComplete, 760);
  const checkpoint = checkpoints[Math.min(replay.step, Math.max(0, checkpoints.length - 1))] ?? null;
  const result = checkpoint?.result ?? null;
  const run = () => {
    const nextCheckpoints = [
      { label: "Start", epochs: 1 },
      { label: "Separating", epochs: 100 },
      { label: "Aligning", epochs: 400 },
      { label: "Confident", epochs: 1_000 },
      { label: "Trained", epochs: 2_000 },
    ].map((item) => ({ ...item, result: trainAdditiveAttention(item.epochs) }));
    setCheckpoints(nextCheckpoints);
    replay.start(nextCheckpoints.length);
  };
  return (
    <>
      <div className="experiment-action">
        <p>7-unit additive scorer · 2,000 epochs · three alignment targets</p>
        <button type="button" onClick={replay.playing ? replay.pause : run}>{replay.playing ? "Pause alignment replay" : result ? "Replay alignment" : "Train attention"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <ReplayStages
            label="Inspect alignment training checkpoint"
            stages={checkpoints.map((item) => ({ label: item.label, value: `${item.epochs.toLocaleString()} epochs` }))}
            current={replay.step}
            onSelect={replay.select}
          />
          <p className="replay-explanation" aria-live="polite">
            {replay.step === 0
              ? "All three source positions begin close to the one-third uniform baseline."
              : replay.step === checkpoints.length - 1
                ? "Each query now places nearly all of its probability on the intended source position."
                : "The strongest cell in each row is separating from the alternatives as the scorer learns."}
          </p>
          <div className="metric-grid compact-metrics">
            <span><em>Initial alignment loss</em><strong>{result.losses[0].toFixed(3)}</strong></span>
            <span><em>Checkpoint loss</em><strong>{result.losses.at(-1)?.toFixed(3)}</strong></span>
            <span><em>Uniform baseline</em><strong>0.333</strong></span>
          </div>
          <LossChart
            key={checkpoint.epochs}
            values={result.losses}
            title={`Alignment loss through ${checkpoint.epochs.toLocaleString()} ${checkpoint.epochs === 1 ? "epoch" : "epochs"}`}
            startLabel="First check"
            endLabel="Latest check"
            pointLabel="Epoch"
            pointNumber={(point) => 1 + (point - 1) * 20}
          />
          <div className="attention-matrix" style={{ gridTemplateColumns: `7rem repeat(${result.source.length}, 1fr)` }}>
            <span />
            {result.source.map((source) => <strong key={source}>{source}</strong>)}
            {result.matrix.flatMap((row, rowIndex) => [
              <strong key={`label-${result.labels[rowIndex]}`}>{result.labels[rowIndex]}</strong>,
              ...row.map((value, columnIndex) => <i key={`${rowIndex}-${columnIndex}`} style={{ background: `rgba(118, 104, 137, ${0.08 + value * 0.82})` }}>{value.toFixed(2)}</i>),
            ])}
          </div>
        </div>
      ) : null}
    </>
  );
}

function TransformerExperiment({ onComplete }: ExperimentProps) {
  const [result, setResult] = useState<TransformerResult | null>(null);
  const replay = useReplaySequence(onComplete, 620);
  const selectedToken = result?.tokens[Math.min(replay.step, result.tokens.length - 1)] ?? "";
  const run = () => {
    const nextResult = runCausalAttention();
    setResult(nextResult);
    replay.start(nextResult.tokens.length);
  };
  return (
    <>
      <div className="experiment-action">
        <p>8-dimensional token-plus-position vectors · identity Q/K/V projections · one causal attention head</p>
        <button type="button" onClick={replay.playing ? replay.pause : run}>{replay.playing ? "Pause token replay" : result ? "Replay attention" : "Run attention"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <ReplayStages
            label="Inspect one causal attention query"
            stages={result.tokens.map((token, index) => ({ label: token, value: `position ${index + 1}` }))}
            current={replay.step}
            onSelect={replay.select}
          />
          <div className="causal-note" aria-live="polite">
            <strong>Query “{selectedToken}”</strong>
            <span>Can read positions 1–{replay.step + 1}; every later position is masked to exactly zero.</span>
          </div>
          <div className="attention-matrix transformer-matrix" style={{ gridTemplateColumns: `6.5rem repeat(${result.tokens.length}, 1fr)` }}>
            <span />
            {result.tokens.map((token, index) => <strong key={`${token}-${index}`}>{token}</strong>)}
            {result.attention.flatMap((row, rowIndex) => [
              <strong className={rowIndex === replay.step ? "active-query" : rowIndex > replay.step ? "pending-query" : ""} key={`row-${rowIndex}`}>{result.tokens[rowIndex]}</strong>,
              ...row.map((value, columnIndex) => {
                const pending = rowIndex > replay.step;
                const masked = columnIndex > rowIndex;
                return (
                  <i
                    className={`${masked ? "masked" : ""}${rowIndex === replay.step ? " active-query" : ""}${pending ? " pending-query" : ""}`.trim()}
                    key={`${rowIndex}-${columnIndex}`}
                    style={{ background: masked || pending ? undefined : `rgba(118, 104, 137, ${0.08 + value * 0.82})` }}
                  >
                    {pending ? "·" : masked ? "—" : value.toFixed(2)}
                  </i>
                );
              }),
            ])}
          </div>
          <div className="context-norms">{result.contextNorms.map((value, index) => <span className={index === replay.step ? "active" : index > replay.step ? "pending" : ""} key={`${result.tokens[index]}-${index}`}><em>{result.tokens[index]}</em><code>{index <= replay.step ? `‖c‖ ${value.toFixed(3)}` : "waiting"}</code></span>)}</div>
        </div>
      ) : null}
    </>
  );
}

function IclExperiment({ onComplete }: ExperimentProps) {
  const generatorRef = useRef<TextGenerator | null>(null);
  const lifecycleRef = useRef(createPipelineLoadLifecycle());
  const evaluationOperationRef = useRef(0);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState("Model not loaded");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<IclRow[]>([]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    mountPipelineLoad(lifecycle);
    return () => {
      requestPipelineLoadCleanup(lifecycle);
      evaluationOperationRef.current += 1;
      const generator = generatorRef.current;
      generatorRef.current = null;
      disposeTextGenerator(generator);
    };
  }, []);

  const loadModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    const lifecycle = lifecycleRef.current;
    const operation = beginPipelineLoad(lifecycle);
    const isCurrent = () => pipelineLoadIsCurrent(lifecycle, operation);
    setModelStatus("loading");
    setError("");
    try {
      const transformers = await import("@/app/lib/local-transformer-runtime");
      const progressCallback = (info: unknown) => {
        if (!isCurrent()) return;
        const update = info as { progress?: number; file?: string; status?: string };
        if (typeof update.progress === "number") setProgress(Math.round(update.progress));
        if (update.file) setDetail(update.file.split("/").at(-1) ?? update.file);
        if (update.status === "ready") setProgress(100);
      };
      const options = { dtype: "q4", progress_callback: progressCallback } as Record<string, unknown>;
      let generator: TextGenerator;
      if ("gpu" in navigator) {
        try {
          if (isCurrent()) setDetail("Initializing WebGPU · q4");
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...options, device: "webgpu" }) as unknown as TextGenerator;
        } catch {
          if (!isCurrent()) {
            settlePipelineLoadFailure(lifecycle, operation);
            return;
          }
          setDetail("WebGPU isn’t available; starting WASM · q4");
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...options, device: "wasm" }) as unknown as TextGenerator;
        }
      } else {
        generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...options, device: "wasm" }) as unknown as TextGenerator;
      }
      if (settlePipelineLoad(lifecycle, operation) === "dispose") {
        disposeTextGenerator(generator);
        return;
      }
      generatorRef.current = generator;
      setModelStatus("ready");
      setProgress(100);
      setDetail("SmolLM2-135M-Instruct · q4 · local");
    } catch (reason) {
      if (!settlePipelineLoadFailure(lifecycle, operation)) return;
      setModelStatus("error");
      setError(reason instanceof Error ? reason.message : "The local model couldn’t start.");
    }
  };

  const runEvaluation = async () => {
    const generator = generatorRef.current;
    if (!generator || running) return;
    const operation = ++evaluationOperationRef.current;
    const isCurrent = () => lifecycleRef.current.mounted && evaluationOperationRef.current === operation;
    setRunning(true);
    setRows([]);
    setError("");
    const demonstrations = [
      { input: "I loved every minute.", label: "K" },
      { input: "Warm, precise, and beautifully acted.", label: "K" },
      { input: "A complete waste of time.", label: "M" },
      { input: "Dull, confused, and badly written.", label: "M" },
    ];
    const tests = [
      { input: "A sharp and moving story.", expected: "K" },
      { input: "Flat, tedious, and far too long.", expected: "M" },
    ];
    const conditions: Array<{ name: IclCondition; examples: typeof demonstrations }> = [
      { name: "Zero-shot", examples: [] },
      { name: "One-shot", examples: demonstrations.slice(0, 1) },
      { name: "Few-shot", examples: demonstrations },
    ];
    try {
      for (const condition of conditions) {
        const outputs: IclRow["outputs"] = [];
        for (const test of tests) {
          if (!isCurrent()) return;
          const exampleText = condition.examples.map((example) => `Input: ${example.input}\nLabel: ${example.label}`).join("\n\n");
          const prompt = [
            "Infer how the demonstrations map short reviews to the opaque labels K and M. Classify the final review. Return exactly one capital letter: K or M.",
            exampleText,
            `Input: ${test.input}\nLabel:`,
          ].filter(Boolean).join("\n\n");
          setDetail(`${condition.name} · case ${outputs.length + 1} of ${tests.length}`);
          const result = await generator(prompt, {
            max_new_tokens: 2,
            do_sample: false,
            repetition_penalty: 1.05,
            return_full_text: false,
          });
          if (!isCurrent()) return;
          const raw = extractGeneratedText(result).trim();
          const match = raw.match(/\b(K|M)\b/);
          outputs.push({ input: test.input, expected: test.expected, predicted: match?.[1] ?? null, raw });
        }
        const row = { condition: condition.name, correct: outputs.filter((output) => output.predicted === output.expected).length, total: outputs.length, outputs };
        if (isCurrent()) setRows((current) => [...current, row]);
      }
      if (!isCurrent()) return;
      setDetail("Evaluation done · weights stayed frozen");
      onComplete();
    } catch (reason) {
      if (!isCurrent()) return;
      setError(reason instanceof Error ? reason.message : "The local evaluation stopped before it finished.");
    } finally {
      if (isCurrent()) setRunning(false);
    }
  };

  const zeroShot = rows.find((row) => row.condition === "Zero-shot");
  const fewShot = rows.find((row) => row.condition === "Few-shot");
  const promptedRows = rows.filter((row) => row.condition !== "Zero-shot");
  const changedPredictions = zeroShot
    ? zeroShot.outputs.filter((output, index) => promptedRows.some((row) => row.outputs[index]?.predicted !== output.predicted)).length
    : 0;

  return (
    <>
      <div className="model-loader">
        <div><span>Local model</span><strong>SmolLM2-135M-Instruct · q4</strong><em role="status" aria-live="polite">{detail}</em>{modelStatus === "loading" ? <small>If you leave this lesson, the page will stop updating. This version of Transformers.js may still finish the current download before it can shut down the model.</small> : null}</div>
        <i><b style={{ width: `${progress}%` }} /></i>
        <button type="button" onClick={loadModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>{modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${progress}% downloaded` : "Load model · ~181 MB"}</button>
      </div>
      <div className="experiment-action">
        <p>Arbitrary sentiment labels · 2 test cases · exact match · frozen weights</p>
        <button type="button" onClick={runEvaluation} disabled={modelStatus !== "ready" || running}>{running ? "Evaluating…" : rows.length ? "Run evaluation again" : "Run three conditions"}</button>
      </div>
      {error ? <p className="model-error">{error}</p> : null}
      {rows.length ? (
        <div className="icl-result-stack" aria-live="polite">
          <div className="metric-grid"><span><em>Weights updated</em><strong>0</strong></span><span><em>Changed by examples</em><strong>{changedPredictions}/2</strong></span><span><em>Few-shot accuracy</em><strong>{fewShot?.correct ?? 0}/2</strong></span></div>
          <p className="simulation-artifact">This run only shows whether the examples changed the model’s answers while the weights stayed frozen. It doesn’t guarantee that more examples make this small model better.</p>
          <div className="icl-results">
            {rows.map((row) => (
              <article key={row.condition}>
                <header><span>{row.condition}</span><strong>{row.correct}/{row.total}</strong></header>
                {row.outputs.map((output, index) => (
                  <div key={`${row.condition}-${index}`}><p>{output.input}</p><code className={output.predicted === output.expected ? "passed" : "failed"}>{output.predicted ?? "no label"} / {output.expected}</code><small>raw: {output.raw || "empty"}</small></div>
                ))}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

type SystemsVariant = "runtime" | "streaming" | "scheduling" | "reliability";
type ProductVariant = "state" | "streaming-ui" | "context-actions" | "quality";
type StreamingUiProfile = "burst" | "steady" | "stalled" | "cancelled";
type ContextActionFlow = "stop" | "retry" | "edit";

const STREAMING_UI_PROFILES = {
  burst: {
    label: "Burst",
    description: "60 deltas arrive in twelve short bursts around animation frames.",
    status: "complete",
    output: "A causal mask keeps each token from reading positions that come later in the sequence. After softmax, the masked logits have zero probability.",
    metrics: [
      { label: "Delivered deltas", value: "60 / 60" },
      { label: "Visual commits", value: "12" },
      { label: "Live announcements", value: "4" },
      { label: "Dropped text", value: "0 chars" },
    ],
    trace: [
      { time: "0–15 ms", label: "Burst 01", detail: "deltas 1–5 enter the UI queue in the order they arrived; the reducer hasn’t run yet" },
      { time: "16 ms", label: "Frame 01", detail: "flush 5 deltas → send one TOKEN_BATCH → visual update 1/12" },
      { time: "32–176 ms", label: "Frames 02–11", detail: "ten more frames flush 50 deltas → updates 2–11; the stream stays in order" },
      { time: "192 ms", label: "Frame 12", detail: "flush the last 5 deltas → update 12/12 → queue is empty" },
      { time: "193 ms", label: "Complete", detail: "commit the final status; no scheduled frame, pending text, or open reader remains" },
    ],
    scroll: "Following · 24 px from bottom ≤ 80 px · userScrolledUp false",
    announcements: [
      "Assistant: A causal mask prevents",
      "Assistant: each token from reading future positions",
      "Assistant: masked logits become zero probability",
      "Assistant response complete.",
    ],
    cleanup: "complete → show any remaining text → announce completion → release reader",
    dropped: "none",
  },
  steady: {
    label: "Steady",
    description: "60 deltas arrive eight milliseconds apart, usually two per animation frame.",
    status: "complete",
    output: "A causal mask keeps each token from reading positions that come later in the sequence. After softmax, the masked logits have zero probability.",
    metrics: [
      { label: "Delivered deltas", value: "60 / 60" },
      { label: "Visual commits", value: "30" },
      { label: "Live announcements", value: "4" },
      { label: "Dropped text", value: "0 chars" },
    ],
    trace: [
      { time: "0–15 ms", label: "Deltas 1–2", detail: "two parsed token events wait in the queue while one frame is scheduled" },
      { time: "16 ms", label: "Frame 01", detail: "flush 2 deltas → send one TOKEN_BATCH → visual update 1/30" },
      { time: "32–464 ms", label: "Frames 02–29", detail: "56 more deltas flush in ordered pairs → updates 2–29" },
      { time: "480 ms", label: "Frame 30", detail: "flush the last 2 deltas → update 30/30 → queue is empty" },
      { time: "481 ms", label: "Complete", detail: "commit the final status, clear the scheduled frame, and release the reader" },
    ],
    scroll: "Following · 0 px from bottom ≤ 80 px · userScrolledUp false",
    announcements: [
      "Assistant: A causal mask prevents",
      "Assistant: each token from reading future positions",
      "Assistant: masked logits become zero probability",
      "Assistant response complete.",
    ],
    cleanup: "complete → queue is already empty → announce completion → release reader",
    dropped: "none",
  },
  stalled: {
    label: "Stalled",
    description: "The same response pauses for 440 milliseconds after delta 24, then resumes.",
    status: "complete",
    output: "A causal mask keeps each token from reading positions that come later in the sequence. After softmax, the masked logits have zero probability.",
    metrics: [
      { label: "Delivered deltas", value: "60 / 60" },
      { label: "Visual commits", value: "14" },
      { label: "Live announcements", value: "4" },
      { label: "Dropped text", value: "0 chars" },
    ],
    trace: [
      { time: "0–80 ms", label: "Opening bursts", detail: "deltas 1–24 flush across 5 visual updates; the queue returns to 0" },
      { time: "96–520 ms", label: "Transport stall", detail: "no deltas arrive, so the app schedules no frame and sends no empty reducer action" },
      { time: "536 ms", label: "Resume", detail: "delta 25 schedules the next animation frame without replaying old content" },
      { time: "552–680 ms", label: "Frames 06–14", detail: "deltas 25–60 flush in order → updates 6–14; all 60 deltas are visible" },
      { time: "681 ms", label: "Complete", detail: "commit the final status; the queue is empty, no frame is scheduled, and the reader is released" },
    ],
    scroll: "Paused · 214 px from bottom > 80 px · generation continues without moving the reader",
    announcements: [
      "Assistant: A causal mask prevents",
      "Assistant: response paused; partial text remains available",
      "Assistant: masked logits become zero probability",
      "Assistant response complete.",
    ],
    cleanup: "complete → show the last resumed batch → announce completion → release reader",
    dropped: "none",
  },
  cancelled: {
    label: "Cancelled",
    description: "The user cancels while three delivered deltas are still waiting for the next frame.",
    status: "cancelled",
    output: "A causal mask prevents each token from reading future",
    metrics: [
      { label: "Delivered deltas", value: "23 / 60" },
      { label: "Visual commits", value: "4" },
      { label: "Live announcements", value: "2" },
      { label: "Dropped text", value: "11 chars" },
    ],
    trace: [
      { time: "0–64 ms", label: "Visible start", detail: "deltas 1–20 flush across 4 frames → visual updates 1–4" },
      { time: "65–69 ms", label: "Waiting tail", detail: "deltas 21–23 make the exact text “ positions.”, which hasn’t appeared yet; the next frame is scheduled" },
      { time: "70 ms", label: "Cancel", detail: "drop 3 waiting deltas / 11 characters and cancel the scheduled animation frame" },
      { time: "70 ms", label: "Final state", detail: "mark the request canceled; keep the partial response that was already visible" },
      { time: "71 ms", label: "Late delta", detail: "ignore one event that arrives after canceling; cancel the reader and finish the generator cleanup" },
    ],
    scroll: "Paused · 18 px from bottom but userScrolledUp true · the user’s scroll choice wins",
    announcements: [
      "Assistant: A causal mask prevents each token from reading future",
      "Assistant generation cancelled. Partial response retained.",
    ],
    cleanup: "cancelled → drop pending “ positions.” → cancel frame → cancel reader → reject late delta",
    dropped: '" positions." · 3 pending deltas · 11 characters',
  },
} satisfies Record<StreamingUiProfile, {
  label: string;
  description: string;
  status: "complete" | "cancelled";
  output: string;
  metrics: Array<{ label: string; value: string }>;
  trace: Array<{ time: string; label: string; detail: string }>;
  scroll: string;
  announcements: string[];
  cleanup: string;
  dropped: string;
}>;

function SystemsExperiment({ variant, onComplete }: { variant: SystemsVariant } & ExperimentProps) {
  const [policy, setPolicy] = useState<"static" | "continuous">("continuous");
  const [streamPolicy, setStreamPolicy] = useState<"complete" | "cancel">("complete");
  const [failure, setFailure] = useState("queue-timeout");
  const replay = useReplaySequence(onComplete, 560);
  const [result, setResult] = useState<{
    metrics: Array<{ label: string; value: string }>;
    trace: Array<{ label: string; detail: string; tone?: string }>;
    artifact: string;
  } | null>(null);
  const showResult = (nextResult: NonNullable<typeof result>) => {
    setResult(nextResult);
    replay.start(nextResult.trace.length);
  };

  const run = () => {
    if (variant === "runtime") {
      showResult({
        metrics: [
          { label: "Queue", value: "18 ms" },
          { label: "Prefill", value: "74 ms" },
          { label: "TTFT", value: "92 ms" },
          { label: "Decode rate", value: "21.4 tok/s" },
        ],
        trace: [
          { label: "Accepted", detail: "request r-104 · prompt 96 · output limit 32 tokens" },
          { label: "Queue", detail: "18 ms waiting for capacity" },
          { label: "Prefill", detail: "74 ms · process 96 prompt positions · set aside 6 KV pages" },
          { label: "First token", detail: "token 1/32 sampled from prefill logits · visible at TTFT 92 ms" },
          { label: "Decode", detail: "31 more one-position passes produce tokens 2–32 · 21.4 tok/s · cache grows 6 → 8 pages" },
          { label: "Complete", detail: "final sequence length 128 · 8 KV pages released" },
        ],
        artifact: "TTFT = queue 18 ms + prefill 74 ms = 92 ms\noutput 32 = 1 prefill sample + 31 decode forwards\nKV pages 6 → 8 → released",
      });
      return;
    }
    if (variant === "streaming") {
      if (streamPolicy === "cancel") {
        showResult({
          metrics: [
            { label: "Byte chunks read", value: "8 / 17" },
            { label: "Events parsed", value: "5 / 14" },
            { label: "Token events", value: "4 / 10" },
            { label: "Late events", value: "0" },
          ],
          trace: [
            { label: "meta", detail: "decode the request id and model details" },
            { label: "token × 4", detail: "parse four deltas in order; flush the render buffer so the partial response is visible" },
            { label: "abort", detail: "AbortSignal crosses the adapter after token 4", tone: "warning" },
            { label: "reader", detail: "reader.cancel() stops more chunk reads; clear the decoder and leftover frame text" },
            { label: "generator", detail: "run the generator cleanup; tokens 5–10 are never made" },
            { label: "release", detail: "release the reader lock and generation resources · ignore late events" },
          ],
          artifact: "policy cancel-after-4\nproduced tokens 4 / 10 · parsed events 5 / 14\nreader cancelled yes · decoder cleared yes · host frame remainder cleared yes\nlate events 0 · resources released yes",
        });
        return;
      }
      showResult({
        metrics: [
          { label: "Byte chunks", value: "17" },
          { label: "SSE events", value: "14" },
          { label: "Token events", value: "10" },
          { label: "Remainder", value: "0 B" },
        ],
        trace: [
          { label: "meta", detail: "decode the request id and model details" },
          { label: "token × 4", detail: "first frame split across three byte chunks" },
          { label: "render pause", detail: "React updates pause, but byte decoding and frame parsing keep filling the typed-event render buffer" },
          { label: "token × 6", detail: "recover the remaining deltas in order with no duplicates; show the buffered deltas in one render" },
          { label: "done", detail: "the final event leaves 0 B, closes the parser, and releases the reader" },
        ],
        artifact: "policy complete\n17 chunks → 14 events → 10 token deltas\nremainder 0 B · terminal done · resources released yes",
      });
      return;
    }
    if (variant === "scheduling") {
      const continuous = policy === "continuous";
      showResult({
        metrics: [
          { label: "Policy", value: continuous ? "Continuous" : "Static" },
          { label: "Iterations", value: continuous ? "88" : "116" },
          { label: "Utilization", value: continuous ? "86%" : "61%" },
          { label: "P95 wait", value: continuous ? "7 steps" : "19 steps" },
        ],
        trace: continuous ? [
          { label: "Iteration 01", detail: "accept a, b, c · d waits · 11 pages active" },
          { label: "Iteration 14", detail: "mark a complete · keep its id · release its KV pages" },
          { label: "Iteration 15", detail: "move d into the open decode slot" },
          { label: "Iteration 31", detail: "b completes · 4 pages returned" },
          { label: "Iteration 88", detail: "final request completes · allocator empty" },
        ] : [
          { label: "Batch 01", detail: "accept a, b, c · d waits · the batch can’t change until the longest request finishes" },
          { label: "Iteration 14", detail: "a completes; its decode slot idles even though d is queued", tone: "warning" },
          { label: "Idle slots", detail: "finished sequences can release memory, but this policy doesn’t fill their open batch spots", tone: "warning" },
          { label: "Batch 02", detail: "d and the other waiting requests can start only after the first batch finishes" },
          { label: "Iteration 116", detail: "final request completes" },
        ],
        artifact: continuous
          ? "Same arrivals · finish → keep id → release pages → accept another request next iteration.\nThis fixed workload: 88 iterations · 86% utilization · p95 wait 7."
          : "Same arrivals · finished spots stay idle until the whole batch ends.\nThis fixed workload: 116 iterations · 61% utilization · p95 wait 19.",
      });
      return;
    }
    const scenarios: Record<string, { metrics: Array<{ label: string; value: string }>; trace: Array<{ label: string; detail: string; tone?: string }>; artifact: string }> = {
      "queue-timeout": {
        metrics: [{ label: "Retry", value: "yes" }, { label: "Tokens visible", value: "0" }, { label: "Attempts", value: "2" }, { label: "TTFT · attempt 2", value: "83 ms" }, { label: "End to end", value: "541 ms" }, { label: "Outcome", value: "complete" }],
        trace: [
          { label: "Accept", detail: "logical request r-201 · active attempt r-201.1 · index 0/1" },
          { label: "Queue timeout", detail: "r-201.1 queue 120 ms · transient · visible tokens 0", tone: "warning" },
          { label: "Retry check", detail: "true ∧ 0 visible ∧ 0 + 1 < 2 → retire r-201.1; create r-201.2" },
          { label: "Queue + prefill", detail: "r-201.2 queue 14 ms + prefill 69 ms → TTFT 83 ms" },
          { label: "Stream", detail: "r-201.2 emits 10 ordered deltas · decode 338 ms" },
          { label: "Complete", detail: "r-201.2 streaming → complete at 421 ms for this attempt · reader and KV pages released" },
          { label: "Late event", detail: "ignore the token tagged r-201.1 because r-201.2 replaced it · state and resource counts don’t change", tone: "warning" },
        ],
        artifact: "request r-201\nattempts r-201.1 timeout → r-201.2 complete\nqueue 120 + attempt-2 total 421 = end-to-end 541 ms\nlate events rejected 1 · open readers 0 · allocated KV pages 0",
      },
      "malformed-frame": {
        metrics: [{ label: "Retry", value: "no" }, { label: "Tokens visible", value: "6" }, { label: "TTFT", value: "74 ms" }, { label: "Parser errors", value: "1" }, { label: "Late rejected", value: "1" }, { label: "Outcome", value: "error" }],
        trace: [
          { label: "Accept", detail: "logical request r-202 · active attempt r-202.1 · index 0/1" },
          { label: "First token", detail: "queue 12 ms + prefill 62 ms → TTFT 74 ms" },
          { label: "Visible output", detail: "r-202.1 applies six ordered token events" },
          { label: "Parse error", detail: "invalid JSON frame at 192 ms · not a temporary error", tone: "error" },
          { label: "Retry check", detail: "not temporary ∧ 6 visible tokens → don’t retry automatically; keep the partial output" },
          { label: "Final state", detail: "r-202.1 streaming → error · cancel the reader and discard leftover parser text" },
          { label: "Late event", detail: "the final error state ignores a later token tagged r-202.1 · open readers 0", tone: "warning" },
        ],
        artifact: "request r-202 · attempt r-202.1\nqueue 12 ms · prefill 62 ms · TTFT 74 ms · error 192 ms\npartial tokens preserved 6 · retry false\nlate events rejected 1 · open readers 0 · parser remainders 0",
      },
      "worker-crash": {
        metrics: [{ label: "Retry", value: "yes" }, { label: "Tokens visible", value: "0" }, { label: "Worker restarts", value: "1" }, { label: "TTFT · attempt 2", value: "101 ms" }, { label: "Late rejected", value: "1" }, { label: "Outcome", value: "complete" }],
        trace: [
          { label: "Accept", detail: "logical request r-203 · active attempt r-203.1 · index 0/1" },
          { label: "Worker crash", detail: "r-203.1 exits during model loading at 44 ms · transient · visible tokens 0", tone: "error" },
          { label: "Retry check", detail: "true ∧ 0 visible ∧ 0 + 1 < 2 → retire the attempt and stop worker 1" },
          { label: "Restart", detail: "worker 2 owns r-203.2 and starts a fresh model run · queue 16 ms + prefill 85 ms" },
          { label: "First token", detail: "r-203.2 TTFT 101 ms · decode 302 ms" },
          { label: "Complete", detail: "r-203.2 finishes at 403 ms for this attempt · worker 2 stays healthy; release the request resources" },
          { label: "Late event", detail: "ignore worker 1’s r-203.1 message because r-203.2 is active", tone: "warning" },
        ],
        artifact: "request r-203\nattempts r-203.1 crash → r-203.2 complete\nworkers started 2 · crashed 1 · request resource owners released 2/2\nlate events rejected 1 · allocated KV pages 0",
      },
      "user-abort": {
        metrics: [{ label: "Retry", value: "no" }, { label: "Tokens visible", value: "11" }, { label: "TTFT", value: "74 ms" }, { label: "Abort latency", value: "14 ms" }, { label: "Late rejected", value: "1" }, { label: "Outcome", value: "cancelled" }],
        trace: [
          { label: "Accept", detail: "logical request r-204 · active attempt r-204.1 · index 0/1" },
          { label: "First token", detail: "queue 11 ms + prefill 63 ms → TTFT 74 ms" },
          { label: "Streaming", detail: "r-204.1 applies eleven token events before the user presses stop" },
          { label: "Abort", detail: "AbortSignal reaches the reader and worker at 286 ms · this came from the user" },
          { label: "Final state", detail: "r-204.1 streaming → canceled in 14 ms · keep the partial message · don’t retry" },
          { label: "Release", detail: "cancel the reader · run the generator cleanup · release the KV pages" },
          { label: "Late event", detail: "ignore a token tagged r-204.1 that arrives after canceling", tone: "warning" },
        ],
        artifact: "request r-204 · attempt r-204.1\nqueue 11 ms · prefill 63 ms · TTFT 74 ms\nabort 286 ms → cancelled 300 ms · latency 14 ms\nlate events rejected 1 · open readers 0 · allocated KV pages 0",
      },
    };
    showResult(scenarios[failure]);
  };

  return (
    <>
      {variant === "scheduling" ? (
        <div className="simulation-controls" role="group" aria-label="Scheduling policy"><span>Scheduling policy</span><button aria-pressed={policy === "static"} className={policy === "static" ? "selected" : ""} type="button" onClick={() => { setPolicy("static"); setResult(null); replay.reset(); }}>Static batch</button><button aria-pressed={policy === "continuous"} className={policy === "continuous" ? "selected" : ""} type="button" onClick={() => { setPolicy("continuous"); setResult(null); replay.reset(); }}>Continuous</button></div>
      ) : null}
      {variant === "streaming" ? (
        <div className="simulation-controls" role="group" aria-label="Stream policy">
          <span>Stream policy</span>
          <button aria-pressed={streamPolicy === "complete"} className={streamPolicy === "complete" ? "selected" : ""} type="button" onClick={() => { setStreamPolicy("complete"); setResult(null); replay.reset(); }}>Complete stream</button>
          <button aria-pressed={streamPolicy === "cancel"} className={streamPolicy === "cancel" ? "selected" : ""} type="button" onClick={() => { setStreamPolicy("cancel"); setResult(null); replay.reset(); }}>Cancel after 4 tokens</button>
        </div>
      ) : null}
      {variant === "reliability" ? (
        <div className="simulation-controls"><label><span>Failure to try</span><select value={failure} onChange={(event) => { setFailure(event.target.value); setResult(null); replay.reset(); }}><option value="queue-timeout">Queue timeout</option><option value="malformed-frame">Malformed frame</option><option value="worker-crash">Worker crash</option><option value="user-abort">User abort</option></select></label></div>
      ) : null}
      <div className="experiment-action"><p>{variant === "streaming" ? "Chunk boundaries · cancellation · cleanup" : variant === "reliability" ? "Request and attempt ids · phase timing · cleanup" : "Queue, prefill, decode, and cache metrics"}</p><button type="button" onClick={replay.playing ? replay.pause : run}>{replay.playing ? "Pause trace" : result ? "Replay trace again" : "Replay trace"}</button></div>
      {result ? (
        <div className="simulation-result">
          <div className="metric-grid">{result.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}</div>
          <ReplayTrace
            label="Inspect request trace step"
            items={result.trace}
            current={Math.min(replay.step, result.trace.length - 1)}
            onSelect={replay.select}
          />
          {replay.step === result.trace.length - 1
            ? <pre className="simulation-artifact">{result.artifact}</pre>
            : <p className="replay-explanation">The final trace artifact appears after the last event. Select any waiting event to inspect it directly.</p>}
        </div>
      ) : null}
    </>
  );
}

function ProductExperiment({ variant, onComplete }: { variant: ProductVariant } & ExperimentProps) {
  const [stateFlow, setStateFlow] = useState<"complete" | "cancel" | "regenerate">("complete");
  const [budget, setBudget] = useState(26);
  const [streamProfile, setStreamProfile] = useState<StreamingUiProfile>("burst");
  const [contextFlow, setContextFlow] = useState<ContextActionFlow>("stop");
  const stateReplay = useReplaySequence(onComplete, 520);
  const streamReplay = useReplaySequence(onComplete, 620);
  const contextReplay = useReplaySequence(onComplete, 720);
  const qualityReplay = useReplaySequence(onComplete, 680);
  const stateTraces = {
    complete: [
      { number: 1, action: "USER_MESSAGE", status: "complete", messageId: "m-u1", attemptId: "—", requestId: "—", content: "Explain causal masking.", canStop: false, canRegenerate: false, applied: true, evidence: "state revision 0 → 1 · conversation order appends m-u1" },
      { number: 2, action: "START_ATTEMPT", status: "queued", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "", canStop: false, canRegenerate: false, applied: true, evidence: "revision 1 → 2 · new m-a1 record · keep the same m-u1 object" },
      { number: 3, action: "STREAM_START", status: "streaming", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "", canStop: true, canRegenerate: false, applied: true, evidence: "revision 2 → 3 · request status queued → streaming" },
      { number: 4, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "A causal", canStop: true, canRegenerate: false, applied: true, evidence: "revision 3 → 4 · replace m-a1 · keep the same m-u1 object" },
      { number: 5, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "A causal mask removes future positions.", canStop: true, canRegenerate: false, applied: true, evidence: "revision 4 → 5 · m-a1 replaced · ordered ids unchanged" },
      { number: 6, action: "COMPLETE", status: "complete", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "A causal mask removes future positions.", canStop: false, canRegenerate: true, applied: true, evidence: "revision 5 → 6 · final request releases the active controls" },
    ],
    cancel: [
      { number: 7, action: "USER_MESSAGE", status: "complete", messageId: "m-u2", attemptId: "—", requestId: "—", content: "Give one implementation detail.", canStop: false, canRegenerate: false, applied: true, evidence: "revision 6 → 7 · conversation order appends m-u2" },
      { number: 8, action: "START_ATTEMPT", status: "queued", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "", canStop: false, canRegenerate: false, applied: true, evidence: "revision 7 → 8 · create ids for the second message, attempt, and request" },
      { number: 9, action: "STREAM_START", status: "streaming", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "", canStop: true, canRegenerate: false, applied: true, evidence: "revision 8 → 9 · canStop turns on because a request is streaming" },
      { number: 10, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "Set future logits", canStop: true, canRegenerate: false, applied: true, evidence: "revision 9 → 10 · replace m-a2 · keep every other message" },
      { number: 11, action: "CANCEL_REQUEST", status: "cancelled", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "Set future logits", canStop: false, canRegenerate: true, applied: true, evidence: "revision 10 → 11 · keep the partial text · request is now final" },
      { number: 12, action: "TOKEN_DELTA", status: "cancelled", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "Set future logits", canStop: false, canRegenerate: true, applied: false, evidence: "revision stays 11 · ignore the late delta · no objects change" },
    ],
    regenerate: [
      { number: 13, action: "EDIT_MESSAGE", status: "complete", messageId: "m-u1", attemptId: "—", requestId: "—", content: "Explain causal masking clearly.", canStop: false, canRegenerate: false, applied: true, evidence: "revision 11 → 12 · m-u1 revision 0 → 1 · keep the older record" },
      { number: 14, action: "REGENERATE", status: "queued", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "", canStop: false, canRegenerate: false, applied: true, evidence: "revision 12 → 13 · same message position · new attempt and request ids" },
      { number: 15, action: "STREAM_START", status: "streaming", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "", canStop: true, canRegenerate: false, applied: true, evidence: "revision 13 → 14 · keep a-17.1 in history · make a-17.3 active" },
      { number: 16, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "A causal mask", canStop: true, canRegenerate: false, applied: true, evidence: "revision 14 → 15 · replace the active assistant record without changing the old one" },
      { number: 17, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "A causal mask sets future attention logits to negative infinity.", canStop: true, canRegenerate: false, applied: true, evidence: "revision 15 → 16 · conversation order and user records unchanged" },
      { number: 18, action: "COMPLETE", status: "complete", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "A causal mask sets future attention logits to negative infinity.", canStop: false, canRegenerate: true, applied: true, evidence: "revision 16 → 17 · attempt a-17.3 is final · release the request resources" },
    ],
  } as const;
  if (variant === "state") {
    const stateTrace = stateTraces[stateFlow];
    const current = stateTrace[Math.min(stateReplay.step, stateTrace.length - 1)];
    const setFlow = (flow: typeof stateFlow) => {
      setStateFlow(flow);
      stateReplay.reset();
    };
    return (
      <>
        <div className="simulation-controls state-flow-controls" role="group" aria-label="Reducer flow to view"><span>Flow to view</span><button aria-pressed={stateFlow === "complete"} className={stateFlow === "complete" ? "selected" : ""} type="button" onClick={() => setFlow("complete")}>Complete · 1–6</button><button aria-pressed={stateFlow === "cancel"} className={stateFlow === "cancel" ? "selected" : ""} type="button" onClick={() => setFlow("cancel")}>Cancel + late · 7–12</button><button aria-pressed={stateFlow === "regenerate"} className={stateFlow === "regenerate" ? "selected" : ""} type="button" onClick={() => setFlow("regenerate")}>Edit + regenerate · 13–18</button></div>
        <div className="experiment-action"><p>18 reducer events · action, status, and message state</p><button type="button" onClick={stateReplay.playing ? stateReplay.pause : () => stateReplay.start(stateTrace.length)}>{stateReplay.playing ? "Pause reducer replay" : stateReplay.started ? "Replay selected flow again" : "Replay selected flow"}</button></div>
        {stateReplay.started ? <div className="simulation-result product-simulation">
          <div className="state-inspector"><div><span>Action</span><strong>{current.action}</strong></div><div><span>Status</span><strong>{current.status}</strong></div><div><span>Reducer result</span><strong>{current.applied ? "applied" : "ignored"}</strong></div><div><span>Controls now</span><strong>{`stop ${current.canStop ? "on" : "off"} · regenerate ${current.canRegenerate ? "on" : "off"}`}</strong></div></div>
          <div className="state-identity-strip"><span><em>messageId</em><code>{current.messageId}</code></span><span><em>attemptId</em><code>{current.attemptId}</code></span><span><em>requestId</em><code>{current.requestId}</code></span></div>
          <article className={`mini-message ${current.status}`}><span>{current.messageId.startsWith("m-u") ? "User" : "Assistant"} · {current.messageId}</span><p>{current.content || "Waiting for output…"}</p></article>
          <p className={`state-revision-evidence${current.applied ? "" : " ignored"}`}><b>What changed</b>{current.evidence}</p>
          <div className="trace-list compact-trace">{stateTrace.map((event, index) => <button aria-label={`Action ${event.number}: ${event.action}`} aria-current={index === stateReplay.step ? "step" : undefined} className={index === stateReplay.step ? "active" : index < stateReplay.step ? "complete" : "pending"} type="button" onClick={() => stateReplay.select(index)} key={`${event.action}-${event.number}-${index}`}><span>{event.number}</span><strong>{event.action}</strong></button>)}</div>
        </div> : <p className="experiment-empty">Replay the selected flow to reveal one reducer transition at a time.</p>}
      </>
    );
  }
  if (variant === "streaming-ui") {
    const profile = STREAMING_UI_PROFILES[streamProfile];
    const chooseProfile = (nextProfile: StreamingUiProfile) => {
      setStreamProfile(nextProfile);
      streamReplay.reset();
    };
    const visibleCharacterCount = Math.ceil(profile.output.length * ((streamReplay.step + 1) / profile.trace.length));
    const replayComplete = streamReplay.step === profile.trace.length - 1;
    return (
      <>
        <div className="simulation-controls streaming-profile-controls" role="group" aria-label="Streaming timing profile">
          <span>Timing profile</span>
          {(Object.keys(STREAMING_UI_PROFILES) as StreamingUiProfile[]).map((key) => (
            <button aria-pressed={streamProfile === key} className={streamProfile === key ? "selected" : ""} type="button" onClick={() => chooseProfile(key)} key={key}>{STREAMING_UI_PROFILES[key].label}</button>
          ))}
        </div>
        <div className="experiment-action"><p>{profile.description}</p><button type="button" onClick={streamReplay.playing ? streamReplay.pause : () => streamReplay.start(profile.trace.length)}>{streamReplay.playing ? "Pause stream replay" : streamReplay.started ? `Replay ${profile.label.toLowerCase()} again` : `Replay ${profile.label.toLowerCase()} trace`}</button></div>
        {streamReplay.started ? (
          <div className="simulation-result product-simulation streaming-ui-result">
            <div className="metric-grid">{profile.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}</div>
            <article className={`stream-preview ${replayComplete ? profile.status : "streaming"}`} aria-live="polite"><span>Assistant · {replayComplete ? profile.status : "streaming"}</span><p>{profile.output.slice(0, visibleCharacterCount)}{replayComplete ? "" : "…"}</p><i><b style={{ width: `${Math.round(((streamReplay.step + 1) / profile.trace.length) * (profile.status === "cancelled" ? 38 : 100))}%` }} /></i></article>
            <ReplayTrace
              className="streaming-ui-trace"
              label="Inspect token stream event"
              items={profile.trace.map((event) => ({ marker: event.time, label: event.label, detail: event.detail }))}
              current={streamReplay.step}
              onSelect={streamReplay.select}
            />
            {replayComplete ? (
              <>
                <div className="streaming-policy-evidence">
                  <span><b>Auto-scroll</b><code>{profile.scroll}</code></span>
                  <span><b>Final cleanup</b><code>{profile.cleanup}</code></span>
                  <span><b>Exact dropped text</b><code>{profile.dropped}</code></span>
                </div>
                <div className="streaming-announcement-log">
                  <span>Live-region updates · {profile.announcements.length}</span>
                  <ol>{profile.announcements.map((announcement, index) => <li key={`${index}-${announcement}`}><b>{index + 1}</b><code>{announcement}</code></li>)}</ol>
                </div>
              </>
            ) : <p className="replay-explanation">Cleanup and announcement evidence appears when the replay reaches its terminal event.</p>}
          </div>
        ) : null}
      </>
    );
  }
  if (variant === "context-actions") {
    const historyTurns = [
      {
        label: "Older short turn",
        messages: [
          { id: "m-u1", role: "user", tokens: 4, text: "What is a causal mask?" },
          { id: "m-a1", role: "assistant", tokens: 5, text: "It blocks attention to future positions." },
        ],
      },
      {
        label: "Newer large turn",
        messages: [
          { id: "m-u2", role: "user", tokens: 8, text: "Derive the complete masked-attention computation." },
          { id: "m-a2", role: "assistant", tokens: 12, text: "Project Q, K, and V; scale QKᵀ; mask future logits; then apply softmax." },
        ],
      },
    ] as const;
    const flow = {
      stop: {
        label: "Stop",
        activeUser: { id: "m-u3", tokens: 6, text: "Give one implementation detail." },
        outcome: "Stop r-31, keep m-a3 and the partial text already on screen, then mark attempt a-31 canceled.",
        branch: "s1 → m-u3 → m-a3",
        invalidation: "none · stop changes the request state, not the conversation branch",
        attempt: { messageId: "m-a3", parentUserId: "m-u3", attemptId: "a-31", requestId: "r-31", status: "cancelled", partialContent: "Set future logits", modelId: "latent-local-135m", promptVersion: "chat-v3", sampling: { temperature: 0.7, topP: 0.9 } },
      },
      retry: {
        label: "Retry / regenerate",
        activeUser: { id: "m-u3", tokens: 6, text: "Give one implementation detail." },
        outcome: "Keep canceled m-a3 / a-31 / r-31, then create queued m-a4 / a-32 / r-32 from the same m-u3 prompt.",
        branch: "s1 → m-u3 ↘ m-a3 cancelled · ↗ m-a4 queued",
        invalidation: "none · both assistant attempts share parent m-u3",
        attempt: { messageId: "m-a4", parentUserId: "m-u3", attemptId: "a-32", requestId: "r-32", status: "queued", content: "", modelId: "latent-local-135m", promptVersion: "chat-v3", sampling: { temperature: 0.7, topP: 0.9 } },
      },
      edit: {
        label: "Edit prompt",
        activeUser: { id: "m-u3-e1", tokens: 8, text: "Show the exact mask assignment in JavaScript." },
        outcome: "Create edited user message m-u3-e1 and queued m-a5 / a-33 / r-33. Keep m-a3 in history, but leave it off the edited branch.",
        branch: "s1 → m-u3-e1 → m-a5 queued",
        invalidation: "m-u3 → m-a3 stays in history · left out of branch m-u3-e1",
        attempt: { messageId: "m-a5", parentUserId: "m-u3-e1", attemptId: "a-33", requestId: "r-33", status: "queued", content: "", modelId: "latent-local-135m", promptVersion: "chat-v3", sampling: { temperature: 0.7, topP: 0.9 } },
      },
    }[contextFlow];
    const system = { id: "s1", role: "system", tokens: 6, text: "Answer as a concise technical tutor." } as const;
    const requiredTokens = system.tokens + flow.activeUser.tokens;
    let used = requiredTokens;
    const selectedTurns: typeof historyTurns[number][] = [];
    const decisions = new Map<string, string>();
    for (let index = historyTurns.length - 1; index >= 0; index -= 1) {
      const turn = historyTurns[index];
      const tokens = turn.messages.reduce((sum, message) => sum + message.tokens, 0);
      if (used + tokens <= budget) {
        selectedTurns.unshift(turn);
        used += tokens;
        decisions.set(turn.label, `included · ${tokens} tokens fit · ${budget - used} remain`);
      } else {
        decisions.set(turn.label, `excluded · ${tokens} tokens exceed ${Math.max(0, budget - used)} remaining`);
      }
    }
    const includedMessageIds = [system.id, ...selectedTurns.flatMap((turn) => turn.messages.map((message) => message.id)), flow.activeUser.id];
    const attemptRecord = { ...flow.attempt, includedMessageIds };
    const chooseContextFlow = (nextFlow: ContextActionFlow) => {
      setContextFlow(nextFlow);
      contextReplay.reset();
    };
    return (
      <>
        <div className="simulation-controls context-action-controls" role="group" aria-label="Conversation action">
          <span>Conversation action</span>
          <button aria-pressed={contextFlow === "stop"} className={contextFlow === "stop" ? "selected" : ""} type="button" onClick={() => chooseContextFlow("stop")}>Stop</button>
          <button aria-pressed={contextFlow === "retry"} className={contextFlow === "retry" ? "selected" : ""} type="button" onClick={() => chooseContextFlow("retry")}>Retry / regenerate</button>
          <button aria-pressed={contextFlow === "edit"} className={contextFlow === "edit" ? "selected" : ""} type="button" onClick={() => chooseContextFlow("edit")}>Edit prompt</button>
        </div>
        <div className="simulation-controls context-budget-controls">
          <label><span>Request budget · {budget} tokens</span><input aria-label="Request budget" type="range" min="14" max="42" value={budget} onChange={(event) => { setBudget(Number(event.target.value)); contextReplay.reset(); }} /></label>
          <code>{used}/{budget} used</code>
        </div>
        <div className="experiment-action"><p>Conversation branch · request trace · exact token counts</p><button type="button" onClick={contextReplay.playing ? contextReplay.pause : () => contextReplay.start(3)}>{contextReplay.playing ? "Pause request replay" : contextReplay.started ? "Replay selected request again" : "Replay selected request"}</button></div>
        {contextReplay.started ? <div className="simulation-result product-simulation context-action-result">
          <ReplayStages
            label="Inspect request construction stage"
            stages={[
              { label: "Apply action", value: flow.label },
              { label: "Build context", value: `${used}/${budget} tokens` },
              { label: "Save record", value: flow.attempt.attemptId },
            ]}
            current={contextReplay.step}
            onSelect={contextReplay.select}
          />
          <div className="context-action-summary">
            <span><b>Applied action</b><strong>{flow.label}</strong></span>
            <p>{flow.outcome}</p>
          </div>
          {contextReplay.step >= 1 ? (
            <>
              <div className="context-branch-evidence">
                <span><b>Active branch</b><code>{flow.branch}</code></span>
                <span><b>What happens to replies</b><code>{flow.invalidation}</code></span>
                <span><b>Saved partial answer</b><code>m-a3 · a-31 · r-31 · cancelled · “Set future logits”</code></span>
              </div>
              <div className="context-request-heading">
                <div><span>Messages sent to the model</span><strong>{includedMessageIds.join(" → ")}</strong></div>
                <code>{used} selected / {budget} budget</code>
              </div>
              <div className="context-decision-list">
                <article className="included"><span>s1 · system</span><p>{system.text}</p><code>{system.tokens} tokens · required</code></article>
                {historyTurns.map((turn) => {
                  const included = selectedTurns.includes(turn);
                  return <article className={included ? "included" : "excluded"} key={turn.label}><span>{turn.messages.map((message) => message.id).join(" + ")} · complete turn</span><p>{turn.label}</p><code>{decisions.get(turn.label)}</code></article>;
                })}
                {contextFlow === "edit" ? <article className="excluded"><span>m-u3 → m-a3 · earlier branch</span><p>You can still inspect the original prompt and canceled reply.</p><code>left out · replaced by edit m-u3-e1</code></article> : null}
                <article className="included"><span>{flow.activeUser.id} · active user</span><p>{flow.activeUser.text}</p><code>{flow.activeUser.tokens} tokens · required</code></article>
                <article className="excluded"><span>{flow.attempt.messageId} · assistant output</span><p>{flow.attempt.status === "cancelled" ? flow.attempt.partialContent : "No output yet."}</p><code>excluded · {flow.attempt.status} output is not request input</code></article>
              </div>
            </>
          ) : <p className="replay-explanation">Next, inspect which complete turns fit inside the request budget.</p>}
          {contextReplay.step >= 2
            ? <div className="branch-record context-attempt-record"><span>Full attempt record</span><code>{JSON.stringify(attemptRecord, null, 2)}</code></div>
            : null}
        </div> : <p className="experiment-empty">Replay the request to see the action, context selection, and saved attempt record in order.</p>}
      </>
    );
  }
  const checks = runCapstoneQualityAudit();
  const categories = [...new Set(checks.map((check) => check.category))];
  const automatedChecks = checks.filter((check) => check.verification === "automated-pure");
  const specificationChecks = checks.filter((check) => check.verification === "specification");
  const passed = automatedChecks.filter((check) => check.passed).length;
  const qualityStages = [
    ...categories.map((category) => ({ label: qualityCategoryLabels[category] ?? category, value: "checks + specs" })),
    { label: "Hands-on", value: "manual verification" },
  ];
  const activeQualityCategory = categories[Math.min(qualityReplay.step, categories.length - 1)];
  const showingManualChecks = qualityReplay.step === categories.length;
  return (
    <>
      <div className="experiment-action"><p>{automatedChecks.length} automated code checks · {specificationChecks.length} written requirements · browser, assistive-technology, and device behavior still need hands-on testing</p><button type="button" onClick={qualityReplay.playing ? qualityReplay.pause : () => qualityReplay.start(qualityStages.length)}>{qualityReplay.playing ? "Pause contract review" : qualityReplay.started ? "Review checks again" : "Run checks + review specs"}</button></div>
      {qualityReplay.started ? (
        <div className="quality-audit-result">
          <div className="quality-audit-summary"><span>Automated code-check result</span><strong>{passed}/{automatedChecks.length} passed</strong><code>{specificationChecks.length} requirements still need browser or hands-on work</code></div>
          <ReplayStages label="Inspect product contract category" stages={qualityStages} current={qualityReplay.step} onSelect={qualityReplay.select} />
          {!showingManualChecks ? (
            <section className="quality-check-group" key={activeQualityCategory}>
              <header><span>{qualityCategoryLabels[activeQualityCategory] ?? activeQualityCategory}</span><code>{checks.filter((check) => check.category === activeQualityCategory && check.verification === "automated-pure" && check.passed).length}/{checks.filter((check) => check.category === activeQualityCategory && check.verification === "automated-pure").length} automated · {checks.filter((check) => check.category === activeQualityCategory && check.verification === "specification").length} spec</code></header>
              <div className="quality-grid">
                {checks.filter((check) => check.category === activeQualityCategory).map((check) => <article className={check.verification === "specification" ? "specification" : check.passed ? "passed" : "failed"} key={check.label}><i>{check.verification === "specification" ? "◇" : check.passed ? "✓" : "×"}</i><div><strong>{check.label}</strong><p>{check.detail}</p></div></article>)}
              </div>
            </section>
          ) : <section className="quality-manual-boundary">
            <header><span>Hands-on testing required</span><code>not automated</code></header>
            <p>The code checks and written specs can’t verify these real interactions by themselves. The full-project build separately opens the capstone and checks submit, stream, stop, late-event handling, and visible errors.</p>
            <ol>{MANUAL_PRODUCT_VERIFICATION.map((check) => <li key={check.label}><strong>{check.label}</strong><span>{check.detail}</span></li>)}</ol>
          </section>}
        </div>
      ) : null}
    </>
  );
}

type FundamentalsResult = {
  control: string;
  minimum: number;
  maximum: number;
  step: number;
  initial: number;
  metrics: Array<{ label: string; value: string }>;
  trace: Array<{ label: string; detail: string }>;
};

function fundamentalsResult(variant: string, value: number): FundamentalsResult {
  const rounded = Math.round(value);
  const definitions: Record<string, () => Omit<FundamentalsResult, "control" | "minimum" | "maximum" | "step" | "initial">> = {
    "array-shapes": () => ({
      metrics: [
        { label: "Rank", value: "2" },
        { label: "Shape", value: `(${rounded}, 3)` },
        { label: "Values", value: String(rounded * 3) },
      ],
      trace: [
        { label: "Choose rows", detail: `${rounded} rows` },
        { label: "Keep three columns", detail: "3 values in each row" },
        { label: "Count entries", detail: `${rounded} × 3 = ${rounded * 3}` },
      ],
    }),
    "vector-operations": () => {
      const length = Math.hypot(value, 4);
      return {
        metrics: [{ label: "Vector", value: `[${value.toFixed(1)}, 4]` }, { label: "Squared sum", value: (value * value + 16).toFixed(2) }, { label: "L2 length", value: length.toFixed(3) }],
        trace: [{ label: "Square", detail: `${value.toFixed(1)}² + 4²` }, { label: "Add", detail: (value * value + 16).toFixed(2) }, { label: "Square root", detail: length.toFixed(3) }],
      };
    },
    "dot-products": () => {
      const cosine = value / Math.hypot(value, 1);
      return {
        metrics: [{ label: "Left", value: "[1, 0]" }, { label: "Right", value: `[${value.toFixed(1)}, 1]` }, { label: "Cosine", value: cosine.toFixed(3) }],
        trace: [{ label: "Dot product", detail: `1×${value.toFixed(1)} + 0×1 = ${value.toFixed(1)}` }, { label: "Lengths", detail: `1 and ${Math.hypot(value, 1).toFixed(3)}` }, { label: "Normalize", detail: cosine.toFixed(3) }],
      };
    },
    "matrix-multiplication": () => ({
      metrics: [{ label: "Input", value: `[${value.toFixed(1)}, 1]` }, { label: "Row 1", value: (value + 2).toFixed(2) }, { label: "Row 2", value: (-value + 1).toFixed(2) }],
      trace: [{ label: "First row", detail: `1×${value.toFixed(1)} + 2×1` }, { label: "Second row", detail: `−1×${value.toFixed(1)} + 1×1` }, { label: "Output", detail: `[${(value + 2).toFixed(2)}, ${(-value + 1).toFixed(2)}]` }],
    }),
    "batches-and-broadcasting": () => ({
      metrics: [{ label: "Input shape", value: `(${rounded}, 2)` }, { label: "Weight shape", value: "(3, 2)" }, { label: "Output shape", value: `(${rounded}, 3)` }],
      trace: [{ label: "Batch rows", detail: `${rounded} separate vectors` }, { label: "Shared weights", detail: "the same (3, 2) matrix for every row" }, { label: "Shared bias", detail: "one 3-value bias added to every output row" }],
    }),
    "training-data": () => ({
      metrics: [{ label: "All rows", value: "8" }, { label: "Training", value: String(8 - rounded) }, { label: "Validation", value: String(rounded) }],
      trace: [{ label: "Start", detail: "8 labeled examples" }, { label: "Hold out", detail: `${rounded} rows are never used for updates` }, { label: "Train", detail: `${8 - rounded} rows can update parameters` }],
    }),
    "linear-regression": () => {
      const prediction = 2 * value + 0.5;
      const loss = (prediction - 5) ** 2;
      return {
        metrics: [{ label: "Weight", value: value.toFixed(2) }, { label: "Prediction", value: prediction.toFixed(2) }, { label: "Squared error", value: loss.toFixed(3) }],
        trace: [{ label: "Feature", detail: "x = 2" }, { label: "Predict", detail: `2×${value.toFixed(2)} + 0.5 = ${prediction.toFixed(2)}` }, { label: "Compare with target 5", detail: `(${prediction.toFixed(2)} − 5)² = ${loss.toFixed(3)}` }],
      };
    },
    "gradient-descent": () => {
      let weight = 0;
      const xs = [1, 2, 3];
      const targets = [2, 4, 6];
      let loss = 0;
      for (let iteration = 0; iteration < rounded; iteration += 1) {
        const errors = xs.map((x, index) => x * weight - targets[index]);
        loss = errors.reduce((sum, error) => sum + error * error, 0) / errors.length;
        const gradient = 2 * errors.reduce((sum, error, index) => sum + error * xs[index], 0) / errors.length;
        weight -= 0.05 * gradient;
      }
      const finalErrors = xs.map((x, index) => x * weight - targets[index]);
      loss = finalErrors.reduce((sum, error) => sum + error * error, 0) / finalErrors.length;
      return {
        metrics: [{ label: "Steps", value: String(rounded) }, { label: "Weight", value: weight.toFixed(3) }, { label: "MSE", value: loss.toFixed(4) }],
        trace: [{ label: "Predict", detail: "ŷ = weight × x" }, { label: "Measure slope", detail: "average 2 × error × x" }, { label: "Update", detail: `${rounded} steps with learning rate 0.05` }],
      };
    },
    "binary-classification": () => {
      const probability = value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
      const loss = -Math.log(Math.max(probability, 1e-12));
      return {
        metrics: [{ label: "Logit", value: value.toFixed(2) }, { label: "p(target = 1)", value: probability.toFixed(3) }, { label: "Loss", value: loss.toFixed(3) }],
        trace: [{ label: "Raw score", detail: value.toFixed(2) }, { label: "Sigmoid", detail: probability.toFixed(3) }, { label: "Target is 1", detail: `−log(${probability.toFixed(3)}) = ${loss.toFixed(3)}` }],
      };
    },
    "neural-networks": () => {
      const hidden = [Math.max(0, value), 1];
      const logit = 0.5 * hidden[0] - hidden[1] + 0.1;
      return {
        metrics: [{ label: "Input", value: `[${value.toFixed(1)}, 1]` }, { label: "Hidden after ReLU", value: `[${hidden[0].toFixed(1)}, 1]` }, { label: "Logit", value: logit.toFixed(2) }],
        trace: [{ label: "Dense", detail: `identity weights → [${value.toFixed(1)}, 1]` }, { label: "ReLU", detail: `negative values become 0 → [${hidden[0].toFixed(1)}, 1]` }, { label: "Output layer", detail: `0.5×${hidden[0].toFixed(1)} − 1 + 0.1 = ${logit.toFixed(2)}` }],
      };
    },
  };
  const controls: Record<string, Pick<FundamentalsResult, "control" | "minimum" | "maximum" | "step" | "initial">> = {
    "array-shapes": { control: "Rows", minimum: 1, maximum: 5, step: 1, initial: 2 },
    "vector-operations": { control: "First coordinate", minimum: -4, maximum: 6, step: 0.5, initial: 3 },
    "dot-products": { control: "Right vector x", minimum: -4, maximum: 4, step: 0.5, initial: 1 },
    "matrix-multiplication": { control: "Input x", minimum: -3, maximum: 5, step: 0.5, initial: 2 },
    "batches-and-broadcasting": { control: "Batch rows", minimum: 1, maximum: 6, step: 1, initial: 3 },
    "training-data": { control: "Validation rows", minimum: 1, maximum: 4, step: 1, initial: 2 },
    "linear-regression": { control: "Weight", minimum: -1, maximum: 3, step: 0.1, initial: 1 },
    "gradient-descent": { control: "Update steps", minimum: 1, maximum: 20, step: 1, initial: 5 },
    "binary-classification": { control: "Logit", minimum: -6, maximum: 6, step: 0.25, initial: 0 },
    "neural-networks": { control: "First input", minimum: -3, maximum: 4, step: 0.25, initial: -1 },
  };
  const control = controls[variant] ?? controls["array-shapes"];
  return { ...control, ...(definitions[variant] ?? definitions["array-shapes"])() };
}

function FundamentalsExperiment({ variant, onComplete }: { variant: string } & ExperimentProps) {
  const initial = fundamentalsResult(variant, 0);
  const [value, setValue] = useState(initial.initial);
  const replay = useReplaySequence(onComplete, 560);
  const result = fundamentalsResult(variant, value);
  return (
    <>
      <div className="simulation-controls fundamentals-controls">
        <label><span>{result.control} · {value}</span><input aria-label={result.control} type="range" min={result.minimum} max={result.maximum} step={result.step} value={value} onChange={(event) => { setValue(Number(event.target.value)); replay.reset(); }} /></label>
      </div>
      <div className="experiment-action"><p>Small fixed example · change one value, then run it</p><button type="button" onClick={replay.playing ? replay.pause : () => replay.start(result.trace.length)}>{replay.playing ? "Pause example" : replay.started ? "Run example again" : "Run example"}</button></div>
      {replay.started ? (
        <div className="simulation-result fundamentals-result">
          <div className="metric-grid">{result.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}</div>
          <ReplayTrace label="Inspect example calculation step" items={result.trace} current={replay.step} onSelect={replay.select} />
        </div>
      ) : null}
    </>
  );
}

export function LessonExperiment({ lesson }: { lesson: CourseLesson }) {
  const complete = () => markExperimentComplete(lesson.id);
  return (
    <section className="experiment-lab" id="experiment" aria-labelledby={`experiment-title-${lesson.id}`}>
      <header className="experiment-header">
        <div>
          <span>Experiment</span>
          <h3 id={`experiment-title-${lesson.id}`}>{lesson.experiment.title}</h3>
          <p>{lesson.experiment.intro}</p>
        </div>
      </header>
      <DatasetRecord lesson={lesson} />
      {lesson.experiment.kind === "rnn" ? <RnnExperiment onComplete={complete} trainingText={lesson.dataset.preview} /> : null}
      {lesson.experiment.kind === "neural-lm" ? <NeuralLmExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "bpe" ? <BpeExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "attention" ? <AttentionExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "transformer" ? <TransformerExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "icl" ? <IclExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "systems" && lesson.experiment.variant ? <SystemsExperiment variant={lesson.experiment.variant as SystemsVariant} onComplete={complete} /> : null}
      {lesson.experiment.kind === "product" && lesson.experiment.variant ? <ProductExperiment variant={lesson.experiment.variant as ProductVariant} onComplete={complete} /> : null}
      {lesson.experiment.kind === "fundamentals" && lesson.experiment.variant ? <FundamentalsExperiment variant={lesson.experiment.variant} onComplete={complete} /> : null}
      {lesson.experiment.kind === "harness" && lesson.experiment.variant && isHarnessExperimentVariant(lesson.experiment.variant) ? (
        <Suspense fallback={<p>Preparing trace…</p>}>
          <HarnessExperiment variant={lesson.experiment.variant} onComplete={complete} />
        </Suspense>
      ) : null}
    </section>
  );
}
