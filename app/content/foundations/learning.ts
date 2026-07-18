import type { LessonLearningOutcome } from "../llm-systems/learning";

export const foundationLearningOutcomes = {
  "arrays-and-shapes": {
    concept: "An array's rank tells you how many axes it has, while its shape gives the length of each axis.",
    before: "A list of numbers has no clear description of how its values are arranged.",
    after: "Rank, shape, and size describe the arrangement without changing the stored values.",
    check: {
      id: "shape-rows-columns",
      prompt: "What does the matrix shape (4, 3) mean?",
      choices: [
        { id: "rows-columns", label: "4 rows and 3 columns" },
        { id: "columns-rows", label: "4 columns and 3 rows" },
        { id: "values", label: "Only 4 values total" },
      ],
      correctChoiceId: "rows-columns",
      explanation: "For a matrix, shape lists the row count first and the column count second, so (4, 3) contains 12 values.",
    },
  },
  "vector-operations": {
    concept: "Vector addition and scaling work coordinate by coordinate, while a norm summarizes the vector's length.",
    before: "A vector is only a row of unrelated numbers.",
    after: "You can combine vectors, change their scale, and measure their length with explicit rules.",
    check: {
      id: "scale-length",
      prompt: "If a vector is multiplied by 3, what happens to its length?",
      choices: [
        { id: "triple", label: "Its length is multiplied by 3" },
        { id: "same", label: "Its length stays the same" },
        { id: "nine", label: "Its length is multiplied by 9" },
      ],
      correctChoiceId: "triple",
      explanation: "Multiplying every coordinate by 3 stretches the vector by 3. The squared values grow by 9, and the square root brings the length back to a factor of 3.",
    },
  },
  "dot-products": {
    concept: "A dot product multiplies matching coordinates and adds them, producing one number that reflects directional alignment.",
    before: "There is no single calculation for comparing two vector directions.",
    after: "The dot product and cosine similarity distinguish aligned, perpendicular, and opposite directions.",
    check: {
      id: "perpendicular-dot",
      prompt: "What is the dot product of two perpendicular vectors?",
      choices: [
        { id: "zero", label: "0" },
        { id: "one", label: "1" },
        { id: "negative", label: "Always -1" },
      ],
      correctChoiceId: "zero",
      explanation: "Perpendicular directions have no component along each other, so their matching products cancel to zero.",
    },
  },
  "matrix-multiplication": {
    concept: "A matrix-vector product computes one dot product per matrix row and produces one output value per row.",
    before: "A table of weights and an input vector do not yet have a defined output.",
    after: "Matrix multiplication turns the input into a new vector, and a bias shifts each output coordinate.",
    check: {
      id: "matrix-vector-shape",
      prompt: "What is the output shape of a (3, 2) matrix multiplied by a (2,) vector?",
      choices: [
        { id: "three", label: "(3,)" },
        { id: "two", label: "(2,)" },
        { id: "matrix", label: "(3, 2)" },
      ],
      correctChoiceId: "three",
      explanation: "The two inner coordinates match, and each of the matrix's three rows produces one dot product, so the result has three values.",
    },
  },
  "batches-and-broadcasting": {
    concept: "A batch stores examples as rows, applies the same weights to every row, and broadcasts one bias across them.",
    before: "Each example appears to need a separate copy of the model calculation.",
    after: "One batched matrix operation processes every row while sharing the same parameters.",
    check: {
      id: "batch-output-shape",
      prompt: "Inputs have shape (5, 4) and weights have shape (3, 4). What is the output shape?",
      choices: [
        { id: "five-three", label: "(5, 3)" },
        { id: "three-five", label: "(3, 5)" },
        { id: "five-four", label: "(5, 4)" },
      ],
      correctChoiceId: "five-three",
      explanation: "The five input rows stay separate. Each row produces one value for each of the three weight rows, giving shape (5, 3).",
    },
  },
  "ml-training-data": {
    concept: "Features are the inputs used to make a prediction, targets are the answers, and validation examples stay out of training.",
    before: "Every column and every row appears to play the same role.",
    after: "You can separate inputs from targets and keep an untouched set for evaluating the trained model.",
    check: {
      id: "training-updates",
      prompt: "Which rows are allowed to update the model's weights?",
      choices: [
        { id: "training", label: "Training rows only" },
        { id: "validation", label: "Validation rows only" },
        { id: "both", label: "Training and validation rows" },
      ],
      correctChoiceId: "training",
      explanation: "Validation rows measure how the model handles held-out examples. Using them for updates would make that measurement less trustworthy.",
    },
  },
  "ml-linear-regression": {
    concept: "A linear model combines fixed input features with learned weights and a bias, then measures numerical error with mean squared error.",
    before: "Predictions and errors are not connected to a specific calculation.",
    after: "You can calculate a prediction and one loss value that summarizes how far predictions are from targets.",
    check: {
      id: "learned-parameters",
      prompt: "What changes when a linear model trains?",
      choices: [
        { id: "parameters", label: "The weights and bias" },
        { id: "features", label: "The input feature values" },
        { id: "targets", label: "The correct target values" },
      ],
      correctChoiceId: "parameters",
      explanation: "The examples stay fixed. Training adjusts the weights and bias so the model's predictions produce a lower loss on those examples.",
    },
  },
  "ml-gradient-descent": {
    concept: "A gradient reports the local direction of increasing loss, so gradient descent subtracts a small scaled gradient.",
    before: "There is no rule for deciding how a parameter should move after an error.",
    after: "A gradient and learning rate produce a concrete update for each parameter.",
    check: {
      id: "subtract-gradient",
      prompt: "Why does gradient descent subtract the gradient?",
      choices: [
        { id: "decrease", label: "The gradient points toward local increase, so subtracting moves toward decrease" },
        { id: "positive", label: "All gradients are positive numbers" },
        { id: "normalize", label: "Subtraction makes every parameter sum to 1" },
      ],
      correctChoiceId: "decrease",
      explanation: "The gradient is the local uphill direction. Taking a small step in the opposite direction usually lowers the loss nearby.",
    },
  },
  "ml-binary-classification": {
    concept: "Sigmoid turns a real-valued logit into a probability, and binary cross-entropy scores that probability against a zero-or-one target.",
    before: "A model score has no direct probability interpretation.",
    after: "You can map the score to a bounded probability and penalize confident wrong predictions strongly.",
    check: {
      id: "zero-logit",
      prompt: "What probability does sigmoid assign to a logit of 0?",
      choices: [
        { id: "half", label: "0.5" },
        { id: "zero", label: "0" },
        { id: "one", label: "1" },
      ],
      correctChoiceId: "half",
      explanation: "At zero, exp(0) is 1, so sigmoid gives 1 / (1 + 1) = 0.5. Positive logits move above 0.5 and negative logits move below it.",
    },
  },
  "ml-neural-networks": {
    concept: "A neural network alternates learned affine layers with nonlinear functions such as ReLU.",
    before: "Stacking linear calculations appears to create a more expressive model by itself.",
    after: "ReLU changes the computation so two layers can represent behavior that one affine map cannot.",
    check: {
      id: "relu-purpose",
      prompt: "Why put ReLU between two dense layers?",
      choices: [
        { id: "nonlinear", label: "Without a nonlinearity, the two affine layers collapse into one affine map" },
        { id: "probability", label: "ReLU makes every output add up to 1" },
        { id: "storage", label: "ReLU saves the training data" },
      ],
      correctChoiceId: "nonlinear",
      explanation: "Composing affine maps still gives an affine map. ReLU bends the function between layers, which lets the network represent more complex relationships.",
    },
  },
} satisfies Readonly<Record<string, LessonLearningOutcome>>;
