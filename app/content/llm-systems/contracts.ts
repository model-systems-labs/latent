import type {
  ContractSuite,
  ExerciseCase,
  ExerciseContract,
  HostAssertion,
  JsonValue,
  ValuePath,
} from "@latent/browser-lab/types";
import { llmSystemsManifest } from "./manifest";

type AuthoredCase = {
  id: string;
  label: string;
  args: readonly JsonValue[];
  assertions: readonly HostAssertion[];
};

type AuthoredContract = {
  lessonId: string;
  blockId: string;
  label: string;
  exportName: string;
  cases: readonly AuthoredCase[];
};

const lessonPaths = new Map<string, string>(
  llmSystemsManifest.modules.flatMap((module) =>
    module.lessons.map((lesson) => [lesson.lessonId, lesson.projectPath] as const),
  ),
);

function modulePathFor(lessonId: string): string {
  const modulePath = lessonPaths.get(lessonId);
  if (!modulePath) throw new Error(`No project path is registered for lesson ${lessonId}.`);
  return modulePath;
}

function defineExerciseContract(authored: AuthoredContract): ExerciseContract {
  const modulePath = modulePathFor(authored.lessonId);
  return {
    id: `${authored.lessonId}/${authored.blockId}`,
    label: authored.label,
    cases: authored.cases.map((exerciseCase): ExerciseCase => ({
      id: exerciseCase.id,
      label: exerciseCase.label,
      invoke: {
        modulePath,
        exportName: authored.exportName,
        args: exerciseCase.args,
      },
      assertions: exerciseCase.assertions,
    })),
  };
}

function equal(
  id: string,
  label: string,
  expected: JsonValue,
  path?: ValuePath,
): HostAssertion {
  return { id, label, kind: "deep-equal", expected, path };
}

function finite(id: string, label: string, path?: ValuePath): HostAssertion {
  return { id, label, kind: "finite", path };
}

function range(
  id: string,
  label: string,
  minimum: number,
  maximum: number,
  path?: ValuePath,
): HostAssertion {
  return { id, label, kind: "range", minimum, maximum, path };
}

function length(id: string, label: string, expected: number, path?: ValuePath): HostAssertion {
  return { id, label, kind: "length", expected, path };
}

const negativeInfinity = { $number: "-Infinity" } as const;

/**
 * The complete LLM Systems assessment surface. Learner code only receives the
 * invocation arguments; every expected value and predicate remains host-owned
 * data and is evaluated outside the learner VM.
 */
export const llmSystemsExerciseContracts: readonly ExerciseContract[] = [
  defineExerciseContract({
    lessonId: "character-rnns",
    blockId: "rnn-step",
    label: "Recurrent transition",
    exportName: "rnnStep",
    cases: [
      {
        id: "one-hot-input",
        label: "Combines a one-hot input with an empty recurrent state",
        args: [
          [1, 0],
          [0, 0],
          {
            Wxh: [[1, 0], [0, 1]],
            Whh: [[0, 0], [0, 0]],
            bias: [0, 0],
          },
        ],
        assertions: [
          length("state-width", "Returns one value per hidden unit", 2),
          range("activated-input", "Applies tanh to the active input", 0.7, 0.8, [0]),
          equal("inactive-unit", "Leaves the inactive unit at zero", 0, [1]),
        ],
      },
      {
        id: "non-empty-recurrent-state",
        label: "Carries information from the preceding hidden state",
        args: [
          [0, 0],
          [1, -1],
          {
            Wxh: [[1, 0], [0, 1]],
            Whh: [[1, 0], [0, 1]],
            bias: [0, 0],
          },
        ],
        assertions: [
          range("positive-memory", "Use Whh and the previous state before tanh for the first unit", 0.76, 0.77, [0]),
          range("negative-memory", "Use Whh and the previous state before tanh for the second unit", -0.77, -0.76, [1]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "character-rnns",
    blockId: "cross-entropy",
    label: "Cross-entropy loss",
    exportName: "crossEntropy",
    cases: [
      {
        id: "high-target-probability",
        label: "Assigns low loss to the likely target",
        args: [[0.1, 0.8, 0.1], 1],
        assertions: [
          finite("finite-loss", "Produces a finite loss"),
          range("low-loss", "Apply -log to the target probability to produce the expected low loss", 0.22, 0.23),
        ],
      },
      {
        id: "low-target-probability",
        label: "Assigns higher loss to the unlikely target",
        args: [[0.8, 0.1, 0.1], 1],
        assertions: [range("high-loss", "Use the probability at targetIndex, not the largest probability", 2.3, 2.31)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "character-rnns",
    blockId: "gradient-clipping",
    label: "Gradient clipping",
    exportName: "clipGradients",
    cases: [
      {
        id: "symmetric-bound",
        label: "Clips both tails while preserving in-range gradients",
        args: [[-12, -2, 0, 3, 20], 5],
        assertions: [equal("clipped-values", "Clamp both negative and positive gradients to the symmetric limit", [-5, -2, 0, 3, 5])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "neural-language-models",
    blockId: "stable-softmax",
    label: "Stable softmax",
    exportName: "stableSoftmax",
    cases: [
      {
        id: "large-logits",
        label: "Large equal-offset logits must remain finite",
        args: [[1001, 1000, 999]],
        assertions: [
          length("vocabulary-width", "Return one normalized probability per input logit", 3),
          finite("first-finite", "Subtract max(logits) before exponentiating, then divide every weight by their sum", [0]),
          finite("second-finite", "Subtract max(logits) before exponentiating, then divide every weight by their sum", [1]),
          finite("third-finite", "Subtract max(logits) before exponentiating, then divide every weight by their sum", [2]),
          range("first-probability", "Subtract max(logits) before exponentiating, then divide every weight by their sum", 0.66524, 0.66525, [0]),
          range("second-probability", "Subtract max(logits) before exponentiating, then divide every weight by their sum", 0.24472, 0.24474, [1]),
          range("third-probability", "Subtract max(logits) before exponentiating, then divide every weight by their sum", 0.09002, 0.09004, [2]),
        ],
      },
      {
        id: "equal-logits",
        label: "Equal logits must produce a uniform distribution",
        args: [[5, 5, 5, 5]],
        assertions: [
          equal("uniform-probabilities", "Exponentiate relative scores before normalizing; equal scores must receive equal probability", [0.25, 0.25, 0.25, 0.25]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "neural-language-models",
    blockId: "context-embedding",
    label: "Context representation",
    exportName: "contextEmbedding",
    cases: [
      {
        id: "two-word-average",
        label: "Averages each embedding dimension",
        args: [[0, 1], [[2, 0], [0, 4]]],
        assertions: [equal("averaged-vector", "Average every selected row coordinate-wise; do not return only the first row or the sum", [1, 2])],
      },
      {
        id: "repeated-nonconsecutive-indices",
        label: "Looks up every context id, including repeated ids",
        args: [[2, 0, 2], [[3, 0], [20, 20], [0, 6]]],
        assertions: [equal("indexed-average", "Use indices to select all context rows before averaging along axis 0", [1, 4])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "neural-language-models",
    blockId: "negative-log-likelihood",
    label: "Negative log-likelihood",
    exportName: "negativeLogLikelihood",
    cases: [
      {
        id: "certain-target",
        label: "Scores a high-probability target",
        args: [[0.05, 0.9, 0.05], 1],
        assertions: [range("certain-loss", "Return the negative logarithm of probabilities[targetIndex], not the probability itself", 0.1, 0.11)],
      },
      {
        id: "uncertain-target",
        label: "Scores a low-probability target",
        args: [[0.45, 0.1, 0.45], 1],
        assertions: [range("uncertain-loss", "Use probabilities[targetIndex], not the largest probability, then apply −log", 2.3, 2.31)],
      },
      {
        id: "zero-target-probability",
        label: "Keeps zero-probability targets finite",
        args: [[0.5, 0, 0.5], 1],
        assertions: [
          finite("finite-zero-loss", "Clamp the target probability to at least 10^-12 before applying −log"),
          range("bounded-zero-loss", "Clamp the target probability to at least 10^-12 before applying −log", 27.63, 27.64),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "subword-tokenization",
    blockId: "pair-counts",
    label: "Adjacent pair counts",
    exportName: "countPairs",
    cases: [
      {
        id: "overlapping-vocabulary-pairs",
        label: "Counts adjacent pairs across multiple words",
        args: [[[
          "l", "o", "w",
        ], ["l", "o"]]],
        assertions: [
          equal("lo-frequency", "Counts the repeated l-o pair", 2, ["l\u0000o"]),
          equal("ow-frequency", "Counts the single o-w pair", 1, ["o\u0000w"]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "subword-tokenization",
    blockId: "merge-pair",
    label: "Merge operation",
    exportName: "mergePair",
    cases: [
      {
        id: "selected-adjacent-pair",
        label: "Merges only the selected adjacent pair",
        args: [["l", "o", "w", "e", "r"], ["l", "o"]],
        assertions: [equal("merged-symbols", "Preserves order around the merged symbol", ["lo", "w", "e", "r"])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "subword-tokenization",
    blockId: "encode-word",
    label: "Ordered encoder",
    exportName: "encodeWord",
    cases: [
      {
        id: "ordered-merges",
        label: "Replays learned merges in their training order",
        args: ["lower", [["l", "o"], ["lo", "w"], ["e", "r"]]],
        assertions: [equal("encoded-tokens", "Produces the learned subword segmentation", ["low", "er"])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "additive-attention",
    blockId: "additive-score",
    label: "Compatibility score",
    exportName: "additiveScore",
    cases: [
      {
        id: "finite-compatibility",
        label: "Combines query and key projections into a scalar score",
        args: [
          [1, 0],
          [0, 1],
          {
            Wq: [[1, 0], [0, 1]],
            Wk: [[1, 0], [0, 1]],
            v: [0.5, -0.5],
            bias: [0, 0],
          },
        ],
        assertions: [
          finite("finite-score", "Produces a finite scalar score"),
          range("balanced-score", "Combines the balanced projections", -1e-12, 1e-12),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "additive-attention",
    blockId: "attention-softmax",
    label: "Alignment weights",
    exportName: "attentionWeights",
    cases: [
      {
        id: "ordered-alignment",
        label: "Normalizes scores into an ordered distribution",
        args: [[2, 1, 0]],
        assertions: [
          range("largest-weight", "Assigns the most mass to the largest score", 0.66524, 0.66525, [0]),
          range("middle-weight", "Assigns intermediate mass to the middle score", 0.24472, 0.24474, [1]),
          range("smallest-weight", "Assigns the least mass to the smallest score", 0.09002, 0.09004, [2]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "additive-attention",
    blockId: "context-vector",
    label: "Weighted context",
    exportName: "contextVector",
    cases: [
      {
        id: "weighted-state-mixture",
        label: "Combines encoder states using alignment weights",
        args: [[[1, 0], [0, 1]], [0.75, 0.25]],
        assertions: [equal("context", "Returns the weighted context vector", [0.75, 0.25])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "transformers",
    blockId: "causal-mask",
    label: "Causal mask",
    exportName: "causalMask",
    cases: [
      {
        id: "future-token-mask",
        label: "Preserves visible logits and removes future logits",
        args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]],
        assertions: [
          equal("first-visible-logit", "Preserves the first visible logit", 1, [0, 0]),
          equal("first-future-logit", "Masks the first future logit", negativeInfinity, [0, 1]),
          equal("second-future-logit", "Masks the second row's future logit", negativeInfinity, [1, 2]),
          equal("last-visible-logit", "Preserves the final visible logit", 9, [2, 2]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "transformers",
    blockId: "scaled-attention",
    label: "Scaled dot-product attention",
    exportName: "scaledDotProductAttention",
    cases: [
      {
        id: "query-aligned-value",
        label: "Weights values according to scaled query-key compatibility",
        args: [[1, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]]],
        assertions: [
          length("output-width", "Preserves the value width", 2),
          range("aligned-value", "Favors the query-aligned value", 1.33, 1.35, [0]),
          range("other-value", "Assigns less weight to the other value", 0.65, 0.67, [1]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "transformers",
    blockId: "layer-norm",
    label: "Layer normalization",
    exportName: "layerNorm",
    cases: [
      {
        id: "four-feature-vector",
        label: "Centers and scales one token representation",
        args: [[1, 2, 3, 4]],
        assertions: [
          length("normalized-width", "Preserves feature width", 4),
          range("first-feature", "Normalizes the first feature", -1.342, -1.341, [0]),
          range("second-feature", "Normalizes the second feature", -0.448, -0.447, [1]),
          range("third-feature", "Normalizes the third feature", 0.447, 0.448, [2]),
          range("fourth-feature", "Normalizes the fourth feature", 1.341, 1.342, [3]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "in-context-learning",
    blockId: "format-demonstrations",
    label: "Demonstration formatter",
    exportName: "formatDemonstrations",
    cases: [
      {
        id: "ordered-examples",
        label: "Formats examples without changing their order",
        args: [[{ input: "aa", label: "K" }, { input: "bbb", label: "M" }]],
        assertions: [equal("formatted-text", "Uses the stable demonstration format", "Input: aa\nLabel: K\n\nInput: bbb\nLabel: M")],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "in-context-learning",
    blockId: "build-prompt",
    label: "Evaluation prompt",
    exportName: "buildPrompt",
    cases: [
      {
        id: "zero-shot-prompt",
        label: "Builds a deterministic prompt without demonstrations",
        args: [{ instruction: "Return K or M.", demonstrations: "", query: "A sharp story." }],
        assertions: [equal("prompt", "Separates instruction and held-out query", "Return K or M.\n\nInput: A sharp story.\nLabel:")],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "in-context-learning",
    blockId: "exact-match",
    label: "Exact-match scoring",
    exportName: "exactMatchLabel",
    cases: [
      {
        id: "allowed-label",
        label: "Extracts and scores a standalone allowed label",
        args: ["The label is K.", "K"],
        assertions: [equal("scored-label", "Returns the extracted label and exact score", { predicted: "K", passed: true })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "inference-runtime",
    blockId: "inference-phases",
    label: "Phase accounting",
    exportName: "inferencePhases",
    cases: [
      {
        id: "prefill-and-decode",
        label: "Separates parallel prefill tokens from serial decode iterations",
        args: [96, 32],
        assertions: [equal("phase-counts", "Accounts for all prompt and output positions", {
          prefillTokens: 96,
          decodeIterations: 32,
          totalTokenPositions: 128,
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "inference-runtime",
    blockId: "kv-bytes",
    label: "KV-cache bytes",
    exportName: "kvCacheBytes",
    cases: [
      {
        id: "fp16-cache",
        label: "Accounts for keys and values across every layer",
        args: [{ layers: 4, heads: 8, headDimension: 16, tokens: 100, bytesPerValue: 2 }],
        assertions: [equal("byte-count", "Calculates the complete cache allocation", 204800)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "streaming-transport",
    blockId: "encode-sse",
    label: "SSE encoder",
    exportName: "encodeSse",
    cases: [
      {
        id: "token-frame",
        label: "Serializes a token event and JSON payload",
        args: ["token", { delta: "hi" }],
        assertions: [equal("frame", "Uses the event-stream wire format", "event: token\ndata: {\"delta\":\"hi\"}\n\n")],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "streaming-transport",
    blockId: "parse-sse",
    label: "Incremental parser",
    exportName: "parseSseChunk",
    cases: [
      {
        id: "incomplete-frame",
        label: "Retains an incomplete frame without emitting an event",
        args: ["", "event: token\ndata: {\"delta\":\"h"],
        assertions: [equal("partial-result", "Returns no event and preserves the partial frame", {
          events: [],
          remainder: "event: token\ndata: {\"delta\":\"h",
        })],
      },
      {
        id: "continued-frame",
        label: "Completes a frame carried across a chunk boundary",
        args: ["event: token\ndata: {\"delta\":\"h", "i\"}\n\n"],
        assertions: [equal("complete-result", "Emits the decoded event and clears the remainder", {
          events: [{ event: "token", data: { delta: "hi" } }],
          remainder: "",
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "scheduling-memory",
    blockId: "page-allocation",
    label: "Paged allocation",
    exportName: "allocateKvPages",
    cases: [
      {
        id: "partial-final-page",
        label: "Allocates enough pages and bounds final-page waste",
        args: [33, 16],
        assertions: [equal("allocation", "Calculates pages, capacity, and unused slots", {
          pages: 3,
          capacity: 48,
          wastedSlots: 15,
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "scheduling-memory",
    blockId: "batch-step",
    label: "Decode iteration",
    exportName: "decodeIteration",
    cases: [
      {
        id: "complete-and-active-requests",
        label: "Advances each request once and removes completed work",
        args: [[
          { id: "a", remaining: 1, generated: 0 },
          { id: "b", remaining: 3, generated: 2 },
        ]],
        assertions: [equal("active-requests", "Keeps only the correctly advanced active request", [
          { id: "b", remaining: 2, generated: 3 },
        ])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "reliability-observability",
    blockId: "retry-policy",
    label: "Retry policy",
    exportName: "shouldRetry",
    cases: [
      {
        id: "transient-before-output",
        label: "Retries a transient failure before visible output",
        args: [{ transient: true, tokensEmitted: 0, attempt: 0 }],
        assertions: [equal("retry", "Allows the safe retry", true)],
      },
      {
        id: "transient-after-output",
        label: "Rejects a transparent retry after visible output",
        args: [{ transient: true, tokensEmitted: 3, attempt: 0 }],
        assertions: [equal("no-retry", "Prevents duplicate visible generation", false)],
      },
      {
        id: "attempt-limit",
        label: "Rejects a retry at the attempt limit",
        args: [{ transient: true, tokensEmitted: 0, attempt: 2, maxAttempts: 2 }],
        assertions: [equal("bounded-retry", "Keeps retries bounded", false)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "reliability-observability",
    blockId: "terminal-guard",
    label: "Terminal-state guard",
    exportName: "acceptEvent",
    cases: [
      {
        id: "late-completion-event",
        label: "Rejects an event after a terminal state",
        args: [{ id: "r1", status: "complete" }, { requestId: "r1" }],
        assertions: [equal("late-rejected", "Ignores the late event", false)],
      },
      {
        id: "matching-active-event",
        label: "Accepts an event for the active request",
        args: [{ id: "r2", status: "streaming" }, { requestId: "r2" }],
        assertions: [equal("active-accepted", "Accepts the matching active event", true)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "conversation-state",
    blockId: "create-message",
    label: "Message record",
    exportName: "createMessage",
    cases: [
      {
        id: "streaming-assistant-message",
        label: "Creates a stable serializable message",
        args: [{ id: "m1", role: "assistant", status: "streaming" }],
        assertions: [equal("message", "Applies content and timestamp defaults", {
          id: "m1",
          role: "assistant",
          content: "",
          status: "streaming",
          createdAt: 0,
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "conversation-state",
    blockId: "append-delta",
    label: "Delta transition",
    exportName: "appendMessageDelta",
    cases: [
      {
        id: "targeted-streaming-message",
        label: "Appends a delta only to the matching streaming message",
        args: [[
          { id: "a", content: "Hel", status: "streaming" },
          { id: "b", content: "fixed", status: "complete" },
        ], "a", "lo"],
        assertions: [equal("messages", "Updates the target and preserves the completed message", [
          { id: "a", content: "Hello", status: "streaming" },
          { id: "b", content: "fixed", status: "complete" },
        ])],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "streaming-react",
    blockId: "delta-buffer",
    label: "Render buffer",
    exportName: "flushTokenBuffer",
    cases: [
      {
        id: "ordered-token-burst",
        label: "Combines queued deltas into one render update",
        args: [["Hel", "lo", " ", "world"]],
        assertions: [equal("flushed-buffer", "Preserves token order and clears the queue", {
          text: "Hello world",
          remaining: [],
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "streaming-react",
    blockId: "scroll-policy",
    label: "Scroll-follow policy",
    exportName: "shouldFollowStream",
    cases: [
      {
        id: "near-bottom",
        label: "Follows generation while the reader is near the bottom",
        args: [{ distanceFromBottom: 24, userScrolledUp: false }],
        assertions: [equal("follows", "Keeps the latest output visible", true)],
      },
      {
        id: "reader-scrolled-up",
        label: "Preserves reader control after a manual scroll",
        args: [{ distanceFromBottom: 24, userScrolledUp: true }],
        assertions: [equal("does-not-follow", "Does not pull the reader away", false)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "chat-actions-context",
    blockId: "context-budget",
    label: "Context selection",
    exportName: "selectContext",
    cases: [
      {
        id: "newest-complete-turns",
        label: "Retains system context and the newest complete unit that fits",
        args: [[
          { id: "s", role: "system", tokens: 4 },
          { id: "u1", role: "user", tokens: 5 },
          { id: "a1", role: "assistant", tokens: 6 },
          { id: "u2", role: "user", tokens: 5 },
        ], 10],
        assertions: [equal("selection", "Returns the bounded context and exact token use", {
          selected: [
            { id: "s", role: "system", tokens: 4 },
            { id: "u2", role: "user", tokens: 5 },
          ],
          used: 9,
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "chat-actions-context",
    blockId: "regenerate-branch",
    label: "Regeneration branch",
    exportName: "createRegeneration",
    cases: [
      {
        id: "new-assistant-attempt",
        label: "Creates a queued assistant attempt from the same user prefix",
        args: [{ messageId: "m9", parentUserId: "m4", attemptId: "a2" }],
        assertions: [equal("branch", "Preserves branch and attempt identity", {
          messageId: "m9",
          parentUserId: "m4",
          attemptId: "a2",
          role: "assistant",
          content: "",
          status: "queued",
        })],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "chat-product-quality",
    blockId: "storage-validation",
    label: "Storage validation",
    exportName: "validConversationRecord",
    cases: [
      {
        id: "current-safe-record",
        label: "Accepts a current serializable conversation record",
        args: [{ version: 1, id: "c1", messages: [] }],
        assertions: [equal("safe-record", "Accepts the safe record", true)],
      },
      {
        id: "record-containing-secret",
        label: "Rejects a conversation record containing an API key",
        args: [{ version: 1, id: "c1", messages: [], apiKey: "no" }],
        assertions: [equal("secret-rejected", "Prevents secret persistence", false)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "chat-product-quality",
    blockId: "phase-label",
    label: "Generation status",
    exportName: "generationStatusLabel",
    cases: [
      {
        id: "known-prefill-phase",
        label: "Labels a known generation phase honestly",
        args: ["prefill"],
        assertions: [equal("known-label", "Uses the prefill label", "Processing context")],
      },
      {
        id: "unknown-future-phase",
        label: "Falls back safely for an unknown future phase",
        args: ["future-state"],
        assertions: [equal("fallback-label", "Uses the safe fallback", "Ready")],
      },
    ],
  }),
];

export const llmSystemsContractSuite: ContractSuite = {
  contractVersion: "llm-systems-contracts-v2",
  contracts: llmSystemsExerciseContracts,
};
