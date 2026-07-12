export const LATENT_TENSOR_PATH = "runtime/latent-tensor.js";

export const LATENT_TENSOR_VERSION = "0.1.0";

/**
 * The runtime is kept as source so the exact same module can be injected into
 * the learner's virtual file system and exercised by the host test suite.
 */
export const LATENT_TENSOR_SOURCE = String.raw`
const sizeOf = (shape) => shape.reduce((total, value) => total * value, 1);

function assertShape(shape) {
  if (!Array.isArray(shape) || shape.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new TypeError("shape must contain non-negative integers");
  }
}

function inferShape(value) {
  if (!Array.isArray(value)) return [];
  const shape = [value.length];
  if (value.length === 0) return shape;
  const childShape = inferShape(value[0]);
  for (let index = 1; index < value.length; index += 1) {
    const nextShape = inferShape(value[index]);
    if (nextShape.length !== childShape.length || nextShape.some((item, axis) => item !== childShape[axis])) {
      throw new TypeError("tensor data must be rectangular");
    }
  }
  return shape.concat(childShape);
}

function flatten(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flatten(item, output));
  } else {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new TypeError("tensor values must be numbers");
    }
    output.push(value);
  }
  return output;
}

function nested(data, shape, offset = 0) {
  if (shape.length === 0) return data[offset];
  const stride = sizeOf(shape.slice(1));
  return Array.from({ length: shape[0] }, (_, index) => nested(data, shape.slice(1), offset + index * stride));
}

function stridesFor(shape) {
  return shape.map((_, axis) => sizeOf(shape.slice(axis + 1)));
}

function coordinates(flatIndex, shape) {
  const strides = stridesFor(shape);
  return shape.map((dimension, axis) => {
    if (dimension === 0) return 0;
    return Math.floor(flatIndex / strides[axis]) % dimension;
  });
}

function flatIndexFor(coords, shape) {
  const strides = stridesFor(shape);
  return coords.reduce((total, coordinate, axis) => total + coordinate * strides[axis], 0);
}

function asTensor(value) {
  return value instanceof Tensor ? value : tensor(value);
}

function addGradient(target, values) {
  if (!target.requiresGrad) return;
  if (!target._grad) target._grad = Array(target.size).fill(0);
  values.forEach((value, index) => {
    target._grad[index] += value;
  });
}

function resultTensor(data, shape, parents, backward) {
  return new Tensor(data, {
    shape,
    requiresGrad: parents.some((parent) => parent.requiresGrad),
    parents,
    backward,
  });
}

class Tensor {
  constructor(value, options = {}) {
    const shape = options.shape ? Array.from(options.shape) : inferShape(value);
    assertShape(shape);
    const data = Array.isArray(value) ? flatten(value) : [value];
    if (data.length !== sizeOf(shape)) {
      throw new RangeError("tensor data does not match its shape");
    }

    this.data = Object.freeze(Array.from(data));
    this.shape = Object.freeze(shape);
    this.rank = shape.length;
    this.size = data.length;
    this.requiresGrad = Boolean(options.requiresGrad);
    this._parents = options.parents || [];
    this._backward = options.backward || (() => {});
    this._grad = null;
  }

  toArray() {
    return nested(this.data, this.shape);
  }

  tolist() {
    return this.toArray();
  }

  item() {
    if (this.size !== 1) throw new RangeError("item() requires a one-element tensor");
    return this.data[0];
  }

  get grad() {
    return this._grad ? new Tensor(this._grad, { shape: this.shape }) : null;
  }

  zeroGrad() {
    this._grad = null;
    return this;
  }

  backward(gradient) {
    let seed;
    if (gradient === undefined) {
      if (this.size !== 1) throw new RangeError("non-scalar tensors need an explicit backward gradient");
      seed = [1];
    } else {
      const supplied = asTensor(gradient);
      if (supplied.size !== this.size || supplied.shape.some((value, axis) => value !== this.shape[axis])) {
        throw new RangeError("backward gradient shape mismatch");
      }
      seed = Array.from(supplied.data);
    }

    const ordered = [];
    const visited = new Set();
    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);
      node._parents.forEach(visit);
      ordered.push(node);
    };
    visit(this);
    this._grad = seed;
    ordered.reverse().forEach((node) => {
      if (node._grad) node._backward(node._grad);
    });
    return this;
  }
}

function tensor(value, options = {}) {
  if (value instanceof Tensor) return value;
  return new Tensor(value, options);
}

function zeros(shape, options = {}) {
  assertShape(shape);
  return new Tensor(Array(sizeOf(shape)).fill(0), { ...options, shape });
}

function ones(shape, options = {}) {
  assertShape(shape);
  return new Tensor(Array(sizeOf(shape)).fill(1), { ...options, shape });
}

function broadcastShape(left, right) {
  const rank = Math.max(left.length, right.length);
  const output = [];
  for (let offset = 1; offset <= rank; offset += 1) {
    const a = left[left.length - offset] ?? 1;
    const b = right[right.length - offset] ?? 1;
    if (a !== b && a !== 1 && b !== 1) throw new RangeError("tensor shapes cannot be broadcast together");
    output.unshift(Math.max(a, b));
  }
  return output;
}

function sourceIndex(outputCoords, outputShape, sourceShape) {
  const offset = outputShape.length - sourceShape.length;
  const coords = sourceShape.map((dimension, axis) => dimension === 1 ? 0 : outputCoords[axis + offset]);
  return flatIndexFor(coords, sourceShape);
}

function binary(leftValue, rightValue, forward, derivativeLeft, derivativeRight) {
  const left = asTensor(leftValue);
  const right = asTensor(rightValue);
  const shape = broadcastShape(left.shape, right.shape);
  const count = sizeOf(shape);
  const leftIndices = [];
  const rightIndices = [];
  const output = Array.from({ length: count }, (_, index) => {
    const coords = coordinates(index, shape);
    const leftIndex = sourceIndex(coords, shape, left.shape);
    const rightIndex = sourceIndex(coords, shape, right.shape);
    leftIndices.push(leftIndex);
    rightIndices.push(rightIndex);
    return forward(left.data[leftIndex], right.data[rightIndex]);
  });

  return resultTensor(output, shape, [left, right], (gradient) => {
    const leftGradient = Array(left.size).fill(0);
    const rightGradient = Array(right.size).fill(0);
    gradient.forEach((value, index) => {
      const leftIndex = leftIndices[index];
      const rightIndex = rightIndices[index];
      leftGradient[leftIndex] += value * derivativeLeft(left.data[leftIndex], right.data[rightIndex]);
      rightGradient[rightIndex] += value * derivativeRight(left.data[leftIndex], right.data[rightIndex]);
    });
    addGradient(left, leftGradient);
    addGradient(right, rightGradient);
  });
}

function unary(value, forward, derivative) {
  const input = asTensor(value);
  const output = input.data.map(forward);
  return resultTensor(output, input.shape, [input], (gradient) => {
    addGradient(input, gradient.map((item, index) => item * derivative(input.data[index], output[index])));
  });
}

const add = (left, right) => binary(left, right, (a, b) => a + b, () => 1, () => 1);
const sub = (left, right) => binary(left, right, (a, b) => a - b, () => 1, () => -1);
const mul = (left, right) => binary(left, right, (a, b) => a * b, (_, b) => b, (a) => a);
const div = (left, right) => binary(left, right, (a, b) => a / b, (_, b) => 1 / b, (a, b) => -a / (b * b));
const neg = (value) => unary(value, (item) => -item, () => -1);
const exp = (value) => unary(value, Math.exp, (_, output) => output);
const log = (value) => unary(value, Math.log, (item) => 1 / item);
const tanh = (value) => unary(value, Math.tanh, (_, output) => 1 - output * output);

function pow(value, exponent) {
  if (typeof exponent !== "number") throw new TypeError("pow exponent must be a number");
  return unary(value, (item) => item ** exponent, (item) => exponent * item ** (exponent - 1));
}

function reshape(value, shape) {
  const input = asTensor(value);
  assertShape(shape);
  if (sizeOf(shape) !== input.size) throw new RangeError("reshape must preserve tensor size");
  return resultTensor(input.data, shape, [input], (gradient) => addGradient(input, gradient));
}

function transpose(value) {
  const input = asTensor(value);
  if (input.rank !== 2) throw new RangeError("transpose currently supports rank-2 tensors");
  const [rows, columns] = input.shape;
  const output = Array(rows * columns);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      output[column * rows + row] = input.data[row * columns + column];
    }
  }
  return resultTensor(output, [columns, rows], [input], (gradient) => {
    const inputGradient = Array(input.size);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        inputGradient[row * columns + column] = gradient[column * rows + row];
      }
    }
    addGradient(input, inputGradient);
  });
}

function sum(value, axis = null) {
  const input = asTensor(value);
  if (axis === null || input.rank === 0) {
    return resultTensor([input.data.reduce((total, item) => total + item, 0)], [], [input], (gradient) => {
      addGradient(input, Array(input.size).fill(gradient[0]));
    });
  }
  const normalizedAxis = axis < 0 ? input.rank + axis : axis;
  if (!Number.isInteger(normalizedAxis) || normalizedAxis < 0 || normalizedAxis >= input.rank) {
    throw new RangeError("sum axis is out of range");
  }
  const shape = input.shape.filter((_, index) => index !== normalizedAxis);
  const output = Array(sizeOf(shape)).fill(0);
  const outputIndices = input.data.map((_, index) => {
    const coords = coordinates(index, input.shape).filter((_, coordinateAxis) => coordinateAxis !== normalizedAxis);
    const outputIndex = flatIndexFor(coords, shape);
    output[outputIndex] += input.data[index];
    return outputIndex;
  });
  return resultTensor(output, shape, [input], (gradient) => {
    addGradient(input, outputIndices.map((outputIndex) => gradient[outputIndex]));
  });
}

function mean(value, axis = null) {
  const input = asTensor(value);
  const divisor = axis === null || input.rank === 0
    ? input.size
    : input.shape[axis < 0 ? input.rank + axis : axis];
  return div(sum(input, axis), divisor);
}

function dot(leftValue, rightValue) {
  const left = asTensor(leftValue);
  const right = asTensor(rightValue);
  if (left.rank !== 1 || right.rank !== 1 || left.shape[0] !== right.shape[0]) {
    throw new RangeError("dot requires vectors of equal length");
  }
  return sum(mul(left, right));
}

function matmul(leftValue, rightValue) {
  const left = asTensor(leftValue);
  const right = asTensor(rightValue);
  if (left.rank === 1 && right.rank === 1) return dot(left, right);

  let rows;
  let inner;
  let columns;
  let outputShape;
  if (left.rank === 2 && right.rank === 1) {
    [rows, inner] = left.shape;
    if (right.shape[0] !== inner) throw new RangeError("matmul inner dimensions must match");
    columns = 1;
    outputShape = [rows];
  } else if (left.rank === 1 && right.rank === 2) {
    rows = 1;
    inner = left.shape[0];
    if (right.shape[0] !== inner) throw new RangeError("matmul inner dimensions must match");
    columns = right.shape[1];
    outputShape = [columns];
  } else if (left.rank === 2 && right.rank === 2) {
    [rows, inner] = left.shape;
    if (right.shape[0] !== inner) throw new RangeError("matmul inner dimensions must match");
    columns = right.shape[1];
    outputShape = [rows, columns];
  } else {
    throw new RangeError("matmul currently supports vectors and matrices");
  }

  const output = Array(rows * columns).fill(0);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (let index = 0; index < inner; index += 1) {
        const leftValueAtIndex = left.rank === 1 ? left.data[index] : left.data[row * inner + index];
        const rightValueAtIndex = right.rank === 1 ? right.data[index] : right.data[index * columns + column];
        output[row * columns + column] += leftValueAtIndex * rightValueAtIndex;
      }
    }
  }

  return resultTensor(output, outputShape, [left, right], (gradient) => {
    const leftGradient = Array(left.size).fill(0);
    const rightGradient = Array(right.size).fill(0);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const upstream = gradient[row * columns + column];
        for (let index = 0; index < inner; index += 1) {
          const leftIndex = left.rank === 1 ? index : row * inner + index;
          const rightIndex = right.rank === 1 ? index : index * columns + column;
          leftGradient[leftIndex] += upstream * right.data[rightIndex];
          rightGradient[rightIndex] += upstream * left.data[leftIndex];
        }
      }
    }
    addGradient(left, leftGradient);
    addGradient(right, rightGradient);
  });
}

function softmax(value, axis = -1) {
  const input = asTensor(value);
  if (input.rank === 0) return tensor(1);
  const normalizedAxis = axis < 0 ? input.rank + axis : axis;
  if (normalizedAxis !== input.rank - 1) throw new RangeError("softmax currently operates on the last axis");
  const width = input.shape[input.rank - 1];
  const groups = input.size / width;
  const output = Array(input.size);
  for (let group = 0; group < groups; group += 1) {
    const offset = group * width;
    const maximum = Math.max(...input.data.slice(offset, offset + width));
    const weights = input.data.slice(offset, offset + width).map((item) => Math.exp(item - maximum));
    const total = weights.reduce((sum, item) => sum + item, 0);
    weights.forEach((item, index) => { output[offset + index] = item / total; });
  }
  return resultTensor(output, input.shape, [input], (gradient) => {
    const inputGradient = Array(input.size);
    for (let group = 0; group < groups; group += 1) {
      const offset = group * width;
      let projection = 0;
      for (let index = 0; index < width; index += 1) {
        projection += gradient[offset + index] * output[offset + index];
      }
      for (let index = 0; index < width; index += 1) {
        inputGradient[offset + index] = output[offset + index] * (gradient[offset + index] - projection);
      }
    }
    addGradient(input, inputGradient);
  });
}

const logSoftmax = (value, axis = -1) => log(softmax(value, axis));

function embedding(tableValue, indices) {
  const table = asTensor(tableValue);
  if (table.rank !== 2 || !Array.isArray(indices)) throw new RangeError("embedding needs a rank-2 table and index array");
  const width = table.shape[1];
  const normalized = indices.map((index) => {
    if (!Number.isInteger(index) || index < 0 || index >= table.shape[0]) throw new RangeError("embedding index is out of range");
    return index;
  });
  const output = normalized.flatMap((index) => table.data.slice(index * width, (index + 1) * width));
  return resultTensor(output, [normalized.length, width], [table], (gradient) => {
    const tableGradient = Array(table.size).fill(0);
    normalized.forEach((tableIndex, row) => {
      for (let column = 0; column < width; column += 1) {
        tableGradient[tableIndex * width + column] += gradient[row * width + column];
      }
    });
    addGradient(table, tableGradient);
  });
}

function weightedSum(statesValue, weightsValue) {
  const states = asTensor(statesValue);
  const weights = asTensor(weightsValue);
  if (states.rank !== 2 || weights.rank !== 1 || states.shape[0] !== weights.shape[0]) {
    throw new RangeError("weightedSum needs [items, width] states and [items] weights");
  }
  return matmul(transpose(states), weights);
}

function nllLoss(probabilitiesValue, targetIndex, epsilon = 1e-12) {
  const probabilities = asTensor(probabilitiesValue);
  if (probabilities.rank !== 1 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= probabilities.size) {
    throw new RangeError("nllLoss needs a probability vector and valid target index");
  }
  const probability = Math.max(probabilities.data[targetIndex], epsilon);
  return resultTensor([-Math.log(probability)], [], [probabilities], (gradient) => {
    const probabilityGradient = Array(probabilities.size).fill(0);
    if (probabilities.data[targetIndex] > epsilon) probabilityGradient[targetIndex] = -gradient[0] / probability;
    addGradient(probabilities, probabilityGradient);
  });
}

const crossEntropy = (logits, targetIndex) => nllLoss(softmax(logits), targetIndex);

function normalizeLayer(value, epsilon = 1e-5) {
  const input = asTensor(value);
  const average = mean(input, -1);
  const centered = sub(input, average);
  const variance = mean(pow(centered, 2), -1);
  return div(centered, pow(add(variance, epsilon), 0.5));
}

function maskCausal(value, blockedValue = -Infinity) {
  const input = asTensor(value);
  if (input.rank !== 2 || input.shape[0] !== input.shape[1]) throw new RangeError("maskCausal needs a square rank-2 tensor");
  const width = input.shape[1];
  const output = input.data.map((item, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    return column > row ? blockedValue : item;
  });
  return resultTensor(output, input.shape, [input], (gradient) => {
    addGradient(input, gradient.map((item, index) => {
      const row = Math.floor(index / width);
      const column = index % width;
      return column > row ? 0 : item;
    }));
  });
}

function clip(value, minimum, maximum) {
  if (minimum > maximum) throw new RangeError("clip minimum cannot exceed maximum");
  return unary(value, (item) => Math.min(maximum, Math.max(minimum, item)), (item) => item >= minimum && item <= maximum ? 1 : 0);
}

function oneHot(index, width) {
  if (!Number.isInteger(index) || !Number.isInteger(width) || width < 1 || index < 0 || index >= width) {
    throw new RangeError("oneHot needs a valid index and positive width");
  }
  const output = Array(width).fill(0);
  output[index] = 1;
  return tensor(output);
}

function argmax(value) {
  const input = asTensor(value);
  if (input.size === 0) throw new RangeError("argmax cannot inspect an empty tensor");
  return input.data.reduce((best, item, index) => item > input.data[best] ? index : best, 0);
}

function topK(value, count) {
  const input = asTensor(value);
  if (input.rank !== 1 || !Number.isInteger(count) || count < 1 || count > input.size) {
    throw new RangeError("topK needs a vector and a valid count");
  }
  const ranked = input.data.map((item, index) => ({ value: item, index })).sort((left, right) => right.value - left.value).slice(0, count);
  return { values: ranked.map((item) => item.value), indices: ranked.map((item) => item.index) };
}

function numel(value) {
  if (value instanceof Tensor) return value.size;
  assertShape(value);
  return sizeOf(value);
}

function randn(shape, options = {}) {
  assertShape(shape);
  let state = (options.seed ?? 1) >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state + 1) / 4294967297;
  };
  const scale = options.scale ?? 1;
  const output = [];
  while (output.length < sizeOf(shape)) {
    const radius = Math.sqrt(-2 * Math.log(random()));
    const angle = 2 * Math.PI * random();
    output.push(radius * Math.cos(angle) * scale);
    if (output.length < sizeOf(shape)) output.push(radius * Math.sin(angle) * scale);
  }
  return new Tensor(output, { shape, requiresGrad: options.requiresGrad });
}

const toArray = (value) => asTensor(value).toArray();

export {
  Tensor,
  tensor,
  zeros,
  ones,
  randn,
  oneHot,
  reshape,
  transpose,
  add,
  sub,
  mul,
  div,
  neg,
  pow,
  exp,
  log,
  tanh,
  sum,
  mean,
  dot,
  matmul,
  softmax,
  logSoftmax,
  embedding,
  weightedSum,
  nllLoss,
  crossEntropy,
  normalizeLayer,
  maskCausal,
  clip,
  argmax,
  topK,
  numel,
  toArray,
};
`;
