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

type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type TextGenerator = (
  input: ModelMessage[],
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

function RnnExperiment() {
  const [result, setResult] = useState<RnnResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      setResult(trainCharacterRnn());
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

function NeuralLmExperiment() {
  const [result, setResult] = useState<NeuralLmResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      setResult(trainNeuralLanguageModel());
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

function BpeExperiment() {
  const [budget, setBudget] = useState(10);
  const [result, setResult] = useState<BpeResult | null>(null);
  const run = () => setResult(trainBpe(budget));
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

function AttentionExperiment() {
  const [result, setResult] = useState<AttentionResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      setResult(trainAdditiveAttention());
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

function TransformerExperiment() {
  const [result, setResult] = useState<TransformerResult | null>(null);
  return (
    <>
      <div className="experiment-action">
        <p>8-dimensional token-plus-position vectors · one causal attention head</p>
        <button type="button" onClick={() => setResult(runCausalAttention())}>{result ? "Run again" : "Run attention"}</button>
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

function IclExperiment() {
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
      { input: "clear, careful, and useful", label: "Z" },
      { input: "confused, careless, and unreliable", label: "Q" },
      { input: "precise and easy to follow", label: "Z" },
      { input: "incorrect and difficult to trust", label: "Q" },
    ];
    const tests = [
      { input: "accurate, concise, and genuinely helpful", expected: "Z" },
      { input: "vague, misleading, and poorly supported", expected: "Q" },
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
            "Classify each input with the opaque label Z or Q. Infer the label mapping from demonstrations when they are present. Return exactly one label.",
            exampleText,
            `Input: ${test.input}\nLabel:`,
          ].filter(Boolean).join("\n\n");
          setDetail(`${condition.name} · case ${outputs.length + 1} of ${tests.length}`);
          const result = await generator([
            { role: "system", content: "Return only the requested classification label." },
            { role: "user", content: prompt },
          ], { max_new_tokens: 4, do_sample: false, repetition_penalty: 1.05 });
          const raw = extractGeneratedText(result).trim();
          const match = raw.toUpperCase().match(/\b(Z|Q)\b/);
          outputs.push({ input: test.input, expected: test.expected, predicted: match?.[1] ?? null, raw });
        }
        const row = { condition: condition.name, correct: outputs.filter((output) => output.predicted === output.expected).length, total: outputs.length, outputs };
        setRows((current) => [...current, row]);
      }
      setDetail("Evaluation complete · frozen weights throughout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local evaluation stopped.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="model-loader">
        <div><span>Local model</span><strong>SmolLM2-135M-Instruct · q4</strong><em>{detail}</em></div>
        <i><b style={{ width: `${progress}%` }} /></i>
        <button type="button" onClick={loadModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>{modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${progress}% downloaded` : "Load model · ~181 MB"}</button>
      </div>
      <div className="experiment-action">
        <p>2 held-out cases · exact match · identical model weights and decoding policy</p>
        <button type="button" onClick={runEvaluation} disabled={modelStatus !== "ready" || running}>{running ? "Evaluating…" : rows.length ? "Run evaluation again" : "Run three conditions"}</button>
      </div>
      {error ? <p className="model-error">{error}</p> : null}
      {rows.length ? (
        <div className="icl-results">
          {rows.map((row) => (
            <article key={row.condition}>
              <header><span>{row.condition}</span><strong>{row.correct}/{row.total}</strong></header>
              {row.outputs.map((output, index) => (
                <div key={`${row.condition}-${index}`}><p>{output.input}</p><code className={output.predicted === output.expected ? "passed" : "failed"}>{output.predicted ?? "no label"} / {output.expected}</code></div>
              ))}
            </article>
          ))}
        </div>
      ) : <p className="experiment-empty">The zero-, one-, and few-shot scorecards will appear here. Variation is evidence, not a guaranteed improvement.</p>}
    </>
  );
}

export function LessonExperiment({ lesson }: { lesson: CourseLesson }) {
  return (
    <div className="experiment-lab">
      <header className="experiment-header">
        <div><span>{lesson.modeLabel}</span><strong>{lesson.experiment.title}</strong><p>{lesson.experiment.intro}</p></div>
        <code>{lesson.experiment.kind}</code>
      </header>
      <DatasetRecord lesson={lesson} />
      {lesson.experiment.kind === "rnn" ? <RnnExperiment /> : null}
      {lesson.experiment.kind === "neural-lm" ? <NeuralLmExperiment /> : null}
      {lesson.experiment.kind === "bpe" ? <BpeExperiment /> : null}
      {lesson.experiment.kind === "attention" ? <AttentionExperiment /> : null}
      {lesson.experiment.kind === "transformer" ? <TransformerExperiment /> : null}
      {lesson.experiment.kind === "icl" ? <IclExperiment /> : null}
    </div>
  );
}
