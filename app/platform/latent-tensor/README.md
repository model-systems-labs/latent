# Latent Tensor

Latent Tensor is the course's small, browser-safe numerical runtime. It exists so
learners can implement model ideas with tensors while still seeing the complete
source and running everything inside the virtual project sandbox.

It is not a PyTorch compatibility layer. Production model inference remains a
Transformers.js and ONNX concern.

## Operation set

### Used directly by current lessons

| Model idea | Operations |
| --- | --- |
| Recurrent transition | `tensor`, `matmul`, `add`, `tanh`, `toArray` |
| Target loss and stabilization | `nllLoss`, `clip` |
| Neural language model | `embedding`, `mean`, `softmax` |
| Additive attention | `matmul`, `add`, `tanh`, `dot`, `weightedSum` |
| Causal Transformer | `matmul`, `div`, `softmax`, `weightedSum`, `maskCausal`, `normalizeLayer` |
| KV-cache accounting | `numel` |

### Needed for local training exercises

- Parameter creation: `zeros`, `ones`, deterministic `randn`, and `oneHot`.
- Shape transformations: `reshape` and rank-2 `transpose`.
- Differentiable math: `add`, `sub`, `mul`, `div`, `neg`, `pow`, `exp`,
  `log`, and `tanh` with scalar broadcasting.
- Reductions and linear algebra: `sum`, `mean`, `dot`, and vector/matrix
  `matmul`.
- Model losses: `softmax`, `logSoftmax`, `nllLoss`, and `crossEntropy`.
- Decoding controls: `argmax` and `topK`.
- Reverse-mode automatic differentiation through the differentiable operations.

## Deliberate limits

- CPU and `Float64` JavaScript arrays only; no WebGPU kernel layer yet.
- Vectors and matrices, not general batched matrix multiplication.
- Last-axis softmax and vector layer normalization cover the current curriculum.
- No optimizers, dataloaders, dataframe operations, distributed collectives, or
  ONNX execution. Those belong to separate course systems.

The source of truth is `source.ts`. That exact module is inserted at
`runtime/latent-tensor.js` in the learner's saved virtual project, marked read
only, and bundled with each isolated lesson test.
