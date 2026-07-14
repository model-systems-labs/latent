import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const additiveAttentionLesson = {
    id: "additive-attention",
    number: 4,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Alignment · Bahdanau et al. · 2014 / 2015",
    title: "Additive Attention",
    thesis:
      "The decoder can construct a different context vector at every output step by learning soft alignments over all encoder states.",
    paperUrl: "https://arxiv.org/abs/1409.0473",
    paperTitle: "Neural Machine Translation by Jointly Learning to Align and Translate",
    authors: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio",
    year: "2014 preprint · ICLR 2015",
    paperContext: `
This lesson concerns "Neural Machine Translation by Jointly Learning to Align and Translate" by Bahdanau, Cho, and Bengio.
- Earlier encoder-decoder systems compressed a source sentence into a single fixed-length vector.
- The paper proposes a learned alignment model that scores each encoder state for the current decoder state.
- Softmax converts scores into attention weights, and their weighted sum becomes a step-specific context vector.
- The alignment and translation components are trained jointly by gradient descent.
- The browser lab trains the additive scoring function on a deterministic date-alignment task, not a full translation system.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Fixed-vector bottleneck.",
        body:
          "Without attention, the encoder must compress all n source positions into one fixed vector before decoding begins. The decoder receives that same summary while producing every output token, so details needed late in a long sequence must survive both compression and many recurrent updates.",
      },
      {
        label: "One decoder step.",
        body:
          "An encoder reads the source sequence and leaves one state h_i at each source position. A decoder produces the target sequence one token at a time; immediately before output step t, its current decoder state becomes the query q_t, which can look back at every encoder state. In notation, q_t has shape [d_s] and the encoder states H = [h_1, ..., h_n] have shape [n, d_h]. The same scorer is applied n times—once to q_t and each h_i—so it produces one scalar e_(t,i) for every source position.",
      },
      {
        label: "Additive score.",
        body:
          "The score is e_(t,i) = v^T tanh(Wq q_t + Wk h_i + b). Wq and Wk project the query and key into a shared attention width d_a; tanh combines them nonlinearly; v collapses the d_a values to one number. This is additive attention. A dot-product scorer instead uses q_t^T h_i and has no scoring MLP inside that comparison.",
      },
      {
        label: "Normalize over positions.",
        body:
          "For a fixed t, softmax is applied across the n source-position scores: alpha_(t,:) = softmax(e_(t,:)). The weights are positive and sum to 1. In the date task, the row for emitting year should place most of its mass on the source state for 2026—not merely assign a large independent score to it.",
      },
      {
        label: "Construct the context.",
        body:
          "The step-specific context is c_t = sum_i alpha_(t,i) h_i, with shape [d_h]. Multiply each encoder state by its corresponding alignment weight, then sum coordinate-wise. The decoder uses c_t for the current output; at the month and day steps a new query produces new scores, weights, and context. Because every operation is differentiable, the translation loss can train the alignment jointly with the model.",
      },
    ],
    claims: {
      paper: "Learned soft alignment reduces the fixed-length representation bottleneck in neural translation.",
      lab: "A real additive scorer is optimized to align output roles with supplied encoder states and produces a learned heatmap.",
      limit: "Supervised alignment roles replace the paper's end-to-end translation objective in this small experiment.",
    },
    diagram: {
      title: "One output step: emit year",
      caption: "The experiment repeats this computation for year, month, and day. Read each heatmap row across source positions: a concentrated row has one alpha near 1, while uniform attention stays at 0.333 for all three positions.",
      nodes: [
        { label: "Query", value: "q_year [d_s]" },
        { label: "Encoder states", value: "H = [h_day, h_month, h_year] [3 × d_h]" },
        { label: "Additive scores", value: "e = [-1.8, -0.9, 2.4] [3]" },
        { label: "Alignment", value: "alpha = softmax(e) = [.014, .035, .951] [3]" },
        { label: "Context", value: "c_year = .014h_day + .035h_month + .951h_year [d_h]" },
      ],
    },
    questions: {
      intro: "Ask about the fixed-vector bottleneck, alignment normalization, differentiability, or how this attention differs from Transformer self-attention.",
      suggestions: [
        "Why is the context vector dynamic?",
        "Is an attention heatmap an explanation?",
        "How is this different from self-attention?",
      ],
    },
    dataset: {
      name: "Date Alignment",
      source: "Deterministic synthetic task",
      license: "CC0",
      size: "3 semantic roles · 3 fixed alignment cases · 2,000 epochs",
      preview: "14 · March · 2026  →  2026 · 03 · 14",
    },
    implementation: {
      filename: "additive-attention.py",
      intro: "Implement one attention step in three isolated Python/NumPy cells: score one query-key pair with the additive MLP, softmax all source-position scores together, then multiply each state by its matching alpha and sum by coordinate.",
      tensorOps: ["numpy", "np.asarray", "np.matmul", "np.tanh", "np.dot", "np.exp", "tolist"],
      codeBlocks: [
        {
          id: "additive-score",
          label: "Compatibility score",
          purpose: "Score one decoder query against one encoder state.",
          concepts: [
            { name: "Wq", detail: "Projects the decoder query into attention space." },
            { name: "Wk", detail: "Projects one encoder state into the same space." },
            { name: "bias + np.tanh", detail: "Combines both projections nonlinearly before reduction." },
            { name: "v", detail: "Collapses the attention-width hidden vector to one scalar score." },
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
          purpose: "Normalize compatibility scores across source positions.",
          concepts: [
            { name: "scores", detail: "One scalar compatibility value per encoder state." },
            { name: "shifted", detail: "Subtracts the maximum score before normalizing across every source position." },
            { name: "tolist", detail: "Returns one JSON-serializable alignment weight per source position." },
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
          purpose: "Combine encoder states using the learned alignment distribution.",
          concepts: [
            { name: "states", detail: "Encoder representation at every source position." },
            { name: "weights / alpha", detail: "One normalized NumPy weight corresponding to each state." },
            { name: "dimension", detail: "Width of the resulting context vector." },
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
      intro: "Run the supplied additive-attention trainer on three fixed cases, then compare its learned alignment against a uniform baseline. The replay does not execute the learner cells.",
    },
  } satisfies Omit<CourseLesson, "sources">;
