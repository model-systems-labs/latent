import { integerInRange } from "./shared.js";

export const BPE_CORPUS = [
  "signal signals signaling signaled",
  "model models modeling modeled",
  "predict predicts predicting predicted",
  "token tokens tokenized tokenization",
  "learn learns learning learned",
  "align aligns aligned alignment",
];

export type BpeResult = {
  merges: Array<{ pair: [string, string]; count: number }>;
  encoded: string[];
  initialTokenCount: number;
  finalTokenCount: number;
  vocabularySize: number;
};

function applyMerge(symbols: string[], pair: [string, string]) {
  const output: string[] = [];
  for (let index = 0; index < symbols.length; index += 1) {
    if (symbols[index] === pair[0] && symbols[index + 1] === pair[1]) {
      output.push(pair[0] + pair[1]);
      index += 1;
    } else output.push(symbols[index]);
  }
  return output;
}

export function trainBpe(mergeBudget = 12): BpeResult {
  integerInRange(mergeBudget, "mergeBudget", 0, 10_000);
  let words = BPE_CORPUS.flatMap((line) => line.split(" ")).map((word) => [...word]);
  const vocabulary = new Set(words.flat());
  const initialTokenCount = words.reduce((sum, word) => sum + word.length, 0);
  const merges: Array<{ pair: [string, string]; count: number }> = [];
  for (let step = 0; step < mergeBudget; step += 1) {
    const counts = new Map<string, number>();
    for (const word of words) {
      for (let index = 0; index < word.length - 1; index += 1) {
        const key = word[index] + "\u0000" + word[index + 1];
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!best || best[1] < 2) break;
    const pair = best[0].split("\u0000") as [string, string];
    merges.push({ pair, count: best[1] });
    vocabulary.add(pair[0] + pair[1]);
    words = words.map((word) => applyMerge(word, pair));
  }

  const encoded = "modeling signals".split(" ").flatMap((word, wordIndex) => {
    let symbols = [...word];
    for (const merge of merges) symbols = applyMerge(symbols, merge.pair);
    return wordIndex === 0 ? symbols : ["▁", ...symbols];
  });
  return {
    merges,
    encoded,
    initialTokenCount,
    finalTokenCount: words.reduce((sum, word) => sum + word.length, 0),
    vocabularySize: vocabulary.size,
  };
}
