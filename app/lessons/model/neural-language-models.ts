import type { CourseLesson } from "@latent/course-kit";
import { withGuidedExercises } from "../guided-exercises";
import { commonQuestionInstruction } from "./shared";

export const neuralLanguageModelsLesson = withGuidedExercises({
    id: "neural-language-models",
    number: 2,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Embeddings · Next-token prediction",
    title: "Neural Language Models",
    thesis:
      "What the model learns about one word can help it predict related words, instead of treating every context as unrelated.",
    paperUrl: "https://www.jmlr.org/papers/v3/bengio03a.html",
    paperTitle: "A Neural Probabilistic Language Model",
    authors: "Yoshua Bengio, Réjean Ducharme, Pascal Vincent, Christian Jauvin",
    year: "2003",
    paperContext: `
This lesson walks through "A Neural Probabilistic Language Model" by Bengio, Ducharme, Vincent, and Jauvin.
- Count-based n-grams struggle with word sequences they haven't seen because they treat words and contexts as separate, discrete items.
- The model learns a vector for each word and a neural probability function for the next word at the same time.
- When related words get nearby vectors, training on one sentence can help with similar sentences.
- The paper compares neural language models with statistical baselines and covers the compute cost of scoring the whole output vocabulary.
- This browser lab uses a smaller context-embedding softmax model, not the paper's full architecture or datasets.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "How an n-gram counts.",
        body:
          "An n-gram model guesses the next word from an exact window of earlier words. A trigram estimate for “the researcher reads” depends on how often that exact three-word sequence showed up. If the model never saw “the researcher,” that count gives it no direct help—even if it saw “the analyst reads” many times.",
      },
      {
        label: "Look up the embeddings.",
        body:
          "Give every word in the vocabulary an integer id, then use that id to pick a row from a trainable embedding table. Each row is a short vector of continuous values. For a two-word context, this lab looks up both rows and averages them coordinate by coordinate to make one context vector.",
      },
      {
        label: "Score every possible next word.",
        body:
          "A learned projection turns the context vector into one logit—a raw score—for every possible next word. Softmax exponentiates the score differences and divides by their total. Subtracting the largest logit first doesn't change the probabilities, but it does prevent numerical overflow.",
      },
      {
        label: "Score the real next word.",
        body:
          "Training scores the real next word with −log p(target). With 30 vocabulary items, a uniform model gives each one probability 1/30 and gets a loss of ln(30) ≈ 3.40. A validation loss of 2.53 means a perplexity of exp(2.53) ≈ 12.6. In effect, the model has cut its next-word uncertainty from 30 equally likely choices to about 12.6.",
      },
      {
        label: "Learn both parts together.",
        body:
          "Backpropagation updates the output projection and the chosen embedding rows together. Words end up with nearby vectors only when similar coordinates help predict what follows them. The nearest-neighbor list after training shows the shape the model learned; it isn't a dictionary of meanings someone entered by hand.",
      },
      {
        label: "A big vocabulary costs more.",
        body:
          "This lab has 30 output words, but a production vocabulary can have tens of thousands of tokens. Creating and normalizing one logit for every item makes the output layer expensive. Modern models use different context encoders, but embedding lookup, logits, stable softmax, and negative log-likelihood are still basic building blocks.",
      },
    ],
    claims: {
      paper: "Distributed word representations help models go beyond the exact n-grams they saw during training.",
      lab: "You'll train a small context-embedding model and compare it with a count-based baseline on held-out examples.",
      limit: "The lab leaves out the paper's deeper hidden network, large dataset, and full vocabulary-softmax cost.",
    },
    diagram: {
      title: "Context vectors to next-word loss",
      caption: "Here's a small numerical example with a three-word output vocabulary. The live experiment runs the same steps over 30 words and learns both the embedding table and the output projection.",
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
      intro: "Ask about embeddings, perplexity, the n-gram comparison, or which parts of this 2003 design still show up in today's LLMs.",
      suggestions: [
        "Why do embeddings reduce sparsity?",
        "What does perplexity measure?",
        "Why is the vocabulary softmax expensive?",
      ],
    },
    dataset: {
      name: "Roles and Actions",
      source: "Course-authored synthetic corpus",
      license: "Not separately licensed",
      size: "20 sentences · fixed example-by-example modulo split",
      preview: "the analyst reads the report · the model predicts the token",
    },
    implementation: {
      filename: "neural-language-model.py",
      intro: "Implement stable softmax, average the context embeddings, and compute the target loss. Run each function independently before training.",
      tensorOps: ["numpy", "np.asarray", "np.exp", "np.mean", "np.log", "tolist"],
      codeBlocks: [
        {
          id: "stable-softmax",
          label: "Stable softmax",
          purpose: "Turn vocabulary logits into probabilities without exponent overflow.",
          concepts: [
            { name: "logits", detail: "One raw score for each vocabulary word. They aren't probabilities yet." },
            { name: "shifted", detail: "Subtracts max(logits) before exponentiation to keep the math stable." },
            { name: "result", detail: "One finite probability for each input logit, adding up to 1." },
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
          purpose: "Average the learned vectors for the words in the context.",
          concepts: [
            { name: "indices", detail: "The vocabulary ids for every word in the current context window." },
            { name: "table[indices]", detail: "Picks one trainable table row for each id while keeping the order and repeats." },
            { name: "mean(axis=0)", detail: "Averages down the rows, leaving one value for each embedding coordinate." },
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
          purpose: "Turn the target word's probability into a training loss.",
          concepts: [
            { name: "target_index", detail: "The index of the real next word." },
            { name: "probability", detail: "Read the probability at target_index, not whichever value is largest." },
            { name: "np.log", detail: "Returns −log p(target) after keeping p from falling below 10⁻¹²." },
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
        raise ValueError("negative_log_likelihood needs a probability vector and valid target index")
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
      intro: "Run the two-word trainer, then inspect its validation loss, next-word probabilities, and nearest embedding neighbors.",
    },
  } satisfies Omit<CourseLesson, "sources">);
