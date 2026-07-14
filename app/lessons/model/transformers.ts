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
        label: "Tensor shapes.",
        body:
          "For a sequence of n token representations X ∈ ℝⁿˣᵈmodel, learned projections produce Q and K ∈ ℝⁿˣᵈk and V ∈ ℝⁿˣᵈv. QKᵀ therefore contains one compatibility score for every query row and key column, with shape n × n.",
      },
      {
        label: "Scaled compatibility.",
        body:
          "Each query asks what information this position needs; each key describes what a position can match; each value carries the information to mix. Divide every query-key dot product by √dₖ so its magnitude does not grow with projection width and drive softmax into saturated, low-gradient probabilities.",
      },
      {
        label: "Mask, then normalize.",
        body:
          "For query row i, keep key columns j ≤ i and set every future score j > i to −Infinity before applying softmax independently across that row. Future probabilities become exactly zero; the remaining row probabilities sum to one and weight the rows of V.",
      },
      {
        label: "Block boundary.",
        body:
          "The resulting context C = softmax(mask(QKᵀ/√dₖ))V is only the attention sublayer. A usable decoder block also includes output and multi-head projections, residual paths, normalization, a position-wise MLP, and another residual path; stacked blocks operate on token-plus-position representations. The exercise below implements only the non-affine normalization core. A full affine layer normalization then applies learned per-feature gain gamma and bias beta; those two learned parameters are deliberately omitted here.",
      },
    ],
    claims: {
      paper: "An architecture built around attention can outperform recurrent translation systems while training more efficiently in parallel.",
      lab: "The exact causal masking and scaled dot-product mixing operations run over supplied token representations.",
      limit: "This lesson executes an untrained attention block; it does not reproduce WMT training or claim that random attention weights are linguistic explanations.",
    },
    diagram: {
      title: "One causal self-attention head",
      caption: "A three-token worked pass: learned projections normally produce Q, K, and V; scale QKᵀ by √dₖ; mask future columns before row-wise softmax; then mix V. The reference experiment uses identity projections so the supplied token-position representations serve as Q, K, and V.",
      nodes: [
        { label: "Project", value: "XW → Q,K[3×d_k] · V[3×d_v]" },
        { label: "Score", value: "QKᵀ[3×3] / √d_k" },
        { label: "Normalize", value: "mask j>i to −∞ → softmax per row" },
        { label: "Mix values", value: "P[3×3]V[3×d_v] → C[3×d_v]" },
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
      size: "1 fixed six-token sequence",
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
          purpose: "Preserve the diagonal and prefix; replace only scores where column > row with -Infinity before softmax.",
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
          purpose: "Divide query-key scores by √dₖ, apply softmax, and return the probability-weighted mixture of value rows.",
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
          label: "Non-affine layer normalization",
          purpose: "Standardize one token across features without the learned gain gamma and bias beta applied by a full affine layer normalization.",
          concepts: [
            { name: "mean", detail: "Average activation across the feature dimension." },
            { name: "variance", detail: "Average squared deviation from that mean." },
            { name: "epsilon", detail: "Stability constant inside the square root." },
            { name: "omitted affine terms", detail: "A full layer norm applies learned per-feature gain gamma and bias beta after this normalization." },
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
      intro: "Run the supplied masked-attention forward pass with identity Q/K/V projections and inspect the complete probability matrix. The replay does not execute the learner cells.",
    },
  } satisfies Omit<CourseLesson, "sources">;
