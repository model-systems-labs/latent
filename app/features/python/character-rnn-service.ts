"use client";

import { assertRnnCheckpoint } from "@latent/model-lab/character-rnn";
import type { PythonLabClient, PythonLabEvent } from "@latent/python-lab";
import {
  saveCharacterRnnArtifact,
  type SavedRnnArtifact,
} from "../../lib/learner-state";
import { hashText } from "../../platform/persistence/hash";
import {
  PYTHON_CHARACTER_RNN_PATH,
} from "./character-rnn-source";
import {
  characterRnnTrustedTrainingSource,
  PYTHON_CHARACTER_RNN_TRAINER_PATH,
} from "../../../products/courses/reference-curriculum/lessons/model/character-rnn-training";

export { PYTHON_CHARACTER_RNN_PATH } from "./character-rnn-source";
export { PYTHON_CHARACTER_RNN_TRAINER_PATH } from "../../../products/courses/reference-curriculum/lessons/model/character-rnn-training";

export const PYTHON_CHARACTER_RNN_ARTIFACT_PATH = "artifacts/character-rnn.json" as const;

export type PythonCharacterRnnTestResult = {
  id: "rnn-step" | "cross-entropy" | "clip-gradients" | "artifact-schema";
  label: string;
  passed: boolean;
  detail: string;
  durationMs?: number;
};

export type PythonCharacterRnnRun = {
  passed: boolean;
  tests: PythonCharacterRnnTestResult[];
  stdout: string;
  traceback?: string;
  artifact?: SavedRnnArtifact;
};

export type PythonCharacterRnnRunInput = {
  source: string;
  pythonLab: PythonLabClient;
  signal?: AbortSignal;
  /** Set false when the owning IDE session has already initialized this client. */
  initialize?: boolean;
  onEvent?: (event: PythonLabEvent) => void;
};

const TEST_LABELS = {
  "rnn-step": "Recurrent transition",
  "cross-entropy": "Cross-entropy loss",
  "clip-gradients": "Symmetric gradient clipping",
  "artifact-schema": "Portable checkpoint format",
} as const;

/** These checks are host source, never files in the learner's project. */
export const PYTHON_CHARACTER_RNN_TESTS = [
  {
    id: "rnn-step",
    label: TEST_LABELS["rnn-step"],
    code: `import math, runpy
import numpy as np
module = runpy.run_path(${JSON.stringify(PYTHON_CHARACTER_RNN_PATH)}, run_name="latent_hidden_test")
step = module["rnn_step"]
identity = {"Wxh": [[1, 0], [0, 1]], "Whh": [[0, 0], [0, 0]], "bias": [0, 0]}
state = list(step([1, 0], [0, 0], identity))
assert len(state) == 2, "Return one value per hidden unit."
assert 0.76 < float(state[0]) < 0.77 and abs(float(state[1])) < 1e-12, "Apply tanh after the input projection."
memory = list(step([0, 0], [1, -1], {"Wxh": [[0, 0], [0, 0]], "Whh": [[1, 0], [0, 1]], "bias": [0, 0]}))
assert 0.76 < float(memory[0]) < 0.77 and -0.77 < float(memory[1]) < -0.76, "The previous hidden state must affect both units."
bias = list(step([0, 0], [0, 0], {"Wxh": [[0, 0], [0, 0]], "Whh": [[0, 0], [0, 0]], "bias": [0.5, -0.25]}))
assert abs(float(bias[0]) - math.tanh(0.5)) < 1e-9 and abs(float(bias[1]) - math.tanh(-0.25)) < 1e-9, "Add the bias before tanh."
mixed = np.asarray(step([1, 0], [0.5, -1], {
    "Wxh": [[0, 1], [2, 0]],
    "Whh": [[1, -1], [0.5, 0.5]],
    "bias": [0.25, -0.25],
}), dtype=float)
assert mixed.shape == (2,) and np.allclose(mixed, np.tanh([1.75, 1.5]), rtol=0, atol=1e-9), "Use every matrix column in both projections before tanh."`,
  },
  {
    id: "cross-entropy",
    label: TEST_LABELS["cross-entropy"],
    code: `import math, runpy
module = runpy.run_path(${JSON.stringify(PYTHON_CHARACTER_RNN_PATH)}, run_name="latent_hidden_test")
loss = module["cross_entropy"]
likely = float(loss([0.1, 0.8, 0.1], 1))
unlikely = float(loss([0.8, 0.1, 0.1], 1))
zero = float(loss([1.0, 0.0], 1))
assert abs(likely + math.log(0.8)) < 1e-9, "Use the observed target probability."
assert unlikely > likely and abs(unlikely + math.log(0.1)) < 1e-9, "Unlikely targets must have higher loss."
assert math.isfinite(zero), "Clamp zero probability before taking log."`,
  },
  {
    id: "clip-gradients",
    label: TEST_LABELS["clip-gradients"],
    code: `import runpy
import numpy as np
module = runpy.run_path(${JSON.stringify(PYTHON_CHARACTER_RNN_PATH)}, run_name="latent_hidden_test")
clip = module["clip_gradients"]
vector = [float(value) for value in clip([-12, -2, 0, 3, 20], 5)]
assert vector == [-5.0, -2.0, 0.0, 3.0, 5.0], "Clip both tails and keep values inside the limit."
matrix = np.asarray(clip([[-9, 2], [4, 11]], 4), dtype=float)
assert matrix.shape == (2, 2), "Keep the gradient tensor shape."
assert matrix.tolist() == [[-4.0, 2.0], [4.0, 4.0]], "Apply the bound elementwise."`,
  },
  {
    id: "artifact-schema",
    label: TEST_LABELS["artifact-schema"],
    code: `import math, runpy
module = runpy.run_path(${JSON.stringify(PYTHON_CHARACTER_RNN_TRAINER_PATH)}, run_name="latent_trusted_training_test")
artifact = module["train_character_rnn"](4)
repeat = module["train_character_rnn"](4)
assert set(artifact) == {"checkpoint", "finalLoss", "parameters", "vocabularySize"}, "Return only the portable artifact fields."
assert artifact == repeat, "Training must give the same result with the fixed course seed."
checkpoint = artifact["checkpoint"]
assert checkpoint["version"] == 1, "Use checkpoint schema version 1."
vocabulary_size = len(checkpoint["vocabulary"])
hidden_size = checkpoint["hiddenSize"]
assert vocabulary_size == artifact["vocabularySize"] and len(set(checkpoint["vocabulary"])) == vocabulary_size, "The saved vocabulary size must match the number of unique tokens."
assert len(checkpoint["Wxh"]) == hidden_size and all(len(row) == vocabulary_size for row in checkpoint["Wxh"]), "Wxh must be hiddenSize by vocabularySize."
assert len(checkpoint["Whh"]) == hidden_size and all(len(row) == hidden_size for row in checkpoint["Whh"]), "Whh must be square."
assert len(checkpoint["Why"]) == vocabulary_size and all(len(row) == hidden_size for row in checkpoint["Why"]), "Why must project hidden state to vocabulary."
assert len(checkpoint["bh"]) == hidden_size and len(checkpoint["by"]) == vocabulary_size, "Bias lengths must match their layers."
expected_parameters = hidden_size * vocabulary_size + hidden_size * hidden_size + vocabulary_size * hidden_size + hidden_size + vocabulary_size
assert artifact["parameters"] == expected_parameters, "Parameter count must match the checkpoint tensors."
assert math.isfinite(artifact["finalLoss"]) and 0 <= artifact["finalLoss"] < math.log(vocabulary_size), "Training loss must beat a uniform next-character predictor."
weights = checkpoint["Wxh"] + checkpoint["Whh"] + checkpoint["Why"]
assert any(abs(float(value)) > 1e-6 for row in weights for value in row), "The trained checkpoint cannot contain only zero weights."`,
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function calculatedParameterCount(checkpoint: ReturnType<typeof assertRnnCheckpoint>) {
  const vocabularySize = checkpoint.vocabulary.length;
  const hiddenSize = checkpoint.hiddenSize;
  return hiddenSize * vocabularySize
    + hiddenSize * hiddenSize
    + vocabularySize * hiddenSize
    + hiddenSize
    + vocabularySize;
}

/** Validates the boundary shared with @latent/model-lab and the capstone. */
export function validatePythonCharacterRnnPayload(value: unknown, trainedAt = Date.now()): SavedRnnArtifact {
  if (!isRecord(value)) throw new TypeError("Python training must return an artifact object.");
  const checkpoint = assertRnnCheckpoint(value.checkpoint);
  const finalLoss = value.finalLoss;
  const parameters = value.parameters;
  const vocabularySize = value.vocabularySize;
  if (typeof finalLoss !== "number" || !Number.isFinite(finalLoss) || finalLoss < 0) {
    throw new TypeError("Python artifact finalLoss must be a finite non-negative number.");
  }
  if (typeof parameters !== "number" || !Number.isSafeInteger(parameters) || parameters !== calculatedParameterCount(checkpoint)) {
    throw new TypeError("The Python artifact’s parameter count must match the checkpoint tensor shapes.");
  }
  if (typeof vocabularySize !== "number" || !Number.isSafeInteger(vocabularySize) || vocabularySize !== checkpoint.vocabulary.length) {
    throw new TypeError("The Python artifact’s vocabularySize must match checkpoint.vocabulary.");
  }
  if (finalLoss >= Math.log(vocabularySize)) {
    throw new TypeError("The Python artifact’s loss must beat a uniform next-character baseline.");
  }
  const learnedWeightMagnitude = [...checkpoint.Wxh, ...checkpoint.Whh, ...checkpoint.Why]
    .flat()
    .reduce((sum, value) => sum + Math.abs(value), 0);
  if (!Number.isFinite(learnedWeightMagnitude) || learnedWeightMagnitude <= 1e-6) {
    throw new TypeError("The Python artifact must contain learned weights that aren’t all zero.");
  }
  if (!Number.isFinite(trainedAt) || trainedAt < 0) throw new TypeError("Python artifact trainedAt is invalid.");
  return { checkpoint, finalLoss, parameters, vocabularySize, trainedAt, origin: "python" };
}

function normalizeTests(value: unknown): PythonCharacterRnnTestResult[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.tests)
      ? value.tests
      : [];
  const byId = new Map(source.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string") return [];
    return [[item.id, item] as const];
  }));
  return PYTHON_CHARACTER_RNN_TESTS.map(({ id, label }) => {
    const item = byId.get(id);
    const passed = item?.passed === true;
    const exception = isRecord(item?.exception) ? item.exception : null;
    const detail = typeof item?.detail === "string"
      ? item.detail
      : typeof exception?.message === "string"
        ? exception.message
        : passed ? "Passed." : "The Python test didn’t return a result Latent could verify.";
    const durationMs = typeof item?.durationMs === "number" && Number.isFinite(item.durationMs)
      ? item.durationMs
      : undefined;
    return { id, label, passed, detail, ...(durationMs === undefined ? {} : { durationMs }) };
  });
}

function withArtifactSchemaFailure(
  tests: PythonCharacterRnnTestResult[],
  error: unknown,
): PythonCharacterRnnTestResult[] {
  const detail = error instanceof Error ? error.message : "The generated checkpoint didn’t match the required format.";
  return tests.map((test) => test.id === "artifact-schema" ? { ...test, passed: false, detail } : test);
}

function decodedArtifactJson(value: unknown): unknown {
  if (!Array.isArray(value)) throw new TypeError("Python training didn’t create its checkpoint JSON file.");
  const artifact = value.find((item) => isRecord(item) && item.path === PYTHON_CHARACTER_RNN_ARTIFACT_PATH);
  if (!artifact || typeof artifact.data !== "string") throw new TypeError("Python training didn’t create a readable checkpoint JSON file.");
  if (artifact.encoding !== "utf8") throw new TypeError("Python checkpoint JSON must use UTF-8 encoding.");
  try {
    return JSON.parse(artifact.data);
  } catch {
    throw new TypeError("The Python checkpoint file isn’t valid JSON.");
  }
}

const MAX_CAPTURED_OUTPUT_CHARACTERS = 60_000;

function appendEventOutput(lines: string[], event: unknown, captured: { characters: number; truncated: boolean }) {
  if (!isRecord(event) || (event.type !== "stdout" && event.type !== "stderr")) return;
  const text = typeof event.text === "string" ? event.text : typeof event.data === "string" ? event.data : "";
  if (!text || captured.truncated) return;
  const remaining = MAX_CAPTURED_OUTPUT_CHARACTERS - captured.characters;
  if (remaining <= 0) {
    captured.truncated = true;
    lines.push("\n[Python output was shortened because it was too long.]\n");
    return;
  }
  lines.push(text.slice(0, remaining));
  captured.characters += Math.min(text.length, remaining);
  if (text.length > remaining) {
    captured.truncated = true;
    lines.push("\n[Python output was shortened because it was too long.]\n");
  }
}

export async function runPythonCharacterRnnArtifact(
  input: PythonCharacterRnnRunInput,
): Promise<PythonCharacterRnnRun> {
  if (!input.source.trim()) throw new TypeError("The Python file can’t be empty.");
  const output: string[] = [];
  const captured = { characters: 0, truncated: false };
  const onEvent = (event: PythonLabEvent) => {
    appendEventOutput(output, event, captured);
    input.onEvent?.(event);
  };
  if (input.initialize !== false) {
    await input.pythonLab.initialize(
      { packages: ["numpy"] },
      { signal: input.signal, timeoutMs: 120_000, onEvent },
    );
  }
  const synchronized = await input.pythonLab.sync(
    { files: [
      { path: PYTHON_CHARACTER_RNN_PATH, contents: input.source },
      { path: PYTHON_CHARACTER_RNN_TRAINER_PATH, contents: characterRnnTrustedTrainingSource },
    ] },
    { signal: input.signal, timeoutMs: 15_000, onEvent },
  );
  if (!synchronized.files.includes(PYTHON_CHARACTER_RNN_PATH)
    || !synchronized.files.includes(PYTHON_CHARACTER_RNN_TRAINER_PATH)) {
    throw new TypeError("Python training couldn’t sync both your source file and the course test runner.");
  }
  const suite = await input.pythonLab.runTests(
    { tests: [...PYTHON_CHARACTER_RNN_TESTS] },
    { signal: input.signal, timeoutMs: 60_000, onEvent },
  );
  let tests = normalizeTests(suite);
  if (tests.some((test) => !test.passed)) return { passed: false, tests, stdout: output.join("") };

  // Learner code is intentionally allowed to use the worker filesystem. A
  // hidden test therefore cannot leave the host-owned entrypoint authoritative:
  // the learner may have overwritten that path while the test interpreter was
  // executing. Restore the exact host bytes after every learner-controlled
  // execution and remove any stale artifact before the authoritative run.
  const restored = await input.pythonLab.sync(
    {
      files: [{ path: PYTHON_CHARACTER_RNN_TRAINER_PATH, contents: characterRnnTrustedTrainingSource }],
      deletePaths: [PYTHON_CHARACTER_RNN_ARTIFACT_PATH],
    },
    { signal: input.signal, timeoutMs: 15_000, onEvent },
  );
  if (!restored.files.includes(PYTHON_CHARACTER_RNN_TRAINER_PATH)) {
    throw new TypeError("Python training couldn’t restore the course test runner after checking your code.");
  }

  const run = await input.pythonLab.run(
    {
      entryPath: PYTHON_CHARACTER_RNN_TRAINER_PATH,
      resultVariable: "RESULT",
      artifactPaths: [PYTHON_CHARACTER_RNN_ARTIFACT_PATH],
    },
    { signal: input.signal, timeoutMs: 90_000, onEvent },
  );
  if (run.status === "failed") {
    const exception = run.exception;
    const detail = exception
      ? `${exception.type}: ${exception.message}`
      : "Python training stopped before it created a checkpoint.";
    tests = withArtifactSchemaFailure(tests, new Error(detail));
    return {
      passed: false,
      tests,
      stdout: output.join(""),
      ...(exception?.traceback ? { traceback: exception.traceback } : {}),
    };
  }
  try {
    const trainedAt = Date.now();
    const resultArtifact = validatePythonCharacterRnnPayload((run as { result?: unknown }).result, trainedAt);
    const fileArtifact = validatePythonCharacterRnnPayload(
      decodedArtifactJson((run as { artifacts?: unknown }).artifacts),
      trainedAt,
    );
    if (JSON.stringify(resultArtifact.checkpoint) !== JSON.stringify(fileArtifact.checkpoint)
      || resultArtifact.finalLoss !== fileArtifact.finalLoss
      || resultArtifact.parameters !== fileArtifact.parameters
      || resultArtifact.vocabularySize !== fileArtifact.vocabularySize) {
      throw new TypeError("The Python result doesn’t match the checkpoint JSON file it created.");
    }
    return { passed: true, tests, stdout: output.join(""), artifact: fileArtifact };
  } catch (error) {
    tests = withArtifactSchemaFailure(tests, error);
    return { passed: false, tests, stdout: output.join("") };
  }
}

/** Persists only a checkpoint that passed every transient host-owned test. */
export async function savePythonCharacterRnnArtifact(
  input: PythonCharacterRnnRunInput,
): Promise<PythonCharacterRnnRun> {
  const result = await runPythonCharacterRnnArtifact(input);
  if (!result.passed || !result.artifact) return result;
  const sourceHash = await hashText(input.source);
  saveCharacterRnnArtifact(result.artifact, "python", result.artifact.trainedAt, {
    sourcePath: PYTHON_CHARACTER_RNN_PATH,
    sourceHash,
  });
  return result;
}
