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
      "A recurrent network can learn a probability distribution for the next character by updating a hidden state over and over and minimizing cross-entropy through time.",
    paperUrl: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
    paperTitle: "The Unreasonable Effectiveness of Recurrent Neural Networks",
    authors: "Andrej Karpathy",
    year: "2015 · technical essay",
    paperContext: `
This lesson walks through Andrej Karpathy's 2015 technical essay "The Unreasonable Effectiveness of Recurrent Neural Networks."
- A recurrent network uses the same learned transition at every spot in a sequence and carries its hidden state forward.
- A character language model takes in one character, predicts probabilities for the next one, and trains with softmax cross-entropy.
- With teacher forcing, the real next character is both the loss target and the next recurrent input. The model doesn't feed its sampled guess back in.
- Backpropagation through time sends credit and blame through the unrolled recurrent steps.
- When the model generates text, each sampled character becomes its next input.
- The essay shows that next-character prediction alone can teach a model local syntax, document structure, and longer patterns.
- The examples in the essay use much larger LSTMs and datasets than this browser lab.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Represent each character.",
        body:
          "Start with a small vocabulary, like {a, b, space}. Each input x_t is a one-hot vector: the current character's slot is 1, and every other slot is 0. The subscript t just means the character at the current position in the sequence.",
      },
      {
        label: "Update the model's memory.",
        body:
          "The transition h_t = tanh(Wxh x_t + Whh h_(t-1) + b) mixes the current character with the previous hidden state. For example, after reading “th,” h_(t-1) can carry information about “t” while x_t identifies “h.” The model reuses the same Wxh, Whh, and b at every position. Only the input and state change.",
      },
      {
        label: "Make a prediction and score it.",
        body:
          "A second projection turns h_t into one raw score, or logit, for every possible next character. Softmax turns those logits into probabilities. Cross-entropy is -log p(target): giving the real next character probability 0.8 costs about 0.22, while giving it probability 0.1 costs about 2.30.",
      },
      {
        label: "Send credit back through time.",
        body:
          "Training unrolls several recurrent steps and sends the total loss backward through them. That's backpropagation through time, or BPTT. This lab uses a short window, called truncated BPTT, instead of the whole corpus. Since Whh gets multiplied into the gradient at every step, gradients can grow fast. Clipping puts a cap on each update before it changes the weights.",
      },
      {
        label: "Teacher forcing vs. sampled generation.",
        body:
          "During teacher-forced training, the real corpus character x_(t+1) is both the cross-entropy target and the next input, no matter what the model predicted. During generation, there's no known target. You sample a character from p(x_(t+1)), use that sample as the next input, update the hidden state, and repeat. The recurrent step is the same; what changes is where the next input comes from.",
      },
    ],
    claims: {
      paper: "Next-character prediction can teach a model patterns in syntax, formatting, and longer-range structure.",
      lab: "You'll train a real vanilla RNN with truncated backpropagation and gradient clipping right in this browser tab.",
      limit: "The provided corpus and model are intentionally tiny, so this doesn't recreate the essay's multi-layer LSTM results.",
    },
    diagram: {
      title: "Training and generation",
      caption: "Read from left to right. With teacher forcing, the real x_(t+1) goes into the next column and also serves as the loss target; the model doesn't feed its guess back in. During generation, x_(t+1) is sampled from the predicted distribution and fed into the next column. Both paths share Wxh, Whh, Why, and the biases.",
      nodes: [
        { label: "Input", value: "x_t" },
        { label: "Previous state", value: "h_(t-1)" },
        { label: "Transition", value: "tanh(Wx + Uh + b)" },
        { label: "Prediction", value: "p(x_(t+1))" },
      ],
    },
    questions: {
      intro: "Ask about recurrence, backpropagation through time, what the hidden state can hold, or what this browser experiment can't show.",
      suggestions: [
        "Why can recurrent gradients explode?",
        "What information can the hidden state keep?",
        "What does next-character loss actually reward?",
      ],
    },
    dataset: {
      name: "Signal Notes",
      source: "Original synthetic course corpus",
      license: "CC0",
      size: "1,610 characters · fixed repeatable sequence",
      preview: "the receiver counted one quiet pulse. the signal crossed the empty sky.",
    },
    implementation: {
      filename: "character-rnn.py",
      intro:
        "Rebuild the training loop's three main operations in Python and NumPy. Start with the recurrent transition, which has to use both x_t and h_(t-1). Then build -log p(target) and symmetric clipping. Each cell runs on its own, so a mistake in one won't wipe out passing work in another.",
      tensorOps: ["numpy", "np.asarray", "np.matmul", "np.tanh", "np.log", "np.clip", "tolist"],
      postlude: characterRnnTrainingPostlude,
      codeBlocks: [
        {
          id: "rnn-step",
          label: "Recurrent transition",
          purpose: "Combine the current input with the previous hidden state.",
          concepts: [
            { name: "input_vector / x_t", detail: "A one-hot vector that identifies the current character." },
            { name: "previous / h_(t-1)", detail: "The numeric memory carried over from the previous position." },
            { name: "np.tanh", detail: "Keeps each new hidden value between -1 and 1." },
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
          purpose: "Penalize the model when it gives the real next character a low probability.",
          concepts: [
            { name: "probabilities", detail: "The normalized probabilities for the next character." },
            { name: "target_index", detail: "The vocabulary index of the real next character." },
            { name: "np.log", detail: "Calculates -log(probabilities[target_index]) after applying a numerical floor." },
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
          purpose: "Put a limit on updates from unstable recurrent gradients.",
          concepts: [
            { name: "limit", detail: "The largest absolute gradient value you'll allow." },
            { name: "np.clip", detail: "Pins every value to the range [-limit, limit]." },
            { name: "tolist", detail: "Returns a plain, JSON-friendly vector from the lesson." },
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
      intro: "Run the provided trainer for 600 truncated-BPTT updates, then look at its loss curve and sample. This replay is separate from the functions you work on in the IDE.",
    },
  } satisfies Omit<CourseLesson, "sources">;
