"use client";

import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";

const PAPER_URL = "https://arxiv.org/abs/1904.09751";
const MODEL_ID = "onnx-community/SmolLM2-135M-Instruct-ONNX";

const PAPER_CONTEXT = `
You are the discussion partner for one research paper: "The Curious Case of Neural Text Degeneration" by Ari Holtzman, Jan Buys, Li Du, Maxwell Forbes, and Yejin Choi.

Use this compact paper context when answering:
- The paper studies open-ended neural text generation and compares human text with text produced by likelihood-maximizing decoding and stochastic sampling.
- Maximization methods such as greedy and beam search often become bland or repetitive, even when the underlying language model assigns useful probabilities.
- Sampling from the full distribution avoids some repetition but can select from an unreliable low-probability tail, producing incoherent continuations.
- Nucleus sampling, also called top-p sampling, sorts next-token probabilities and retains the smallest dynamic set whose cumulative mass is at least p. It samples only from that renormalized set.
- Unlike top-k, the nucleus changes size with the uncertainty of the model: it is small for peaked distributions and larger for flatter distributions.
- The paper's central lesson is that generation quality depends on the decoding algorithm, not only on model weights or likelihood.
- Nucleus sampling is a decoding heuristic, not a source of new knowledge, a safety system, or a guarantee of factuality. The choice of p remains application-dependent.

Answer precisely and pedagogically. Distinguish claims made by the paper from later practice. If the question cannot be answered from this context, say what additional source would be needed. Keep answers under 220 words unless the user asks for more detail.
`.trim();

const CODE_BLOCKS = [
  {
    id: "softmax",
    label: "Temperature-scaled softmax",
    purpose: "Convert logits into a normalized next-token distribution.",
    code: `function softmax(logits, temperature = 1) {
  const scaled = logits.map((logit) => logit / temperature);
  const maxLogit = Math.max(...scaled);
  const weights = scaled.map((logit) => Math.exp(logit - maxLogit));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map((weight) => weight / total);
}`,
  },
  {
    id: "nucleus",
    label: "Dynamic nucleus",
    purpose: "Keep the smallest ranked token set whose probability mass reaches p.",
    code: `function nucleus(tokens, probabilities, topP = 0.9) {
  const ranked = tokens
    .map((token, index) => ({ token, index, probability: probabilities[index] }))
    .sort((a, b) => b.probability - a.probability);

  const kept = [];
  let cumulativeMass = 0;

  for (const candidate of ranked) {
    kept.push(candidate);
    cumulativeMass += candidate.probability;
    if (cumulativeMass >= topP) break;
  }

  return kept.map((candidate) => ({
    ...candidate,
    probability: candidate.probability / cumulativeMass,
  }));
}`,
  },
  {
    id: "policy",
    label: "Generation policy",
    purpose: "Expose the inference-time controls used by the local transformer.",
    code: `const policy = {
  temperature: 0.78,
  top_k: 50,
  top_p: 0.9,
  repetition_penalty: 1.12,
  no_repeat_ngram_size: 3,
  max_new_tokens: 64,
};`,
  },
  {
    id: "contract",
    label: "Output contract",
    purpose: "Apply deterministic product requirements after token decoding.",
    code: `function enforceOutputContract(text, { maxWords, banned }) {
  let output = text.replace(/[*_\x60#>]/g, " ");

  for (const phrase of banned) {
    let matchIndex = output.toLowerCase().indexOf(phrase.toLowerCase());
    while (matchIndex !== -1) {
      output = output.slice(0, matchIndex) + output.slice(matchIndex + phrase.length);
      matchIndex = output.toLowerCase().indexOf(phrase.toLowerCase());
    }
  }

  const words = output.replace(/\\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.length > maxWords
    ? words.slice(0, maxWords).join(" ") + "…"
    : words.join(" ");
}`,
  },
] as const;

type BlockId = (typeof CODE_BLOCKS)[number]["id"];
type ChatMessage = { role: "user" | "assistant"; content: string };
type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type TensorLike = { tolist: () => number[][] };
type Tokenizer = {
  (input: string | string[], options?: Record<string, unknown>): {
    input_ids: TensorLike;
    attention_mask?: TensorLike;
  };
};
type TextGenerator = {
  tokenizer: Tokenizer;
  (input: ModelMessage[], options?: Record<string, unknown>): Promise<unknown>;
};
type TextStreamerConstructor = new (
  tokenizer: Tokenizer,
  options: {
    skip_prompt: boolean;
    skip_special_tokens: boolean;
    callback_function: (text: string) => void;
  },
) => unknown;
type Candidate = { token: string; index: number; probability: number };
type GenerationPolicy = {
  temperature: number;
  top_k: number;
  top_p: number;
  repetition_penalty: number;
  no_repeat_ngram_size: number;
  max_new_tokens: number;
};
type PracticeImplementation = {
  softmax: (logits: number[], temperature?: number) => number[];
  nucleus: (tokens: string[], probabilities: number[], topP?: number) => Candidate[];
  policy: GenerationPolicy;
  enforceOutputContract: (
    text: string,
    options: { maxWords: number; banned: string[] },
  ) => string;
};
type CheckResult = { label: string; passed: boolean; detail: string };

const DISTRIBUTION = [
  { token: "the", probability: 0.32 },
  { token: "a", probability: 0.24 },
  { token: "this", probability: 0.16 },
  { token: "one", probability: 0.1 },
  { token: "some", probability: 0.07 },
  { token: "very", probability: 0.05 },
  { token: "odd", probability: 0.03 },
  { token: "rare", probability: 0.02 },
  { token: "noise", probability: 0.01 },
];

function composeSource(hiddenBlocks: BlockId[], answers: Partial<Record<BlockId, string>>) {
  return CODE_BLOCKS.map((block) =>
    hiddenBlocks.includes(block.id) ? answers[block.id] ?? "" : block.code,
  ).join("\n\n");
}

function compileImplementation(source: string) {
  const factory = new Function(
    `"use strict";\n${source}\nreturn { softmax, nucleus, policy, enforceOutputContract };`,
  );
  return factory() as PracticeImplementation;
}

function evaluateImplementation(source: string) {
  const implementation = compileImplementation(source);
  const checks: CheckResult[] = [];
  const addCheck = (label: string, passed: boolean, detail: string) => {
    checks.push({ label, passed, detail });
  };

  const probabilities = implementation.softmax([2.2, 1.1, 0.3]);
  const sum = probabilities.reduce((total, probability) => total + probability, 0);
  addCheck(
    "Normalized distribution",
    probabilities.length === 3 && probabilities.every((value) => value > 0) && Math.abs(sum - 1) < 1e-6,
    `Σp = ${Number.isFinite(sum) ? sum.toFixed(6) : "invalid"}`,
  );

  const cold = implementation.softmax([2.2, 1.1, 0.3], 0.5);
  addCheck(
    "Temperature changes entropy",
    cold[0] > probabilities[0],
    `largest token: ${(probabilities[0] * 100).toFixed(1)}% → ${(cold[0] * 100).toFixed(1)}%`,
  );

  const nucleus = implementation.nucleus(
    ["A", "B", "C", "D"],
    [0.55, 0.3, 0.1, 0.05],
    0.82,
  );
  const nucleusMass = nucleus.reduce((total, candidate) => total + candidate.probability, 0);
  addCheck(
    "Minimal top-p set",
    nucleus.length === 2 && nucleus[0]?.token === "A" && nucleus[1]?.token === "B" && Math.abs(nucleusMass - 1) < 1e-6,
    `kept ${nucleus.map((candidate) => candidate.token).join(", ") || "nothing"}`,
  );

  const policy = implementation.policy;
  addCheck(
    "Usable generation policy",
    policy.top_p > 0 && policy.top_p <= 1 && policy.temperature > 0 && policy.max_new_tokens >= 8,
    `τ ${policy.temperature} · p ${policy.top_p} · ${policy.max_new_tokens} tokens`,
  );

  const contracted = implementation.enforceOutputContract(
    "Certainly, this is a deliberately long answer with several words that should be restricted by the final contract.",
    { maxWords: 8, banned: ["certainly"] },
  );
  addCheck(
    "Deterministic output contract",
    contracted.split(/\s+/).filter(Boolean).length <= 8 && !/certainly/i.test(contracted),
    contracted,
  );

  return { implementation, checks };
}

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

export default function Home() {
  const generatorRef = useRef<TextGenerator | null>(null);
  const streamerRef = useRef<TextStreamerConstructor | null>(null);

  const [paperTopP, setPaperTopP] = useState(0.9);
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [answerModel, setAnswerModel] = useState("");

  const [hiddenBlocks, setHiddenBlocks] = useState<BlockId[]>([]);
  const [answers, setAnswers] = useState<Partial<Record<BlockId, string>>>({});
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [practiceMessage, setPracticeMessage] = useState("The reference implementation is complete and runnable.");

  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelDetail, setModelDetail] = useState("Model not loaded");
  const [modelError, setModelError] = useState("");
  const [prompt, setPrompt] = useState("Write a short opening for a story about a radio signal received from an empty planet.");
  const [bannedPhrases, setBannedPhrases] = useState("certainly, delve, as an AI");
  const [maxWords, setMaxWords] = useState(44);
  const [baselineOutput, setBaselineOutput] = useState("");
  const [nucleusOutput, setNucleusOutput] = useState("");
  const [generationStatus, setGenerationStatus] = useState("Load the model when you are ready to compare outputs.");
  const [generating, setGenerating] = useState(false);

  const retainedTokens = useMemo(() => {
    let cumulative = 0;
    let cutoffIndex = DISTRIBUTION.length - 1;
    for (let index = 0; index < DISTRIBUTION.length; index += 1) {
      cumulative += DISTRIBUTION[index].probability;
      if (cumulative >= paperTopP) {
        cutoffIndex = index;
        break;
      }
    }
    return { cutoffIndex, cumulative };
  }, [paperTopP]);

  const currentSource = composeSource(hiddenBlocks, answers);
  const passedChecks = checks.filter((check) => check.passed).length;

  const toggleBlock = (id: BlockId) => {
    setChecks([]);
    setPracticeMessage("Implementation changed. Run the checks again.");
    setHiddenBlocks((current) => {
      if (current.includes(id)) return current.filter((blockId) => blockId !== id);
      setAnswers((existing) => ({ ...existing, [id]: existing[id] ?? "" }));
      return [...current, id];
    });
  };

  const practiceAll = () => {
    const blankAnswers = Object.fromEntries(CODE_BLOCKS.map((block) => [block.id, ""])) as Record<BlockId, string>;
    setAnswers(blankAnswers);
    setHiddenBlocks(CODE_BLOCKS.map((block) => block.id));
    setChecks([]);
    setPracticeMessage("All conceptual blocks are hidden. Reconstruct them in any valid way.");
  };

  const showSolution = () => {
    setHiddenBlocks([]);
    setChecks([]);
    setPracticeMessage("Reference solution restored. Your previous attempts are still available if you hide a block again.");
  };

  const runChecks = () => {
    try {
      const result = evaluateImplementation(currentSource);
      setChecks(result.checks);
      const passed = result.checks.filter((check) => check.passed).length;
      setPracticeMessage(
        passed === result.checks.length
          ? "All behavioral checks pass. The implementation is ready for the live model."
          : `${passed} of ${result.checks.length} behavioral checks pass.`,
      );
    } catch (error) {
      setChecks([]);
      setPracticeMessage(error instanceof Error ? error.message : "The implementation could not run.");
    }
  };

  const askPaper = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!openRouterKey.trim() || !trimmedQuestion || asking) return;

    const nextChat = [...chat, { role: "user", content: trimmedQuestion } as ChatMessage];
    setChat(nextChat);
    setQuestion("");
    setQuestionError("");
    setAsking(true);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey.trim()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Latent Paper Lab",
        },
        body: JSON.stringify({
          model: "openrouter/auto",
          messages: [
            { role: "system", content: PAPER_CONTEXT },
            ...nextChat.map((message) => ({ role: message.role, content: message.content })),
          ],
        }),
      });
      const data = (await response.json()) as {
        error?: { message?: string };
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      if (!response.ok) throw new Error(data.error?.message ?? `OpenRouter returned ${response.status}.`);
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error("The model returned an empty answer.");
      setChat((current) => [...current, { role: "assistant", content: answer }]);
      setAnswerModel(data.model ?? "openrouter/auto");
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "The question could not be answered.");
    } finally {
      setAsking(false);
    }
  };

  const loadModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    setModelStatus("loading");
    setModelError("");
    setModelProgress(0);
    setModelDetail("Resolving model files");

    try {
      const transformers = await import("@huggingface/transformers");
      streamerRef.current = transformers.TextStreamer as unknown as TextStreamerConstructor;
      const progressCallback = (info: unknown) => {
        const progress = info as { progress?: number; file?: string; status?: string };
        if (typeof progress.progress === "number") setModelProgress(Math.round(progress.progress));
        if (progress.file) setModelDetail(progress.file.split("/").at(-1) ?? progress.file);
        if (progress.status === "ready") setModelProgress(100);
      };

      const hasWebGPU = "gpu" in navigator;
      let generator: TextGenerator;
      if (hasWebGPU) {
        try {
          setModelDetail("Initializing WebGPU · q4");
          generator = (await transformers.pipeline("text-generation", MODEL_ID, {
            device: "webgpu",
            dtype: "q4",
            progress_callback: progressCallback,
          })) as unknown as TextGenerator;
        } catch {
          setModelDetail("WebGPU unavailable; initializing WASM · q4");
          generator = (await transformers.pipeline("text-generation", MODEL_ID, {
            device: "wasm",
            dtype: "q4",
            progress_callback: progressCallback,
          })) as unknown as TextGenerator;
        }
      } else {
        setModelDetail("Initializing WASM · q4");
        generator = (await transformers.pipeline("text-generation", MODEL_ID, {
          device: "wasm",
          dtype: "q4",
          progress_callback: progressCallback,
        })) as unknown as TextGenerator;
      }

      generatorRef.current = generator;
      setModelStatus("ready");
      setModelProgress(100);
      setModelDetail(`SmolLM2-135M-Instruct · ${hasWebGPU ? "WebGPU or WASM fallback" : "WASM CPU"}`);
      setGenerationStatus("The local model is ready.");
    } catch (error) {
      setModelStatus("error");
      setModelError(error instanceof Error ? error.message : "The model could not be initialized.");
      setGenerationStatus("Model initialization failed.");
    }
  };

  const generateWithStream = async (
    generator: TextGenerator,
    messages: ModelMessage[],
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

  const compareGenerations = async () => {
    const generator = generatorRef.current;
    if (!generator || !prompt.trim() || generating) return;
    setModelError("");
    setBaselineOutput("");
    setNucleusOutput("");
    setGenerating(true);

    try {
      const { implementation, checks: latestChecks } = evaluateImplementation(currentSource);
      setChecks(latestChecks);
      if (latestChecks.some((check) => !check.passed)) {
        throw new Error("The practice implementation must pass all checks before it controls the model.");
      }

      const messages: ModelMessage[] = [
        { role: "system", content: "Continue directly in plain prose. Do not use headings, lists, or disclaimers." },
        { role: "user", content: prompt.trim() },
      ];

      setGenerationStatus("Generating from the full probability distribution…");
      const baseline = await generateWithStream(
        generator,
        messages,
        {
          max_new_tokens: implementation.policy.max_new_tokens,
          do_sample: true,
          temperature: 1,
          top_k: 0,
          top_p: 1,
          repetition_penalty: 1,
          no_repeat_ngram_size: 0,
        },
        setBaselineOutput,
      );
      setBaselineOutput(baseline);

      setGenerationStatus("Generating from the nucleus defined by your implementation…");
      const nucleus = await generateWithStream(
        generator,
        messages,
        {
          max_new_tokens: implementation.policy.max_new_tokens,
          do_sample: true,
          temperature: implementation.policy.temperature,
          top_k: implementation.policy.top_k,
          top_p: implementation.policy.top_p,
          repetition_penalty: implementation.policy.repetition_penalty,
          no_repeat_ngram_size: implementation.policy.no_repeat_ngram_size,
          renormalize_logits: true,
        },
        setNucleusOutput,
      );
      const banned = bannedPhrases.split(",").map((phrase) => phrase.trim()).filter(Boolean);
      setNucleusOutput(implementation.enforceOutputContract(nucleus, { maxWords, banned }));
      setGenerationStatus("Comparison complete. Run it again to observe sampling variance.");
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Generation failed.");
      setGenerationStatus("Generation stopped.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="orbit orbit-three" />
        <span className="node node-one" />
        <span className="node node-two" />
        <span className="warm-star" />
      </div>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Latent home"><i />latent</a>
        <nav aria-label="Paper lab navigation">
          <a href="#summary">Summary</a>
          <a href="#questions">Questions</a>
          <a href="#implementation">Implementation</a>
        </nav>
        <span>Paper lab 01</span>
      </header>

      <article className="paper-page" id="top">
        <header className="paper-hero">
          <p className="eyebrow">Decoding · Holtzman et al. · 2020</p>
          <h1>Neural Text Degeneration</h1>
          <p className="paper-thesis">
            The model is only half the generator. The algorithm that selects its next token can
            determine whether language remains coherent, collapses into repetition, or wanders into noise.
          </p>
          <a className="paper-link" href={PAPER_URL} target="_blank" rel="noreferrer">
            <span>Original paper</span>
            <strong>The Curious Case of Neural Text Degeneration</strong>
            <em>Read ↗</em>
          </a>
        </header>

        <section className="paper-section summary-section" id="summary">
          <div className="section-title">
            <span>01</span>
            <h2>Summary</h2>
          </div>
          <div className="summary-layout">
            <div className="summary-copy">
              <p><strong>The problem.</strong> A language model produces a probability distribution over the next token. Turning that distribution into text requires a separate decoding decision. Greedy search and beam search maximize likelihood, yet open-ended generations from these methods often become generic and repeat themselves.</p>
              <p><strong>The other failure mode.</strong> Sampling from the complete distribution introduces diversity, but it also exposes the unreliable tail: many individually unlikely tokens that collectively contain substantial probability mass. Selecting one of them can push a continuation away from coherent human language.</p>
              <p><strong>The finding.</strong> Nucleus sampling sorts tokens by probability and keeps the smallest dynamic set whose cumulative mass reaches a threshold <em>p</em>. The candidate set contracts when the model is confident and expands when uncertainty is genuinely distributed across several plausible continuations.</p>
              <p><strong>The implication.</strong> Generation quality is not determined by model weights alone. The same model can produce repetitive, incoherent, or fluent text depending on its inference policy. Top-p is a useful heuristic—not new knowledge, factuality, or safety—and its threshold remains an application decision.</p>
            </div>

            <div className="nucleus-diagram" aria-label="Interactive nucleus sampling diagram">
              <div className="diagram-control">
                <div><span>Nucleus threshold</span><strong>p = {paperTopP.toFixed(2)}</strong></div>
                <input
                  aria-label="Nucleus probability threshold"
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={paperTopP}
                  onChange={(event) => setPaperTopP(Number(event.target.value))}
                />
              </div>
              <div className="probability-list">
                {DISTRIBUTION.map((candidate, index) => {
                  const retained = index <= retainedTokens.cutoffIndex;
                  return (
                    <div className={retained ? "probability-token retained" : "probability-token removed"} key={candidate.token}>
                      <span>{candidate.token}</span>
                      <i><b style={{ width: `${candidate.probability * 100 / DISTRIBUTION[0].probability}%` }} /></i>
                      <code>{candidate.probability.toFixed(2)}</code>
                    </div>
                  );
                })}
              </div>
              <div className="diagram-result">
                <span>{retainedTokens.cutoffIndex + 1} tokens retained</span>
                <span>{retainedTokens.cumulative.toFixed(2)} cumulative mass</span>
                <span>tail removed before sampling</span>
              </div>
            </div>
          </div>
        </section>

        <section className="paper-section questions-section" id="questions">
          <div className="section-title">
            <span>02</span>
            <h2>Questions</h2>
          </div>
          <div className="questions-layout">
            <aside className="key-panel">
              <p>Ask an LLM to explain, challenge, or extend the summary while keeping the discussion grounded in this paper.</p>
              <label>
                <span>OpenRouter API key</span>
                <div className="key-input">
                  <input
                    type={showKey ? "text" : "password"}
                    value={openRouterKey}
                    onChange={(event) => setOpenRouterKey(event.target.value)}
                    placeholder="sk-or-v1-…"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide" : "Show"}</button>
                </div>
              </label>
              <div className="key-note">
                <i />
                <span>Held only in this tab&apos;s memory and sent directly to OpenRouter. Refreshing clears it.</span>
              </div>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">Create a limited key ↗</a>
            </aside>

            <div className="paper-chat">
              <div className="chat-log" aria-live="polite">
                {chat.length === 0 ? (
                  <div className="empty-chat">
                    <span>Suggested questions</span>
                    {["Why does beam search repeat?", "How is top-p different from top-k?", "What does this paper not solve?"].map((suggestion) => (
                      <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>
                    ))}
                  </div>
                ) : chat.map((message, index) => (
                  <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                    <span>{message.role === "user" ? "You" : "Paper guide"}</span>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
              <form className="question-form" onSubmit={askPaper}>
                <textarea
                  aria-label="Question about the paper"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about a claim, equation, assumption, or limitation…"
                />
                <button type="submit" disabled={!openRouterKey.trim() || !question.trim() || asking}>
                  {asking ? "Thinking…" : "Ask paper"}
                </button>
              </form>
              <div className="chat-status">
                <span>{questionError || (answerModel ? `Answered by ${answerModel}` : "Grounded in the lesson summary")}</span>
                {openRouterKey ? <button type="button" onClick={() => setOpenRouterKey("")}>Clear key</button> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="paper-section implementation-section" id="implementation">
          <div className="section-title">
            <span>03</span>
            <h2>Implementation</h2>
          </div>
          <p className="implementation-intro">
            Begin with the complete solution. Run it, then hide any conceptual block and reconstruct
            it without losing the surrounding program. Checks judge behavior rather than exact text.
          </p>

          <div className="practice-editor">
            <div className="editor-toolbar">
              <div>
                <span>nucleus-sampling.js</span>
                <strong>{hiddenBlocks.length === 0 ? "Reference mode" : `Practice mode · ${hiddenBlocks.length} hidden`}</strong>
              </div>
              <div className="toolbar-actions">
                <button type="button" onClick={practiceAll}>Hide all blocks</button>
                <button type="button" onClick={showSolution} disabled={hiddenBlocks.length === 0}>Show solution</button>
              </div>
            </div>

            <div className="code-surface">
              {CODE_BLOCKS.map((block, blockIndex) => {
                const hidden = hiddenBlocks.includes(block.id);
                const startLine = CODE_BLOCKS.slice(0, blockIndex).reduce(
                  (line, previous) => line + previous.code.split("\n").length + 1,
                  1,
                );
                return (
                  <div className={`practice-block ${hidden ? "is-hidden" : ""}`} key={block.id}>
                    <div className="block-heading">
                      <div><span>0{blockIndex + 1}</span><strong>{block.label}</strong><em>{block.purpose}</em></div>
                      <button type="button" onClick={() => toggleBlock(block.id)}>
                        {hidden ? "Reveal solution" : "Hide to practice"}
                      </button>
                    </div>
                    {hidden ? (
                      <div className="answer-area">
                        <textarea
                          aria-label={`Reimplement ${block.label}`}
                          value={answers[block.id] ?? ""}
                          onChange={(event) => {
                            setAnswers((current) => ({ ...current, [block.id]: event.target.value }));
                            setChecks([]);
                            setPracticeMessage("Implementation changed. Run the checks again.");
                          }}
                          placeholder={`// Reimplement: ${block.purpose}`}
                          spellCheck="false"
                        />
                        <button type="button" onClick={() => setAnswers((current) => ({ ...current, [block.id]: "" }))}>Clear attempt</button>
                      </div>
                    ) : (
                      <div className="code-lines">
                        {block.code.split("\n").map((line, lineIndex) => (
                          <div key={`${block.id}-${lineIndex}`}><span>{startLine + lineIndex}</span><code>{line || " "}</code></div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="editor-footer">
              <p>{practiceMessage}</p>
              <button type="button" onClick={runChecks}>Run behavioral checks</button>
            </div>
          </div>

          {checks.length > 0 ? (
            <div className="check-grid" aria-live="polite">
              {checks.map((check) => (
                <div className={check.passed ? "check passed" : "check failed"} key={check.label}>
                  <i>{check.passed ? "✓" : "×"}</i>
                  <span><strong>{check.label}</strong><em>{check.detail}</em></span>
                </div>
              ))}
              <div className="check-score"><strong>{passedChecks}/{checks.length}</strong><span>checks pass</span></div>
            </div>
          ) : null}

          <div className="live-lab">
            <div className="lab-header">
              <div><span>Run on a real local transformer</span><strong>SmolLM2-135M-Instruct · q4</strong><em>{modelDetail}</em></div>
              <div className="model-action">
                <i><b style={{ width: `${modelProgress}%` }} /></i>
                <button type="button" onClick={loadModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>
                  {modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${modelProgress}% downloaded` : "Load model · ~181 MB"}
                </button>
              </div>
            </div>
            <div className="lab-controls">
              <label className="prompt-control"><span>Shared prompt</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
              <label><span>Remove phrases</span><input value={bannedPhrases} onChange={(event) => setBannedPhrases(event.target.value)} /></label>
              <label><span>Maximum words · {maxWords}</span><input type="range" min="16" max="90" value={maxWords} onChange={(event) => setMaxWords(Number(event.target.value))} /></label>
            </div>
            <button
              className="compare-button"
              type="button"
              onClick={compareGenerations}
              disabled={modelStatus !== "ready" || generating || !prompt.trim()}
            >
              {generating ? "Generating comparison…" : "Compare full sampling with your nucleus policy"}
            </button>
            {modelError ? <p className="model-error">{modelError}</p> : null}
            <div className="output-grid">
              <article><header><span>Full distribution</span><code>τ 1.0 · p 1.0</code></header><p>{baselineOutput || "The untruncated sample will stream here."}</p></article>
              <article className="nucleus-output"><header><span>Nucleus + contract</span><code>your implementation</code></header><p>{nucleusOutput || "The constrained sample will stream here."}</p></article>
            </div>
            <p className="generation-status">{generationStatus}</p>
          </div>
        </section>

        <footer className="paper-footer">
          <span>Paper lab 01 complete</span>
          <p>Next: train a character-level language model from Karpathy&apos;s recurrent-network essay.</p>
          <a href="#top">Return to source ↑</a>
        </footer>
      </article>
    </main>
  );
}
