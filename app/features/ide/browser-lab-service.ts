"use client";

import { llmSystemsContractSuite } from "../../content/llm-systems/contracts";
import {
  BROWSER_LAB_COMPILER_VERSION,
  BrowserLabCompilerClient,
  exposeLessonFunctions,
} from "@latent/browser-lab/compiler";
import {
  BrowserLabWorkerClient,
  DEFAULT_SANDBOX_LIMITS,
  createCompileJob,
  hashSnapshot,
  type CompiledProgram,
  type ExerciseCaseResult,
  type ExerciseContract,
  type ProjectSnapshot,
  type SourceHash,
  type TestReceipt,
} from "@latent/browser-lab";
import { getPersistenceContext } from "../../platform/persistence/client";
import type { TestReceiptRecord } from "../../platform/persistence/types";
import { flushProjectPersistence, type ProjectFile, type ProjectUnitResult } from "../../lib/project-workspace";
import { LATENT_TENSOR_PATH, LATENT_TENSOR_SOURCE } from "@latent/tensor/browser-source";
import { CAPSTONE_ENTRY_PATH } from "../../content/browser-chat/project-template";
import {
  CAPSTONE_BEHAVIOR_COMPONENT_PATH,
  CAPSTONE_BEHAVIOR_CONTRACT_ID,
} from "../../lib/capstone-behavior-contract";
import { formatPracticeContractDetail } from "./practice-feedback";
import { prepareProjectSnapshotFiles } from "./project-snapshot";
import { runCapstoneBehaviorContract } from "./capstone-behavior-runner";
import { runPythonLessonContracts } from "./python-lesson-service";
import { llmRuntimeBindingManifest } from "../../runtime/bindings/manifest";

const PROJECT_ID = "browser-chat";
const RUNNER_VERSION = "browser-lab-cpython-v1";

function loaderFor(path: string) {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".json")) return "json";
  return "js";
}

function preparationFailure(contract: ExerciseContract, detail: string): ProjectUnitResult {
  return {
    id: contract.id,
    path: contract.cases[0]?.invoke.modulePath ?? "unknown",
    label: contract.label,
    passed: false,
    detail,
  };
}

function aggregateReceipt(receipt: TestReceipt, contracts: readonly ExerciseContract[]): ProjectUnitResult[] {
  return contracts.map((contract) => {
    const cases = receipt.results.filter((result) => result.contractId === contract.id);
    const failures = cases.filter((result) => !result.passed);
    return {
      id: contract.id,
      path: contract.cases[0]?.invoke.modulePath ?? "unknown",
      label: contract.label,
      passed: cases.length === contract.cases.length && failures.length === 0,
      detail: formatPracticeContractDetail(cases),
    };
  });
}

function compileFailureResults(contracts: readonly ExerciseContract[], detail: string) {
  return contracts.map((contract) => preparationFailure(contract, detail));
}

export type PracticeContractRun = {
  cases: ExerciseCaseResult[];
  results: ProjectUnitResult[];
  output: PracticeOutputChunk[];
  stdout: string;
  stderr: string;
};

export type PracticeOutputChunk = {
  stream: "stdout" | "stderr";
  text: string;
};

function failedPracticeRun(contracts: readonly ExerciseContract[], detail: string): PracticeContractRun {
  return { cases: [], results: compileFailureResults(contracts, detail), output: [], stdout: "", stderr: "" };
}

export function practiceOutput(receipt: TestReceipt): Pick<PracticeContractRun, "output" | "stdout" | "stderr"> {
  const output: PracticeOutputChunk[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const append = (stream: PracticeOutputChunk["stream"], text: string) => {
    const previous = output[output.length - 1];
    if (previous?.stream === stream) previous.text += text;
    else output.push({ stream, text });
  };
  for (const entry of receipt.logs) {
    const stream = entry.level === "warn" || entry.level === "error" ? "stderr" : "stdout";
    append(stream, `${entry.text}\n`);
    (stream === "stderr" ? stderr : stdout).push(entry.text);
  }
  if (receipt.logsTruncated) {
    const text = "[Output truncated by the browser lab.]";
    append("stderr", `${text}\n`);
    stderr.push(text);
  }
  const join = (lines: string[]) => lines.length ? `${lines.join("\n")}\n` : "";
  return { output, stdout: join(stdout), stderr: join(stderr) };
}

export function exerciseCaseResultsAreComplete(
  contracts: readonly ExerciseContract[],
  results: readonly ExerciseCaseResult[],
) {
  const expected = new Set(contracts.flatMap((contract) => (
    contract.cases.map((exerciseCase) => `${contract.id}\u0000${exerciseCase.id}`)
  )));
  const actual = results.map((result) => `${result.contractId}\u0000${result.caseId}`);
  return actual.length === expected.size
    && new Set(actual).size === actual.length
    && actual.every((key) => expected.has(key));
}

export type BrowserLabProjectRun = {
  results: ProjectUnitResult[];
  expectedIdsByPath: Record<string, string[]>;
  sourceHash: SourceHash;
  projectRevision: number;
  contractVersion: string;
  program: CompiledProgram | null;
  receipt: TestReceipt | null;
  persistenceReceipt: TestReceiptRecord | null;
};

export async function runPracticeContracts(input: {
  path: string;
  source: string;
  contractIds: readonly string[];
  signal?: AbortSignal;
}): Promise<PracticeContractRun> {
  const wanted = new Set(input.contractIds);
  const contracts = llmSystemsContractSuite.contracts.filter((contract) => wanted.has(contract.id));
  if (!contracts.length || contracts.length !== wanted.size) throw new Error("That lesson check isn’t available.");
  if (contracts.some((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath !== input.path))) {
    throw new Error("That lesson check doesn’t belong to this project file.");
  }
  const exportNames = [...new Set(contracts.flatMap((contract) => contract.cases.map((exerciseCase) => exerciseCase.invoke.exportName)))];
  let contents: string;
  try {
    contents = exposeLessonFunctions(input.source, exportNames);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The practice code didn’t make its tested function available.";
    return failedPracticeRun(contracts, detail);
  }
  const snapshot: ProjectSnapshot = {
    projectId: `practice-${input.path.replace(/[^A-Za-z0-9]+/g, "-")}`,
    revision: 0,
    files: [
      { path: input.path, contents, loader: loaderFor(input.path) },
      { path: LATENT_TENSOR_PATH, contents: LATENT_TENSOR_SOURCE, loader: "js" },
    ],
  };
  const job = await createCompileJob({
    jobId: `practice-compile-${crypto.randomUUID()}`,
    snapshot,
    compilerVersion: BROWSER_LAB_COMPILER_VERSION,
    entryPoints: [input.path],
  });
  const compiler = new BrowserLabCompilerClient();
  let program: CompiledProgram;
  try {
    program = await compiler.compile(job, { signal: input.signal });
  } catch (error) {
    return failedPracticeRun(contracts, error instanceof Error ? error.message : "The compiler failed in the isolated worker.");
  } finally {
    compiler.dispose();
  }
  const suite = { contractVersion: llmSystemsContractSuite.contractVersion, contracts };
  const receipt = await new BrowserLabWorkerClient().runSuite({
    schemaVersion: 1,
    jobId: `practice-test-${crypto.randomUUID()}`,
    projectId: snapshot.projectId,
    projectRevision: snapshot.revision,
    sourceHash: job.sourceHash,
    contractVersion: suite.contractVersion,
    requestedAt: Date.now(),
    deterministicSeed: 71,
    deterministicNowMs: 1_700_000_000_000,
    program,
    suite,
    limits: { ...DEFAULT_SANDBOX_LIMITS },
  }, { signal: input.signal });
  return { cases: [...receipt.results], results: aggregateReceipt(receipt, contracts), ...practiceOutput(receipt) };
}

export async function runLessonContracts(
  files: Record<string, ProjectFile>,
  options: { onlyPath?: string; signal?: AbortSignal } = {},
): Promise<BrowserLabProjectRun> {
  await flushProjectPersistence();
  const { repositories } = await getPersistenceContext();
  const project = await repositories.projects.get(PROJECT_ID);
  if (!project) throw new Error("The saved project isn’t available.");

  const selectedContracts = options.onlyPath
    ? llmSystemsContractSuite.contracts.filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === options.onlyPath))
    : [...llmSystemsContractSuite.contracts];
  const expectedIdsByPath = selectedContracts.reduce<Record<string, string[]>>((grouped, contract) => {
    const path = contract.cases[0]?.invoke.modulePath;
    if (path) (grouped[path] ??= []).push(contract.id);
    return grouped;
  }, {});
  const includeCapstone = !options.onlyPath;
  if (includeCapstone) {
    expectedIdsByPath[CAPSTONE_BEHAVIOR_COMPONENT_PATH] = [CAPSTONE_BEHAVIOR_CONTRACT_ID];
  }
  const preparedSnapshot = prepareProjectSnapshotFiles(files);
  const prepared = {
    files: preparedSnapshot.files,
    entryPoints: preparedSnapshot.entryPoints,
    failures: preparedSnapshot.failures.map(({ contract, detail }) => preparationFailure(contract, detail)),
  };
  const selectedPaths = new Set(selectedContracts.flatMap((contract) => contract.cases.map((exerciseCase) => exerciseCase.invoke.modulePath)));
  const preparationFailures = prepared.failures.filter((result) => selectedPaths.has(result.path));
  const lessonEntryPoints = prepared.entryPoints.filter((path) => selectedPaths.has(path));
  const capstoneAvailable = Boolean(files[CAPSTONE_ENTRY_PATH]);
  const bindingEntryPoints = includeCapstone
    ? [...new Set(llmRuntimeBindingManifest.bindings.map((binding) => binding.modulePath))]
    : [];
  const missingBindingPaths = bindingEntryPoints.filter((path) => !files[path]);
  const entryPoints = [...new Set([
    ...lessonEntryPoints,
    ...(includeCapstone && capstoneAvailable ? [CAPSTONE_ENTRY_PATH] : []),
    ...bindingEntryPoints.filter((path) => Boolean(files[path])),
  ])];
  const snapshot: ProjectSnapshot = {
    projectId: PROJECT_ID,
    revision: project.draftRevision,
    files: prepared.files,
  };
  const sourceHash = await hashSnapshot(snapshot);
  if (!selectedContracts.length || preparationFailures.length || lessonEntryPoints.length !== selectedPaths.size || (includeCapstone && (!capstoneAvailable || missingBindingPaths.length))) {
    const existing = new Set(preparationFailures.map((result) => result.id));
    const missingProjectDetail = !capstoneAvailable
      ? "The main capstone entry is missing from this project."
      : missingBindingPaths.length
        ? `The project is missing this provided capstone adapter: ${missingBindingPaths.join(", ")}.`
        : "The lesson module isn’t ready to compile.";
    const results = [
      ...preparationFailures,
      ...selectedContracts.filter((contract) => !existing.has(contract.id)).map((contract) => preparationFailure(contract, missingProjectDetail)),
    ];
    if (includeCapstone) results.push(await runCapstoneBehaviorContract(null, { signal: options.signal }));
    return { results, expectedIdsByPath, sourceHash, projectRevision: project.draftRevision, contractVersion: llmSystemsContractSuite.contractVersion, program: null, receipt: null, persistenceReceipt: null };
  }

  const jobId = `compile-${crypto.randomUUID()}`;
  const job = await createCompileJob({
    jobId,
    snapshot,
    compilerVersion: BROWSER_LAB_COMPILER_VERSION,
    entryPoints,
  });
  const compiler = new BrowserLabCompilerClient();
  let program: CompiledProgram;
  try {
    program = await compiler.compile(job, { signal: options.signal });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The compiler failed in the isolated worker.";
    const results = compileFailureResults(selectedContracts, detail);
    if (includeCapstone) results.push(await runCapstoneBehaviorContract(null, { signal: options.signal }));
    return { results, expectedIdsByPath, sourceHash, projectRevision: project.draftRevision, contractVersion: llmSystemsContractSuite.contractVersion, program: null, receipt: null, persistenceReceipt: null };
  } finally {
    compiler.dispose();
  }

  const capstoneBehaviorResult = includeCapstone
    ? await runCapstoneBehaviorContract(
      program.modules.find((module) => module.modulePath === CAPSTONE_ENTRY_PATH) ?? null,
      { signal: options.signal },
    )
    : null;

  const pythonContracts = selectedContracts.filter((contract) => (
    contract.cases[0]?.invoke.modulePath.endsWith(".py")
  ));
  const javascriptContracts = selectedContracts.filter((contract) => !pythonContracts.includes(contract));
  const assessment = await repositories.assessments.start({
    projectId: PROJECT_ID,
    projectRevision: project.draftRevision,
    sourceTreeHash: job.sourceHash,
    contractVersion: llmSystemsContractSuite.contractVersion,
    runnerVersion: RUNNER_VERSION,
  });
  const startedAt = Date.now();
  const caseResults: ExerciseCaseResult[] = [];
  const unitResults = new Map<string, ProjectUnitResult>();
  let javascriptReceipt: TestReceipt | null = null;

  for (const path of [...selectedPaths].filter((candidate) => candidate.endsWith(".py"))) {
    options.signal?.throwIfAborted();
    const contracts = pythonContracts.filter((contract) => contract.cases[0]?.invoke.modulePath === path);
    const source = files[path]?.content;
    if (!source) {
      for (const result of compileFailureResults(contracts, `The project is missing this CPython file: ${path}.`)) {
        unitResults.set(result.id, result);
      }
      continue;
    }
    const run = await runPythonLessonContracts({
      path,
      source,
      contracts,
      signal: options.signal,
    });
    caseResults.push(...run.cases);
    for (const result of run.results) unitResults.set(result.id, result);
  }

  if (javascriptContracts.length) {
    const suite = { contractVersion: llmSystemsContractSuite.contractVersion, contracts: javascriptContracts };
    const runRequest = {
      schemaVersion: 1 as const,
      jobId: `test-${crypto.randomUUID()}`,
      projectId: PROJECT_ID,
      projectRevision: project.draftRevision,
      sourceHash: job.sourceHash,
      contractVersion: suite.contractVersion,
      requestedAt: Date.now(),
      deterministicSeed: 71,
      deterministicNowMs: 1_700_000_000_000,
      program,
      suite,
      limits: { ...DEFAULT_SANDBOX_LIMITS },
    };
    try {
      javascriptReceipt = await new BrowserLabWorkerClient().runSuite(runRequest, { signal: options.signal });
      caseResults.push(...javascriptReceipt.results);
      for (const result of aggregateReceipt(javascriptReceipt, javascriptContracts)) unitResults.set(result.id, result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The JavaScript tests failed in the isolated worker.";
      for (const result of compileFailureResults(javascriptContracts, detail)) unitResults.set(result.id, result);
    }
  }

  const completedAt = Date.now();
  const receipt: TestReceipt = {
    schemaVersion: 1,
    receiptId: `receipt-${crypto.randomUUID()}`,
    jobId: `cpython-test-${crypto.randomUUID()}`,
    projectId: PROJECT_ID,
    projectRevision: project.draftRevision,
    sourceHash: job.sourceHash,
    contractVersion: llmSystemsContractSuite.contractVersion,
    status: exerciseCaseResultsAreComplete(selectedContracts, caseResults) && caseResults.every((result) => result.passed)
      ? "passed"
      : "failed",
    startedAt,
    completedAt,
    results: caseResults,
    logs: javascriptReceipt?.logs ?? [],
    logsTruncated: javascriptReceipt?.logsTruncated ?? false,
    limits: { ...DEFAULT_SANDBOX_LIMITS },
  };
  const results = [
    ...selectedContracts.map((contract) => unitResults.get(contract.id) ?? preparationFailure(
      contract,
      "The lesson runner didn’t return this check.",
    )),
    ...(capstoneBehaviorResult ? [capstoneBehaviorResult] : []),
  ];
  const persistenceReceipt = await repositories.assessments.finish(
    assessment.id,
    results.map((result) => ({
      contractId: result.id,
      path: result.path,
      label: result.label,
      passed: result.passed,
      detail: result.detail,
      durationMs: Math.max(0, completedAt - startedAt),
    })),
    Object.fromEntries(program.modules.map((module) => [module.modulePath, module.codeHash])),
  );
  return { results, expectedIdsByPath, sourceHash, projectRevision: project.draftRevision, contractVersion: llmSystemsContractSuite.contractVersion, program, receipt, persistenceReceipt };
}
