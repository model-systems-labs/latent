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
- The paper trains from word-frequency data with explicit word boundaries. This teaching lab counts literal repeated word occurrences and omits boundary markers so the merge loop stays visible.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Representation boundary.",
        body:
          "A word vocabulary maps every unseen word to one unknown id. A character vocabulary can spell any word made from its known base symbols, but turns common words into long sequences. Subword tokenization chooses intermediate units so the language model predicts reusable fragments rather than whole words or isolated characters.",
      },
      {
        label: "Training state.",
        body:
          "BPE starts each training word as a symbol array: lower becomes [l, o, w, e, r]. It counts every adjacent pair, selects the most frequent pair, replaces every non-overlapping occurrence, then counts again. Counts must be recomputed because one merge creates new candidate pairs.",
      },
      {
        label: "Pair identity.",
        body:
          "A pair is two symbols, not their concatenated spelling. The pairs [a, bc] and [ab, c] would both become abc if their keys were built with simple string concatenation. The implementation uses JSON array keys such as [\"l\",\"o\"] so those candidates remain distinct and visible while debugging.",
      },
      {
        label: "Ordered replay.",
        body:
          "The learned artifact is an ordered merge list. To encode new text, start from the same base symbols and attempt each learned merge exactly once in training order. For abc, applying [a,b] before [ab,c] produces [abc]; reversing the order leaves [ab,c].",
      },
      {
        label: "System tradeoff.",
        body:
          "A larger merge budget usually shortens encoded sequences but expands the model's embedding and output matrices. Tokenizer design therefore changes context usage, parameter count, serving cost, and the exact token ids a trained model expects; it is part of the model contract, not neutral preprocessing.",
      },
    ],
    claims: {
      paper: "Subword representations improve open-vocabulary neural translation, particularly for rare words.",
      lab: "The complete BPE training and encoding algorithm runs on a fixed corpus and exposes every learned merge.",
      limit: "The toy trainer omits word-boundary markers, and its compression statistics are not translation-quality measurements.",
    },
    diagram: {
      title: "Two BPE training rounds",
      caption: "Counts are recomputed after every corpus-wide merge. The resulting list is replayed once, in order, when a new word is encoded.",
      nodes: [
        { label: "Training words", value: "l · o · w   |   l · o · w   |   l · o" },
        { label: "Round 1 counts", value: "[l,o]: 3   [o,w]: 2   → select [l,o]" },
        { label: "Merge 1", value: "[l,o] → lo   then recount the modified words" },
        { label: "Round 2 counts", value: "[lo,w]: 2   → next candidate" },
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
      size: "6 lines · 24 words · fixed",
      preview: "signal signals signaling signaled · model models modeling modeled",
    },
    implementation: {
      filename: "bpe-tokenizer.js",
      intro: "Build the tokenizer in three isolated cells. Pair counts use a visible delimiter-safe key: JSON.stringify([\"l\", \"o\"]) returns the string [\"l\",\"o\"]. The merge and encoder cells receive pairs as two-item arrays.",
      codeBlocks: [
        {
          id: "pair-counts",
          label: "Adjacent pair counts",
          purpose: "Count candidate merges across the tokenized vocabulary.",
          concepts: [
            { name: "words", detail: "Array of words, each represented as an array of symbols." },
            { name: "JSON.stringify([left, right])", detail: "Encodes the two-symbol array as a visible key such as [\"l\",\"o\"]." },
            { name: "counts", detail: "Frequency table used to choose the next merge." },
          ],
          code: `function countPairs(words) {
  const counts = {};
  for (const symbols of words) {
    for (let index = 0; index < symbols.length - 1; index += 1) {
      const pair = JSON.stringify([symbols[index], symbols[index + 1]]);
      counts[pair] = (counts[pair] ?? 0) + 1;
    }
  }
  return counts;
}`,
          checkCode: `const counts = countPairs([["l", "o", "w"], ["l", "o"]]);
return { passed: counts['["l","o"]'] === 2 && counts['["o","w"]'] === 1, detail: "[l,o] = " + counts['["l","o"]'] };`,
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
      intro: "Run the supplied reference BPE trainer with a chosen merge budget, then inspect its merge list, learned vocabulary, and encoded length. The replay does not execute the learner cells.",
    },
  } satisfies Omit<CourseLesson, "sources">;
