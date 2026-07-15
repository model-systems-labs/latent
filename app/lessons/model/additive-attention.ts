import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const additiveAttentionLesson = {
    id: "additive-attention",
    number: 4,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Alignment · Additive attention",
    title: "Additive Attention",
    thesis:
      "At each output step, the decoder can build a new context vector by learning a soft alignment—how much to focus—over every encoder state.",
    paperUrl: "https://arxiv.org/abs/1409.0473",
    paperTitle: "Neural Machine Translation by Jointly Learning to Align and Translate",
    authors: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio",
    year: "2014 preprint · ICLR 2015",
    paperContext: `
This lesson walks through "Neural Machine Translation by Jointly Learning to Align and Translate" by Bahdanau, Cho, and Bengio.
- Older encoder-decoder systems squeezed a whole source sentence into one fixed-length vector.
- The paper introduces a learned alignment model that scores every encoder state against the decoder's current state.
- Softmax turns those scores into attention weights. Their weighted sum becomes the context vector for that step.
- Gradient descent trains the alignment and translation parts together.
- In the browser lab, you'll train the additive scoring function on a fixed date-alignment task, not a full translation system.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "The fixed-vector squeeze.",
        body:
          "Without attention, the encoder has to squeeze all n source positions into one fixed vector before decoding starts. The decoder gets that same summary for every output token. That means details needed late in a long sequence have to survive both the initial squeeze and many recurrent updates.",
      },
      {
        label: "One decoding step.",
        body:
          "The encoder reads the source sequence and leaves one state h_i at each position. The decoder produces the target one token at a time. Right before output step t, its current state becomes the query q_t, which can look back at every encoder state. In notation, q_t has shape [d_s], and H = [h_1, ..., h_n] has shape [n, d_h]. The same scorer runs n times—once for q_t paired with each h_i—and produces one number e_(t,i) per source position.",
      },
      {
        label: "Additive score.",
        body:
          "The score is e_(t,i) = v^T tanh(Wq q_t + Wk h_i + b). Wq and Wk project the query and key into the same attention width d_a. Then tanh combines them, and v turns the d_a values into one number. That's additive attention. A dot-product scorer uses q_t^T h_i instead, with no scoring MLP inside the comparison.",
      },
      {
        label: "Normalize across positions.",
        body:
          "For a given t, apply softmax across all n source-position scores: alpha_(t,:) = softmax(e_(t,:)). The weights are positive and add up to 1. In the date task, the row that outputs the year should put most of its weight on the source state for 2026. A large standalone score isn't enough; it has to win against the other positions.",
      },
      {
        label: "Build the context.",
        body:
          "The context for this step is c_t = sum_i alpha_(t,i) h_i, with shape [d_h]. Multiply each encoder state by its matching alignment weight, then add the results coordinate by coordinate. The decoder uses c_t for the current output. At the month and day steps, a new query creates new scores, weights, and context. Since every operation is differentiable, the translation loss can train the alignment along with the rest of the model.",
      },
    ],
    claims: {
      paper: "Learned soft alignment eases the fixed-length bottleneck in neural translation.",
      lab: "You'll train a real additive scorer to match output roles with the given encoder states and produce a learned heatmap.",
      limit: "This small experiment uses labeled alignment roles instead of the paper's end-to-end translation goal.",
    },
    diagram: {
      title: "One output step: emit year",
      caption: "The experiment runs this calculation for the year, month, and day. Read each heatmap row across the source positions. A focused row has one alpha near 1, while uniform attention stays at 0.333 for all three positions.",
      nodes: [
        { label: "Query", value: "q_year [d_s]" },
        { label: "Encoder states", value: "H = [h_day, h_month, h_year] [3 × d_h]" },
        { label: "Additive scores", value: "e = [-1.8, -0.9, 2.4] [3]" },
        { label: "Alignment", value: "alpha = softmax(e) = [.014, .035, .951] [3]" },
        { label: "Context", value: "c_year = .014h_day + .035h_month + .951h_year [d_h]" },
      ],
    },
    questions: {
      intro: "Ask about the fixed-vector bottleneck, how the weights are normalized, why the setup is differentiable, or how this differs from Transformer self-attention.",
      suggestions: [
        "Why is the context vector dynamic?",
        "Is an attention heatmap an explanation?",
        "How is this different from self-attention?",
      ],
    },
    dataset: {
      name: "Date Alignment",
      source: "Fixed synthetic task",
      license: "CC0",
      size: "3 semantic roles · 3 fixed alignment cases · 2,000 epochs",
      preview: "14 · March · 2026  →  2026 · 03 · 14",
    },
    implementation: {
      filename: "additive-attention.py",
      intro: "Build one attention step in three separate Python/NumPy cells. First score one query-key pair with the additive MLP. Then run softmax over all source-position scores. Finally, multiply each state by its matching alpha and add the results coordinate by coordinate.",
      tensorOps: ["numpy", "np.asarray", "np.matmul", "np.tanh", "np.dot", "np.exp", "tolist"],
      codeBlocks: [
        {
          id: "additive-score",
          label: "Compatibility score",
          purpose: "Score one decoder query against one encoder state.",
          concepts: [
            { name: "Wq", detail: "Moves the decoder query into attention space." },
            { name: "Wk", detail: "Moves one encoder state into that same space." },
            { name: "bias + np.tanh", detail: "Combines the two projections nonlinearly before reducing them." },
            { name: "v", detail: "Turns the attention-width hidden vector into one score." },
          ],
          code: `import numpy as np

def additive_score(query, key, parameters):
    Wq = np.asarray(parameters["Wq"], dtype=float)
    Wk = np.asarray(parameters["Wk"], dtype=float)
    v = np.asarray(parameters["v"], dtype=float)
    bias = np.asarray(parameters["bias"], dtype=float)
    query_term = Wq @ np.asarray(query, dtype=float)
    key_term = Wk @ np.asarray(key, dtype=float)
    hidden = np.tanh(query_term + key_term + bias)
    return float(v @ hidden)`,
          checkCode: `score = additive_score([1, 0], [0, 1], {
    "Wq": [[1, 0], [0, 1]], "Wk": [[1, 0], [0, 1]],
    "v": [0.5, -0.5], "bias": [0, 0],
})
RESULT = {
    "passed": np.isfinite(score),
    "detail": f"e = {score:.4f}",
}`,
        },
        {
          id: "attention-softmax",
          label: "Alignment weights",
          purpose: "Turn the compatibility scores across source positions into weights.",
          concepts: [
            { name: "scores", detail: "One compatibility score for each encoder state." },
            { name: "shifted", detail: "Subtracts the largest score before normalizing across all source positions." },
            { name: "tolist", detail: "Returns one JSON-friendly alignment weight for each source position." },
          ],
          code: `import numpy as np

def attention_weights(scores):
    values = np.asarray(scores, dtype=float)
    if values.size == 0:
        return []
    shifted = values - np.max(values)
    weights = np.exp(shifted)
    return (weights / weights.sum()).tolist()`,
          checkCode: `weights = attention_weights([2, 1, 0])
total = sum(weights)
RESULT = {
    "passed": weights[0] > weights[1] and abs(total - 1) < 1e-9,
    "detail": ", ".join(f"{value:.3f}" for value in weights),
}`,
        },
        {
          id: "context-vector",
          label: "Weighted context",
          purpose: "Combine the encoder states using the learned alignment weights.",
          concepts: [
            { name: "states", detail: "The encoder representation at each source position." },
            { name: "weights / alpha", detail: "One normalized NumPy weight that matches each state." },
            { name: "dimension", detail: "The width of the context vector you get back." },
          ],
          code: `import numpy as np

def context_vector(states, weights):
    matrix = np.asarray(states, dtype=float)
    alpha = np.asarray(weights, dtype=float)
    if matrix.ndim != 2 or alpha.ndim != 1 or matrix.shape[0] != alpha.size:
        raise ValueError("weightedSum needs [items, width] states and [items] weights")
    return (alpha @ matrix).tolist()`,
          checkCode: `context = context_vector([[1, 0], [0, 1]], [0.75, 0.25])
RESULT = {
    "passed": context == [0.75, 0.25],
    "detail": "c = [" + ", ".join(f"{value:g}" for value in context) + "]",
}`,
        },
      ],
    },
    experiment: {
      kind: "attention",
      title: "Learn the alignment function",
      intro: "Run the additive-attention trainer on three fixed cases, then compare what it learned with a uniform baseline.",
    },
  } satisfies Omit<CourseLesson, "sources">;
