import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const subwordTokenizationLesson = {
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
  } satisfies Omit<CourseLesson, "sources">;
