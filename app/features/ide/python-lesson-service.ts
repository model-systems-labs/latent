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
import type { ProjectUnitResult } from "@/app/lib/project-workspace";
import { formatPracticeContractDetail } from "@/app/features/ide/practice-feedback";

export type PythonLessonClient = Pick<PythonLabClient, "initialize" | "sync" | "run">;

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

const sharedClientPromises = new Map<string, Promise<PythonLessonClient>>();

async function sharedClient(packages: readonly string[], scope = "lesson"): Promise<PythonLessonClient> {
  const profile = `${scope}:${[...packages].sort().join(",") || "stdlib"}`;
  let client = sharedClientPromises.get(profile);
  if (!client) {
    client = import("@latent/python-lab").then(({ PythonLabClient }) => new PythonLabClient());
    sharedClientPromises.set(profile, client);
  }
  return client;
}

export function pythonLessonPackages(source: string): Array<"numpy"> {
  return /(?:^|\n)\s*(?:import\s+numpy\b|from\s+numpy\b)/m.test(source) ? ["numpy"] : [];
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

function projectInvocationHarness(contracts: readonly ExerciseContract[]): string {
  const payload = JSON.stringify({
    cases: contracts.flatMap((contract) => contract.cases.map((exerciseCase) => ({
      contractId: contract.id,
      caseId: exerciseCase.id,
      modulePath: exerciseCase.invoke.modulePath,
      exportName: exerciseCase.invoke.exportName,
      args: exerciseCase.invoke.args,
    }))),
  });
  return `import importlib as _latent_importlib
import json as _latent_json
import math as _latent_math
import os as _latent_os
import runpy as _latent_runpy
import sys as _latent_sys

_latent_payload = _latent_json.loads(${pythonString(payload)})
_latent_sys.dont_write_bytecode = True
if "/workspace" not in _latent_sys.path:
    _latent_sys.path.insert(0, "/workspace")

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

def _latent_clear_workspace_modules():
    for name, module in list(_latent_sys.modules.items()):
        source = getattr(module, "__file__", "") or ""
        if source.startswith("/workspace/"):
            del _latent_sys.modules[name]
    _latent_importlib.invalidate_caches()

RESULT = []
for _latent_case in _latent_payload["cases"]:
    try:
        _latent_clear_workspace_modules()
        _latent_module = _latent_runpy.run_path(
            "/workspace/" + _latent_case["modulePath"],
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

function projectFunctionHarness(path: string, exportName: string, args: readonly JsonValue[]): string {
  const payload = JSON.stringify({ path, exportName, args });
  return `import importlib as _latent_importlib
import json as _latent_json
import math as _latent_math
import runpy as _latent_runpy
import sys as _latent_sys

_latent_payload = _latent_json.loads(${pythonString(payload)})
_latent_sys.dont_write_bytecode = True
if "/workspace" not in _latent_sys.path:
    _latent_sys.path.insert(0, "/workspace")

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
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int):
        if abs(value) > 9007199254740991:
            raise ValueError("returned integer is outside JavaScript's safe range")
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
        if not all(isinstance(key, str) for key in value):
            raise TypeError("returned dictionaries must use string keys")
        return {key: _latent_normalize(item, depth + 1) for key, item in value.items()}
    if hasattr(value, "tolist"):
        return _latent_normalize(value.tolist(), depth + 1)
    if hasattr(value, "item"):
        return _latent_normalize(value.item(), depth + 1)
    raise TypeError(f"function returned unsupported {type(value).__name__}")

for _latent_name, _latent_module in list(_latent_sys.modules.items()):
    _latent_source = getattr(_latent_module, "__file__", "") or ""
    if _latent_source.startswith("/workspace/"):
        del _latent_sys.modules[_latent_name]
_latent_importlib.invalidate_caches()

try:
    _latent_module = _latent_runpy.run_path(
        "/workspace/" + _latent_payload["path"],
        run_name="latent_project_invocation",
    )
    _latent_function = _latent_module.get(_latent_payload["exportName"])
    if not callable(_latent_function):
        raise NameError(f"define {_latent_payload['exportName']} as a callable function")
    _latent_value = _latent_function(*_latent_restore(_latent_payload["args"]))
    RESULT = {"status": "returned", "value": _latent_normalize(_latent_value)}
except BaseException as _latent_error:
    RESULT = {
        "status": "threw",
        "errorName": type(_latent_error).__name__,
        "message": str(_latent_error)[:8192],
    }
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

function isInvocationJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 24) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (Array.isArray(value)) return value.every((item) => isInvocationJsonValue(item, depth + 1));
  return isRecord(value) && Object.values(value).every((item) => isInvocationJsonValue(item, depth + 1));
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
  if (!Array.isArray(value)) throw new Error("CPython returned a check result Latent couldn’t read.");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.contractId !== "string" || typeof item.caseId !== "string") {
      throw new Error("CPython returned a check result without an id.");
    }
    const observation = parseObservation(item.observation);
    if (!observation) throw new Error(`CPython returned an unreadable result for ${item.contractId}/${item.caseId}.`);
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
  supportFiles?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  onEvent?: (event: PythonLabEvent) => void;
  pythonLab?: PythonLessonClient;
}): Promise<PythonLessonContractRun> {
  if (!input.path.endsWith(".py")) throw new Error("CPython lesson checks need a .py project file.");
  if (!input.contracts.length) throw new Error("That Python lesson check isn’t available.");
  if (input.contracts.some((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath !== input.path))) {
    throw new Error("That Python lesson check doesn’t belong to this project file.");
  }
  const startedAt = Date.now();
  const syncedFiles = { ...input.supportFiles, [input.path]: input.source };
  const packages = pythonLessonPackages(Object.values(syncedFiles).join("\n"));
  const pythonLab = input.pythonLab ?? await sharedClient(packages);
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
    initialization = await pythonLab.initialize({ packages }, operation);
    sync = await pythonLab.sync({
      files: Object.entries(syncedFiles).map(([path, contents]) => ({ path, contents })),
    }, operation);
    run = await pythonLab.run({
      code: input.supportFiles ? projectInvocationHarness(input.contracts) : invocationHarness(input.path, input.contracts),
    }, runOperation);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The CPython lesson worker stopped with an error.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  if (initialization.runtime !== "pyodide" || !sync.files.includes(input.path)) {
    return { cases: [], results: failedResults(input.contracts, "The CPython workspace didn’t sync this lesson."), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  if (run.status === "failed") {
    const detail = run.exception?.message || "The CPython check runner stopped with an error.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  let envelopes: PythonObservationEnvelope[];
  try {
    envelopes = parseEnvelopes(run.result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "CPython returned check results Latent couldn’t read.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  const envelopeByCase = new Map(envelopes.map((item) => [`${item.contractId}/${item.caseId}`, item.observation]));
  const cases = input.contracts.flatMap((contract) => contract.cases.map((exerciseCase) => {
    const observation = envelopeByCase.get(`${contract.id}/${exerciseCase.id}`) ?? {
      status: "harness-error" as const,
      message: "CPython didn’t return this case.",
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

export async function runPythonProjectContracts(input: {
  files: Readonly<Record<string, string>>;
  contracts: readonly ExerciseContract[];
  signal?: AbortSignal;
  onEvent?: (event: PythonLabEvent) => void;
  pythonLab?: PythonLessonClient;
}): Promise<PythonLessonContractRun> {
  if (!input.contracts.length) throw new Error("No Harness project checks were selected.");
  const requiredPaths = [...new Set(input.contracts.flatMap((contract) => (
    contract.cases.map((exerciseCase) => exerciseCase.invoke.modulePath)
  )))];
  const missing = requiredPaths.find((path) => typeof input.files[path] !== "string");
  if (missing) throw new Error(`${missing} is missing from the Harness project.`);

  const startedAt = Date.now();
  const source = Object.values(input.files).join("\n");
  const packages = pythonLessonPackages(source);
  const pythonLab = input.pythonLab ?? await sharedClient(packages, "harness-project");
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
    timeoutMs: 45_000,
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
    initialization = await pythonLab.initialize({ packages }, operation);
    sync = await pythonLab.sync({
      files: Object.entries(input.files).map(([path, contents]) => ({ path, contents })),
    }, operation);
    run = await pythonLab.run({ code: projectInvocationHarness(input.contracts) }, runOperation);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The Harness Python worker stopped with an error.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  if (initialization.runtime !== "pyodide" || requiredPaths.some((path) => !sync.files.includes(path))) {
    return { cases: [], results: failedResults(input.contracts, "The CPython workspace did not sync the complete Harness project."), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }
  if (run.status === "failed") {
    const detail = run.exception?.message || "The Harness check runner stopped with an error.";
    return { cases: [], results: failedResults(input.contracts, detail), output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
  }

  let envelopes: PythonObservationEnvelope[];
  try {
    envelopes = parseEnvelopes(run.result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "CPython returned project results Latent could not read.";
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
      path: contract.cases[0]?.invoke.modulePath ?? "unknown",
      label: contract.label,
      passed: contractCases.length === contract.cases.length && contractCases.every((result) => result.passed),
      detail: formatPracticeContractDetail(contractCases),
    };
  });
  return { cases, results, output, stdout: stdout.join(""), stderr: stderr.join(""), startedAt, completedAt: Date.now() };
}

export type PythonProjectFunctionRun = {
  observation: InvocationObservation;
  output: PythonLessonOutputChunk[];
  stdout: string;
  stderr: string;
  startedAt: number;
  completedAt: number;
};

export async function runPythonProjectFunction(input: {
  files: Readonly<Record<string, string>>;
  path: string;
  exportName: string;
  args: readonly JsonValue[];
  signal?: AbortSignal;
  onEvent?: (event: PythonLabEvent) => void;
  pythonLab?: PythonLessonClient;
}): Promise<PythonProjectFunctionRun> {
  if (typeof input.files[input.path] !== "string") throw new Error(`${input.path} is missing from the Harness project.`);
  if (input.path.startsWith("/") || !input.path.endsWith(".py") || input.path.split("/").some((part) => part === ".." || part === "")) {
    throw new Error("The Python project path must be a safe relative .py path.");
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.exportName)) throw new Error("The Python export name is invalid.");
  if (!input.args.every((arg) => isInvocationJsonValue(arg))) {
    throw new Error("The Python invocation arguments must be bounded, finite JSON values.");
  }
  if (new TextEncoder().encode(JSON.stringify(input.args)).byteLength > 262_144) {
    throw new Error("The Python invocation arguments are too large.");
  }

  const startedAt = Date.now();
  const packages = pythonLessonPackages(Object.values(input.files).join("\n"));
  const pythonLab = input.pythonLab ?? await sharedClient(packages, "harness-project");
  const output: PythonLessonOutputChunk[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const onEvent = (event: PythonLabEvent) => {
    if (event.type === "stdout" || event.type === "stderr") {
      const previous = output[output.length - 1];
      if (previous?.stream === event.type) previous.text += event.text;
      else output.push({ stream: event.type, text: event.text });
      (event.type === "stdout" ? stdout : stderr).push(event.text);
    }
    input.onEvent?.(event);
  };
  const operation = { signal: input.signal, onEvent };
  const initialization = await pythonLab.initialize({ packages }, operation);
  const sync = await pythonLab.sync({
    files: Object.entries(input.files).map(([path, contents]) => ({ path, contents })),
  }, operation);
  if (initialization.runtime !== "pyodide" || !sync.files.includes(input.path)) {
    throw new Error("The CPython workspace did not sync the complete Harness project.");
  }
  const run = await pythonLab.run(
    { code: projectFunctionHarness(input.path, input.exportName, input.args) },
    { signal: input.signal, timeoutMs: 45_000, onEvent },
  );
  if (run.status === "failed") {
    throw new Error(run.exception?.message || "The Harness scenario runner stopped with an error.");
  }
  const observation = parseObservation(run.result);
  if (!observation) throw new Error("CPython returned a scenario result Latent could not read.");
  return {
    observation,
    output,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    startedAt,
    completedAt: Date.now(),
  };
}

export async function runPythonProjectFile(input: {
  files: Readonly<Record<string, string>>;
  path: string;
  signal?: AbortSignal;
  onEvent?: (event: PythonLabEvent) => void;
  pythonLab?: PythonLessonClient;
}) {
  if (typeof input.files[input.path] !== "string") throw new Error(`${input.path} is missing from the Harness project.`);
  const packages = pythonLessonPackages(Object.values(input.files).join("\n"));
  const pythonLab = input.pythonLab ?? await sharedClient(packages, "harness-project");
  const output: PythonLessonOutputChunk[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const onEvent = (event: PythonLabEvent) => {
    if (event.type === "stdout" || event.type === "stderr") {
      const previous = output[output.length - 1];
      if (previous?.stream === event.type) previous.text += event.text;
      else output.push({ stream: event.type, text: event.text });
      (event.type === "stdout" ? stdout : stderr).push(event.text);
    }
    input.onEvent?.(event);
  };
  const operation = { signal: input.signal, onEvent };
  await pythonLab.initialize({ packages }, operation);
  await pythonLab.sync({ files: Object.entries(input.files).map(([path, contents]) => ({ path, contents })) }, operation);
  const code = `import importlib, runpy, sys\n\nsys.dont_write_bytecode = True\nif \"/workspace\" not in sys.path:\n    sys.path.insert(0, \"/workspace\")\nfor name, module in list(sys.modules.items()):\n    source = getattr(module, \"__file__\", \"\") or \"\"\n    if source.startswith(\"/workspace/\"):\n        del sys.modules[name]\nimportlib.invalidate_caches()\nrunpy.run_path(${JSON.stringify(`/workspace/${input.path}`)}, run_name=\"__main__\")`;
  const run = await pythonLab.run({ code }, { signal: input.signal, timeoutMs: 45_000, onEvent });
  return { run, output, stdout: stdout.join(""), stderr: stderr.join("") };
}
