import { integerInRange, randomMatrix, seededRandom, softmax, zeros } from "./shared.js";

export type AttentionResult = {
  losses: number[];
  matrix: number[][];
  labels: string[];
  source: string[];
};

export function trainAdditiveAttention(epochs = 2000): AttentionResult {
  integerInRange(epochs, "epochs", 1, 100_000);
  const keys = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const queries = [[0, 0, 1], [0, 1, 0], [1, 0, 0]];
  const targets = [2, 1, 0];
  const hidden = 7;
  const random = seededRandom(101);
  const Wq = randomMatrix(hidden, 3, random, 0.18);
  const Wk = randomMatrix(hidden, 3, random, 0.18);
  const v = Array.from({ length: hidden }, () => (random() * 2 - 1) * 0.18);
  const bias = Array(hidden).fill(0) as number[];
  const losses: number[] = [];

  const forward = (query: number[]) => {
    const activations = keys.map((key) => Array.from({ length: hidden }, (_, row) => {
      let value = bias[row];
      for (let column = 0; column < 3; column += 1) value += Wq[row][column] * query[column] + Wk[row][column] * key[column];
      return Math.tanh(value);
    }));
    const scores = activations.map((activation) => activation.reduce((sum, value, index) => sum + value * v[index], 0));
    return { activations, probabilities: softmax(scores) };
  };

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    let epochLoss = 0;
    for (let item = 0; item < queries.length; item += 1) {
      const { activations, probabilities } = forward(queries[item]);
      epochLoss += -Math.log(Math.max(probabilities[targets[item]], 1e-12));
      const dWq = zeros(hidden, 3);
      const dWk = zeros(hidden, 3);
      const dv = Array(hidden).fill(0) as number[];
      const db = Array(hidden).fill(0) as number[];
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        const scoreGradient = probabilities[keyIndex] - (keyIndex === targets[item] ? 1 : 0);
        for (let row = 0; row < hidden; row += 1) {
          dv[row] += scoreGradient * activations[keyIndex][row];
          const raw = scoreGradient * v[row] * (1 - activations[keyIndex][row] ** 2);
          db[row] += raw;
          for (let column = 0; column < 3; column += 1) {
            dWq[row][column] += raw * queries[item][column];
            dWk[row][column] += raw * keys[keyIndex][column];
          }
        }
      }
      const rate = 0.09;
      for (let row = 0; row < hidden; row += 1) {
        v[row] -= rate * dv[row];
        bias[row] -= rate * db[row];
        for (let column = 0; column < 3; column += 1) {
          Wq[row][column] -= rate * dWq[row][column];
          Wk[row][column] -= rate * dWk[row][column];
        }
      }
    }
    if (epoch % 20 === 0) losses.push(epochLoss / queries.length);
  }

  return {
    losses,
    matrix: queries.map((query) => forward(query).probabilities),
    labels: ["year", "month", "day"],
    source: ["14", "March", "2026"],
  };
}
