"use client";

import { useRef, useState } from "react";
import type { CourseLesson } from "../lib/lesson-types";
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
} from "../lib/lab-engines";
import { markExperimentComplete, saveCharacterRnnArtifact } from "../lib/learner-state";
import { runCapstoneQualityAudit, selectCompleteTurnContext, type ContextMessage } from "../lib/capstone-contract";

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
      ) : <p className="experiment-empty">Training results and the generated artifact will appear here.</p>}
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
      ) : <p className="experiment-empty">The trained distribution and embedding neighbors will appear here.</p>}
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
      ) : <p className="experiment-empty">The ordered merge table and encoded artifact will appear here.</p>}
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
      ) : <p className="experiment-empty">The learned output-to-source alignment matrix will appear here.</p>}
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
      ) : <p className="experiment-empty">The complete causal probability matrix will appear here.</p>}
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
      const transformers = await import("@huggingface/transformers");
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
          const match = raw.toUpperCase().match(/\b(K|M)\b/);
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
      ) : <p className="experiment-empty">The same review queries will appear under zero-, one-, and few-shot prompts. The labels are intentionally opaque, so only the demonstrations reveal their meaning. Every raw output remains visible.</p>}
    </>
  );
}

type SystemsVariant = "runtime" | "streaming" | "scheduling" | "reliability";
type ProductVariant = "state" | "streaming-ui" | "context-actions" | "quality";

function SystemsExperiment({ variant, onComplete }: { variant: SystemsVariant } & ExperimentProps) {
  const [policy, setPolicy] = useState<"static" | "continuous">("continuous");
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
          { label: "Decode", value: "21.4 tok/s" },
        ],
        trace: [
          { label: "Admitted", detail: "request r-104 · prompt 96 tokens" },
          { label: "Prefill", detail: "96 positions processed · 6 KV pages allocated" },
          { label: "First token", detail: "visible after queue + prefill" },
          { label: "Decode", detail: "32 serial iterations · cache grows to 8 pages" },
          { label: "Complete", detail: "8 pages released to allocator" },
        ],
        artifact: "Request r-104 preserves separate queue, prefill, and decode measurements.",
      });
      return;
    }
    if (variant === "streaming") {
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
          { label: "pause", detail: "visual rendering paused; parser continues buffering" },
          { label: "token × 6", detail: "ordered deltas recovered without duplication" },
          { label: "done", detail: "terminal event closes parser and releases reader" },
        ],
        artifact: "event: token\ndata: {\"delta\":\"browser\"}\n\nevent: done\ndata: {}",
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
          { label: "Iteration 01", detail: "a, b, c admitted · 11 pages active" },
          { label: "Iteration 14", detail: "a completes · d joins next iteration" },
          { label: "Iteration 31", detail: "b completes · 4 pages returned" },
          { label: "Iteration 88", detail: "final request completes · allocator empty" },
        ] : [
          { label: "Batch 01", detail: "a, b, c fixed until longest request completes" },
          { label: "Idle slots", detail: "a and c finish while their batch positions remain reserved", tone: "warning" },
          { label: "Batch 02", detail: "waiting requests admitted after batch drain" },
          { label: "Iteration 116", detail: "final request completes" },
        ],
        artifact: continuous ? "Completed requests release pages and batch positions immediately." : "Static membership leaves decode capacity idle behind the longest request.",
      });
      return;
    }
    const scenarios: Record<string, { metrics: Array<{ label: string; value: string }>; trace: Array<{ label: string; detail: string; tone?: string }>; artifact: string }> = {
      "queue-timeout": {
        metrics: [{ label: "Retry", value: "yes" }, { label: "Tokens visible", value: "0" }, { label: "Attempts", value: "2" }, { label: "Outcome", value: "complete" }],
        trace: [{ label: "Queued", detail: "r-201 waits beyond admission deadline" }, { label: "Timeout", detail: "transient · no output emitted", tone: "warning" }, { label: "Retry", detail: "new attempt r-201.2 enters queue" }, { label: "Complete", detail: "attempt 2 streams normally" }],
        artifact: "Safe retry: transient failure occurred before any user-visible token.",
      },
      "malformed-frame": {
        metrics: [{ label: "Retry", value: "no" }, { label: "Tokens visible", value: "6" }, { label: "Parser errors", value: "1" }, { label: "Outcome", value: "error" }],
        trace: [{ label: "Streaming", detail: "six token events applied" }, { label: "Parse error", detail: "invalid JSON in event data", tone: "error" }, { label: "Terminal", detail: "partial output preserved · transparent retry blocked" }],
        artifact: "Unsafe retry: visible output already escaped the attempt boundary.",
      },
      "worker-crash": {
        metrics: [{ label: "Retry", value: "yes" }, { label: "Tokens visible", value: "0" }, { label: "Worker restarts", value: "1" }, { label: "Outcome", value: "complete" }],
        trace: [{ label: "Loading", detail: "worker starts model initialization" }, { label: "Crash", detail: "worker terminates before prefill", tone: "error" }, { label: "Restart", detail: "new worker owns a fresh model lifecycle" }, { label: "Complete", detail: "request succeeds on bounded retry" }],
        artifact: "Worker failure cannot mutate React state after its request id is retired.",
      },
      "user-abort": {
        metrics: [{ label: "Retry", value: "no" }, { label: "Tokens visible", value: "11" }, { label: "Abort latency", value: "14 ms" }, { label: "Outcome", value: "cancelled" }],
        trace: [{ label: "Streaming", detail: "eleven token events applied" }, { label: "Abort", detail: "signal reaches reader and worker" }, { label: "Cancelled", detail: "partial message retained · late events ignored" }],
        artifact: "Cancellation is a terminal user action, not an infrastructure error.",
      },
    };
    setResult(scenarios[failure]);
  };

  return (
    <>
      {variant === "scheduling" ? (
        <div className="simulation-controls"><span>Scheduling policy</span><button className={policy === "static" ? "selected" : ""} type="button" onClick={() => setPolicy("static")}>Static batch</button><button className={policy === "continuous" ? "selected" : ""} type="button" onClick={() => setPolicy("continuous")}>Continuous</button></div>
      ) : null}
      {variant === "reliability" ? (
        <div className="simulation-controls"><label><span>Injected failure</span><select value={failure} onChange={(event) => setFailure(event.target.value)}><option value="queue-timeout">Queue timeout</option><option value="malformed-frame">Malformed frame</option><option value="worker-crash">Worker crash</option><option value="user-abort">User abort</option></select></label></div>
      ) : null}
      <div className="experiment-action"><p>Deterministic browser simulation · repeatable seed · explicit resource accounting</p><button type="button" onClick={run}>{result ? "Run again" : "Run simulation"}</button></div>
      {result ? (
        <div className="simulation-result">
          <div className="metric-grid">{result.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}</div>
          <div className="trace-list">{result.trace.map((event, index) => <div className={event.tone ?? ""} key={`${event.label}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{event.label}</strong><p>{event.detail}</p></div>)}</div>
          <pre className="simulation-artifact">{result.artifact}</pre>
        </div>
      ) : <p className="experiment-empty">The trace, phase metrics, and executable artifact will appear here.</p>}
    </>
  );
}

function ProductExperiment({ variant, onComplete }: { variant: ProductVariant } & ExperimentProps) {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(36);
  const [ran, setRan] = useState(false);
  const stateTrace = [
    { action: "USER_MESSAGE", status: "complete", content: "Explain causal masking." },
    { action: "START_ATTEMPT", status: "queued", content: "" },
    { action: "STREAM_START", status: "streaming", content: "" },
    { action: "TOKEN_DELTA", status: "streaming", content: "A causal mask" },
    { action: "TOKEN_DELTA", status: "streaming", content: "A causal mask removes future positions." },
    { action: "COMPLETE", status: "complete", content: "A causal mask removes future positions." },
  ];
  const contextMessages: ContextMessage[] = [
    { id: "m1", role: "system", tokens: 8, text: "Technical tutor instructions" },
    { id: "m2", role: "user", tokens: 12, text: "Earlier question about tokenization" },
    { id: "m3", role: "assistant", tokens: 18, text: "Earlier tokenizer explanation" },
    { id: "m4", role: "user", tokens: 9, text: "Current question about attention" },
  ];
  const { selected, used } = selectCompleteTurnContext(contextMessages, budget);

  if (variant === "state") {
    const current = stateTrace[Math.min(step, stateTrace.length - 1)];
    return (
      <>
        <div className="simulation-controls"><span>Reducer event</span><input aria-label="Reducer event" type="range" min="0" max={stateTrace.length - 1} value={step} onChange={(event) => { setStep(Number(event.target.value)); onComplete(); }} /><code>{step + 1}/{stateTrace.length}</code></div>
        <div className="simulation-result product-simulation">
          <div className="state-inspector"><div><span>Action</span><strong>{current.action}</strong></div><div><span>Status</span><strong>{current.status}</strong></div><div><span>Available actions</span><strong>{current.status === "streaming" ? "Stop" : current.status === "complete" ? "Retry · Edit" : "None"}</strong></div></div>
          <article className={`mini-message ${current.status}`}><span>Assistant</span><p>{current.content || "Waiting for output…"}</p></article>
          <div className="trace-list compact-trace">{stateTrace.map((event, index) => <button className={index === step ? "active" : index < step ? "complete" : ""} type="button" onClick={() => { setStep(index); onComplete(); }} key={`${event.action}-${index}`}><span>{index + 1}</span><strong>{event.action}</strong></button>)}</div>
        </div>
      </>
    );
  }
  if (variant === "streaming-ui") {
    return (
      <>
        <div className="experiment-action"><p>60 transport deltas · frame-buffered React commits · bounded live announcements</p><button type="button" onClick={() => { setRan(true); onComplete(); }}>{ran ? "Replay stream" : "Render stream"}</button></div>
        {ran ? <div className="simulation-result product-simulation"><div className="metric-grid"><span><em>Transport deltas</em><strong>60</strong></span><span><em>Visual commits</em><strong>12</strong></span><span><em>Live announcements</em><strong>4</strong></span><span><em>Dropped text</em><strong>0</strong></span></div><article className="stream-preview"><span>Assistant · generating</span><p>A causal mask prevents each token from reading positions that occur later in the sequence. The masked logits become zero probability after softmax.</p><i><b /></i></article><p className="simulation-artifact">Reader remains 214 px from the bottom → auto-scroll paused; generation continues.</p></div> : <p className="experiment-empty">Render and accessibility metrics will appear here.</p>}
      </>
    );
  }
  if (variant === "context-actions") {
    return (
      <>
        <div className="simulation-controls"><label><span>Context budget · {budget} tokens</span><input type="range" min="12" max="50" value={budget} onChange={(event) => { setBudget(Number(event.target.value)); onComplete(); }} /></label><code>{used}/{budget} used</code></div>
        <div className="simulation-result product-simulation"><div className="context-stack">{contextMessages.map((message) => { const included = selected.some((item) => item.id === message.id); return <article className={included ? "included" : "excluded"} key={message.id}><span>{message.id} · {message.role}</span><p>{message.text}</p><code>{message.tokens} tokens · {included ? "included" : "excluded"}</code></article>; })}</div><div className="branch-record"><span>Regeneration record</span><code>{JSON.stringify({ parentUserId: "m4", attemptId: "a2", includedMessageIds: selected.map((message) => message.id), status: "queued" }, null, 2)}</code></div></div>
      </>
    );
  }
  const checks = runCapstoneQualityAudit();
  return (
    <><div className="experiment-action"><p>Executable contract audit · keyboard, storage, backend isolation, context, and ARIA</p><button type="button" onClick={() => { setRan(true); onComplete(); }}>{ran ? "Run audit again" : "Run product audit"}</button></div>{ran ? <div className="quality-grid">{checks.map((check) => <article className={check.passed ? "passed" : "failed"} key={check.label}><i>{check.passed ? "✓" : "×"}</i><div><strong>{check.label}</strong><p>{check.detail}</p></div></article>)}</div> : <p className="experiment-empty">The executable capstone contract audit will appear here.</p>}</>
  );
}

export function LessonExperiment({ lesson }: { lesson: CourseLesson }) {
  const complete = () => markExperimentComplete(lesson.id);
  return (
    <div className="experiment-lab">
      <header className="experiment-header">
        <div><span>{lesson.modeLabel}</span><strong>{lesson.experiment.title}</strong><p>{lesson.experiment.intro}</p></div>
        <code>{lesson.experiment.kind}</code>
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
