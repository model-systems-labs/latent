import type { CourseLesson } from "@latent/course-kit";
import { withGuidedExercises } from "@/examples/learning-platform/llm-learning/lessons/guided-exercises";
import { commonQuestionInstruction } from "@/examples/learning-platform/llm-learning/lessons/model/shared";

export const transformersLesson = withGuidedExercises({
    id: "transformers",
    number: 5,
    mode: "core-mechanism",
    modeLabel: "Core algorithm",
    eyebrow: "Architecture · Causal self-attention",
    title: "Transformers",
    thesis:
      "Self-attention builds token representations by letting tokens interact directly based on their content, while a causal language model masks future token positions.",
    paperUrl: "https://papers.nips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html",
    paperTitle: "Attention Is All You Need",
    authors: "Ashish Vaswani et al.",
    year: "2017",
    paperContext: `
This lesson walks through "Attention Is All You Need" by Vaswani and colleagues.
- The paper replaces recurrent and convolutional sequence processing with stacks of attention and feed-forward layers.
- Scaled dot-product attention compares queries with keys, turns the scores into weights, and mixes the value vectors.
- Multi-head attention learns several projections so it can model different kinds of interactions at the same time.
- The model adds position information because attention by itself doesn't know token order.
- Residual connections, normalization, masking, and position-wise feed-forward networks are all key parts of the design.
- The original paper describes an encoder-decoder translation system. The browser lab takes its attention operation and uses it in a decoder-only causal setup.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Keep track of the shapes.",
        body:
          "Start with n token representations X ∈ ℝⁿˣᵈmodel. Learned projections produce Q and K ∈ ℝⁿˣᵈk and V ∈ ℝⁿˣᵈv. That means QKᵀ has one compatibility score for every query row and key column, giving it shape n × n.",
      },
      {
        label: "Scale the match scores.",
        body:
          "A query asks what this position needs. A key says what a position can match, and a value carries the information that may get mixed in. Divide each query-key dot product by √dₖ so the scores don't grow with the projection width and push softmax into saturated probabilities with tiny gradients.",
      },
      {
        label: "Mask first, then normalize.",
        body:
          "For query row i, keep key columns j ≤ i and set every future score j > i to −Infinity. Then apply softmax across that row. Future positions get exactly zero probability, and the probabilities that remain add up to one and weight the rows of V.",
      },
      {
        label: "Attention isn't the whole block.",
        body:
          "The context C = softmax(mask(QKᵀ/√dₖ))V is only the attention sublayer. A working decoder block also needs output and multi-head projections, residual paths, normalization, a position-wise MLP, and another residual path. Stacked blocks operate on representations that include both token and position information. The exercise below builds only the non-affine normalization core. Full affine layer normalization also applies a learned gain gamma and bias beta to each feature; this exercise leaves those two parameters out on purpose.",
      },
    ],
    claims: {
      paper: "An attention-based architecture can beat recurrent translation systems while taking better advantage of parallel training.",
      lab: "You'll run the exact causal masking and scaled dot-product mixing steps on the given token representations.",
      limit: "This lesson runs an untrained attention block. It doesn't recreate WMT training or suggest that random attention weights explain language.",
    },
    diagram: {
      title: "One causal self-attention head",
      caption: "Here's a worked three-token pass. Learned projections normally produce Q, K, and V. Scale QKᵀ by √dₖ, mask future columns before running softmax on each row, and then mix V. The reference experiment uses identity projections, so the given token-position representations act as Q, K, and V.",
      nodes: [
        { label: "Project", value: "XW → Q,K[3×d_k] · V[3×d_v]" },
        { label: "Score", value: "QKᵀ[3×3] / √d_k" },
        { label: "Normalize", value: "mask j>i to −∞ → softmax per row" },
        { label: "Mix values", value: "P[3×3]V[3×d_v] → C[3×d_v]" },
      ],
    },
    questions: {
      intro: "Ask about tensor shapes, masks, heads, position information, residual paths, or how the paper's translation model was adapted for a causal LLM.",
      suggestions: [
        "Why divide by the square root of d?",
        "What exactly does the causal mask prevent?",
        "Why are residual paths necessary?",
      ],
    },
    dataset: {
      name: "Causal Sequence Set",
      source: "Course-authored synthetic examples",
      license: "Not separately licensed",
      size: "1 fixed six-token sequence",
      preview: "the · receiver · decoded · the · quiet · signal",
    },
    implementation: {
      filename: "causal-transformer.py",
      intro: "Use Python and NumPy to build the exact steps that decide which token positions can share information inside a causal attention block.",
      tensorOps: ["numpy", "np.asarray", "np.matmul", "np.exp", "np.triu_indices", "np.mean", "np.sqrt", "tolist"],
      codeBlocks: [
        {
          id: "causal-mask",
          label: "Causal mask",
          purpose: "Keep the diagonal and earlier positions, and replace only scores where column > row with -Infinity before softmax.",
          concepts: [
            { name: "row", detail: "The query position that's building a representation." },
            { name: "column", detail: "A key position that the query might look at." },
            { name: "-np.inf", detail: "Turns into exactly zero probability after softmax." },
          ],
          code: `import numpy as np

def causal_mask(scores):
    masked = np.asarray(scores, dtype=float).copy()
    if masked.ndim != 2 or masked.shape[0] != masked.shape[1]:
        raise ValueError("maskCausal needs a square rank-2 tensor")
    future_rows, future_columns = np.triu_indices(masked.shape[0], k=1)
    masked[future_rows, future_columns] = -np.inf
    return masked.tolist()`,
          checkCode: `masked = causal_mask([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
RESULT = {
    "passed": masked[0][0] == 1 and np.isneginf(masked[0][1]) and np.isneginf(masked[1][2]) and masked[2][2] == 9,
    "detail": "future logits removed",
}`,
        },
        {
          id: "scaled-attention",
          label: "Scaled dot-product attention",
          purpose: "Divide query-key scores by √dₖ, apply softmax, and return the weighted mix of value rows.",
          concepts: [
            { name: "scale", detail: "The NumPy square root of the key dimension." },
            { name: "scores", detail: "The dot products between one query and every key." },
            { name: "probabilities", detail: "The normalized weights used to mix the value vectors." },
          ],
          code: `import numpy as np

def scaled_dot_product_attention(query, keys, values):
    query_vector = np.asarray(query, dtype=float)
    key_matrix = np.asarray(keys, dtype=float)
    value_matrix = np.asarray(values, dtype=float)
    scale = np.sqrt(query_vector.size)
    scores = (key_matrix @ query_vector) / scale
    shifted = scores - np.max(scores)
    probabilities = np.exp(shifted)
    probabilities /= probabilities.sum()
    return (probabilities @ value_matrix).tolist()`,
          checkCode: `output = scaled_dot_product_attention([1, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]])
RESULT = {
    "passed": len(output) == 2 and output[0] > output[1],
    "detail": "output = [" + ", ".join(f"{value:.3f}" for value in output) + "]",
}`,
        },
        {
          id: "layer-norm",
          label: "Non-affine layer normalization",
          purpose: "Standardize one token across its features, without the learned gain gamma and bias beta from full affine layer normalization.",
          concepts: [
            { name: "mean", detail: "The NumPy average across the feature dimension." },
            { name: "variance", detail: "The NumPy average of the squared distance from that mean." },
            { name: "epsilon", detail: "A small stability constant inside the square root." },
            { name: "omitted affine terms", detail: "Full layer norm applies a learned gain gamma and bias beta to each feature after this step." },
          ],
          code: `import numpy as np

def layer_norm(vector, epsilon=1e-5):
    values = np.asarray(vector, dtype=float)
    mean = values.mean()
    variance = np.mean((values - mean) ** 2)
    return ((values - mean) / np.sqrt(variance + epsilon)).tolist()`,
          checkCode: `normalized = layer_norm([1, 2, 3, 4])
mean = sum(normalized) / len(normalized)
RESULT = {
    "passed": abs(mean) < 1e-9 and all(np.isfinite(normalized)),
    "detail": f"mean = {mean:.9f}",
}`,
        },
      ],
    },
    experiment: {
      kind: "transformer",
      title: "Run causal self-attention",
      intro: "Run the masked-attention forward pass with identity Q/K/V projections, then inspect the full probability matrix.",
    },
  } satisfies Omit<CourseLesson, "sources">);
