import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";
import { characterRnnTrainingPostlude } from "./character-rnn-training";

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
- During teacher-forced training, the observed next character is the loss target and the next recurrent input; the model's sampled prediction is not fed back.
- Backpropagation through time assigns credit through the unrolled recurrent computation.
- Generated text is sampled autoregressively: each sampled character becomes the next input.
- The essay demonstrates that models trained only for next-character prediction can learn local syntax, document structure, and longer patterns.
- The essay's examples use substantially larger LSTMs and datasets than this browser lab.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Represent the sequence.",
        body:
          "Start with a small vocabulary, such as {a, b, space}. Each input x_t is a one-hot vector: the slot for the current character is 1 and every other slot is 0. The subscript t simply means the character at the current position in the sequence.",
      },
      {
        label: "Update the memory.",
        body:
          "The transition h_t = tanh(Wxh x_t + Whh h_(t-1) + b) mixes the current character with the previous hidden state. For example, after reading “th”, h_(t-1) can carry evidence about “t” while x_t identifies “h”. The same Wxh, Whh, and b are reused at every position; only the input and state change.",
      },
      {
        label: "Predict and score.",
        body:
          "A second projection turns h_t into one raw score, or logit, per possible next character. Softmax converts the logits into probabilities. Cross-entropy is -log p(target): predicting the observed next character with probability 0.8 costs about 0.22, while probability 0.1 costs about 2.30.",
      },
      {
        label: "Assign credit through time.",
        body:
          "Training unrolls several recurrent steps and differentiates the total loss backward through them—backpropagation through time, or BPTT. This lab uses a short window (truncated BPTT) instead of the entire corpus. Because Whh is multiplied into the gradient at every step, gradients can grow rapidly; clipping caps each update before it changes the weights.",
      },
      {
        label: "Teacher forcing and sampled generation.",
        body:
          "During teacher-forced training, the observed corpus character x_(t+1) is both the cross-entropy loss target and the next input, regardless of what the model predicted. During sampled generation, there is no observed target: sample a character from p(x_(t+1)), encode that sample as the next input, update the hidden state, and repeat. The recurrence is shared, but the source of the next input is different.",
      },
    ],
    claims: {
      paper: "Next-character prediction can induce representations of syntax, formatting, and longer-range structure.",
      lab: "A real vanilla RNN is trained with truncated backpropagation and gradient clipping in this browser tab.",
      limit: "The supplied corpus and model are deliberately tiny; this does not reproduce the essay's multi-layer LSTM results.",
    },
    diagram: {
      title: "Training and generation",
      caption: "Read left to right. Teacher-forced training feeds the observed x_(t+1) into the next column and uses it as the loss target; the model's prediction is not fed back. Sampled generation instead draws x_(t+1) from the predicted distribution and feeds that sample into the next column. Wxh, Whh, Why, and the biases are shared in both paths.",
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
      size: "1,610 characters · fixed deterministic sequence",
      preview: "the receiver counted one quiet pulse. the signal crossed the empty sky.",
    },
    implementation: {
      filename: "character-rnn.py",
      intro:
        "Reconstruct in Python and NumPy the three operations used in the training loop. Start with the recurrent transition: it must use both x_t and h_(t-1). Then implement -log p(target) and symmetric clipping. Each cell runs independently, so a mistake in one operation will not erase passing work in another.",
      tensorOps: ["numpy", "np.asarray", "np.matmul", "np.tanh", "np.log", "np.clip", "tolist"],
      postlude: characterRnnTrainingPostlude,
      codeBlocks: [
        {
          id: "rnn-step",
          label: "Recurrent transition",
          purpose: "Combine the current input with the previous hidden state.",
          concepts: [
            { name: "input_vector / x_t", detail: "One-hot vector identifying the current character." },
            { name: "previous / h_(t-1)", detail: "Numeric memory carried from the preceding position." },
            { name: "np.tanh", detail: "Bounds each new hidden value between -1 and 1." },
          ],
          code: `import numpy as np

def rnn_step(input_vector, previous, parameters):
    Wxh = np.asarray(parameters["Wxh"], dtype=float)
    Whh = np.asarray(parameters["Whh"], dtype=float)
    bias = np.asarray(parameters["bias"], dtype=float)
    input_projection = Wxh @ np.asarray(input_vector, dtype=float)
    state_projection = Whh @ np.asarray(previous, dtype=float)
    return np.tanh(input_projection + state_projection + bias).tolist()`,
          checkCode: `state = rnn_step([1, 0], [0, 0], {
    "Wxh": [[1, 0], [0, 1]], "Whh": [[0, 0], [0, 0]], "bias": [0, 0]
})
RESULT = {
    "passed": len(state) == 2 and state[0] > 0.7 and state[1] == 0,
    "detail": "h = [" + ", ".join(f"{value:.3f}" for value in state) + "]",
}`,
        },
        {
          id: "cross-entropy",
          label: "Cross-entropy loss",
          purpose: "Penalize low probability on the observed next character.",
          concepts: [
            { name: "probabilities", detail: "Normalized next-character distribution." },
            { name: "target_index", detail: "Vocabulary index of the observed next character." },
            { name: "np.log", detail: "Computes -log(probabilities[target_index]) after a numerical floor." },
          ],
          code: `import numpy as np

def cross_entropy(probabilities, target_index):
    values = np.asarray(probabilities, dtype=float)
    if (
        values.ndim != 1
        or type(target_index) is not int
        or target_index < 0
        or target_index >= values.size
    ):
        raise ValueError("nllLoss needs a probability vector and valid target index")
    probability = max(float(values[target_index]), 1e-12)
    return float(-np.log(probability))`,
          checkCode: `good = cross_entropy([0.1, 0.8, 0.1], 1)
bad = cross_entropy([0.8, 0.1, 0.1], 1)
RESULT = {
    "passed": np.isfinite(good) and good < bad,
    "detail": f"correct target loss {good:.3f}",
}`,
        },
        {
          id: "gradient-clipping",
          label: "Gradient clipping",
          purpose: "Bound the update produced by unstable recurrent gradients.",
          concepts: [
            { name: "limit", detail: "Largest allowed absolute gradient value." },
            { name: "np.clip", detail: "Clamps every value to the interval [-limit, limit]." },
            { name: "tolist", detail: "Returns a plain JSON-serializable vector at the lesson boundary." },
          ],
          code: `import numpy as np

def clip_gradients(gradients, limit=5):
    if limit < 0:
        raise ValueError("clip minimum cannot exceed maximum")
    return np.clip(np.asarray(gradients, dtype=float), -limit, limit).tolist()`,
          checkCode: `clipped = clip_gradients([-12, -2, 0, 3, 20], 5)
RESULT = {
    "passed": clipped == [-5, -2, 0, 3, 5],
    "detail": ", ".join(f"{value:g}" for value in clipped),
}`,
        },
      ],
    },
    experiment: {
      kind: "rnn",
      title: "Train the recurrent model",
      intro: "Run the supplied reference trainer for 600 truncated-BPTT updates, then inspect its loss curve and sample. This replay is separate from the learner functions verified in the IDE.",
    },
  } satisfies Omit<CourseLesson, "sources">;
