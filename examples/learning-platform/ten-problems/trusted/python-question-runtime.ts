import { evaluateExerciseCase } from "@latent/browser-lab/contracts";
import { PythonLabClient } from "@latent/python-lab";
import { adaptPracticeQuestion } from "../../../../app/features/practice/question-adapter";
import type { JsonValue } from "@latent/browser-lab";
import type {
  PracticeQuestion,
  QuestionGroupRuntimeRequirement,
} from "@latent/course-kit";

type RuntimeRequest = {
  question: PracticeQuestion;
  runtime: QuestionGroupRuntimeRequirement;
  contractVersion: string;
  source: string;
  mode: "examples" | "check";
  signal?: AbortSignal;
};

type PythonClient = Pick<
  PythonLabClient,
  "initialize" | "sync" | "run" | "dispose"
>;

type ObservationEnvelope = {
  caseId: string;
  observation:
    | { status: "returned"; value: JsonValue }
    | { status: "threw"; errorName: string; message: string };
};

type RuntimeOptions = {
  assetRoot: string;
  createClient?: () => PythonClient;
};

function invocationHarness(path: string, exportName: string, cases: readonly {
  id: string;
  invoke: {
    args: readonly JsonValue[];
  };
}[]): string {
  const payload = JSON.stringify({
    path,
    exportName,
    cases: cases.map((exerciseCase) => ({
      caseId: exerciseCase.id,
      args: exerciseCase.invoke.args,
    })),
  });
  return `import json as _latent_json
import math as _latent_math
import runpy as _latent_runpy

_latent_payload = _latent_json.loads(${JSON.stringify(payload)})

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
        return {key: _latent_normalize(item, depth + 1) for key, item in value.items()}
    raise TypeError(f"function returned unsupported {type(value).__name__}")

RESULT = []
for _latent_case in _latent_payload["cases"]:
    try:
        _latent_module = _latent_runpy.run_path(
            "/workspace/" + _latent_payload["path"],
            run_name="latent_question_" + _latent_case["caseId"].replace("-", "_"),
        )
        _latent_function = _latent_module.get(_latent_payload["exportName"])
        if not callable(_latent_function):
            raise NameError("the requested function is not callable")
        _latent_value = _latent_function(*_latent_case["args"])
        _latent_observation = {
            "status": "returned",
            "value": _latent_normalize(_latent_value),
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
    if (parsed.status === "returned" && Object.hasOwn(parsed, "value")) {
      return {
        caseId: candidate.caseId,
        observation: {
          status: "returned",
          value: parsed.value as JsonValue,
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

function supportsPython(requirement: QuestionGroupRuntimeRequirement): boolean {
  return requirement.language === "python"
    && requirement.environment === "host-managed"
    && requirement.engine === "pyodide"
    && requirement.engineVersion === "314.0.2"
    && requirement.capabilities.includes("function");
}

export function createPythonQuestionRuntime(options: RuntimeOptions) {
  const makeClient = options.createClient ?? (() => new PythonLabClient(
    () => new Worker(
      `${options.assetRoot}python-question.worker.js`,
      { type: "module", name: "ten-problems-python" },
    ),
  ));

  return Object.freeze({
    supports: supportsPython,
    async run(request: RuntimeRequest) {
      if (!supportsPython(request.runtime)) {
        throw new Error("This practice site supports only its pinned Python runtime.");
      }
      const selectedCases = request.mode === "examples"
        ? request.question.cases.filter((exerciseCase) => (
          exerciseCase.visibility === "example"
        ))
        : [...request.question.cases];
      if (!selectedCases.length) {
        throw new Error("This problem has no cases for the selected run.");
      }
      const scopedQuestion = { ...request.question, cases: selectedCases };
      const adapted = adaptPracticeQuestion(
        scopedQuestion,
        request.source,
        { contractId: request.contractVersion },
      );
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
          files: [{ path: adapted.path, contents: adapted.source }],
        }, { ...operation, timeoutMs: 10_000 });
        if (!synced.files.includes(adapted.path)) {
          throw new Error("The Python worker did not receive the submitted source.");
        }
        const run = await client.run({
          code: invocationHarness(
            adapted.path,
            adapted.exportName,
            adapted.contract.cases,
          ),
        }, {
          ...operation,
          timeoutMs: request.runtime.limits.timeoutMs,
        });
        if (run.status !== "completed") {
          throw new Error(
            run.exception?.message || "The Python worker stopped before checking the cases.",
          );
        }
        const expectedCaseIds = adapted.contract.cases.map((entry) => entry.id);
        const envelopes = parseObservationEnvelopes(
          run.result,
          expectedCaseIds,
        );
        const observationByCase = new Map(envelopes.map((entry) => (
          [entry.caseId, entry.observation]
        )));
        const cases = adapted.contract.cases.map((exerciseCase) => {
          const observation = observationByCase.get(exerciseCase.id);
          if (!observation) {
            throw new Error(`CPython omitted ${exerciseCase.id}.`);
          }
          const result = evaluateExerciseCase(
            adapted.contract,
            exerciseCase,
            observation,
          );
          const authoredCase = selectedCases.find((candidate) => (
            candidate.id === result.caseId
          ));
          return {
            id: result.caseId,
            label: result.caseLabel,
            passed: result.passed,
            input: authoredCase?.args ?? [],
            expected: authoredCase?.assertions.map((assertion) => (
              "expected" in assertion ? assertion.expected : assertion.label
            )) ?? [],
            actual: observation.status === "returned"
              ? observation.value
              : {
                  errorName: observation.errorName,
                  message: observation.message,
                },
            assertions: result.assertions.map((assertion) => ({
              id: assertion.assertionId,
              label: assertion.label,
              passed: assertion.passed,
              detail: assertion.detail,
            })),
          };
        });
        const outcome = {
          passed: cases.every((exerciseCase) => exerciseCase.passed),
          cases,
        };
        const outputBytes = new TextEncoder().encode(
          JSON.stringify(outcome),
        ).byteLength;
        if (outputBytes > request.runtime.limits.maxOutputBytes) {
          throw new Error("The Python check result exceeded its declared output limit.");
        }
        return outcome;
      } finally {
        client.dispose();
      }
    },
  });
}

declare global {
  // The static Question Group player reads this reviewed host adapter.
  // Portable JSON cannot assign or replace it.
  var LatentQuestionPlayerRuntime: ReturnType<
    typeof createPythonQuestionRuntime
  > | undefined;
}

if (typeof document !== "undefined") {
  const assetRoot = document.body?.dataset.assetRoot;
  if (typeof assetRoot !== "string") {
    throw new Error("The practice site did not declare its trusted asset root.");
  }
  globalThis.LatentQuestionPlayerRuntime = createPythonQuestionRuntime({
    assetRoot,
  });
}
