/** A tensor shape, ordered from outermost to innermost dimension. */
export type Shape = readonly number[];

/** Nested numeric input accepted by {@link tensor}. */
export type TensorData = number | readonly TensorData[];

/** Any value that can participate in a tensor operation. */
export type TensorLike = Tensor | TensorData;

export type TensorOptions = {
  shape?: Shape;
  requiresGrad?: boolean;
};

export type RandomOptions = {
  seed?: number;
  scale?: number;
  requiresGrad?: boolean;
};

export type TopKResult = {
  values: number[];
  indices: number[];
};

type Backward = (gradient: readonly number[]) => void;

type InternalTensorOptions = TensorOptions & {
  parents?: readonly Tensor[];
  backward?: Backward;
};

type BinaryFunction = (left: number, right: number) => number;

const sizeOf = (shape: Shape) => shape.reduce((total, value) => total * value, 1);

function assertShape(shape: Shape): void {
  if (!Array.isArray(shape) || shape.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new TypeError("shape must contain non-negative integers");
  }
}

function inferShape(value: TensorData): number[] {
  if (!Array.isArray(value)) return [];
  const shape = [value.length];
  if (value.length === 0) return shape;
  const childShape = inferShape(value[0] as TensorData);
  for (let index = 1; index < value.length; index += 1) {
    const nextShape = inferShape(value[index] as TensorData);
    if (
      nextShape.length !== childShape.length
      || nextShape.some((item, axis) => item !== childShape[axis])
    ) {
      throw new TypeError("tensor data must be rectangular");
    }
  }
  return shape.concat(childShape);
}

function flatten(value: TensorData, output: number[] = []): number[] {
  if (Array.isArray(value)) {
    value.forEach((item) => flatten(item as TensorData, output));
  } else {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new TypeError("tensor values must be numbers");
    }
    output.push(value);
  }
  return output;
}

function nested(data: readonly number[], shape: Shape, offset = 0): TensorData {
  if (shape.length === 0) return data[offset] as number;
  const stride = sizeOf(shape.slice(1));
  return Array.from(
    { length: shape[0] as number },
    (_, index) => nested(data, shape.slice(1), offset + index * stride),
  );
}

function stridesFor(shape: Shape): number[] {
  return shape.map((_, axis) => sizeOf(shape.slice(axis + 1)));
}

function coordinates(flatIndex: number, shape: Shape): number[] {
  const strides = stridesFor(shape);
  return shape.map((dimension, axis) => {
    if (dimension === 0) return 0;
    return Math.floor(flatIndex / (strides[axis] as number)) % dimension;
  });
}

function flatIndexFor(coords: Shape, shape: Shape): number {
  const strides = stridesFor(shape);
  return coords.reduce(
    (total, coordinate, axis) => total + coordinate * (strides[axis] as number),
    0,
  );
}

function asTensor(value: TensorLike): Tensor {
  return value instanceof Tensor ? value : tensor(value);
}

function addGradient(target: Tensor, values: readonly number[]): void {
  if (!target.requiresGrad) return;
  if (!target._grad) target._grad = Array(target.size).fill(0) as number[];
  values.forEach((value, index) => {
    (target._grad as number[])[index] = ((target._grad as number[])[index] as number) + value;
  });
}

function resultTensor(
  data: readonly number[],
  shape: Shape,
  parents: readonly Tensor[],
  backward: Backward,
): Tensor {
  return new Tensor(data, {
    shape,
    requiresGrad: parents.some((parent) => parent.requiresGrad),
    parents,
    backward,
  });
}

/**
 * An immutable CPU tensor backed by a flat JavaScript number array.
 *
 * Operations construct a small reverse-mode autograd graph when any input has
 * `requiresGrad: true`. Tensor data and shape are immutable; accumulated
 * gradients are mutable and may be cleared with {@link Tensor.zeroGrad}.
 */
export class Tensor {
  readonly data: readonly number[];
  readonly shape: Shape;
  readonly rank: number;
  readonly size: number;
  readonly requiresGrad: boolean;
  /** @internal */
  readonly _parents: readonly Tensor[];
  /** @internal */
  readonly _backward: Backward;
  /** @internal */
  _grad: number[] | null;

  constructor(value: TensorData | readonly number[], options: InternalTensorOptions = {}) {
    const tensorValue = value as TensorData;
    const shape = options.shape ? Array.from(options.shape) : inferShape(tensorValue);
    assertShape(shape);
    const data = Array.isArray(value) ? flatten(tensorValue) : [value as number];
    if (data.length !== sizeOf(shape)) {
      throw new RangeError("tensor data does not match its shape");
    }

    this.data = Object.freeze(Array.from(data));
    this.shape = Object.freeze(shape);
    this.rank = shape.length;
    this.size = data.length;
    this.requiresGrad = Boolean(options.requiresGrad);
    this._parents = options.parents ?? [];
    this._backward = options.backward ?? (() => {});
    this._grad = null;
  }

  toArray(): TensorData {
    return nested(this.data, this.shape);
  }

  tolist(): TensorData {
    return this.toArray();
  }

  item(): number {
    if (this.size !== 1) throw new RangeError("item() requires a one-element tensor");
    return this.data[0] as number;
  }

  get grad(): Tensor | null {
    return this._grad ? new Tensor(this._grad, { shape: this.shape }) : null;
  }

  zeroGrad(): this {
    this._grad = null;
    return this;
  }

  backward(gradient?: TensorLike): this {
    let seed: number[];
    if (gradient === undefined) {
      if (this.size !== 1) {
        throw new RangeError("non-scalar tensors need an explicit backward gradient");
      }
      seed = [1];
    } else {
      const supplied = asTensor(gradient);
      if (
        supplied.size !== this.size
        || supplied.shape.some((value, axis) => value !== this.shape[axis])
      ) {
        throw new RangeError("backward gradient shape mismatch");
      }
      seed = Array.from(supplied.data);
    }

    const ordered: Tensor[] = [];
    const visited = new Set<Tensor>();
    const visit = (node: Tensor): void => {
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

export function tensor(value: TensorLike, options: TensorOptions = {}): Tensor {
  if (value instanceof Tensor) return value;
  return new Tensor(value, options);
}

export function zeros(shape: Shape, options: TensorOptions = {}): Tensor {
  assertShape(shape);
  return new Tensor(Array(sizeOf(shape)).fill(0) as number[], { ...options, shape });
}

export function ones(shape: Shape, options: TensorOptions = {}): Tensor {
  assertShape(shape);
  return new Tensor(Array(sizeOf(shape)).fill(1) as number[], { ...options, shape });
}

function broadcastShape(left: Shape, right: Shape): number[] {
  const rank = Math.max(left.length, right.length);
  const output: number[] = [];
  for (let offset = 1; offset <= rank; offset += 1) {
    const a = left[left.length - offset] ?? 1;
    const b = right[right.length - offset] ?? 1;
    if (a !== b && a !== 1 && b !== 1) {
      throw new RangeError("tensor shapes cannot be broadcast together");
    }
    output.unshift(Math.max(a, b));
  }
  return output;
}

function sourceIndex(outputCoords: Shape, outputShape: Shape, sourceShape: Shape): number {
  const offset = outputShape.length - sourceShape.length;
  const coords = sourceShape.map(
    (dimension, axis) => dimension === 1 ? 0 : outputCoords[axis + offset] as number,
  );
  return flatIndexFor(coords, sourceShape);
}

function binary(
  leftValue: TensorLike,
  rightValue: TensorLike,
  forward: BinaryFunction,
  derivativeLeft: BinaryFunction,
  derivativeRight: BinaryFunction,
): Tensor {
  const left = asTensor(leftValue);
  const right = asTensor(rightValue);
  const shape = broadcastShape(left.shape, right.shape);
  const count = sizeOf(shape);
  const leftIndices: number[] = [];
  const rightIndices: number[] = [];
  const output = Array.from({ length: count }, (_, index) => {
    const coords = coordinates(index, shape);
    const leftIndex = sourceIndex(coords, shape, left.shape);
    const rightIndex = sourceIndex(coords, shape, right.shape);
    leftIndices.push(leftIndex);
    rightIndices.push(rightIndex);
    return forward(left.data[leftIndex] as number, right.data[rightIndex] as number);
  });

  return resultTensor(output, shape, [left, right], (gradient) => {
    const leftGradient = Array(left.size).fill(0) as number[];
    const rightGradient = Array(right.size).fill(0) as number[];
    gradient.forEach((value, index) => {
      const leftIndex = leftIndices[index] as number;
      const rightIndex = rightIndices[index] as number;
      leftGradient[leftIndex] = (leftGradient[leftIndex] as number)
        + value * derivativeLeft(left.data[leftIndex] as number, right.data[rightIndex] as number);
      rightGradient[rightIndex] = (rightGradient[rightIndex] as number)
        + value * derivativeRight(left.data[leftIndex] as number, right.data[rightIndex] as number);
    });
    addGradient(left, leftGradient);
    addGradient(right, rightGradient);
  });
}

function unary(
  value: TensorLike,
  forward: (value: number) => number,
  derivative: (input: number, output: number) => number,
): Tensor {
  const input = asTensor(value);
  const output = input.data.map(forward);
  return resultTensor(output, input.shape, [input], (gradient) => {
    addGradient(
      input,
      gradient.map(
        (item, index) => item * derivative(input.data[index] as number, output[index] as number),
      ),
    );
  });
}

export const add = (left: TensorLike, right: TensorLike): Tensor => binary(
  left,
  right,
  (a, b) => a + b,
  () => 1,
  () => 1,
);

export const sub = (left: TensorLike, right: TensorLike): Tensor => binary(
  left,
  right,
  (a, b) => a - b,
  () => 1,
  () => -1,
);

export const mul = (left: TensorLike, right: TensorLike): Tensor => binary(
  left,
  right,
  (a, b) => a * b,
  (_, b) => b,
  (a) => a,
);

export const div = (left: TensorLike, right: TensorLike): Tensor => binary(
  left,
  right,
  (a, b) => a / b,
  (_, b) => 1 / b,
  (a, b) => -a / (b * b),
);

export const neg = (value: TensorLike): Tensor => unary(value, (item) => -item, () => -1);
export const exp = (value: TensorLike): Tensor => unary(value, Math.exp, (_, output) => output);
export const log = (value: TensorLike): Tensor => unary(value, Math.log, (item) => 1 / item);
export const tanh = (value: TensorLike): Tensor => unary(
  value,
  Math.tanh,
  (_, output) => 1 - output * output,
);

export function pow(value: TensorLike, exponent: number): Tensor {
  if (typeof exponent !== "number") throw new TypeError("pow exponent must be a number");
  return unary(
    value,
    (item) => item ** exponent,
    (item) => exponent * item ** (exponent - 1),
  );
}

export function reshape(value: TensorLike, shape: Shape): Tensor {
  const input = asTensor(value);
  assertShape(shape);
  if (sizeOf(shape) !== input.size) {
    throw new RangeError("reshape must preserve tensor size");
  }
  return resultTensor(input.data, shape, [input], (gradient) => addGradient(input, gradient));
}

export function transpose(value: TensorLike): Tensor {
  const input = asTensor(value);
  if (input.rank !== 2) {
    throw new RangeError("transpose currently supports rank-2 tensors");
  }
  const rows = input.shape[0] as number;
  const columns = input.shape[1] as number;
  const output = Array(rows * columns) as number[];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      output[column * rows + row] = input.data[row * columns + column] as number;
    }
  }
  return resultTensor(output, [columns, rows], [input], (gradient) => {
    const inputGradient = Array(input.size) as number[];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        inputGradient[row * columns + column] = gradient[column * rows + row] as number;
      }
    }
    addGradient(input, inputGradient);
  });
}

export function sum(value: TensorLike, axis: number | null = null): Tensor {
  const input = asTensor(value);
  if (axis === null || input.rank === 0) {
    return resultTensor(
      [input.data.reduce((total, item) => total + item, 0)],
      [],
      [input],
      (gradient) => addGradient(input, Array(input.size).fill(gradient[0]) as number[]),
    );
  }
  const normalizedAxis = axis < 0 ? input.rank + axis : axis;
  if (
    !Number.isInteger(normalizedAxis)
    || normalizedAxis < 0
    || normalizedAxis >= input.rank
  ) {
    throw new RangeError("sum axis is out of range");
  }
  const shape = input.shape.filter((_, index) => index !== normalizedAxis);
  const output = Array(sizeOf(shape)).fill(0) as number[];
  const outputIndices = input.data.map((_, index) => {
    const coords = coordinates(index, input.shape).filter(
      (_, coordinateAxis) => coordinateAxis !== normalizedAxis,
    );
    const outputIndex = flatIndexFor(coords, shape);
    output[outputIndex] = (output[outputIndex] as number) + (input.data[index] as number);
    return outputIndex;
  });
  return resultTensor(output, shape, [input], (gradient) => {
    addGradient(input, outputIndices.map((outputIndex) => gradient[outputIndex] as number));
  });
}

export function mean(value: TensorLike, axis: number | null = null): Tensor {
  const input = asTensor(value);
  const divisor = axis === null || input.rank === 0
    ? input.size
    : input.shape[axis < 0 ? input.rank + axis : axis] as number;
  return div(sum(input, axis), divisor);
}

export function dot(leftValue: TensorLike, rightValue: TensorLike): Tensor {
  const left = asTensor(leftValue);
  const right = asTensor(rightValue);
  if (left.rank !== 1 || right.rank !== 1 || left.shape[0] !== right.shape[0]) {
    throw new RangeError("dot requires vectors of equal length");
  }
  return sum(mul(left, right));
}

export function matmul(leftValue: TensorLike, rightValue: TensorLike): Tensor {
  const left = asTensor(leftValue);
  const right = asTensor(rightValue);
  if (left.rank === 1 && right.rank === 1) return dot(left, right);

  let rows: number;
  let inner: number;
  let columns: number;
  let outputShape: number[];
  if (left.rank === 2 && right.rank === 1) {
    rows = left.shape[0] as number;
    inner = left.shape[1] as number;
    if (right.shape[0] !== inner) {
      throw new RangeError("matmul inner dimensions must match");
    }
    columns = 1;
    outputShape = [rows];
  } else if (left.rank === 1 && right.rank === 2) {
    rows = 1;
    inner = left.shape[0] as number;
    if (right.shape[0] !== inner) {
      throw new RangeError("matmul inner dimensions must match");
    }
    columns = right.shape[1] as number;
    outputShape = [columns];
  } else if (left.rank === 2 && right.rank === 2) {
    rows = left.shape[0] as number;
    inner = left.shape[1] as number;
    if (right.shape[0] !== inner) {
      throw new RangeError("matmul inner dimensions must match");
    }
    columns = right.shape[1] as number;
    outputShape = [rows, columns];
  } else {
    throw new RangeError("matmul currently supports vectors and matrices");
  }

  const output = Array(rows * columns).fill(0) as number[];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (let index = 0; index < inner; index += 1) {
        const leftValueAtIndex = left.rank === 1
          ? left.data[index] as number
          : left.data[row * inner + index] as number;
        const rightValueAtIndex = right.rank === 1
          ? right.data[index] as number
          : right.data[index * columns + column] as number;
        const outputIndex = row * columns + column;
        output[outputIndex] = (output[outputIndex] as number)
          + leftValueAtIndex * rightValueAtIndex;
      }
    }
  }

  return resultTensor(output, outputShape, [left, right], (gradient) => {
    const leftGradient = Array(left.size).fill(0) as number[];
    const rightGradient = Array(right.size).fill(0) as number[];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const upstream = gradient[row * columns + column] as number;
        for (let index = 0; index < inner; index += 1) {
          const leftIndex = left.rank === 1 ? index : row * inner + index;
          const rightIndex = right.rank === 1 ? index : index * columns + column;
          leftGradient[leftIndex] = (leftGradient[leftIndex] as number)
            + upstream * (right.data[rightIndex] as number);
          rightGradient[rightIndex] = (rightGradient[rightIndex] as number)
            + upstream * (left.data[leftIndex] as number);
        }
      }
    }
    addGradient(left, leftGradient);
    addGradient(right, rightGradient);
  });
}

export function softmax(value: TensorLike, axis = -1): Tensor {
  const input = asTensor(value);
  if (input.rank === 0) return tensor(1);
  const normalizedAxis = axis < 0 ? input.rank + axis : axis;
  if (normalizedAxis !== input.rank - 1) {
    throw new RangeError("softmax currently operates on the last axis");
  }
  const width = input.shape[input.rank - 1] as number;
  const groups = input.size / width;
  const output = Array(input.size) as number[];
  for (let group = 0; group < groups; group += 1) {
    const offset = group * width;
    const maximum = Math.max(...input.data.slice(offset, offset + width));
    const weights = input.data
      .slice(offset, offset + width)
      .map((item) => Math.exp(item - maximum));
    const total = weights.reduce((totalWeight, item) => totalWeight + item, 0);
    weights.forEach((item, index) => {
      output[offset + index] = item / total;
    });
  }
  return resultTensor(output, input.shape, [input], (gradient) => {
    const inputGradient = Array(input.size) as number[];
    for (let group = 0; group < groups; group += 1) {
      const offset = group * width;
      let projection = 0;
      for (let index = 0; index < width; index += 1) {
        projection += (gradient[offset + index] as number) * (output[offset + index] as number);
      }
      for (let index = 0; index < width; index += 1) {
        inputGradient[offset + index] = (output[offset + index] as number)
          * ((gradient[offset + index] as number) - projection);
      }
    }
    addGradient(input, inputGradient);
  });
}

export const logSoftmax = (value: TensorLike, axis = -1): Tensor => log(softmax(value, axis));

export function embedding(tableValue: TensorLike, indices: readonly number[]): Tensor {
  const table = asTensor(tableValue);
  if (table.rank !== 2 || !Array.isArray(indices)) {
    throw new RangeError("embedding needs a rank-2 table and index array");
  }
  const width = table.shape[1] as number;
  const normalized = indices.map((index) => {
    if (!Number.isInteger(index) || index < 0 || index >= (table.shape[0] as number)) {
      throw new RangeError("embedding index is out of range");
    }
    return index;
  });
  const output = normalized.flatMap(
    (index) => table.data.slice(index * width, (index + 1) * width),
  );
  return resultTensor(output, [normalized.length, width], [table], (gradient) => {
    const tableGradient = Array(table.size).fill(0) as number[];
    normalized.forEach((tableIndex, row) => {
      for (let column = 0; column < width; column += 1) {
        const target = tableIndex * width + column;
        tableGradient[target] = (tableGradient[target] as number)
          + (gradient[row * width + column] as number);
      }
    });
    addGradient(table, tableGradient);
  });
}

export function weightedSum(statesValue: TensorLike, weightsValue: TensorLike): Tensor {
  const states = asTensor(statesValue);
  const weights = asTensor(weightsValue);
  if (states.rank !== 2 || weights.rank !== 1 || states.shape[0] !== weights.shape[0]) {
    throw new RangeError("weightedSum needs [items, width] states and [items] weights");
  }
  return matmul(transpose(states), weights);
}

export function nllLoss(
  probabilitiesValue: TensorLike,
  targetIndex: number,
  epsilon = 1e-12,
): Tensor {
  const probabilities = asTensor(probabilitiesValue);
  if (
    probabilities.rank !== 1
    || !Number.isInteger(targetIndex)
    || targetIndex < 0
    || targetIndex >= probabilities.size
  ) {
    throw new RangeError("nllLoss needs a probability vector and valid target index");
  }
  const rawProbability = probabilities.data[targetIndex] as number;
  const probability = Math.max(rawProbability, epsilon);
  return resultTensor([-Math.log(probability)], [], [probabilities], (gradient) => {
    const probabilityGradient = Array(probabilities.size).fill(0) as number[];
    if (rawProbability > epsilon) {
      probabilityGradient[targetIndex] = -(gradient[0] as number) / probability;
    }
    addGradient(probabilities, probabilityGradient);
  });
}

export const crossEntropy = (logits: TensorLike, targetIndex: number): Tensor => nllLoss(
  softmax(logits),
  targetIndex,
);

export function normalizeLayer(value: TensorLike, epsilon = 1e-5): Tensor {
  const input = asTensor(value);
  const average = mean(input, -1);
  const centered = sub(input, average);
  const variance = mean(pow(centered, 2), -1);
  return div(centered, pow(add(variance, epsilon), 0.5));
}

export function maskCausal(value: TensorLike, blockedValue = -Infinity): Tensor {
  const input = asTensor(value);
  if (input.rank !== 2 || input.shape[0] !== input.shape[1]) {
    throw new RangeError("maskCausal needs a square rank-2 tensor");
  }
  const width = input.shape[1] as number;
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

export function clip(value: TensorLike, minimum: number, maximum: number): Tensor {
  if (minimum > maximum) {
    throw new RangeError("clip minimum cannot exceed maximum");
  }
  return unary(
    value,
    (item) => Math.min(maximum, Math.max(minimum, item)),
    (item) => item >= minimum && item <= maximum ? 1 : 0,
  );
}

export function oneHot(index: number, width: number): Tensor {
  if (
    !Number.isInteger(index)
    || !Number.isInteger(width)
    || width < 1
    || index < 0
    || index >= width
  ) {
    throw new RangeError("oneHot needs a valid index and positive width");
  }
  const output = Array(width).fill(0) as number[];
  output[index] = 1;
  return tensor(output);
}

export function argmax(value: TensorLike): number {
  const input = asTensor(value);
  if (input.size === 0) throw new RangeError("argmax cannot inspect an empty tensor");
  return input.data.reduce(
    (best, item, index) => item > (input.data[best] as number) ? index : best,
    0,
  );
}

export function topK(value: TensorLike, count: number): TopKResult {
  const input = asTensor(value);
  if (input.rank !== 1 || !Number.isInteger(count) || count < 1 || count > input.size) {
    throw new RangeError("topK needs a vector and a valid count");
  }
  const ranked = input.data
    .map((item, index) => ({ value: item, index }))
    .sort((left, right) => right.value - left.value)
    .slice(0, count);
  return {
    values: ranked.map((item) => item.value),
    indices: ranked.map((item) => item.index),
  };
}

export function numel(value: Tensor | Shape): number {
  if (value instanceof Tensor) return value.size;
  assertShape(value);
  return sizeOf(value);
}

export function randn(shape: Shape, options: RandomOptions = {}): Tensor {
  assertShape(shape);
  let state = (options.seed ?? 1) >>> 0;
  const random = (): number => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state + 1) / 4294967297;
  };
  const scale = options.scale ?? 1;
  const output: number[] = [];
  while (output.length < sizeOf(shape)) {
    const radius = Math.sqrt(-2 * Math.log(random()));
    const angle = 2 * Math.PI * random();
    output.push(radius * Math.cos(angle) * scale);
    if (output.length < sizeOf(shape)) output.push(radius * Math.sin(angle) * scale);
  }
  return new Tensor(output, { shape, requiresGrad: options.requiresGrad ?? false });
}

export const toArray = (value: TensorLike): TensorData => asTensor(value).toArray();
