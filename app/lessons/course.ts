import { llmSystemsManifest } from "../content/llm-systems/manifest";
import { deriveCurriculum } from "../platform/lms/curriculum";
import type { CourseLesson, CourseTrack } from "../lib/lesson-types";
import { productLessons, systemsLessons } from "./extended-course";
import { getLessonSources } from "./sources";

const commonQuestionInstruction = `
Answer precisely and pedagogically. Separate the source's claims from later practice. If the supplied context is insufficient, say what evidence would be needed. Do not invent quotations, page numbers, experiments, or results. Keep answers under 240 words unless the learner asks for more detail.
`.trim();

const modelLessons: Array<Omit<CourseLesson, "sources">> = [
  {
    id: "character-rnns",
    number: 1,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Sequence models · Karpathy · 2015",
    title: "Character RNNs",
    thesis:
      "A recurrent network can learn a distribution over the next character by repeatedly updating a hidden state and minimizing cross-entropy through time.",
    paperUrl: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
    paperTitle: "The Unreasonable Effectiveness of Recurrent Neural Networks",
    authors: "Andrej Karpathy",
    year: "2015 · technical essay",
    paperContext: `
This lesson concerns Andrej Karpathy's 2015 technical essay "The Unreasonable Effectiveness of Recurrent Neural Networks."
- A recurrent network applies the same learned transition at every sequence position and carries a hidden state forward.
- A character language model receives a character, predicts a distribution over the next character, and is trained with softmax cross-entropy.
- Backpropagation through time assigns credit through the unrolled recurrent computation.
- Generated text is sampled autoregressively: each sampled character becomes the next input.
- The essay demonstrates that models trained only for next-character prediction can learn local syntax, document structure, and longer patterns.
- The essay's examples use substantially larger LSTMs and datasets than this browser lab.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "State transition.",
        body:
          "At position t, the model combines the current character vector x_t with the previous hidden state h_(t-1). The same matrices are reused across the entire sequence, so a fixed parameter set can process inputs of arbitrary length.",
      },
      {
        label: "Training objective.",
        body:
          "The output state is projected to one logit per character. Softmax converts those logits into a next-character distribution, and cross-entropy penalizes the probability assigned to the observed next character.",
      },
      {
        label: "Temporal credit.",
        body:
          "Backpropagation through time unrolls the recurrent transition and accumulates parameter gradients from multiple positions. Repeated multiplication through the hidden transition can produce unstable gradients, which motivates clipping and gated recurrent architectures.",
      },
      {
        label: "Generation.",
        body:
          "After training, the model samples a character, feeds it back as the next input, and repeats. It does not store sentences explicitly; regularities emerge because predicting the next character rewards useful internal state.",
      },
    ],
    claims: {
      paper: "Next-character prediction can induce representations of syntax, formatting, and longer-range structure.",
      lab: "A real vanilla RNN is trained with truncated backpropagation and gradient clipping in this browser tab.",
      limit: "The supplied corpus and model are deliberately tiny; this does not reproduce the essay's multi-layer LSTM results.",
    },
    diagram: {
      title: "Unrolled recurrent computation",
      caption: "The transition parameters are shared at every position; only the state and input change.",
      nodes: [
        { label: "Input", value: "x_t" },
        { label: "Previous state", value: "h_(t-1)" },
        { label: "Transition", value: "tanh(Wx + Uh + b)" },
        { label: "Prediction", value: "p(x_(t+1))" },
      ],
    },
    questions: {
      intro: "Ask about recurrence, backpropagation through time, hidden-state behavior, or the limits of the browser experiment.",
      suggestions: [
        "Why can recurrent gradients explode?",
        "What information can the hidden state retain?",
        "What does next-character loss actually reward?",
      ],
    },
    dataset: {
      name: "Signal Notes",
      source: "Original synthetic course corpus",
      license: "CC0",
      size: "430 characters · fixed split",
      preview: "the receiver counted one quiet pulse. the signal crossed the empty sky.",
    },
    implementation: {
      filename: "character-rnn.js",
      intro:
        "The complete reference implementation is visible. Hide one transition, loss, or stabilization block and reconstruct it while the rest of the program remains in place.",
      codeBlocks: [
        {
          id: "rnn-step",
          label: "Recurrent transition",
          purpose: "Combine the current input with the previous hidden state.",
          concepts: [
            { name: "input", detail: "One-hot character vector for the current position." },
            { name: "previous", detail: "Hidden state carried from the preceding position." },
            { name: "Math.tanh", detail: "Bounded nonlinearity applied to each hidden unit." },
          ],
          code: `function rnnStep(input, previous, { Wxh, Whh, bias }) {
  return bias.map((offset, row) => {
    const fromInput = Wxh[row].reduce(
      (sum, weight, column) => sum + weight * input[column],
      0,
    );
    const fromState = Whh[row].reduce(
      (sum, weight, column) => sum + weight * previous[column],
      0,
    );
    return Math.tanh(offset + fromInput + fromState);
  });
}`,
          checkCode: `const state = rnnStep([1, 0], [0, 0], {
  Wxh: [[1, 0], [0, 1]], Whh: [[0, 0], [0, 0]], bias: [0, 0]
});
return { passed: state.length === 2 && state[0] > 0.7 && state[1] === 0, detail: "h = [" + state.map(v => v.toFixed(3)).join(", ") + "]" };`,
        },
        {
          id: "cross-entropy",
          label: "Cross-entropy loss",
          purpose: "Penalize low probability on the observed next character.",
          concepts: [
            { name: "probabilities", detail: "Normalized next-character distribution." },
            { name: "targetIndex", detail: "Vocabulary index of the observed next character." },
            { name: "epsilon", detail: "Prevents log(0) from producing infinite loss." },
          ],
          code: `function crossEntropy(probabilities, targetIndex) {
  const epsilon = 1e-12;
  return -Math.log(Math.max(probabilities[targetIndex], epsilon));
}`,
          checkCode: `const good = crossEntropy([0.1, 0.8, 0.1], 1);
const bad = crossEntropy([0.8, 0.1, 0.1], 1);
return { passed: Number.isFinite(good) && good < bad, detail: "correct target loss " + good.toFixed(3) };`,
        },
        {
          id: "gradient-clipping",
          label: "Gradient clipping",
          purpose: "Bound the update produced by unstable recurrent gradients.",
          concepts: [
            { name: "limit", detail: "Largest allowed absolute gradient value." },
            { name: "Math.max", detail: "Applies the lower clipping boundary." },
            { name: "Math.min", detail: "Applies the upper clipping boundary." },
          ],
          code: `function clipGradients(gradients, limit = 5) {
  return gradients.map((value) => Math.max(-limit, Math.min(limit, value)));
}`,
          checkCode: `const clipped = clipGradients([-12, -2, 0, 3, 20], 5);
return { passed: clipped.join(",") === "-5,-2,0,3,5", detail: clipped.join(", ") };`,
        },
      ],
    },
    experiment: {
      kind: "rnn",
      title: "Train the recurrent model",
      intro: "Run 600 truncated-BPTT updates, then inspect the loss curve and sample from the trained character distribution.",
    },
  },
  {
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
      codeBlocks: [
        {
          id: "stable-softmax",
          label: "Stable softmax",
          purpose: "Normalize vocabulary logits without exponent overflow.",
          concepts: [
            { name: "maxLogit", detail: "Subtracted before exponentiation for numerical stability." },
            { name: "weights", detail: "Positive unnormalized vocabulary scores." },
            { name: "total", detail: "Partition function used for normalization." },
          ],
          code: `function stableSoftmax(logits) {
  const maxLogit = Math.max(...logits);
  const weights = logits.map((value) => Math.exp(value - maxLogit));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
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
  const dimension = embeddings[0].length;
  return Array.from({ length: dimension }, (_, column) =>
    indices.reduce((sum, index) => sum + embeddings[index][column], 0) /
    indices.length,
  );
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
            { name: "1e-12", detail: "Finite lower bound for logarithms." },
          ],
          code: `function negativeLogLikelihood(probabilities, targetIndex) {
  const probability = Math.max(probabilities[targetIndex], 1e-12);
  return -Math.log(probability);
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
  },
  {
    id: "subword-tokenization",
    number: 3,
    mode: "core-mechanism",
    modeLabel: "Core algorithm",
    eyebrow: "Tokenization · Sennrich et al. · 2016",
    title: "Subword Tokenization",
    thesis:
      "A learned subword vocabulary trades sequence length against vocabulary size while preserving a path for representing unseen words.",
    paperUrl: "https://aclanthology.org/P16-1162/",
    paperTitle: "Neural Machine Translation of Rare Words with Subword Units",
    authors: "Rico Sennrich, Barry Haddow, Alexandra Birch",
    year: "2016",
    paperContext: `
This lesson concerns "Neural Machine Translation of Rare Words with Subword Units" by Sennrich, Haddow, and Birch.
- Fixed word vocabularies create unknown tokens and handle names, compounds, and morphology poorly.
- The paper applies byte-pair encoding to learn frequent symbol merges and represent words as variable-length subword sequences.
- Frequent patterns become compact tokens while rare forms can still be composed from smaller units.
- Vocabulary size and encoded sequence length are coupled design choices.
- The browser lab implements the BPE merge algorithm on a small supplied corpus; it does not reproduce the paper's translation system or BLEU results.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Open vocabulary.",
        body:
          "A word-level model must reserve a finite vocabulary, so rare or unseen forms collapse to an unknown symbol. Character models avoid unknowns but require much longer sequences and must learn common fragments repeatedly.",
      },
      {
        label: "Merge rule.",
        body:
          "BPE begins with small symbols and repeatedly merges the most frequent adjacent pair. The ordered merge list is the learned tokenizer: encoding replays those merges rather than consulting a linguistic dictionary.",
      },
      {
        label: "Statistical compromise.",
        body:
          "Frequent words or morphemes become short token sequences, while rare words remain decomposable. More merges shorten common sequences but enlarge the embedding and output vocabulary used by the language model.",
      },
      {
        label: "Model boundary.",
        body:
          "Tokenization changes what the network predicts, the effective context length, the cost of the output layer, and how text maps back to bytes. It is part of the model system rather than neutral preprocessing.",
      },
    ],
    claims: {
      paper: "Subword representations improve open-vocabulary neural translation, particularly for rare words.",
      lab: "The complete BPE training and encoding algorithm runs on a fixed corpus and exposes every learned merge.",
      limit: "Compression statistics in this lab are not translation-quality measurements.",
    },
    diagram: {
      title: "Learned segmentation",
      caption: "The tokenizer stores an ordered sequence of pair merges, not a list of linguistic rules.",
      nodes: [
        { label: "Initial symbols", value: "l · o · w · e · r" },
        { label: "Pair counts", value: "frequency(a, b)" },
        { label: "Merge", value: "l + o → lo" },
        { label: "Encoded word", value: "low · er" },
      ],
    },
    questions: {
      intro: "Ask about merge ordering, unknown words, vocabulary size, context length, or the difference between BPE and modern byte-level tokenizers.",
      suggestions: [
        "Why does merge order matter?",
        "How does vocabulary size affect compute?",
        "Can BPE still produce unknown tokens?",
      ],
    },
    dataset: {
      name: "Morphology Set",
      source: "Original synthetic course corpus",
      license: "CC0",
      size: "18 short lines · fixed",
      preview: "signal signals signaling signaled · model models modeling modeled",
    },
    implementation: {
      filename: "bpe-tokenizer.js",
      intro: "The tokenizer is compact enough to understand completely. Hide the pair counter, merge operation, or encoder and rebuild it.",
      codeBlocks: [
        {
          id: "pair-counts",
          label: "Adjacent pair counts",
          purpose: "Count candidate merges across the tokenized vocabulary.",
          concepts: [
            { name: "words", detail: "Array of words, each represented as an array of symbols." },
            { name: "pair", detail: "Two neighboring symbols joined by a separator." },
            { name: "counts", detail: "Frequency table used to choose the next merge." },
          ],
          code: `function countPairs(words) {
  const counts = {};
  for (const symbols of words) {
    for (let index = 0; index < symbols.length - 1; index += 1) {
      const pair = symbols[index] + "\u0000" + symbols[index + 1];
      counts[pair] = (counts[pair] ?? 0) + 1;
    }
  }
  return counts;
}`,
          checkCode: `const counts = countPairs([["l", "o", "w"], ["l", "o"]]);
return { passed: counts["l\u0000o"] === 2 && counts["o\u0000w"] === 1, detail: "lo = " + counts["l\u0000o"] };`,
        },
        {
          id: "merge-pair",
          label: "Merge operation",
          purpose: "Replace every occurrence of the selected adjacent pair.",
          concepts: [
            { name: "left", detail: "First symbol in the selected pair." },
            { name: "right", detail: "Second symbol in the selected pair." },
            { name: "output", detail: "New symbol sequence after non-overlapping replacement." },
          ],
          code: `function mergePair(symbols, [left, right]) {
  const output = [];
  for (let index = 0; index < symbols.length; index += 1) {
    if (symbols[index] === left && symbols[index + 1] === right) {
      output.push(left + right);
      index += 1;
    } else {
      output.push(symbols[index]);
    }
  }
  return output;
}`,
          checkCode: `const merged = mergePair(["l", "o", "w", "e", "r"], ["l", "o"]);
return { passed: merged.join("|") === "lo|w|e|r", detail: merged.join(" · ") };`,
        },
        {
          id: "encode-word",
          label: "Ordered encoder",
          purpose: "Replay learned merges in training order on a new word.",
          concepts: [
            { name: "merges", detail: "Ordered list learned from the training corpus." },
            { name: "symbols", detail: "Current segmentation of the new word." },
            { name: "splice", detail: "Replaces one adjacent pair without changing order." },
          ],
          code: `function encodeWord(word, merges) {
  const symbols = [...word];
  for (const [left, right] of merges) {
    for (let index = 0; index < symbols.length - 1; index += 1) {
      if (symbols[index] === left && symbols[index + 1] === right) {
        symbols.splice(index, 2, left + right);
        index -= 1;
      }
    }
  }
  return symbols;
}`,
          checkCode: `const tokens = encodeWord("lower", [["l", "o"], ["lo", "w"], ["e", "r"]]);
return { passed: tokens.join("|") === "low|er", detail: tokens.join(" · ") };`,
        },
      ],
    },
    experiment: {
      kind: "bpe",
      title: "Train the tokenizer",
      intro: "Choose a supplied merge budget and inspect the learned merge list, vocabulary growth, and encoded sequence length.",
    },
  },
  {
    id: "additive-attention",
    number: 4,
    mode: "live-training",
    modeLabel: "Live micro-training",
    eyebrow: "Alignment · Bahdanau et al. · 2015",
    title: "Additive Attention",
    thesis:
      "The decoder can construct a different context vector at every output step by learning soft alignments over all encoder states.",
    paperUrl: "https://arxiv.org/abs/1409.0473",
    paperTitle: "Neural Machine Translation by Jointly Learning to Align and Translate",
    authors: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio",
    year: "2015",
    paperContext: `
This lesson concerns "Neural Machine Translation by Jointly Learning to Align and Translate" by Bahdanau, Cho, and Bengio.
- Earlier encoder-decoder systems compressed a source sentence into a single fixed-length vector.
- The paper proposes a learned alignment model that scores each encoder state for the current decoder state.
- Softmax converts scores into attention weights, and their weighted sum becomes a step-specific context vector.
- The alignment and translation components are trained jointly by gradient descent.
- The browser lab trains the additive scoring function on a deterministic date-alignment task, not a full translation system.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Fixed-vector bottleneck.",
        body:
          "A conventional encoder-decoder asks one vector to preserve every source detail required for every future output. Performance degrades as relevant information must survive more compression and recurrent steps.",
      },
      {
        label: "Alignment score.",
        body:
          "For each output step, a small neural network scores compatibility between the decoder state and every encoder state. These content-dependent scores are normalized across source positions.",
      },
      {
        label: "Dynamic context.",
        body:
          "The context vector is a weighted sum of encoder states. The decoder can emphasize a date's year while emitting the year and shift mass toward the month or day at later steps.",
      },
      {
        label: "Differentiable search.",
        body:
          "Because all positions receive continuous weights, the complete alignment path remains differentiable. The model learns where to look from the translation objective rather than from separately labeled word alignments.",
      },
    ],
    claims: {
      paper: "Learned soft alignment reduces the fixed-length representation bottleneck in neural translation.",
      lab: "A real additive scorer is optimized to align output roles with supplied encoder states and produces a learned heatmap.",
      limit: "Supervised alignment roles replace the paper's end-to-end translation objective in this small experiment.",
    },
    diagram: {
      title: "Step-specific context",
      caption: "Every decoder step produces a new distribution over the same encoder states.",
      nodes: [
        { label: "Encoder", value: "h_1 … h_n" },
        { label: "Compatibility", value: "vᵀ tanh(Ws + Uh_i)" },
        { label: "Alignment", value: "softmax(e_i)" },
        { label: "Context", value: "Σ α_i h_i" },
      ],
    },
    questions: {
      intro: "Ask about the fixed-vector bottleneck, alignment normalization, differentiability, or how this attention differs from Transformer self-attention.",
      suggestions: [
        "Why is the context vector dynamic?",
        "Is an attention heatmap an explanation?",
        "How is this different from self-attention?",
      ],
    },
    dataset: {
      name: "Date Alignment",
      source: "Deterministic synthetic task",
      license: "CC0",
      size: "3 semantic roles · 180 training cases",
      preview: "14 · March · 2026  →  2026 · 03 · 14",
    },
    implementation: {
      filename: "additive-attention.js",
      intro: "Implement the scoring, normalization, and weighted context operations that turn encoder states into a step-specific representation.",
      codeBlocks: [
        {
          id: "additive-score",
          label: "Compatibility score",
          purpose: "Score one decoder query against one encoder state.",
          concepts: [
            { name: "Wq", detail: "Projects the decoder query into attention space." },
            { name: "Wk", detail: "Projects one encoder state into the same space." },
            { name: "v", detail: "Collapses the nonlinear hidden vector to one scalar score." },
          ],
          code: `function additiveScore(query, key, { Wq, Wk, v, bias }) {
  return v.reduce((score, outputWeight, row) => {
    const queryTerm = Wq[row].reduce(
      (sum, weight, column) => sum + weight * query[column],
      0,
    );
    const keyTerm = Wk[row].reduce(
      (sum, weight, column) => sum + weight * key[column],
      0,
    );
    return score + outputWeight * Math.tanh(queryTerm + keyTerm + bias[row]);
  }, 0);
}`,
          checkCode: `const score = additiveScore([1, 0], [0, 1], {
  Wq: [[1, 0], [0, 1]], Wk: [[1, 0], [0, 1]], v: [0.5, -0.5], bias: [0, 0]
});
return { passed: Number.isFinite(score), detail: "e = " + score.toFixed(4) };`,
        },
        {
          id: "attention-softmax",
          label: "Alignment weights",
          purpose: "Normalize compatibility scores across source positions.",
          concepts: [
            { name: "scores", detail: "One scalar compatibility value per encoder state." },
            { name: "maxScore", detail: "Stability offset before exponentiation." },
            { name: "total", detail: "Ensures the alignment weights sum to one." },
          ],
          code: `function attentionWeights(scores) {
  const maxScore = Math.max(...scores);
  const weights = scores.map((score) => Math.exp(score - maxScore));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}`,
          checkCode: `const weights = attentionWeights([2, 1, 0]);
const total = weights.reduce((sum, value) => sum + value, 0);
return { passed: weights[0] > weights[1] && Math.abs(total - 1) < 1e-9, detail: weights.map(v => v.toFixed(3)).join(", ") };`,
        },
        {
          id: "context-vector",
          label: "Weighted context",
          purpose: "Combine encoder states using the learned alignment distribution.",
          concepts: [
            { name: "states", detail: "Encoder representation at every source position." },
            { name: "weights", detail: "Normalized alignment mass for the current output step." },
            { name: "dimension", detail: "Width of the resulting context vector." },
          ],
          code: `function contextVector(states, weights) {
  const dimension = states[0].length;
  return Array.from({ length: dimension }, (_, column) =>
    states.reduce(
      (sum, state, index) => sum + weights[index] * state[column],
      0,
    ),
  );
}`,
          checkCode: `const context = contextVector([[1, 0], [0, 1]], [0.75, 0.25]);
return { passed: context[0] === 0.75 && context[1] === 0.25, detail: "c = [" + context.join(", ") + "]" };`,
        },
      ],
    },
    experiment: {
      kind: "attention",
      title: "Learn the alignment function",
      intro: "Optimize the additive scorer, then compare its learned alignment against a fixed uniform context.",
    },
  },
  {
    id: "transformers",
    number: 5,
    mode: "core-mechanism",
    modeLabel: "Core algorithm",
    eyebrow: "Architecture · Vaswani et al. · 2017",
    title: "Transformers",
    thesis:
      "Self-attention constructs token representations through direct, content-dependent interactions while masking future positions in a causal language model.",
    paperUrl: "https://papers.nips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html",
    paperTitle: "Attention Is All You Need",
    authors: "Ashish Vaswani et al.",
    year: "2017",
    paperContext: `
This lesson concerns "Attention Is All You Need" by Vaswani and colleagues.
- The paper replaces recurrent and convolutional sequence processing with stacked attention and feed-forward layers.
- Scaled dot-product attention compares queries with keys, normalizes the scores, and mixes value vectors.
- Multi-head attention learns several projections so different interactions can be represented in parallel.
- Positional information is added because attention alone does not encode token order.
- Residual connections, normalization, masking, and position-wise feed-forward networks are essential parts of the architecture.
- The original paper is an encoder-decoder translation system; the browser lab adapts its attention operation to a decoder-only causal setting.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Direct interaction.",
        body:
          "A token can aggregate information from any permitted position in one attention operation. This shortens the path between distant positions relative to repeatedly passing information through recurrent state transitions.",
      },
      {
        label: "Query, key, value.",
        body:
          "Each token representation is projected into a query used to request information, a key used for compatibility, and a value containing information to mix. Dot products become attention logits after scaling by the key dimension.",
      },
      {
        label: "Causal mask.",
        body:
          "A decoder-only language model sets future-position scores to negative infinity before softmax. Every prediction can depend only on the prefix, preserving the autoregressive next-token objective.",
      },
      {
        label: "Complete block.",
        body:
          "Attention is surrounded by learned projections, residual paths, normalization, and a position-wise MLP. The paper's contribution is an effective full architecture, not the claim that a bare attention matrix is itself a language model.",
      },
    ],
    claims: {
      paper: "An architecture built around attention can outperform recurrent translation systems while training more efficiently in parallel.",
      lab: "The exact causal masking and scaled dot-product mixing operations run over supplied token representations.",
      limit: "This lesson executes an untrained attention block; it does not reproduce WMT training or claim that random attention weights are linguistic explanations.",
    },
    diagram: {
      title: "Causal Transformer block",
      caption: "The browser lab uses the decoder-side causal form that underlies autoregressive LLMs.",
      nodes: [
        { label: "Representation", value: "token + position" },
        { label: "Projection", value: "Q · K · V" },
        { label: "Masked attention", value: "softmax(QKᵀ / √d)" },
        { label: "Block output", value: "residual + norm + MLP" },
      ],
    },
    questions: {
      intro: "Ask about tensor shapes, masks, heads, positional information, residual paths, or the adaptation from the paper's translation model to a causal LLM.",
      suggestions: [
        "Why divide by the square root of d?",
        "What exactly does the causal mask prevent?",
        "Why are residual paths necessary?",
      ],
    },
    dataset: {
      name: "Causal Sequence Set",
      source: "Original synthetic course examples",
      license: "CC0",
      size: "3 fixed token sequences",
      preview: "the · receiver · decoded · the · quiet · signal",
    },
    implementation: {
      filename: "causal-transformer.js",
      intro: "Implement the exact operations that determine which token positions can exchange information inside a causal attention block.",
      codeBlocks: [
        {
          id: "causal-mask",
          label: "Causal mask",
          purpose: "Remove access to future positions before normalization.",
          concepts: [
            { name: "row", detail: "Query position currently producing a representation." },
            { name: "column", detail: "Key position the query might attend to." },
            { name: "-Infinity", detail: "Becomes exactly zero probability after softmax." },
          ],
          code: `function causalMask(scores) {
  return scores.map((row, rowIndex) =>
    row.map((score, columnIndex) =>
      columnIndex > rowIndex ? -Infinity : score,
    ),
  );
}`,
          checkCode: `const masked = causalMask([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
return { passed: masked[0][0] === 1 && masked[0][1] === -Infinity && masked[1][2] === -Infinity && masked[2][2] === 9, detail: "future logits removed" };`,
        },
        {
          id: "scaled-attention",
          label: "Scaled dot-product attention",
          purpose: "Turn query-key compatibility into a weighted value mixture.",
          concepts: [
            { name: "scale", detail: "Square root of the key dimension." },
            { name: "scores", detail: "Dot products between one query and each key." },
            { name: "probabilities", detail: "Normalized weights applied to value vectors." },
          ],
          code: `function scaledDotProductAttention(query, keys, values) {
  const scale = Math.sqrt(query.length);
  const scores = keys.map((key) =>
    key.reduce((sum, value, index) => sum + value * query[index], 0) / scale,
  );
  const maxScore = Math.max(...scores);
  const weights = scores.map((score) => Math.exp(score - maxScore));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const probabilities = weights.map((weight) => weight / total);
  return values[0].map((_, column) =>
    values.reduce(
      (sum, value, index) => sum + probabilities[index] * value[column],
      0,
    ),
  );
}`,
          checkCode: `const output = scaledDotProductAttention([1, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]]);
return { passed: output.length === 2 && output[0] > output[1], detail: "output = [" + output.map(v => v.toFixed(3)).join(", ") + "]" };`,
        },
        {
          id: "layer-norm",
          label: "Layer normalization",
          purpose: "Normalize features within one token representation.",
          concepts: [
            { name: "mean", detail: "Average activation across the feature dimension." },
            { name: "variance", detail: "Average squared deviation from that mean." },
            { name: "epsilon", detail: "Stability constant inside the square root." },
          ],
          code: `function layerNorm(vector, epsilon = 1e-5) {
  const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
  const variance = vector.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / vector.length;
  return vector.map((value) => (value - mean) / Math.sqrt(variance + epsilon));
}`,
          checkCode: `const normalized = layerNorm([1, 2, 3, 4]);
const mean = normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
return { passed: Math.abs(mean) < 1e-9 && normalized.every(Number.isFinite), detail: "mean = " + mean.toFixed(9) };`,
        },
      ],
    },
    experiment: {
      kind: "transformer",
      title: "Run causal self-attention",
      intro: "Execute a real masked attention forward pass and inspect the complete position-by-position probability matrix.",
    },
  },
  {
    id: "in-context-learning",
    number: 6,
    mode: "local-inference",
    modeLabel: "Real local inference",
    eyebrow: "Prompting · Brown et al. · 2020",
    title: "In-Context Learning",
    thesis:
      "A frozen autoregressive model can condition its behavior on task demonstrations placed in the prompt without updating its parameters.",
    paperUrl: "https://arxiv.org/abs/2005.14165",
    paperTitle: "Language Models are Few-Shot Learners",
    authors: "Tom B. Brown et al.",
    year: "2020",
    paperContext: `
This lesson concerns "Language Models are Few-Shot Learners" by Brown and colleagues.
- GPT-3 is an autoregressive language model evaluated on tasks specified through natural-language prompts.
- Zero-shot evaluation provides an instruction, one-shot adds one demonstration, and few-shot supplies several demonstrations in context.
- The model parameters remain frozen during these evaluations; the task is represented in the token sequence.
- Performance generally improves with scale and with useful demonstrations, but results vary substantially by task and prompt format.
- The paper discusses contamination, bias, compute, and tasks on which few-shot performance remains weak.
- The browser lab uses a 135M-parameter local instruct model, so it tests the interface and sensitivity rather than reproducing GPT-3's results.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Frozen parameters.",
        body:
          "In-context learning does not perform gradient descent on the examples in the prompt. The model processes instruction, demonstrations, and query as one sequence and predicts the continuation under its existing parameters.",
      },
      {
        label: "Demonstrations as specification.",
        body:
          "Examples can establish an output schema, label mapping, style, or latent task that the instruction leaves ambiguous. Their ordering and formatting alter the prefix and can therefore alter the resulting distribution.",
      },
      {
        label: "Evaluation design.",
        body:
          "A persuasive few-shot result requires a fixed dataset, a defined metric, and identical test items across prompting conditions. Selecting prompts after seeing test performance can turn prompt engineering into unreported test-set optimization.",
      },
      {
        label: "Scale dependence.",
        body:
          "The paper's strongest results come from a model vastly larger than the one a browser can run. This lab therefore asks a narrower question: can demonstrations change the behavior of a real frozen local Transformer on a controlled task?",
      },
    ],
    claims: {
      paper: "Scaling autoregressive language models substantially improves task performance specified through zero-, one-, and few-shot prompts.",
      lab: "A real quantized 135M model runs locally on the same fixed classification cases under three prompt conditions.",
      limit: "The local model is not GPT-3, and a two-case browser evaluation cannot reproduce the paper's benchmark claims.",
    },
    diagram: {
      title: "Task specification in the prefix",
      caption: "The weights are unchanged; only the token sequence supplied before the query differs.",
      nodes: [
        { label: "Instruction", value: "output one label" },
        { label: "Demonstrations", value: "0 · 1 · 4 examples" },
        { label: "Frozen model", value: "no gradient update" },
        { label: "Measurement", value: "exact-match accuracy" },
      ],
    },
    questions: {
      intro: "Ask about frozen weights, demonstration selection, prompt sensitivity, contamination, or what can and cannot be inferred from the local experiment.",
      suggestions: [
        "Is in-context learning the same as fine-tuning?",
        "Why can example order change accuracy?",
        "How should few-shot prompts be evaluated?",
      ],
    },
    dataset: {
      name: "Opaque Review Labels",
      source: "Original fixed evaluation set",
      license: "CC0",
      size: "4 demonstrations · 2 held-out cases",
      preview: "positive → K · negative → M · held-out reviews use the same concealed mapping",
    },
    implementation: {
      filename: "few-shot-evaluation.js",
      intro: "Implement deterministic prompt construction and scoring before running the same test cases through a real local model.",
      codeBlocks: [
        {
          id: "format-demonstrations",
          label: "Demonstration formatter",
          purpose: "Serialize labeled examples without changing their order.",
          concepts: [
            { name: "examples", detail: "Fixed input-label records selected before evaluation." },
            { name: "map", detail: "Applies one stable textual schema to every record." },
            { name: "join", detail: "Separates demonstrations with an unambiguous blank line." },
          ],
          code: `function formatDemonstrations(examples) {
  return examples
    .map(({ input, label }) => "Input: " + input + "\\nLabel: " + label)
    .join("\\n\\n");
}`,
          checkCode: `const text = formatDemonstrations([{ input: "aa", label: "K" }, { input: "bbb", label: "M" }]);
return { passed: text.includes("Input: aa\\nLabel: K") && text.indexOf("aa") < text.indexOf("bbb"), detail: "order preserved" };`,
        },
        {
          id: "build-prompt",
          label: "Evaluation prompt",
          purpose: "Combine the fixed instruction, selected demonstrations, and held-out query.",
          concepts: [
            { name: "instruction", detail: "Task text held constant across conditions." },
            { name: "demonstrations", detail: "Only experimental variable: zero, one, or several examples." },
            { name: "query", detail: "Held-out input scored under every condition." },
          ],
          code: `function buildPrompt({ instruction, demonstrations, query }) {
  const sections = [instruction.trim()];
  if (demonstrations.trim()) sections.push(demonstrations.trim());
  sections.push("Input: " + query.trim() + "\\nLabel:");
  return sections.join("\\n\\n");
}`,
          checkCode: `const prompt = buildPrompt({ instruction: "Return K or M.", demonstrations: "", query: "A sharp story." });
return { passed: prompt === "Return K or M.\\n\\nInput: A sharp story.\\nLabel:", detail: "zero-shot prompt is deterministic" };`,
        },
        {
          id: "exact-match",
          label: "Exact-match scoring",
          purpose: "Extract one allowed label and score it without subjective grading.",
          concepts: [
            { name: "allowedLabels", detail: "Closed set defined before model execution." },
            { name: "match", detail: "First standalone permitted label in the generation." },
            { name: "expected", detail: "Gold label hidden from the prompt." },
          ],
          code: `function exactMatchLabel(output, expected, allowedLabels = ["K", "M"]) {
  const escaped = allowedLabels.join("|");
  const match = output.toUpperCase().match(new RegExp("\\\\b(" + escaped + ")\\\\b"));
  const predicted = match ? match[1] : null;
  return { predicted, passed: predicted === expected };
}`,
          checkCode: `const result = exactMatchLabel("The label is K.", "K");
return { passed: result.passed && result.predicted === "K", detail: "predicted " + result.predicted };`,
        },
      ],
    },
    experiment: {
      kind: "icl",
      title: "Evaluate a frozen local model",
      intro: "Download the quantized model once, then compare zero-, one-, and few-shot exact-match accuracy on identical held-out cases.",
    },
  },
];

const sourceLessons: CourseLesson[] = [
  ...modelLessons.map((lesson, index) => ({
    ...lesson,
    sources: getLessonSources(lesson.id),
    courseId: "models" as const,
    courseTitle: "Model Foundations",
    courseNumber: 1,
    lessonNumber: index + 1,
  })),
  ...systemsLessons,
  ...productLessons,
];

export const llmSystemsCurriculum = deriveCurriculum(llmSystemsManifest, sourceLessons);

/** Canonical lesson order now follows the program manifest rather than file declaration order. */
export const courseLessons: CourseLesson[] = llmSystemsCurriculum.lessons.map(
  ({ lesson }) => lesson,
);

const compatibleTrackIds: readonly CourseTrack["id"][] = [
  "models",
  "systems",
  "backend",
  "product",
];

function toCompatibleTrackId(routeSlug: string): CourseTrack["id"] {
  const trackId = compatibleTrackIds.find((candidate) => candidate === routeSlug);
  if (!trackId) throw new Error(`Unsupported curriculum route slug: ${routeSlug}`);
  return trackId;
}

/**
 * Compatibility adapter for the current course routes. Titles and membership
 * are derived from the one-program manifest; the route layer can migrate from
 * "course" to "module" without changing saved project paths.
 */
export const courseTracks: CourseTrack[] = llmSystemsCurriculum.modules.map((module) => ({
  id: toCompatibleTrackId(module.routeSlug),
  number: module.order,
  title: module.title,
  shortTitle: module.shortTitle,
  thesis: module.thesis,
  outcome: module.outcome,
  lessonIds: [...module.lessonIds],
}));

export { modelLessons };

export function getLesson(slug: string) {
  return llmSystemsCurriculum.lessonById[slug]?.lesson;
}

export function getAdjacentLesson(lesson: CourseLesson, direction: -1 | 1) {
  const index = courseLessons.findIndex((candidate) => candidate.id === lesson.id);
  return courseLessons[index + direction];
}

export function getTrack(courseId: string) {
  return courseTracks.find((track) => track.id === courseId);
}

export function getTrackLessons(courseId: string) {
  return llmSystemsCurriculum.moduleByRouteSlug[courseId]?.lessons.map(({ lesson }) => lesson) ?? [];
}
