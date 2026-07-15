"use client";

import type { FormEvent } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CodeBlock, CourseLesson } from "@latent/course-kit";
import { courseLessons } from "../lessons/course";
import { LessonExperiment } from "./LessonExperiment";
import {
  discardLearnerRecoveryCandidate,
  lessonIsComplete,
  initializeLearnerPersistence,
  loadLearnerRecoveryCandidate,
  loadLearnerState,
  recordVerifiedCells,
  saveLessonPracticeAndVerification,
  useLearnerState,
  useLearnerPersistenceError,
  useLearnerRecoveryCandidates,
} from "../lib/learner-state";
import { ensureProjectWorkspace, initializeProjectPersistence, saveLessonProjectFile, useProjectPersistenceError, type LessonProjectSeed } from "../lib/project-workspace";
import { runPracticeContracts } from "../features/ide/browser-lab-service";
import { runPythonLessonContracts } from "../features/ide/python-lesson-service";
import { ArtifactRuntimePanel } from "../features/artifacts/ArtifactRuntimePanel";
import { recordValidatedLessonArtifact } from "../features/artifacts/lesson-artifacts";
import { latentTensorOperations } from "@latent/tensor";
import { lessonBlockComment, lessonImplementationPrelude, lessonImplementationSource } from "../lessons/implementation-source";
import { canonicalProjectSeeds } from "../lib/canonical-project";
import {
  compatiblePracticeDrafts,
  creditablePracticeBlockIds,
  editPracticeBlock,
  practiceDraftIsCompatible,
  practiceBlockSource,
  resetPracticeBlock,
  restoreReferenceBlock,
  restoreSourceBoundVerification,
  verificationAfterBlockRun,
  waitForPracticeHydration,
} from "../features/ide/practice-state";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { LessonOutcome } from "./LessonOutcome";
import { lessonLearningOutcome, moduleCheckpoint } from "../content/llm-systems/learning";
import { recordLearningEvent } from "../lib/learning-analytics";
import { SyntaxCode } from "../features/ide/SyntaxCode";
import styles from "./PaperLab.module.css";

type ChatMessage = { role: "user" | "assistant"; content: string };
type CheckResult = { label: string; passed: boolean; detail: string };

const LessonCodeEditor = lazy(async () => ({
  default: (await import("../features/ide/CodeEditor")).CodeEditor,
}));

const PyTorchHandoff = lazy(async () => ({
  default: (await import("../features/pytorch/PyTorchHandoff")).PyTorchHandoff,
}));

const PYTORCH_HANDOFF_LESSONS = new Set([
  "character-rnns",
  "neural-language-models",
  "additive-attention",
  "transformers",
  "inference-runtime",
]);

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

function SourceSet({ lesson }: { lesson: CourseLesson }) {
  // Start collapsed so the server-rendered mobile page never paints a large
  // references rail before the responsive preference is known.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 650px), (max-width: 940px) and (max-height: 500px)");
    const syncForViewport = () => setOpen(!mobile.matches);
    syncForViewport();
    mobile.addEventListener("change", syncForViewport);
    return () => mobile.removeEventListener("change", syncForViewport);
  }, []);

  return (
    <details className="source-set" open={open} onToggle={(event) => setOpen(event.currentTarget.open)} aria-labelledby="lesson-sources-title">
      <summary className="source-set-title"><span id="lesson-sources-title">References</span><em>{lesson.sources.length}</em></summary>
      <ul className="source-list">
        {lesson.sources.map((source) => (
          <li className="source-entry" key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.title} — ${source.authors}, ${source.year}. ${source.relevance}`}>
              <span className="source-citation">
                <strong>{source.title}</strong>
                <span aria-hidden="true">↗</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </details>
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
      <SourceSet lesson={lesson} />
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
  const isConversationState = lesson.id === "conversation-state";
  const isStreamingReact = lesson.id === "streaming-react";
  const isChatActionsContext = lesson.id === "chat-actions-context";
  const isChatProductQuality = lesson.id === "chat-product-quality";
  const recurrentSteps = [
    { time: "t − 1", input: "x_(t−1)", previous: "h_(t−2)", state: "h_(t−1)", prediction: "p(x_t)" },
    { time: "t", input: "x_t", previous: "h_(t−1)", state: "h_t", prediction: "p(x_(t+1))" },
    { time: "t + 1", input: "x_(t+1)", previous: "h_t", state: "h_(t+1)", prediction: "p(x_(t+2))" },
  ];
  return (
    <figure className={`concept-diagram${isRecurrent ? " recurrence-diagram" : ""}${isNeuralLanguageModel ? " neural-lm-diagram" : ""}${isSubwordTokenization ? " subword-tokenization-diagram" : ""}${isAdditiveAttention ? " additive-attention-diagram" : ""}${isTransformer ? " transformer-attention-diagram" : ""}${isInContextLearning ? " icl-comparison-diagram" : ""}${isInferenceRuntime ? " inference-runtime-diagram" : ""}${isSchedulingMemory ? " scheduling-memory-diagram" : ""}${isStreamingTransport ? " streaming-transport-diagram" : ""}${isReliabilityObservability ? " reliability-observability-diagram" : ""}${isConversationState ? " conversation-state-diagram" : ""}${isStreamingReact ? " streaming-react-diagram" : ""}${isChatActionsContext ? " chat-actions-context-diagram" : ""}${isChatProductQuality ? " chat-product-quality-diagram" : ""}`}>
      <header><span>How it works</span><strong>{lesson.diagram.title}</strong></header>
      {isRecurrent ? (
        <div className="recurrence-unroll" role="group" aria-label="Three RNN steps use the same parameters. In teacher-forced training, the real next character is both the loss target and the next input. During generation, the model samples a character and feeds it into the next step.">
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
            <span><b>Memory flow</b> h_(t−1) → h_t → h_(t+1)</span>
            <span><b>Teacher-forced training</b> real x_(t+1) → loss target + next input</span>
            <span><b>Generation</b> sample from p(x_(t+1)) → use it as the next input</span>
            <span><b>Same at every position</b> Wxh · Whh · Why · biases</span>
          </div>
        </div>
      ) : isNeuralLanguageModel ? (
        <div className="neural-probability-path" role="group" aria-label="A two-word context becomes token ids, embedding rows, an average context vector, vocabulary logits, softmax probabilities, and negative log-likelihood for the target word. Unlike exact counts, learned vectors can reuse what they learn across related contexts.">
          <div className="generalization-contrast">
            <span><b>Exact count</b><code>“the researcher” unseen → no direct trigram estimate</code></span>
            <span><b>Learned vectors</b><code>similar predictive use → nearby embeddings</code></span>
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
        <div className="bpe-worked-example" role="group" aria-label="The tokenizer counts a tiny dataset, merges the most common l-o pair everywhere, and counts again. The second example shows that changing the learned merge order changes how a-b-c is split.">
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
        <div className="attention-worked-example" role="group" aria-label="At the year decoder step, additive attention compares one query with the day, month, and year encoder states. Softmax gives year a 0.951 weight, and the weighted sum makes the year context vector.">
          <ol className="attention-stages">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="attention-score-contrast">
            <span><b>Additive</b><code>vᵀ tanh(Wq q + Wk h_i + b)</code><em>learned projections + nonlinear score</em></span>
            <span><b>Dot product</b><code>qᵀ h_i</code><em>direct similarity; not the method used here</em></span>
          </div>
        </div>
      ) : isTransformer ? (
        <div className="transformer-worked-example" role="group" aria-label="A three-token causal attention example. The input projections make Q, K, and V. The model scales the query-key scores, masks everything above the diagonal, and runs softmax on each row. The decoded row gets probabilities 0.20, 0.33, and 0.46. Multiplying by the value rows makes one context vector for each token.">
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
            <p><span>Before softmax</span> every cell above the diagonal is −Infinity. <span>In this small example</span> the values use unit basis rows, so each probability row, rounded to two decimals, is also its context vector and gives the norm shown here.</p>
          </div>
          <div className="transformer-block-boundary">
            <b>The full decoder block</b>
            <code>attention output → projection → residual + norm → MLP → residual + norm</code>
          </div>
        </div>
      ) : isInContextLearning ? (
        <div className="icl-comparison" role="group" aria-label="A fixed local evaluator, separate from your code, runs an in-context learning comparison. The instruction, two test questions, frozen model weights, decoding, and exact-match score stay the same. Only the prompt changes from zero to one to four examples. Two predictions can show that the prompt matters, but they can’t prove that few-shot prompting works better in general.">
          <div className="icl-fixed-prefix">
            <span><b>Fixed instruction</b><code>infer mapping · return K or M</code></span>
            <span><b>Same test questions</b><code>moving story · tedious story</code></span>
          </div>
          <div className="icl-condition-paths" aria-label="Three prompt conditions">
            <span><b>Zero-shot</b><code>instruction → query</code><em>0 demonstrations</em></span>
            <span><b>One-shot</b><code>instruction → 1 example → query</code><em>1 demonstration</em></span>
            <span><b>Few-shot</b><code>instruction → 4 examples → query</code><em>4 demonstrations</em></span>
          </div>
          <div className="icl-frozen-model"><b>Frozen 135M model</b><code>prompt tokens change activations + KV cache</code><em>weights updated: 0</em></div>
          <table className="icl-measurement-table" aria-label="Exact-match measurement plan for two held-out items">
            <thead><tr><th scope="col">Condition</th><th scope="col">Moving / K</th><th scope="col">Tedious / M</th><th scope="col">Exact match</th></tr></thead>
            <tbody>
              <tr><th scope="row">0 examples</th><td>prediction / K</td><td>prediction / M</td><td>? / 2</td></tr>
              <tr><th scope="row">1 example</th><td>prediction / K</td><td>prediction / M</td><td>? / 2</td></tr>
              <tr><th scope="row">4 examples</th><td>prediction / K</td><td>prediction / M</td><td>? / 2</td></tr>
            </tbody>
          </table>
          <div className="icl-inference-boundary">
            <span><b>What runs here</b> The fixed local evaluator builds the prompts, runs the model, pulls out the labels, and fills in this table. Your code is checked separately and never runs here.</span>
            <span><b>What this shows</b> whether the examples changed either answer in this run.</span>
            <span><b>What it doesn’t show</b> a general accuracy boost or the paper&apos;s large-scale result from only two items.</span>
          </div>
        </div>
      ) : isInferenceRuntime ? (
        <div className="runtime-worked-example" role="group" aria-label="Inference timeline for request r-104. It waits 18 milliseconds, prefills a 96-token prompt in 74 milliseconds with 6 KV pages, samples the first of 32 output tokens at a 92 millisecond TTFT, runs 31 more one-position decode passes while the cache grows to 8 pages, then releases every page. The KV-cache byte formula counts keys and values across every layer, KV head, cached token, head coordinate, and byte per value.">
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
            <span><b>TTFT</b><code>queue + prefill = 18 + 74 = 92 ms</code><em>request accepted → first visible token</em></span>
            <span><b>ITL</b><code>gap between visible tokens</code><em>how quickly one request keeps decoding</em></span>
            <span><b>tokens/s</b><code>21.4 generated / second</code><em>steady decode rate</em></span>
          </div>
          <div className="runtime-cache-formula">
            <b>Per-request KV-cache bytes</b>
            <code>2 × layers × KV heads × cached tokens × head dimension × bytes / value</code>
            <em>2 means one key tensor + one value tensor. Under GQA, KV heads may be fewer than query heads.</em>
          </div>
        </div>
      ) : isSchedulingMemory ? (
        <div className="scheduler-worked-comparison" role="group" aria-label="A scheduling comparison with the same arrivals and resource limits. Requests a, b, and c start active while d waits, using 11 KV pages. With static batching, a finished slot stays idle and d waits for the longest request. That takes 116 iterations, uses 61 percent of capacity, and has a p95 wait of 19 steps. With continuous batching, finished requests release their pages and d joins the next iteration. That takes 88 iterations, uses 86 percent of capacity, and has a p95 wait of 7 steps. These fixed results cover one synthetic workload, not every production system.">
          <div className="scheduler-shared-workload">
            <span><b>Same starting point</b><code>a · b · c active</code></span>
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
            <span><b>What this shows</b> refilling finished slots helps this fixed workload under the simulator&apos;s limits.</span>
            <span><b>What it doesn’t show</b> a speedup for every production system. You’d still need to measure overhead, fairness, prefill interference, and other traffic.</span>
          </div>
        </div>
      ) : isStreamingTransport ? (
        <div className="transport-worked-path" role="group" aria-label="A streaming transport example. A UTF-8 euro character is split across two byte chunks. The streaming TextDecoder holds the first two bytes and returns the whole character when the third byte arrives. The practice parser joins the decoded text with any leftover text, finds the blank-line frame boundary, reads the event and JSON data, and sends out a typed token event. The reducer adds that delta, while render buffering stays separate from parsing.">
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
            <span><b>Practice function</b><code>parseSseChunk(textRemainder, decodedText)</code></span>
          </div>
          <div className="transport-lifecycle-boundary">
            <span><b>Cancel</b> AbortSignal stops reader → parser → generator and ignores late events.</span>
            <span><b>Render pacing</b> groups typed deltas into fewer UI updates; it never fixes broken byte or frame boundaries.</span>
          </div>
        </div>
      ) : isReliabilityObservability ? (
        <div className="reliability-worked-trace" role="group" aria-label="Reliability trace for logical request r-201. Attempt r-201.1 times out after 120 milliseconds before showing any tokens, so the retry rule allows r-201.2 within the two-attempt limit. The second attempt waits 14 milliseconds, prefills for 69 milliseconds, shows its first token at 83 milliseconds, decodes for 338 milliseconds, finishes, and releases its resources. The app ignores a token from the old attempt and another token that arrives after completion. If the first attempt had already shown a token, the app would not retry automatically.">
          <div className="reliability-request-spec">
            <span><b>Logical request</b><code>r-201</code></span>
            <span><b>Attempt budget</b><code>2 total · index 0–1</code></span>
            <span><b>ID rule</b><code>one active attempt id</code></span>
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
            <span><b>What happened · retry</b><code>transient · visible 0 · 0 + 1 &lt; 2</code><em>retire r-201.1 → create r-201.2</em></span>
            <span><b>If a token were visible · stop</b><code>transient · visible 1</code><em>keep the partial output → final error</em></span>
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
      ) : isConversationState ? (
        <div className="conversation-state-worked" role="group" aria-label="A normalized conversation update. Conversation c-17 keeps the ordered ids m-u1 and m-a1. messagesById holds a finished user message and a streaming assistant message. Assistant message m-a1 belongs to generation attempt a-17.2 and transport request r-17.2. A token delta for both m-a1 and r-17.2 returns a new state and a new m-a1 record while keeping the same m-u1 record. Because the response is streaming, canStop is true and canRegenerate is false.">
          <div className="conversation-normalized-records">
            <span><b>conversation · c-17</b><code>{'messageIds: ["m-u1", "m-a1"]'}</code></span>
            <span><b>messagesById · m-u1</b><code>{'user · complete · "Explain masking."'}</code></span>
            <span><b>messagesById · m-a1</b><code>{'assistant · streaming · "A causal"'}</code></span>
          </div>
          <div className="conversation-identity-chain" aria-label="Separate message, attempt, and request identities">
            <span><b>Message</b><code>m-a1</code><em>stable UI record</em></span>
            <i aria-hidden="true">→</i>
            <span><b>Attempt</b><code>a-17.2</code><em>one generation try</em></span>
            <i aria-hidden="true">→</i>
            <span><b>Request</b><code>r-17.2</code><em>one transport run</em></span>
          </div>
          <div className="conversation-delta-action">
            <span><b>Action</b><code>{'{ type: "TOKEN_DELTA", messageId: "m-a1", requestId: "r-17.2", delta: " mask" }'}</code></span>
            <span><b>Guard</b><code>request active ∧ message streaming → apply</code></span>
          </div>
          <div className="conversation-transition-result">
            <span><b>New objects</b><code>next !== state · next.m-a1 !== state.m-a1</code></span>
            <span><b>Same object</b><code>next.m-u1 === state.m-u1</code></span>
            <span><b>Available controls</b><code>canStop: true · canRegenerate: false</code></span>
          </div>
        </div>
      ) : isStreamingReact ? (
        <div className="streaming-react-worked" role="group" aria-label="A React render timing trace. Parsed token events containing A, a leading-space causal, and a leading-space euro symbol arrive at 2, 7, and 11 milliseconds. They enter the UI render queue in the same order. At the 16 millisecond requestAnimationFrame point, the queue flushes once and sends one TOKEN_BATCH action containing A causal euro, which causes one visual update. A separate near-bottom check decides whether to follow the scroll, while a short live-region message announces the batch. Completion flushes pending text before the final state. Canceling drops pending text, ignores late deltas, and cancels the scheduled frame.">
          <div className="streaming-event-arrivals">
            <span><b>t = 2 ms</b><code>token · &quot;A&quot;</code></span>
            <span><b>t = 7 ms</b><code>token · &quot; causal&quot;</code></span>
            <span><b>t = 11 ms</b><code>token · &quot; €&quot;</code></span>
          </div>
          <ol className="streaming-render-path">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="streaming-commit-evidence">
            <span><b>Queue before frame</b><code>[&quot;A&quot;, &quot; causal&quot;, &quot; €&quot;]</code></span>
            <span><b>One reducer action</b><code>{'{ type: "TOKEN_BATCH", delta: "A causal €" }'}</code></span>
            <span><b>Visible result</b><code>A causal €</code></span>
          </div>
          <div className="streaming-independent-policies">
            <span><b>Scroll-follow check</b><code>24 px ≤ 80 px ∧ userScrolledUp false → follow</code><em>checked separately after the visual update</em></span>
            <span><b>Live region</b><code>“Assistant: A causal €”</code><em>one short, meaningful announcement instead of three token announcements</em></span>
          </div>
          <div className="streaming-terminal-policies">
            <span><b>Complete</b> flush pending text → dispatch final batch → announce completion.</span>
            <span><b>Cancel</b> drop pending text → cancel scheduled frame → reject late deltas.</span>
          </div>
        </div>
      ) : isChatActionsContext ? (
        <div className="chat-actions-worked" role="group" aria-label="A conversation branch. System record s1 and user message m-u3 make up the active prefix. Stopping request r-31 keeps assistant message m-a3, its partial text Set future logits, and a canceled status. Retrying from the same m-u3 prefix creates assistant m-a4, attempt a-32, and request r-32. Editing m-u3 creates user revision m-u3-e1, keeps the old m-a3 message but leaves it off the edited branch, and creates assistant m-a5, attempt a-33, and request r-33. The request builder always includes system s1 and the active user prompt. It then checks complete user-assistant pairs from newest to oldest, skips a newer pair that is too large, includes an older small pair, and returns everything in time order within a 26-token budget.">
          <div className="chat-active-prefix">
            <span><b>Required system</b><code>s1 · 6 tokens</code></span>
            <i aria-hidden="true">→</i>
            <span><b>Active user</b><code>m-u3 · “Give one implementation detail.”</code></span>
          </div>
          <div className="chat-action-branches">
            <span><b>Stop</b><code>m-a3 · a-31 · r-31</code><em>cancelled · partial “Set future logits” retained</em></span>
            <span><b>Retry / regenerate</b><code>m-a4 · a-32 · r-32</code><em>same parent m-u3 · new queued attempt</em></span>
            <span><b>Edit prompt</b><code>m-u3-e1 → m-a5 · a-33 · r-33</code><em>m-a3 retained but invalid on edited branch</em></span>
          </div>
          <div className="chat-context-assembly">
            <header><span>Request assembly · budget 26</span><code>21 / 26 used</code></header>
            <ol>
              <li className="required"><b>Required</b><span>s1 + active m-u3</span><code>6 + 6 = 12</code></li>
              <li className="excluded"><b>Newest pair</b><span>m-u2 + m-a2</span><code>20 tokens · skip</code></li>
              <li className="included"><b>Older pair</b><span>m-u1 + m-a1</span><code>9 tokens · include</code></li>
            </ol>
            <p><b>Final request, in time order</b><code>s1 → m-u1 → m-a1 → m-u3</code><span>21 / 26 tokens · no half-finished turn</span></p>
          </div>
          <div className="chat-context-overflow">
            <b>The required prompt is too large</b>
            <span>The system instructions stay selected, and <code>overflow: true</code> blocks the request instead of pretending it fits.</span>
          </div>
        </div>
      ) : isChatProductQuality ? (
        <div className="quality-product-trace" role="group" aria-label="One full chat-product trace. Enter sends a request through queued, loading, prefill, streaming, and complete phases. The visible and programmatic status always show the same phase. The UI groups streaming text into fewer visual updates and announces short, meaningful batches. Canceling or retrying ignores late events, releases transport and render resources, and returns focus to the message box. Reload checks an exact version 1 record containing only size-limited final messages. Eleven automated checks cover predictable code behavior. Five requirements remain written specs, while keyboard, screen-reader, and mobile behavior still need hands-on testing.">
          <ol className="quality-lifecycle-trace">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="quality-state-pair">
            <span><b>Visual state</b><code>Waiting for capacity → Loading model → Processing context → Generating → Complete</code></span>
            <span><b>Programmatic state</b><code>status / polite / atomic · log / polite · batched additions</code></span>
          </div>
          <div className="quality-recovery-record">
            <span><b>Cancel or retry</b><code>abort transport · cancel frame · reject late event · release request · focus composer</code></span>
            <span><b>Safe reload</b><code>v1 · exact keys · ≤200 terminal messages · known role/backend/status · no secrets</code></span>
          </div>
          <div className="quality-verification-boundary">
            <span><b>Automated · 11 checks</b> mappings, guards, limits, serialization, lifecycle labels, and context selection.</span>
            <span><b>Written specs · 5</b> focus recovery, cancellation resources, live-region metadata, and responsive requirements aren’t run here.</span>
            <span><b>Hands-on · 3 groups</b> real focus order, screen-reader speech, and keyboard and touch behavior at 320/390 px.</span>
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
  const diagramAfter = Math.max(1, lesson.summary.length - 1);
  const opening = lesson.summary.slice(0, diagramAfter);
  const closing = lesson.summary.slice(diagramAfter);
  return (
    <section className="paper-section summary-section" id="summary">
      <div className="section-title"><span>01</span><h2>Summary</h2></div>
      <div className="summary-reading">
        <div className="summary-copy">
          {opening.map((paragraph) => (
            <p key={paragraph.label}><strong>{paragraph.label}</strong> {paragraph.body}</p>
          ))}
        </div>
        <div className="summary-interlude">
          <DiagramSection lesson={lesson} />
        </div>
        {closing.length ? <div className="summary-copy">
          {closing.map((paragraph) => (
            <p key={paragraph.label}><strong>{paragraph.label}</strong> {paragraph.body}</p>
          ))}
        </div> : null}
        <dl className="fidelity-record summary-boundary">
          <div><dt>What the source says</dt><dd>{lesson.claims.paper}</dd></div>
          <div><dt>What this browser lab shows</dt><dd>{lesson.claims.lab}</dd></div>
          <div><dt>What it doesn’t cover</dt><dd>{lesson.claims.limit}</dd></div>
        </dl>
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
            { role: "system", content: `${lesson.paperContext}\n\nDetails about the linked sources (the full papers weren't downloaded):\n${sourceContext}\nAnswer from the lesson notes above. Use this list only to help the student find more reading. Don't claim a source says something unless the lesson notes clearly support it. If the notes don't give you enough information, say that and point the student to the original link instead of guessing.` },
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
      if (!answer) throw new Error("The model didn’t return an answer.");
      setChat((current) => [...current, { role: "assistant", content: answer }]);
      setAnswerModel(data.model ?? "openrouter/auto");
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "We couldn’t get an answer to that question.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="paper-section questions-section" id="questions">
      <div className="section-title"><span>02</span><h2>Questions</h2></div>
      <details className="questions-disclosure">
        <summary>
          <span><small>Optional helper</small><strong>Ask about this lesson</strong></span>
          <em>You’ll need an OpenRouter key</em>
        </summary>
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
            <div className="key-note"><i /><span>Latent doesn’t save this key. Your browser sends it straight to OpenRouter with each question, so OpenRouter’s policies and any charges on your account apply. Refreshing this page clears the key.</span></div>
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">Get a key ↗</a>
          </div>
          <div className="paper-chat" aria-busy={asking}>
            <div className="chat-log" role="log" aria-label="Questions and answers" aria-live="polite" aria-relevant="additions text">
              {chat.length === 0 ? (
                <div className="empty-chat">
                  <span>Suggested questions</span>
                  {lesson.questions.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}
                </div>
              ) : chat.map((message, index) => (
                <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                  <span>{message.role === "user" ? "You" : "Lesson guide"}</span><p>{message.content}</p>
                </div>
              ))}
            </div>
            <form className="question-form" onSubmit={askPaper}>
              <textarea aria-label="Question about this lesson" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the lesson or what to check in the linked sources…" />
              <button type="submit" aria-describedby="paper-question-status" disabled={!openRouterKey.trim() || !question.trim() || asking}>{asking ? "Thinking…" : "Ask"}</button>
            </form>
            <div className="chat-status">
              <span id="paper-question-status" role="status" aria-live="polite" aria-atomic="true">
                {questionError
                  ? `Question failed: ${questionError}`
                  : asking
                    ? "Asking OpenRouter using this lesson’s notes…"
                    : answerModel
                      ? `Answered by ${answerModel} using this lesson’s notes`
                      : "Context: lesson notes + source details · linked papers aren’t downloaded"}
              </span>
              {openRouterKey ? <button type="button" onClick={() => setOpenRouterKey("")}>Clear key</button> : null}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function starterCodeFor(block: CodeBlock, lesson: Pick<CourseLesson, "implementation">) {
  if (lesson.implementation.filename.endsWith(".py")) {
    const lines = block.code.split("\n");
    const definition = lines.findIndex((line) => line.startsWith("def "));
    if (definition < 0) return `# TODO: implement ${block.label.toLowerCase()}.\nraise NotImplementedError(${JSON.stringify(`Implement ${block.label}.`)})`;
    const prefix = lines.slice(0, definition).join("\n").trimEnd();
    const signature = lines[definition];
    return [prefix, `${signature}\n    raise NotImplementedError(${JSON.stringify(`Implement ${block.label}.`)})`]
      .filter(Boolean)
      .join("\n\n");
  }
  const signature = block.code.split("\n")[0];
  return `${signature}\n  // TODO: implement ${block.label.toLowerCase()}.\n}`;
}

function projectSeedForLesson(lesson: CourseLesson, hidden: string[], currentAnswers: Record<string, string>, verified: string[]): LessonProjectSeed {
  const blocks = lesson.implementation.codeBlocks;
  const contentFor = (practice: boolean) => lessonImplementationSource(lesson, blocks
    .map((block, index) => `${lessonBlockComment(lesson, index, block.label)}\n${practice && hidden.includes(block.id) ? currentAnswers[block.id] ?? "" : block.code}`));
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
  const pythonLesson = lesson.implementation.filename.endsWith(".py");
  const implementationPrelude = lessonImplementationPrelude(lesson);
  const [hiddenBlocks, setHiddenBlocks] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verifiedBlockIds, setVerifiedBlockIds] = useState<string[]>([]);
  const [verifiedSources, setVerifiedSources] = useState<Record<string, string>>({});
  const [verifiedContractVersion, setVerifiedContractVersion] = useState<string | null>(null);
  const [cellResults, setCellResults] = useState<Record<string, CheckResult | undefined>>({});
  const [practiceMessage, setPracticeMessage] = useState("The working example is ready to run.");
  const [runningBlockIds, setRunningBlockIds] = useState<string[]>([]);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const [practiceReady, setPracticeReady] = useState(false);
  const [pendingReset, setPendingReset] = useState<{ kind: "all" } | { kind: "block"; blockId: string } | null>(null);
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
      const compatible = compatiblePracticeDrafts(
        lesson.implementation.filename,
        blocks,
        saved?.hiddenBlocks ?? [],
        saved?.answers ?? {},
      );
      const savedHidden = compatible.hiddenBlocks;
      const savedAnswers = compatible.answers;
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
      setPracticeMessage(compatible.ignoredLegacyLanguage
        ? "This lesson now runs in CPython. Your older JavaScript draft is still saved on this device, but we loaded the editable Python example so incompatible code never runs."
        : savedHidden.length
          ? "Your saved practice work and project file are back."
          : "The working example is ready to run.");
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
  const runContracts = async (source: string, contractIds: readonly string[]) => {
    if (!pythonLesson) return runPracticeContracts({ path: projectPath, source, contractIds });
    const wanted = new Set(contractIds);
    const contracts = llmSystemsContractSuite.contracts.filter((contract) => wanted.has(contract.id));
    if (!contracts.length || contracts.length !== wanted.size) {
      throw new Error("That CPython lesson check isn’t available.");
    }
    const run = await runPythonLessonContracts({
      path: projectPath,
      source,
      contracts,
      onEvent: (event) => {
        if (event.type === "progress") setPracticeMessage(event.message);
      },
    });
    return run.results;
  };
  const practiceDraftState = () => ({
    hiddenBlocks: [...hiddenBlocksRef.current],
    answers: { ...answersRef.current },
    verification: {
      ids: [...verifiedBlockIdsRef.current],
      sources: { ...verifiedSourcesRef.current },
      contractVersion: verifiedContractVersionRef.current,
    },
  });
  const persistBlockState = (block: CodeBlock, next: ReturnType<typeof practiceDraftState>, message: string) => {
    const nextVerified = next.verification.ids;
    const nextVerifiedSources = next.verification.sources;
    setCellResults((current) => ({ ...current, [block.id]: undefined }));
    applyPracticeState(next.hiddenBlocks, next.answers, nextVerified, nextVerifiedSources, next.verification.contractVersion);
    saveLessonPracticeAndVerification(lesson.id, next.hiddenBlocks, next.answers, nextVerified, nextVerifiedSources, next.verification.contractVersion);
    saveLessonProjectFile(projectSeedForLesson(lesson, next.hiddenBlocks, next.answers, nextVerified));
    setPracticeMessage(message);
  };
  const resetBlock = (block: CodeBlock) => {
    setPendingReset(null);
    persistBlockState(
      block,
      resetPracticeBlock(practiceDraftState(), block.id, starterCodeFor(block, lesson)),
      `${block.label} is back to its starter code. Complete it, then run the cell.`,
    );
  };
  const armBlockReset = (block: CodeBlock) => {
    setPendingReset({ kind: "block", blockId: block.id });
    setPracticeMessage(`${block.label} is ready to reset. Confirm to replace this draft with starter code, or cancel to keep your code.`);
  };
  const cancelBlockReset = (block: CodeBlock) => {
    setPendingReset(null);
    setPracticeMessage(`${block.label} reset cancelled. Your code is unchanged.`);
  };
  const restoreBlock = (block: CodeBlock) => {
    setPendingReset(null);
    persistBlockState(
      block,
      restoreReferenceBlock(practiceDraftState(), block.id),
      `${block.label} is showing the working example. Choose Restore draft to return to your saved edit.`,
    );
  };
  const recoverBlock = (block: CodeBlock) => {
    const savedDraft = answersRef.current[block.id];
    if (savedDraft === undefined || !practiceDraftIsCompatible(lesson.implementation.filename, savedDraft)) return;
    setPendingReset(null);
    persistBlockState(
      block,
      editPracticeBlock(practiceDraftState(), block.id, savedDraft),
      `${block.label} draft restored. Run the cell when you are ready.`,
    );
  };
  const hideAll = () => {
    setPendingReset(null);
    const nextHidden = blocks.map((block) => block.id);
    const nextAnswers = Object.fromEntries(blocks.map((block) => [block.id, starterCodeFor(block, lesson)]));
    applyPracticeState(nextHidden, nextAnswers, [], {}, null);
    saveLessonPracticeAndVerification(lesson.id, nextHidden, nextAnswers, [], {}, null);
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, []));
    setCellResults({});
    setPracticeMessage("Every cell is back to its starter code. Complete them in any valid way.");
  };
  const armResetAll = () => {
    setPendingReset({ kind: "all" });
    setPracticeMessage("Ready to reset everything. Confirm to replace every cell with starter code, or cancel to keep your code.");
  };
  const cancelResetAll = () => {
    setPendingReset(null);
    setPracticeMessage("Reset all cancelled. Your code is unchanged.");
  };
  const showSolution = () => {
    setPendingReset(null);
    const currentAnswers = answersRef.current;
    applyPracticeState([], currentAnswers, [], {}, null);
    saveLessonPracticeAndVerification(lesson.id, [], currentAnswers, [], {}, null);
    saveLessonProjectFile(projectSeedForLesson(lesson, [], currentAnswers, []));
    setCellResults({});
    setPracticeMessage("The working example is back. Use Restore draft on any cell to return to your saved edit.");
  };
  const runCell = async (block: CodeBlock) => {
    if (!practiceReadyRef.current || runningBlockIdsRef.current.length) return;
    setPendingReset(null);
    const sourceSnapshot = sourceFor(block);
    const hiddenSnapshot = [...hiddenBlocksRef.current];
    const isPracticeRun = hiddenSnapshot.includes(block.id);
    setRunning([block.id]);
    setPracticeMessage(pythonLesson
      ? `${isPracticeRun ? "Checking your" : "Running the example for"} ${block.label.toLowerCase()} in browser CPython…`
      : `${isPracticeRun ? "Checking your" : "Running the example for"} ${block.label.toLowerCase()} in the isolated browser lab…`);
    try {
      const [result] = await runContracts(
        lessonImplementationSource(lesson, [sourceSnapshot]),
        [`${lesson.id}/${block.id}`],
      );
      const check = result ?? { label: block.label, passed: false, detail: "The isolated test didn’t return a result." };
      if (sourceFor(block) !== sourceSnapshot) {
        setCellResults((current) => ({ ...current, [block.id]: undefined }));
        setPracticeMessage(`${block.label} changed while its check was running. Run the current source again.`);
        return;
      }
      const currentVerification = { ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current, contractVersion: verifiedContractVersionRef.current };
      const currentHidden = [...hiddenBlocksRef.current];
      const currentAnswers = { ...answersRef.current };
      const nextVerification = verificationAfterBlockRun(
        currentVerification,
        block.id,
        sourceSnapshot,
        currentHidden,
        check.passed,
        llmSystemsContractSuite.contractVersion,
      );
      const nextVerified = nextVerification.ids;
      const nextVerifiedSources = nextVerification.sources;
      if (isPracticeRun) {
        applyPracticeState(currentHidden, currentAnswers, nextVerified, nextVerifiedSources, nextVerification.contractVersion);
        recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, nextVerification.contractVersion);
        saveLessonProjectFile(projectSeedForLesson(lesson, currentHidden, currentAnswers, nextVerified));
      }
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(check.passed
        ? isPracticeRun
          ? `${block.label} passed the course checks and is now verified.`
          : `${block.label} example passed. Try the cell yourself to verify your work.`
        : `${block.label} needs a fix. Check the failure below; your other cells didn’t change.`);
      if (isPracticeRun) {
        void recordLearningEvent("cell_check_completed", {
          lessonId: lesson.id,
          moduleId: lesson.courseId,
          outcome: check.passed ? "passed" : "failed",
        });
      }
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
    setPendingReset(null);
    const hiddenSnapshot = [...hiddenBlocksRef.current];
    const answersSnapshot = { ...answersRef.current };
    const sourceSnapshots = Object.fromEntries(blocks.map((block) => [block.id, sourceFor(block)]));
    setRunning(blocks.map((block) => block.id));
    setPracticeMessage(pythonLesson
      ? hiddenSnapshot.length
        ? "Checking your practice cells and running the other examples in browser CPython…"
        : "Running every example in browser CPython. Edit a cell to verify your own work…"
      : hiddenSnapshot.length
        ? "Checking your practice cells and running the other examples in an isolated worker…"
        : "Running every example. Edit a cell to verify your own work…");
    try {
      const combinedSource = lessonImplementationSource(lesson, blocks.map((block) => sourceSnapshots[block.id]));
      const results = await runContracts(
        combinedSource,
        blocks.map((block) => `${lesson.id}/${block.id}`),
      );
      const resultById = new Map(results.map((result) => [result.id, result]));
      const ordered = blocks.map((block) => resultById.get(`${lesson.id}/${block.id}`) ?? { id: `${lesson.id}/${block.id}`, path: projectPath, label: block.label, passed: false, detail: "The isolated test didn’t return a result." });
      if (blocks.some((block) => sourceFor(block) !== sourceSnapshots[block.id])) {
        setCellResults({});
        setPracticeMessage("The lesson source changed while checks were running. Run the current source again.");
        return;
      }
      const nextVerified = creditablePracticeBlockIds(
        blocks.map((block) => block.id),
        hiddenSnapshot,
        blocks.filter((_, index) => ordered[index].passed).map((block) => block.id),
      );
      const nextVerifiedSources = Object.fromEntries(nextVerified.map((id) => [id, sourceSnapshots[id]]));
      const nextVerifiedContractVersion = nextVerified.length ? llmSystemsContractSuite.contractVersion : null;
      if (hiddenSnapshot.length) {
        applyPracticeState(hiddenSnapshot, answersSnapshot, nextVerified, nextVerifiedSources, nextVerifiedContractVersion);
        recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources, nextVerifiedContractVersion);
        saveLessonProjectFile(projectSeedForLesson(lesson, hiddenSnapshot, answersSnapshot, nextVerified));
      }
      setCellResults(Object.fromEntries(blocks.map((block, index) => [block.id, ordered[index]])));
      const passed = ordered.filter((result) => result.passed).length;
      const allBlocksInPractice = hiddenSnapshot.length === blocks.length;
      if (passed === ordered.length && allBlocksInPractice) {
        void recordLearningEvent("lesson_checks_completed", {
          lessonId: lesson.id,
          moduleId: lesson.courseId,
          outcome: "passed",
          count: ordered.length,
        });
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
          setPracticeMessage(`Every isolated behavior check passes. Artifact ${artifact.contentHash.slice(7, 19)} is ready for the next lesson.`);
        } catch (artifactError) {
          setPracticeMessage(`Every isolated behavior check passes, but the artifact couldn’t be saved: ${artifactError instanceof Error ? artifactError.message : "local storage is unavailable"}`);
        }
      } else {
        setPracticeMessage(`${passed} of ${ordered.length} runs pass, and ${nextVerified.length} of ${blocks.length} practice cells are verified. Running the examples alone doesn’t count as your work.`);
      }
    } catch (error) {
      setPracticeMessage(error instanceof Error ? error.message : "The isolated lesson test failed safely.");
    } finally {
      setRunning([]);
    }
  };
  const updateAnswer = (block: CodeBlock, value: string) => {
    setPendingReset(null);
    persistBlockState(
      block,
      editPracticeBlock(practiceDraftState(), block.id, value),
      "Draft saved locally. Run the affected cell again.",
    );
  };
  const verifiedCells = verifiedBlockIds.length;

  return (
    <section className="paper-section implementation-section" id="implementation">
      <div className="section-title"><span>03</span><h2>Build it</h2></div>
      <p className="implementation-intro">{lesson.implementation.intro}</p>
      {pythonLesson || lesson.implementation.tensorOps?.length ? (
        <div className="tensor-runtime-strip">
          <div><span>{pythonLesson ? "Python runtime" : "Tensor runtime"}</span><strong>{pythonLesson ? "CPython · NumPy" : "runtime/latent-tensor.js"}</strong><p>{pythonLesson ? lesson.implementation.tensorOps?.length ? "NumPy handles the array operations; you build the model behavior." : "A browser worker runs this file in CPython; you build the behavior the tests check." : "The course handles shape checks and automatic differentiation; you build the model operation."}</p></div>
          <div aria-label={pythonLesson ? "Python and NumPy operations used in this lesson" : "Latent Tensor operations used in this lesson"}>
            {pythonLesson
              ? lesson.implementation.tensorOps?.map((operation) => <span title="Python or NumPy operation used by this lesson" key={operation}>{operation}</span>)
              : latentTensorOperations(lesson.implementation.tensorOps ?? []).map((operation) => <span title={operation.purpose} key={operation.name}>{operation.name}</span>)}
          </div>
        </div>
      ) : null}
      <div className="practice-editor" aria-busy={!practiceReady || runningBlockIds.length > 0}>
        <div className="editor-toolbar">
          <div className="editor-file"><span>{projectPath}</span><strong>{!practiceReady ? "Loading saved work…" : hiddenBlocks.length === 0 ? "Working example · editable" : `${hiddenBlocks.length} ${hiddenBlocks.length === 1 ? "draft" : "drafts"} · saved here`}</strong></div>
          <div className="editor-progress" aria-label={`${verifiedCells} of ${blocks.length} cells verified`}>
            <span>{verifiedCells}/{blocks.length} verified</span><i><b style={{ width: `${verifiedCells / blocks.length * 100}%` }} /></i>
          </div>
          <div className="toolbar-actions" aria-label="Practice file actions">
            {pendingReset?.kind === "all" ? (
              <>
                <button type="button" aria-label="Confirm reset all cells" aria-describedby={`practice-status-${lesson.id}`} onClick={hideAll} disabled={!practiceReady || runningBlockIds.length > 0}>Confirm reset all</button>
                <button type="button" aria-label="Cancel reset all cells" aria-describedby={`practice-status-${lesson.id}`} onClick={cancelResetAll} disabled={runningBlockIds.length > 0}>Cancel</button>
              </>
            ) : <button type="button" aria-label="Reset all cells to starter code" aria-describedby={`practice-status-${lesson.id}`} onClick={armResetAll} disabled={!practiceReady || runningBlockIds.length > 0}>Reset all</button>}
            {hiddenBlocks.length > 0 ? <button type="button" onClick={showSolution} disabled={!practiceReady || runningBlockIds.length > 0}>Show all examples</button> : null}
            <Link href={`/workspace?file=${encodeURIComponent(`${lesson.courseId ?? "models"}/${lesson.implementation.filename}`)}`}>Open in IDE ↗</Link>
          </div>
        </div>
        <div className="code-surface">
          {implementationPrelude ? (
            <div className="tensor-import-line"><span>uses</span><code>{implementationPrelude}</code><em>read only</em></div>
          ) : null}
          {blocks.map((block, blockIndex) => {
            const hidden = hiddenBlocks.includes(block.id);
            const recoverableDraft = !hidden
              && answers[block.id] !== undefined
              && answers[block.id] !== block.code
              && practiceDraftIsCompatible(lesson.implementation.filename, answers[block.id]);
            const startLine = blocks.slice(0, blockIndex).reduce((line, previous) => line + previous.code.split("\n").length + 1, implementationPrelude ? 3 : 1);
            const result = cellResults[block.id];
            const resetArmed = pendingReset?.kind === "block" && pendingReset.blockId === block.id;
            const blockRunning = runningBlockIds.includes(block.id);
            return (
              <div
                className={`practice-block ${hidden ? "is-hidden" : ""}`}
                data-reference-code={encodeURIComponent(block.code)}
                aria-busy={runningBlockIds.includes(block.id)}
                key={block.id}
              >
                <div className="block-heading">
                  <div><span>0{blockIndex + 1}</span><strong>{block.label}</strong><em>{block.purpose}</em></div>
                  <div className="block-actions">
                    <button className="run-cell-button" type="button" onClick={() => void runCell(block)} disabled={!practiceReady || runningBlockIds.length > 0}>{blockRunning ? "Running…" : "Run cell"}</button>
                    {resetArmed ? (
                      <>
                        <button type="button" aria-label={`Confirm reset ${block.label} to starter code`} aria-describedby={`practice-status-${lesson.id}`} onClick={() => resetBlock(block)} disabled={!practiceReady || blockRunning}>Confirm reset</button>
                        <button type="button" aria-label={`Cancel reset ${block.label}`} aria-describedby={`practice-status-${lesson.id}`} onClick={() => cancelBlockReset(block)} disabled={blockRunning}>Cancel</button>
                      </>
                    ) : <button type="button" aria-label={`Reset ${block.label} to starter code`} aria-describedby={`practice-status-${lesson.id}`} onClick={() => armBlockReset(block)} disabled={!practiceReady || blockRunning}>Reset starter</button>}
                    {hidden ? <button type="button" onClick={() => restoreBlock(block)} disabled={!practiceReady || blockRunning}>Show example</button> : recoverableDraft ? <button type="button" onClick={() => recoverBlock(block)} disabled={!practiceReady || blockRunning}>Restore draft</button> : null}
                  </div>
                </div>
                {block.concepts?.length ? <div className="concept-strip" aria-label={`${block.label} variables`}>{block.concepts.map((concept) => <span key={concept.name}><code>{concept.name}</code><em>{concept.detail}</em></span>)}</div> : null}
                <div className="answer-area" data-direct-edit="true">
                  <div className="practice-guidance">
                    <div><span>{hidden ? "Your draft" : "Editable example"}</span><strong>{hidden ? "Saved on this device · run it when you’re ready." : "Click the code and start typing."}</strong></div>
                  </div>
                  {practiceReady ? (
                    <Suspense fallback={<div className="lesson-editor-loading" role="status">Loading syntax-aware editor…</div>}>
                      <LessonCodeEditor
                        ariaLabel={`Edit ${block.label}`}
                        lineNumberStart={startLine}
                        onChange={(value) => updateAnswer(block, value)}
                        path={lesson.implementation.filename}
                        readOnly={blockRunning}
                        value={hidden ? answers[block.id] ?? "" : block.code}
                        variant="lesson"
                      />
                    </Suspense>
                  ) : <SyntaxCode code={block.code} label={`${block.label} editable reference loading`} startLine={startLine} />}
                </div>
                <div className="cell-footer" role="status" aria-label={`${block.label} check status`} aria-live="polite" aria-atomic="true">
                  {result ? <span className={result.passed ? "cell-result passed" : "cell-result failed"}><i>{result.passed ? "✓" : "×"}</i>{!hidden && result.passed ? "Example passed · try this cell yourself to verify your work" : result.detail}</span> : verifiedContractVersion === llmSystemsContractSuite.contractVersion && hidden && verifiedBlockIds.includes(block.id) && verifiedSources[block.id] === (answers[block.id] ?? "") ? <span className="cell-result passed"><i>✓</i>Already verified on this device</span> : <span>{practiceReady ? hidden ? "Your code hasn’t run yet" : "Example hasn’t run · doesn’t count toward progress" : "Loading saved progress"}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="editor-footer"><p id={`practice-status-${lesson.id}`} role="status" aria-live="polite" aria-atomic="true">{practiceReady ? practiceMessage : "Loading your saved practice before editing turns on…"}</p><button type="button" aria-describedby={`practice-status-${lesson.id}`} onClick={() => void runAll()} disabled={!practiceReady || runningBlockIds.length > 0}>{runningBlockIds.length ? "Running in sandbox…" : hiddenBlocks.length === blocks.length ? "Check all my code" : hiddenBlocks.length ? "Run my code + examples" : "Run all examples"}</button></div>
      </div>
      {PYTORCH_HANDOFF_LESSONS.has(lesson.id) ? (
        <Suspense fallback={<div className="pytorch-handoff-loading" role="status">Loading the PyTorch version…</div>}>
          <PyTorchHandoff lessonId={lesson.id} />
        </Suspense>
      ) : null}
      <LessonExperiment lesson={lesson} />
      <ArtifactRuntimePanel lesson={lesson} refreshKey={artifactRevision} />
    </section>
  );
}

function LessonRecoveryCandidates({ lessonId, onLoaded }: { lessonId: string; onLoaded: () => void }) {
  const candidates = useLearnerRecoveryCandidates(lessonId);
  const [workingSession, setWorkingSession] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (!candidates.length) return null;
  return (
    <section className="lesson-recovery-candidates" aria-labelledby={`lesson-recovery-title-${lessonId}`}>
      <div>
        <p className="eyebrow">We found another copy</p>
        <h2 id={`lesson-recovery-title-${lessonId}`}>Choose which practice copy you want</h2>
        <p>A copy from another tab or an interrupted save is different from your saved lesson, so we didn’t load it automatically.</p>
      </div>
      <div className="lesson-recovery-list">
        {candidates.map((candidate) => (
          <article key={`${candidate.sessionId}:${candidate.lessonId}:${candidate.updatedAt}`}>
            <span>
              <strong>{candidate.legacy ? "Older recovery copy" : "Practice copy that hasn’t synced"}</strong>
              <em>{new Date(candidate.updatedAt).toLocaleString()} · {Object.keys(candidate.value.answers).length} practice {Object.keys(candidate.value.answers).length === 1 ? "cell" : "cells"}</em>
            </span>
            <span>
              <button type="button" disabled={Boolean(workingSession)} onClick={() => {
                setWorkingSession(candidate.sessionId);
                setMessage("Loading that recovery copy…");
                void loadLearnerRecoveryCandidate(candidate.sessionId, lessonId).then((loaded) => {
                  setWorkingSession(null);
                  setMessage(loaded ? "Recovery loaded. Check the code while it syncs with your saved progress." : "That recovery copy isn’t available anymore.");
                  if (loaded) onLoaded();
                }).catch(() => {
                  setWorkingSession(null);
                  setMessage("We couldn’t load that recovery copy. It’s still available if you want to try again.");
                });
              }}>{workingSession === candidate.sessionId ? "Loading…" : "Load copy"}</button>
              <button type="button" disabled={Boolean(workingSession)} onClick={() => {
                discardLearnerRecoveryCandidate(candidate.sessionId, lessonId);
                setMessage("Recovery copy discarded. Your saved lesson progress didn’t change.");
              }}>Discard copy</button>
            </span>
          </article>
        ))}
      </div>
      <p className="lesson-recovery-status" role="status" aria-live="polite">{message}</p>
    </section>
  );
}

export function PaperLab({ lesson }: { lesson: CourseLesson }) {
  const learnerState = useLearnerState();
  const learnerPersistenceError = useLearnerPersistenceError();
  const projectPersistenceError = useProjectPersistenceError();
  const persistenceError = learnerPersistenceError ?? projectPersistenceError;
  const trackLessons = courseLessons.filter((candidate) => candidate.courseId === lesson.courseId);
  const trackIndex = trackLessons.findIndex((candidate) => candidate.id === lesson.id);
  const previous = trackLessons[trackIndex - 1];
  const next = trackLessons[trackIndex + 1];
  const courseHref = `/courses/${lesson.courseId ?? "models"}`;
  const progress = learnerState.lessons[lesson.id];
  const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id);
  const checkpoint = moduleCheckpoint(lesson.courseId ?? "models");
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  return (
    <main className={styles.lessonShell}>
      <Atmosphere />
      <header className="site-header lesson-header">
        <Link className="wordmark" href="/" aria-label="Latent course home"><i />latent</Link>
        <nav aria-label="Lesson navigation">
          <a href="#summary" aria-label="Summary"><span className="nav-label-full">Summary</span><span className="nav-label-short">Summary</span></a>
          <a href="#questions" aria-label="Questions"><span className="nav-label-full">Questions</span><span className="nav-label-short">Ask</span></a>
          <a href="#implementation" aria-label="Build it"><span className="nav-label-full">Build it</span><span className="nav-label-short">Code</span></a>
          <a href="#artifacts" aria-label="Saved results"><span className="nav-label-full">Saved results</span><span className="nav-label-short">Results</span></a>
        </nav>
        <span>{lesson.courseTitle ?? "Model Foundations"} · {String(trackIndex + 1).padStart(2, "0")} / {String(trackLessons.length).padStart(2, "0")}</span>
      </header>
      {persistenceError ? <p className="persistence-warning lesson-persistence-warning" role="alert">Storage warning: {persistenceError}</p> : null}
      <article className="paper-page" id="top">
        <HeaderSection lesson={lesson} />
        <ParagraphSection lesson={lesson} />
        <TextBoxSection lesson={lesson} />
        <LessonRecoveryCandidates lessonId={lesson.id} onLoaded={() => setRecoveryRevision((revision) => revision + 1)} />
        <CodingSection key={`${lesson.id}:${recoveryRevision}`} lesson={lesson} />
        <LessonOutcome lesson={lesson} />
        <footer className="paper-footer lesson-footer">
          {previous ? <Link href={`/lessons/${previous.id}`}>← {previous.title}</Link> : <Link href={courseHref}>← Module</Link>}
          <p>{complete ? `Lesson ${trackIndex + 1} done` : `${progress?.verifiedCells.length ?? 0}/${lesson.implementation.codeBlocks.length} checks · ${progress?.experimentComplete ? "lab done" : "lab still to do"}`}</p>
          {next ? <Link href={`/lessons/${next.id}`}>{next.title} →</Link> : checkpoint ? <Link href={`/checkpoints/${checkpoint.courseId}`}>Module checkpoint →</Link> : <Link href={courseHref}>Module ↑</Link>}
        </footer>
      </article>
    </main>
  );
}
