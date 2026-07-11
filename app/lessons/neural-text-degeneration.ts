import type { PaperLesson } from "../lib/lesson-types";

export const neuralTextDegenerationLesson: PaperLesson = {
  id: "neural-text-degeneration",
  labLabel: "Paper lab 01",
  navLabel: "Paper lab 01",
  eyebrow: "Decoding · Holtzman et al. · 2020",
  title: "Neural Text Degeneration",
  thesis:
    "The model is only half the generator. The algorithm that selects its next token can determine whether language remains coherent, collapses into repetition, or wanders into noise.",
  paperUrl: "https://arxiv.org/abs/1904.09751",
  paperTitle: "The Curious Case of Neural Text Degeneration",
  paperContext: `
You are the discussion partner for one research paper: "The Curious Case of Neural Text Degeneration" by Ari Holtzman, Jan Buys, Li Du, Maxwell Forbes, and Yejin Choi.

Use this compact paper context when answering:
- The paper studies open-ended neural text generation and compares human text with text produced by likelihood-maximizing decoding and stochastic sampling.
- Maximization methods such as greedy and beam search often become bland or repetitive, even when the underlying language model assigns useful probabilities.
- Sampling from the full distribution avoids some repetition but can select from an unreliable low-probability tail, producing incoherent continuations.
- Nucleus sampling, also called top-p sampling, sorts next-token probabilities and retains the smallest dynamic set whose cumulative mass is at least p. It samples only from that renormalized set.
- Unlike top-k, the nucleus changes size with the uncertainty of the model: it is small for peaked distributions and larger for flatter distributions.
- The paper's central lesson is that generation quality depends on the decoding algorithm, not only on model weights or likelihood.
- Nucleus sampling is a decoding heuristic, not a source of new knowledge, a safety system, or a guarantee of factuality. The choice of p remains application-dependent.

Answer precisely and pedagogically. Distinguish claims made by the paper from later practice. If the question cannot be answered from this context, say what additional source would be needed. Keep answers under 220 words unless the user asks for more detail.
`.trim(),
  summary: [
    {
      label: "The problem.",
      body:
        "A language model produces a probability distribution over the next token. Turning that distribution into text requires a separate decoding decision. Greedy search and beam search maximize likelihood, yet open-ended generations from these methods often become generic and repeat themselves.",
    },
    {
      label: "The other failure mode.",
      body:
        "Sampling from the complete distribution introduces diversity, but it also exposes the unreliable tail: many individually unlikely tokens that collectively contain substantial probability mass. Selecting one of them can push a continuation away from coherent human language.",
    },
    {
      label: "The finding.",
      body:
        "Nucleus sampling sorts tokens by probability and keeps the smallest dynamic set whose cumulative mass reaches a threshold p. The candidate set contracts when the model is confident and expands when uncertainty is genuinely distributed across several plausible continuations.",
    },
    {
      label: "The implication.",
      body:
        "Generation quality is not determined by model weights alone. The same model can produce repetitive, incoherent, or fluent text depending on its inference policy. Top-p is a useful heuristic, not new knowledge, factuality, or safety, and its threshold remains an application decision.",
    },
  ],
  diagram: {
    thresholdLabel: "Nucleus threshold",
    retainedLabel: "tokens retained",
    massLabel: "cumulative mass",
    tailLabel: "tail removed before sampling",
    distribution: [
      { token: "the", probability: 0.32 },
      { token: "a", probability: 0.24 },
      { token: "this", probability: 0.16 },
      { token: "one", probability: 0.1 },
      { token: "some", probability: 0.07 },
      { token: "very", probability: 0.05 },
      { token: "odd", probability: 0.03 },
      { token: "rare", probability: 0.02 },
      { token: "noise", probability: 0.01 },
    ],
  },
  questions: {
    intro:
      "Ask an LLM to explain, challenge, or extend the summary while keeping the discussion grounded in this paper.",
    suggestions: [
      "Why does beam search repeat?",
      "How is top-p different from top-k?",
      "What does this paper not solve?",
    ],
  },
  implementation: {
    filename: "nucleus-sampling.js",
    intro:
      "Begin with the complete solution. Run it, then hide any conceptual block and reconstruct it without losing the surrounding program. Checks judge behavior rather than exact text.",
    codeBlocks: [
      {
        id: "softmax",
        label: "Temperature-scaled softmax",
        purpose: "Convert logits into a normalized next-token distribution.",
        concepts: [
          {
            name: "safeTemperature",
            detail: "Clamp the denominator before scaling so temperature cannot divide logits by zero.",
          },
          {
            name: "maxLogit",
            detail: "Subtract the largest scaled logit before exponentiation to keep exp() numerically stable.",
          },
          {
            name: "total",
            detail: "Normalize every positive weight into a probability distribution whose mass sums to 1.",
          },
        ],
        code: `function softmax(logits, temperature = 1) {
  const safeTemperature =
    Number.isFinite(temperature) && temperature > 0 ? temperature : 1;
  const scaled = logits.map((logit) => logit / safeTemperature);
  const maxLogit = Math.max(...scaled);
  const weights = scaled.map((logit) => Math.exp(logit - maxLogit));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map((weight) => weight / total);
}`,
      },
      {
        id: "nucleus",
        label: "Dynamic nucleus",
        purpose: "Keep the smallest ranked token set whose probability mass reaches p.",
        concepts: [
          {
            name: "ranked",
            detail: "Sort candidate tokens from most likely to least likely before applying the cumulative cutoff.",
          },
          {
            name: "cumulativeMass",
            detail: "Track how much probability mass the dynamic nucleus has captured.",
          },
          {
            name: "renormalized",
            detail: "Return probabilities scaled back to sum to 1 after the low-probability tail is removed.",
          },
        ],
        code: `function nucleus(tokens, probabilities, topP = 0.9) {
  const ranked = tokens
    .map((token, index) => ({ token, index, probability: probabilities[index] }))
    .sort((a, b) => b.probability - a.probability);

  const kept = [];
  let cumulativeMass = 0;

  for (const candidate of ranked) {
    kept.push(candidate);
    cumulativeMass += candidate.probability;
    if (cumulativeMass >= topP) break;
  }

  return kept.map((candidate) => ({
    ...candidate,
    probability: candidate.probability / cumulativeMass,
  }));
}`,
      },
      {
        id: "policy",
        label: "Generation policy",
        purpose: "Expose the inference-time controls used by the local transformer.",
        concepts: [
          {
            name: "temperature",
            detail: "Lower values sharpen the distribution; higher values flatten it.",
          },
          {
            name: "top_p",
            detail: "Keep the smallest dynamic token set whose cumulative probability reaches this threshold.",
          },
          {
            name: "repetition_penalty",
            detail: "Reduce the model's tendency to reuse tokens it has already emitted.",
          },
        ],
        code: `const policy = {
  temperature: 0.78,
  top_k: 50,
  top_p: 0.9,
  repetition_penalty: 1.12,
  no_repeat_ngram_size: 3,
  max_new_tokens: 64,
};`,
      },
      {
        id: "contract",
        label: "Output contract",
        purpose: "Apply deterministic product requirements after token decoding.",
        concepts: [
          {
            name: "banned",
            detail: "Remove product-specific phrases after generation without changing the model weights.",
          },
          {
            name: "words",
            detail: "Count user-visible tokens at the text level, not the model-token level.",
          },
          {
            name: "maxWords",
            detail: "Enforce a predictable product boundary after stochastic decoding has finished.",
          },
        ],
        code: `function enforceOutputContract(text, { maxWords, banned }) {
  let output = text.replace(/[*_\\x60#>]/g, " ");

  for (const phrase of banned) {
    let matchIndex = output.toLowerCase().indexOf(phrase.toLowerCase());
    while (matchIndex !== -1) {
      output = output.slice(0, matchIndex) + output.slice(matchIndex + phrase.length);
      matchIndex = output.toLowerCase().indexOf(phrase.toLowerCase());
    }
  }

  const words = output.replace(/\\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.length > maxWords
    ? words.slice(0, maxWords).join(" ") + "…"
    : words.join(" ");
}`,
      },
    ],
  },
  browserModel: {
    modelId: "onnx-community/SmolLM2-135M-Instruct-ONNX",
    displayName: "SmolLM2-135M-Instruct · q4",
    loadLabel: "Load model · ~181 MB",
  },
  footer: {
    label: "Paper lab 01 complete",
    next: "Next: train a character-level language model from Karpathy's recurrent-network essay.",
  },
};
