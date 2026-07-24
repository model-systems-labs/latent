import { BrowserLabError } from "./errors";
import type {
  AssertionResult,
  ExerciseCase,
  ExerciseCaseResult,
  ExerciseContract,
  HostAssertion,
  InvocationObservation,
  JsonValue,
  ValuePath,
} from "./types";

function deepEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]
      && deepEqual(left[key], right[key]));
  }
  return false;
}

function valueAtPath(root: JsonValue, path: ValuePath = []): { found: true; value: JsonValue } | { found: false } {
  let current: JsonValue = root;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || !Number.isSafeInteger(segment) || segment < 0 || segment >= current.length) return { found: false };
      current = current[segment];
    } else {
      if (!current || Array.isArray(current) || typeof current !== "object" || !Object.hasOwn(current, segment)) return { found: false };
      current = current[segment];
    }
  }
  return { found: true, value: current };
}

function actualType(value: JsonValue): "null" | "array" | "object" | "string" | "number" | "boolean" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "object" | "string" | "number" | "boolean";
}

function pathLabel(path?: ValuePath): string {
  if (!path?.length) return "the returned value";
  return `the value at ${path.map((segment) => typeof segment === "number" ? `[${segment}]` : `.${segment}`).join("").replace(/^\./, "")}`;
}

function fail(assertion: HostAssertion, detail: string): AssertionResult {
  return { assertionId: assertion.id, label: assertion.label, passed: false, detail };
}

function pass(assertion: HostAssertion, detail: string): AssertionResult {
  return { assertionId: assertion.id, label: assertion.label, passed: true, detail };
}

export function validateExerciseContract(contract: ExerciseContract): void {
  if (!contract.id.trim() || !contract.cases.length) throw new BrowserLabError("INVALID_CONTRACT", "Every exercise contract needs an id and at least one case.");
  const caseIds = new Set<string>();
  for (const exerciseCase of contract.cases) {
    if (!exerciseCase.id.trim() || caseIds.has(exerciseCase.id) || !exerciseCase.assertions.length) {
      throw new BrowserLabError("INVALID_CASE", `Contract ${contract.id} contains an empty, duplicate, or assertion-free case.`);
    }
    caseIds.add(exerciseCase.id);
    if (!exerciseCase.invoke.exportName.match(/^[A-Za-z_$][\w$]*$/)) {
      throw new BrowserLabError("INVALID_EXPORT", `Contract ${contract.id} requests an unsafe export name.`);
    }
    const assertionIds = new Set<string>();
    for (const assertion of exerciseCase.assertions) {
      if (!assertion.id.trim() || assertionIds.has(assertion.id)) throw new BrowserLabError("INVALID_ASSERTION", `Case ${exerciseCase.id} has an empty or duplicate assertion id.`);
      assertionIds.add(assertion.id);
      if (assertion.kind === "range" && (!Number.isFinite(assertion.minimum) || !Number.isFinite(assertion.maximum) || assertion.minimum > assertion.maximum)) {
        throw new BrowserLabError("INVALID_ASSERTION", `Case ${exerciseCase.id} has an invalid numeric range.`);
      }
      if (assertion.kind === "matches" && assertion.pattern.length > 500) throw new BrowserLabError("INVALID_ASSERTION", "Regular-expression assertions are limited to 500 characters.");
      if (
        assertion.kind === "throws"
        && assertion.messagePattern !== undefined
        && assertion.messagePattern.length > 500
      ) {
        throw new BrowserLabError("INVALID_ASSERTION", "Exception-message assertions are limited to 500 characters.");
      }
    }
  }
}

export function evaluateHostAssertion(assertion: HostAssertion, observation: InvocationObservation): AssertionResult {
  if (assertion.kind === "throws") {
    if (observation.status !== "threw") return fail(assertion, `Expected the invocation to throw, but it ${observation.status}.`);
    if (assertion.errorName && observation.errorName !== assertion.errorName) {
      return fail(assertion, `Expected ${assertion.errorName}, but the invocation raised ${observation.errorName}.`);
    }
    if (assertion.messagePattern !== undefined) {
      let matched = false;
      try {
        matched = new RegExp(assertion.messagePattern).test(observation.message);
      } catch {
        return fail(assertion, "The course-authored exception-message pattern is invalid.");
      }
      if (!matched) return fail(assertion, "The exception message did not match the required pattern.");
    }
    if (assertion.errorName && assertion.messagePattern !== undefined) {
      return pass(assertion, `The invocation raised ${assertion.errorName} with the expected message.`);
    }
    if (assertion.errorName) return pass(assertion, `The invocation raised ${assertion.errorName}.`);
    if (assertion.messagePattern !== undefined) return pass(assertion, "The invocation threw with the expected message.");
    return pass(assertion, "The invocation threw as expected.");
  }
  if (observation.status !== "returned") {
    const exception = observation.status === "threw" && observation.message
      ? `: ${observation.message}`
      : ".";
    return fail(assertion, `Could not inspect ${pathLabel(assertion.path)} because the invocation ${observation.status}${exception}`);
  }
  const selected = valueAtPath(observation.value, assertion.path);
  if (!selected.found) return fail(assertion, `Could not find ${pathLabel(assertion.path)}.`);
  const value = selected.value;
  switch (assertion.kind) {
    case "deep-equal":
      return deepEqual(value, assertion.expected)
        ? pass(assertion, `${pathLabel(assertion.path)} matched the expected value.`)
        : fail(assertion, `${pathLabel(assertion.path)} did not match the expected value.`);
    case "type":
      return actualType(value) === assertion.expected
        ? pass(assertion, `${pathLabel(assertion.path)} is ${assertion.expected}.`)
        : fail(assertion, `${pathLabel(assertion.path)} is ${actualType(value)}, not ${assertion.expected}.`);
    case "truthy":
      return value ? pass(assertion, `${pathLabel(assertion.path)} is truthy.`) : fail(assertion, `${pathLabel(assertion.path)} is not truthy.`);
    case "finite":
      return typeof value === "number" && Number.isFinite(value)
        ? pass(assertion, `${pathLabel(assertion.path)} is finite.`)
        : fail(assertion, `${pathLabel(assertion.path)} is not a finite number.`);
    case "range":
      return typeof value === "number" && Number.isFinite(value) && value >= assertion.minimum && value <= assertion.maximum
        ? pass(assertion, `${pathLabel(assertion.path)} is within ${assertion.minimum}–${assertion.maximum}.`)
        : fail(assertion, `${pathLabel(assertion.path)} is outside ${assertion.minimum}–${assertion.maximum}.`);
    case "length": {
      const length = typeof value === "string" || Array.isArray(value) ? value.length : null;
      return length === assertion.expected
        ? pass(assertion, `${pathLabel(assertion.path)} has length ${assertion.expected}.`)
        : fail(assertion, `${pathLabel(assertion.path)} has ${length === null ? "no length" : `length ${length}`}, not ${assertion.expected}.`);
    }
    case "includes": {
      const included = typeof value === "string" && typeof assertion.expected === "string"
        ? value.includes(assertion.expected)
        : Array.isArray(value) && value.some((item) => deepEqual(item, assertion.expected));
      return included ? pass(assertion, `${pathLabel(assertion.path)} contains the expected value.`) : fail(assertion, `${pathLabel(assertion.path)} does not contain the expected value.`);
    }
    case "matches": {
      if (typeof value !== "string") return fail(assertion, `${pathLabel(assertion.path)} is not a string.`);
      let matched = false;
      try { matched = new RegExp(assertion.pattern, assertion.flags).test(value); } catch { return fail(assertion, "The course-authored regular expression is invalid."); }
      return matched ? pass(assertion, `${pathLabel(assertion.path)} matches the required pattern.`) : fail(assertion, `${pathLabel(assertion.path)} does not match the required pattern.`);
    }
  }
}

export function evaluateExerciseCase(contract: ExerciseContract, exerciseCase: ExerciseCase, observation: InvocationObservation): ExerciseCaseResult {
  const assertions = exerciseCase.assertions.map((assertion) => evaluateHostAssertion(assertion, observation));
  const passed = assertions.every((assertion) => assertion.passed);
  return {
    contractId: contract.id,
    contractLabel: contract.label,
    caseId: exerciseCase.id,
    caseLabel: exerciseCase.label,
    observationStatus: observation.status,
    passed,
    detail: passed ? "All host-owned assertions passed." : `${assertions.filter((assertion) => !assertion.passed).length} host-owned assertion${assertions.filter((assertion) => !assertion.passed).length === 1 ? "" : "s"} failed.`,
    assertions,
    observation,
  };
}
