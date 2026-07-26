import type {
  ContractSuite,
  ExerciseCase,
  ExerciseContract,
  HostAssertion,
  JsonValue,
  ValuePath,
} from "@latent/browser-lab/types";

type Case = {
  id: string;
  label: string;
  args: readonly JsonValue[];
  assertions: readonly HostAssertion[];
};

const paths: Record<string, string> = {
  "arrays-and-shapes": "linear-algebra/arrays-and-shapes.py",
  "vector-operations": "linear-algebra/vector-operations.py",
  "dot-products": "linear-algebra/dot-products.py",
  "matrix-multiplication": "linear-algebra/matrix-multiplication.py",
  "batches-and-broadcasting": "linear-algebra/batches-and-broadcasting.py",
  "ml-training-data": "machine-learning-basics/training-data.py",
  "ml-linear-regression": "machine-learning-basics/linear-regression.py",
  "ml-gradient-descent": "machine-learning-basics/gradient-descent.py",
  "ml-binary-classification": "machine-learning-basics/binary-classification.py",
  "ml-neural-networks": "machine-learning-basics/neural-networks.py",
};

function define(
  lessonId: string,
  blockId: string,
  label: string,
  exportName: string,
  cases: readonly Case[],
): ExerciseContract {
  const modulePath = paths[lessonId];
  if (!modulePath) throw new Error(`Missing beginner-course path for ${lessonId}.`);
  return {
    id: `${lessonId}/${blockId}`,
    label,
    cases: cases.map((exerciseCase): ExerciseCase => ({
      id: exerciseCase.id,
      label: exerciseCase.label,
      invoke: { modulePath, exportName, args: exerciseCase.args },
      assertions: exerciseCase.assertions,
    })),
  };
}

function equal(id: string, label: string, expected: JsonValue, path?: ValuePath): HostAssertion {
  return { id, label, kind: "deep-equal", expected, path };
}

function range(id: string, label: string, minimum: number, maximum: number, path?: ValuePath): HostAssertion {
  return { id, label, kind: "range", minimum, maximum, path };
}

function finite(id: string, label: string, path?: ValuePath): HostAssertion {
  return { id, label, kind: "finite", path };
}

function throws(id: string, label: string): HostAssertion {
  return { id, label, kind: "throws", errorName: "ValueError" };
}

export const foundationExerciseContracts: readonly ExerciseContract[] = [
  define("arrays-and-shapes", "describe-array", "Describe an array", "describe_array", [
    { id: "scalar", label: "Describes a scalar", args: [7], assertions: [equal("scalar-description", "Return rank zero, no axes, and one value", { rank: 0, shape: [], size: 1 })] },
    { id: "vector", label: "Describes a vector", args: [[3, 1, 4]], assertions: [equal("vector-description", "Return one axis of length three", { rank: 1, shape: [3], size: 3 })] },
    { id: "matrix", label: "Describes a matrix", args: [[[1, 2, 3], [4, 5, 6]]], assertions: [equal("matrix-description", "Return two rows, three columns, and six values", { rank: 2, shape: [2, 3], size: 6 })] },
  ]),
  define("arrays-and-shapes", "reshape-array", "Reshape an array", "reshape_array", [
    { id: "two-by-three", label: "Reshapes six values into two rows", args: [[1, 2, 3, 4, 5, 6], [2, 3]], assertions: [equal("reshaped-values", "Keep the original order while changing the shape", [[1, 2, 3], [4, 5, 6]])] },
    { id: "column", label: "Reshapes values into one column", args: [[1, 2, 3], [3, 1]], assertions: [equal("column-values", "Create three one-value rows", [[1], [2], [3]])] },
    { id: "wrong-size", label: "Rejects a shape with the wrong value count", args: [[1, 2, 3], [2, 2]], assertions: [throws("preserve-size", "Explain that reshape must preserve the number of values")] },
  ]),
  define("vector-operations", "add-vectors", "Add vectors", "add_vectors", [
    { id: "mixed-signs", label: "Adds matching coordinates", args: [[1, 2, 3], [4, -2, 0]], assertions: [equal("coordinate-sums", "Return one sum for each coordinate", [5, 0, 3])] },
    { id: "decimals", label: "Adds decimal coordinates", args: [[0.5, -1], [1.5, 3]], assertions: [equal("decimal-sums", "Preserve decimal values", [2, 2])] },
    { id: "length-mismatch", label: "Rejects vectors with different lengths", args: [[1, 2], [3]], assertions: [throws("same-shape", "Require the same vector shape")] },
  ]),
  define("vector-operations", "l2-norm", "Vector length", "l2_norm", [
    { id: "three-four", label: "Measures a 3-4 vector", args: [[3, 4]], assertions: [range("five", "Return length five", 4.999999999, 5.000000001)] },
    { id: "negative-coordinates", label: "Squares negative coordinates", args: [[-2, -3, -6]], assertions: [range("seven", "Return length seven", 6.999999999, 7.000000001)] },
    { id: "zero", label: "Measures the zero vector", args: [[0, 0, 0]], assertions: [equal("zero-length", "Return zero", 0)] },
  ]),
  define("dot-products", "dot-product", "Dot product", "dot_product", [
    { id: "mixed", label: "Multiplies and sums matching coordinates", args: [[1, 2, 3], [4, -1, 2]], assertions: [equal("dot-eight", "Return eight", 8)] },
    { id: "perpendicular", label: "Returns zero for perpendicular axes", args: [[1, 0], [0, 5]], assertions: [equal("dot-zero", "Return zero", 0)] },
    { id: "opposite", label: "Returns a negative value for opposite directions", args: [[2, 0], [-3, 0]], assertions: [equal("dot-negative", "Return negative six", -6)] },
  ]),
  define("dot-products", "cosine-similarity", "Cosine similarity", "cosine_similarity", [
    { id: "same-direction", label: "Ignores scale for aligned vectors", args: [[1, 2], [2, 4]], assertions: [range("aligned", "Return one for the same direction", 0.999999999, 1.000000001)] },
    { id: "opposite-direction", label: "Recognizes opposite direction", args: [[1, 0], [-2, 0]], assertions: [range("opposite", "Return negative one", -1.000000001, -0.999999999)] },
    { id: "zero-vector", label: "Rejects a vector with no direction", args: [[0, 0], [1, 0]], assertions: [throws("nonzero", "Require nonzero vectors")] },
  ]),
  define("matrix-multiplication", "matrix-vector-product", "Matrix-vector product", "matrix_vector_product", [
    { id: "identity", label: "Leaves a vector unchanged under identity", args: [[[1, 0], [0, 1]], [3, -2]], assertions: [equal("identity-output", "Return the original vector", [3, -2])] },
    { id: "three-rows", label: "Computes one dot product per row", args: [[[1, 2], [3, 4], [5, 6]], [2, -1]], assertions: [equal("row-products", "Return three row results", [0, 2, 4])] },
    { id: "inner-mismatch", label: "Rejects an incompatible vector width", args: [[[1, 2, 3]], [1, 2]], assertions: [throws("inner-dimension", "Explain the matrix-vector shape mismatch")] },
  ]),
  define("matrix-multiplication", "linear-layer", "Linear layer", "linear_layer", [
    { id: "weighted-bias", label: "Applies weights and bias", args: [[2, -1], [[1, 2], [-3, 0.5]], [0.5, 1]], assertions: [equal("layer-output", "Return both shifted row products", [0.5, -5.5])] },
    { id: "zero-input", label: "Returns the bias for a zero input", args: [[0, 0], [[1, 2], [3, 4]], [5, -2]], assertions: [equal("bias-output", "Return the bias vector", [5, -2])] },
    { id: "bias-mismatch", label: "Rejects the wrong bias width", args: [[1, 2], [[1, 0], [0, 1]], [0]], assertions: [throws("bias-width", "Require one bias per output")] },
  ]),
  define("batches-and-broadcasting", "add-row-bias", "Add row bias", "add_row_bias", [
    { id: "two-rows", label: "Adds the same bias to every row", args: [[[1, 2], [3, 4]], [10, -1]], assertions: [equal("broadcast-sum", "Return two shifted rows", [[11, 1], [13, 3]])] },
    { id: "one-row", label: "Works for one row", args: [[[0, 0, 0]], [1, 2, 3]], assertions: [equal("single-row", "Return the bias as the row", [[1, 2, 3]])] },
    { id: "bias-mismatch", label: "Rejects the wrong bias width", args: [[[1, 2]], [1]], assertions: [throws("matching-width", "Require matching row and bias widths")] },
  ]),
  define("batches-and-broadcasting", "batch-linear", "Batched linear layer", "batch_linear", [
    { id: "basis-batch", label: "Applies shared weights to two basis rows", args: [[[1, 0], [0, 1]], [[1, 2], [3, 4]], [10, 20]], assertions: [equal("batch-output", "Return one output row per input row", [[11, 23], [12, 24]])] },
    { id: "repeated-row", label: "Produces repeated outputs for repeated inputs", args: [[[2, 1], [2, 1]], [[1, 0], [0, 1]], [0, 0]], assertions: [equal("repeated-output", "Apply the same parameters to both rows", [[2, 1], [2, 1]])] },
    { id: "input-mismatch", label: "Rejects the wrong input width", args: [[[1, 2, 3]], [[1, 2]], [0]], assertions: [throws("feature-width", "Require inputs to match the weight width")] },
  ]),

  define("ml-training-data", "features-targets", "Features and targets", "features_and_targets", [
    { id: "two-features", label: "Splits the final column from two-feature rows", args: [[[1, 2, 0], [3, 4, 1]]], assertions: [equal("split-columns", "Return feature rows and targets", { features: [[1, 2], [3, 4]], targets: [0, 1] })] },
    { id: "one-feature", label: "Handles one feature per row", args: [[[5, 2], [-1, 3]]], assertions: [equal("one-feature-split", "Keep one-column feature rows", { features: [[5], [-1]], targets: [2, 3] })] },
    { id: "ragged", label: "Rejects a ragged table", args: [[[1, 2, 0], [3, 1]]], assertions: [throws("rectangular", "Require a rectangular table")] },
  ]),
  define("ml-training-data", "holdout-split", "Holdout split", "holdout_split", [
    { id: "alternating", label: "Keeps selected rows for validation", args: [[[10], [20], [30], [40]], [0, 1, 0, 1], [1, 3]], assertions: [equal("ordered-split", "Preserve row order in both groups", { train_features: [[10], [30]], train_targets: [0, 0], validation_features: [[20], [40]], validation_targets: [1, 1] })] },
    { id: "empty-holdout", label: "Allows no validation rows", args: [[[1], [2]], [0, 1], []], assertions: [equal("all-training", "Leave every row in training", { train_features: [[1], [2]], train_targets: [0, 1], validation_features: [], validation_targets: [] })] },
    { id: "duplicate-index", label: "Rejects duplicate validation indices", args: [[[1], [2]], [0, 1], [1, 1]], assertions: [throws("unique-indices", "Require unique validation indices")] },
  ]),
  define("ml-linear-regression", "linear-prediction", "Linear prediction", "linear_prediction", [
    { id: "weighted", label: "Computes a weighted sum plus bias", args: [[2, -1], [3, 4], 0.5], assertions: [equal("prediction", "Return two and a half", 2.5)] },
    { id: "zero-features", label: "Returns the bias for zero features", args: [[0, 0], [4, -2], 3], assertions: [equal("bias-only", "Return the bias", 3)] },
    { id: "mismatch", label: "Rejects a missing weight", args: [[1, 2], [3], 0], assertions: [throws("one-weight", "Require one weight per feature")] },
  ]),
  define("ml-linear-regression", "mean-squared-error", "Mean squared error", "mean_squared_error", [
    { id: "two-errors", label: "Averages squared errors", args: [[2, 4], [1, 6]], assertions: [range("mse", "Return 2.5", 2.499999999, 2.500000001)] },
    { id: "perfect", label: "Returns zero for perfect predictions", args: [[1, -2, 4], [1, -2, 4]], assertions: [equal("zero-loss", "Return zero", 0)] },
    { id: "empty", label: "Rejects an empty batch", args: [[], []], assertions: [throws("nonempty", "Require at least one example")] },
  ]),
  define("ml-gradient-descent", "mse-gradients", "MSE gradients", "mse_gradients", [
    { id: "initial-line", label: "Computes gradients from zero parameters", args: [[1, 2], [2, 4], 0, 0], assertions: [equal("initial-gradients", "Return weight -10 and bias -6", { weight: -10, bias: -6 })] },
    { id: "perfect-line", label: "Returns zero gradients for a perfect line", args: [[1, 2], [2, 4], 2, 0], assertions: [equal("zero-gradients", "Return two zero gradients", { weight: 0, bias: 0 })] },
    { id: "zero-inputs", label: "Separates weight and bias gradients", args: [[0, 0], [1, 3], 5, 0], assertions: [equal("bias-gradient", "Return zero weight gradient and bias -4", { weight: 0, bias: -4 })] },
  ]),
  define("ml-gradient-descent", "gradient-step", "Gradient step", "gradient_step", [
    { id: "basic-step", label: "Subtracts scaled gradients", args: [1, 0, { weight: -2, bias: 1 }, 0.1], assertions: [range("weight-updated", "Increase the weight to 1.2", 1.199999999, 1.200000001, ["weight"]), range("bias-updated", "Decrease the bias to -0.1", -0.100000001, -0.099999999, ["bias"])] },
    { id: "zero-rate", label: "Leaves parameters unchanged at learning rate zero", args: [3, -2, { weight: 5, bias: -4 }, 0], assertions: [equal("unchanged", "Return the original parameters", { weight: 3, bias: -2 })] },
    { id: "negative-rate", label: "Rejects a negative learning rate", args: [1, 0, { weight: 1, bias: 1 }, -0.1], assertions: [throws("nonnegative-rate", "Require a nonnegative learning rate")] },
  ]),
  define("ml-binary-classification", "sigmoid", "Sigmoid", "sigmoid", [
    { id: "zero", label: "Maps zero to one half", args: [0], assertions: [range("half", "Return 0.5", 0.499999999, 0.500000001)] },
    { id: "positive", label: "Maps two above one half", args: [2], assertions: [range("sigmoid-two", "Return about 0.8808", 0.88079, 0.88080)] },
    { id: "extremes", label: "Stays finite for a very negative logit", args: [-1000], assertions: [finite("finite-negative", "Return a finite probability"), range("bounded-negative", "Stay within probability bounds", 0, 1)] },
  ]),
  define("ml-binary-classification", "binary-cross-entropy", "Binary cross-entropy", "binary_cross_entropy", [
    { id: "good-predictions", label: "Scores two mostly correct probabilities", args: [[0.9, 0.2], [1, 0]], assertions: [range("good-loss", "Return about 0.1643", 0.16424, 0.16426)] },
    { id: "bad-predictions", label: "Penalizes confident mistakes", args: [[0.1, 0.8], [1, 0]], assertions: [range("bad-loss", "Return about 1.956", 1.9560, 1.9561)] },
    { id: "invalid-target", label: "Rejects a target outside zero or one", args: [[0.5], [2]], assertions: [throws("binary-target", "Require binary targets")] },
  ]),
  define("ml-neural-networks", "relu", "ReLU", "relu", [
    { id: "mixed", label: "Clips negative values to zero", args: [[-2, 0, 3]], assertions: [equal("relu-values", "Return zero, zero, three", [0, 0, 3])] },
    { id: "positive", label: "Leaves positive values unchanged", args: [[0.5, 2]], assertions: [equal("positive-values", "Return the original positive values", [0.5, 2])] },
    { id: "matrix", label: "Rejects a matrix input", args: [[[1, 2], [3, 4]]], assertions: [throws("vector-only", "Require a vector")] },
  ]),
  define("ml-neural-networks", "two-layer-network", "Two-layer network", "two_layer_network", [
    { id: "identity-hidden", label: "Runs a two-unit hidden layer", args: [[2, -1], { W1: [[1, 0], [0, 1]], b1: [0, 0], W2: [0.5, -1], b2: 0.1 }], assertions: [range("network-output", "Return 1.1 after ReLU", 1.099999999, 1.100000001)] },
    { id: "bias-hidden", label: "Uses hidden biases on a zero input", args: [[0, 0], { W1: [[1, 0], [0, 1]], b1: [1, 2], W2: [1, 1], b2: 0.5 }], assertions: [range("bias-output", "Return 3.5", 3.499999999, 3.500000001)] },
    { id: "relu-required", label: "Uses ReLU before the output layer", args: [[-2, 3], { W1: [[1, 0], [0, 1]], b1: [0, 0], W2: [1, 1], b2: 0 }], assertions: [equal("relu-output", "Drop the negative hidden value and return three", 3)] },
  ]),
];

export const foundationContractSuite: ContractSuite = {
  contractVersion: "foundation-contracts-v1-cpython",
  contracts: foundationExerciseContracts,
};
