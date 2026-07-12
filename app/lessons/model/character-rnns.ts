import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const characterRnnsLesson = {
    id: "character-rnns",
    number: 1,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Sequence models · Karpathy · 2015",
    title: "Character RNNs",
    thesis:
      "A recurrent network can learn a distribution over the next character by repeatedly updating a hidden state and minimizing cross-entropy through time.",
    paperUrl: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
    paperTitle: "The Unreasonable Effectiveness of Recurrent Neural Networks",
    authors: "Andrej Karpathy",
    year: "2015 · technical essay",
    paperContext: `
This lesson concerns Andrej Karpathy's 2015 technical essay "The Unreasonable Effectiveness of Recurrent Neural Networks."
- A recurrent network applies the same learned transition at every sequence position and carries a hidden state forward.
- A character language model receives a character, predicts a distribution over the next character, and is trained with softmax cross-entropy.
- Backpropagation through time assigns credit through the unrolled recurrent computation.
- Generated text is sampled autoregressively: each sampled character becomes the next input.
- The essay demonstrates that models trained only for next-character prediction can learn local syntax, document structure, and longer patterns.
- The essay's examples use substantially larger LSTMs and datasets than this browser lab.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "State transition.",
        body:
          "At position t, the model combines the current character vector x_t with the previous hidden state h_(t-1). The same matrices are reused across the entire sequence, so a fixed parameter set can process inputs of arbitrary length.",
      },
      {
        label: "Training objective.",
        body:
          "The output state is projected to one logit per character. Softmax converts those logits into a next-character distribution, and cross-entropy penalizes the probability assigned to the observed next character.",
      },
      {
        label: "Temporal credit.",
        body:
          "Backpropagation through time unrolls the recurrent transition and accumulates parameter gradients from multiple positions. Repeated multiplication through the hidden transition can produce unstable gradients, which motivates clipping and gated recurrent architectures.",
      },
      {
        label: "Generation.",
        body:
          "After training, the model samples a character, feeds it back as the next input, and repeats. It does not store sentences explicitly; regularities emerge because predicting the next character rewards useful internal state.",
      },
    ],
    claims: {
      paper: "Next-character prediction can induce representations of syntax, formatting, and longer-range structure.",
      lab: "A real vanilla RNN is trained with truncated backpropagation and gradient clipping in this browser tab.",
      limit: "The supplied corpus and model are deliberately tiny; this does not reproduce the essay's multi-layer LSTM results.",
    },
    diagram: {
      title: "Unrolled recurrent computation",
      caption: "The transition parameters are shared at every position; only the state and input change.",
      nodes: [
        { label: "Input", value: "x_t" },
        { label: "Previous state", value: "h_(t-1)" },
        { label: "Transition", value: "tanh(Wx + Uh + b)" },
        { label: "Prediction", value: "p(x_(t+1))" },
      ],
    },
    questions: {
      intro: "Ask about recurrence, backpropagation through time, hidden-state behavior, or the limits of the browser experiment.",
      suggestions: [
        "Why can recurrent gradients explode?",
        "What information can the hidden state retain?",
        "What does next-character loss actually reward?",
      ],
    },
    dataset: {
      name: "Signal Notes",
      source: "Original synthetic course corpus",
      license: "CC0",
      size: "430 characters · fixed split",
      preview: "the receiver counted one quiet pulse. the signal crossed the empty sky.",
    },
    implementation: {
      filename: "character-rnn.js",
      intro:
        "The complete reference implementation is visible. Hide one transition, loss, or stabilization block and reconstruct it while the rest of the program remains in place.",
      tensorOps: ["tensor", "matmul", "add", "tanh", "nllLoss", "clip", "toArray"],
      codeBlocks: [
        {
          id: "rnn-step",
          label: "Recurrent transition",
          purpose: "Combine the current input with the previous hidden state.",
          concepts: [
            { name: "input", detail: "One-hot character vector for the current position." },
            { name: "previous", detail: "Hidden state carried from the preceding position." },
            { name: "tanh", detail: "Differentiable bounded nonlinearity applied to each hidden unit." },
          ],
          code: `function rnnStep(input, previous, { Wxh, Whh, bias }) {
  const inputProjection = matmul(tensor(Wxh), tensor(input));
  const stateProjection = matmul(tensor(Whh), tensor(previous));
  return toArray(tanh(add(add(inputProjection, stateProjection), tensor(bias))));
}`,
          checkCode: `const state = rnnStep([1, 0], [0, 0], {
  Wxh: [[1, 0], [0, 1]], Whh: [[0, 0], [0, 0]], bias: [0, 0]
});
return { passed: state.length === 2 && state[0] > 0.7 && state[1] === 0, detail: "h = [" + state.map(v => v.toFixed(3)).join(", ") + "]" };`,
        },
        {
          id: "cross-entropy",
          label: "Cross-entropy loss",
          purpose: "Penalize low probability on the observed next character.",
          concepts: [
            { name: "probabilities", detail: "Normalized next-character distribution." },
            { name: "targetIndex", detail: "Vocabulary index of the observed next character." },
            { name: "nllLoss", detail: "Applies the finite logarithm boundary inside the tensor runtime." },
          ],
          code: `function crossEntropy(probabilities, targetIndex) {
  return nllLoss(tensor(probabilities), targetIndex).item();
}`,
          checkCode: `const good = crossEntropy([0.1, 0.8, 0.1], 1);
const bad = crossEntropy([0.8, 0.1, 0.1], 1);
return { passed: Number.isFinite(good) && good < bad, detail: "correct target loss " + good.toFixed(3) };`,
        },
        {
          id: "gradient-clipping",
          label: "Gradient clipping",
          purpose: "Bound the update produced by unstable recurrent gradients.",
          concepts: [
            { name: "limit", detail: "Largest allowed absolute gradient value." },
            { name: "clip", detail: "Applies both gradient boundaries element by element." },
            { name: "toArray", detail: "Returns a plain vector at the lesson boundary." },
          ],
          code: `function clipGradients(gradients, limit = 5) {
  return toArray(clip(tensor(gradients), -limit, limit));
}`,
          checkCode: `const clipped = clipGradients([-12, -2, 0, 3, 20], 5);
return { passed: clipped.join(",") === "-5,-2,0,3,5", detail: clipped.join(", ") };`,
        },
      ],
    },
    experiment: {
      kind: "rnn",
      title: "Train the recurrent model",
      intro: "Run 600 truncated-BPTT updates, then inspect the loss curve and sample from the trained character distribution.",
    },
  } satisfies Omit<CourseLesson, "sources">;
