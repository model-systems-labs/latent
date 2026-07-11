const RNN_CORPUS = (
  "the receiver counted one quiet pulse. " +
  "the signal crossed the empty sky. " +
  "a patient machine recorded every interval. " +
  "the pattern returned before the morning. " +
  "the receiver counted two quiet pulses. " +
  "the signal crossed the silent sky. "
).repeat(7);

const LANGUAGE_SENTENCES = [
  "the analyst reads the report",
  "the engineer reads the message",
  "the researcher reads the paper",
  "the receiver reads the signal",
  "the poet writes the verse",
  "the analyst writes the report",
  "the engineer writes the program",
  "the researcher writes the paper",
  "the model predicts the token",
  "the model predicts the sequence",
  "the system predicts the signal",
  "the system records the message",
  "a careful analyst checks the report",
  "a careful engineer checks the program",
  "a small model learns the pattern",
  "a small system learns the sequence",
  "the quiet receiver records the signal",
  "the patient researcher checks the result",
  "the language model predicts the token",
  "the language system predicts the sequence",
];

export const BPE_CORPUS = [
  "signal signals signaling signaled",
  "model models modeling modeled",
  "predict predicts predicting predicted",
  "token tokens tokenized tokenization",
  "learn learns learning learned",
  "align aligns aligned alignment",
];

function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function zeros(rows: number, columns: number) {
  return Array.from({ length: rows }, () => Array(columns).fill(0) as number[]);
}

function randomMatrix(rows: number, columns: number, random: () => number, scale = 0.08) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => (random() * 2 - 1) * scale),
  );
}

function softmax(logits: number[]) {
  const maximum = Math.max(...logits);
  const weights = logits.map((value) => Math.exp(value - maximum));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

function sampleIndex(probabilities: number[], random: () => number) {
  let threshold = random();
  for (let index = 0; index < probabilities.length; index += 1) {
    threshold -= probabilities[index];
    if (threshold <= 0) return index;
  }
  return probabilities.length - 1;
}

export type RnnResult = {
  losses: number[];
  initialLoss: number;
  finalLoss: number;
  sample: string;
  vocabularySize: number;
  parameters: number;
};

export function trainCharacterRnn(steps = 600): RnnResult {
  const corpus = RNN_CORPUS;
  const vocabulary = [...new Set(corpus)].sort();
  const toIndex = new Map(vocabulary.map((character, index) => [character, index]));
  const vocabularySize = vocabulary.length;
  const hiddenSize = 18;
  const sequenceLength = 28;
  const random = seededRandom(19);

  const Wxh = randomMatrix(hiddenSize, vocabularySize, random);
  const Whh = randomMatrix(hiddenSize, hiddenSize, random, 0.05);
  const Why = randomMatrix(vocabularySize, hiddenSize, random);
  const bh = Array(hiddenSize).fill(0) as number[];
  const by = Array(vocabularySize).fill(0) as number[];

  const mWxh = zeros(hiddenSize, vocabularySize);
  const mWhh = zeros(hiddenSize, hiddenSize);
  const mWhy = zeros(vocabularySize, hiddenSize);
  const mbh = Array(hiddenSize).fill(0) as number[];
  const mby = Array(vocabularySize).fill(0) as number[];
  const losses: number[] = [];
  let position = 0;
  let previousState = Array(hiddenSize).fill(0) as number[];

  const updateMatrix = (values: number[][], gradients: number[][], memory: number[][], rate: number) => {
    for (let row = 0; row < values.length; row += 1) {
      for (let column = 0; column < values[row].length; column += 1) {
        const gradient = Math.max(-5, Math.min(5, gradients[row][column]));
        memory[row][column] += gradient * gradient;
        values[row][column] -= rate * gradient / Math.sqrt(memory[row][column] + 1e-8);
      }
    }
  };

  for (let step = 0; step < steps; step += 1) {
    if (position + sequenceLength + 1 >= corpus.length) {
      position = 0;
      previousState = Array(hiddenSize).fill(0) as number[];
    }

    const inputs = [...corpus.slice(position, position + sequenceLength)].map((character) => toIndex.get(character) ?? 0);
    const targets = [...corpus.slice(position + 1, position + sequenceLength + 1)].map((character) => toIndex.get(character) ?? 0);
    const states: number[][] = [previousState.slice()];
    const probabilities: number[][] = [];
    let loss = 0;

    for (let time = 0; time < sequenceLength; time += 1) {
      const nextState = Array.from({ length: hiddenSize }, (_, row) => {
        let activation = bh[row] + Wxh[row][inputs[time]];
        for (let column = 0; column < hiddenSize; column += 1) {
          activation += Whh[row][column] * states[time][column];
        }
        return Math.tanh(activation);
      });
      states.push(nextState);
      const logits = Array.from({ length: vocabularySize }, (_, row) => {
        let value = by[row];
        for (let column = 0; column < hiddenSize; column += 1) value += Why[row][column] * nextState[column];
        return value;
      });
      const distribution = softmax(logits);
      probabilities.push(distribution);
      loss += -Math.log(Math.max(distribution[targets[time]], 1e-12));
    }

    const dWxh = zeros(hiddenSize, vocabularySize);
    const dWhh = zeros(hiddenSize, hiddenSize);
    const dWhy = zeros(vocabularySize, hiddenSize);
    const dbh = Array(hiddenSize).fill(0) as number[];
    const dby = Array(vocabularySize).fill(0) as number[];
    let nextStateGradient = Array(hiddenSize).fill(0) as number[];

    for (let time = sequenceLength - 1; time >= 0; time -= 1) {
      const outputGradient = probabilities[time].slice();
      outputGradient[targets[time]] -= 1;
      for (let row = 0; row < vocabularySize; row += 1) {
        dby[row] += outputGradient[row];
        for (let column = 0; column < hiddenSize; column += 1) {
          dWhy[row][column] += outputGradient[row] * states[time + 1][column];
        }
      }

      const hiddenGradient = Array(hiddenSize).fill(0) as number[];
      for (let column = 0; column < hiddenSize; column += 1) {
        hiddenGradient[column] = nextStateGradient[column];
        for (let row = 0; row < vocabularySize; row += 1) {
          hiddenGradient[column] += Why[row][column] * outputGradient[row];
        }
      }
      const rawGradient = hiddenGradient.map(
        (value, column) => value * (1 - states[time + 1][column] ** 2),
      );
      for (let row = 0; row < hiddenSize; row += 1) {
        dbh[row] += rawGradient[row];
        dWxh[row][inputs[time]] += rawGradient[row];
        for (let column = 0; column < hiddenSize; column += 1) {
          dWhh[row][column] += rawGradient[row] * states[time][column];
        }
      }
      nextStateGradient = Array.from({ length: hiddenSize }, (_, column) => {
        let value = 0;
        for (let row = 0; row < hiddenSize; row += 1) value += Whh[row][column] * rawGradient[row];
        return value;
      });
    }

    const rate = 0.075;
    updateMatrix(Wxh, dWxh, mWxh, rate);
    updateMatrix(Whh, dWhh, mWhh, rate);
    updateMatrix(Why, dWhy, mWhy, rate);
    for (let index = 0; index < hiddenSize; index += 1) {
      const gradient = Math.max(-5, Math.min(5, dbh[index]));
      mbh[index] += gradient * gradient;
      bh[index] -= rate * gradient / Math.sqrt(mbh[index] + 1e-8);
    }
    for (let index = 0; index < vocabularySize; index += 1) {
      const gradient = Math.max(-5, Math.min(5, dby[index]));
      mby[index] += gradient * gradient;
      by[index] -= rate * gradient / Math.sqrt(mby[index] + 1e-8);
    }
    previousState = states.at(-1)?.slice() ?? previousState;
    position += sequenceLength;
    losses.push(loss / sequenceLength);
  }

  let state = Array(hiddenSize).fill(0) as number[];
  let characterIndex = toIndex.get("t") ?? 0;
  let sample = vocabulary[characterIndex];
  const sampleRandom = seededRandom(71);
  for (let step = 0; step < 180; step += 1) {
    state = Array.from({ length: hiddenSize }, (_, row) => {
      let activation = bh[row] + Wxh[row][characterIndex];
      for (let column = 0; column < hiddenSize; column += 1) activation += Whh[row][column] * state[column];
      return Math.tanh(activation);
    });
    const logits = Array.from({ length: vocabularySize }, (_, row) => {
      let value = by[row];
      for (let column = 0; column < hiddenSize; column += 1) value += Why[row][column] * state[column];
      return value / 0.78;
    });
    characterIndex = sampleIndex(softmax(logits), sampleRandom);
    sample += vocabulary[characterIndex];
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    losses,
    initialLoss: mean(losses.slice(0, 12)),
    finalLoss: mean(losses.slice(-12)),
    sample,
    vocabularySize,
    parameters: hiddenSize * vocabularySize + hiddenSize * hiddenSize + vocabularySize * hiddenSize + hiddenSize + vocabularySize,
  };
}

export type NeuralLmResult = {
  losses: number[];
  initialValidationLoss: number;
  finalValidationLoss: number;
  predictions: Array<{ word: string; probability: number }>;
  neighbors: Array<{ word: string; similarity: number }>;
  vocabularySize: number;
  parameters: number;
};

export function trainNeuralLanguageModel(steps = 4000): NeuralLmResult {
  const tokenized = LANGUAGE_SENTENCES.map((sentence) => sentence.split(" "));
  const vocabulary = [...new Set(tokenized.flat())].sort();
  const toIndex = new Map(vocabulary.map((word, index) => [word, index]));
  const examples = tokenized.flatMap((sentence) =>
    sentence.slice(2).map((target, index) => ({
      context: [toIndex.get(sentence[index]) ?? 0, toIndex.get(sentence[index + 1]) ?? 0],
      target: toIndex.get(target) ?? 0,
    })),
  );
  const training = examples.filter((_, index) => index % 6 !== 0);
  const validation = examples.filter((_, index) => index % 6 === 0);
  const dimension = 8;
  const random = seededRandom(37);
  const embeddings = randomMatrix(vocabulary.length, dimension, random, 0.12);
  const output = randomMatrix(vocabulary.length, dimension, random, 0.08);
  const bias = Array(vocabulary.length).fill(0) as number[];

  const contextVector = (context: number[]) =>
    Array.from({ length: dimension }, (_, column) =>
      context.reduce((sum, index) => sum + embeddings[index][column], 0) / context.length,
    );
  const distributionFor = (context: number[]) => {
    const vector = contextVector(context);
    const logits = output.map((row, index) =>
      row.reduce((sum, weight, column) => sum + weight * vector[column], bias[index]),
    );
    return { vector, probabilities: softmax(logits) };
  };
  const validationLoss = () => validation.reduce((sum, example) => {
    const { probabilities } = distributionFor(example.context);
    return sum - Math.log(Math.max(probabilities[example.target], 1e-12));
  }, 0) / validation.length;

  const initialValidationLoss = validationLoss();
  const losses: number[] = [];
  for (let step = 0; step < steps; step += 1) {
    const example = training[step % training.length];
    const { vector, probabilities } = distributionFor(example.context);
    const outputGradient = probabilities.slice();
    outputGradient[example.target] -= 1;
    const hiddenGradient = Array(dimension).fill(0) as number[];
    for (let row = 0; row < vocabulary.length; row += 1) {
      for (let column = 0; column < dimension; column += 1) {
        hiddenGradient[column] += output[row][column] * outputGradient[row];
      }
    }
    const rate = 0.055;
    for (let row = 0; row < vocabulary.length; row += 1) {
      for (let column = 0; column < dimension; column += 1) {
        output[row][column] -= rate * outputGradient[row] * vector[column];
      }
      bias[row] -= rate * outputGradient[row];
    }
    for (const index of example.context) {
      for (let column = 0; column < dimension; column += 1) {
        embeddings[index][column] -= rate * hiddenGradient[column] / example.context.length;
      }
    }
    if (step % 40 === 0) losses.push(validationLoss());
  }

  const context = [toIndex.get("the") ?? 0, toIndex.get("model") ?? 0];
  const { probabilities } = distributionFor(context);
  const predictions = probabilities
    .map((probability, index) => ({ word: vocabulary[index], probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const modelIndex = toIndex.get("model") ?? 0;
  const cosine = (a: number[], b: number[]) => {
    const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
    const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
    return dot / Math.max(normA * normB, 1e-12);
  };
  const neighbors = embeddings
    .map((embedding, index) => ({ word: vocabulary[index], similarity: cosine(embeddings[modelIndex], embedding) }))
    .filter((item) => item.word !== "model")
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);

  return {
    losses,
    initialValidationLoss,
    finalValidationLoss: validationLoss(),
    predictions,
    neighbors,
    vocabularySize: vocabulary.length,
    parameters: vocabulary.length * dimension * 2 + vocabulary.length,
  };
}

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
  let words = BPE_CORPUS.flatMap((line) => line.split(" ")).map((word) => [...word]);
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
    words = words.map((word) => applyMerge(word, pair));
  }

  const encoded = "modeling signals".split(" ").flatMap((word, wordIndex) => {
    let symbols = [...word];
    for (const merge of merges) symbols = applyMerge(symbols, merge.pair);
    return wordIndex === 0 ? symbols : ["▁", ...symbols];
  });
  const vocabulary = new Set(words.flat());
  return {
    merges,
    encoded,
    initialTokenCount,
    finalTokenCount: words.reduce((sum, word) => sum + word.length, 0),
    vocabularySize: vocabulary.size,
  };
}

export type AttentionResult = {
  losses: number[];
  matrix: number[][];
  labels: string[];
  source: string[];
};

export function trainAdditiveAttention(epochs = 2000): AttentionResult {
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
