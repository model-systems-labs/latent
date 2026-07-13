"use client";

import { useRef, useState } from "react";
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
import { markExperimentComplete, saveCharacterRnnArtifact } from "../lib/learner-state";
import { MANUAL_PRODUCT_VERIFICATION, runCapstoneQualityAudit } from "../lib/capstone-contract";

type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type TextGenerator = (
  input: ModelMessage[] | string,
  options?: Record<string, unknown>,
) => Promise<unknown>;
type IclCondition = "Zero-shot" | "One-shot" | "Few-shot";
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

function LossChart({ values }: { values: number[] }) {
  if (!values.length) return null;
  const sample = values.length > 36 ? values.filter((_, index) => index % Math.ceil(values.length / 36) === 0) : values;
  const minimum = Math.min(...sample);
  const maximum = Math.max(...sample);
  const range = Math.max(maximum - minimum, 1e-9);
  return (
    <div className="loss-chart" aria-label="Training loss from first to last update">
      {sample.map((value, index) => (
        <i key={`${index}-${value}`} style={{ height: `${18 + ((value - minimum) / range) * 82}%` }} />
      ))}
    </div>
  );
}

function DatasetRecord({ lesson }: { lesson: CourseLesson }) {
  return (
    <div className="dataset-record">
      <div>
        <span>Supplied dataset</span>
        <strong>{lesson.dataset.name}</strong>
        <em>{lesson.dataset.preview}</em>
      </div>
      <dl>
        <div><dt>Source</dt><dd>{lesson.dataset.source}</dd></div>
        <div><dt>License</dt><dd>{lesson.dataset.license}</dd></div>
        <div><dt>Size</dt><dd>{lesson.dataset.size}</dd></div>
      </dl>
    </div>
  );
}

type ExperimentProps = { onComplete: () => void };

function RnnExperiment({ onComplete }: ExperimentProps) {
  const [result, setResult] = useState<RnnResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      const trained = trainCharacterRnn();
      setResult(trained);
      saveCharacterRnnArtifact(trained);
      onComplete();
      setRunning(false);
    }, 30);
  };
  return (
    <>
      <div className="experiment-action">
        <p>18 hidden units · sequence length 28 · 600 updates · deterministic seed</p>
        <button type="button" onClick={run} disabled={running}>{running ? "Training…" : result ? "Train again" : "Train RNN"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <div className="metric-grid">
            <span><em>Initial loss</em><strong>{result.initialLoss.toFixed(3)}</strong></span>
            <span><em>Final loss</em><strong>{result.finalLoss.toFixed(3)}</strong></span>
            <span><em>Parameters</em><strong>{result.parameters.toLocaleString()}</strong></span>
            <span><em>Characters</em><strong>{result.vocabularySize}</strong></span>
          </div>
          <LossChart values={result.losses} />
          <article className="sample-output"><span>Autoregressive sample · τ 0.78</span><p>{result.sample}</p></article>
        </div>
      ) : <p className="experiment-empty">Results and a reusable artifact appear here.</p>}
    </>
  );
}

function NeuralLmExperiment({ onComplete }: ExperimentProps) {
  const [result, setResult] = useState<NeuralLmResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      setResult(trainNeuralLanguageModel());
      onComplete();
      setRunning(false);
    }, 30);
  };
  return (
    <>
      <div className="experiment-action">
        <p>Two-word context · 8-dimensional embeddings · fixed train/validation split</p>
        <button type="button" onClick={run} disabled={running}>{running ? "Optimizing…" : result ? "Train again" : "Train language model"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <div className="metric-grid">
            <span><em>Initial validation NLL</em><strong>{result.initialValidationLoss.toFixed(3)}</strong></span>
            <span><em>Final validation NLL</em><strong>{result.finalValidationLoss.toFixed(3)}</strong></span>
            <span><em>Parameters</em><strong>{result.parameters.toLocaleString()}</strong></span>
            <span><em>Vocabulary</em><strong>{result.vocabularySize}</strong></span>
          </div>
          <LossChart values={result.losses} />
          <div className="artifact-grid">
            <article>
              <span>p(next word | “the model”)</span>
              {result.predictions.map((prediction) => (
                <div className="artifact-row" key={prediction.word}><strong>{prediction.word}</strong><i><b style={{ width: `${prediction.probability * 100}%` }} /></i><code>{prediction.probability.toFixed(3)}</code></div>
              ))}
            </article>
            <article>
              <span>Nearest to “model”</span>
              {result.neighbors.map((neighbor) => (
                <div className="neighbor-row" key={neighbor.word}><strong>{neighbor.word}</strong><code>{neighbor.similarity.toFixed(3)} cosine</code></div>
              ))}
            </article>
          </div>
        </div>
      ) : <p className="experiment-empty">Distribution and nearest words appear here.</p>}
    </>
  );
}

function BpeExperiment({ onComplete }: ExperimentProps) {
  const [budget, setBudget] = useState(10);
  const [result, setResult] = useState<BpeResult | null>(null);
  const run = () => {
    setResult(trainBpe(budget));
    onComplete();
  };
  return (
    <>
      <div className="experiment-action bpe-action">
        <label><span>Merge budget · {budget}</span><input type="range" min="2" max="24" value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></label>
        <button type="button" onClick={run}>{result ? "Retrain tokenizer" : "Train tokenizer"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <div className="metric-grid">
            <span><em>Initial symbols</em><strong>{result.initialTokenCount}</strong></span>
            <span><em>Encoded symbols</em><strong>{result.finalTokenCount}</strong></span>
            <span><em>Learned merges</em><strong>{result.merges.length}</strong></span>
            <span><em>Final vocabulary</em><strong>{result.vocabularySize}</strong></span>
          </div>
          <div className="token-artifact"><span>“modeling signals”</span><div>{result.encoded.map((token, index) => <code key={`${token}-${index}`}>{token}</code>)}</div></div>
          <div className="merge-list">
            {result.merges.map((merge, index) => (
              <span key={`${merge.pair.join("-")}-${index}`}><em>{String(index + 1).padStart(2, "0")}</em><code>{merge.pair[0]} + {merge.pair[1]} → {merge.pair.join("")}</code><strong>{merge.count}×</strong></span>
            ))}
          </div>
        </div>
      ) : <p className="experiment-empty">Merges and tokens appear here.</p>}
    </>
  );
}

function AttentionExperiment({ onComplete }: ExperimentProps) {
  const [result, setResult] = useState<AttentionResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      setResult(trainAdditiveAttention());
      onComplete();
      setRunning(false);
    }, 30);
  };
  return (
    <>
      <div className="experiment-action">
        <p>7-unit additive scorer · 2,000 epochs · three semantic alignment roles</p>
        <button type="button" onClick={run} disabled={running}>{running ? "Learning alignment…" : result ? "Train again" : "Train attention"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <div className="metric-grid compact-metrics">
            <span><em>Initial alignment loss</em><strong>{result.losses[0].toFixed(3)}</strong></span>
            <span><em>Final alignment loss</em><strong>{result.losses.at(-1)?.toFixed(3)}</strong></span>
            <span><em>Uniform baseline</em><strong>0.333</strong></span>
          </div>
          <LossChart values={result.losses} />
          <div className="attention-matrix" style={{ gridTemplateColumns: `7rem repeat(${result.source.length}, 1fr)` }}>
            <span />
            {result.source.map((source) => <strong key={source}>{source}</strong>)}
            {result.matrix.flatMap((row, rowIndex) => [
              <strong key={`label-${result.labels[rowIndex]}`}>{result.labels[rowIndex]}</strong>,
              ...row.map((value, columnIndex) => <i key={`${rowIndex}-${columnIndex}`} style={{ background: `rgba(118, 104, 137, ${0.08 + value * 0.82})` }}>{value.toFixed(2)}</i>),
            ])}
          </div>
        </div>
      ) : <p className="experiment-empty">The learned alignment appears here.</p>}
    </>
  );
}

function TransformerExperiment({ onComplete }: ExperimentProps) {
  const [result, setResult] = useState<TransformerResult | null>(null);
  return (
    <>
      <div className="experiment-action">
        <p>8-dimensional token-plus-position vectors · one causal attention head</p>
        <button type="button" onClick={() => { setResult(runCausalAttention()); onComplete(); }}>{result ? "Run again" : "Run attention"}</button>
      </div>
      {result ? (
        <div className="experiment-results">
          <div className="causal-note"><strong>Invariant</strong><span>Every cell above the diagonal is exactly zero after masking and softmax.</span></div>
          <div className="attention-matrix transformer-matrix" style={{ gridTemplateColumns: `6.5rem repeat(${result.tokens.length}, 1fr)` }}>
            <span />
            {result.tokens.map((token, index) => <strong key={`${token}-${index}`}>{token}</strong>)}
            {result.attention.flatMap((row, rowIndex) => [
              <strong key={`row-${rowIndex}`}>{result.tokens[rowIndex]}</strong>,
              ...row.map((value, columnIndex) => <i className={columnIndex > rowIndex ? "masked" : ""} key={`${rowIndex}-${columnIndex}`} style={{ background: columnIndex > rowIndex ? undefined : `rgba(118, 104, 137, ${0.08 + value * 0.82})` }}>{columnIndex > rowIndex ? "—" : value.toFixed(2)}</i>),
            ])}
          </div>
          <div className="context-norms">{result.contextNorms.map((value, index) => <span key={`${result.tokens[index]}-${index}`}><em>{result.tokens[index]}</em><code>‖c‖ {value.toFixed(3)}</code></span>)}</div>
        </div>
      ) : <p className="experiment-empty">The causal matrix appears here.</p>}
    </>
  );
}

function IclExperiment({ onComplete }: ExperimentProps) {
  const generatorRef = useRef<TextGenerator | null>(null);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState("Model not loaded");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<IclRow[]>([]);

  const loadModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    setModelStatus("loading");
    setError("");
    try {
      const transformers = await import("../lib/local-transformer-runtime");
      const progressCallback = (info: unknown) => {
        const update = info as { progress?: number; file?: string; status?: string };
        if (typeof update.progress === "number") setProgress(Math.round(update.progress));
        if (update.file) setDetail(update.file.split("/").at(-1) ?? update.file);
        if (update.status === "ready") setProgress(100);
      };
      const options = { dtype: "q4", progress_callback: progressCallback } as Record<string, unknown>;
      let generator: TextGenerator;
      if ("gpu" in navigator) {
        try {
          setDetail("Initializing WebGPU · q4");
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...options, device: "webgpu" }) as unknown as TextGenerator;
        } catch {
          setDetail("WebGPU unavailable; initializing WASM · q4");
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...options, device: "wasm" }) as unknown as TextGenerator;
        }
      } else {
        generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...options, device: "wasm" }) as unknown as TextGenerator;
      }
      generatorRef.current = generator;
      setModelStatus("ready");
      setProgress(100);
      setDetail("SmolLM2-135M-Instruct · q4 · local");
    } catch (reason) {
      setModelStatus("error");
      setError(reason instanceof Error ? reason.message : "The local model could not be initialized.");
    }
  };

  const runEvaluation = async () => {
    const generator = generatorRef.current;
    if (!generator || running) return;
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
          const raw = extractGeneratedText(result).trim();
          const match = raw.match(/\b(K|M)\b/);
          outputs.push({ input: test.input, expected: test.expected, predicted: match?.[1] ?? null, raw });
        }
        const row = { condition: condition.name, correct: outputs.filter((output) => output.predicted === output.expected).length, total: outputs.length, outputs };
        setRows((current) => [...current, row]);
      }
      setDetail("Evaluation complete · frozen weights throughout");
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local evaluation stopped.");
    } finally {
      setRunning(false);
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
        <div><span>Local model</span><strong>SmolLM2-135M-Instruct · q4</strong><em>{detail}</em></div>
        <i><b style={{ width: `${progress}%` }} /></i>
        <button type="button" onClick={loadModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>{modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${progress}% downloaded` : "Load model · ~181 MB"}</button>
      </div>
      <div className="experiment-action">
        <p>Opaque sentiment labels · 2 held-out cases · exact match · frozen weights</p>
        <button type="button" onClick={runEvaluation} disabled={modelStatus !== "ready" || running}>{running ? "Evaluating…" : rows.length ? "Run evaluation again" : "Run three conditions"}</button>
      </div>
      {error ? <p className="model-error">{error}</p> : null}
      {rows.length ? (
        <div className="icl-result-stack">
          <div className="metric-grid"><span><em>Weights updated</em><strong>0</strong></span><span><em>Changed by examples</em><strong>{changedPredictions}/2</strong></span><span><em>Few-shot accuracy</em><strong>{fewShot?.correct ?? 0}/2</strong></span></div>
          <p className="simulation-artifact">The causal result is prediction sensitivity with frozen weights—not a guarantee that adding more examples improves this small model.</p>
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
      ) : <p className="experiment-empty">Compare zero-, one-, and few-shot results here.</p>}
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
    description: "60 deltas arrive in twelve short bursts before animation-frame boundaries.",
    status: "complete",
    output: "A causal mask prevents each token from reading positions that occur later in the sequence. The masked logits become zero probability after softmax.",
    metrics: [
      { label: "Delivered deltas", value: "60 / 60" },
      { label: "Visual commits", value: "12" },
      { label: "Live announcements", value: "4" },
      { label: "Dropped text", value: "0 chars" },
    ],
    trace: [
      { time: "0–15 ms", label: "Burst 01", detail: "deltas 1–5 enter the pending UI queue in arrival order; no reducer dispatch yet" },
      { time: "16 ms", label: "Frame 01", detail: "flush 5 deltas → one TOKEN_BATCH dispatch → visual commit 1/12" },
      { time: "32–176 ms", label: "Frames 02–11", detail: "ten more frame callbacks flush 50 deltas → commits 2–11; transport order is unchanged" },
      { time: "192 ms", label: "Frame 12", detail: "final 5 deltas flush → commit 12/12 → pending queue length 0" },
      { time: "193 ms", label: "Complete", detail: "terminal status committed; no scheduled frame, pending text, or open reader remains" },
    ],
    scroll: "Following · 24 px from bottom ≤ 80 px · userScrolledUp false",
    announcements: [
      "Assistant: A causal mask prevents",
      "Assistant: each token from reading future positions",
      "Assistant: masked logits become zero probability",
      "Assistant response complete.",
    ],
    cleanup: "complete → flush final pending text → announce completion → release reader",
    dropped: "none",
  },
  steady: {
    label: "Steady",
    description: "60 deltas arrive eight milliseconds apart, usually two per animation frame.",
    status: "complete",
    output: "A causal mask prevents each token from reading positions that occur later in the sequence. The masked logits become zero probability after softmax.",
    metrics: [
      { label: "Delivered deltas", value: "60 / 60" },
      { label: "Visual commits", value: "30" },
      { label: "Live announcements", value: "4" },
      { label: "Dropped text", value: "0 chars" },
    ],
    trace: [
      { time: "0–15 ms", label: "Deltas 01–02", detail: "two parsed token events queue while one frame callback is scheduled" },
      { time: "16 ms", label: "Frame 01", detail: "flush 2 deltas → one TOKEN_BATCH dispatch → visual commit 1/30" },
      { time: "32–464 ms", label: "Frames 02–29", detail: "56 more deltas flush in ordered pairs → commits 2–29" },
      { time: "480 ms", label: "Frame 30", detail: "final 2 deltas flush → commit 30/30 → pending queue length 0" },
      { time: "481 ms", label: "Complete", detail: "terminal status committed; scheduled frame cleared and reader released" },
    ],
    scroll: "Following · 0 px from bottom ≤ 80 px · userScrolledUp false",
    announcements: [
      "Assistant: A causal mask prevents",
      "Assistant: each token from reading future positions",
      "Assistant: masked logits become zero probability",
      "Assistant response complete.",
    ],
    cleanup: "complete → pending queue already empty → announce completion → release reader",
    dropped: "none",
  },
  stalled: {
    label: "Stalled",
    description: "The same response pauses for 440 milliseconds after delta 24, then resumes.",
    status: "complete",
    output: "A causal mask prevents each token from reading positions that occur later in the sequence. The masked logits become zero probability after softmax.",
    metrics: [
      { label: "Delivered deltas", value: "60 / 60" },
      { label: "Visual commits", value: "14" },
      { label: "Live announcements", value: "4" },
      { label: "Dropped text", value: "0 chars" },
    ],
    trace: [
      { time: "0–80 ms", label: "Opening bursts", detail: "deltas 1–24 flush across 5 visual commits; pending queue length returns to 0" },
      { time: "96–520 ms", label: "Transport stall", detail: "no deltas arrive, so no frame is scheduled and no empty reducer dispatch occurs" },
      { time: "536 ms", label: "Resume", detail: "delta 25 schedules the next animation frame without replaying old content" },
      { time: "552–680 ms", label: "Frames 06–14", detail: "deltas 25–60 flush in order → commits 6–14; all 60 deltas are visible" },
      { time: "681 ms", label: "Complete", detail: "terminal status committed; pending queue 0, scheduled frame none, reader released" },
    ],
    scroll: "Paused · 214 px from bottom > 80 px · generation continues without moving the reader",
    announcements: [
      "Assistant: A causal mask prevents",
      "Assistant: response paused; partial text remains available",
      "Assistant: masked logits become zero probability",
      "Assistant response complete.",
    ],
    cleanup: "complete → flush final resumed batch → announce completion → release reader",
    dropped: "none",
  },
  cancelled: {
    label: "Cancelled",
    description: "Cancellation arrives with three delivered deltas still pending before the next frame.",
    status: "cancelled",
    output: "A causal mask prevents each token from reading future",
    metrics: [
      { label: "Delivered deltas", value: "23 / 60" },
      { label: "Visual commits", value: "4" },
      { label: "Live announcements", value: "2" },
      { label: "Dropped text", value: "11 chars" },
    ],
    trace: [
      { time: "0–64 ms", label: "Committed prefix", detail: "deltas 1–20 flush across 4 frame callbacks → visual commits 1–4" },
      { time: "65–69 ms", label: "Pending tail", detail: "deltas 21–23 form the exact uncommitted text “ positions.”; next frame is scheduled" },
      { time: "70 ms", label: "Cancel", detail: "drop 3 pending deltas / 11 characters and cancel the scheduled animation-frame callback" },
      { time: "70 ms", label: "Terminal", detail: "request status becomes cancelled; partial committed response remains visible" },
      { time: "71 ms", label: "Late delta", detail: "one post-cancel event is rejected; reader cancelled and generator return path confirmed" },
    ],
    scroll: "Paused · 18 px from bottom but userScrolledUp true · explicit reader control wins",
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
  const [result, setResult] = useState<{
    metrics: Array<{ label: string; value: string }>;
    trace: Array<{ label: string; detail: string; tone?: string }>;
    artifact: string;
  } | null>(null);

  const run = () => {
    onComplete();
    if (variant === "runtime") {
      setResult({
        metrics: [
          { label: "Queue", value: "18 ms" },
          { label: "Prefill", value: "74 ms" },
          { label: "TTFT", value: "92 ms" },
          { label: "Decode rate", value: "21.4 tok/s" },
        ],
        trace: [
          { label: "Admitted", detail: "request r-104 · prompt 96 · output budget 32 tokens" },
          { label: "Queue", detail: "18 ms waiting for admission" },
          { label: "Prefill", detail: "74 ms · 96 prompt positions processed · 6 KV pages allocated" },
          { label: "First token", detail: "token 1/32 sampled from prefill logits · visible at TTFT 92 ms" },
          { label: "Decode", detail: "31 subsequent one-position forwards produce tokens 2–32 · 21.4 tok/s · cache grows 6 → 8 pages" },
          { label: "Complete", detail: "final sequence length 128 · 8 KV pages released" },
        ],
        artifact: "TTFT = queue 18 ms + prefill 74 ms = 92 ms\noutput 32 = 1 prefill sample + 31 decode forwards\nKV pages 6 → 8 → released",
      });
      return;
    }
    if (variant === "streaming") {
      if (streamPolicy === "cancel") {
        setResult({
          metrics: [
            { label: "Byte chunks read", value: "8 / 17" },
            { label: "Events parsed", value: "5 / 14" },
            { label: "Token events", value: "4 / 10" },
            { label: "Late events", value: "0" },
          ],
          trace: [
            { label: "meta", detail: "request id and model metadata decoded" },
            { label: "token × 4", detail: "four ordered deltas parsed; render buffer flushes the visible partial response" },
            { label: "abort", detail: "AbortSignal crosses the adapter boundary after token 4", tone: "warning" },
            { label: "reader", detail: "reader.cancel() stops further chunk reads; parser discards its incomplete remainder" },
            { label: "generator", detail: "generator return path runs; tokens 5–10 are never produced" },
            { label: "release", detail: "reader lock and generation resources released · late events ignored" },
          ],
          artifact: "policy cancel-after-4\nproduced tokens 4 / 10 · parsed events 5 / 14\nreader stopped yes · parser stopped yes · generator stopped yes\nlate events 0 · resources released yes",
        });
        return;
      }
      setResult({
        metrics: [
          { label: "Byte chunks", value: "17" },
          { label: "SSE events", value: "14" },
          { label: "Token events", value: "10" },
          { label: "Remainder", value: "0 B" },
        ],
        trace: [
          { label: "meta", detail: "request id and model metadata decoded" },
          { label: "token × 4", detail: "first frame split across three byte chunks" },
          { label: "render pause", detail: "React commits pause; byte decoding and frame parsing continue into a typed-event render buffer" },
          { label: "token × 6", detail: "ordered deltas recovered without duplication; buffered deltas flush in one render" },
          { label: "done", detail: "terminal event leaves remainder 0 B, closes parser, and releases reader" },
        ],
        artifact: "policy complete\n17 chunks → 14 events → 10 token deltas\nremainder 0 B · terminal done · resources released yes",
      });
      return;
    }
    if (variant === "scheduling") {
      const continuous = policy === "continuous";
      setResult({
        metrics: [
          { label: "Policy", value: continuous ? "Continuous" : "Static" },
          { label: "Iterations", value: continuous ? "88" : "116" },
          { label: "Utilization", value: continuous ? "86%" : "61%" },
          { label: "P95 wait", value: continuous ? "7 steps" : "19 steps" },
        ],
        trace: continuous ? [
          { label: "Iteration 01", detail: "a, b, c admitted · d waiting · 11 pages active" },
          { label: "Iteration 14", detail: "a routed to completed · its identity retained · KV pages released" },
          { label: "Iteration 15", detail: "d admitted into the freed decode slot" },
          { label: "Iteration 31", detail: "b completes · 4 pages returned" },
          { label: "Iteration 88", detail: "final request completes · allocator empty" },
        ] : [
          { label: "Batch 01", detail: "a, b, c admitted · d waiting · membership fixed until the longest request completes" },
          { label: "Iteration 14", detail: "a completes; its decode slot idles even though d is queued", tone: "warning" },
          { label: "Idle slots", detail: "completed sequences can release memory, but this policy does not refill their batch positions", tone: "warning" },
          { label: "Batch 02", detail: "d and other waiting requests admitted only after batch drain" },
          { label: "Iteration 116", detail: "final request completes" },
        ],
        artifact: continuous
          ? "Same arrivals · completion → identity retained → pages released → next-iteration admission.\nThis fixed workload: 88 iterations · 86% utilization · p95 wait 7."
          : "Same arrivals · completed positions stay idle until batch drain.\nThis fixed workload: 116 iterations · 61% utilization · p95 wait 19.",
      });
      return;
    }
    const scenarios: Record<string, { metrics: Array<{ label: string; value: string }>; trace: Array<{ label: string; detail: string; tone?: string }>; artifact: string }> = {
      "queue-timeout": {
        metrics: [{ label: "Retry", value: "yes" }, { label: "Tokens visible", value: "0" }, { label: "Attempts", value: "2" }, { label: "TTFT · attempt 2", value: "83 ms" }, { label: "End to end", value: "541 ms" }, { label: "Outcome", value: "complete" }],
        trace: [
          { label: "Admit", detail: "logical request r-201 · active attempt r-201.1 · index 0/1" },
          { label: "Queue timeout", detail: "r-201.1 queue 120 ms · transient · visible tokens 0", tone: "warning" },
          { label: "Retry boundary", detail: "true ∧ 0 visible ∧ 0 + 1 < 2 → retire r-201.1; create r-201.2" },
          { label: "Queue + prefill", detail: "r-201.2 queue 14 ms + prefill 69 ms → TTFT 83 ms" },
          { label: "Stream", detail: "r-201.2 emits 10 ordered deltas · decode 338 ms" },
          { label: "Complete", detail: "r-201.2 streaming → complete at 421 ms for this attempt · reader and KV pages released" },
          { label: "Late event", detail: "token tagged r-201.1 rejected because r-201.2 is the retired request's successor · no state or resource count changes", tone: "warning" },
        ],
        artifact: "request r-201\nattempts r-201.1 timeout → r-201.2 complete\nqueue 120 + attempt-2 total 421 = end-to-end 541 ms\nlate events rejected 1 · open readers 0 · allocated KV pages 0",
      },
      "malformed-frame": {
        metrics: [{ label: "Retry", value: "no" }, { label: "Tokens visible", value: "6" }, { label: "TTFT", value: "74 ms" }, { label: "Parser errors", value: "1" }, { label: "Late rejected", value: "1" }, { label: "Outcome", value: "error" }],
        trace: [
          { label: "Admit", detail: "logical request r-202 · active attempt r-202.1 · index 0/1" },
          { label: "First token", detail: "queue 12 ms + prefill 62 ms → TTFT 74 ms" },
          { label: "Visible output", detail: "r-202.1 applies six ordered token events" },
          { label: "Parse error", detail: "invalid JSON frame at 192 ms · classified non-transient", tone: "error" },
          { label: "Retry boundary", detail: "non-transient ∧ visible tokens 6 → no transparent retry; partial output remains" },
          { label: "Terminal", detail: "r-202.1 streaming → error · reader cancelled and parser remainder discarded" },
          { label: "Late event", detail: "post-error token tagged r-202.1 rejected by terminal status · open readers 0", tone: "warning" },
        ],
        artifact: "request r-202 · attempt r-202.1\nqueue 12 ms · prefill 62 ms · TTFT 74 ms · error 192 ms\npartial tokens preserved 6 · retry false\nlate events rejected 1 · open readers 0 · parser remainders 0",
      },
      "worker-crash": {
        metrics: [{ label: "Retry", value: "yes" }, { label: "Tokens visible", value: "0" }, { label: "Worker restarts", value: "1" }, { label: "TTFT · attempt 2", value: "101 ms" }, { label: "Late rejected", value: "1" }, { label: "Outcome", value: "complete" }],
        trace: [
          { label: "Admit", detail: "logical request r-203 · active attempt r-203.1 · index 0/1" },
          { label: "Worker crash", detail: "r-203.1 exits during model loading at 44 ms · transient · visible tokens 0", tone: "error" },
          { label: "Retry boundary", detail: "true ∧ 0 visible ∧ 0 + 1 < 2 → retire attempt and terminate worker 1" },
          { label: "Restart", detail: "worker 2 owns r-203.2 and a fresh model lifecycle · queue 16 ms + prefill 85 ms" },
          { label: "First token", detail: "r-203.2 TTFT 101 ms · decode 302 ms" },
          { label: "Complete", detail: "r-203.2 → complete at 403 ms for this attempt · worker 2 remains healthy; request resources released" },
          { label: "Late event", detail: "worker 1 message tagged r-203.1 rejected against active r-203.2", tone: "warning" },
        ],
        artifact: "request r-203\nattempts r-203.1 crash → r-203.2 complete\nworkers started 2 · crashed 1 · request resource owners released 2/2\nlate events rejected 1 · allocated KV pages 0",
      },
      "user-abort": {
        metrics: [{ label: "Retry", value: "no" }, { label: "Tokens visible", value: "11" }, { label: "TTFT", value: "74 ms" }, { label: "Abort latency", value: "14 ms" }, { label: "Late rejected", value: "1" }, { label: "Outcome", value: "cancelled" }],
        trace: [
          { label: "Admit", detail: "logical request r-204 · active attempt r-204.1 · index 0/1" },
          { label: "First token", detail: "queue 11 ms + prefill 63 ms → TTFT 74 ms" },
          { label: "Streaming", detail: "r-204.1 applies eleven token events before the user presses stop" },
          { label: "Abort", detail: "AbortSignal reaches reader and worker at 286 ms · classified as a user action" },
          { label: "Terminal", detail: "r-204.1 streaming → cancelled in 14 ms · partial message retained · retry false" },
          { label: "Release", detail: "reader cancelled · generator return path runs · KV pages released" },
          { label: "Late event", detail: "post-cancel token tagged r-204.1 rejected by terminal status", tone: "warning" },
        ],
        artifact: "request r-204 · attempt r-204.1\nqueue 11 ms · prefill 63 ms · TTFT 74 ms\nabort 286 ms → cancelled 300 ms · latency 14 ms\nlate events rejected 1 · open readers 0 · allocated KV pages 0",
      },
    };
    setResult(scenarios[failure]);
  };

  return (
    <>
      {variant === "scheduling" ? (
        <div className="simulation-controls"><span>Scheduling policy</span><button className={policy === "static" ? "selected" : ""} type="button" onClick={() => setPolicy("static")}>Static batch</button><button className={policy === "continuous" ? "selected" : ""} type="button" onClick={() => setPolicy("continuous")}>Continuous</button></div>
      ) : null}
      {variant === "streaming" ? (
        <div className="simulation-controls">
          <span>Stream policy</span>
          <button className={streamPolicy === "complete" ? "selected" : ""} type="button" onClick={() => { setStreamPolicy("complete"); setResult(null); }}>Complete stream</button>
          <button className={streamPolicy === "cancel" ? "selected" : ""} type="button" onClick={() => { setStreamPolicy("cancel"); setResult(null); }}>Cancel after 4 tokens</button>
        </div>
      ) : null}
      {variant === "reliability" ? (
        <div className="simulation-controls"><label><span>Injected failure</span><select value={failure} onChange={(event) => setFailure(event.target.value)}><option value="queue-timeout">Queue timeout</option><option value="malformed-frame">Malformed frame</option><option value="worker-crash">Worker crash</option><option value="user-abort">User abort</option></select></label></div>
      ) : null}
      <div className="experiment-action"><p>{variant === "streaming" ? "Same deterministic response · adversarial chunks · explicit stop and release evidence" : variant === "reliability" ? "Deterministic failures · request and attempt ids · phase timing · terminal and resource evidence" : "Deterministic browser simulation · repeatable seed · explicit resource accounting"}</p><button type="button" onClick={run}>{result ? "Run again" : "Run simulation"}</button></div>
      {result ? (
        <div className="simulation-result">
          <div className="metric-grid">{result.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}</div>
          <div className="trace-list">{result.trace.map((event, index) => <div className={event.tone ?? ""} key={`${event.label}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{event.label}</strong><p>{event.detail}</p></div>)}</div>
          <pre className="simulation-artifact">{result.artifact}</pre>
        </div>
      ) : <p className="experiment-empty">Trace and metrics appear here.</p>}
    </>
  );
}

function ProductExperiment({ variant, onComplete }: { variant: ProductVariant } & ExperimentProps) {
  const [step, setStep] = useState(0);
  const [stateFlow, setStateFlow] = useState<"complete" | "cancel" | "regenerate">("complete");
  const [budget, setBudget] = useState(26);
  const [ran, setRan] = useState(false);
  const [streamProfile, setStreamProfile] = useState<StreamingUiProfile>("burst");
  const [contextFlow, setContextFlow] = useState<ContextActionFlow>("stop");
  const stateTraces = {
    complete: [
      { number: 1, action: "USER_MESSAGE", status: "complete", messageId: "m-u1", attemptId: "—", requestId: "—", content: "Explain causal masking.", canStop: false, canRegenerate: false, applied: true, evidence: "state revision 0 → 1 · conversation order appends m-u1" },
      { number: 2, action: "START_ATTEMPT", status: "queued", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "", canStop: false, canRegenerate: false, applied: true, evidence: "revision 1 → 2 · new m-a1 record · m-u1 identity preserved" },
      { number: 3, action: "STREAM_START", status: "streaming", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "", canStop: true, canRegenerate: false, applied: true, evidence: "revision 2 → 3 · request status queued → streaming" },
      { number: 4, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "A causal", canStop: true, canRegenerate: false, applied: true, evidence: "revision 3 → 4 · m-a1 replaced · m-u1 identity preserved" },
      { number: 5, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "A causal mask removes future positions.", canStop: true, canRegenerate: false, applied: true, evidence: "revision 4 → 5 · m-a1 replaced · ordered ids unchanged" },
      { number: 6, action: "COMPLETE", status: "complete", messageId: "m-a1", attemptId: "a-17.1", requestId: "r-17.1", content: "A causal mask removes future positions.", canStop: false, canRegenerate: true, applied: true, evidence: "revision 5 → 6 · terminal request releases active control" },
    ],
    cancel: [
      { number: 7, action: "USER_MESSAGE", status: "complete", messageId: "m-u2", attemptId: "—", requestId: "—", content: "Give one implementation detail.", canStop: false, canRegenerate: false, applied: true, evidence: "revision 6 → 7 · conversation order appends m-u2" },
      { number: 8, action: "START_ATTEMPT", status: "queued", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "", canStop: false, canRegenerate: false, applied: true, evidence: "revision 7 → 8 · second message, attempt, and request ids allocated" },
      { number: 9, action: "STREAM_START", status: "streaming", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "", canStop: true, canRegenerate: false, applied: true, evidence: "revision 8 → 9 · canStop derives from active streaming request" },
      { number: 10, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "Set future logits", canStop: true, canRegenerate: false, applied: true, evidence: "revision 9 → 10 · m-a2 replaced · all other messages preserved" },
      { number: 11, action: "CANCEL_REQUEST", status: "cancelled", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "Set future logits", canStop: false, canRegenerate: true, applied: true, evidence: "revision 10 → 11 · partial text retained · request terminal" },
      { number: 12, action: "TOKEN_DELTA", status: "cancelled", messageId: "m-a2", attemptId: "a-17.2", requestId: "r-17.2", content: "Set future logits", canStop: false, canRegenerate: true, applied: false, evidence: "revision remains 11 · late delta rejected · no object identities change" },
    ],
    regenerate: [
      { number: 13, action: "EDIT_MESSAGE", status: "complete", messageId: "m-u1", attemptId: "—", requestId: "—", content: "Explain causal masking precisely.", canStop: false, canRegenerate: false, applied: true, evidence: "revision 11 → 12 · m-u1 revision 0 → 1 · prior record retained" },
      { number: 14, action: "REGENERATE", status: "queued", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "", canStop: false, canRegenerate: false, applied: true, evidence: "revision 12 → 13 · same message position · new attempt and request ids" },
      { number: 15, action: "STREAM_START", status: "streaming", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "", canStop: true, canRegenerate: false, applied: true, evidence: "revision 13 → 14 · a-17.1 remains historical · a-17.3 becomes active" },
      { number: 16, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "A causal mask", canStop: true, canRegenerate: false, applied: true, evidence: "revision 14 → 15 · active assistant record replaced immutably" },
      { number: 17, action: "TOKEN_DELTA", status: "streaming", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "A causal mask sets future attention logits to negative infinity.", canStop: true, canRegenerate: false, applied: true, evidence: "revision 15 → 16 · conversation order and user records unchanged" },
      { number: 18, action: "COMPLETE", status: "complete", messageId: "m-a1", attemptId: "a-17.3", requestId: "r-17.3", content: "A causal mask sets future attention logits to negative infinity.", canStop: false, canRegenerate: true, applied: true, evidence: "revision 16 → 17 · attempt a-17.3 terminal · request resources released" },
    ],
  } as const;
  if (variant === "state") {
    const stateTrace = stateTraces[stateFlow];
    const current = stateTrace[Math.min(step, stateTrace.length - 1)];
    const setFlow = (flow: typeof stateFlow) => {
      setStateFlow(flow);
      setStep(0);
      onComplete();
    };
    return (
      <>
        <div className="simulation-controls state-flow-controls"><span>Focused flow</span><button className={stateFlow === "complete" ? "selected" : ""} type="button" onClick={() => setFlow("complete")}>Complete · 01–06</button><button className={stateFlow === "cancel" ? "selected" : ""} type="button" onClick={() => setFlow("cancel")}>Cancel + late · 07–12</button><button className={stateFlow === "regenerate" ? "selected" : ""} type="button" onClick={() => setFlow("regenerate")}>Edit + regenerate · 13–18</button></div>
        <div className="simulation-controls"><span>Reducer action</span><input aria-label="Reducer action" type="range" min="0" max={stateTrace.length - 1} value={step} onChange={(event) => { setStep(Number(event.target.value)); onComplete(); }} /><code>{String(current.number).padStart(2, "0")}/18</code></div>
        <div className="simulation-result product-simulation">
          <div className="state-inspector"><div><span>Action</span><strong>{current.action}</strong></div><div><span>Status</span><strong>{current.status}</strong></div><div><span>Reducer result</span><strong>{current.applied ? "applied" : "ignored"}</strong></div><div><span>Derived controls</span><strong>{`stop ${current.canStop ? "on" : "off"} · regenerate ${current.canRegenerate ? "on" : "off"}`}</strong></div></div>
          <div className="state-identity-strip"><span><em>messageId</em><code>{current.messageId}</code></span><span><em>attemptId</em><code>{current.attemptId}</code></span><span><em>requestId</em><code>{current.requestId}</code></span></div>
          <article className={`mini-message ${current.status}`}><span>{current.messageId.startsWith("m-u") ? "User" : "Assistant"} · {current.messageId}</span><p>{current.content || "Waiting for output…"}</p></article>
          <p className={`state-revision-evidence${current.applied ? "" : " ignored"}`}><b>Identity evidence</b>{current.evidence}</p>
          <div className="trace-list compact-trace">{stateTrace.map((event, index) => <button aria-label={`Action ${event.number}: ${event.action}`} className={index === step ? "active" : index < step ? "complete" : ""} type="button" onClick={() => { setStep(index); onComplete(); }} key={`${event.action}-${event.number}`}><span>{String(event.number).padStart(2, "0")}</span><strong>{event.action}</strong></button>)}</div>
        </div>
      </>
    );
  }
  if (variant === "streaming-ui") {
    const profile = STREAMING_UI_PROFILES[streamProfile];
    const chooseProfile = (nextProfile: StreamingUiProfile) => {
      setStreamProfile(nextProfile);
      setRan(false);
    };
    return (
      <>
        <div className="simulation-controls streaming-profile-controls">
          <span>Timing profile</span>
          {(Object.keys(STREAMING_UI_PROFILES) as StreamingUiProfile[]).map((key) => (
            <button className={streamProfile === key ? "selected" : ""} type="button" onClick={() => chooseProfile(key)} key={key}>{STREAMING_UI_PROFILES[key].label}</button>
          ))}
        </div>
        <div className="experiment-action"><p>{profile.description}</p><button type="button" onClick={() => { setRan(true); onComplete(); }}>{ran ? `Replay ${profile.label.toLowerCase()}` : `Run ${profile.label.toLowerCase()}`}</button></div>
        {ran ? (
          <div className="simulation-result product-simulation streaming-ui-result">
            <div className="metric-grid">{profile.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}</div>
            <article className={`stream-preview ${profile.status}`}><span>Assistant · {profile.status}</span><p>{profile.output}</p><i><b style={{ width: `${profile.status === "cancelled" ? 38 : 100}%` }} /></i></article>
            <div className="trace-list streaming-ui-trace">{profile.trace.map((event) => <div key={`${event.time}-${event.label}`}><span>{event.time}</span><strong>{event.label}</strong><p>{event.detail}</p></div>)}</div>
            <div className="streaming-policy-evidence">
              <span><b>Scroll-follow result</b><code>{profile.scroll}</code></span>
              <span><b>Terminal cleanup</b><code>{profile.cleanup}</code></span>
              <span><b>Exact dropped text</b><code>{profile.dropped}</code></span>
            </div>
            <div className="streaming-announcement-log">
              <span>Bounded live-region writes · {profile.announcements.length}</span>
              <ol>{profile.announcements.map((announcement, index) => <li key={`${index}-${announcement}`}><b>{String(index + 1).padStart(2, "0")}</b><code>{announcement}</code></li>)}</ol>
            </div>
          </div>
        ) : <p className="experiment-empty">Run this profile to inspect commits, scroll state, announcements, dropped text, and cleanup.</p>}
      </>
    );
  }
  if (variant === "context-actions") {
    const historyTurns = [
      {
        label: "Older compact turn",
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
        outcome: "Abort r-31, retain m-a3 and its visible partial text, then mark attempt a-31 cancelled.",
        branch: "s1 → m-u3 → m-a3",
        invalidation: "none · stop changes lifecycle state, not ancestry",
        attempt: { messageId: "m-a3", parentUserId: "m-u3", attemptId: "a-31", requestId: "r-31", status: "cancelled", partialContent: "Set future logits", modelId: "latent-local-135m", promptVersion: "chat-v3", sampling: { temperature: 0.7, topP: 0.9 } },
      },
      retry: {
        label: "Retry / regenerate",
        activeUser: { id: "m-u3", tokens: 6, text: "Give one implementation detail." },
        outcome: "Keep cancelled m-a3 / a-31 / r-31, then allocate queued m-a4 / a-32 / r-32 from the same m-u3 prefix.",
        branch: "s1 → m-u3 ↘ m-a3 cancelled · ↗ m-a4 queued",
        invalidation: "none · both assistant attempts share parent m-u3",
        attempt: { messageId: "m-a4", parentUserId: "m-u3", attemptId: "a-32", requestId: "r-32", status: "queued", content: "", modelId: "latent-local-135m", promptVersion: "chat-v3", sampling: { temperature: 0.7, topP: 0.9 } },
      },
      edit: {
        label: "Edit prompt",
        activeUser: { id: "m-u3-e1", tokens: 8, text: "Show the exact mask assignment in JavaScript." },
        outcome: "Create edited user revision m-u3-e1 and queued m-a5 / a-33 / r-33; retain m-a3 but invalidate it on the edited branch.",
        branch: "s1 → m-u3-e1 → m-a5 queued",
        invalidation: "m-u3 → m-a3 remains historical · excluded from branch m-u3-e1",
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
      onComplete();
    };
    return (
      <>
        <div className="simulation-controls context-action-controls">
          <span>Conversation action</span>
          <button className={contextFlow === "stop" ? "selected" : ""} type="button" onClick={() => chooseContextFlow("stop")}>Stop</button>
          <button className={contextFlow === "retry" ? "selected" : ""} type="button" onClick={() => chooseContextFlow("retry")}>Retry / regenerate</button>
          <button className={contextFlow === "edit" ? "selected" : ""} type="button" onClick={() => chooseContextFlow("edit")}>Edit prompt</button>
        </div>
        <div className="simulation-controls context-budget-controls">
          <label><span>Request budget · {budget} tokens</span><input aria-label="Request budget" type="range" min="14" max="42" value={budget} onChange={(event) => { setBudget(Number(event.target.value)); onComplete(); }} /></label>
          <code>{used}/{budget} used</code>
        </div>
        <div className="simulation-result product-simulation context-action-result">
          <div className="context-action-summary">
            <span><b>Applied action</b><strong>{flow.label}</strong></span>
            <p>{flow.outcome}</p>
          </div>
          <div className="context-branch-evidence">
            <span><b>Active branch</b><code>{flow.branch}</code></span>
            <span><b>Descendant policy</b><code>{flow.invalidation}</code></span>
            <span><b>Retained partial</b><code>m-a3 · a-31 · r-31 · cancelled · “Set future logits”</code></span>
          </div>
          <div className="context-request-heading">
            <div><span>Exact request assembly</span><strong>{includedMessageIds.join(" → ")}</strong></div>
            <code>{used} selected / {budget} budget</code>
          </div>
          <div className="context-decision-list">
            <article className="included"><span>s1 · system</span><p>{system.text}</p><code>{system.tokens} tokens · required</code></article>
            {historyTurns.map((turn) => {
              const included = selectedTurns.includes(turn);
              return <article className={included ? "included" : "excluded"} key={turn.label}><span>{turn.messages.map((message) => message.id).join(" + ")} · complete turn</span><p>{turn.label}</p><code>{decisions.get(turn.label)}</code></article>;
            })}
            {contextFlow === "edit" ? <article className="excluded"><span>m-u3 → m-a3 · prior branch</span><p>Original prompt and cancelled descendant remain inspectable.</p><code>excluded · invalidated by edit m-u3-e1</code></article> : null}
            <article className="included"><span>{flow.activeUser.id} · active user</span><p>{flow.activeUser.text}</p><code>{flow.activeUser.tokens} tokens · required</code></article>
            <article className="excluded"><span>{flow.attempt.messageId} · assistant output</span><p>{flow.attempt.status === "cancelled" ? flow.attempt.partialContent : "No output yet."}</p><code>excluded · {flow.attempt.status} output is not request input</code></article>
          </div>
          <div className="branch-record context-attempt-record"><span>Exact attempt record</span><code>{JSON.stringify(attemptRecord, null, 2)}</code></div>
        </div>
      </>
    );
  }
  const checks = runCapstoneQualityAudit();
  const categories = [...new Set(checks.map((check) => check.category))];
  const passed = checks.filter((check) => check.passed).length;
  return (
    <>
      <div className="experiment-action"><p>Automated contract evidence · 16 deterministic checks · no browser, assistive-technology, or device emulation claims</p><button type="button" onClick={() => { setRan(true); onComplete(); }}>{ran ? "Run 16 checks again" : "Run 16 contract checks"}</button></div>
      {ran ? (
        <div className="quality-audit-result">
          <div className="quality-audit-summary"><span>Automated contract result</span><strong>{passed}/{checks.length} passed</strong><code>{passed === checks.length ? "contract gate satisfied" : `${checks.length - passed} require attention`}</code></div>
          {categories.map((category) => (
            <section className="quality-check-group" key={category}>
              <header><span>{category}</span><code>{checks.filter((check) => check.category === category && check.passed).length}/4</code></header>
              <div className="quality-grid">
                {checks.filter((check) => check.category === category).map((check) => <article className={check.passed ? "passed" : "failed"} key={check.label}><i>{check.passed ? "✓" : "×"}</i><div><strong>{check.label}</strong><p>{check.detail}</p></div></article>)}
              </div>
            </section>
          ))}
          <section className="quality-manual-boundary">
            <header><span>Manual verification required</span><code>not automated</code></header>
            <p>These checks need real interaction and observation. Passing the 16 contracts does not pass them.</p>
            <ol>{MANUAL_PRODUCT_VERIFICATION.map((check) => <li key={check.label}><strong>{check.label}</strong><span>{check.detail}</span></li>)}</ol>
          </section>
        </div>
      ) : <p className="experiment-empty">Run the audit to expose all 16 check-specific results and the separate manual verification list.</p>}
    </>
  );
}

export function LessonExperiment({ lesson }: { lesson: CourseLesson }) {
  const complete = () => markExperimentComplete(lesson.id);
  return (
    <div className="experiment-lab">
      <header className="experiment-header">
        <div><span>Experiment</span><strong>{lesson.experiment.title}</strong><p>{lesson.experiment.intro}</p></div>
      </header>
      <DatasetRecord lesson={lesson} />
      {lesson.experiment.kind === "rnn" ? <RnnExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "neural-lm" ? <NeuralLmExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "bpe" ? <BpeExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "attention" ? <AttentionExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "transformer" ? <TransformerExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "icl" ? <IclExperiment onComplete={complete} /> : null}
      {lesson.experiment.kind === "systems" && lesson.experiment.variant ? <SystemsExperiment variant={lesson.experiment.variant as SystemsVariant} onComplete={complete} /> : null}
      {lesson.experiment.kind === "product" && lesson.experiment.variant ? <ProductExperiment variant={lesson.experiment.variant as ProductVariant} onComplete={complete} /> : null}
    </div>
  );
}
