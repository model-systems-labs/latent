import { seededRandom, softmax } from "./shared.js";

export type TransformerResult = {
  tokens: string[];
  attention: number[][];
  contextNorms: number[];
};

function tokenVector(token: string, position: number, dimension: number) {
  let hash = 2166136261;
  for (const character of token) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const random = seededRandom(hash >>> 0);
  return Array.from({ length: dimension }, (_, index) => {
    const frequency = Math.pow(10000, -(2 * Math.floor(index / 2)) / dimension);
    const positionValue = index % 2 === 0 ? Math.sin(position * frequency) : Math.cos(position * frequency);
    return (random() * 2 - 1) * 0.45 + positionValue * 0.55;
  });
}

export function runCausalAttention(): TransformerResult {
  const tokens = ["the", "receiver", "decoded", "the", "quiet", "signal"];
  const dimension = 8;
  const representations = tokens.map((token, position) => tokenVector(token, position, dimension));
  const attention = representations.map((query, row) => {
    const scores = representations.map((key, column) => {
      if (column > row) return -Infinity;
      return query.reduce((sum, value, index) => sum + value * key[index], 0) / Math.sqrt(dimension);
    });
    return softmax(scores);
  });
  const contextNorms = attention.map((weights) => {
    const context = Array.from({ length: dimension }, (_, column) =>
      representations.reduce((sum, value, index) => sum + weights[index] * value[column], 0),
    );
    return Math.sqrt(context.reduce((sum, value) => sum + value * value, 0));
  });
  return { tokens, attention, contextNorms };
}
