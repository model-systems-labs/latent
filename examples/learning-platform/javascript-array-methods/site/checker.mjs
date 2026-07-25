const objectIs = Object.is.bind(Object);
const objectKeys = Object.keys.bind(Object);
const arrayIsArray = Array.isArray.bind(Array);
const arrayEvery = Function.call.bind(Array.prototype.every);
const arrayIncludes = Function.call.bind(Array.prototype.includes);
const jsonStringify = JSON.stringify.bind(JSON);
const encode = TextEncoder.prototype.encode.call.bind(TextEncoder.prototype.encode);
const textEncoder = new TextEncoder();

function deepEqual(left, right) {
  if (objectIs(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (arrayIsArray(left) !== arrayIsArray(right)) return false;
  const leftKeys = objectKeys(left);
  const rightKeys = objectKeys(right);
  return leftKeys.length === rightKeys.length
    && arrayEvery(leftKeys, (key) => (
      arrayIncludes(rightKeys, key) && deepEqual(left[key], right[key])
    ));
}

export function serializedOutputBytes(value) {
  const serialized = jsonStringify(value);
  return serialized === undefined ? 0 : encode(textEncoder, serialized).byteLength;
}

export function assessCase(exerciseCase, value) {
  const assertions = [];
  for (const assertion of exerciseCase.assertions ?? []) {
    assertions.push(Object.freeze({
      id: assertion.id,
      label: assertion.label,
      passed: assertion.kind === "deep-equal" && deepEqual(value, assertion.expected),
      expected: assertion.expected,
      actual: value,
    }));
  }
  return Object.freeze({
    id: exerciseCase.id,
    label: exerciseCase.label,
    passed: assertions.length > 0 && arrayEvery(assertions, (assertion) => assertion.passed),
    assertions: Object.freeze(assertions),
  });
}
