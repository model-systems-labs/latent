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
        label: "Sparsity problem.",
        body:
          "A count-based model treats two contexts as unrelated unless their symbols match. Most plausible word sequences are absent even from large corpora, so memorizing observed n-grams cannot provide smooth generalization.",
      },
      {
        label: "Distributed representation.",
        body:
          "Each word indexes a learned vector. The probability function consumes several context vectors, which means parameter updates can move semantically or syntactically similar words toward representations that produce similar predictions.",
      },
      {
        label: "Joint optimization.",
        body:
          "The embedding table and next-word predictor are trained together by maximizing the probability of observed text. The vectors are not manually assigned meanings; their geometry is useful only insofar as it reduces language-model loss.",
      },
      {
        label: "Persistent bottleneck.",
        body:
          "Computing and normalizing one score for every vocabulary item is expensive. Modern language models change the architecture and scale dramatically, but embedding lookup, logits, softmax, and cross-entropy remain central operations.",
      },
    ],
    claims: {
      paper: "Distributed word representations improve generalization beyond exact observed n-grams.",
      lab: "A small context-embedding model is trained and compared with a count baseline on held-out examples.",
      limit: "The lab omits the paper's hidden network depth, corpus size, and full vocabulary-softmax cost.",
    },
    diagram: {
      title: "Neural next-word probability",
      caption: "Word indices retrieve vectors; the predictor maps the combined context to one logit per vocabulary item.",
      nodes: [
        { label: "Context", value: "w_(t-2), w_(t-1)" },
        { label: "Lookup", value: "embedding vectors" },
        { label: "Projection", value: "vocabulary logits" },
        { label: "Objective", value: "−log p(w_t)" },
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
      size: "24 sentences · deterministic split",
      preview: "the analyst reads the report · the model predicts the token",
    },
    implementation: {
      filename: "neural-language-model.js",
      intro: "Reconstruct the numerical path from context vectors to a normalized loss before training the supplied model.",
      tensorOps: ["tensor", "softmax", "embedding", "mean", "nllLoss", "toArray"],
      codeBlocks: [
        {
          id: "stable-softmax",
          label: "Stable softmax",
          purpose: "Normalize vocabulary logits without exponent overflow.",
          concepts: [
            { name: "tensor", detail: "Tracks the vector shape and differentiable operation graph." },
            { name: "softmax", detail: "Subtracts the maximum internally before normalization." },
            { name: "toArray", detail: "Returns the normalized vocabulary distribution." },
          ],
          code: `function stableSoftmax(logits) {
  return toArray(softmax(tensor(logits)));
}`,
          checkCode: `const probabilities = stableSoftmax([1001, 1000, 999]);
const total = probabilities.reduce((sum, value) => sum + value, 0);
return { passed: probabilities.every(Number.isFinite) && Math.abs(total - 1) < 1e-9, detail: "Σp = " + total.toFixed(9) };`,
        },
        {
          id: "context-embedding",
          label: "Context representation",
          purpose: "Average the learned vectors for the context words.",
          concepts: [
            { name: "indices", detail: "Vocabulary ids in the current context window." },
            { name: "embeddings", detail: "Trainable lookup table indexed by word id." },
            { name: "dimension", detail: "Width of each distributed representation." },
          ],
          code: `function contextEmbedding(indices, embeddings) {
  const selected = embedding(tensor(embeddings), indices);
  return toArray(mean(selected, 0));
}`,
          checkCode: `const vector = contextEmbedding([0, 1], [[2, 0], [0, 4]]);
return { passed: vector[0] === 1 && vector[1] === 2, detail: "context = [" + vector.join(", ") + "]" };`,
        },
        {
          id: "negative-log-likelihood",
          label: "Negative log-likelihood",
          purpose: "Convert the target word probability into a training loss.",
          concepts: [
            { name: "targetIndex", detail: "Index of the observed next word." },
            { name: "probability", detail: "Model mass assigned to that word." },
            { name: "nllLoss", detail: "Uses a finite lower bound before taking the logarithm." },
          ],
          code: `function negativeLogLikelihood(probabilities, targetIndex) {
  return nllLoss(tensor(probabilities), targetIndex).item();
}`,
          checkCode: `const certain = negativeLogLikelihood([0.05, 0.9, 0.05], 1);
const uncertain = negativeLogLikelihood([0.45, 0.1, 0.45], 1);
return { passed: certain < uncertain, detail: certain.toFixed(3) + " < " + uncertain.toFixed(3) };`,
        },
      ],
    },
    experiment: {
      kind: "neural-lm",
      title: "Train the embedding model",
      intro: "Fit a two-word context model, then inspect validation loss, its next-word distribution, and nearest embedding neighbors.",
    },
  } satisfies Omit<CourseLesson, "sources">;
