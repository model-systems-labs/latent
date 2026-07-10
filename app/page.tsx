"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";

const MODEL_ID = "onnx-community/SmolLM2-135M-Instruct-ONNX";

const POLICY_SCAFFOLD = `const decodingPolicy = {
  // temperature: controls distribution sharpness

  // top_k: keeps only the k highest-scoring tokens

  // top_p: keeps the smallest set whose probability mass reaches p

  // repetition_penalty: downweights tokens already generated

  // no_repeat_ngram_size: blocks repeated n-grams

  // max_new_tokens: caps generation length
};`;

type Message = { role: "system" | "user" | "assistant"; content: string };

type TensorLike = { tolist: () => number[][] };

type TokenizerOutput = {
  input_ids: TensorLike;
  attention_mask?: TensorLike;
};

type Tokenizer = {
  (input: string | string[], options?: Record<string, unknown>): TokenizerOutput;
};

type TextGenerator = {
  tokenizer: Tokenizer;
  (input: Message[], options?: Record<string, unknown>): Promise<unknown>;
};

type TextStreamerConstructor = new (
  tokenizer: Tokenizer,
  options: {
    skip_prompt: boolean;
    skip_special_tokens: boolean;
    callback_function: (text: string) => void;
  },
) => unknown;

type GenerationPolicy = {
  temperature: number;
  topK: number;
  topP: number;
  repetitionPenalty: number;
  noRepeatNgramSize: number;
  maxNewTokens: number;
};

type SectionProps = {
  id?: string;
  label: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

function HeaderSection({
  id,
  label,
  title,
  description,
  children,
  size = "large",
}: SectionProps & { size?: "small" | "medium" | "large" }) {
  return (
    <section className={`kit-section header-section header-${size}`} id={id}>
      <p className="section-label">{label}</p>
      <h1>{title}</h1>
      {description ? <div className="header-description">{description}</div> : null}
      {children}
    </section>
  );
}

function ParagraphSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section paragraph-section" id={id}>
      <div className="section-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      <div className="paragraph-body">{children}</div>
    </section>
  );
}

function DiagramSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section diagram-section" id={id}>
      <div className="section-heading compact-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      <div className="diagram-canvas">{children}</div>
    </section>
  );
}

function CodingSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section coding-section" id={id}>
      <div className="section-heading compact-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TextBoxSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section textbox-section" id={id}>
      <div className="section-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function extractGeneratedText(result: unknown) {
  if (!Array.isArray(result) || result.length === 0) return "";
  const generated = (result[0] as { generated_text?: unknown }).generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const finalMessage = generated[generated.length - 1] as { content?: unknown } | undefined;
    return typeof finalMessage?.content === "string" ? finalMessage.content : "";
  }
  return "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyOutputFilter(
  text: string,
  options: { maxWords: number; maxSentences: number; stripMarkdown: boolean; bannedPhrases: string[] },
) {
  let filtered = text;
  if (options.stripMarkdown) {
    filtered = filtered
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/[*_`>]/g, "");
  }

  for (const phrase of options.bannedPhrases) {
    filtered = filtered.replace(new RegExp(escapeRegExp(phrase), "gi"), "");
  }

  filtered = filtered.replace(/\s+/g, " ").trim();
  const sentences = filtered.match(/[^.!?]+[.!?]?/g) ?? [filtered];
  filtered = sentences.slice(0, options.maxSentences).join(" ").trim();
  const words = filtered.split(/\s+/).filter(Boolean);
  if (words.length > options.maxWords) {
    filtered = `${words.slice(0, options.maxWords).join(" ")}…`;
  }
  return filtered;
}

function parsePolicy(source: string): { policy?: GenerationPolicy; error?: string } {
  const read = (key: string) => {
    const match = source.match(new RegExp(`${key}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`));
    return match ? Number(match[1]) : null;
  };

  const temperature = read("temperature");
  const topK = read("top_k");
  const topP = read("top_p");
  const repetitionPenalty = read("repetition_penalty");
  const noRepeatNgramSize = read("no_repeat_ngram_size");
  const maxNewTokens = read("max_new_tokens");
  const missing = [
    ["temperature", temperature],
    ["top_k", topK],
    ["top_p", topP],
    ["repetition_penalty", repetitionPenalty],
    ["no_repeat_ngram_size", noRepeatNgramSize],
    ["max_new_tokens", maxNewTokens],
  ].filter(([, value]) => value === null);

  if (missing.length) return { error: `Missing: ${missing.map(([name]) => name).join(", ")}.` };
  if (temperature! <= 0 || temperature! > 2) return { error: "temperature must be > 0 and ≤ 2." };
  if (topK! < 1 || topK! > 200) return { error: "top_k must be between 1 and 200." };
  if (topP! <= 0 || topP! > 1) return { error: "top_p must be > 0 and ≤ 1." };
  if (repetitionPenalty! < 1 || repetitionPenalty! > 2) return { error: "repetition_penalty must be between 1 and 2." };
  if (noRepeatNgramSize! < 0 || noRepeatNgramSize! > 8) return { error: "no_repeat_ngram_size must be between 0 and 8." };
  if (maxNewTokens! < 8 || maxNewTokens! > 128) return { error: "max_new_tokens must be between 8 and 128." };

  return {
    policy: {
      temperature: temperature!,
      topK: Math.round(topK!),
      topP: topP!,
      repetitionPenalty: repetitionPenalty!,
      noRepeatNgramSize: Math.round(noRepeatNgramSize!),
      maxNewTokens: Math.round(maxNewTokens!),
    },
  };
}

export default function Home() {
  const generatorRef = useRef<TextGenerator | null>(null);
  const streamerRef = useRef<TextStreamerConstructor | null>(null);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelFile, setModelFile] = useState("Not downloaded");
  const [backend, setBackend] = useState("Not initialized");
  const [modelError, setModelError] = useState("");
  const [policyCode, setPolicyCode] = useState(POLICY_SCAFFOLD);
  const [policy, setPolicy] = useState<GenerationPolicy | null>(null);
  const [policyMessage, setPolicyMessage] = useState("Add all six generation parameters, then validate the object.");
  const [prompt, setPrompt] = useState("I'm nervous about starting a new job on Monday. What would you say to a friend?");
  const [styleInstruction, setStyleInstruction] = useState(
    "Reply in natural spoken English. Use one or two short sentences. Avoid headings, lists, markdown, disclaimers, and formal filler.",
  );
  const [bannedPhrases, setBannedPhrases] = useState("however, furthermore, delve, certainly, as an AI");
  const [maxWords, setMaxWords] = useState(36);
  const [maxSentences, setMaxSentences] = useState(2);
  const [stripMarkdown, setStripMarkdown] = useState(true);
  const [rawOutput, setRawOutput] = useState("");
  const [constrainedOutput, setConstrainedOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("Waiting for model and policy");

  const validatePolicy = () => {
    const parsed = parsePolicy(policyCode);
    if (!parsed.policy) {
      setPolicy(null);
      setPolicyMessage(parsed.error ?? "Policy is invalid.");
      return;
    }
    setPolicy(parsed.policy);
    setPolicyMessage("Policy validated. These values will control constrained generation.");
  };

  const loadModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    setModelStatus("loading");
    setModelError("");
    setModelProgress(0);
    setModelFile("Resolving model files");

    try {
      const transformers = await import("@huggingface/transformers");
      streamerRef.current = transformers.TextStreamer as unknown as TextStreamerConstructor;
      const progressCallback = (info: unknown) => {
        const progress = info as { progress?: number; file?: string; status?: string };
        if (typeof progress.progress === "number") setModelProgress(Math.round(progress.progress));
        if (progress.file) setModelFile(progress.file.split("/").pop() ?? progress.file);
        if (progress.status === "ready") setModelProgress(100);
      };

      const hasWebGPU = "gpu" in navigator;
      let generator: TextGenerator;
      if (hasWebGPU) {
        try {
          setBackend("WebGPU · q4");
          generator = (await transformers.pipeline("text-generation", MODEL_ID, {
            device: "webgpu",
            dtype: "q4",
            progress_callback: progressCallback,
          })) as unknown as TextGenerator;
        } catch {
          setBackend("WASM CPU fallback · q4");
          generator = (await transformers.pipeline("text-generation", MODEL_ID, {
            device: "wasm",
            dtype: "q4",
            progress_callback: progressCallback,
          })) as unknown as TextGenerator;
        }
      } else {
        setBackend("WASM CPU · q4");
        generator = (await transformers.pipeline("text-generation", MODEL_ID, {
          device: "wasm",
          dtype: "q4",
          progress_callback: progressCallback,
        })) as unknown as TextGenerator;
      }

      generatorRef.current = generator;
      setModelProgress(100);
      setModelFile("Model initialized and cached");
      setModelStatus("ready");
      setGenerationStage("Ready to generate");
    } catch (error) {
      setModelStatus("error");
      setModelError(error instanceof Error ? error.message : "The model could not be initialized.");
      setGenerationStage("Model initialization failed");
    }
  };

  const tokenizeBannedPhrases = async (generator: TextGenerator, phrases: string[]) => {
    if (!phrases.length) return undefined;
    const tokenized = generator.tokenizer(
      phrases.map((phrase) => ` ${phrase}`),
      { add_special_tokens: false, padding: true },
    );
    const rows = tokenized.input_ids.tolist();
    const masks = tokenized.attention_mask?.tolist();
    return rows.map((row, rowIndex) =>
      row.filter((_, tokenIndex) => !masks || masks[rowIndex]?.[tokenIndex] === 1),
    );
  };

  const generateWithStream = async (
    generator: TextGenerator,
    messages: Message[],
    options: Record<string, unknown>,
    onUpdate: (text: string) => void,
  ) => {
    let streamed = "";
    const Streamer = streamerRef.current;
    const streamer = Streamer
      ? new Streamer(generator.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text) => {
            streamed += text;
            onUpdate(streamed);
          },
        })
      : undefined;
    const result = await generator(messages, { ...options, streamer });
    return streamed.trim() || extractGeneratedText(result).trim();
  };

  const runComparison = async () => {
    const generator = generatorRef.current;
    if (!generator || !policy || !prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setRawOutput("");
    setConstrainedOutput("");
    setModelError("");

    try {
      setGenerationStage("Generating unprocessed baseline");
      const rawMessages: Message[] = [
        { role: "system", content: "Answer the user's request directly." },
        { role: "user", content: prompt.trim() },
      ];
      const raw = await generateWithStream(
        generator,
        rawMessages,
        {
          max_new_tokens: policy.maxNewTokens,
          do_sample: true,
          temperature: 1,
          top_k: 0,
          top_p: 1,
          repetition_penalty: 1,
          no_repeat_ngram_size: 0,
        },
        setRawOutput,
      );
      setRawOutput(raw);

      setGenerationStage("Applying prompt, logit, and output constraints");
      const phrases = bannedPhrases.split(",").map((phrase) => phrase.trim()).filter(Boolean);
      const badWordsIds = await tokenizeBannedPhrases(generator, phrases);
      let shapedStream = "";
      const constrainedMessages: Message[] = [
        { role: "system", content: styleInstruction.trim() },
        { role: "user", content: prompt.trim() },
      ];
      const shaped = await generateWithStream(
        generator,
        constrainedMessages,
        {
          max_new_tokens: policy.maxNewTokens,
          do_sample: true,
          temperature: policy.temperature,
          top_k: policy.topK,
          top_p: policy.topP,
          repetition_penalty: policy.repetitionPenalty,
          no_repeat_ngram_size: policy.noRepeatNgramSize,
          bad_words_ids: badWordsIds,
          renormalize_logits: true,
        },
        (text) => {
          shapedStream = text;
          setConstrainedOutput(text);
        },
      );
      const filtered = applyOutputFilter(shaped || shapedStream, {
        maxWords,
        maxSentences,
        stripMarkdown,
        bannedPhrases: phrases,
      });
      setConstrainedOutput(filtered);
      setGenerationStage("Comparison complete");
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Generation failed.");
      setGenerationStage("Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true">
        <span className="atmosphere-line line-a" />
        <span className="atmosphere-line line-b" />
        <span className="atmosphere-line line-c" />
        <span className="atmosphere-node atmosphere-node-a" />
        <span className="atmosphere-node atmosphere-node-b" />
        <span className="atmosphere-glow" />
      </div>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Latent home"><span className="wordmark-dot" />latent</a>
        <nav aria-label="Lesson navigation">
          <a href="#runtime">Runtime</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#policy">Policy</a>
          <a href="#lab">Generate</a>
        </nav>
        <span className="lesson-index">Interactive lab</span>
      </header>

      <div className="lesson-page" id="top">
        <HeaderSection
          label="Browser-native transformer inference"
          title="In-Browser LLM Inference and Constrained Decoding"
          description={
            <p>
              Run a 135M-parameter instruction-tuned causal transformer locally with WebGPU or
              WASM, then compare unconstrained sampling with a production-style decoding stack:
              system conditioning, top-k, nucleus sampling, repetition control, token suppression,
              and deterministic output filtering.
            </p>
          }
          size="large"
        >
          <div className="lesson-meta">
            <span>Model · SmolLM2-135M-Instruct</span>
            <span>Runtime · Transformers.js + ONNX</span>
            <span>Weights · q4, downloaded on demand</span>
          </div>
        </HeaderSection>

        <ParagraphSection
          id="runtime"
          label="1 · Model and execution environment"
          title="A quantized causal transformer running entirely on-device"
          description="The model weights, tokenizer, KV cache, sampling loop, and generated text remain in the browser after the initial model download."
        >
          <div className="reading-copy two-up-reading">
            <p>
              SmolLM2-135M-Instruct uses a decoder-only transformer with 30 layers, hidden width
              576, 9 attention heads, 3 key-value heads, a 49,152-token vocabulary, and an 8,192-token
              maximum context. The ONNX graph is loaded through Transformers.js and executed with
              ONNX Runtime Web.
            </p>
            <p>
              Four-bit quantization reduces model transfer and memory pressure at the cost of some
              numerical precision. WebGPU is attempted first; browsers without a compatible GPU
              fall back to WASM on the CPU. The browser cache prevents the full model from being
              downloaded again on every visit.
            </p>
          </div>
          <div className="technical-spec-grid">
            <div><code>135M</code><span>parameters</span></div>
            <div><code>30</code><span>decoder layers</span></div>
            <div><code>576</code><span>hidden width</span></div>
            <div><code>9 / 3</code><span>attention / KV heads</span></div>
            <div><code>49,152</code><span>token vocabulary</span></div>
            <div><code>8,192</code><span>maximum positions</span></div>
          </div>
        </ParagraphSection>

        <DiagramSection
          id="pipeline"
          label="2 · Autoregressive generation pipeline"
          title="Prompt tokens → transformer logits → decoding policy → visible text"
          description="The neural network only produces logits. Product behavior emerges from the processors, sampling strategy, and output contract applied after each forward pass."
        >
          <div className="decode-pipeline">
            {[
              ["01", "Tokenizer", "Text → token IDs"],
              ["02", "Transformer", "Next-token logits"],
              ["03", "Logit processors", "Penalties and masks"],
              ["04", "Sampler", "top-k + top-p + τ"],
              ["05", "Post-filter", "Length and format"],
            ].map(([index, name, detail]) => (
              <article className="pipeline-node" key={index}>
                <span>{index}</span><h3>{name}</h3><p>{detail}</p>
              </article>
            ))}
          </div>
          <div className="equation-strip">
            <code>p(xₜ | x&lt;ₜ) = softmax(process(logitsₜ) / τ)</code>
            <span>sample one token, append it, update the KV cache, repeat</span>
          </div>
        </DiagramSection>

        <ParagraphSection
          label="3 · Why a decoding layer is required"
          title="Model likelihood is not the same as acceptable product output"
          description="A pretrained language model estimates token probabilities; an application still needs an explicit policy for diversity, repetition, prohibited content, length, and presentation."
        >
          <div className="reading-copy">
            <p>
              Sampling directly from the full softmax preserves the entire low-probability tail.
              This increases diversity but also admits incoherent transitions. Greedy decoding does
              the opposite: it selects the local maximum at every step and often collapses into
              generic or repetitive continuations.
            </p>
            <p>
              Production systems therefore transform logits before sampling. Top-k removes every
              token outside the k highest scores. Top-p retains the smallest sorted token set whose
              cumulative probability exceeds p. Repetition penalties modify scores for tokens
              already observed, while n-gram constraints prevent exact phrase loops.
            </p>
            <p>
              Token masks can set prohibited token sequences to negative infinity before softmax.
              A final deterministic pass can enforce requirements that are easier to express over
              text than tokens: maximum words, maximum sentences, plain text only, or removal of
              headings and list markers.
            </p>
          </div>
        </ParagraphSection>

        <CodingSection
          id="policy"
          label="4 · Generation policy implementation"
          title="Define the logit warpers and stopping parameters"
          description="Type a JavaScript configuration object. The parsed values are passed directly to the constrained Transformers.js generation call."
        >
          <div className="policy-layout">
            <div className="policy-brief">
              <p className="section-label">Required fields</p>
              <ul>
                <li><code>temperature</code><span>recommended 0.6–0.9</span></li>
                <li><code>top_k</code><span>recommended 20–80</span></li>
                <li><code>top_p</code><span>recommended 0.85–0.95</span></li>
                <li><code>repetition_penalty</code><span>recommended 1.05–1.2</span></li>
                <li><code>no_repeat_ngram_size</code><span>recommended 2–4</span></li>
                <li><code>max_new_tokens</code><span>allowed 8–128</span></li>
              </ul>
              <p className="policy-example">A stable conversational starting point is 0.72, 40, 0.90, 1.12, 3, and 64 respectively.</p>
            </div>
            <div className="policy-editor-shell">
              <div className="code-window-header"><span>generation-policy.js</span><span>learner-authored</span></div>
              <textarea
                className="policy-editor"
                aria-label="Type a Transformers.js generation policy"
                value={policyCode}
                onChange={(event) => { setPolicyCode(event.target.value); setPolicy(null); setPolicyMessage("Code changed. Validate the policy again."); }}
                spellCheck="false"
              />
              <div className="policy-editor-footer">
                <p className={policy ? "policy-status valid" : "policy-status"} aria-live="polite">{policyMessage}</p>
                <button className="action-button" type="button" onClick={validatePolicy}>Validate policy</button>
              </div>
            </div>
          </div>
        </CodingSection>

        <TextBoxSection
          id="lab"
          label="5 · Live browser inference"
          title="Compare baseline sampling with a constrained conversational policy"
          description="The same user request is generated twice. The baseline uses the full distribution without repetition controls; the constrained path applies your code, token suppression, style conditioning, and a deterministic text contract."
        >
          <div className="model-loader">
            <div>
              <span className="section-label">On-demand model</span>
              <h3>SmolLM2-135M-Instruct · q4 ONNX</h3>
              <p>{modelFile} · {backend}</p>
            </div>
            <div className="load-actions">
              <div className="load-progress"><i><b style={{ width: `${modelProgress}%` }} /></i><span>{modelProgress}%</span></div>
              <button className="action-button" type="button" onClick={loadModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>
                {modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? "Downloading model" : "Load local LLM (~181 MB)"}
              </button>
            </div>
          </div>

          <div className="inference-controls">
            <label className="control-block full-control">
              <span>User prompt</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <label className="control-block full-control">
              <span>Conversational system instruction</span>
              <textarea value={styleInstruction} onChange={(event) => setStyleInstruction(event.target.value)} />
            </label>
            <label className="control-block full-control">
              <span>Suppress token sequences · comma separated</span>
              <input value={bannedPhrases} onChange={(event) => setBannedPhrases(event.target.value)} />
            </label>
            <label className="control-block">
              <span>Maximum words · {maxWords}</span>
              <input type="range" min="12" max="80" value={maxWords} onChange={(event) => setMaxWords(Number(event.target.value))} />
            </label>
            <label className="control-block">
              <span>Maximum sentences · {maxSentences}</span>
              <input type="range" min="1" max="5" value={maxSentences} onChange={(event) => setMaxSentences(Number(event.target.value))} />
            </label>
            <label className="check-control">
              <input type="checkbox" checked={stripMarkdown} onChange={(event) => setStripMarkdown(event.target.checked)} />
              <span>Strip markdown, headings, lists, and code fences</span>
            </label>
          </div>

          <button
            className="action-button comparison-button"
            type="button"
            onClick={runComparison}
            disabled={modelStatus !== "ready" || !policy || !prompt.trim() || isGenerating}
          >
            {isGenerating ? generationStage : "Generate baseline and constrained outputs"}
          </button>
          {modelError ? <p className="runtime-error">{modelError}</p> : null}

          <div className="comparison-grid">
            <article className="output-card">
              <div className="output-card-header"><span>Baseline</span><b>τ 1.0 · full distribution · no penalties</b></div>
              <div className="generated-output" aria-live="polite">{rawOutput || "Baseline output will stream here."}</div>
            </article>
            <article className="output-card constrained-card">
              <div className="output-card-header"><span>Constrained</span><b>{policy ? `τ ${policy.temperature} · k ${policy.topK} · p ${policy.topP}` : "policy not validated"}</b></div>
              <div className="generated-output" aria-live="polite">{constrainedOutput || "Constrained output will stream here."}</div>
            </article>
          </div>
          <p className="generation-status">{generationStage}</p>
        </TextBoxSection>

        <DiagramSection
          label="6 · Constraint order"
          title="Prompt conditioning, logit processing, sampling, and output filtering"
          description="The order matters because each stage operates on a different representation: messages, token logits, sampled token IDs, or decoded text."
        >
          <div className="constraint-stack">
            <article><span>Prompt layer</span><h3>System instruction</h3><p>Conditions the model before decoding begins.</p></article>
            <article><span>Logit layer</span><h3>Penalty + forbidden IDs</h3><p>Changes or removes scores before normalization.</p></article>
            <article><span>Sampling layer</span><h3>top-k + top-p + temperature</h3><p>Defines the candidate set and its entropy.</p></article>
            <article><span>Text layer</span><h3>Length + format contract</h3><p>Enforces deterministic product requirements.</p></article>
          </div>
        </DiagramSection>

        <ParagraphSection
          label="7 · Interpretation"
          title="Constrained decoding changes behavior without changing model weights"
          description="The comparison isolates inference-time control: both outputs come from the same quantized transformer, but a different sequence of processors changes which continuations are reachable."
        >
          <div className="reading-copy two-up-reading">
            <p>
              A decoding policy cannot add knowledge that the model did not learn. It can reduce
              repetition, remove prohibited phrases, control entropy, and impose output shape. If
              the constrained answer becomes bland or incomplete, the candidate set is probably too
              narrow or the deterministic word limit is truncating useful content.
            </p>
            <p>
              In production, these controls usually sit alongside safety classifiers, structured
              output validators, retrieval, tool execution, and application-specific rules. The
              useful mental model is a pipeline: the transformer supplies probabilities; the
              surrounding system decides how those probabilities may become user-visible text.
            </p>
          </div>
        </ParagraphSection>

        <HeaderSection
          label="Next implementation"
          title="Token-level inspection and custom logits processors"
          description={<p>Expose the top token candidates at each step, visualize entropy, and implement a custom processor that changes logits before the sampler receives them.</p>}
          size="medium"
        />
      </div>

      <footer className="site-footer">
        <span className="wordmark"><span className="wordmark-dot" />latent</span>
        <p>Technical, implementation-first lessons for language-model systems.</p>
        <a href="https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX" target="_blank" rel="noreferrer">Model card ↗</a>
      </footer>
    </main>
  );
}
