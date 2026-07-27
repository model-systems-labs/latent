import { PythonLabClient } from "@latent/python-lab";

import {
  assessCase,
  serializedOutputBytes,
} from "../site/checker.mjs";
import { admitRuntimeLimits } from "../site/runtime-policy.mjs";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type RuntimeRequirement = {
  language: string;
  environment: string;
  engine: string;
  engineVersion: string;
  capabilities: string[];
  limits: {
    timeoutMs: number;
    maxOutputBytes: number;
  };
};

type ExerciseCase = {
  id: string;
  label: string;
  args?: JsonValue[];
  assertions?: {
    id: string;
    label: string;
    kind: string;
    expected: JsonValue;
  }[];
};

type RuntimeRequest = {
  source: string;
  path: string;
  entrypoint: {
    kind: string;
    functionName: string;
  };
  cases: ExerciseCase[];
  requirement: RuntimeRequirement;
  signal?: AbortSignal;
};

type PythonClient = Pick<
  PythonLabClient,
  "initialize" | "sync" | "run" | "dispose"
>;

type ReturnedObservation = {
  status: "returned";
  value: JsonValue;
  purity: {
    inputUnchanged: boolean;
    outputFresh: boolean;
  };
};

type ThrownObservation = {
  status: "threw";
  errorName: string;
  message: string;
};

type ObservationEnvelope = {
  caseId: string;
  observation: ReturnedObservation | ThrownObservation;
};

type RuntimeOptions = {
  createClient?: () => PythonClient;
};

export function createPythonInvocationHarness(
  path: string,
  functionName: string,
  cases: readonly ExerciseCase[],
): string {
  const payload = JSON.stringify({
    path,
    functionName,
    cases: cases.map((exerciseCase) => ({
      caseId: exerciseCase.id,
      args: exerciseCase.args ?? [],
    })),
  });
  return `import copy as _latent_copy
import json as _latent_json
import math as _latent_math
import runpy as _latent_runpy

_latent_payload = _latent_json.loads(${JSON.stringify(payload)})

def _latent_container_ids(value, found=None, seen=None):
    if found is None:
        found = set()
    if seen is None:
        seen = set()
    if not isinstance(value, (list, dict)):
        return found
    identity = id(value)
    if identity in seen:
        return found
    seen.add(identity)
    found.add(identity)
    items = value if isinstance(value, list) else value.values()
    for item in items:
        _latent_container_ids(item, found, seen)
    return found

def _latent_aliases_input(value, input_ids, seen=None):
    if seen is None:
        seen = set()
    if not isinstance(value, (list, tuple, dict)):
        return False
    identity = id(value)
    if identity in input_ids:
        return True
    if identity in seen:
        return False
    seen.add(identity)
    items = value if isinstance(value, (list, tuple)) else value.values()
    return any(_latent_aliases_input(item, input_ids, seen) for item in items)

def _latent_normalize(value, depth=0):
    if depth > 24:
        raise ValueError("returned value is nested too deeply")
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int):
        if abs(value) > 9007199254740991:
            raise ValueError("returned integer is outside the portable JSON range")
        return value
    if isinstance(value, float):
        if not _latent_math.isfinite(value):
            raise ValueError("returned number must be finite")
        return value
    if isinstance(value, (list, tuple)):
        return [_latent_normalize(item, depth + 1) for item in value]
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise TypeError("returned dictionaries must use string keys")
        return {
            key: _latent_normalize(item, depth + 1)
            for key, item in value.items()
        }
    raise TypeError(f"function returned unsupported {type(value).__name__}")

RESULT = []
for _latent_case in _latent_payload["cases"]:
    try:
        _latent_module = _latent_runpy.run_path(
            "/workspace/" + _latent_payload["path"],
            run_name="latent_interview_" + _latent_case["caseId"].replace("-", "_"),
        )
        _latent_function = _latent_module.get(_latent_payload["functionName"])
        if not callable(_latent_function):
            raise NameError("the requested function is not callable")
        _latent_args = _latent_case["args"]
        _latent_snapshot = _latent_copy.deepcopy(_latent_args)
        _latent_input_ids = _latent_container_ids(_latent_args)
        _latent_value = _latent_function(*_latent_args)
        _latent_purity = {
            "inputUnchanged": _latent_args == _latent_snapshot,
            "outputFresh": not _latent_aliases_input(
                _latent_value,
                _latent_input_ids,
            ),
        }
        _latent_observation = {
            "status": "returned",
            "value": _latent_normalize(_latent_value),
            "purity": _latent_purity,
        }
    except BaseException as _latent_error:
        _latent_observation = {
            "status": "threw",
            "errorName": type(_latent_error).__name__,
            "message": str(_latent_error)[:8192],
        }
    RESULT.append({
        "caseId": _latent_case["caseId"],
        "observation": _latent_observation,
    })
`;
}

function parseObservationEnvelopes(
  value: unknown,
  expectedCaseIds: readonly string[],
): ObservationEnvelope[] {
  if (!Array.isArray(value) || value.length !== expectedCaseIds.length) {
    throw new Error("CPython returned an incomplete case set.");
  }
  const envelopes = value.map((item): ObservationEnvelope => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("CPython returned an unreadable case result.");
    }
    const candidate = item as Record<string, unknown>;
    const observation = candidate.observation;
    if (
      typeof candidate.caseId !== "string"
      || !observation
      || typeof observation !== "object"
      || Array.isArray(observation)
    ) {
      throw new Error("CPython returned an unreadable case result.");
    }
    const parsed = observation as Record<string, unknown>;
    const purity = parsed.purity as Record<string, unknown> | undefined;
    if (
      parsed.status === "returned"
      && Object.hasOwn(parsed, "value")
      && typeof purity?.inputUnchanged === "boolean"
      && typeof purity.outputFresh === "boolean"
    ) {
      return {
        caseId: candidate.caseId,
        observation: {
          status: "returned",
          value: parsed.value as JsonValue,
          purity: {
            inputUnchanged: purity.inputUnchanged,
            outputFresh: purity.outputFresh,
          },
        },
      };
    }
    if (
      parsed.status === "threw"
      && typeof parsed.errorName === "string"
      && typeof parsed.message === "string"
    ) {
      return {
        caseId: candidate.caseId,
        observation: {
          status: "threw",
          errorName: parsed.errorName,
          message: parsed.message,
        },
      };
    }
    throw new Error("CPython returned an unreadable invocation observation.");
  });
  const returnedIds = envelopes.map((entry) => entry.caseId);
  if (
    new Set(returnedIds).size !== returnedIds.length
    || expectedCaseIds.some((id) => !returnedIds.includes(id))
  ) {
    throw new Error("CPython returned the wrong case identities.");
  }
  return envelopes;
}

export function supportsInterviewPython(
  requirement: RuntimeRequirement,
): boolean {
  return requirement.language === "python"
    && requirement.environment === "host-managed"
    && requirement.engine === "pyodide"
    && requirement.engineVersion === "314.0.2"
    && requirement.capabilities.includes("function");
}

export function createInterviewPythonRuntime(options: RuntimeOptions = {}) {
  const makeClient = options.createClient ?? (() => new PythonLabClient(
    () => new Worker(
      new URL("./python-exercise.worker.js", import.meta.url),
      { type: "module", name: "interview-loop-python" },
    ),
  ));

  return Object.freeze({
    supports: supportsInterviewPython,
    async run(request: RuntimeRequest) {
      if (!supportsInterviewPython(request.requirement)) {
        throw new Error("Interview Loop Lab supports only its pinned Python runtime.");
      }
      if (
        request.entrypoint.kind !== "function"
        || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.entrypoint.functionName)
      ) {
        throw new Error("The Python runner requires a named function entrypoint.");
      }
      if (!/^[A-Za-z0-9_-]+\.py$/.test(request.path)) {
        throw new Error("The Python runner requires one local .py source file.");
      }
      if (!request.cases.length) {
        throw new Error("This exercise has no cases to run.");
      }
      const limits = admitRuntimeLimits(request.requirement.limits);
      const client = makeClient();
      try {
        const operation = { signal: request.signal };
        const initialized = await client.initialize(
          { packages: [] },
          { ...operation, timeoutMs: 120_000 },
        );
        if (
          initialized.runtime !== "pyodide"
          || initialized.runtimeVersion !== "314.0.2"
          || initialized.guardrailsApplied !== true
          || initialized.capabilityReduced !== true
        ) {
          throw new Error("The pinned Python worker did not initialize safely.");
        }
        const synced = await client.sync({
          files: [{ path: request.path, contents: request.source }],
        }, { ...operation, timeoutMs: 10_000 });
        if (!synced.files.includes(request.path)) {
          throw new Error("The Python worker did not receive the submitted source.");
        }
        const run = await client.run({
          code: createPythonInvocationHarness(
            request.path,
            request.entrypoint.functionName,
            request.cases,
          ),
        }, {
          ...operation,
          timeoutMs: limits.timeoutMs,
        });
        if (run.status !== "completed") {
          throw new Error(
            run.exception?.message
              || "The Python worker stopped before checking the cases.",
          );
        }
        const expectedCaseIds = request.cases.map((exerciseCase) => (
          exerciseCase.id
        ));
        const envelopes = parseObservationEnvelopes(
          run.result,
          expectedCaseIds,
        );
        const observationByCase = new Map(envelopes.map((entry) => (
          [entry.caseId, entry.observation]
        )));
        const results = request.cases.map((exerciseCase) => {
          const observation = observationByCase.get(exerciseCase.id);
          if (!observation) {
            throw new Error(`CPython omitted ${exerciseCase.id}.`);
          }
          if (observation.status === "threw") {
            return Object.freeze({
              id: exerciseCase.id,
              label: exerciseCase.label,
              passed: false,
              assertions: Object.freeze([Object.freeze({
                id: "platform-execution",
                label: "returns normally",
                passed: false,
                expected: "a returned value",
                actual: `${observation.errorName}: ${observation.message}`,
              })]),
            });
          }
          return assessCase(
            exerciseCase,
            observation.value,
            observation.purity,
          );
        });
        if (serializedOutputBytes(results) > limits.maxOutputBytes) {
          throw new Error("The Python check result exceeded its declared output limit.");
        }
        return results;
      } finally {
        client.dispose();
      }
    },
  });
}

export const interviewPythonRuntime = createInterviewPythonRuntime();
