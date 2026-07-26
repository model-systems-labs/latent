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

function pythonFunctionName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function defineExerciseContract(authored: AuthoredContract): ExerciseContract {
  const modulePath = modulePathFor(authored.lessonId);
  const exportName = modulePath.endsWith(".py")
    ? pythonFunctionName(authored.exportName)
    : authored.exportName;
  return {
    id: `${authored.lessonId}/${authored.blockId}`,
    label: authored.label,
    cases: authored.cases.map((exerciseCase): ExerciseCase => ({
      id: exerciseCase.id,
      label: exerciseCase.label,
      invoke: {
        modulePath,
        exportName,
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

function includes(id: string, label: string, expected: JsonValue, path?: ValuePath): HostAssertion {
  return { id, label, kind: "includes", expected, path };
}

function matches(id: string, label: string, pattern: string, path?: ValuePath): HostAssertion {
  return { id, label, kind: "matches", pattern, path };
}

function throws(id: string, label: string): HostAssertion {
  return { id, label, kind: "throws" };
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
        label: "Combines a one-hot input with an empty hidden state",
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
          length("state-width", "Return one value for each hidden unit", 2),
          range("activated-input", "Apply tanh to the active input", 0.7, 0.8, [0]),
          equal("inactive-unit", "Leaves the inactive unit at zero", 0, [1]),
        ],
      },
      {
        id: "non-empty-recurrent-state",
        label: "Carries information from the previous hidden state",
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
      {
        id: "non-zero-bias",
        label: "Adds the learned bias before the nonlinearity",
        args: [
          [0, 0],
          [0, 0],
          {
            Wxh: [[0, 0], [0, 0]],
            Whh: [[0, 0], [0, 0]],
            bias: [0.5, -0.25],
          },
        ],
        assertions: [
          range("positive-bias", "Add bias[0] before tanh instead of dropping the bias term", 0.4621, 0.4622, [0]),
          range("negative-bias", "Add bias[1] before tanh instead of dropping the bias term", -0.245, -0.2449, [1]),
        ],
      },
      {
        id: "off-diagonal-projections",
        label: "Uses every matrix column in both projections",
        args: [
          [1, 0],
          [0.5, -1],
          {
            Wxh: [[0, 1], [2, 0]],
            Whh: [[1, -1], [0.5, 0.5]],
            bias: [0.25, -0.25],
          },
        ],
        assertions: [
          range("mixed-first-unit", "Use the full Wxh and Whh rows, including off-diagonal weights, before tanh", 0.9413, 0.9414, [0]),
          range("mixed-second-unit", "Use the full Wxh and Whh rows, including off-diagonal weights, before tanh", 0.9051, 0.9052, [1]),
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
          finite("finite-loss", "Return a finite loss"),
          range("low-loss", "Apply -log to the target probability to get the expected low loss", 0.22, 0.23),
        ],
      },
      {
        id: "low-target-probability",
        label: "Assigns higher loss to the unlikely target",
        args: [[0.8, 0.1, 0.1], 1],
        assertions: [range("high-loss", "Use the probability at targetIndex, not the largest probability", 2.3, 2.31)],
      },
      {
        id: "first-target-index",
        label: "Scores a target at the beginning of the vocabulary",
        args: [[0.7, 0.2, 0.1], 0],
        assertions: [range("first-target-loss", "Read probabilities[targetIndex] instead of assuming a fixed target slot", 0.35, 0.36)],
      },
      {
        id: "last-target-index",
        label: "Scores a target at the end of the vocabulary",
        args: [[0.45, 0.45, 0.1], 2],
        assertions: [range("last-target-loss", "Read probabilities[targetIndex] instead of assuming a fixed target slot", 2.3, 2.31)],
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
        label: "Clips both ends and leaves in-range gradients alone",
        args: [[-12, -2, 0, 3, 20], 5],
        assertions: [equal("clipped-values", "Clamp both negative and positive gradients to the symmetric limit", [-5, -2, 0, 3, 5])],
      },
      {
        id: "caller-supplied-limit",
        label: "Uses the clipping limit passed in by the caller",
        args: [[-7, -1, 4, 9], 3],
        assertions: [equal("alternate-limit", "Clamp with the limit you were given instead of hard-coding the default value 5", [-3, -1, 3, 3])],
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
        label: "Keeps large, equally shifted logits finite",
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
        label: "Turns equal logits into a uniform distribution",
        args: [[5, 5, 5, 5]],
        assertions: [
          equal("uniform-probabilities", "Exponentiate relative scores before normalizing so equal scores get equal probability", [0.25, 0.25, 0.25, 0.25]),
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
        assertions: [equal("averaged-vector", "Average every selected row one coordinate at a time; don't return just the first row or the sum", [1, 2])],
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
      {
        id: "first-target-index",
        label: "Scores a target at the beginning of the vocabulary",
        args: [[0.8, 0.1, 0.1], 0],
        assertions: [range("first-target-loss", "Use probabilities[targetIndex] instead of assuming the target is always at index 1", 0.22, 0.23)],
      },
      {
        id: "last-target-index",
        label: "Scores a target at the end of the vocabulary",
        args: [[0.45, 0.45, 0.1], 2],
        assertions: [range("last-target-loss", "Use probabilities[targetIndex] instead of assuming the target is always at index 1", 2.3, 2.31)],
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
          "s", "i", "g",
        ], ["s", "i"]]],
        assertions: [
          equal("si-frequency", "Use json.dumps([left, right], separators=(\",\", \":\")) so the visible key [\"s\",\"i\"] is counted twice", 2, ['["s","i"]']),
          equal("ig-frequency", "Count every adjacent position in every word, including [\"i\",\"g\"]", 1, ['["i","g"]']),
        ],
      },
      {
        id: "overlapping-positions",
        label: "Counts overlapping candidate positions before any merge occurs",
        args: [[[
          "a", "a", "a",
        ]]],
        assertions: [
          equal("overlapping-aa-frequency", "Advance one position while counting; [\"a\",\"a\"] occurs at indices 0 and 1", 2, ['["a","a"]']),
        ],
      },
      {
        id: "unambiguous-pair-identity",
        label: "Keeps different symbol boundaries separate",
        args: [[[
          "a", "bc",
        ], ["ab", "c"]]],
        assertions: [
          equal("left-boundary", "Encode the two-symbol list with json.dumps; do not concatenate symbols into an ambiguous key", 1, ['["a","bc"]']),
          equal("right-boundary", "Keep [\"ab\",\"c\"] separate from [\"a\",\"bc\"]", 1, ['["ab","c"]']),
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
        args: [["s", "i", "g", "n", "a", "l"], ["s", "i"]],
        assertions: [equal("merged-symbols", "Merge the selected neighbors and keep every surrounding symbol in order", ["si", "g", "n", "a", "l"])],
      },
      {
        id: "repeated-selected-pair",
        label: "Merges every occurrence in the symbol sequence",
        args: [["a", "b", "x", "a", "b"], ["a", "b"]],
        assertions: [equal("all-occurrences", "Continue scanning after the first match so every selected pair is replaced", ["ab", "x", "ab"])],
      },
      {
        id: "non-overlapping-replacement",
        label: "Consumes a matched pair exactly once",
        args: [["a", "a", "a"], ["a", "a"]],
        assertions: [equal("non-overlapping-output", "After a match, skip the consumed right symbol; three a symbols become [\"aa\",\"a\"]", ["aa", "a"])],
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
        args: ["signaling", [["s", "i"], ["si", "g"], ["sig", "n"], ["i", "n"], ["in", "g"]]],
        assertions: [equal("encoded-tokens", "Apply each learned merge in array order to produce the trained segmentation", ["sign", "a", "l", "ing"])],
      },
      {
        id: "order-sensitive-replay",
        label: "Does not revisit an earlier merge after a later merge creates its input",
        args: ["abc", [["ab", "c"], ["a", "b"]]],
        assertions: [equal("single-ordered-pass", "Replay each learned merge once in order; [ab,c] is unavailable before [a,b], so the result remains [\"ab\",\"c\"]", ["ab", "c"])],
      },
      {
        id: "repeated-pair-in-word",
        label: "Applies one learned merge everywhere it matches",
        args: ["abab", [["a", "b"]]],
        assertions: [equal("all-word-occurrences", "Scan the full word for the current merge, not only its first occurrence", ["ab", "ab"])],
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
        id: "query-projection",
        label: "Uses the learned query projection and output vector",
        args: [
          [1, 2],
          [3, -1],
          {
            Wq: [[2, 0], [0, -1]],
            Wk: [[0, 0], [0, 0]],
            v: [1, 0.5],
            bias: [0, 0],
          },
        ],
        assertions: [
          range("query-score", "Project query with Wq, apply tanh, then collapse the hidden vector with v", 0.482, 0.48203),
        ],
      },
      {
        id: "key-projection",
        label: "Uses the learned key projection and keeps the output vector's signs",
        args: [
          [0, 0],
          [1, 2],
          {
            Wq: [[0, 0], [0, 0]],
            Wk: [[1, 0], [0, 0.5]],
            v: [0.25, -1],
            bias: [0, 0],
          },
        ],
        assertions: [
          range("key-score", "Project the key with Wk and keep the sign of every component in v", -0.57121, -0.57118),
        ],
      },
      {
        id: "bias-and-nonlinearity",
        label: "Applies bias and tanh inside the additive scoring network",
        args: [
          [0, 0],
          [0, 0],
          {
            Wq: [[0, 0], [0, 0]],
            Wk: [[0, 0], [0, 0]],
            v: [1, -2],
            bias: [2, -1],
          },
        ],
        assertions: [
          range("nonlinear-bias-score", "Add bias before tanh; additive attention is not a plain query-key dot product", 2.4872, 2.48723),
        ],
      },
      {
        id: "off-diagonal-projections",
        label: "Uses off-diagonal query and key projection weights",
        args: [
          [1, 2],
          [3, 1],
          {
            Wq: [[0, 0.2], [0.3, 0]],
            Wk: [[0, 0.1], [0.2, 0]],
            v: [0.7, -0.4],
            bias: [0.05, -0.05],
          },
        ],
        assertions: [
          range("off-diagonal-score", "Apply full matrix-vector projections; each output unit can depend on every input coordinate", 0.0739, 0.074),
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
        label: "Turns all source-position scores into one distribution",
        args: [[2, 1, 0]],
        assertions: [
          range("largest-weight", "Apply one softmax across the whole scores array so the three source-position weights add up to 1", 0.66524, 0.66525, [0]),
          range("middle-weight", "Apply one softmax across the whole scores array so the three source-position weights add up to 1", 0.24472, 0.24474, [1]),
          range("smallest-weight", "Apply one softmax across the whole scores array so the three source-position weights add up to 1", 0.09002, 0.09004, [2]),
        ],
      },
      {
        id: "negative-scores",
        label: "Handles negative scores as logits rather than raw proportions",
        args: [[-1, 0, 1]],
        assertions: [
          range("negative-low", "Exponentiate relative scores with softmax; do not divide raw scores by their sum", 0.09002, 0.09004, [0]),
          range("negative-middle", "Exponentiate relative scores with softmax; do not divide raw scores by their sum", 0.24472, 0.24474, [1]),
          range("negative-high", "Exponentiate relative scores with softmax; do not divide raw scores by their sum", 0.66524, 0.66525, [2]),
        ],
      },
      {
        id: "large-logits",
        label: "Keeps softmax finite for large compatibility scores",
        args: [[1000, 999, 998]],
        assertions: [
          range("stable-largest", "Subtract max(scores) before exponentiating so large logits remain finite", 0.66524, 0.66525, [0]),
          range("stable-middle", "Subtract max(scores) before exponentiating so large logits remain finite", 0.24472, 0.24474, [1]),
          range("stable-smallest", "Subtract max(scores) before exponentiating so large logits remain finite", 0.09002, 0.09004, [2]),
        ],
      },
      {
        id: "two-source-positions",
        label: "Normalizes a two-position source sequence",
        args: [[0, 0]],
        assertions: [
          length("two-position-width", "Return one alignment weight for each source position", 2),
          equal("two-position-uniform", "Normalize the whole two-position score array", [0.5, 0.5]),
        ],
      },
      {
        id: "four-source-positions",
        label: "Normalizes a four-position source sequence",
        args: [[3, 2, 1, 0]],
        assertions: [
          length("four-position-width", "Return one alignment weight for each source position", 4),
          range("four-position-largest", "Apply softmax across all four source positions", 0.6439, 0.644, [0]),
          range("four-position-smallest", "Apply softmax across all four source positions", 0.032, 0.0321, [3]),
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
        assertions: [equal("context", "Multiply each state by its corresponding alpha, then sum coordinate-wise", [0.75, 0.25])],
      },
      {
        id: "three-state-context",
        label: "Keeps each state matched with its weight across every coordinate",
        args: [[[1, 2, 3], [-1, 4, 0], [2, 0, -2]], [0.5, 0.25, 0.25]],
        assertions: [equal("three-state-context", "Multiply each state by its corresponding alpha, then sum coordinate-wise", [0.75, 2, 1])],
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
        label: "Keeps visible logits and blocks future logits",
        args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]],
        assertions: [
          equal("first-visible-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", 1, [0, 0]),
          equal("first-future-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", negativeInfinity, [0, 1]),
          equal("second-future-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", negativeInfinity, [1, 2]),
          equal("last-visible-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", 9, [2, 2]),
        ],
      },
      {
        id: "past-and-diagonal-remain-visible",
        label: "Keeps every past and diagonal score unchanged",
        args: [[[11, 12, 13, 14], [21, 22, 23, 24], [31, 32, 33, 34], [41, 42, 43, 44]]],
        assertions: [
          equal("deep-past-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", 31, [2, 0]),
          equal("near-past-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", 42, [3, 1]),
          equal("middle-diagonal-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", 33, [2, 2]),
          equal("far-future-logit", "Keep diagonal and past logits unchanged; write -Infinity only where column > row", negativeInfinity, [0, 3]),
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
        label: "Weights values by their scaled query-key match",
        args: [[1, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]]],
        assertions: [
          length("output-width", "Keep the value width", 2),
          range("aligned-value", "Divide query-key scores by sqrt(query width) before softmax, then mix the value rows", 1.33, 1.35, [0]),
          range("other-value", "Divide query-key scores by sqrt(query width) before softmax, then mix the value rows", 0.65, 0.67, [1]),
        ],
      },
      {
        id: "key-width-controls-scaling",
        label: "Uses d_k, not the key count, and returns a value-shaped mix",
        args: [[1, 1, 1, 1], [[1, 0, 0, 0], [0, 0, 0, 0]], [[2, 0, 4], [0, 2, -2]]],
        assertions: [
          length("value-width", "Return the weighted value vector, not the attention probabilities", 3),
          range("scaled-first-coordinate", "Divide query-key scores by sqrt(query width), not sqrt(number of keys), before softmax", 1.244, 1.246, [0]),
          range("weighted-second-coordinate", "Use every softmax probability to mix value rows; do not return only the winner or the mean", 0.754, 0.756, [1]),
          range("weighted-third-coordinate", "Use every softmax probability to mix value rows; do not return only the winner or the mean", 1.734, 1.736, [2]),
        ],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "transformers",
    blockId: "layer-norm",
    label: "Non-affine layer normalization",
    exportName: "layerNorm",
    cases: [
      {
        id: "four-feature-vector",
        label: "Centers and scales one token vector",
        args: [[1, 2, 3, 4]],
        assertions: [
          length("normalized-width", "Keep the feature width", 4),
          range("first-feature", "Subtract the feature mean, then divide by sqrt(variance + epsilon)", -1.342, -1.341, [0]),
          range("second-feature", "Subtract the feature mean, then divide by sqrt(variance + epsilon)", -0.448, -0.447, [1]),
          range("third-feature", "Subtract the feature mean, then divide by sqrt(variance + epsilon)", 0.447, 0.448, [2]),
          range("fourth-feature", "Subtract the feature mean, then divide by sqrt(variance + epsilon)", 1.341, 1.342, [3]),
        ],
      },
      {
        id: "constant-vector",
        label: "Keeps a zero-variance vector finite",
        args: [[5, 5, 5], 0.00001],
        assertions: [
          length("constant-width", "Keep the feature width", 3),
          finite("constant-first-finite", "Subtracting the mean gives zeros; epsilon inside sqrt(variance + epsilon) keeps division finite", [0]),
          equal("constant-values", "Subtracting the mean gives zeros; epsilon inside sqrt(variance + epsilon) keeps division finite", [0, 0, 0]),
        ],
      },
      {
        id: "caller-supplied-epsilon",
        label: "Uses a large epsilon passed in for a nonconstant vector",
        args: [[1, 3], 1],
        assertions: [
          range("large-epsilon-first", "Use the epsilon you were given inside sqrt(variance + epsilon) instead of hard-coding the default", -0.708, -0.707, [0]),
          range("large-epsilon-second", "Use the epsilon you were given inside sqrt(variance + epsilon) instead of hard-coding the default", 0.707, 0.708, [1]),
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
        args: [[{ input: "first review", label: "M" }, { input: "second review", label: "K" }]],
        assertions: [equal("formatted-text", "Keep the examples in order and use Input then Label with one blank line between records", "Input: first review\nLabel: M\n\nInput: second review\nLabel: K")],
      },
      {
        id: "trimmed-and-empty-inputs",
        label: "Trims field edges without dropping an empty input record",
        args: [[{ input: "  spaced review  ", label: " K " }, { input: "   ", label: "M" }]],
        assertions: [equal("empty-input-record", "Trim the input and label edges, keep every record, and put exactly one blank line between them", "Input: spaced review\nLabel: K\n\nInput: \nLabel: M")],
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
        label: "Builds a zero-shot prompt without adding a fake example",
        args: [{ instruction: "  Return K or M.  ", demonstrations: "   \n ", query: "  The same held-out review.  " }],
        assertions: [equal("prompt", "Keep the trimmed instruction, omit a whitespace-only demonstration section, and finish the held-out query with Label:", "Return K or M.\n\nInput: The same held-out review.\nLabel:")],
      },
      {
        id: "one-shot-prompt",
        label: "Adds one demonstration between the fixed instruction and query",
        args: [{ instruction: "Return K or M.", demonstrations: "\nInput: Example one.\nLabel: K\n", query: "The same held-out review." }],
        assertions: [equal("one-shot-sections", "Keep instruction, one demonstration, and the held-out query as three blank-line-separated sections", "Return K or M.\n\nInput: Example one.\nLabel: K\n\nInput: The same held-out review.\nLabel:")],
      },
      {
        id: "few-shot-prompt",
        label: "Keeps a multi-example demo block together",
        args: [{ instruction: "Return K or M.", demonstrations: "Input: Example one.\nLabel: K\n\nInput: Example two.\nLabel: M", query: "The same held-out review." }],
        assertions: [equal("few-shot-sections", "Change only the demo block; keep the instruction and final held-out query exactly the same", "Return K or M.\n\nInput: Example one.\nLabel: K\n\nInput: Example two.\nLabel: M\n\nInput: The same held-out review.\nLabel:")],
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
      {
        id: "wrong-allowed-label",
        label: "Extracts a wrong allowed label before comparing with gold",
        args: ["M", "K"],
        assertions: [equal("wrong-label", "Extract the prediction independently, then compare it with expected", { predicted: "M", passed: false })],
      },
      {
        id: "first-standalone-label",
        label: "Uses the first standalone allowed label when both appear",
        args: ["K, then M", "M"],
        assertions: [equal("first-label", "Extract the first standalone allowed label; expected must not choose the prediction", { predicted: "K", passed: false })],
      },
      {
        id: "embedded-label",
        label: "Rejects allowed letters embedded inside words",
        args: ["MARK is not a standalone label.", "K"],
        assertions: [equal("word-boundary", "Require a standalone allowed label rather than a matching character inside a word", { predicted: null, passed: false })],
      },
      {
        id: "lowercase-label",
        label: "Keeps the allowed label's capitalization exact",
        args: ["the label is k", "K"],
        assertions: [equal("label-case", "Do not normalize model output casing during exact-match extraction", { predicted: null, passed: false })],
      },
      {
        id: "no-label",
        label: "Returns null when no allowed label appears",
        args: ["I cannot decide.", "M"],
        assertions: [equal("missing-label", "Return null and fail when no standalone allowed label is generated", { predicted: null, passed: false })],
      },
      {
        id: "regex-punctuation-label",
        label: "Treats punctuation in allowed labels as literal text",
        args: ["Prediction: A+.", "A+", ["A+", "B?"]],
        assertions: [equal("literal-label", "Match allowed labels literally instead of interpolating them as regular-expression syntax", { predicted: "A+", passed: true })],
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
        id: "multi-token-output",
        label: "Samples the first generated token from the prefill logits",
        args: [96, 32],
        assertions: [
          equal("prefill-count", "Keep all prompt tokens in the parallel prefill phase", 96, ["prefillTokens"]),
          equal("generated-count", "Report all 32 requested output tokens as generated", 32, ["generatedTokens"]),
          equal("decode-forwards", "Use 31 later decode passes because the prefill logits sample token 1", 31, ["decodeForwards"]),
          equal("processed-positions", "Count the prompt positions plus only the 31 later decode inputs", 127, ["processedTokenPositions"]),
          equal("final-length", "Count prompt plus all generated tokens in the final sequence", 128, ["finalSequenceLength"]),
        ],
      },
      {
        id: "one-token-output",
        label: "Gets one token straight from the prefill logits",
        args: [12, 1],
        assertions: [
          equal("single-generated", "Report the one token sampled from the prefill logits", 1, ["generatedTokens"]),
          equal("no-followup-decode", "Use zero later decode passes for a one-token output", 0, ["decodeForwards"]),
          equal("single-processed-positions", "Do not count the final sampled token as another processed input", 12, ["processedTokenPositions"]),
          equal("single-final-length", "Include the sampled token in final sequence length", 13, ["finalSequenceLength"]),
        ],
      },
      {
        id: "zero-token-output",
        label: "Stops the later decode count at zero",
        args: [7, 0],
        assertions: [
          equal("zero-generated", "Report zero generated tokens for a zero-token budget", 0, ["generatedTokens"]),
          equal("nonnegative-decode", "Clamp maxNewTokens - 1 so decode forwards never become negative", 0, ["decodeForwards"]),
          equal("zero-processed-positions", "Keep processed positions at the prompt length", 7, ["processedTokenPositions"]),
          equal("zero-final-length", "Keep final sequence length at the prompt length", 7, ["finalSequenceLength"]),
        ],
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
        id: "key-and-value",
        label: "Stores both a key and a value",
        args: [{ layers: 1, kvHeads: 1, headDimension: 1, tokens: 1, bytesPerValue: 1 }],
        assertions: [equal("key-value-factor", "Multiply by 2 because every cached position stores both key and value", 2)],
      },
      {
        id: "all-layers",
        label: "Sets aside cache at every Transformer layer",
        args: [{ layers: 3, kvHeads: 1, headDimension: 1, tokens: 1, bytesPerValue: 1 }],
        assertions: [equal("layer-factor", "Scale the key and value cache by all 3 layers", 6)],
      },
      {
        id: "kv-heads-not-query-heads",
        label: "Uses the grouped-query model's number of KV heads",
        args: [{ layers: 1, kvHeads: 5, headDimension: 1, tokens: 1, bytesPerValue: 1 }],
        assertions: [equal("kv-head-factor", "Scale by kvHeads; do not assume this equals the query-head count", 10)],
      },
      {
        id: "token-and-head-shape",
        label: "Stores one head vector per cached token",
        args: [{ layers: 1, kvHeads: 1, headDimension: 4, tokens: 7, bytesPerValue: 1 }],
        assertions: [equal("token-head-factor", "Multiply cached token length by headDimension", 56)],
      },
      {
        id: "storage-width",
        label: "Converts cached scalar count to bytes",
        args: [{ layers: 1, kvHeads: 1, headDimension: 1, tokens: 1, bytesPerValue: 4 }],
        assertions: [equal("bytes-per-value", "Multiply scalar count by bytesPerValue; FP32 uses twice the bytes of FP16", 8)],
      },
      {
        id: "fp16-cache",
        label: "Puts every factor together for an FP16 cache",
        args: [{ layers: 4, kvHeads: 8, headDimension: 16, tokens: 100, bytesPerValue: 2 }],
        assertions: [equal("complete-byte-count", "Use 2 × layers × KV heads × tokens × head dimension × bytes per value", 204800)],
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
        label: "Turns a token event and JSON payload into an SSE frame",
        args: ["token", { delta: "hi" }],
        assertions: [
          matches("event-line", "Begin the frame with the requested event: field", "^event: token\\n"),
          includes("json-data-line", "Serialize the payload with json.dumps on a data: line", "data: {\"delta\":\"hi\"}\n"),
          matches("blank-line", "Terminate the frame with a final blank line (\\n\\n)", "\\n\\n$"),
        ],
      },
      {
        id: "typed-done-frame",
        label: "Keeps the event type instead of hard-coding token",
        args: ["done", { reason: "stop" }],
        assertions: [equal("done-frame", "Use the event argument for every event type", "event: done\ndata: {\"reason\":\"stop\"}\n\n")],
      },
      {
        id: "escaped-error-payload",
        label: "Escapes payload newlines and quotes without breaking the frame",
        args: ["error", { message: "line 1\n\"quoted\"" }],
        assertions: [equal("escaped-frame", "Let json.dumps escape payload text; do not concatenate object values by hand", "event: error\ndata: {\"message\":\"line 1\\n\\\"quoted\\\"\"}\n\n")],
      },
      {
        id: "injected-event-name",
        label: "Rejects an event name that could inject another field",
        args: ["token\ndata: {\"forged\":true}", { delta: "safe" }],
        assertions: [throws("unsafe-event-name", "Reject event names containing CR or LF before serializing")],
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
        label: "Holds onto an incomplete frame without sending an event",
        args: ["", "event: token\ndata: {\"delta\":\"h"],
        assertions: [equal("partial-result", "Wait for a blank-line delimiter; return no event and keep the partial decoded text", {
          events: [],
          remainder: "event: token\ndata: {\"delta\":\"h",
        })],
      },
      {
        id: "continued-frame",
        label: "Finishes a frame split across two chunks",
        args: ["event: token\ndata: {\"delta\":\"h", "i\"}\n\n"],
        assertions: [equal("complete-result", "Prepend the previous remainder before looking for complete frames", {
          events: [{ event: "token", data: { delta: "hi" } }],
          remainder: "",
        })],
      },
      {
        id: "split-frame-delimiter",
        label: "Finds a blank-line separator split between chunks",
        args: ["event: token\ndata: {\"delta\":\"!\"}\n", "\n"],
        assertions: [equal("split-delimiter-result", "Detect the blank line after combining remainder and chunk, even when each newline arrived separately", {
          events: [{ event: "token", data: { delta: "!" } }],
          remainder: "",
        })],
      },
      {
        id: "multiple-frames-and-remainder",
        label: "Returns every complete frame and keeps only the unfinished ending",
        args: ["", "event: token\ndata: {\"delta\":\"a\"}\n\nevent: done\ndata: {}\n\nevent: metrics\ndata: {\"tok"],
        assertions: [equal("multiple-result", "Process all complete frames in order; do not stop after the first frame", {
          events: [
            { event: "token", data: { delta: "a" } },
            { event: "done", data: {} },
          ],
          remainder: "event: metrics\ndata: {\"tok",
        })],
      },
      {
        id: "default-event-and-tight-fields",
        label: "Handles default message events and fields with no space",
        args: ["", "data:{\"ok\":true}\n\n"],
        assertions: [equal("default-event-result", "Remove at most one optional field-value space and use message when event: is absent", {
          events: [{ event: "message", data: { ok: true } }],
          remainder: "",
        })],
      },
      {
        id: "crlf-frame",
        label: "Reads a JSON event separated with CRLF",
        args: ["", "event: done\r\ndata: {}\r\n\r\n"],
        assertions: [equal("crlf-result", "Treat CRLF blank lines as frame delimiters rather than leaving carriage returns in field values", {
          events: [{ event: "done", data: {} }],
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
        id: "zero-tokens",
        label: "Uses no storage for an empty sequence",
        args: [0, 16],
        assertions: [equal("empty-allocation", "Return zero pages, zero capacity, and zero waste when tokens is zero; do not add a page unconditionally", {
          pages: 0,
          capacity: 0,
          wastedSlots: 0,
        })],
      },
      {
        id: "exact-page-boundary",
        label: "Doesn't add an extra page at an exact boundary",
        args: [32, 16],
        assertions: [
          equal("exact-pages", "Exact multiples need tokens / pageSize pages; do not add an extra page", 2, ["pages"]),
          equal("exact-capacity", "Compute capacity as pages × pageSize", 32, ["capacity"]),
          equal("exact-waste", "Compute wastedSlots as capacity − tokens; an exact multiple wastes zero slots", 0, ["wastedSlots"]),
        ],
      },
      {
        id: "one-over-boundary",
        label: "Adds a final page for the first token past a boundary",
        args: [33, 16],
        assertions: [
          equal("partial-pages", "Use ceiling division so any remainder allocates one final page", 3, ["pages"]),
          equal("partial-capacity", "Compute capacity as pages × pageSize", 48, ["capacity"]),
          equal("partial-waste", "Compute wastedSlots as capacity − tokens", 15, ["wastedSlots"]),
        ],
      },
      {
        id: "bounded-final-page-waste",
        label: "Keeps wasted space inside the unused part of the last page",
        args: [47, 16],
        assertions: [
          equal("bounded-capacity", "Compute capacity as pages × pageSize before measuring waste", 48, ["capacity"]),
          equal("bounded-waste", "Compute wastedSlots as capacity − tokens", 1, ["wastedSlots"]),
          range("less-than-one-page", "Final-page waste must stay between zero and pageSize − 1", 0, 15, ["wastedSlots"]),
        ],
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
        id: "empty-iteration",
        label: "Returns both scheduler lanes for an empty step",
        args: [[]],
        assertions: [equal("empty-lanes", "Return separate active and completed arrays so the scheduler can keep the IDs of finished requests", {
          active: [],
          completed: [],
        })],
      },
      {
        id: "advance-every-request",
        label: "Moves every eligible request forward exactly once",
        args: [[
          { id: "a", remaining: 2, generated: 0, tenant: "red" },
          { id: "b", remaining: 3, generated: 4, tenant: "blue" },
        ]],
        assertions: [equal("all-active", "Move every request with work left forward by exactly one token, and keep its order and metadata", [
          { id: "a", remaining: 1, generated: 1, tenant: "red" },
          { id: "b", remaining: 2, generated: 5, tenant: "blue" },
        ], ["active"])],
      },
      {
        id: "route-completed-request",
        label: "Separates newly finished work without losing its ID",
        args: [[
          { id: "a", remaining: 1, generated: 0, pages: [2, 7] },
          { id: "b", remaining: 3, generated: 2, pages: [4] },
        ]],
        assertions: [
          equal("surviving-active", "Keep advanced requests with remaining work in active", [
            { id: "b", remaining: 2, generated: 3, pages: [4] },
          ], ["active"]),
          equal("completed-identity", "Move a request that reaches zero into completed with its ID and metadata intact so pages and latency can still be counted", [
            { id: "a", remaining: 0, generated: 1, pages: [2, 7] },
          ], ["completed"]),
        ],
      },
      {
        id: "already-zero-and-one-token",
        label: "Doesn't decode work that was already finished",
        args: [[
          { id: "already-done", remaining: 0, generated: 8, finishedAt: 12 },
          { id: "last-token", remaining: 1, generated: 5, finishedAt: null },
        ]],
        assertions: [
          equal("no-active-work", "A zero-token and one-token mix leaves no request active after this iteration", [], ["active"]),
          equal("zero-token-unchanged", "Don't increment a request that already had no work left; keep its metadata, then add the request finished in this step", [
            { id: "already-done", remaining: 0, generated: 8, finishedAt: 12 },
            { id: "last-token", remaining: 0, generated: 6, finishedAt: null },
          ], ["completed"]),
        ],
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
        label: "Retries the first temporary failure before any output appears",
        args: [{ transient: true, tokensEmitted: 0, attempt: 0 }],
        assertions: [equal("retry", "Return true when the first attempt failed transiently, emitted nothing, and the default two-attempt budget has room", true)],
      },
      {
        id: "permanent-before-output",
        label: "Doesn't retry a permanent failure before visible output",
        args: [{ transient: false, tokensEmitted: 0, attempt: 0, maxAttempts: 3 }],
        assertions: [equal("permanent-no-retry", "Return false for a non-transient failure even when no token is visible and attempts remain", false)],
      },
      {
        id: "transient-after-output",
        label: "Stops automatic retries once output is visible",
        args: [{ transient: true, tokensEmitted: 1, attempt: 0, maxAttempts: 3 }],
        assertions: [equal("no-retry", "Return false once tokensEmitted is greater than zero; retrying could duplicate text the user already saw", false)],
      },
      {
        id: "second-of-two-attempts",
        label: "Rejects a retry from the second attempt in a two-attempt budget",
        args: [{ transient: true, tokensEmitted: 0, attempt: 1, maxAttempts: 2 }],
        assertions: [equal("bounded-retry", "Treat attempt as zero-based and maxAttempts as the total budget: attempt 1 is already the second and final attempt when maxAttempts is 2", false)],
      },
      {
        id: "single-attempt-budget",
        label: "Respects a one-attempt limit",
        args: [{ transient: true, tokensEmitted: 0, attempt: 0, maxAttempts: 1 }],
        assertions: [equal("single-attempt", "Return false when maxAttempts is 1 because the initial attempt consumed the entire budget", false)],
      },
      {
        id: "custom-three-attempt-budget",
        label: "Respects a larger custom attempt limit",
        args: [{ transient: true, tokensEmitted: 0, attempt: 1, maxAttempts: 3 }],
        assertions: [equal("custom-budget", "Use the maxAttempts value you were given: attempt 1 may retry once when the total limit is 3", true)],
      },
      {
        id: "default-two-attempt-boundary",
        label: "Applies the default two-attempt limit at the boundary",
        args: [{ transient: true, tokensEmitted: 0, attempt: 1 }],
        assertions: [equal("default-budget", "Apply the default maxAttempts of 2, making zero-based attempt 1 the final attempt", false)],
      },
    ],
  }),
  defineExerciseContract({
    lessonId: "reliability-observability",
    blockId: "terminal-guard",
    label: "Finished-request guard",
    exportName: "acceptEvent",
    cases: [
      {
        id: "late-completion-event",
        label: "Ignores an event after the request finishes",
        args: [{ attemptId: "a1", requestId: "r1", status: "complete" }, { attemptId: "a1", requestId: "r1" }],
        assertions: [equal("late-rejected", "Return false after complete; a finished request can't accept another event", false)],
      },
      {
        id: "late-error-event",
        label: "Ignores an event after an error",
        args: [{ attemptId: "a1", requestId: "r1", status: "error" }, { attemptId: "a1", requestId: "r1" }],
        assertions: [equal("error-rejected", "Return false after error; a finished request can't accept another event", false)],
      },
      {
        id: "late-cancel-event",
        label: "Ignores an event after cancellation",
        args: [{ attemptId: "a1", requestId: "r1", status: "cancelled" }, { attemptId: "a1", requestId: "r1" }],
        assertions: [equal("cancel-rejected", "Return false after cancelled; a finished request can't accept another event", false)],
      },
      {
        id: "matching-active-event",
        label: "Accepts an event for the active attempt and transport",
        args: [{ attemptId: "a2", requestId: "r2", status: "streaming" }, { attemptId: "a2", requestId: "r2" }],
        assertions: [equal("active-accepted", "Return true for matching attempt and transport identities while the request is streaming", true)],
      },
      {
        id: "matching-prefill-event",
        label: "Accepts an event during an active phase before the first token",
        args: [{ attemptId: "a2", requestId: "r2", status: "prefill" }, { attemptId: "a2", requestId: "r2" }],
        assertions: [equal("prefill-accepted", "Treat prefill as active when the event carries matching attempt and transport identities", true)],
      },
      {
        id: "stale-attempt-event",
        label: "Ignores an old attempt even when the request and transport match",
        args: [
          { logicalRequestId: "logical-201", attemptId: "a-201.2", requestId: "transport-201", status: "streaming" },
          { logicalRequestId: "logical-201", attemptId: "a-201.1", requestId: "transport-201" },
        ],
        assertions: [equal("stale-rejected", "Compare request.attemptId with event.attemptId; sharing one logical request ID must not let an old attempt change the active one", false)],
      },
      {
        id: "stale-transport-event",
        label: "Ignores an event from an old transport in the active attempt",
        args: [
          { attemptId: "a2", requestId: "transport-2", status: "streaming" },
          { attemptId: "a2", requestId: "transport-1" },
        ],
        assertions: [equal("transport-rejected", "Compare request.requestId with event.requestId so each attempt stays tied to the right transport", false)],
      },
      {
        id: "unknown-state-event",
        label: "Ignores an event in an unknown inactive state",
        args: [{ attemptId: "a2", requestId: "r2", status: "reconnecting" }, { attemptId: "a2", requestId: "r2" }],
        assertions: [equal("unknown-rejected", "Accept only the known active states queued, loading, prefill, and streaming; return false for unknown states", false)],
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
        id: "message-defaults",
        label: "Creates a message with clear defaults",
        args: [{ id: "m-user-9", role: "user" }],
        assertions: [equal("message-defaults", "Return only the standard fields. Start with empty content, complete status, null attemptId and requestId, and createdAt set to zero", {
          id: "m-user-9",
          role: "user",
          content: "",
          status: "complete",
          attemptId: null,
          requestId: null,
          createdAt: 0,
        })],
      },
      {
        id: "supplied-streaming-message",
        label: "Keeps the content and status it was given",
        args: [{ id: "m-assistant-27", role: "assistant", content: "A causal", status: "streaming", attemptId: "a-27.2", requestId: "r-27.2" }],
        assertions: [equal("supplied-fields", "Keep the message, attempt, and request IDs along with their content and status", {
          id: "m-assistant-27",
          role: "assistant",
          content: "A causal",
          status: "streaming",
          attemptId: "a-27.2",
          requestId: "r-27.2",
          createdAt: 0,
        })],
      },
      {
        id: "stable-field-set",
        label: "Keeps saved message data separate from its render position",
        args: [{ id: "stable-id-not-index-2", role: "system", content: "Be concise.", status: "complete", renderIndex: 2 }],
        assertions: [equal("stable-record", "Copy only the stable ID and four message fields. Don't save renderIndex or other caller-only data", {
          id: "stable-id-not-index-2",
          role: "system",
          content: "Be concise.",
          status: "complete",
          attemptId: null,
          requestId: null,
          createdAt: 0,
        })],
      },
      {
        id: "serializable-record",
        label: "Returns stable JSON data",
        args: [{ id: "m1", role: "assistant", status: "streaming", attemptId: "a1", requestId: "r1" }],
        assertions: [equal("message", "Use the stable numeric createdAt value from the reference record", {
          id: "m1",
          role: "assistant",
          content: "",
          status: "streaming",
          attemptId: "a1",
          requestId: "r1",
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
        id: "targeted-middle-message",
        label: "Updates only the active attempt and request that match",
        args: [[
          { id: "before", attemptId: "a0", requestId: "r0", content: "keep", status: "streaming" },
          { id: "a", attemptId: "a1", requestId: "r1", content: "Hel", status: "streaming" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "fixed", status: "complete" },
        ], { messageId: "a", attemptId: "a1", requestId: "r1", delta: "lo" }],
        assertions: [equal("messages", "Match messageId, attemptId, and requestId, append the delta, and leave every other record alone", [
          { id: "before", attemptId: "a0", requestId: "r0", content: "keep", status: "streaming" },
          { id: "a", attemptId: "a1", requestId: "r1", content: "Hello", status: "streaming" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "fixed", status: "complete" },
        ])],
      },
      {
        id: "completed-target",
        label: "Ignores a delta for a non-streaming target",
        args: [[
          { id: "a", attemptId: "a1", requestId: "r1", content: "finished", status: "complete" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "still here", status: "streaming" },
        ], { messageId: "a", attemptId: "a1", requestId: "r1", delta: " late" }],
        assertions: [equal("completed-unchanged", "Check that the matching message is streaming before appending; completed output must ignore late deltas", [
          { id: "a", attemptId: "a1", requestId: "r1", content: "finished", status: "complete" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "still here", status: "streaming" },
        ])],
      },
      {
        id: "stale-attempt",
        label: "Ignores a late delta from an old generation attempt",
        args: [[
          { id: "a", attemptId: "a2", requestId: "r2", content: "new", status: "streaming" },
        ], { messageId: "a", attemptId: "a1", requestId: "r2", delta: " stale" }],
        assertions: [equal("stale-attempt-unchanged", "Reject the event when attemptId does not match the message's active attempt", [
          { id: "a", attemptId: "a2", requestId: "r2", content: "new", status: "streaming" },
        ])],
      },
      {
        id: "stale-request",
        label: "Ignores a late delta from an old transport request",
        args: [[
          { id: "a", attemptId: "a2", requestId: "r2", content: "new", status: "streaming" },
        ], { messageId: "a", attemptId: "a2", requestId: "r1", delta: " stale" }],
        assertions: [equal("stale-request-unchanged", "Reject the event when requestId does not match the active transport lifecycle", [
          { id: "a", attemptId: "a2", requestId: "r2", content: "new", status: "streaming" },
        ])],
      },
      {
        id: "missing-target",
        label: "Ignores a delta for an unknown message id",
        args: [[
          { id: "a", attemptId: "a1", requestId: "r1", content: "one", status: "streaming" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "two", status: "complete" },
        ], { messageId: "missing", attemptId: "a1", requestId: "r1", delta: "!" }],
        assertions: [equal("missing-unchanged", "Leave every record unchanged when messageId is not present", [
          { id: "a", attemptId: "a1", requestId: "r1", content: "one", status: "streaming" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "two", status: "complete" },
        ])],
      },
      {
        id: "empty-delta",
        label: "Handles an empty transport delta",
        args: [[
          { id: "a", attemptId: "a1", requestId: "r1", content: "partial", status: "streaming" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "fixed", status: "complete" },
        ], { messageId: "a", attemptId: "a1", requestId: "r1", delta: "" }],
        assertions: [equal("empty-append", "Treat an empty delta as ordinary string concatenation without changing content or status", [
          { id: "a", attemptId: "a1", requestId: "r1", content: "partial", status: "streaming" },
          { id: "b", attemptId: "a2", requestId: "r2", content: "fixed", status: "complete" },
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
        label: "Flushes every queued delta in the exact order it arrived",
        args: [["Hel", "lo", " ", "world"]],
        assertions: [equal("flushed-buffer", "Join every queued delta with no inserted separator, then return a fresh empty remaining queue", {
          text: "Hello world",
          remaining: [],
        })],
      },
      {
        id: "whitespace-and-unicode",
        label: "Keeps empty, whitespace, newline, and Unicode deltas unchanged",
        args: [["", " leading", "\n", "€", " ", "尾"]],
        assertions: [equal("exact-text", "Keep each delta exactly as Python text, including whitespace and Unicode", {
          text: " leading\n€ 尾",
          remaining: [],
        })],
      },
      {
        id: "empty-queue",
        label: "Flushes an empty queue without making up text",
        args: [[]],
        assertions: [equal("empty-flush", "Return empty text and an empty remaining queue when no deltas are pending", {
          text: "",
          remaining: [],
        })],
      },
      {
        id: "order-is-not-sort-order",
        label: "Keeps arrival order rather than sorting or deduplicating",
        args: [["z", " ", "a", "a"]],
        assertions: [equal("arrival-order", "Do not sort, deduplicate, or otherwise normalize the pending deltas", {
          text: "z aa",
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
        assertions: [equal("follows", "Follow when distanceFromBottom is within the default 80-pixel threshold and the reader has not scrolled up", true)],
      },
      {
        id: "exact-default-boundary",
        label: "Includes the exact default threshold boundary",
        args: [{ distanceFromBottom: 80, userScrolledUp: false }],
        assertions: [equal("inclusive-boundary", "Use distanceFromBottom <= threshold so the exact boundary still follows", true)],
      },
      {
        id: "beyond-default-boundary",
        label: "Stops following beyond the default threshold",
        args: [{ distanceFromBottom: 81, userScrolledUp: false }],
        assertions: [equal("outside-default", "Return false when distanceFromBottom exceeds the default 80-pixel threshold", false)],
      },
      {
        id: "reader-scrolled-up",
        label: "Lets the reader stay in control after scrolling up",
        args: [{ distanceFromBottom: 24, userScrolledUp: true }],
        assertions: [equal("does-not-follow", "Let userScrolledUp override a near-bottom distance so the page never yanks someone away from what they're reading", false)],
      },
      {
        id: "custom-threshold-inside",
        label: "Uses a custom threshold at its boundary",
        args: [{ distanceFromBottom: 12, userScrolledUp: false, threshold: 12 }],
        assertions: [equal("custom-inside", "Use the threshold you were given instead of a fixed 80-pixel value", true)],
      },
      {
        id: "custom-threshold-outside",
        label: "Stops past a custom threshold",
        args: [{ distanceFromBottom: 13, userScrolledUp: false, threshold: 12 }],
        assertions: [equal("custom-outside", "Compare distanceFromBottom with the provided threshold on every call", false)],
      },
      {
        id: "zero-threshold",
        label: "Respects a threshold of exactly zero",
        args: [{ distanceFromBottom: 0, userScrolledUp: false, threshold: 0 }],
        assertions: [equal("zero-boundary", "Do not replace an explicit threshold of zero with the default", true)],
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
        label: "Keeps the required inputs and newest complete turn that fits",
        args: [{
          system: [{ id: "s", role: "system", tokens: 4 }],
          history: [
            { id: "u1", role: "user", status: "complete", tokens: 3 },
            { id: "a1", role: "assistant", status: "complete", tokens: 3 },
            { id: "u2", role: "user", status: "complete", tokens: 4 },
            { id: "a2", role: "assistant", status: "complete", tokens: 4 },
          ],
          activeUser: { id: "u3", role: "user", status: "complete", tokens: 2 },
          budget: 14,
        }],
        assertions: [equal("selection", "Keep the required system and active-user records, add complete pairs from newest to oldest, then return the request in time order", {
          selected: [
            { id: "s", role: "system", tokens: 4 },
            { id: "u2", role: "user", status: "complete", tokens: 4 },
            { id: "a2", role: "assistant", status: "complete", tokens: 4 },
            { id: "u3", role: "user", status: "complete", tokens: 2 },
          ],
          used: 14,
          overflow: false,
        })],
      },
      {
        id: "skip-oversized-newer-turn",
        label: "Skips a newer pair that's too large but still adds an older pair that fits",
        args: [{
          system: [{ id: "s", role: "system", tokens: 2 }],
          history: [
            { id: "u-old", role: "user", status: "complete", tokens: 3 },
            { id: "a-old", role: "assistant", status: "complete", tokens: 3 },
            { id: "u-new", role: "user", status: "complete", tokens: 9 },
            { id: "a-new", role: "assistant", status: "complete", tokens: 9 },
          ],
          activeUser: { id: "u-active", role: "user", status: "complete", tokens: 2 },
          budget: 10,
        }],
        assertions: [equal("continue-after-skip", "When a newer complete pair is too large, keep checking older complete pairs instead of stopping", {
          selected: [
            { id: "s", role: "system", tokens: 2 },
            { id: "u-old", role: "user", status: "complete", tokens: 3 },
            { id: "a-old", role: "assistant", status: "complete", tokens: 3 },
            { id: "u-active", role: "user", status: "complete", tokens: 2 },
          ],
          used: 10,
          overflow: false,
        })],
      },
      {
        id: "never-admit-half-of-pair",
        label: "Drops a complete pair when only one of its messages would fit",
        args: [{
          system: [{ id: "s", role: "system", tokens: 2 }],
          history: [
            { id: "u1", role: "user", status: "complete", tokens: 5 },
            { id: "a1", role: "assistant", status: "complete", tokens: 5 },
          ],
          activeUser: { id: "u-active", role: "user", status: "complete", tokens: 2 },
          budget: 9,
        }],
        assertions: [equal("atomic-turn", "Measure and add the user-assistant pair as one unit. Never keep only one message just because it fits", {
          selected: [
            { id: "s", role: "system", tokens: 2 },
            { id: "u-active", role: "user", status: "complete", tokens: 2 },
          ],
          used: 4,
          overflow: false,
        })],
      },
      {
        id: "exact-budget-multiple-systems",
        label: "Fits multiple system records, one pair, and the active user right at the limit",
        args: [{
          system: [
            { id: "s1", role: "system", tokens: 2 },
            { id: "s2", role: "system", tokens: 1 },
          ],
          history: [
            { id: "u1", role: "user", status: "complete", tokens: 3 },
            { id: "a1", role: "assistant", status: "complete", tokens: 4 },
          ],
          activeUser: { id: "u2", role: "user", status: "complete", tokens: 2 },
          budget: 12,
        }],
        assertions: [equal("inclusive-boundary", "Use <= at the token limit and keep the required system and conversation inputs in order", {
          selected: [
            { id: "s1", role: "system", tokens: 2 },
            { id: "s2", role: "system", tokens: 1 },
            { id: "u1", role: "user", status: "complete", tokens: 3 },
            { id: "a1", role: "assistant", status: "complete", tokens: 4 },
            { id: "u2", role: "user", status: "complete", tokens: 2 },
          ],
          used: 12,
          overflow: false,
        })],
      },
      {
        id: "drops-orphan-half-turns",
        label: "Never adds orphaned, streaming, cancelled, or failed history",
        args: [{
          system: [{ id: "s", role: "system", tokens: 2 }],
          history: [
            { id: "a-orphan", role: "assistant", status: "complete", tokens: 1 },
            { id: "u1", role: "user", status: "complete", tokens: 3 },
            { id: "a1", role: "assistant", status: "complete", tokens: 4 },
            { id: "u-stream", role: "user", status: "complete", tokens: 1 },
            { id: "a-stream", role: "assistant", status: "streaming", tokens: 1 },
            { id: "u-cancel", role: "user", status: "complete", tokens: 1 },
            { id: "a-cancel", role: "assistant", status: "cancelled", tokens: 1 },
            { id: "u-trailing", role: "user", status: "complete", tokens: 1 },
          ],
          activeUser: { id: "u-active", role: "user", status: "complete", tokens: 2 },
          budget: 20,
        }],
        assertions: [equal("complete-pairs-only", "Add only adjacent, fully finished user-assistant pairs, and always keep the active user", {
          selected: [
            { id: "s", role: "system", tokens: 2 },
            { id: "u1", role: "user", status: "complete", tokens: 3 },
            { id: "a1", role: "assistant", status: "complete", tokens: 4 },
            { id: "u-active", role: "user", status: "complete", tokens: 2 },
          ],
          used: 11,
          overflow: false,
        })],
      },
      {
        id: "empty-history",
        label: "Keeps the active user when historical context is empty",
        args: [{
          system: [],
          history: [],
          activeUser: { id: "u-active", role: "user", status: "complete", tokens: 2 },
          budget: 24,
        }],
        assertions: [equal("empty-history", "The active user is required even when the system prompt and history are empty", {
          selected: [{ id: "u-active", role: "user", status: "complete", tokens: 2 }],
          used: 2,
          overflow: false,
        })],
      },
      {
        id: "system-only",
        label: "Returns the required system and active-user inputs unchanged",
        args: [{
          system: [{ id: "s", role: "system", tokens: 5 }],
          history: [],
          activeUser: { id: "u", role: "user", status: "complete", tokens: 2 },
          budget: 7,
        }],
        assertions: [equal("required-inputs", "Put system instructions before the active user and count both required records", {
          selected: [
            { id: "s", role: "system", tokens: 5 },
            { id: "u", role: "user", status: "complete", tokens: 2 },
          ],
          used: 7,
          overflow: false,
        })],
      },
      {
        id: "required-input-overflow",
        label: "Reports when the system and active-user inputs go over budget",
        args: [{
          system: [{ id: "s", role: "system", tokens: 7 }],
          history: [
            { id: "u1", role: "user", status: "complete", tokens: 2 },
            { id: "a1", role: "assistant", status: "complete", tokens: 2 },
          ],
          activeUser: { id: "u-active", role: "user", status: "complete", tokens: 2 },
          budget: 8,
        }],
        assertions: [equal("overflow-signal", "Keep both required inputs, add no history, report the exact usage, and set overflow so the caller can block or revise", {
          selected: [
            { id: "s", role: "system", tokens: 7 },
            { id: "u-active", role: "user", status: "complete", tokens: 2 },
          ],
          used: 9,
          overflow: true,
        })],
      },
      {
        id: "zero-budget-active-user",
        label: "Reports active-user overflow when the budget is zero",
        args: [{
          system: [],
          history: [],
          activeUser: { id: "u", role: "user", status: "complete", tokens: 1 },
          budget: 0,
        }],
        assertions: [equal("zero-budget", "Never drop the required active user just to make an impossible budget look valid", {
          selected: [{ id: "u", role: "user", status: "complete", tokens: 1 }],
          used: 1,
          overflow: true,
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
        label: "Queues a new assistant attempt from the same user message",
        args: [{ messageId: "m9", parentUserId: "m4", attemptId: "a2", requestId: "r2" }],
        assertions: [equal("branch", "Return the queued assistant record with separate message, parent-user, attempt, and request IDs", {
          messageId: "m9",
          parentUserId: "m4",
          attemptId: "a2",
          requestId: "r2",
          role: "assistant",
          content: "",
          status: "queued",
        })],
      },
      {
        id: "second-identity-set",
        label: "Uses a second set of IDs without hidden hard-coded values",
        args: [{ messageId: "assistant-42", parentUserId: "user-17", attemptId: "attempt-8", requestId: "request-8" }],
        assertions: [equal("second-branch", "Use the IDs passed in on every call and keep the queued assistant defaults stable", {
          messageId: "assistant-42",
          parentUserId: "user-17",
          attemptId: "attempt-8",
          requestId: "request-8",
          role: "assistant",
          content: "",
          status: "queued",
        })],
      },
      {
        id: "ignore-caller-only-fields",
        label: "Doesn't copy caller-only fields or overrides into saved state",
        args: [{ messageId: "m10", parentUserId: "m5", attemptId: "a3", requestId: "r3", content: "caller text", status: "complete", renderIndex: 9, modelId: "caller-model" }],
        assertions: [equal("stable-field-set", "Return the four ID fields plus the standard assistant defaults. Ignore renderIndex, modelId, and caller overrides", {
          messageId: "m10",
          parentUserId: "m5",
          attemptId: "a3",
          requestId: "r3",
          role: "assistant",
          content: "",
          status: "queued",
        })],
      },
      {
        id: "punctuated-identities",
        label: "Keeps the exact IDs it was given",
        args: [{ messageId: "m/11", parentUserId: "user:6", attemptId: "attempt.4", requestId: "request/4" }],
        assertions: [equal("opaque-ids", "Treat IDs as opaque values. Don't derive one ID from another", {
          messageId: "m/11",
          parentUserId: "user:6",
          attemptId: "attempt.4",
          requestId: "request/4",
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
    label: "Saved-data check",
    exportName: "validConversationRecord",
    cases: [
      {
        id: "current-safe-record",
        label: "Accepts the current schema with finished messages",
        args: [{
          version: 1,
          id: "c1",
          messages: [
            { id: "u1", role: "user", backend: "local", content: "Explain masking.", status: "complete" },
            { id: "a1", role: "assistant", backend: "local", content: "Future logits are masked.", status: "cancelled", attemptId: "attempt-1", parentUserId: "u1" },
          ],
        }],
        assertions: [equal("safe-record", "Accept the v1 record exactly, including supported optional attempt and parent IDs", true)],
      },
      {
        id: "nested-secret-field",
        label: "Rejects fields that look like secrets inside a message",
        args: [{ version: 1, id: "c1", messages: [{ id: "u1", role: "user", backend: "local", content: "Hello", status: "complete", providerKey: "no" }] }],
        assertions: [equal("nested-secret-rejected", "Allow only the expected message keys so providerKey, apiKey, and any unknown nested field are rejected", false)],
      },
      {
        id: "record-containing-secret",
        label: "Rejects extra top-level fields",
        args: [{ version: 1, id: "c1", messages: [], apiKey: "no" }],
        assertions: [equal("secret-rejected", "Allow only version, id, and messages at the top level. Never save apiKey", false)],
      },
      {
        id: "streaming-message",
        label: "Won't save a message that's still streaming",
        args: [{ version: 1, id: "c1", messages: [{ id: "a1", role: "assistant", backend: "local", content: "partial", status: "streaming" }] }],
        assertions: [equal("streaming-rejected", "Save only complete, cancelled, or failed messages so reloading can't bring back a request that was still running", false)],
      },
      {
        id: "unsupported-message-domain",
        label: "Rejects roles, backends, and statuses it doesn't know",
        args: [{ version: 1, id: "c1", messages: [{ id: "s1", role: "system", backend: "remote", content: "secret", status: "ready" }] }],
        assertions: [equal("domain-rejected", "Accept only user or assistant, student or local, and a supported finished status", false)],
      },
      {
        id: "blank-identities",
        label: "Rejects blank record and message IDs",
        args: [{ version: 1, id: "   ", messages: [{ id: "", role: "user", backend: "local", content: "Hello", status: "complete" }] }],
        assertions: [equal("blank-ids-rejected", "Require non-empty record and message IDs instead of checking only typeof string", false)],
      },
      {
        id: "invalid-optional-identity",
        label: "Checks optional parent IDs when they're present",
        args: [{ version: 1, id: "c1", messages: [{ id: "a1", role: "assistant", backend: "local", content: "Hello", status: "complete", attemptId: "" }] }],
        assertions: [equal("optional-id-rejected", "If attemptId or parentUserId is present, apply the same non-empty, length-limited ID rules", false)],
      },
      {
        id: "oversized-content",
        label: "Rejects a message that's too large",
        args: [{ version: 1, id: "c1", messages: [{ id: "u1", role: "user", backend: "local", content: "x".repeat(20_001), status: "complete" }] }],
        assertions: [equal("content-bound", "Bound each message to at most 20,000 characters before persistence", false)],
      },
      {
        id: "too-many-messages",
        label: "Rejects a conversation with too many messages",
        args: [{ version: 1, id: "c1", messages: Array.from({ length: 201 }, (_, index) => ({ id: `m${index}`, role: "user", backend: "student", content: "x", status: "complete" })) }],
        assertions: [equal("message-count-bound", "Bound one persisted conversation to at most 200 messages", false)],
      },
      {
        id: "oversized-conversation",
        label: "Rejects a conversation that's too large",
        args: [{ version: 1, id: "c1", messages: Array.from({ length: 11 }, (_, index) => ({ id: `m${index}`, role: "user", backend: "student", content: "x".repeat(20_000), status: "complete" })) }],
        assertions: [equal("conversation-character-bound", "Keep every message within 20,000 characters and the full conversation within 200,000 characters", false)],
      },
      {
        id: "non-record-input",
        label: "Rejects arrays and broken top-level values",
        args: [[{ version: 1, id: "c1", messages: [] }]],
        assertions: [equal("plain-record-required", "Require a plain object, not an array or another kind of object", false)],
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
        id: "queued-phase",
        label: "Shows when a request is waiting for room",
        args: ["queued"],
        assertions: [equal("queued-label", "Use the exact waiting-for-capacity label", "Waiting for capacity")],
      },
      {
        id: "loading-phase",
        label: "Shows when the model is loading",
        args: ["loading"],
        assertions: [equal("loading-label", "Use the exact model-loading label", "Loading model")],
      },
      {
        id: "prefill-phase",
        label: "Shows when the prompt is being processed",
        args: ["prefill"],
        assertions: [equal("prefill-label", "Use the exact context-processing label", "Processing context")],
      },
      {
        id: "streaming-phase",
        label: "Shows when generation is running",
        args: ["streaming"],
        assertions: [equal("streaming-label", "Use the exact active-generation label", "Generating")],
      },
      {
        id: "complete-phase",
        label: "Shows completion as a finished state",
        args: ["complete"],
        assertions: [equal("complete-label", "Map complete directly instead of falling through to a generic ready label", "Complete")],
      },
      {
        id: "cancelled-phase",
        label: "Shows when generation was stopped",
        args: ["cancelled"],
        assertions: [equal("cancelled-label", "Use the exact stopped label", "Stopped")],
      },
      {
        id: "error-phase",
        label: "Shows when generation failed",
        args: ["error"],
        assertions: [equal("error-label", "Use the exact generation-failed label", "Generation failed")],
      },
      {
        id: "unknown-future-phase",
        label: "Uses a safe fallback for a future state it doesn't know",
        args: ["future-state"],
        assertions: [equal("fallback-label", "Do not describe an unknown state as Ready; use the explicit unavailable fallback", "Status unavailable")],
      },
    ],
  }),
];

export const llmSystemsContractSuite: ContractSuite = {
  contractVersion: "llm-systems-contracts-v17-cpython",
  contracts: llmSystemsExerciseContracts,
};
