"use client";

import { evaluateExerciseCase } from "@latent/browser-lab/contracts";
import type {
  ExerciseCaseResult,
  ExerciseContract,
  InvocationObservation,
  JsonValue,
} from "@latent/browser-lab";
import type {
  PythonLabClient,
  PythonLabEvent,
  PythonLabInitializeResult,
  PythonLabRunResult,
  PythonLabSyncResult,
} from "@latent/python-lab";
import type { ProjectUnitResult } from "../../lib/project-workspace";
import { formatPracticeContractDetail } from "./practice-feedback";

type PythonLessonClient = Pick<PythonLabClient, "initialize" | "sync" | "run">;

export type PythonLessonContractRun = {
  cases: ExerciseCaseResult[];
  results: ProjectUnitResult[];
  output: PythonLessonOutputChunk[];
  stdout: string;
  stderr: string;
  startedAt: number;
  completedAt: number;
};

export type PythonLessonOutputChunk = {
  stream: "stdout" | "stderr";
  text: string;
};

type PythonObservationEnvelope = {
  contractId: string;
  caseId: string;
  observation: InvocationObservation;
};

let sharedClientPromise: Promise<PythonLessonClient> | undefined;

async function sharedClient(): Promise<PythonLessonClient> {
  sharedClientPromise ??= import("@latent/python-lab").then(({ PythonLabClient }) => new PythonLabClient());
  return sharedClientPromise;
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

function invocationHarness(path: string, contracts: readonly ExerciseContract[]): string {
  const payload = JSON.stringify({
    path,
    cases: contracts.flatMap((contract) => contract.cases.map((exerciseCase) => ({
      contractId: contract.id,
      caseId: exerciseCase.id,
      exportName: exerciseCase.invoke.exportName,
      args: exerciseCase.invoke.args,
    }))),
  });
  return `import json as _latent_json
import math as _latent_math
import runpy as _latent_runpy

_latent_payload = _latent_json.loads(${pythonString(payload)})

def _latent_restore(value):
    if isinstance(value, list):
        return [_latent_restore(item) for item in value]
    if isinstance(value, dict):
        if value == {"$number": "-Infinity"}:
            return float("-inf")
        if value == {"$number": "Infinity"}:
            return float("inf")
        if value == {"$number": "NaN"}:
            return float("nan")
        return {key: _latent_restore(item) for key, item in value.items()}
    return value

def _latent_normalize(value, depth=0):
    if depth > 24:
        raise ValueError("returned value is nested too deeply")
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if _latent_math.isnan(value):
            return {"$number": "NaN"}
        if value == float("inf"):
            return {"$number": "Infinity"}
        if value == float("-inf"):
            return {"$number": "-Infinity"}
        return value
    if isinstance(value, (list, tuple)):
        return [_latent_normalize(item, depth + 1) for item in value]
    if isinstance(value, dict):
        return {str(key): _latent_normalize(item, depth + 1) for key, item in value.items()}
    if hasattr(value, "tolist"):
        return _latent_normalize(value.tolist(), depth + 1)
    if hasattr(value, "item"):
        return _latent_normalize(value.item(), depth + 1)
    raise TypeError(f"function returned unsupported {type(value).__name__}")

RESULT = []
for _latent_case in _latent_payload["cases"]:
    try:
        _latent_module = _latent_runpy.run_path(
            "/workspace/" + _latent_payload["path"],
            run_name="latent_contract_" + _latent_case["caseId"].replace("-", "_"),
        )
        _latent_function = _latent_module.get(_latent_case["exportName"])
        if not callable(_latent_function):
            raise NameError(f"define {_latent_case['exportName']} as a callable function")
        _latent_value = _latent_function(*_latent_restore(_latent_case["args"]))
        _latent_observation = {"status": "returned", "value": _latent_normalize(_latent_value)}
    except BaseException as _latent_error:
        _latent_observation = {
            "status": "threw",
            "errorName": type(_latent_error).__name__,
            "message": str(_latent_error)[:8192],
        }
    RESULT.append({
        "contractId": _latent_case["contractId"],
        "caseId": _latent_case["caseId"],
        "observation": _latent_observation,
    })
`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 24) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function parseObservation(value: unknown): InvocationObservation | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "returned" && isJsonValue(value.value)) {
    return { status: "returned", value: value.value };
  }
  if (value.status === "threw" && typeof value.errorName === "string" && typeof value.message === "string") {
    return { status: "threw", errorName: value.errorName, message: value.message };
  }
  return null;
}

function parseEnvelopes(value: unknown): PythonObservationEnvelope[] {
  if (!Array.isArray(value)) throw new Error("CPython returned an invalid contract result.");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.contractId !== "string" || typeof item.caseId !== "string") {
      throw new Error("CPython returned an unidentified contract result.");
    }
    const observation = parseObservation(item.observation);
    if (!observation) throw new Error(`CPython returned an invalid observation for ${item.contractId}/${item.caseId}.`);
    return { contractId: item.contractId, caseId: item.caseId, observation };
  });
}

function failedResults(contracts: readonly ExerciseContract[], detail: string): ProjectUnitResult[] {
  return contracts.map((contract) => ({
    id: contract.id,
    path: contract.cases[0]?.invoke.modulePath ?? "unknown",
    label: contract.label,
    passed: false,
    detail,
  }));
}

export async function runPythonLessonContracts(input: {
  path: string;
  source: string;
  contracts: readonly ExerciseContract[];
  signal?: AbortSignal;
  onEvent?: (event: PythonLabEvent) => void;
  pythonLab?: PythonLessonClient;
}): Promise<PythonLessonContractRun> {
  if (!input.path.endsWith(".py")) throw new Error("CPython lesson contracts require a .py project file.");
  if (!input.contracts.length) throw new Error("The requested Python lesson contract is unavailable.");
  if (input.contracts.some((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath !== input.path))) {
    throw new Error("The Python lesson contract does not belong to this project file.");
  }
  const startedAt = Date.now();
  const pythonLab = input.pythonLab ?? await sharedClient();
  const operation = { signal: input.signal, onEvent: input.onEvent };
  const output: PythonLessonOutputChunk[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const appendOutput = (stream: PythonLessonOutputChunk["stream"], text: string) => {
    const previous = output[output.length - 1];
    if (previous?.stream === stream) previous.text += text;
    else output.push({ stream, text });
  };
  const runOperation = {
    signal: input.signal,
    timeoutMs: 30_000,
    onEvent: (event: PythonLabEvent) => {
      if (event.type === "stdout" || event.type === "stderr") {
        appendOutput(event.type, event.text);
        (event.type === "stdout" ? stdout : stderr).push(event.text);
      }
      input.onEvent?.(event);
    },
  };
  let initialization: PythonLabInitializeResult;
  let sync: PythonLabSyncResult;
  let run: PythonLabRunResult;
  try {
    initialization = await pythonLab.initialize({ packages: ["numpy"] }, operation);
    sync = await pythonLab.sync({ files: [{ path: input.path, contents: input.source }] }, operation);
    run = await pythonLab.run({ code: invocationHarness(input.path, input.contracts) }, runOperation);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The CPython lesson worker failed.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  if (initialization.runtime !== "pyodide" || !sync.files.includes(input.path)) {
    return { cases: [], results: failedResults(input.contracts, "The CPython workspace did not synchronize this lesson."), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  if (run.status === "failed") {
    const detail = run.exception?.message || "The CPython contract harness failed.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  let envelopes: PythonObservationEnvelope[];
  try {
    envelopes = parseEnvelopes(run.result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "CPython returned unreadable contract evidence.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  const envelopeByCase = new Map(envelopes.map((item) => [`${item.contractId}/${item.caseId}`, item.observation]));
  const cases = input.contracts.flatMap((contract) => contract.cases.map((exerciseCase) => {
    const observation = envelopeByCase.get(`${contract.id}/${exerciseCase.id}`) ?? {
      status: "harness-error" as const,
      message: "CPython did not return this case.",
    };
    return evaluateExerciseCase(contract, exerciseCase, observation);
  }));
  const results = input.contracts.map((contract): ProjectUnitResult => {
    const contractCases = cases.filter((result) => result.contractId === contract.id);
    return {
      id: contract.id,
      path: contract.cases[0]?.invoke.modulePath ?? input.path,
      label: contract.label,
      passed: contractCases.length === contract.cases.length && contractCases.every((result) => result.passed),
      detail: formatPracticeContractDetail(contractCases),
    };
  });
  return { cases, results, output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
}
