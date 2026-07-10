export type Prediction = {
  character: string;
  probability: number;
};

export type TrainSnapshot = {
  loss: number;
  step: number;
};

type Parameters = {
  Wxh: Float64Array;
  Whh: Float64Array;
  Why: Float64Array;
  bh: Float64Array;
  by: Float64Array;
};

const PARAMETER_KEYS: (keyof Parameters)[] = ["Wxh", "Whh", "Why", "bh", "by"];

function makeArray(length: number, fill = 0) {
  const result = new Float64Array(length);
  if (fill !== 0) result.fill(fill);
  return result;
}

function randomArray(length: number, scale: number) {
  const result = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    result[i] = (Math.random() * 2 - 1) * scale;
  }
  return result;
}

function sampleIndex(probabilities: Float64Array) {
  let draw = Math.random();
  for (let i = 0; i < probabilities.length; i += 1) {
    draw -= probabilities[i];
    if (draw <= 0) return i;
  }
  return probabilities.length - 1;
}

/**
 * A compact character-level tanh RNN with backpropagation through time.
 * Everything here runs in the browser: forward pass, gradients, AdaGrad,
 * sampling, and next-character probabilities.
 */
export class TinyCharacterRNN {
  readonly text: string;
  readonly vocabulary: string[];
  readonly hiddenSize: number;
  readonly sequenceLength: number;
  readonly parameterCount: number;

  private readonly charToIndex: Map<string, number>;
  private readonly indices: number[];
  private readonly parameters: Parameters;
  private readonly memory: Parameters;
  private hidden: Float64Array;
  private position = 0;
  private smoothLoss: number;
  private iteration = 0;

  constructor(text: string, hiddenSize = 36, sequenceLength = 32) {
    this.text = text;
    this.vocabulary = Array.from(new Set(Array.from(text))).sort();
    this.charToIndex = new Map(this.vocabulary.map((char, index) => [char, index]));
    this.indices = Array.from(text, (char) => this.charToIndex.get(char) ?? 0);
    this.hiddenSize = hiddenSize;
    this.sequenceLength = Math.min(sequenceLength, Math.max(8, text.length - 2));

    const vocabularySize = this.vocabulary.length;
    this.parameters = {
      Wxh: randomArray(hiddenSize * vocabularySize, 0.025),
      Whh: randomArray(hiddenSize * hiddenSize, 0.025),
      Why: randomArray(vocabularySize * hiddenSize, 0.025),
      bh: makeArray(hiddenSize),
      by: makeArray(vocabularySize),
    };
    this.memory = {
      Wxh: makeArray(this.parameters.Wxh.length),
      Whh: makeArray(this.parameters.Whh.length),
      Why: makeArray(this.parameters.Why.length),
      bh: makeArray(this.parameters.bh.length),
      by: makeArray(this.parameters.by.length),
    };
    this.hidden = makeArray(hiddenSize);
    this.smoothLoss = Math.log(vocabularySize);
    this.parameterCount = PARAMETER_KEYS.reduce(
      (sum, key) => sum + this.parameters[key].length,
      0,
    );
  }

  get step() {
    return this.iteration;
  }

  get loss() {
    return this.smoothLoss;
  }

  private nextHidden(characterIndex: number, previous: Float64Array) {
    const vocabularySize = this.vocabulary.length;
    const next = makeArray(this.hiddenSize);

    for (let row = 0; row < this.hiddenSize; row += 1) {
      let value =
        this.parameters.bh[row] +
        this.parameters.Wxh[row * vocabularySize + characterIndex];
      const rowOffset = row * this.hiddenSize;
      for (let column = 0; column < this.hiddenSize; column += 1) {
        value += this.parameters.Whh[rowOffset + column] * previous[column];
      }
      next[row] = Math.tanh(value);
    }
    return next;
  }

  private probabilities(hidden: Float64Array, temperature = 1) {
    const vocabularySize = this.vocabulary.length;
    const logits = makeArray(vocabularySize);
    let maximum = -Infinity;

    for (let vocabularyIndex = 0; vocabularyIndex < vocabularySize; vocabularyIndex += 1) {
      let value = this.parameters.by[vocabularyIndex];
      const rowOffset = vocabularyIndex * this.hiddenSize;
      for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
        value += this.parameters.Why[rowOffset + hiddenIndex] * hidden[hiddenIndex];
      }
      logits[vocabularyIndex] = value / Math.max(0.08, temperature);
      maximum = Math.max(maximum, logits[vocabularyIndex]);
    }

    const result = makeArray(vocabularySize);
    let total = 0;
    for (let i = 0; i < vocabularySize; i += 1) {
      result[i] = Math.exp(logits[i] - maximum);
      total += result[i];
    }
    for (let i = 0; i < vocabularySize; i += 1) result[i] /= total;
    return result;
  }

  trainStep(learningRate = 0.075): TrainSnapshot {
    const vocabularySize = this.vocabulary.length;
    if (this.position + this.sequenceLength + 1 >= this.indices.length) {
      this.position = 0;
      this.hidden.fill(0);
    }

    const length = Math.min(this.sequenceLength, this.indices.length - this.position - 1);
    const inputs = this.indices.slice(this.position, this.position + length);
    const targets = this.indices.slice(this.position + 1, this.position + length + 1);
    const hiddenStates: Float64Array[] = [this.hidden.slice()];
    const distributions: Float64Array[] = [];
    let loss = 0;

    for (let time = 0; time < length; time += 1) {
      const next = this.nextHidden(inputs[time], hiddenStates[time]);
      hiddenStates.push(next);
      const distribution = this.probabilities(next);
      distributions.push(distribution);
      loss += -Math.log(Math.max(1e-12, distribution[targets[time]]));
    }

    const gradients: Parameters = {
      Wxh: makeArray(this.parameters.Wxh.length),
      Whh: makeArray(this.parameters.Whh.length),
      Why: makeArray(this.parameters.Why.length),
      bh: makeArray(this.parameters.bh.length),
      by: makeArray(this.parameters.by.length),
    };
    let nextHiddenGradient = makeArray(this.hiddenSize);

    for (let time = length - 1; time >= 0; time -= 1) {
      const distributionGradient = distributions[time].slice();
      distributionGradient[targets[time]] -= 1;
      const currentHidden = hiddenStates[time + 1];
      const previousHidden = hiddenStates[time];

      for (let vocabularyIndex = 0; vocabularyIndex < vocabularySize; vocabularyIndex += 1) {
        const gradient = distributionGradient[vocabularyIndex];
        gradients.by[vocabularyIndex] += gradient;
        const rowOffset = vocabularyIndex * this.hiddenSize;
        for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
          gradients.Why[rowOffset + hiddenIndex] += gradient * currentHidden[hiddenIndex];
        }
      }

      const hiddenGradient = makeArray(this.hiddenSize);
      for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
        let value = nextHiddenGradient[hiddenIndex];
        for (let vocabularyIndex = 0; vocabularyIndex < vocabularySize; vocabularyIndex += 1) {
          value +=
            this.parameters.Why[vocabularyIndex * this.hiddenSize + hiddenIndex] *
            distributionGradient[vocabularyIndex];
        }
        hiddenGradient[hiddenIndex] = value;
      }

      const rawGradient = makeArray(this.hiddenSize);
      for (let row = 0; row < this.hiddenSize; row += 1) {
        rawGradient[row] = (1 - currentHidden[row] * currentHidden[row]) * hiddenGradient[row];
        gradients.bh[row] += rawGradient[row];
        gradients.Wxh[row * vocabularySize + inputs[time]] += rawGradient[row];
        const rowOffset = row * this.hiddenSize;
        for (let column = 0; column < this.hiddenSize; column += 1) {
          gradients.Whh[rowOffset + column] += rawGradient[row] * previousHidden[column];
        }
      }

      nextHiddenGradient = makeArray(this.hiddenSize);
      for (let column = 0; column < this.hiddenSize; column += 1) {
        let value = 0;
        for (let row = 0; row < this.hiddenSize; row += 1) {
          value +=
            this.parameters.Whh[row * this.hiddenSize + column] * rawGradient[row];
        }
        nextHiddenGradient[column] = value;
      }
    }

    for (const key of PARAMETER_KEYS) {
      const parameter = this.parameters[key];
      const gradient = gradients[key];
      const memory = this.memory[key];
      for (let i = 0; i < parameter.length; i += 1) {
        const clipped = Math.max(-5, Math.min(5, gradient[i]));
        memory[i] += clipped * clipped;
        parameter[i] -= (learningRate * clipped) / Math.sqrt(memory[i] + 1e-8);
      }
    }

    this.hidden = hiddenStates[length].slice();
    this.position += length;
    this.iteration += 1;
    const averageLoss = loss / length;
    this.smoothLoss = this.iteration === 1 ? averageLoss : this.smoothLoss * 0.97 + averageLoss * 0.03;
    return { loss: this.smoothLoss, step: this.iteration };
  }

  sample(length = 260, temperature = 0.8, primer = "the ") {
    let hidden = makeArray(this.hiddenSize);
    let output = "";
    const usablePrimer = Array.from(primer).filter((char) => this.charToIndex.has(char));

    if (usablePrimer.length === 0) usablePrimer.push(this.vocabulary[0]);
    for (const char of usablePrimer) {
      hidden = this.nextHidden(this.charToIndex.get(char) ?? 0, hidden);
      output += char;
    }

    for (let i = 0; i < length; i += 1) {
      const distribution = this.probabilities(hidden, temperature);
      const nextIndex = sampleIndex(distribution);
      const nextCharacter = this.vocabulary[nextIndex];
      output += nextCharacter;
      hidden = this.nextHidden(nextIndex, hidden);
    }
    return output;
  }

  topPredictions(context: string, temperature = 0.8, limit = 5): Prediction[] {
    let hidden = makeArray(this.hiddenSize);
    const usableContext = Array.from(context)
      .filter((char) => this.charToIndex.has(char))
      .slice(-80);
    if (usableContext.length === 0) usableContext.push(this.vocabulary[0]);
    for (const char of usableContext) {
      hidden = this.nextHidden(this.charToIndex.get(char) ?? 0, hidden);
    }
    const distribution = this.probabilities(hidden, temperature);
    return Array.from(distribution, (probability, index) => ({
      character: this.vocabulary[index],
      probability,
    }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);
  }
}
