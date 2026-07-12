import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const additiveAttentionLesson = {
    id: "additive-attention",
    number: 4,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Alignment · Bahdanau et al. · 2015",
    title: "Additive Attention",
    thesis:
      "The decoder can construct a different context vector at every output step by learning soft alignments over all encoder states.",
    paperUrl: "https://arxiv.org/abs/1409.0473",
    paperTitle: "Neural Machine Translation by Jointly Learning to Align and Translate",
    authors: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio",
    year: "2015",
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
          "A conventional encoder-decoder asks one vector to preserve every source detail required for every future output. Performance degrades as relevant information must survive more compression and recurrent steps.",
      },
      {
        label: "Alignment score.",
        body:
          "For each output step, a small neural network scores compatibility between the decoder state and every encoder state. These content-dependent scores are normalized across source positions.",
      },
      {
        label: "Dynamic context.",
        body:
          "The context vector is a weighted sum of encoder states. The decoder can emphasize a date's year while emitting the year and shift mass toward the month or day at later steps.",
      },
      {
        label: "Differentiable search.",
        body:
          "Because all positions receive continuous weights, the complete alignment path remains differentiable. The model learns where to look from the translation objective rather than from separately labeled word alignments.",
      },
    ],
    claims: {
      paper: "Learned soft alignment reduces the fixed-length representation bottleneck in neural translation.",
      lab: "A real additive scorer is optimized to align output roles with supplied encoder states and produces a learned heatmap.",
      limit: "Supervised alignment roles replace the paper's end-to-end translation objective in this small experiment.",
    },
    diagram: {
      title: "Step-specific context",
      caption: "Every decoder step produces a new distribution over the same encoder states.",
      nodes: [
        { label: "Encoder", value: "h_1 … h_n" },
        { label: "Compatibility", value: "vᵀ tanh(Ws + Uh_i)" },
        { label: "Alignment", value: "softmax(e_i)" },
        { label: "Context", value: "Σ α_i h_i" },
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
      size: "3 semantic roles · 180 training cases",
      preview: "14 · March · 2026  →  2026 · 03 · 14",
    },
    implementation: {
      filename: "additive-attention.js",
      intro: "Implement the scoring, normalization, and weighted context operations that turn encoder states into a step-specific representation.",
      tensorOps: ["tensor", "matmul", "add", "tanh", "dot", "softmax", "weightedSum", "toArray"],
      codeBlocks: [
        {
          id: "additive-score",
          label: "Compatibility score",
          purpose: "Score one decoder query against one encoder state.",
          concepts: [
            { name: "Wq", detail: "Projects the decoder query into attention space." },
            { name: "Wk", detail: "Projects one encoder state into the same space." },
            { name: "v", detail: "Collapses the nonlinear hidden vector to one scalar score." },
          ],
          code: `function additiveScore(query, key, { Wq, Wk, v, bias }) {
  const queryTerm = matmul(tensor(Wq), tensor(query));
  const keyTerm = matmul(tensor(Wk), tensor(key));
  const hidden = tanh(add(add(queryTerm, keyTerm), tensor(bias)));
  return dot(tensor(v), hidden).item();
}`,
          checkCode: `const score = additiveScore([1, 0], [0, 1], {
  Wq: [[1, 0], [0, 1]], Wk: [[1, 0], [0, 1]], v: [0.5, -0.5], bias: [0, 0]
});
return { passed: Number.isFinite(score), detail: "e = " + score.toFixed(4) };`,
        },
        {
          id: "attention-softmax",
          label: "Alignment weights",
          purpose: "Normalize compatibility scores across source positions.",
          concepts: [
            { name: "scores", detail: "One scalar compatibility value per encoder state." },
            { name: "softmax", detail: "Applies the stability offset and normalization." },
            { name: "toArray", detail: "Returns one alignment weight per source position." },
          ],
          code: `function attentionWeights(scores) {
  return toArray(softmax(tensor(scores)));
}`,
          checkCode: `const weights = attentionWeights([2, 1, 0]);
const total = weights.reduce((sum, value) => sum + value, 0);
return { passed: weights[0] > weights[1] && Math.abs(total - 1) < 1e-9, detail: weights.map(v => v.toFixed(3)).join(", ") };`,
        },
        {
          id: "context-vector",
          label: "Weighted context",
          purpose: "Combine encoder states using the learned alignment distribution.",
          concepts: [
            { name: "states", detail: "Encoder representation at every source position." },
            { name: "weights", detail: "Normalized alignment mass for the current output step." },
            { name: "dimension", detail: "Width of the resulting context vector." },
          ],
          code: `function contextVector(states, weights) {
  return toArray(weightedSum(tensor(states), tensor(weights)));
}`,
          checkCode: `const context = contextVector([[1, 0], [0, 1]], [0.75, 0.25]);
return { passed: context[0] === 0.75 && context[1] === 0.25, detail: "c = [" + context.join(", ") + "]" };`,
        },
      ],
    },
    experiment: {
      kind: "attention",
      title: "Learn the alignment function",
      intro: "Optimize the additive scorer, then compare its learned alignment against a fixed uniform context.",
    },
  } satisfies Omit<CourseLesson, "sources">;
