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
  source: "Course-authored synthetic corpus",
  license: "Not separately licensed",
  split: "fixed deterministic sequence",
});

export const CHARACTER_RNN_TRAINING_CONFIG = Object.freeze({
  seed: 19,
  hiddenSize: 18,
  sequenceLength: 32,
  optimizer: "Adam",
  learningRate: 0.012,
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

type TrainingParameters = {
  inputToState: number[][];
  stateToState: number[][];
  stateToToken: number[][];
  stateBias: number[];
  tokenBias: number[];
};

function emptyTrainingParameters(hiddenSize: number, vocabularySize: number): TrainingParameters {
  return {
    inputToState: zeros(hiddenSize, vocabularySize),
    stateToState: zeros(hiddenSize, hiddenSize),
    stateToToken: zeros(vocabularySize, hiddenSize),
    stateBias: Array(hiddenSize).fill(0) as number[],
    tokenBias: Array(vocabularySize).fill(0) as number[],
  };
}

function trainingState(parameters: TrainingParameters, token: number, previous: number[]) {
  return parameters.stateBias.map((bias, row) => {
    let activation = bias + parameters.inputToState[row][token];
    for (let column = 0; column < previous.length; column += 1) {
      activation += parameters.stateToState[row][column] * previous[column];
    }
    return Math.tanh(activation);
  });
}

function trainingDistribution(parameters: TrainingParameters, state: number[]) {
  return softmax(parameters.tokenBias.map((bias, token) => {
    let logit = bias;
    for (let feature = 0; feature < state.length; feature += 1) {
      logit += parameters.stateToToken[token][feature] * state[feature];
    }
    return logit;
  }));
}

function applyAdamVector(
  values: number[],
  gradients: number[],
  firstMoment: number[],
  secondMoment: number[],
  updateNumber: number,
) {
  const betaOne = 0.9;
  const betaTwo = 0.999;
  const firstCorrection = 1 - betaOne ** updateNumber;
  const secondCorrection = 1 - betaTwo ** updateNumber;
  for (let index = 0; index < values.length; index += 1) {
    const clipped = Math.max(
      -CHARACTER_RNN_TRAINING_CONFIG.gradientClip,
      Math.min(CHARACTER_RNN_TRAINING_CONFIG.gradientClip, gradients[index]),
    );
    firstMoment[index] = betaOne * firstMoment[index] + (1 - betaOne) * clipped;
    secondMoment[index] = betaTwo * secondMoment[index] + (1 - betaTwo) * clipped * clipped;
    const direction = (firstMoment[index] / firstCorrection)
      / (Math.sqrt(secondMoment[index] / secondCorrection) + 1e-8);
    values[index] -= CHARACTER_RNN_TRAINING_CONFIG.learningRate * direction;
  }
}

function applyAdam(
  parameters: TrainingParameters,
  gradients: TrainingParameters,
  firstMoment: TrainingParameters,
  secondMoment: TrainingParameters,
  updateNumber: number,
) {
  for (const name of ["inputToState", "stateToState", "stateToToken"] as const) {
    for (let row = 0; row < parameters[name].length; row += 1) {
      applyAdamVector(
        parameters[name][row],
        gradients[name][row],
        firstMoment[name][row],
        secondMoment[name][row],
        updateNumber,
      );
    }
  }
  applyAdamVector(parameters.stateBias, gradients.stateBias, firstMoment.stateBias, secondMoment.stateBias, updateNumber);
  applyAdamVector(parameters.tokenBias, gradients.tokenBias, firstMoment.tokenBias, secondMoment.tokenBias, updateNumber);
}

export function trainCharacterRnn(steps = 600): RnnResult {
  integerInRange(steps, "steps", 1, 100_000);
  const corpus = RNN_CORPUS;
  const vocabulary = [...new Set(corpus)].sort();
  const toIndex = new Map(vocabulary.map((character, index) => [character, index]));
  const vocabularySize = vocabulary.length;
  const { hiddenSize, sequenceLength } = CHARACTER_RNN_TRAINING_CONFIG;
  const random = seededRandom(CHARACTER_RNN_TRAINING_CONFIG.seed);
  const parameters: TrainingParameters = {
    inputToState: randomMatrix(hiddenSize, vocabularySize, random, 0.018),
    stateToState: randomMatrix(hiddenSize, hiddenSize, random, 0.04),
    stateToToken: randomMatrix(vocabularySize, hiddenSize, random, 0.018),
    stateBias: Array(hiddenSize).fill(0) as number[],
    tokenBias: Array(vocabularySize).fill(0) as number[],
  };
  const firstMoment = emptyTrainingParameters(hiddenSize, vocabularySize);
  const secondMoment = emptyTrainingParameters(hiddenSize, vocabularySize);
  const losses: number[] = [];
  const maximumStart = corpus.length - sequenceLength - 1;

  for (let updateNumber = 1; updateNumber <= steps; updateNumber += 1) {
    const start = ((updateNumber - 1) * 37) % (maximumStart + 1);
    const inputIds = [...corpus.slice(start, start + sequenceLength)].map((character) => toIndex.get(character) ?? 0);
    const targetIds = [...corpus.slice(start + 1, start + sequenceLength + 1)].map((character) => toIndex.get(character) ?? 0);
    const states = [Array(hiddenSize).fill(0) as number[]];
    const distributions: number[][] = [];
    let loss = 0;

    for (let time = 0; time < sequenceLength; time += 1) {
      const state = trainingState(parameters, inputIds[time], states[time]);
      const distribution = trainingDistribution(parameters, state);
      states.push(state);
      distributions.push(distribution);
      loss -= Math.log(Math.max(distribution[targetIds[time]], 1e-12));
    }

    const gradients = emptyTrainingParameters(hiddenSize, vocabularySize);
    let stateSignal = Array(hiddenSize).fill(0) as number[];
    for (let time = sequenceLength - 1; time >= 0; time -= 1) {
      const tokenError = distributions[time].slice();
      tokenError[targetIds[time]] -= 1;
      for (let token = 0; token < vocabularySize; token += 1) {
        gradients.tokenBias[token] += tokenError[token];
        for (let feature = 0; feature < hiddenSize; feature += 1) {
          gradients.stateToToken[token][feature] += tokenError[token] * states[time + 1][feature];
        }
      }

      const transitionSignal = Array.from({ length: hiddenSize }, (_, feature) => {
        let combined = stateSignal[feature];
        for (let token = 0; token < vocabularySize; token += 1) {
          combined += parameters.stateToToken[token][feature] * tokenError[token];
        }
        return combined * (1 - states[time + 1][feature] ** 2);
      });
      for (let row = 0; row < hiddenSize; row += 1) {
        gradients.stateBias[row] += transitionSignal[row];
        gradients.inputToState[row][inputIds[time]] += transitionSignal[row];
        for (let column = 0; column < hiddenSize; column += 1) {
          gradients.stateToState[row][column] += transitionSignal[row] * states[time][column];
        }
      }
      stateSignal = Array.from({ length: hiddenSize }, (_, column) => {
        let signal = 0;
        for (let row = 0; row < hiddenSize; row += 1) {
          signal += parameters.stateToState[row][column] * transitionSignal[row];
        }
        return signal;
      });
    }

    applyAdam(parameters, gradients, firstMoment, secondMoment, updateNumber);
    losses.push(loss / sequenceLength);
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const checkpoint = assertRnnCheckpoint({
    version: 1,
    vocabulary,
    hiddenSize,
    Wxh: parameters.inputToState,
    Whh: parameters.stateToState,
    Why: parameters.stateToToken,
    bh: parameters.stateBias,
    by: parameters.tokenBias,
  });
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
