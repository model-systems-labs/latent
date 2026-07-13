"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CodeBlock, CourseLesson } from "@latent/course-kit";
import { courseLessons } from "../lessons/course";
import { LessonExperiment } from "./LessonExperiment";
import {
  lessonIsComplete,
  initializeLearnerPersistence,
  loadLearnerState,
  recordVerifiedCells,
  saveLessonPractice,
  useLearnerState,
} from "../lib/learner-state";
import { ensureProjectWorkspace, initializeProjectPersistence, saveLessonProjectFile, type LessonProjectSeed } from "../lib/project-workspace";
import { runPracticeContracts } from "../features/ide/browser-lab-service";
import { ArtifactRuntimePanel } from "../features/artifacts/ArtifactRuntimePanel";
import { recordValidatedLessonArtifact } from "../features/artifacts/lesson-artifacts";
import { latentTensorOperations } from "@latent/tensor";
import { lessonImplementationPrelude, lessonImplementationSource } from "../lessons/implementation-source";
import { canonicalProjectSeeds } from "../lib/canonical-project";
import { bindBlockVerification, invalidateBlockVerification, practiceBlockSource, restoreSourceBoundVerification, waitForPracticeHydration } from "../features/ide/practice-state";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";

type ChatMessage = { role: "user" | "assistant"; content: string };
type CheckResult = { label: string; passed: boolean; detail: string };

function Atmosphere() {
  return (
    <div className="page-atmosphere" aria-hidden="true">
      <span className="orbit orbit-one" />
      <span className="orbit orbit-two" />
      <span className="orbit orbit-three" />
      <span className="node node-one" />
      <span className="node node-two" />
      <span className="warm-star" />
    </div>
  );
}

export function HeaderSection({ lesson }: { lesson: CourseLesson }) {
  return (
    <header className="paper-hero">
      <p className="eyebrow">{lesson.eyebrow}</p>
      <h1>{lesson.title}</h1>
      <p className="paper-thesis">{lesson.thesis}</p>
      <div className="hero-record">
        <span>{lesson.modeLabel}</span>
        <span>{lesson.authors}</span>
        <span>{lesson.year}</span>
      </div>
      <section className="source-set" aria-labelledby="lesson-sources-title">
        <div className="source-set-heading">
          <h2 id="lesson-sources-title">Sources</h2>
          <span>{lesson.sources.length} references</span>
        </div>
        <ul className="source-list">
          {lesson.sources.map((source) => (
            <li className="source-entry" key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                <span className="source-citation">
                  <strong>{source.title}</strong>
                  <span>{source.authors} · {source.year} ↗</span>
                </span>
                <p>{source.relevance}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </header>
  );
}

export function DiagramSection({ lesson }: { lesson: CourseLesson }) {
  const isRecurrent = lesson.id === "character-rnns";
  const isNeuralLanguageModel = lesson.id === "neural-language-models";
  const isSubwordTokenization = lesson.id === "subword-tokenization";
  const isAdditiveAttention = lesson.id === "additive-attention";
  const isTransformer = lesson.id === "transformers";
  const isInContextLearning = lesson.id === "in-context-learning";
  const isInferenceRuntime = lesson.id === "inference-runtime";
  const isSchedulingMemory = lesson.id === "scheduling-memory";
  const isStreamingTransport = lesson.id === "streaming-transport";
  const isReliabilityObservability = lesson.id === "reliability-observability";
  const recurrentSteps = [
    { time: "t − 1", input: "x_(t−1)", previous: "h_(t−2)", state: "h_(t−1)", prediction: "p(x_t)" },
    { time: "t", input: "x_t", previous: "h_(t−1)", state: "h_t", prediction: "p(x_(t+1))" },
    { time: "t + 1", input: "x_(t+1)", previous: "h_t", state: "h_(t+1)", prediction: "p(x_(t+2))" },
  ];
  return (
    <figure className={`concept-diagram${isRecurrent ? " recurrence-diagram" : ""}${isNeuralLanguageModel ? " neural-lm-diagram" : ""}${isSubwordTokenization ? " subword-tokenization-diagram" : ""}${isAdditiveAttention ? " additive-attention-diagram" : ""}${isTransformer ? " transformer-attention-diagram" : ""}${isInContextLearning ? " icl-comparison-diagram" : ""}${isInferenceRuntime ? " inference-runtime-diagram" : ""}${isSchedulingMemory ? " scheduling-memory-diagram" : ""}${isStreamingTransport ? " streaming-transport-diagram" : ""}${isReliabilityObservability ? " reliability-observability-diagram" : ""}`}>
      <header><span>Mechanism</span><strong>{lesson.diagram.title}</strong></header>
      {isRecurrent ? (
        <div className="recurrence-unroll" role="img" aria-label="Three recurrent time steps. Each input and previous hidden state produce a new hidden state, then logits and a next-character probability. The hidden state flows into the next step and the same parameters are reused.">
          <div className="unroll-columns">
            {recurrentSteps.map((step) => (
              <div className="unroll-step" key={step.time}>
                <span className="unroll-time">position {step.time}</span>
                <code className="unroll-input">{step.input}<small>current character</small></code>
                <i aria-hidden="true">↓</i>
                <strong className="unroll-state">{step.state}<small>new memory</small></strong>
                <code className="unroll-equation">tanh(Wxh {step.input} + Whh {step.previous} + b)</code>
                <i aria-hidden="true">↓</i>
                <code className="unroll-output">logits → softmax → {step.prediction}</code>
              </div>
            ))}
          </div>
          <div className="unroll-rails">
            <span><b>Hidden-state flow</b> h_(t−1) → h_t → h_(t+1)</span>
            <span><b>Generation loop</b> sample from p(x_(t+1)) → encode as x_(t+1)</span>
            <span><b>Shared at every position</b> Wxh · Whh · Why · biases</span>
          </div>
        </div>
      ) : isNeuralLanguageModel ? (
        <div className="neural-probability-path" role="img" aria-label="A two-word context is converted to ids, embedding rows, a mean context vector, vocabulary logits, stable softmax probabilities, and negative log-likelihood for the target word. Unlike an exact count, learned vectors can share parameters across related contexts.">
          <div className="generalization-contrast">
            <span><b>Exact count</b><code>“the researcher” unseen → no direct trigram estimate</code></span>
            <span><b>Learned coordinates</b><code>similar predictive use → shared embedding geometry</code></span>
          </div>
          <ol className="probability-stages">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="toy-vocabulary" aria-label="Toy output vocabulary labels">
            <span><b>Output order</b> reads · writes · sleeps</span>
            <span><b>Observed target</b> reads</span>
          </div>
        </div>
      ) : isSubwordTokenization ? (
        <div className="bpe-worked-example" role="img" aria-label="A tiny corpus is counted, the most frequent l-o pair is merged everywhere, and counts are recomputed. A second comparison shows that reversing learned merge order changes the segmentation of a-b-c.">
          <ol className="bpe-rounds">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="bpe-order-contrast">
            <span>
              <b>Learned order</b>
              <code>[a,b] → [ab,c]</code>
              <em>a · b · c → ab · c → abc</em>
            </span>
            <span>
              <b>Reversed order</b>
              <code>[ab,c] → [a,b]</code>
              <em>a · b · c → a · b · c → ab · c</em>
            </span>
          </div>
        </div>
      ) : isAdditiveAttention ? (
        <div className="attention-worked-example" role="img" aria-label="At the year decoder step, one query is compared with the day, month, and year encoder states using the additive scoring network. Softmax across the three scores puts 0.951 alignment weight on year, and the weighted sum constructs the year context vector.">
          <ol className="attention-stages">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="attention-score-contrast">
            <span><b>Additive</b><code>vᵀ tanh(Wq q + Wk h_i + b)</code><em>learned projections + nonlinear scorer</em></span>
            <span><b>Dot product</b><code>qᵀ h_i</code><em>direct similarity; not this lesson&apos;s scorer</em></span>
          </div>
        </div>
      ) : isTransformer ? (
        <div className="transformer-worked-example" role="img" aria-label="A three-token causal attention computation. Input projections make Q, K, and V. Scaled query-key scores are masked above the diagonal and normalized row by row. The decoded row has probabilities 0.20, 0.33, and 0.46. Multiplying by value rows produces one context vector per token.">
          <ol className="transformer-stages">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="causal-matrix-block">
            <div className="matrix-heading">
              <span>Rows are queries · columns are keys</span>
              <code>P = softmax(mask(QKᵀ / √d_k))</code>
            </div>
            <table aria-label="Three-token causal attention probability matrix">
              <thead><tr><th scope="col">query ↓ / key →</th><th scope="col">the</th><th scope="col">receiver</th><th scope="col">decoded</th><th scope="col">‖context‖</th></tr></thead>
              <tbody>
                <tr><th scope="row">the</th><td>1.00</td><td className="masked-cell">0</td><td className="masked-cell">0</td><td>1.00</td></tr>
                <tr><th scope="row">receiver</th><td>0.20</td><td>0.80</td><td className="masked-cell">0</td><td>0.82</td></tr>
                <tr><th scope="row">decoded</th><td>0.20</td><td>0.33</td><td>0.46</td><td>0.60</td></tr>
              </tbody>
            </table>
            <p><span>Before softmax</span> cells above the diagonal are −Infinity. <span>Toy values</span> use unit basis rows, so each probability row (rounded to two decimals) is also its context vector and yields the shown norm.</p>
          </div>
          <div className="transformer-block-boundary">
            <b>Complete decoder block</b>
            <code>attention output → projection → residual + norm → MLP → residual + norm</code>
          </div>
        </div>
      ) : isInContextLearning ? (
        <div className="icl-comparison" role="img" aria-label="A controlled in-context learning experiment. The instruction, two held-out queries, frozen model weights, decoding, and exact-match scorer stay fixed. Only the prefix changes from zero to one to four demonstrations. The resulting two predictions can show sensitivity to the prefix but cannot establish general few-shot improvement.">
          <div className="icl-fixed-prefix">
            <span><b>Fixed instruction</b><code>infer mapping · return K or M</code></span>
            <span><b>Same held-out queries</b><code>moving story · tedious story</code></span>
          </div>
          <div className="icl-condition-paths" aria-label="Three prompt conditions">
            <span><b>Zero-shot</b><code>instruction → query</code><em>0 demonstrations</em></span>
            <span><b>One-shot</b><code>instruction → 1 example → query</code><em>1 demonstration</em></span>
            <span><b>Few-shot</b><code>instruction → 4 examples → query</code><em>4 demonstrations</em></span>
          </div>
          <div className="icl-frozen-model"><b>Frozen 135M model</b><code>prefix tokens alter activations + KV cache</code><em>weights updated: 0</em></div>
          <table className="icl-measurement-table" aria-label="Exact-match measurement plan for two held-out items">
            <thead><tr><th scope="col">Condition</th><th scope="col">Moving / K</th><th scope="col">Tedious / M</th><th scope="col">Exact match</th></tr></thead>
            <tbody>
              <tr><th scope="row">0 examples</th><td>prediction / K</td><td>prediction / M</td><td>? / 2</td></tr>
              <tr><th scope="row">1 example</th><td>prediction / K</td><td>prediction / M</td><td>? / 2</td></tr>
              <tr><th scope="row">4 examples</th><td>prediction / K</td><td>prediction / M</td><td>? / 2</td></tr>
            </tbody>
          </table>
          <div className="icl-inference-boundary">
            <span><b>Can infer</b> whether demonstrations changed either output in this run.</span>
            <span><b>Cannot infer</b> general accuracy gains or the paper&apos;s scale result from two items.</span>
          </div>
        </div>
      ) : isInferenceRuntime ? (
        <div className="runtime-worked-example" role="img" aria-label="Worked inference timeline for request r-104. It waits 18 milliseconds, prefills a 96-token prompt in 74 milliseconds using 6 KV pages, samples the first of 32 output tokens at a 92 millisecond TTFT, performs 31 subsequent one-position decode forwards while cache grows to 8 pages, then releases all pages. The KV cache byte formula uses both key and value, every layer, KV head, cached token, head coordinate, and bytes per value.">
          <div className="runtime-request-spec">
            <span><b>Request</b><code>r-104</code></span>
            <span><b>Prompt</b><code>96 tokens</code></span>
            <span><b>Output</b><code>32 tokens</code></span>
            <span><b>Final length</b><code>128 tokens</code></span>
          </div>
          <ol className="runtime-timeline">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="runtime-latency-definitions">
            <span><b>TTFT</b><code>queue + prefill = 18 + 74 = 92 ms</code><em>admission → first visible token</em></span>
            <span><b>ITL</b><code>gap between visible tokens</code><em>one-request decode responsiveness</em></span>
            <span><b>tokens/s</b><code>21.4 generated / second</code><em>steady decode rate</em></span>
          </div>
          <div className="runtime-cache-formula">
            <b>Per-request KV-cache bytes</b>
            <code>2 × layers × KV heads × cached tokens × head dimension × bytes / value</code>
            <em>2 means one key tensor + one value tensor. Under GQA, KV heads may be fewer than query heads.</em>
          </div>
        </div>
      ) : isSchedulingMemory ? (
        <div className="scheduler-worked-comparison" role="img" aria-label="A controlled scheduling comparison with the same arrivals and resource limits. Requests a, b, and c begin active while d waits, using 11 KV pages. In the static policy, a completed slot stays idle and d waits for the longest request, resulting in 116 iterations, 61 percent utilization, and a p95 wait of 19 steps. In continuous batching, a completion is recorded, its pages are released, and d joins the next iteration, resulting in 88 iterations, 86 percent utilization, and a p95 wait of 7 steps. These fixed results isolate policy for one synthetic workload and do not establish a universal production advantage.">
          <div className="scheduler-shared-workload">
            <span><b>Controlled input</b><code>a · b · c active</code></span>
            <span><b>Waiting</b><code>d</code></span>
            <span><b>KV allocation</b><code>11 pages</code></span>
            <span><b>Decode rule</b><code>≤ 1 token / active request</code></span>
          </div>
          <div className="scheduler-policy-comparison">
            <section>
              <header><span>Static batch</span><code>membership fixed</code></header>
              <ol>
                <li><b>01</b><span>a · b · c decode</span><em>d waits</em></li>
                <li><b>14</b><span>a finishes; its slot idles</span><em>d still waits</em></li>
                <li><b>drain</b><span>longest sequence finishes</span><em>next batch can enter</em></li>
              </ol>
              <dl><div><dt>Iterations</dt><dd>116</dd></div><div><dt>Utilization</dt><dd>61%</dd></div><div><dt>P95 wait</dt><dd>19</dd></div></dl>
            </section>
            <section>
              <header><span>Continuous</span><code>membership per iteration</code></header>
              <ol>
                <li><b>01</b><span>a · b · c decode</span><em>d waits</em></li>
                <li><b>14</b><span>a → completed; pages release</span><em>identity retained</em></li>
                <li><b>15</b><span>d enters the freed slot</span><em>next iteration</em></li>
              </ol>
              <dl><div><dt>Iterations</dt><dd>88</dd></div><div><dt>Utilization</dt><dd>86%</dd></div><div><dt>P95 wait</dt><dd>7</dd></div></dl>
            </section>
          </div>
          <div className="scheduler-inference-boundary">
            <span><b>Can infer</b> completion-aware readmission improves this fixed workload under the simulator&apos;s budgets.</span>
            <span><b>Cannot infer</b> universal production speedups without measuring overhead, fairness, prefill interference, and other arrivals.</span>
          </div>
        </div>
      ) : isStreamingTransport ? (
        <div className="transport-worked-path" role="img" aria-label="A worked streaming transport path. A UTF-8 euro character is split across two byte chunks. Streaming TextDecoder holds the first two bytes and emits the complete character after the third arrives. The practice parser receives decoded text, joins it with its text remainder, finds a blank-line frame boundary, reads event and JSON data fields, and emits a typed token event. The reducer appends that delta while render buffering remains separate from parsing.">
          <div className="transport-byte-split">
            <span><b>Byte chunk A</b><code>… 22 e2 82</code><em>incomplete UTF-8 · decoder holds e2 82</em></span>
            <span><b>Byte chunk B</b><code>ac 22 7d 0a 0a</code><em>€ completes · frame delimiter arrives</em></span>
          </div>
          <ol className="transport-stages">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="transport-frame-contract">
            <span><b>Decoded frame</b><code>{"event: token\ndata: {\"delta\":\"€\"}\n\n"}</code></span>
            <span><b>Practice boundary</b><code>parseSseChunk(textRemainder, decodedText)</code></span>
          </div>
          <div className="transport-lifecycle-boundary">
            <span><b>Cancellation</b> AbortSignal stops reader → parser → generator and rejects late events.</span>
            <span><b>Render pacing</b> batches typed deltas into fewer UI commits; it never repairs byte or frame boundaries.</span>
          </div>
        </div>
      ) : isReliabilityObservability ? (
        <div className="reliability-worked-trace" role="img" aria-label="Worked reliability trace for logical request r-201. Attempt r-201.1 times out after 120 milliseconds with zero visible tokens, so the zero-based retry predicate allows attempt r-201.2 within a total budget of two attempts. The second attempt waits 14 milliseconds, prefills for 69 milliseconds, reaches time to first token at 83 milliseconds, decodes for 338 milliseconds, completes, and releases resources. A token from retired attempt r-201.1 and a post-completion token from r-201.2 are both rejected. If the first attempt had emitted one visible token, the retry branch would be blocked.">
          <div className="reliability-request-spec">
            <span><b>Logical request</b><code>r-201</code></span>
            <span><b>Attempt budget</b><code>2 total · index 0–1</code></span>
            <span><b>Identity rule</b><code>one active attempt id</code></span>
          </div>
          <ol className="reliability-trace">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="reliability-retry-branch">
            <span><b>Observed path · retry</b><code>transient · visible 0 · 0 + 1 &lt; 2</code><em>retire r-201.1 → create r-201.2</em></span>
            <span><b>Counterfactual · stop</b><code>transient · visible 1</code><em>preserve partial output → terminal error</em></span>
          </div>
          <dl className="reliability-phase-metrics">
            <div><dt>Attempt 1 queue</dt><dd>120 ms</dd></div>
            <div><dt>Attempt 2 queue</dt><dd>14 ms</dd></div>
            <div><dt>Prefill</dt><dd>69 ms</dd></div>
            <div><dt>TTFT</dt><dd>83 ms</dd></div>
            <div><dt>Decode</dt><dd>338 ms</dd></div>
            <div><dt>End to end</dt><dd>541 ms</dd></div>
          </dl>
          <div className="reliability-guard-result">
            <span><b>Stale attempt</b><code>event r-201.1 ≠ active r-201.2 → reject</code></span>
            <span><b>Terminal attempt</b><code>r-201.2 status complete → reject</code></span>
          </div>
        </div>
      ) : (
        <div className="concept-flow">
          {lesson.diagram.nodes.map((node, index) => (
            <div key={node.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{node.label}</strong>
              <code>{node.value}</code>
            </div>
          ))}
        </div>
      )}
      <figcaption>{lesson.diagram.caption}</figcaption>
    </figure>
  );
}

export function ParagraphSection({ lesson }: { lesson: CourseLesson }) {
  return (
    <section className="paper-section summary-section" id="summary">
      <div className="section-title"><span>01</span><h2>Summary</h2></div>
      <div className={`summary-layout${lesson.id === "character-rnns" ? " recurrence-summary" : ""}`}>
        <div className="summary-copy">
          {lesson.summary.map((paragraph) => (
            <p key={paragraph.label}><strong>{paragraph.label}</strong> {paragraph.body}</p>
          ))}
        </div>
        <div className="summary-evidence">
          <DiagramSection lesson={lesson} />
          <dl className="fidelity-record">
            <div><dt>Source finding</dt><dd>{lesson.claims.paper}</dd></div>
            <div><dt>Browser reproduction</dt><dd>{lesson.claims.lab}</dd></div>
            <div><dt>Out of scope</dt><dd>{lesson.claims.limit}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export function TextBoxSection({ lesson }: { lesson: CourseLesson }) {
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [answerModel, setAnswerModel] = useState("");
  const sourceContext = lesson.sources
    .map((source) => `- "${source.title}" — ${source.authors} (${source.year}). Relevance: ${source.relevance}`)
    .join("\n");

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
          "X-Title": "Latent LLM Paper Course",
        },
        body: JSON.stringify({
          model: "openrouter/auto",
          messages: [
            { role: "system", content: `${lesson.paperContext}\n\nCurated source set:\n${sourceContext}\nSynthesize across these sources when relevant, and identify which source supports each part of the answer.` },
            ...nextChat.map((message) => ({ role: message.role, content: message.content })),
          ],
        }),
      });
      const data = await response.json() as {
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

  return (
    <section className="paper-section questions-section" id="questions">
      <div className="section-title"><span>02</span><h2>Questions</h2></div>
      <div className="questions-layout">
        <p className="questions-intro">{lesson.questions.intro}</p>
        <div className="key-panel">
          <label>
            <span>OpenRouter API key</span>
            <div className="key-input">
              <input type={showKey ? "text" : "password"} value={openRouterKey} onChange={(event) => setOpenRouterKey(event.target.value)} placeholder="sk-or-v1-…" autoComplete="off" />
              <button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide" : "Show"}</button>
            </div>
          </label>
          <div className="key-note"><i /><span>Your key stays in this tab and clears on refresh.</span></div>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">Get a key ↗</a>
        </div>
        <div className="paper-chat">
          <div className="chat-log" aria-live="polite">
            {chat.length === 0 ? (
              <div className="empty-chat">
                <span>Suggested questions</span>
                {lesson.questions.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}
              </div>
            ) : chat.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "You" : "Source guide"}</span><p>{message.content}</p>
              </div>
            ))}
          </div>
          <form className="question-form" onSubmit={askPaper}>
            <textarea aria-label="Question about the source set" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything about these sources…" />
            <button type="submit" disabled={!openRouterKey.trim() || !question.trim() || asking}>{asking ? "Thinking…" : "Ask"}</button>
          </form>
          <div className="chat-status">
            <span>{questionError || (answerModel ? `Answered by ${answerModel}` : "Grounded in the lesson sources")}</span>
            {openRouterKey ? <button type="button" onClick={() => setOpenRouterKey("")}>Clear key</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function starterCodeFor(block: CodeBlock) {
  const signature = block.code.split("\n")[0];
  return `${signature}\n  // TODO: implement ${block.label.toLowerCase()}.\n}`;
}

function projectSeedForLesson(lesson: CourseLesson, hidden: string[], currentAnswers: Record<string, string>, verified: string[]): LessonProjectSeed {
  const blocks = lesson.implementation.codeBlocks;
  const contentFor = (practice: boolean) => lessonImplementationSource(lesson, blocks
    .map((block, index) => `// ${String(index + 1).padStart(2, "0")} · ${block.label}\n${practice && hidden.includes(block.id) ? currentAnswers[block.id] ?? "" : block.code}`));
  return {
    path: `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`,
    courseId: lesson.courseId ?? "models",
    lessonId: lesson.id,
    title: lesson.title,
    content: contentFor(true),
    referenceContent: contentFor(false),
    verifiedCells: verified.length,
    totalCells: blocks.length,
  };
}

export function CodingSection({ lesson: lessonProp }: { lesson: CourseLesson }) {
  // RSC payloads can replace an equivalent prop object after learner-state events.
  // Resolve it to the module-owned definition so hydration remains single-shot.
  const lesson = courseLessons.find((candidate) => candidate.id === lessonProp.id) ?? lessonProp;
  const blocks = lesson.implementation.codeBlocks;
  const projectPath = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
  const [hiddenBlocks, setHiddenBlocks] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verifiedBlockIds, setVerifiedBlockIds] = useState<string[]>([]);
  const [verifiedSources, setVerifiedSources] = useState<Record<string, string>>({});
  const [verifiedContractVersion, setVerifiedContractVersion] = useState<string | null>(null);
  const [cellResults, setCellResults] = useState<Record<string, CheckResult | undefined>>({});
  const [practiceMessage, setPracticeMessage] = useState("The reference implementation is complete and runnable.");
  const [runningBlockIds, setRunningBlockIds] = useState<string[]>([]);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const [practiceReady, setPracticeReady] = useState(false);
  const hiddenBlocksRef = useRef<string[]>([]);
  const answersRef = useRef<Record<string, string>>({});
  const verifiedBlockIdsRef = useRef<string[]>([]);
  const verifiedSourcesRef = useRef<Record<string, string>>({});
  const verifiedContractVersionRef = useRef<string | null>(null);
  const runningBlockIdsRef = useRef<string[]>([]);
  const practiceReadyRef = useRef(false);

  useEffect(() => {
    let active = true;
    void waitForPracticeHydration(
      initializeProjectPersistence(),
      initializeLearnerPersistence(),
    ).then(() => {
      if (!active || practiceReadyRef.current) return;
      const saved = loadLearnerState().lessons[lesson.id];
      const savedHidden = saved?.hiddenBlocks.filter((id) => blocks.some((block) => block.id === id)) ?? [];
      const savedAnswers = saved?.answers ?? {};
      const restoredVerification = restoreSourceBoundVerification(
        blocks,
        savedHidden,
        savedAnswers,
        saved?.verifiedCells ?? [],
        saved?.verifiedSources ?? {},
        saved?.verifiedContractVersion,
        llmSystemsContractSuite.contractVersion,
      );
      const savedVerified = restoredVerification.ids;
      const verifiedSources = restoredVerification.sources;
      const verifiedContractVersion = restoredVerification.contractVersion;
      hiddenBlocksRef.current = savedHidden;
      answersRef.current = savedAnswers;
      verifiedBlockIdsRef.current = savedVerified;
      verifiedSourcesRef.current = verifiedSources;
      verifiedContractVersionRef.current = verifiedContractVersion;
      practiceReadyRef.current = true;
      setHiddenBlocks(savedHidden);
      setAnswers(savedAnswers);
      setVerifiedBlockIds(savedVerified);
      setVerifiedSources(verifiedSources);
      setVerifiedContractVersion(verifiedContractVersion);
      if ((saved?.verifiedCells.length ?? 0) !== savedVerified.length || (saved?.verifiedContractVersion ?? null) !== verifiedContractVersion) {
        recordVerifiedCells(lesson.id, savedVerified, verifiedSources, verifiedContractVersion);
      }
      ensureProjectWorkspace([projectSeedForLesson(lesson, savedHidden, savedAnswers, savedVerified), ...canonicalProjectSeeds()]);
      setPracticeMessage(savedHidden.length
        ? "Your device-local practice state and project file were restored."
        : "The reference implementation is complete and runnable.");
      setPracticeReady(true);
    });
    return () => { active = false; };
  }, [blocks, lesson]);

  const sourceFor = (block: CodeBlock) => practiceBlockSource(block, hiddenBlocksRef.current, answersRef.current);
  const applyPracticeState = (
    nextHidden: string[],
    nextAnswers: Record<string, string>,
    nextVerified: string[],
    nextVerifiedSources: Record<string, string>,
    nextVerifiedContractVersion: string | null,
  ) => {
    hiddenBlocksRef.current = nextHidden;
    answersRef.current = nextAnswers;
    verifiedBlockIdsRef.current = nextVerified;
    verifiedSourcesRef.current = nextVerifiedSources;
    verifiedContractVersionRef.current = nextVerifiedContractVersion;
    setHiddenBlocks(nextHidden);
    setAnswers(nextAnswers);
    setVerifiedBlockIds(nextVerified);
    setVerifiedSources(nextVerifiedSources);
    setVerifiedContractVersion(nextVerifiedContractVersion);
  };
  const setRunning = (ids: string[]) => {
    runningBlockIdsRef.current = ids;
    setRunningBlockIds(ids);
  };
  const toggleBlock = (block: CodeBlock) => {
    const currentHidden = hiddenBlocksRef.current;
    const nextHidden = currentHidden.includes(block.id) ? currentHidden.filter((id) => id !== block.id) : [...currentHidden, block.id];
    const nextAnswers = { ...answersRef.current, [block.id]: answersRef.current[block.id] ?? starterCodeFor(block) };
    const invalidated = invalidateBlockVerification({ ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current, contractVersion: verifiedContractVersionRef.current }, block.id);
    const nextVerified = invalidated.ids;
    const nextVerifiedSources = invalidated.sources;
    setCellResults((current) => ({ ...current, [block.id]: undefined }));
    applyPracticeState(nextHidden, nextAnswers, nextVerified, nextVerifiedSources, invalidated.contractVersion);
    saveLessonPractice(lesson.id, nextHidden, nextAnswers);
    recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, invalidated.contractVersion);
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, nextVerified));
    setPracticeMessage("Implementation changed. Run the affected cell again.");
  };
  const hideAll = () => {
    const nextHidden = blocks.map((block) => block.id);
    const nextAnswers = Object.fromEntries(blocks.map((block) => [block.id, starterCodeFor(block)]));
    applyPracticeState(nextHidden, nextAnswers, [], {}, null);
    saveLessonPractice(lesson.id, nextHidden, nextAnswers);
    recordVerifiedCells(lesson.id, [], {}, null);
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, []));
    setCellResults({});
    setPracticeMessage("All conceptual blocks are hidden. Reconstruct them in any valid way.");
  };
  const showSolution = () => {
    const currentAnswers = answersRef.current;
    applyPracticeState([], currentAnswers, [], {}, null);
    saveLessonPractice(lesson.id, [], currentAnswers);
    recordVerifiedCells(lesson.id, [], {}, null);
    saveLessonProjectFile(projectSeedForLesson(lesson, [], currentAnswers, []));
    setCellResults({});
    setPracticeMessage("Reference solution restored. Previous attempts remain available if you hide a cell again.");
  };
  const runCell = async (block: CodeBlock) => {
    if (!practiceReadyRef.current || runningBlockIdsRef.current.length) return;
    const sourceSnapshot = sourceFor(block);
    const hiddenSnapshot = [...hiddenBlocksRef.current];
    const answersSnapshot = { ...answersRef.current };
    setRunning([block.id]);
    setPracticeMessage(`Compiling ${block.label} in the isolated browser lab…`);
    try {
      const [result] = await runPracticeContracts({
        path: projectPath,
        source: lessonImplementationSource(lesson, [sourceSnapshot]),
        contractIds: [`${lesson.id}/${block.id}`],
      });
      const check = result ?? { label: block.label, passed: false, detail: "The isolated test returned no result." };
      if (sourceFor(block) !== sourceSnapshot) {
        setCellResults((current) => ({ ...current, [block.id]: undefined }));
        setPracticeMessage(`${block.label} changed while its check was running. Run the current source again.`);
        return;
      }
      const currentVerification = { ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current, contractVersion: verifiedContractVersionRef.current };
      const nextVerification = check.passed
        ? bindBlockVerification(currentVerification, block.id, sourceSnapshot, llmSystemsContractSuite.contractVersion)
        : invalidateBlockVerification(currentVerification, block.id);
      const nextVerified = nextVerification.ids;
      const nextVerifiedSources = nextVerification.sources;
      applyPracticeState(hiddenSnapshot, answersSnapshot, nextVerified, nextVerifiedSources, nextVerification.contractVersion);
      recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, nextVerification.contractVersion);
      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenSnapshot, answersSnapshot, nextVerified));
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(check.passed ? `${block.label} passed host-owned assertions.` : `${block.label} needs attention. Review the failed behavior below; your other cells were not changed.`);
    } catch (error) {
      const check = { label: block.label, passed: false, detail: error instanceof Error ? error.message : "The isolated test failed." };
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(`${block.label} stopped safely.`);
    } finally {
      setRunning([]);
    }
  };
  const runAll = async () => {
    if (!practiceReadyRef.current || runningBlockIdsRef.current.length) return;
    const hiddenSnapshot = [...hiddenBlocksRef.current];
    const answersSnapshot = { ...answersRef.current };
    const sourceSnapshots = Object.fromEntries(blocks.map((block) => [block.id, sourceFor(block)]));
    setRunning(blocks.map((block) => block.id));
    setPracticeMessage("Compiling this lesson and running every contract in an isolated worker…");
    try {
      const combinedSource = lessonImplementationSource(lesson, blocks.map((block) => sourceSnapshots[block.id]));
      const results = await runPracticeContracts({
        path: projectPath,
        source: combinedSource,
        contractIds: blocks.map((block) => `${lesson.id}/${block.id}`),
      });
      const resultById = new Map(results.map((result) => [result.id, result]));
      const ordered = blocks.map((block) => resultById.get(`${lesson.id}/${block.id}`) ?? { id: `${lesson.id}/${block.id}`, path: projectPath, label: block.label, passed: false, detail: "The isolated test returned no result." });
      if (blocks.some((block) => sourceFor(block) !== sourceSnapshots[block.id])) {
        setCellResults({});
        setPracticeMessage("The lesson source changed while checks were running. Run the current source again.");
        return;
      }
      const nextVerified = blocks.filter((_, index) => ordered[index].passed).map((block) => block.id);
      const nextVerifiedSources = Object.fromEntries(nextVerified.map((id) => [id, sourceSnapshots[id]]));
      const nextVerifiedContractVersion = nextVerified.length ? llmSystemsContractSuite.contractVersion : null;
      applyPracticeState(hiddenSnapshot, answersSnapshot, nextVerified, nextVerifiedSources, nextVerifiedContractVersion);
      recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, nextVerifiedContractVersion);
      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenSnapshot, answersSnapshot, nextVerified));
      setCellResults(Object.fromEntries(blocks.map((block, index) => [block.id, ordered[index]])));
      const passed = ordered.filter((result) => result.passed).length;
      if (passed === ordered.length) {
        try {
          const artifact = await recordValidatedLessonArtifact({
            lessonId: lesson.id,
            source: combinedSource,
            results: ordered.map((result, index) => ({
              id: result.id ?? `${lesson.id}/${blocks[index].id}`,
              label: result.label,
              passed: result.passed,
              detail: result.detail,
            })),
          });
          setArtifactRevision((revision) => revision + 1);
          setPracticeMessage(`All isolated behavioral checks pass. Artifact ${artifact.contentHash.slice(7, 19)} is ready for the next lesson.`);
        } catch (artifactError) {
          setPracticeMessage(`All isolated behavioral checks pass, but the artifact could not be stored: ${artifactError instanceof Error ? artifactError.message : "local storage is unavailable"}`);
        }
      } else {
        setPracticeMessage(`${passed} of ${ordered.length} isolated behavioral checks pass.`);
      }
    } catch (error) {
      setPracticeMessage(error instanceof Error ? error.message : "The isolated lesson test failed safely.");
    } finally {
      setRunning([]);
    }
  };
  const verifiedCells = verifiedBlockIds.length;

  return (
    <section className="paper-section implementation-section" id="implementation">
      <div className="section-title"><span>03</span><h2>Implementation</h2></div>
      <p className="implementation-intro">{lesson.implementation.intro}</p>
      {lesson.implementation.tensorOps?.length ? (
        <div className="tensor-runtime-strip">
          <div><span>Tensor runtime</span><strong>runtime/latent-tensor.js</strong><p>Shape checks and automatic differentiation are provided; you implement the model operation.</p></div>
          <div aria-label="Latent Tensor operations used in this lesson">
            {latentTensorOperations(lesson.implementation.tensorOps).map((operation) => <span title={operation.purpose} key={operation.name}>{operation.name}</span>)}
          </div>
        </div>
      ) : null}
      <div className="practice-editor" aria-busy={!practiceReady}>
        <div className="editor-toolbar">
          <div className="editor-file"><span>{projectPath}</span><strong>{!practiceReady ? "Restoring saved work…" : hiddenBlocks.length === 0 ? "Reference · saved" : `${hiddenBlocks.length} cells in practice`}</strong></div>
          <div className="editor-progress" aria-label={`${verifiedCells} of ${blocks.length} cells verified`}>
            <span>{verifiedCells}/{blocks.length} verified</span><i><b style={{ width: `${verifiedCells / blocks.length * 100}%` }} /></i>
          </div>
          <div className="toolbar-actions"><button type="button" onClick={hideAll} disabled={!practiceReady || runningBlockIds.length > 0}>Practice all</button><button type="button" onClick={showSolution} disabled={!practiceReady || hiddenBlocks.length === 0 || runningBlockIds.length > 0}>Restore all</button><Link href={`/workspace?file=${encodeURIComponent(`${lesson.courseId ?? "models"}/${lesson.implementation.filename}`)}`}>Open in IDE ↗</Link></div>
        </div>
        <div className="code-surface">
          {lesson.implementation.tensorOps?.length ? (
            <div className="tensor-import-line"><span>dependency</span><code>{lessonImplementationPrelude(lesson)}</code><em>read only</em></div>
          ) : null}
          {blocks.map((block, blockIndex) => {
            const hidden = hiddenBlocks.includes(block.id);
            const startLine = blocks.slice(0, blockIndex).reduce((line, previous) => line + previous.code.split("\n").length + 1, lesson.implementation.tensorOps?.length ? 3 : 1);
            const result = cellResults[block.id];
            return (
              <div
                className={`practice-block ${hidden ? "is-hidden" : ""}`}
                data-reference-code={encodeURIComponent(block.code)}
                key={block.id}
              >
                <div className="block-heading">
                  <div><span>0{blockIndex + 1}</span><strong>{block.label}</strong><em>{block.purpose}</em></div>
                  <div className="block-actions">
                    <button className="run-cell-button" type="button" onClick={() => void runCell(block)} disabled={!practiceReady || runningBlockIds.length > 0}>{runningBlockIds.includes(block.id) ? "Running…" : "Run cell"}</button>
                    <button type="button" onClick={() => toggleBlock(block)} disabled={!practiceReady || runningBlockIds.length > 0}>{hidden ? "Show reference" : "Practice cell"}</button>
                  </div>
                </div>
                {block.concepts?.length ? <div className="concept-strip" aria-label={`${block.label} variables`}>{block.concepts.map((concept) => <span key={concept.name}><code>{concept.name}</code><em>{concept.detail}</em></span>)}</div> : null}
                {hidden ? (
                  <div className="answer-area">
                    <div className="practice-guidance">
                      <div><span>Practice mode</span><strong>Complete, then run.</strong></div>
                      <button type="button" disabled={!practiceReady || runningBlockIds.length > 0} onClick={() => {
                        const currentHidden = [...hiddenBlocksRef.current];
                        const nextAnswers = { ...answersRef.current, [block.id]: starterCodeFor(block) };
                        const invalidated = invalidateBlockVerification({ ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current, contractVersion: verifiedContractVersionRef.current }, block.id);
                        const nextVerified = invalidated.ids;
                        const nextVerifiedSources = invalidated.sources;
                        applyPracticeState(currentHidden, nextAnswers, nextVerified, nextVerifiedSources, invalidated.contractVersion);
                        saveLessonPractice(lesson.id, currentHidden, nextAnswers);
                        recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, invalidated.contractVersion);
                        saveLessonProjectFile(projectSeedForLesson(lesson, currentHidden, nextAnswers, nextVerified));
                        setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      }}>Reset starter</button>
                    </div>
                    <textarea aria-label={`Reimplement ${block.label}`} value={answers[block.id] ?? ""} disabled={!practiceReady || runningBlockIds.length > 0} onChange={(event) => {
                      const currentHidden = [...hiddenBlocksRef.current];
                      const nextAnswers = { ...answersRef.current, [block.id]: event.target.value };
                      const invalidated = invalidateBlockVerification({ ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current, contractVersion: verifiedContractVersionRef.current }, block.id);
                      const nextVerified = invalidated.ids;
                      const nextVerifiedSources = invalidated.sources;
                      applyPracticeState(currentHidden, nextAnswers, nextVerified, nextVerifiedSources, invalidated.contractVersion);
                      saveLessonPractice(lesson.id, currentHidden, nextAnswers);
                      recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, invalidated.contractVersion);
                      saveLessonProjectFile(projectSeedForLesson(lesson, currentHidden, nextAnswers, nextVerified));
                      setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      setPracticeMessage("Implementation changed. Run the affected cell again.");
                    }} spellCheck="false" />
                  </div>
                ) : (
                  <div className="code-lines">{block.code.split("\n").map((line, lineIndex) => <div key={`${block.id}-${lineIndex}`}><span>{startLine + lineIndex}</span><code>{line || " "}</code></div>)}</div>
                )}
                <div className="cell-footer">
                  {result ? <span className={result.passed ? "cell-result passed" : "cell-result failed"}><i>{result.passed ? "✓" : "×"}</i>{result.detail}</span> : verifiedContractVersion === llmSystemsContractSuite.contractVersion && verifiedBlockIds.includes(block.id) && verifiedSources[block.id] === (hidden ? answers[block.id] ?? "" : block.code) ? <span className="cell-result passed"><i>✓</i>Verified previously on this device</span> : <span>{practiceReady ? "Not run" : "Waiting for saved progress"}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="editor-footer"><p>{practiceReady ? practiceMessage : "Restoring your saved practice before editing is enabled…"}</p><button type="button" onClick={() => void runAll()} disabled={!practiceReady || runningBlockIds.length > 0}>{runningBlockIds.length ? "Running in sandbox…" : "Run behavioral checks"}</button></div>
      </div>
      <LessonExperiment lesson={lesson} />
      <ArtifactRuntimePanel lesson={lesson} refreshKey={artifactRevision} />
    </section>
  );
}

export function PaperLab({ lesson }: { lesson: CourseLesson }) {
  const learnerState = useLearnerState();
  const trackLessons = courseLessons.filter((candidate) => candidate.courseId === lesson.courseId);
  const trackIndex = trackLessons.findIndex((candidate) => candidate.id === lesson.id);
  const previous = trackLessons[trackIndex - 1];
  const next = trackLessons[trackIndex + 1];
  const courseHref = `/courses/${lesson.courseId ?? "models"}`;
  const progress = learnerState.lessons[lesson.id];
  const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length);
  return (
    <main>
      <Atmosphere />
      <header className="site-header lesson-header">
        <Link className="wordmark" href="/" aria-label="Latent course home"><i />latent</Link>
        <nav aria-label="Lesson navigation"><a href="#summary">Summary</a><a href="#questions">Questions</a><a href="#implementation">Implementation</a><a href="#artifacts">Artifacts</a></nav>
        <span>{lesson.courseTitle ?? "Model Foundations"} · {String(trackIndex + 1).padStart(2, "0")} / {String(trackLessons.length).padStart(2, "0")}</span>
      </header>
      <article className="paper-page" id="top">
        <HeaderSection lesson={lesson} />
        <ParagraphSection lesson={lesson} />
        <TextBoxSection lesson={lesson} />
        <CodingSection lesson={lesson} />
        <footer className="paper-footer lesson-footer">
          {previous ? <Link href={`/lessons/${previous.id}`}>← {previous.title}</Link> : <Link href={courseHref}>← Module</Link>}
          <p>{complete ? `Lesson ${trackIndex + 1} complete` : `${progress?.verifiedCells.length ?? 0}/${lesson.implementation.codeBlocks.length} checks · ${progress?.experimentComplete ? "experiment complete" : "experiment pending"}`}</p>
          {next ? <Link href={`/lessons/${next.id}`}>{next.title} →</Link> : <Link href={courseHref}>Module ↑</Link>}
        </footer>
      </article>
    </main>
  );
}
