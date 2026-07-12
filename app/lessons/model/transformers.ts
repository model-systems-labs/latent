import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const transformersLesson = {
    id: "transformers",
    number: 5,
    mode: "core-mechanism",
    modeLabel: "Core algorithm",
    eyebrow: "Architecture · Vaswani et al. · 2017",
    title: "Transformers",
    thesis:
      "Self-attention constructs token representations through direct, content-dependent interactions while masking future positions in a causal language model.",
    paperUrl: "https://papers.nips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html",
    paperTitle: "Attention Is All You Need",
    authors: "Ashish Vaswani et al.",
    year: "2017",
    paperContext: `
This lesson concerns "Attention Is All You Need" by Vaswani and colleagues.
- The paper replaces recurrent and convolutional sequence processing with stacked attention and feed-forward layers.
- Scaled dot-product attention compares queries with keys, normalizes the scores, and mixes value vectors.
- Multi-head attention learns several projections so different interactions can be represented in parallel.
- Positional information is added because attention alone does not encode token order.
- Residual connections, normalization, masking, and position-wise feed-forward networks are essential parts of the architecture.
- The original paper is an encoder-decoder translation system; the browser lab adapts its attention operation to a decoder-only causal setting.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Direct interaction.",
        body:
          "A token can aggregate information from any permitted position in one attention operation. This shortens the path between distant positions relative to repeatedly passing information through recurrent state transitions.",
      },
      {
        label: "Query, key, value.",
        body:
          "Each token representation is projected into a query used to request information, a key used for compatibility, and a value containing information to mix. Dot products become attention logits after scaling by the key dimension.",
      },
      {
        label: "Causal mask.",
        body:
          "A decoder-only language model sets future-position scores to negative infinity before softmax. Every prediction can depend only on the prefix, preserving the autoregressive next-token objective.",
      },
      {
        label: "Complete block.",
        body:
          "Attention is surrounded by learned projections, residual paths, normalization, and a position-wise MLP. The paper's contribution is an effective full architecture, not the claim that a bare attention matrix is itself a language model.",
      },
    ],
    claims: {
      paper: "An architecture built around attention can outperform recurrent translation systems while training more efficiently in parallel.",
      lab: "The exact causal masking and scaled dot-product mixing operations run over supplied token representations.",
      limit: "This lesson executes an untrained attention block; it does not reproduce WMT training or claim that random attention weights are linguistic explanations.",
    },
    diagram: {
      title: "Causal Transformer block",
      caption: "The browser lab uses the decoder-side causal form that underlies autoregressive LLMs.",
      nodes: [
        { label: "Representation", value: "token + position" },
        { label: "Projection", value: "Q · K · V" },
        { label: "Masked attention", value: "softmax(QKᵀ / √d)" },
        { label: "Block output", value: "residual + norm + MLP" },
      ],
    },
    questions: {
      intro: "Ask about tensor shapes, masks, heads, positional information, residual paths, or the adaptation from the paper's translation model to a causal LLM.",
      suggestions: [
        "Why divide by the square root of d?",
        "What exactly does the causal mask prevent?",
        "Why are residual paths necessary?",
      ],
    },
    dataset: {
      name: "Causal Sequence Set",
      source: "Original synthetic course examples",
      license: "CC0",
      size: "3 fixed token sequences",
      preview: "the · receiver · decoded · the · quiet · signal",
    },
    implementation: {
      filename: "causal-transformer.js",
      intro: "Implement the exact operations that determine which token positions can exchange information inside a causal attention block.",
      tensorOps: ["tensor", "matmul", "div", "softmax", "weightedSum", "maskCausal", "normalizeLayer", "toArray"],
      codeBlocks: [
        {
          id: "causal-mask",
          label: "Causal mask",
          purpose: "Remove access to future positions before normalization.",
          concepts: [
            { name: "row", detail: "Query position currently producing a representation." },
            { name: "column", detail: "Key position the query might attend to." },
            { name: "-Infinity", detail: "Becomes exactly zero probability after softmax." },
          ],
          code: `function causalMask(scores) {
  return toArray(maskCausal(tensor(scores)));
}`,
          checkCode: `const masked = causalMask([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
return { passed: masked[0][0] === 1 && masked[0][1] === -Infinity && masked[1][2] === -Infinity && masked[2][2] === 9, detail: "future logits removed" };`,
        },
        {
          id: "scaled-attention",
          label: "Scaled dot-product attention",
          purpose: "Turn query-key compatibility into a weighted value mixture.",
          concepts: [
            { name: "scale", detail: "Square root of the key dimension." },
            { name: "scores", detail: "Dot products between one query and each key." },
            { name: "probabilities", detail: "Normalized weights applied to value vectors." },
          ],
          code: `function scaledDotProductAttention(query, keys, values) {
  const scale = Math.sqrt(query.length);
  const scores = div(matmul(tensor(keys), tensor(query)), scale);
  const probabilities = softmax(scores);
  return toArray(weightedSum(tensor(values), probabilities));
}`,
          checkCode: `const output = scaledDotProductAttention([1, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]]);
return { passed: output.length === 2 && output[0] > output[1], detail: "output = [" + output.map(v => v.toFixed(3)).join(", ") + "]" };`,
        },
        {
          id: "layer-norm",
          label: "Layer normalization",
          purpose: "Normalize features within one token representation.",
          concepts: [
            { name: "mean", detail: "Average activation across the feature dimension." },
            { name: "variance", detail: "Average squared deviation from that mean." },
            { name: "epsilon", detail: "Stability constant inside the square root." },
          ],
          code: `function layerNorm(vector, epsilon = 1e-5) {
  return toArray(normalizeLayer(tensor(vector), epsilon));
}`,
          checkCode: `const normalized = layerNorm([1, 2, 3, 4]);
const mean = normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
return { passed: Math.abs(mean) < 1e-9 && normalized.every(Number.isFinite), detail: "mean = " + mean.toFixed(9) };`,
        },
      ],
    },
    experiment: {
      kind: "transformer",
      title: "Run causal self-attention",
      intro: "Execute a real masked attention forward pass and inspect the complete position-by-position probability matrix.",
    },
  } satisfies Omit<CourseLesson, "sources">;
