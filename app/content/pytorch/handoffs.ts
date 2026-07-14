export type PyTorchHandoffFile = {
  path: string;
  label: string;
  code: string;
};

export type PyTorchHandoff = {
  lessonId: string;
  title: string;
  rationale: string;
  mappings: Array<{ mechanism: string; pytorch: string }>;
  files: PyTorchHandoffFile[];
};

export const PYTORCH_REQUIREMENTS = `torch==2.9.0
onnx==1.22.0
onnxscript==0.7.1
`;

export const PYTORCH_PORTFOLIO_README = `# Native PyTorch track

These files are the production-framework translations of selected Latent
lessons. They use the real PyTorch package for Python: eager tensors, autograd,
nn.Module, optimizers, and export APIs.

They do not run in the browser's Pyodide worker. PyTorch does not publish an
official Pyodide/WebAssembly wheel. Run them in a native Python 3.10-3.13
environment or upload the lesson notebook downloaded from Latent to Colab.

## Setup

\`\`\`bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python models/character_rnn_torch.py
python models/neural_language_model_torch.py
python models/additive_attention_torch.py
python models/causal_transformer_torch.py
python systems/kv_cache_torch.py
\`\`\`

The NumPy lesson files remain the transparent, browser-executable source of
truth for the course exercises. These PyTorch files show how the same
mechanisms become trainable modules and portable model artifacts.
`;

const characterRnn = `import torch
from torch import nn
from torch.nn import functional as F


class CharacterRNN(nn.Module):
    """The lesson recurrence expressed as registered PyTorch parameters."""

    def __init__(self, vocabulary_size: int, hidden_size: int):
        super().__init__()
        self.vocabulary_size = vocabulary_size
        self.hidden_size = hidden_size
        self.Wxh = nn.Parameter(torch.randn(hidden_size, vocabulary_size) * 0.02)
        self.Whh = nn.Parameter(torch.randn(hidden_size, hidden_size) * 0.02)
        self.Why = nn.Parameter(torch.randn(vocabulary_size, hidden_size) * 0.02)
        self.hidden_bias = nn.Parameter(torch.zeros(hidden_size))
        self.output_bias = nn.Parameter(torch.zeros(vocabulary_size))

    def step(self, token_ids: torch.Tensor, previous: torch.Tensor):
        inputs = F.one_hot(token_ids, self.vocabulary_size).to(self.Wxh.dtype)
        hidden = torch.tanh(
            inputs @ self.Wxh.T
            + previous @ self.Whh.T
            + self.hidden_bias
        )
        logits = hidden @ self.Why.T + self.output_bias
        return logits, hidden

    def forward(self, token_ids: torch.Tensor) -> torch.Tensor:
        if token_ids.ndim != 2:
            raise ValueError("token_ids must have shape [batch, time]")
        batch = token_ids.shape[0]
        hidden = torch.zeros(
            batch,
            self.hidden_size,
            dtype=self.Wxh.dtype,
            device=token_ids.device,
        )
        logits = []
        for token_at_t in token_ids.unbind(dim=1):
            step_logits, hidden = self.step(token_at_t, hidden)
            logits.append(step_logits)
        return torch.stack(logits, dim=1)


def training_step(model, token_ids, targets, optimizer) -> float:
    optimizer.zero_grad(set_to_none=True)
    logits = model(token_ids)
    loss = F.cross_entropy(
        logits.reshape(-1, model.vocabulary_size),
        targets.reshape(-1),
    )
    loss.backward()
    # This is elementwise clipping, exactly matching the NumPy lesson.
    nn.utils.clip_grad_value_(model.parameters(), clip_value=5.0)
    optimizer.step()
    return float(loss.detach())


if __name__ == "__main__":
    torch.manual_seed(7)
    model = CharacterRNN(vocabulary_size=5, hidden_size=12)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3)
    tokens = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 4]])
    targets = torch.tensor([[1, 2, 3, 4], [2, 3, 4, 0]])
    loss = training_step(model, tokens, targets, optimizer)
    assert torch.isfinite(torch.tensor(loss))
    assert model(tokens).shape == (2, 4, 5)
    print({"loss": round(loss, 4), "parameters": sum(p.numel() for p in model.parameters())})
`;

const neuralLanguageModel = `import torch
from torch import nn
from torch.nn import functional as F


class NeuralLanguageModel(nn.Module):
    """A fixed-width context model with learned distributed representations."""

    def __init__(self, vocabulary_size: int, embedding_size: int, hidden_size: int):
        super().__init__()
        self.embedding = nn.Embedding(vocabulary_size, embedding_size)
        self.hidden = nn.Linear(embedding_size, hidden_size)
        self.output = nn.Linear(hidden_size, vocabulary_size)

    def forward(self, context_ids: torch.Tensor) -> torch.Tensor:
        if context_ids.ndim != 2:
            raise ValueError("context_ids must have shape [batch, context]")
        context = self.embedding(context_ids).mean(dim=1)
        return self.output(torch.tanh(self.hidden(context)))


def training_step(model, context_ids, targets, optimizer) -> float:
    optimizer.zero_grad(set_to_none=True)
    logits = model(context_ids)
    loss = F.cross_entropy(logits, targets)
    loss.backward()
    optimizer.step()
    return float(loss.detach())


if __name__ == "__main__":
    torch.manual_seed(11)
    model = NeuralLanguageModel(vocabulary_size=8, embedding_size=6, hidden_size=12)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3)
    contexts = torch.tensor([[0, 1], [2, 3], [4, 5], [5, 6]])
    targets = torch.tensor([2, 4, 6, 7])
    before = model.embedding.weight.detach().clone()
    loss = training_step(model, contexts, targets, optimizer)
    assert model(contexts).shape == (4, 8)
    assert not torch.equal(before, model.embedding.weight.detach())
    print({"loss": round(loss, 4), "embedding_shape": list(model.embedding.weight.shape)})
`;

const additiveAttention = `import torch
from torch import nn


class AdditiveAttention(nn.Module):
    """Bahdanau-style learned alignment over a batch of source states."""

    def __init__(self, query_size: int, key_size: int, attention_size: int):
        super().__init__()
        self.query_projection = nn.Linear(query_size, attention_size, bias=False)
        self.key_projection = nn.Linear(key_size, attention_size, bias=False)
        self.score_projection = nn.Linear(attention_size, 1, bias=False)

    def forward(
        self,
        query: torch.Tensor,
        keys: torch.Tensor,
        values: torch.Tensor,
    ):
        if query.ndim != 2 or keys.ndim != 3 or values.ndim != 3:
            raise ValueError("expected query [B,Dq], keys [B,S,Dk], values [B,S,Dv]")
        hidden = torch.tanh(
            self.query_projection(query)[:, None, :]
            + self.key_projection(keys)
        )
        scores = self.score_projection(hidden).squeeze(-1)
        weights = scores.softmax(dim=-1)
        context = torch.bmm(weights[:, None, :], values).squeeze(1)
        return context, weights, scores


if __name__ == "__main__":
    torch.manual_seed(13)
    attention = AdditiveAttention(query_size=4, key_size=6, attention_size=8)
    query = torch.randn(2, 4)
    keys = torch.randn(2, 3, 6)
    values = torch.randn(2, 3, 5)
    context, weights, scores = attention(query, keys, values)
    loss = context.square().mean() + scores.square().mean()
    loss.backward()
    torch.testing.assert_close(weights.sum(dim=-1), torch.ones(2))
    assert context.shape == (2, 5)
    assert all(parameter.grad is not None for parameter in attention.parameters())
    print({"context_shape": list(context.shape), "weights": weights[0].detach().tolist()})
`;

const causalTransformer = `from pathlib import Path

import torch
from torch import nn
from torch.nn import functional as F


class CausalSelfAttention(nn.Module):
    def __init__(self, model_size: int, heads: int, dropout: float = 0.0):
        super().__init__()
        if model_size % heads:
            raise ValueError("model_size must be divisible by heads")
        self.heads = heads
        self.head_size = model_size // heads
        self.dropout = dropout
        self.qkv = nn.Linear(model_size, 3 * model_size)
        self.output = nn.Linear(model_size, model_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, time, width = x.shape
        query, key, value = self.qkv(x).chunk(3, dim=-1)

        def split_heads(tensor):
            return tensor.view(batch, time, self.heads, self.head_size).transpose(1, 2)

        query, key, value = map(split_heads, (query, key, value))
        context = F.scaled_dot_product_attention(
            query,
            key,
            value,
            dropout_p=self.dropout if self.training else 0.0,
            is_causal=True,
        )
        context = context.transpose(1, 2).contiguous().view(batch, time, width)
        return self.output(context)


class DecoderBlock(nn.Module):
    def __init__(self, model_size: int, heads: int, expansion: int = 4):
        super().__init__()
        self.attention_norm = nn.LayerNorm(model_size)
        self.attention = CausalSelfAttention(model_size, heads)
        self.mlp_norm = nn.LayerNorm(model_size)
        self.mlp = nn.Sequential(
            nn.Linear(model_size, expansion * model_size),
            nn.GELU(),
            nn.Linear(expansion * model_size, model_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attention(self.attention_norm(x))
        return x + self.mlp(self.mlp_norm(x))


class TinyDecoderLM(nn.Module):
    def __init__(
        self,
        vocabulary_size: int,
        model_size: int = 32,
        heads: int = 4,
        layers: int = 2,
        max_sequence: int = 64,
    ):
        super().__init__()
        self.vocabulary_size = vocabulary_size
        self.max_sequence = max_sequence
        self.token_embedding = nn.Embedding(vocabulary_size, model_size)
        self.position_embedding = nn.Embedding(max_sequence, model_size)
        self.blocks = nn.ModuleList(
            DecoderBlock(model_size, heads) for _ in range(layers)
        )
        self.final_norm = nn.LayerNorm(model_size)
        self.language_head = nn.Linear(model_size, vocabulary_size, bias=False)

    def forward(self, token_ids: torch.Tensor) -> torch.Tensor:
        if token_ids.ndim != 2 or token_ids.shape[1] > self.max_sequence:
            raise ValueError("token_ids must have shape [batch, time <= max_sequence]")
        positions = torch.arange(token_ids.shape[1], device=token_ids.device)
        x = self.token_embedding(token_ids) + self.position_embedding(positions)[None]
        for block in self.blocks:
            x = block(x)
        return self.language_head(self.final_norm(x))


def training_step(model, token_ids, targets, optimizer) -> float:
    optimizer.zero_grad(set_to_none=True)
    logits = model(token_ids)
    loss = F.cross_entropy(logits.reshape(-1, model.vocabulary_size), targets.reshape(-1))
    loss.backward()
    nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()
    return float(loss.detach())


def export_onnx(model: TinyDecoderLM, output_path: str = "tiny_decoder.onnx") -> Path:
    """Export for ONNX Runtime Web; requires onnx==1.22.0 and onnxscript==0.7.1."""
    model = model.eval()
    example = torch.zeros((1, 8), dtype=torch.long)
    destination = Path(output_path)
    torch.onnx.export(
        model,
        (example,),
        destination,
        input_names=["token_ids"],
        output_names=["logits"],
        dynamo=True,
        dynamic_shapes={
            "token_ids": {
                1: torch.export.Dim(
                    "sequence",
                    min=1,
                    max=model.max_sequence,
                ),
            }
        },
    )
    return destination


if __name__ == "__main__":
    torch.manual_seed(17)
    model = TinyDecoderLM(vocabulary_size=32)
    model.eval()
    prefix_a = torch.tensor([[1, 2, 3, 4]])
    prefix_b = torch.tensor([[1, 2, 3, 9]])
    with torch.inference_mode():
        logits_a = model(prefix_a)
        logits_b = model(prefix_b)
    # Changing a future token cannot change any earlier causal output.
    torch.testing.assert_close(logits_a[:, :-1], logits_b[:, :-1])
    assert logits_a.shape == (1, 4, 32)
    print({
        "logits_shape": list(logits_a.shape),
        "parameters": sum(p.numel() for p in model.parameters()),
    })
`;

const kvCache = `from dataclasses import dataclass

import torch


@dataclass(frozen=True)
class KVCacheShape:
    layers: int
    batch: int
    kv_heads: int
    tokens: int
    head_size: int


def kv_cache_bytes(shape: KVCacheShape, dtype: torch.dtype) -> int:
    element_bytes = torch.empty((), dtype=dtype).element_size()
    return (
        2
        * shape.layers
        * shape.batch
        * shape.kv_heads
        * shape.tokens
        * shape.head_size
        * element_bytes
    )


def allocate_kv_cache(shape: KVCacheShape, dtype=torch.float16):
    # Dimension 1 holds key and value separately.
    return torch.empty(
        shape.layers,
        2,
        shape.batch,
        shape.kv_heads,
        shape.tokens,
        shape.head_size,
        dtype=dtype,
    )


if __name__ == "__main__":
    shape = KVCacheShape(layers=2, batch=1, kv_heads=2, tokens=16, head_size=8)
    cache = allocate_kv_cache(shape, torch.float16)
    actual_bytes = cache.numel() * cache.element_size()
    predicted_bytes = kv_cache_bytes(shape, torch.float16)
    assert actual_bytes == predicted_bytes
    print({"shape": list(cache.shape), "bytes": actual_bytes})
`;

export const PYTORCH_HANDOFFS: Record<string, PyTorchHandoff> = {
  "character-rnns": {
    lessonId: "character-rnns",
    title: "Train the recurrence with autograd",
    rationale: "The NumPy cells expose the recurrence, loss, and clipping rule. PyTorch then registers those weights, differentiates through time, and lets an optimizer update them.",
    mappings: [
      { mechanism: "Wxh, Whh, Why arrays", pytorch: "nn.Parameter" },
      { mechanism: "manual cross-entropy path", pytorch: "F.cross_entropy" },
      { mechanism: "elementwise clipping", pytorch: "clip_grad_value_" },
    ],
    files: [{ path: "pytorch/models/character_rnn_torch.py", label: "Character RNN", code: characterRnn }],
  },
  "neural-language-models": {
    lessonId: "neural-language-models",
    title: "Learn embeddings as model parameters",
    rationale: "PyTorch makes the embedding table and output projection trainable modules while preserving the lesson's context-vector and next-token-loss path.",
    mappings: [
      { mechanism: "embedding matrix row lookup", pytorch: "nn.Embedding" },
      { mechanism: "context and vocabulary projections", pytorch: "nn.Linear" },
      { mechanism: "parameter update", pytorch: "AdamW" },
    ],
    files: [{ path: "pytorch/models/neural_language_model_torch.py", label: "Neural language model", code: neuralLanguageModel }],
  },
  "additive-attention": {
    lessonId: "additive-attention",
    title: "Make the alignment scorer trainable",
    rationale: "The scalar equations become batched projections over queries, keys, and values. Autograd verifies that the alignment parameters receive gradients.",
    mappings: [
      { mechanism: "Wq and Wk projections", pytorch: "nn.Linear" },
      { mechanism: "soft alignment", pytorch: "Tensor.softmax" },
      { mechanism: "weighted value sum", pytorch: "torch.bmm" },
    ],
    files: [{ path: "pytorch/models/additive_attention_torch.py", label: "Additive attention", code: additiveAttention }],
  },
  transformers: {
    lessonId: "transformers",
    title: "Assemble a trainable causal decoder",
    rationale: "This translation adds learned QKV projections, multiple heads, residual paths, affine LayerNorm, an MLP, next-token loss, and a native ONNX export boundary.",
    mappings: [
      { mechanism: "scaled causal attention", pytorch: "F.scaled_dot_product_attention" },
      { mechanism: "residual block and MLP", pytorch: "nn.Module" },
      { mechanism: "browser deployment artifact", pytorch: "torch.onnx.export" },
    ],
    files: [{ path: "pytorch/models/causal_transformer_torch.py", label: "Causal decoder", code: causalTransformer }],
  },
  "inference-runtime": {
    lessonId: "inference-runtime",
    title: "Check KV-cache accounting against a real tensor",
    rationale: "The serving formula becomes concrete when a PyTorch allocation reports its element count and dtype width. The factor of two is one key tensor plus one value tensor.",
    mappings: [
      { mechanism: "KV-cache dimensions", pytorch: "torch.empty shape" },
      { mechanism: "bytes per value", pytorch: "Tensor.element_size" },
      { mechanism: "predicted allocation", pytorch: "numel × element_size" },
    ],
    files: [{ path: "pytorch/systems/kv_cache_torch.py", label: "KV-cache allocation", code: kvCache }],
  },
};

export const PYTORCH_HANDOFF_FILES = Object.values(PYTORCH_HANDOFFS)
  .flatMap((handoff) => handoff.files)
  .sort((left, right) => left.path.localeCompare(right.path));
