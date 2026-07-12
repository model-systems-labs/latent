import { LATENT_TENSOR_PATH } from "./source";

export type LatentTensorOperation = {
  name: string;
  category: "creation" | "shape" | "math" | "reduction" | "linear-algebra" | "neural-network" | "sampling";
  purpose: string;
};

export const LATENT_TENSOR_OPERATIONS: LatentTensorOperation[] = [
  { name: "tensor", category: "creation", purpose: "Create a tensor and optionally track gradients." },
  { name: "zeros", category: "creation", purpose: "Create zero-filled parameters or state." },
  { name: "ones", category: "creation", purpose: "Create one-filled tensors or gradient seeds." },
  { name: "randn", category: "creation", purpose: "Initialize deterministic Gaussian parameters." },
  { name: "oneHot", category: "creation", purpose: "Encode a discrete token as a vector." },
  { name: "reshape", category: "shape", purpose: "Change tensor dimensions without changing values." },
  { name: "transpose", category: "shape", purpose: "Swap matrix axes." },
  { name: "numel", category: "shape", purpose: "Count elements for memory and cache calculations." },
  { name: "toArray", category: "shape", purpose: "Return nested JavaScript arrays at lesson boundaries." },
  { name: "add", category: "math", purpose: "Add tensors with scalar broadcasting." },
  { name: "sub", category: "math", purpose: "Subtract tensors with scalar broadcasting." },
  { name: "mul", category: "math", purpose: "Multiply tensors element by element." },
  { name: "div", category: "math", purpose: "Divide tensors element by element." },
  { name: "pow", category: "math", purpose: "Raise tensor values to a scalar power." },
  { name: "exp", category: "math", purpose: "Exponentiate logits and log probabilities." },
  { name: "log", category: "math", purpose: "Compute log probabilities and losses." },
  { name: "tanh", category: "math", purpose: "Apply the recurrent-network nonlinearity." },
  { name: "clip", category: "math", purpose: "Bound activations or gradients." },
  { name: "sum", category: "reduction", purpose: "Reduce values along an axis." },
  { name: "mean", category: "reduction", purpose: "Average embeddings, activations, or losses." },
  { name: "dot", category: "linear-algebra", purpose: "Score two vectors." },
  { name: "matmul", category: "linear-algebra", purpose: "Apply projections and attention products." },
  { name: "embedding", category: "neural-network", purpose: "Gather token rows from an embedding table." },
  { name: "softmax", category: "neural-network", purpose: "Convert stable logits into probabilities." },
  { name: "logSoftmax", category: "neural-network", purpose: "Produce stable log probabilities." },
  { name: "nllLoss", category: "neural-network", purpose: "Score a target from a probability vector." },
  { name: "crossEntropy", category: "neural-network", purpose: "Combine softmax and target loss for logits." },
  { name: "weightedSum", category: "neural-network", purpose: "Combine value vectors using attention weights." },
  { name: "normalizeLayer", category: "neural-network", purpose: "Normalize hidden activations." },
  { name: "maskCausal", category: "neural-network", purpose: "Prevent attention to future tokens." },
  { name: "argmax", category: "sampling", purpose: "Choose the highest-scoring token." },
  { name: "topK", category: "sampling", purpose: "Restrict sampling to the strongest candidates." },
];

export function latentTensorImport(operations: string[]) {
  if (operations.length === 0) return "";
  return `import { ${operations.join(", ")} } from "../${LATENT_TENSOR_PATH}";`;
}

export function latentTensorOperations(names: string[]) {
  const byName = new Map(LATENT_TENSOR_OPERATIONS.map((operation) => [operation.name, operation]));
  return names.map((name) => byName.get(name)).filter((operation): operation is LatentTensorOperation => Boolean(operation));
}
