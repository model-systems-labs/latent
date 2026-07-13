import { finiteInRange, integerInRange, randomMatrix, sampleIndex, seededRandom, softmax, zeros } from "./shared.js";

const RNN_CORPUS = (
  "the receiver counted one quiet pulse. " +
  "the signal crossed the empty sky. " +
  "a patient machine recorded every interval. " +
  "the pattern returned before the morning. " +
  "the receiver counted two quiet pulses. " +
  "the signal crossed the silent sky. "
).repeat(7);

export const CHARACTER_RNN_DATASET = Object.freeze({
  name: "Signal Notes",
  source: "Original synthetic course corpus",
  license: "CC0",
  split: "fixed deterministic sequence",
});

export const CHARACTER_RNN_TRAINING_CONFIG = Object.freeze({
  seed: 19,
  hiddenSize: 18,
  sequenceLength: 28,
  optimizer: "Adagrad",
  learningRate: 0.075,
  gradientClip: 5,
});

export type RnnCheckpoint = {
  version: 1;
  vocabulary: string[];
  hiddenSize: number;
  Wxh: number[][];
  Whh: number[][];
  Why: number[][];
  bh: number[];
  by: number[];
};

export type RnnResult = {
  losses: number[];
  initialLoss: number;
  finalLoss: number;
  sample: string;
  vocabularySize: number;
  parameters: number;
  checkpoint: RnnCheckpoint;
};

const validatedCheckpoints = new WeakSet<object>();

function finiteVector(value: unknown, length: number, label: string) {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new TypeError(`${label} must contain exactly ${length} finite numbers.`);
  }
  return Object.freeze([...value]) as unknown as number[];
}

function finiteMatrix(value: unknown, rows: number, columns: number, label: string) {
  if (!Array.isArray(value) || value.length !== rows) throw new TypeError(`${label} must contain exactly ${rows} rows.`);
  return Object.freeze(value.map((row, index) => finiteVector(row, columns, `${label}[${index}]`))) as unknown as number[][];
}

export function assertRnnCheckpoint(value: unknown): RnnCheckpoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("RNN checkpoint must be an object.");
  if (validatedCheckpoints.has(value)) return value as RnnCheckpoint;
  const source = value as Partial<RnnCheckpoint>;
  if (source.version !== 1) throw new TypeError("RNN checkpoint version is unsupported.");
  if (typeof source.hiddenSize !== "number") throw new TypeError("checkpoint.hiddenSize must be numeric.");
  const hiddenSize = integerInRange(source.hiddenSize, "checkpoint.hiddenSize", 1, 4096);
  if (!Array.isArray(source.vocabulary) || source.vocabulary.length === 0 || source.vocabulary.length > 4096
    || source.vocabulary.some((token) => typeof token !== "string" || !token || token.length > 32)) {
    throw new TypeError("RNN checkpoint vocabulary is invalid.");
  }
  if (new Set(source.vocabulary).size !== source.vocabulary.length) throw new TypeError("RNN checkpoint vocabulary must be unique.");
  const vocabulary = Object.freeze([...source.vocabulary]) as unknown as string[];
  const vocabularySize = vocabulary.length;
  const checkpoint = Object.freeze({
    version: 1 as const,
    vocabulary,
    hiddenSize,
    Wxh: finiteMatrix(source.Wxh, hiddenSize, vocabularySize, "checkpoint.Wxh"),
    Whh: finiteMatrix(source.Whh, hiddenSize, hiddenSize, "checkpoint.Whh"),
    Why: finiteMatrix(source.Why, vocabularySize, hiddenSize, "checkpoint.Why"),
    bh: finiteVector(source.bh, hiddenSize, "checkpoint.bh"),
    by: finiteVector(source.by, vocabularySize, "checkpoint.by"),
  });
  validatedCheckpoints.add(checkpoint);
  return checkpoint;
}

export function isRnnCheckpoint(value: unknown): value is RnnCheckpoint {
  try {
    assertRnnCheckpoint(value);
    return true;
  } catch {
    return false;
  }
}

export function sampleCharacterRnn(
  checkpoint: RnnCheckpoint,
  prompt = "t",
  length = 180,
  temperature = 0.78,
  seed = 71,
  topK = 0,
) {
  if (typeof prompt !== "string" || prompt.length > 50_000) throw new RangeError("prompt must be text under 50,000 characters.");
  integerInRange(length, "length", 0, 10_000);
  finiteInRange(temperature, "temperature", 0, 100);
  integerInRange(seed, "seed", -2_147_483_648, 4_294_967_295);
  integerInRange(topK, "topK", 0, 1_000_000);
  const validated = assertRnnCheckpoint(checkpoint);
  const { vocabulary, hiddenSize, Wxh, Whh, Why, bh, by } = validated;
  const toIndex = new Map(vocabulary.map((character, index) => [character, index]));
  let state = Array(hiddenSize).fill(0) as number[];
  let characterIndex = toIndex.get("t") ?? 0;
  const normalizedPrompt = prompt.toLowerCase();

  for (const character of normalizedPrompt) {
    characterIndex = toIndex.get(character) ?? toIndex.get(" ") ?? 0;
    state = Array.from({ length: hiddenSize }, (_, row) => {
      let activation = bh[row] + Wxh[row][characterIndex];
      for (let column = 0; column < hiddenSize; column += 1) activation += Whh[row][column] * state[column];
      return Math.tanh(activation);
    });
  }

  const random = seededRandom(seed + normalizedPrompt.length * 17);
  let sample = "";
  for (let step = 0; step < length; step += 1) {
    let logits = Array.from({ length: vocabulary.length }, (_, row) => {
      let value = by[row];
      for (let column = 0; column < hiddenSize; column += 1) value += Why[row][column] * state[column];
      return value / temperature;
    });
    if (topK > 0 && topK < logits.length) {
      const retained = new Set(logits.map((value, index) => ({ value, index })).sort((left, right) => right.value - left.value).slice(0, topK).map((item) => item.index));
      logits = logits.map((value, index) => retained.has(index) ? value : Number.NEGATIVE_INFINITY);
    }
    characterIndex = sampleIndex(softmax(logits), random);
    const character = vocabulary[characterIndex];
    sample += character;
    state = Array.from({ length: hiddenSize }, (_, row) => {
      let activation = bh[row] + Wxh[row][characterIndex];
      for (let column = 0; column < hiddenSize; column += 1) activation += Whh[row][column] * state[column];
      return Math.tanh(activation);
    });
  }
  return sample;
}

export function trainCharacterRnn(steps = 600): RnnResult {
  integerInRange(steps, "steps", 1, 100_000);
  const corpus = RNN_CORPUS;
  const vocabulary = [...new Set(corpus)].sort();
  const toIndex = new Map(vocabulary.map((character, index) => [character, index]));
  const vocabularySize = vocabulary.length;
  const { hiddenSize, sequenceLength } = CHARACTER_RNN_TRAINING_CONFIG;
  const random = seededRandom(CHARACTER_RNN_TRAINING_CONFIG.seed);

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
        const gradient = Math.max(-CHARACTER_RNN_TRAINING_CONFIG.gradientClip, Math.min(CHARACTER_RNN_TRAINING_CONFIG.gradientClip, gradients[row][column]));
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

    const rate = CHARACTER_RNN_TRAINING_CONFIG.learningRate;
    updateMatrix(Wxh, dWxh, mWxh, rate);
    updateMatrix(Whh, dWhh, mWhh, rate);
    updateMatrix(Why, dWhy, mWhy, rate);
    for (let index = 0; index < hiddenSize; index += 1) {
      const gradient = Math.max(-CHARACTER_RNN_TRAINING_CONFIG.gradientClip, Math.min(CHARACTER_RNN_TRAINING_CONFIG.gradientClip, dbh[index]));
      mbh[index] += gradient * gradient;
      bh[index] -= rate * gradient / Math.sqrt(mbh[index] + 1e-8);
    }
    for (let index = 0; index < vocabularySize; index += 1) {
      const gradient = Math.max(-CHARACTER_RNN_TRAINING_CONFIG.gradientClip, Math.min(CHARACTER_RNN_TRAINING_CONFIG.gradientClip, dby[index]));
      mby[index] += gradient * gradient;
      by[index] -= rate * gradient / Math.sqrt(mby[index] + 1e-8);
    }
    previousState = states.at(-1)?.slice() ?? previousState;
    position += sequenceLength;
    losses.push(loss / sequenceLength);
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const checkpoint = assertRnnCheckpoint({ version: 1, vocabulary, hiddenSize, Wxh, Whh, Why, bh, by });
  return {
    losses,
    initialLoss: mean(losses.slice(0, 12)),
    finalLoss: mean(losses.slice(-12)),
    sample: `t${sampleCharacterRnn(checkpoint)}`,
    vocabularySize,
    parameters: hiddenSize * vocabularySize + hiddenSize * hiddenSize + vocabularySize * hiddenSize + hiddenSize + vocabularySize,
    checkpoint,
  };
}
