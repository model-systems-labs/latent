import type { PaperLesson } from "@latent/course-kit";

export const neuralTextDegenerationLesson: PaperLesson = {
  id: "neural-text-degeneration",
  labLabel: "Paper lab 01",
  navLabel: "Paper lab 01",
  eyebrow: "Decoding · Holtzman et al. · 2020",
  title: "Neural Text Degeneration",
  thesis:
    "The model is only half of the generator. The way you pick each next token can be the difference between clear writing, endless repetition, and plain noise.",
  paperUrl: "https://arxiv.org/abs/1904.09751",
  paperTitle: "The Curious Case of Neural Text Degeneration",
  paperContext: `
You're helping someone work through one research paper: "The Curious Case of Neural Text Degeneration" by Ari Holtzman, Jan Buys, Li Du, Maxwell Forbes, and Yejin Choi.

Use this short paper summary when you answer:
- The paper looks at open-ended neural text generation. It compares human writing with text made by likelihood-maximizing decoding and stochastic, or random, sampling.
- Maximizing methods like greedy search and beam search often get bland or repetitive, even when the language model itself assigns useful probabilities.
- Sampling from the full distribution avoids some repetition, but it can pick from an unreliable tail of low-probability tokens and send the text off track.
- Nucleus sampling, also called top-p sampling, sorts next-token probabilities and keeps the smallest changing set whose cumulative probability mass is at least p. It samples only from that renormalized set.
- Unlike top-k, the nucleus gets smaller when the model is confident and larger when the distribution is flatter.
- The paper's main point is that generation quality depends on the decoding algorithm, not just the model's weights or likelihood.
- Nucleus sampling is a decoding heuristic—a practical rule of thumb—not new knowledge, a safety system, or a promise that the answer is factual. The right p depends on the application.

Give a clear, accurate answer. Keep the paper's claims separate from what people did later. If this summary isn't enough to answer the question, say what other source you'd need. Stay under 220 words unless they ask for more detail.
`.trim(),
  summary: [
    {
      label: "Where decoding goes wrong.",
      body:
        "A language model gives you probabilities for the next token. You still need a decoding rule to turn those probabilities into text. Greedy search and beam search chase the highest likelihood, but their open-ended writing often gets generic and starts repeating itself.",
    },
    {
      label: "The other way it can fail.",
      body:
        "Sampling from the full distribution adds variety, but it also opens the door to an unreliable tail. That tail contains lots of individually unlikely tokens whose combined probability mass is still substantial. Picking one can knock the continuation away from clear, human-sounding language.",
    },
    {
      label: "What nucleus sampling does.",
      body:
        "Nucleus sampling sorts tokens by probability and keeps the smallest changing set whose cumulative probability mass reaches the threshold p. The candidate set shrinks when the model is confident and grows when several next tokens are honestly plausible.",
    },
    {
      label: "Why it matters.",
      body:
        "Model weights don't decide generation quality on their own. The same model can produce repetitive, confusing, or fluent text depending on its inference policy, meaning its decoding setup. Top-p is a useful heuristic, but it doesn't add knowledge, factuality, or safety. You still have to choose the threshold for your specific use case.",
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
      "Ask an LLM to explain, question, or build on the summary while sticking to what this paper actually says.",
    suggestions: [
      "Why does beam search repeat?",
      "How is top-p different from top-k?",
      "What does this paper not solve?",
    ],
  },
  implementation: {
    filename: "nucleus-sampling.py",
    intro:
      "Start with the complete Python and NumPy solution and run it once. Then hide any concept block and rebuild it without losing the rest of the program. The checks care about what your code does, not whether the text matches exactly.",
    codeBlocks: [
      {
        id: "softmax",
        label: "Temperature-scaled softmax",
        purpose: "Turn logits into normalized probabilities for the next token.",
        concepts: [
          {
            name: "safe_temperature",
            detail: "Put a safe floor under the denominator so temperature can't divide the logits by zero.",
          },
          {
            name: "max_logit",
            detail: "Subtract the largest scaled logit before exponentiation so exp() stays numerically stable.",
          },
          {
            name: "total",
            detail: "Turn all the positive weights into probabilities that add up to 1.",
          },
        ],
        code: `import numpy as np


def softmax(logits, temperature=1):
    values = np.asarray(logits, dtype=float)
    if values.size == 0:
        return []

    safe_temperature = (
        temperature if np.isfinite(temperature) and temperature > 0 else 1
    )
    scaled = values / safe_temperature
    max_logit = np.max(scaled)
    shifted = scaled - max_logit
    weights = np.exp(shifted)
    total = np.sum(weights)
    return (weights / total).tolist()`,
      },
      {
        id: "nucleus",
        label: "Dynamic nucleus",
        purpose: "Keep the smallest ranked set of tokens whose cumulative probability mass reaches p.",
        concepts: [
          {
            name: "ranked",
            detail: "Sort the possible tokens from most likely to least likely before applying the cutoff.",
          },
          {
            name: "cumulative_mass",
            detail: "Keep track of how much cumulative probability mass the changing nucleus has collected.",
          },
          {
            name: "renormalized",
            detail: "After removing the low-probability tail, scale the remaining probabilities so they add up to 1 again.",
          },
        ],
        code: `def nucleus(tokens, probabilities, top_p=0.9):
    ranked = sorted(
        [
            {"token": token, "index": index, "probability": probabilities[index]}
            for index, token in enumerate(tokens)
        ],
        key=lambda candidate: candidate["probability"],
        reverse=True,
    )

    kept = []
    cumulative_mass = 0.0
    for candidate in ranked:
        kept.append(candidate)
        cumulative_mass += candidate["probability"]
        if cumulative_mass >= top_p:
            break

    return [
        {
            **candidate,
            "probability": candidate["probability"] / cumulative_mass,
        }
        for candidate in kept
    ]`,
      },
      {
        id: "policy",
        label: "Generation policy",
        purpose: "Show the generation controls used by the local transformer.",
        concepts: [
          {
            name: "temperature",
            detail: "Lower values make the distribution sharper; higher values make it flatter.",
          },
          {
            name: "top_p",
            detail: "Keep the smallest changing set of tokens whose cumulative probability mass reaches this threshold.",
          },
          {
            name: "repetition_penalty",
            detail: "Make the model less likely to reuse tokens it already wrote.",
          },
        ],
        code: `policy = {
    "temperature": 0.78,
    "top_k": 50,
    "top_p": 0.9,
    "repetition_penalty": 1.12,
    "no_repeat_ngram_size": 3,
    "max_new_tokens": 64,
}`,
      },
      {
        id: "contract",
        label: "Output contract",
        purpose: "Apply fixed product rules after token decoding.",
        concepts: [
          {
            name: "banned",
            detail: "Remove product-specific phrases after generation without touching the model weights.",
          },
          {
            name: "words",
            detail: "Count the words people see in the text, not the model's internal tokens.",
          },
          {
            name: "max_words",
            detail: "Enforce a clear product limit after random decoding is done.",
          },
        ],
        code: `import re


def enforce_output_contract(text, config):
    max_words = config["maxWords"]
    banned = config["banned"]
    output = re.sub(r"[*_\\x60#>]", " ", text)

    for phrase in banned:
        output = re.sub(re.escape(phrase), "", output, flags=re.IGNORECASE)

    words = output.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]) + "…"
    return " ".join(words)`,
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
    next: "Next up: train a character-level language model based on Karpathy's recurrent-network essay.",
  },
};
