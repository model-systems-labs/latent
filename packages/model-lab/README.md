# @latent/model-lab

`@latent/model-lab` contains the small deterministic engines used by Latent's
model-foundations experiments. It owns numerical experiment behavior, training
configuration, supplied datasets, result contracts, and checkpoint sampling.

It has no dependency on React, course manifests, persistence, workers, or the
artifact system. Those consumers select the appropriate public entry point:

| Entry point | Capability |
| --- | --- |
| `@latent/model-lab/character-rnn` | Character RNN training, sampling, and checkpoint contracts |
| `@latent/model-lab/neural-language-model` | Word embeddings and next-token prediction |
| `@latent/model-lab/bpe` | Deterministic byte-pair merge training and encoding |
| `@latent/model-lab/additive-attention` | Learned additive alignment experiment |
| `@latent/model-lab/causal-attention` | Masked self-attention experiment |

These are intentionally transparent educational engines, not production model
training infrastructure. Recorded Training consumes their deterministic output;
it does not own or reimplement their algorithms.

## Development

```sh
npm run validate --workspace @latent/model-lab
```
