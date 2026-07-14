import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const neuralLanguageModelsLesson = {
    id: "neural-language-models",
    number: 2,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Embeddings · Bengio et al. · 2003",
    title: "Neural Language Models",
    thesis:
      "A learned continuous representation lets related words share statistical strength instead of treating every context as an unrelated symbolic event.",
    paperUrl: "https://www.jmlr.org/papers/v3/bengio03a.html",
    paperTitle: "A Neural Probabilistic Language Model",
    authors: "Yoshua Bengio, Réjean Ducharme, Pascal Vincent, Christian Jauvin",
    year: "2003",
    paperContext: `
This lesson concerns "A Neural Probabilistic Language Model" by Bengio, Ducharme, Vincent, and Jauvin.
- Count-based n-grams generalize poorly to unseen word sequences because words and contexts are discrete.
- The model jointly learns a distributed vector representation for each word and a neural probability function over the next word.
- Nearby representations allow training on one sentence to affect predictions for related sentences.
- The paper evaluates neural language models against statistical baselines and discusses the computational cost of the output vocabulary.
- This browser lab uses a smaller context-embedding softmax model rather than the paper's full architecture and corpora.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Discrete n-gram estimate.",
        body:
          "An n-gram model estimates the next word from an exact window of preceding words. A trigram estimate for “the researcher reads” depends on how often that exact three-word sequence occurred. If “the researcher” never appeared, its count supplies no direct evidence—even if “the analyst reads” appeared many times.",
      },
      {
        label: "Embedding lookup.",
        body:
          "Assign every vocabulary word an integer id, then use that id to select one row of a trainable embedding table. That row is a short vector of continuous coordinates. For a two-word context, this lab looks up two rows and averages each coordinate to produce one context vector.",
      },
      {
        label: "Vocabulary logits.",
        body:
          "A learned projection maps the context vector to one logit—a raw, unnormalized score—for every possible next word. Softmax exponentiates relative score differences and divides by their sum. Subtracting the largest logit first leaves the probabilities unchanged while preventing numerical overflow.",
      },
      {
        label: "Negative log-likelihood.",
        body:
          "Training scores the observed next word with −log p(target). With 30 vocabulary items, a uniform model assigns probability 1/30 and has loss ln(30) ≈ 3.40. A validation loss of 2.53 corresponds to perplexity exp(2.53) ≈ 12.6: the model has reduced the effective next-word uncertainty from 30 equally likely choices.",
      },
      {
        label: "Joint parameter learning.",
        body:
          "Backpropagation updates the output projection and the selected embedding rows together. Words acquire nearby vectors only when similar coordinates help predict their observed continuations; the nearest-neighbor list after training is evidence about the learned geometry, not a dictionary of manually assigned meanings.",
      },
      {
        label: "Vocabulary-scale cost.",
        body:
          "The lab has 30 output words, but a production vocabulary may contain tens of thousands of tokens. Producing and normalizing one logit per vocabulary item makes the output layer expensive. Modern architectures change the context encoder, yet embedding lookup, logits, stable softmax, and negative log-likelihood remain fundamental.",
      },
    ],
    claims: {
      paper: "Distributed word representations improve generalization beyond exact observed n-grams.",
      lab: "A small context-embedding model is trained and compared with a count baseline on held-out examples.",
      limit: "The lab omits the paper's hidden network depth, corpus size, and full vocabulary-softmax cost.",
    },
    diagram: {
      title: "Context vectors to next-word loss",
      caption: "A numerical toy path for a three-word output vocabulary. The live experiment repeats the same operations over 30 words and learns both the embedding table and output projection.",
      nodes: [
        { label: "Context ids", value: "the analyst → [4, 17]" },
        { label: "Embedding lookup", value: "[.6, −.2], [.2, .8]" },
        { label: "Mean context", value: "c = [.4, .3]" },
        { label: "Vocabulary logits", value: "z = [1.2, .1, −.4]" },
        { label: "Stable softmax", value: "p = [.65, .22, .13]" },
        { label: "Target loss", value: "−log .65 = .43" },
      ],
    },
    questions: {
      intro: "Ask about embeddings, perplexity, the n-gram comparison, or which parts of the 2003 architecture persist in current LLMs.",
      suggestions: [
        "Why do embeddings reduce sparsity?",
        "What does perplexity measure?",
        "Why is the vocabulary softmax expensive?",
      ],
    },
    dataset: {
      name: "Roles and Actions",
      source: "Original synthetic course corpus",
      license: "CC0",
      size: "20 sentences · deterministic example-level modulo split",
      preview: "the analyst reads the report · the model predicts the token",
    },
    implementation: {
      filename: "neural-language-model.py",
      intro: "Reconstruct the same numerical path in Python and NumPy. First normalize logits stably, then combine every selected context row coordinate by coordinate, and finally score the observed target. Each cell runs independently before the supplied model trains.",
      tensorOps: ["numpy", "np.asarray", "np.exp", "np.mean", "np.log", "tolist"],
      codeBlocks: [
        {
          id: "stable-softmax",
          label: "Stable softmax",
          purpose: "Normalize vocabulary logits without exponent overflow.",
          concepts: [
            { name: "logits", detail: "One raw score per vocabulary word; they are not probabilities yet." },
            { name: "shifted", detail: "Subtracts max(logits) before exponentiation for numerical stability." },
            { name: "result", detail: "One finite probability per input logit, summing to 1." },
          ],
          code: `import numpy as np

def stable_softmax(logits):
    values = np.asarray(logits, dtype=float)
    if values.size == 0:
        return []
    shifted = values - np.max(values)
    weights = np.exp(shifted)
    return (weights / weights.sum()).tolist()`,
          checkCode: `probabilities = stable_softmax([1001, 1000, 999])
total = sum(probabilities)
RESULT = {
    "passed": all(np.isfinite(probabilities)) and abs(total - 1) < 1e-9,
    "detail": f"Σp = {total:.9f}",
}`,
        },
        {
          id: "context-embedding",
          label: "Context representation",
          purpose: "Average the learned vectors for the context words.",
          concepts: [
            { name: "indices", detail: "Vocabulary ids for every word in the current context window." },
            { name: "table[indices]", detail: "Selects one trainable table row for each id, preserving order and repeats." },
            { name: "mean(axis=0)", detail: "Averages down the row axis, leaving one value per embedding coordinate." },
          ],
          code: `import numpy as np

def context_embedding(indices, embeddings):
    table = np.asarray(embeddings, dtype=float)
    if table.ndim != 2 or not isinstance(indices, (list, tuple)):
        raise ValueError("embedding needs a rank-2 table and index array")
    if any(
        type(index) is not int or index < 0 or index >= table.shape[0]
        for index in indices
    ):
        raise ValueError("embedding index is out of range")
    selected = table[np.asarray(indices, dtype=int)]
    return selected.mean(axis=0).tolist()`,
          checkCode: `vector = context_embedding([0, 1], [[2, 0], [0, 4]])
RESULT = {
    "passed": vector == [1, 2],
    "detail": "context = [" + ", ".join(f"{value:g}" for value in vector) + "]",
}`,
        },
        {
          id: "negative-log-likelihood",
          label: "Negative log-likelihood",
          purpose: "Convert the target word probability into a training loss.",
          concepts: [
            { name: "target_index", detail: "Index of the observed next word." },
            { name: "probability", detail: "Read only the model mass at target_index, not the maximum value." },
            { name: "np.log", detail: "Returns −log p(target) after clamping p to 10⁻¹²." },
          ],
          code: `import numpy as np

def negative_log_likelihood(probabilities, target_index):
    values = np.asarray(probabilities, dtype=float)
    if (
        values.ndim != 1
        or type(target_index) is not int
        or target_index < 0
        or target_index >= values.size
    ):
        raise ValueError("nllLoss needs a probability vector and valid target index")
    probability = max(float(values[target_index]), 1e-12)
    return float(-np.log(probability))`,
          checkCode: `certain = negative_log_likelihood([0.05, 0.9, 0.05], 1)
uncertain = negative_log_likelihood([0.45, 0.1, 0.45], 1)
RESULT = {
    "passed": certain < uncertain,
    "detail": f"{certain:.3f} < {uncertain:.3f}",
}`,
        },
      ],
    },
    experiment: {
      kind: "neural-lm",
      title: "Train the embedding model",
      intro: "Run the supplied two-word reference trainer, then inspect validation loss, its next-word distribution, and nearest embedding neighbors. The replay does not execute the learner cells.",
    },
  } satisfies Omit<CourseLesson, "sources">;
