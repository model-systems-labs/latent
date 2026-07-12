# `@latent/tensor`

A small, typed, browser-safe tensor and reverse-mode automatic differentiation
runtime for the Latent LLM curriculum.

This package is deliberately narrower than PyTorch. It implements the vector,
matrix, neural-network, and decoding operations needed to teach how language
models work, while keeping the complete implementation readable and runnable in
the course's sandbox.

## Public API

```ts
import {
  add,
  crossEntropy,
  matmul,
  randn,
  softmax,
  tensor,
} from "@latent/tensor";

const weights = randn([4, 3], { seed: 7, requiresGrad: true });
const input = tensor([1, 0, -1]);
const logits = matmul(weights, input);
const loss = crossEntropy(logits, 2);

loss.backward();
console.log(weights.grad?.toArray());
```

The root entry point exports the runtime, the operation catalog, and the VFS
constants. More focused entry points are available at `@latent/tensor/catalog`
and `@latent/tensor/browser-source`.

## Browser IDE source

`src/runtime.ts` is the only hand-authored runtime implementation. During the
package build, `scripts/generate-browser-source.mjs` transpiles that module and
generates `LATENT_TENSOR_SOURCE`. The website can inject the resulting ES module
at `LATENT_TENSOR_PATH` (`runtime/latent-tensor.js`) in its virtual filesystem:

```ts
import {
  LATENT_TENSOR_PATH,
  LATENT_TENSOR_SOURCE,
} from "@latent/tensor/browser-source";

const virtualFile = {
  path: LATENT_TENSOR_PATH,
  contents: LATENT_TENSOR_SOURCE,
  loader: "js",
};
```

This keeps direct package imports and sandbox execution on the exact same
implementation without maintaining a second JavaScript source blob.

## Operation set

| Area | Operations |
| --- | --- |
| Creation | `tensor`, `zeros`, `ones`, `randn`, `oneHot` |
| Shape | `reshape`, `transpose`, `numel`, `toArray` |
| Math | `add`, `sub`, `mul`, `div`, `neg`, `pow`, `exp`, `log`, `tanh`, `clip` |
| Reduction | `sum`, `mean` |
| Linear algebra | `dot`, `matmul` |
| Neural network | `embedding`, `softmax`, `logSoftmax`, `nllLoss`, `crossEntropy`, `weightedSum`, `normalizeLayer`, `maskCausal` |
| Decoding | `argmax`, `topK` |

## Deliberate limits

- CPU and JavaScript `number` arrays only; there is no WebGPU kernel layer yet.
- Vector and matrix multiplication, not general batched matrix multiplication.
- Last-axis softmax and vector layer normalization cover the current lessons.
- No optimizers, dataloaders, dataframe operations, distributed collectives, or
  ONNX execution. Those remain separate course-system concerns.

## Development

```sh
npm run build
npm test
npm run typecheck
npm run check:browser-source
```
