import { defineFoundationLesson } from "@/examples/learning-platform/llm-learning/lessons/foundations/define-foundation-lesson";

const courseIdentity = {
  courseId: "machine-learning-basics",
  programId: "machine-learning-basics",
  courseTitle: "Machine Learning Basics",
  courseNumber: 2,
} as const;

const trainingDataLesson = defineFoundationLesson({
  ...courseIdentity,
  id: "ml-training-data",
  number: 1,
  lessonNumber: 1,
  eyebrow: "Supervised learning · Data splits",
  title: "Training and Validation Data",
  thesis:
    "Separate examples into inputs and targets, then hold some rows back so evaluation uses data the model did not train on.",
  sources: [
    {
      role: "Guide",
      title: "Datasets, generalization, and overfitting",
      authors: "Google Machine Learning Crash Course",
      year: "Current",
      url: "https://developers.google.com/machine-learning/crash-course/overfitting",
      relevance:
        "Introduces examples, features, labels, dataset quality, and the reason for separate training and evaluation data.",
    },
    {
      role: "Guide",
      title: "Cross-validation: evaluating estimator performance",
      authors: "scikit-learn developers",
      year: "Current",
      url: "https://scikit-learn.org/stable/modules/cross_validation.html",
      relevance:
        "Explains why evaluating on the same examples used for fitting gives a misleading result.",
    },
  ],
  summary: [
    {
      label: "Examples, features, and targets.",
      body:
        "Imagine one row describing a house. Its square footage and number of bedrooms are the features the model uses, and its sale price is the target it should learn to predict. In machine learning, one row like this is one example. The features for one example are usually written as x, and its target is written as y. Put n examples with d features together and you get a feature matrix X with shape [n, d] and a target vector y with shape [n].",
    },
    {
      label: "Training and validation sets.",
      body:
        "Training rows are allowed to change the model's parameters. Validation rows are held out and used only to measure the resulting model. The sets must not overlap: if the model trains on its validation answers, the validation score no longer measures performance on unseen examples.",
    },
    {
      label: "Language-model data.",
      body:
        "A language model uses the same setup. The input features represent the tokens already present, and the target is the token that comes next. Later lessons use larger arrays and many target classes, but the split between input, target, training, and evaluation stays the same.",
    },
  ],
  diagram: {
    title: "One dataset, two separate uses",
    caption:
      "First separate each row into features and a target. Then assign whole rows to training or validation without copying a row into both sets.",
    nodes: [
      { label: "Rows", value: "8 examples × 3 columns" },
      { label: "Features", value: "X: 8 × 2" },
      { label: "Targets", value: "y: 8" },
      { label: "Training", value: "6 rows · parameters may change" },
      { label: "Validation", value: "2 held-out rows · measure only" },
    ],
  },
  dataset: {
    name: "Small Labeled Table",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "8 rows · 2 features · 1 target",
    preview: "[1.0, 2.0] → 0 · [3.0, 4.0] → 1",
  },
  implementation: {
    filename: "training-data.py",
    intro:
      "Split a numeric table into X and y, then hold out selected rows for validation.",
    tensorOps: ["numpy", "np.asarray", "np.ones", "tolist"],
    codeBlocks: [
      {
        id: "features-targets",
        label: "Features and targets",
        purpose: "Use the final column as the target and every earlier column as a feature.",
        concepts: [
          {
            name: "rows",
            detail: "A rectangular table with one example per row and the target in the last column.",
          },
          {
            name: "features",
            detail: "All columns except the final target column.",
          },
          {
            name: "targets",
            detail: "One expected output value for each example.",
          },
        ],
        code: `import numpy as np

def features_and_targets(rows):
    try:
        table = np.asarray(rows, dtype=float)
    except (TypeError, ValueError) as error:
        raise ValueError(
            "rows must be a rectangular table with feature columns and one target column"
        ) from error

    if table.ndim != 2 or table.shape[1] < 2:
        raise ValueError(
            "rows must be a rectangular table with at least one feature and one target column"
        )

    return {
        "features": table[:, :-1].tolist(),
        "targets": table[:, -1].tolist(),
    }`,
        checkCode: `result = features_and_targets([[1, 2, 0], [3, 4, 1]])
RESULT = {
    "passed": result == {
        "features": [[1, 2], [3, 4]],
        "targets": [0, 1],
    },
    "detail": f"X has {len(result['features'])} rows; y has {len(result['targets'])} values",
}`,
      },
      {
        id: "holdout-split",
        label: "Holdout split",
        purpose: "Move selected examples into validation while preserving the original row order.",
        concepts: [
          {
            name: "validation_indices",
            detail: "The row numbers reserved for evaluation rather than training.",
          },
          {
            name: "mask",
            detail: "A Boolean array that keeps every unselected row in the training set.",
          },
          {
            name: "disjoint sets",
            detail: "Each row appears in training or validation, never both.",
          },
        ],
        code: `import numpy as np

def holdout_split(features, targets, validation_indices):
    feature_table = np.asarray(features, dtype=float)
    target_values = np.asarray(targets, dtype=float)

    if feature_table.ndim != 2 or target_values.ndim != 1:
        raise ValueError("features must be a table and targets must be a vector")
    if feature_table.shape[0] != target_values.size:
        raise ValueError("features and targets must contain the same number of rows")
    if not isinstance(validation_indices, (list, tuple)):
        raise ValueError("validation_indices must be a list of row numbers")
    if any(type(index) is not int for index in validation_indices):
        raise ValueError("every validation index must be an integer")
    if len(set(validation_indices)) != len(validation_indices):
        raise ValueError("validation indices must be unique")
    if any(index < 0 or index >= target_values.size for index in validation_indices):
        raise ValueError("validation index is out of range")

    validation_mask = np.zeros(target_values.size, dtype=bool)
    validation_mask[list(validation_indices)] = True
    training_mask = ~validation_mask

    return {
        "train_features": feature_table[training_mask].tolist(),
        "train_targets": target_values[training_mask].tolist(),
        "validation_features": feature_table[validation_mask].tolist(),
        "validation_targets": target_values[validation_mask].tolist(),
    }`,
        checkCode: `result = holdout_split(
    [[10], [20], [30], [40]],
    [1, 2, 3, 4],
    [1, 3],
)
RESULT = {
    "passed": (
        result["train_features"] == [[10], [30]]
        and result["validation_features"] == [[20], [40]]
    ),
    "detail": f"train={len(result['train_targets'])}, validation={len(result['validation_targets'])}",
}`,
      },
    ],
  },
  experiment: {
    variant: "training-data",
    title: "Create a holdout split",
    intro: "Separate a small labeled table into training and validation rows.",
  },
});

const linearRegressionLesson = defineFoundationLesson({
  ...courseIdentity,
  id: "ml-linear-regression",
  number: 2,
  lessonNumber: 2,
  eyebrow: "Regression · Loss",
  title: "Linear Regression",
  thesis:
    "Use weights and a bias to predict a number, then measure prediction error with mean squared error.",
  sources: [
    {
      role: "Guide",
      title: "Linear regression",
      authors: "Google Machine Learning Crash Course",
      year: "Current",
      url: "https://developers.google.com/machine-learning/crash-course/linear-regression",
      relevance:
        "Introduces linear predictions, weights, bias, loss, and the role of training.",
    },
    {
      role: "Guide",
      title: "Machine Learning Basics",
      authors: "Ian Goodfellow · Yoshua Bengio · Aaron Courville",
      year: "2016",
      url: "https://www.deeplearningbook.org/contents/ml.html",
      relevance:
        "Develops linear regression as a first complete example of a learning algorithm.",
    },
  ],
  summary: [
    {
      label: "Weights and bias.",
      body:
        "A linear model multiplies each feature by a weight, adds the results, and then adds one bias value: y_hat = x · w + b. The weights control how each feature changes the prediction. The bias shifts every prediction by the same amount.",
    },
    {
      label: "Mean squared error.",
      body:
        "For each example, subtract the target from the prediction and square the difference. Mean squared error averages those squared differences. Squaring prevents positive and negative errors from canceling and makes larger misses count more.",
    },
    {
      label: "Linear operations in language models.",
      body:
        "A full language model is not one linear regression, but it repeatedly uses the same weighted-sum operation. Embedding projections, attention projections, feed-forward layers, and the final vocabulary scores all multiply arrays by learned weights and add biases.",
    },
  ],
  diagram: {
    title: "Prediction and error",
    caption:
      "The model turns one feature vector into one prediction. The loss compares a batch of predictions with their targets.",
    nodes: [
      { label: "Features", value: "x = [2, −1]" },
      { label: "Weights", value: "w = [3, 4]" },
      { label: "Weighted sum", value: "x · w = 2" },
      { label: "Bias", value: "2 + 0.5 = 2.5" },
      { label: "Squared error", value: "(2.5 − y)²" },
    ],
  },
  dataset: {
    name: "Small Regression Set",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "5 examples · 2 numeric features",
    preview: "[2, −1] → 2.5 · [0, 3] → −1.0",
  },
  implementation: {
    filename: "linear-regression.py",
    intro:
      "Compute a linear prediction for one example, then average squared error across several examples.",
    tensorOps: ["numpy", "np.asarray", "np.mean"],
    codeBlocks: [
      {
        id: "linear-prediction",
        label: "Linear prediction",
        purpose: "Multiply matching features and weights, add them, and include the bias.",
        concepts: [
          {
            name: "features / x",
            detail: "The measured input values for one example.",
          },
          {
            name: "weights / w",
            detail: "One learned multiplier for each feature.",
          },
          {
            name: "bias / b",
            detail: "One learned value added after the weighted sum.",
          },
        ],
        code: `import numpy as np

def linear_prediction(features, weights, bias):
    x = np.asarray(features, dtype=float)
    w = np.asarray(weights, dtype=float)
    bias_value = float(bias)

    if x.ndim != 1 or w.ndim != 1:
        raise ValueError("features and weights must be one-dimensional vectors")
    if x.size != w.size:
        raise ValueError("linear_prediction needs one weight per feature")
    if not np.all(np.isfinite(x)) or not np.all(np.isfinite(w)) or not np.isfinite(bias_value):
        raise ValueError("features, weights, and bias must be finite numbers")

    return float(x @ w + bias_value)`,
        checkCode: `prediction = linear_prediction([2, -1], [3, 4], 0.5)
RESULT = {
    "passed": abs(prediction - 2.5) < 1e-12,
    "detail": f"prediction = {prediction:g}",
}`,
      },
      {
        id: "mean-squared-error",
        label: "Mean squared error",
        purpose: "Average the squared difference between each prediction and target.",
        concepts: [
          {
            name: "residual",
            detail: "The signed difference prediction − target for one example.",
          },
          {
            name: "square",
            detail: "Makes every contribution non-negative and emphasizes larger errors.",
          },
          {
            name: "mean",
            detail: "Produces one loss value for the full batch.",
          },
        ],
        code: `import numpy as np

def mean_squared_error(predictions, targets):
    predicted = np.asarray(predictions, dtype=float)
    expected = np.asarray(targets, dtype=float)

    if predicted.ndim != 1 or expected.ndim != 1:
        raise ValueError("predictions and targets must be one-dimensional vectors")
    if predicted.size == 0 or predicted.size != expected.size:
        raise ValueError("predictions and targets must have the same length and at least one value")
    if not np.all(np.isfinite(predicted)) or not np.all(np.isfinite(expected)):
        raise ValueError("predictions and targets must contain finite numbers")

    residuals = predicted - expected
    return float(np.mean(residuals ** 2))`,
        checkCode: `loss = mean_squared_error([2, 4], [1, 6])
RESULT = {
    "passed": abs(loss - 2.5) < 1e-12,
    "detail": f"MSE = {loss:g}",
}`,
      },
    ],
  },
  experiment: {
    variant: "linear-regression",
    title: "Fit a line",
    intro: "Change a weight and bias, then compare the line's mean squared error.",
  },
});

const gradientDescentLesson = defineFoundationLesson({
  ...courseIdentity,
  id: "ml-gradient-descent",
  number: 3,
  lessonNumber: 3,
  eyebrow: "Optimization · Parameter updates",
  title: "Gradient Descent",
  thesis:
    "Use the slope of the loss to update parameters in the direction that lowers prediction error.",
  sources: [
    {
      role: "Guide",
      title: "Gradient descent",
      authors: "Google Machine Learning Crash Course",
      year: "Current",
      url: "https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent",
      relevance:
        "Explains gradients, learning rate, and iterative parameter updates with a small loss curve.",
    },
    {
      role: "Guide",
      title: "Numerical Computation",
      authors: "Ian Goodfellow · Yoshua Bengio · Aaron Courville",
      year: "2016",
      url: "https://www.deeplearningbook.org/contents/numerical.html",
      relevance:
        "Introduces gradient-based optimization and the numerical issues that appear in iterative learning.",
    },
  ],
  summary: [
    {
      label: "A gradient is a slope.",
      body:
        "A gradient tells you how a small change in a parameter would change the loss. A positive gradient means increasing that parameter would raise the loss nearby. A negative gradient means increasing it would lower the loss nearby.",
    },
    {
      label: "Subtract the update.",
      body:
        "Gradient descent applies parameter = parameter − learning_rate × gradient. The minus sign moves against the direction of increasing loss. The learning rate controls the step size: too small learns slowly, while too large can jump past a useful setting.",
    },
    {
      label: "Training repeats this step.",
      body:
        "A training loop predicts, measures loss, computes gradients, and updates parameters many times. Large language models do this for far more parameters and data, usually with a more advanced optimizer, but each update still uses gradients to decide how the weights should move.",
    },
  ],
  diagram: {
    title: "One optimization step",
    caption:
      "The gradient describes the local slope. Multiplying by the learning rate sets the update size.",
    nodes: [
      { label: "Current parameters", value: "w = 1.0 · b = 0.0" },
      { label: "Loss", value: "MSE(w, b)" },
      { label: "Gradients", value: "dw = −2 · db = 1" },
      { label: "Learning rate", value: "η = 0.1" },
      { label: "Updated parameters", value: "w = 1.2 · b = −0.1" },
    ],
  },
  dataset: {
    name: "Scalar Regression Set",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "4 examples · 1 weight · 1 bias",
    preview: "x = [1, 2] · y = [2, 4]",
  },
  implementation: {
    filename: "gradient-descent.py",
    intro:
      "Compute the two gradients for a scalar linear model, then apply one gradient-descent step.",
    tensorOps: ["numpy", "np.asarray", "np.mean", "np.isfinite"],
    codeBlocks: [
      {
        id: "mse-gradients",
        label: "MSE gradients",
        purpose: "Measure how the linear model's mean squared error changes with its weight and bias.",
        concepts: [
          {
            name: "errors",
            detail: "prediction − target for every training example.",
          },
          {
            name: "weight gradient",
            detail: "Averages 2 × error × input because the weight is multiplied by x.",
          },
          {
            name: "bias gradient",
            detail: "Averages 2 × error because the bias is added directly.",
          },
        ],
        code: `import numpy as np

def mse_gradients(xs, targets, weight, bias):
    inputs = np.asarray(xs, dtype=float)
    expected = np.asarray(targets, dtype=float)
    weight_value = float(weight)
    bias_value = float(bias)

    if inputs.ndim != 1 or expected.ndim != 1:
        raise ValueError("xs and targets must be one-dimensional vectors")
    if inputs.size == 0 or inputs.size != expected.size:
        raise ValueError("xs and targets must have the same non-zero length")
    if not (
        np.all(np.isfinite(inputs))
        and np.all(np.isfinite(expected))
        and np.isfinite(weight_value)
        and np.isfinite(bias_value)
    ):
        raise ValueError("training values and parameters must be finite numbers")

    predictions = inputs * weight_value + bias_value
    errors = predictions - expected
    return {
        "weight": float(2 * np.mean(errors * inputs)),
        "bias": float(2 * np.mean(errors)),
    }`,
        checkCode: `gradients = mse_gradients([1, 2], [2, 4], 0, 0)
RESULT = {
    "passed": gradients == {"weight": -10, "bias": -6},
    "detail": f"dw={gradients['weight']:g}, db={gradients['bias']:g}",
}`,
      },
      {
        id: "gradient-step",
        label: "Gradient step",
        purpose: "Subtract a learning-rate-scaled gradient from each parameter.",
        concepts: [
          {
            name: "learning_rate",
            detail: "A non-negative number that controls how far each update moves.",
          },
          {
            name: "subtract",
            detail: "Moves opposite the local direction of increasing loss.",
          },
          {
            name: "updated parameters",
            detail: "The new weight and bias used by the next prediction step.",
          },
        ],
        code: `import numpy as np

def gradient_step(weight, bias, gradients, learning_rate):
    weight_value = float(weight)
    bias_value = float(bias)
    rate = float(learning_rate)

    if not isinstance(gradients, dict) or set(gradients) != {"weight", "bias"}:
        raise ValueError("gradients must contain exactly weight and bias")

    weight_gradient = float(gradients["weight"])
    bias_gradient = float(gradients["bias"])
    values = [weight_value, bias_value, weight_gradient, bias_gradient, rate]
    if not all(np.isfinite(value) for value in values):
        raise ValueError("parameters, gradients, and learning rate must be finite")
    if rate < 0:
        raise ValueError("learning rate must be non-negative")

    return {
        "weight": weight_value - rate * weight_gradient,
        "bias": bias_value - rate * bias_gradient,
    }`,
        checkCode: `updated = gradient_step(1, 0, {"weight": -2, "bias": 1}, 0.1)
RESULT = {
    "passed": (
        abs(updated["weight"] - 1.2) < 1e-12
        and abs(updated["bias"] + 0.1) < 1e-12
    ),
    "detail": f"w={updated['weight']:.1f}, b={updated['bias']:.1f}",
}`,
      },
    ],
  },
  experiment: {
    variant: "gradient-descent",
    title: "Run gradient descent",
    intro: "Apply repeated updates and watch the mean squared error change.",
  },
});

const binaryClassificationLesson = defineFoundationLesson({
  ...courseIdentity,
  id: "ml-binary-classification",
  number: 4,
  lessonNumber: 4,
  eyebrow: "Classification · Cross-entropy",
  title: "Binary Classification",
  thesis:
    "Turn a raw model score into a probability, then measure how much probability the model assigned to the observed class.",
  sources: [
    {
      role: "Guide",
      title: "Calculating a probability with the sigmoid function",
      authors: "Google Machine Learning Crash Course",
      year: "Current",
      url: "https://developers.google.com/machine-learning/crash-course/logistic-regression/sigmoid-function",
      relevance:
        "Explains how logistic regression converts a linear score into a probability between zero and one.",
    },
    {
      role: "Guide",
      title: "Deep Feedforward Networks",
      authors: "Ian Goodfellow · Yoshua Bengio · Aaron Courville",
      year: "2016",
      url: "https://www.deeplearningbook.org/contents/mlp.html",
      relevance:
        "Connects output units, cross-entropy, and gradient-based learning in neural networks.",
    },
  ],
  summary: [
    {
      label: "Logits and probabilities.",
      body:
        "A binary classifier first produces a real-valued score called a logit. The sigmoid function maps that score to a probability between 0 and 1. A logit of 0 becomes 0.5, positive logits become probabilities above 0.5, and negative logits become probabilities below 0.5.",
    },
    {
      label: "Binary cross-entropy.",
      body:
        "For a positive target, the loss is −log(p). For a negative target, it is −log(1 − p). A confident correct prediction has low loss. A confident wrong prediction has high loss, which gives training a strong signal that the parameters need to change.",
    },
    {
      label: "From two classes to a vocabulary.",
      body:
        "Language models choose among many token classes rather than two. They replace sigmoid with softmax, which assigns one probability to every vocabulary item. The next-token loss follows the same idea: score the probability assigned to the target that actually appeared.",
    },
  ],
  diagram: {
    title: "Score, probability, and loss",
    caption:
      "Sigmoid changes the representation of the prediction. Cross-entropy compares that probability with the target.",
    nodes: [
      { label: "Logit", value: "z = 2" },
      { label: "Sigmoid", value: "1 / (1 + exp(−z))" },
      { label: "Probability", value: "p = 0.881" },
      { label: "Target", value: "y = 1" },
      { label: "Loss", value: "−log(0.881) = 0.127" },
    ],
  },
  dataset: {
    name: "Binary Score Set",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "6 logits · binary targets",
    preview: "z = 2 → y = 1 · z = −1 → y = 0",
  },
  implementation: {
    filename: "binary-classification.py",
    intro:
      "Implement a stable sigmoid for one logit, then average binary cross-entropy over a batch.",
    tensorOps: ["numpy", "np.asarray", "np.exp", "np.log", "np.clip"],
    codeBlocks: [
      {
        id: "sigmoid",
        label: "Sigmoid",
        purpose: "Convert one finite logit into a probability without overflowing the exponential.",
        concepts: [
          {
            name: "logit",
            detail: "A raw score that can be any finite real number.",
          },
          {
            name: "stable branch",
            detail: "Uses a different but equivalent expression for negative values to avoid exp(1000).",
          },
          {
            name: "probability",
            detail: "The returned value lies between zero and one.",
          },
        ],
        code: `import numpy as np

def sigmoid(logit):
    value = float(logit)
    if not np.isfinite(value):
        raise ValueError("sigmoid needs one finite logit")

    if value >= 0:
        return float(1 / (1 + np.exp(-value)))

    exp_value = np.exp(value)
    return float(exp_value / (1 + exp_value))`,
        checkCode: `middle = sigmoid(0)
positive = sigmoid(2)
RESULT = {
    "passed": abs(middle - 0.5) < 1e-12 and abs(positive - 0.8807970779) < 1e-9,
    "detail": f"sigmoid(0)={middle:.3f}, sigmoid(2)={positive:.3f}",
}`,
      },
      {
        id: "binary-cross-entropy",
        label: "Binary cross-entropy",
        purpose: "Measure how much probability a batch assigned to its observed binary targets.",
        concepts: [
          {
            name: "positive term",
            detail: "Uses −log(p) when the target is 1.",
          },
          {
            name: "negative term",
            detail: "Uses −log(1 − p) when the target is 0.",
          },
          {
            name: "epsilon",
            detail: "Keeps a boundary probability from sending log(0) to infinity.",
          },
        ],
        code: `import numpy as np

def binary_cross_entropy(probabilities, targets):
    predicted = np.asarray(probabilities, dtype=float)
    expected = np.asarray(targets, dtype=float)

    if predicted.ndim != 1 or expected.ndim != 1:
        raise ValueError("probabilities and targets must be one-dimensional vectors")
    if predicted.size == 0 or predicted.size != expected.size:
        raise ValueError("probabilities and targets must have the same non-zero length")
    if not np.all(np.isfinite(predicted)) or np.any((predicted < 0) | (predicted > 1)):
        raise ValueError("every probability must be a finite number between 0 and 1")
    if np.any((expected != 0) & (expected != 1)):
        raise ValueError("every binary target must be 0 or 1")

    epsilon = 1e-12
    safe = np.clip(predicted, epsilon, 1 - epsilon)
    losses = -(expected * np.log(safe) + (1 - expected) * np.log(1 - safe))
    return float(np.mean(losses))`,
        checkCode: `loss = binary_cross_entropy([0.9, 0.2], [1, 0])
RESULT = {
    "passed": abs(loss - 0.1642520335) < 1e-9,
    "detail": f"binary cross-entropy = {loss:.3f}",
}`,
      },
    ],
  },
  experiment: {
    variant: "binary-classification",
    title: "Inspect a classifier score",
    intro: "Change one logit and target, then compare the resulting probability and loss.",
  },
});

const neuralNetworksLesson = defineFoundationLesson({
  ...courseIdentity,
  id: "ml-neural-networks",
  number: 5,
  lessonNumber: 5,
  eyebrow: "Dense layers · Nonlinearity",
  title: "Neural Networks",
  thesis:
    "Chain learned linear transformations with a nonlinearity so the model can represent relationships that one linear layer cannot.",
  sources: [
    {
      role: "Guide",
      title: "Neural networks",
      authors: "Google Machine Learning Crash Course",
      year: "Current",
      url: "https://developers.google.com/machine-learning/crash-course/neural-networks",
      relevance:
        "Introduces nodes, hidden layers, activation functions, and the forward flow through a network.",
    },
    {
      role: "Guide",
      title: "Deep Feedforward Networks",
      authors: "Ian Goodfellow · Yoshua Bengio · Aaron Courville",
      year: "2016",
      url: "https://www.deeplearningbook.org/contents/mlp.html",
      relevance:
        "Develops affine layers, nonlinear activation functions, and multilayer networks from first principles.",
    },
  ],
  summary: [
    {
      label: "Dense layers.",
      body:
        "A dense layer computes W x + b. Each output unit has one row of weights and one bias, so it can combine every input feature. The resulting vector is called the layer's pre-activation because another function usually runs before the next layer.",
    },
    {
      label: "ReLU adds nonlinearity.",
      body:
        "ReLU replaces each negative value with zero and leaves each positive value unchanged. Without a nonlinear activation, several dense layers collapse into one larger linear transformation. The nonlinearity lets hidden units represent different patterns in different parts of the input space.",
    },
    {
      label: "The same pattern inside an LLM.",
      body:
        "A two-layer network runs dense → activation → dense. Transformer feed-forward blocks use this same overall structure at every token position, with wider hidden vectors and a different activation in many modern models. This lesson covers the forward computation; later model lessons add sequence structure and training.",
    },
  ],
  diagram: {
    title: "A two-layer forward pass",
    caption:
      "Shapes follow the data from a two-value input through a two-unit hidden layer to one output logit.",
    nodes: [
      { label: "Input", value: "x [2]" },
      { label: "First dense layer", value: "W1 x + b1 → [2]" },
      { label: "ReLU", value: "max(0, z) → [2]" },
      { label: "Output layer", value: "W2 h + b2" },
      { label: "Logit", value: "one finite score" },
    ],
  },
  dataset: {
    name: "Small Forward-Pass Set",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "4 inputs · 2 hidden units · 1 output",
    preview: "[2, −1] → hidden [2, 0] → logit 1.1",
  },
  implementation: {
    filename: "neural-networks.py",
    intro:
      "Apply ReLU to one vector, then compute a complete dense–ReLU–dense forward pass.",
    tensorOps: ["numpy", "np.asarray", "np.maximum", "np.isfinite"],
    codeBlocks: [
      {
        id: "relu",
        label: "ReLU activation",
        purpose: "Replace negative values with zero while keeping the vector shape unchanged.",
        concepts: [
          {
            name: "pre-activation",
            detail: "The vector produced by a dense layer before its activation function.",
          },
          {
            name: "maximum",
            detail: "Compares each value with zero independently.",
          },
          {
            name: "output shape",
            detail: "ReLU changes values but not the vector length.",
          },
        ],
        code: `import numpy as np

def relu(values):
    vector = np.asarray(values, dtype=float)
    if vector.ndim != 1:
        raise ValueError("relu needs a one-dimensional vector")
    if not np.all(np.isfinite(vector)):
        raise ValueError("relu values must be finite numbers")

    return np.maximum(vector, 0).tolist()`,
        checkCode: `activated = relu([-2, 0, 3])
RESULT = {
    "passed": activated == [0, 0, 3],
    "detail": f"ReLU output = {activated}",
}`,
      },
      {
        id: "two-layer-network",
        label: "Two-layer network",
        purpose: "Compute a dense–ReLU–dense forward pass that returns one output logit.",
        concepts: [
          {
            name: "W1 and b1",
            detail: "Map the input vector into the hidden width.",
          },
          {
            name: "hidden",
            detail: "The first dense output after negative values are removed by ReLU.",
          },
          {
            name: "W2 and b2",
            detail: "Combine the hidden units into one final score.",
          },
        ],
        code: `import numpy as np

def two_layer_network(features, parameters):
    if not isinstance(parameters, dict):
        raise ValueError("parameters must contain W1, b1, W2, and b2")
    if set(parameters) != {"W1", "b1", "W2", "b2"}:
        raise ValueError("parameters must contain exactly W1, b1, W2, and b2")

    x = np.asarray(features, dtype=float)
    W1 = np.asarray(parameters["W1"], dtype=float)
    b1 = np.asarray(parameters["b1"], dtype=float)
    W2 = np.asarray(parameters["W2"], dtype=float)
    b2 = float(parameters["b2"])

    if x.ndim != 1 or W1.ndim != 2 or W1.shape[1] != x.size:
        raise ValueError("first layer needs W1 with one column per input feature")
    if b1.ndim != 1 or b1.size != W1.shape[0]:
        raise ValueError("first layer needs one b1 value per hidden unit")
    if W2.ndim != 1 or W2.size != W1.shape[0]:
        raise ValueError("output layer needs one W2 value per hidden unit")
    arrays = [x, W1, b1, W2]
    if not all(np.all(np.isfinite(array)) for array in arrays) or not np.isfinite(b2):
        raise ValueError("network inputs and parameters must be finite numbers")

    hidden = np.maximum(W1 @ x + b1, 0)
    return float(W2 @ hidden + b2)`,
        checkCode: `logit = two_layer_network([2, -1], {
    "W1": [[1, 0], [0, 1]],
    "b1": [0, 0],
    "W2": [0.5, -1],
    "b2": 0.1,
})
RESULT = {
    "passed": abs(logit - 1.1) < 1e-12,
    "detail": f"logit = {logit:.1f}",
}`,
      },
    ],
  },
  experiment: {
    variant: "neural-networks",
    title: "Run a forward pass",
    intro: "Compare hidden activations and output logits for four fixed inputs.",
  },
});

export const machineLearningBasicsLessons = [
  trainingDataLesson,
  linearRegressionLesson,
  gradientDescentLesson,
  binaryClassificationLesson,
  neuralNetworksLesson,
];
