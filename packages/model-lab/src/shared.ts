export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function zeros(rows: number, columns: number) {
  return Array.from({ length: rows }, () => Array(columns).fill(0) as number[]);
}

export function randomMatrix(rows: number, columns: number, random: () => number, scale = 0.08) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => (random() * 2 - 1) * scale),
  );
}

export function softmax(logits: number[]) {
  const maximum = Math.max(...logits);
  const weights = logits.map((value) => Math.exp(value - maximum));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

export function sampleIndex(probabilities: number[], random: () => number) {
  let threshold = random();
  for (let index = 0; index < probabilities.length; index += 1) {
    threshold -= probabilities[index];
    if (threshold <= 0) return index;
  }
  return probabilities.length - 1;
}

export function integerInRange(value: number, label: string, minimum: number, maximum: number) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be a safe integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function finiteInRange(value: number, label: string, minimumExclusive: number, maximum: number) {
  if (!Number.isFinite(value) || value <= minimumExclusive || value > maximum) {
    throw new RangeError(`${label} must be finite, greater than ${minimumExclusive}, and at most ${maximum}.`);
  }
  return value;
}
