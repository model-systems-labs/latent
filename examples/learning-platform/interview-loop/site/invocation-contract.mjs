const safeStructuredClone = globalThis.structuredClone.bind(globalThis);
const objectFreeze = Object.freeze.bind(Object);
const objectIs = Object.is.bind(Object);
const reflectOwnKeys = Reflect.ownKeys.bind(Reflect);
const arrayIsArray = Array.isArray.bind(Array);
const arrayEvery = Function.call.bind(Array.prototype.every);
const arrayIncludes = Function.call.bind(Array.prototype.includes);

function isReference(value) {
  return Boolean(value) && (typeof value === "object" || typeof value === "function");
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!isReference(value) || seen.has(value)) return value;
  seen.add(value);
  for (const key of reflectOwnKeys(value)) deepFreeze(value[key], seen);
  return objectFreeze(value);
}

function collectReferences(value, references = new WeakSet()) {
  if (!isReference(value) || references.has(value)) return references;
  references.add(value);
  for (const key of reflectOwnKeys(value)) collectReferences(value[key], references);
  return references;
}

function containsReference(value, references, seen = new WeakSet()) {
  if (!isReference(value)) return false;
  if (references.has(value)) return true;
  if (seen.has(value)) return false;
  seen.add(value);
  return reflectOwnKeys(value).some((key) => containsReference(value[key], references, seen));
}

function deepEqual(left, right) {
  if (objectIs(left, right)) return true;
  if (!isReference(left) || !isReference(right)) return false;
  if (arrayIsArray(left) !== arrayIsArray(right)) return false;
  const leftKeys = reflectOwnKeys(left);
  const rightKeys = reflectOwnKeys(right);
  return leftKeys.length === rightKeys.length
    && arrayEvery(leftKeys, (key) => (
      arrayIncludes(rightKeys, key) && deepEqual(left[key], right[key])
    ));
}

export function createInvocationGuard(inputArgs) {
  if (!arrayIsArray(inputArgs)) throw new Error("Exercise arguments must be an array.");
  const args = safeStructuredClone(inputArgs);
  const snapshot = safeStructuredClone(args);
  const inputReferences = collectReferences(args);
  deepFreeze(args);
  return objectFreeze({
    args,
    assess(value) {
      return objectFreeze({
        inputUnchanged: deepEqual(snapshot, args),
        outputFresh: !containsReference(value, inputReferences),
      });
    },
  });
}
