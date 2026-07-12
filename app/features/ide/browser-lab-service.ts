"use client";

import { llmSystemsContractSuite } from "../../content/llm-systems/contracts";
import {
  BROWSER_LAB_COMPILER_VERSION,
  BrowserLabCompilerClient,
  exposeLessonFunctions,
} from "../../platform/browser-lab/compiler";
import {
  BrowserLabWorkerClient,
  DEFAULT_SANDBOX_LIMITS,
  createCompileJob,
  hashSnapshot,
  type CompiledProgram,
  type ExerciseContract,
  type ProjectSnapshot,
  type SourceHash,
  type TestReceipt,
  type VirtualSourceFile,
} from "../../platform/browser-lab";
import { getPersistenceContext } from "../../platform/persistence/client";
import type { TestReceiptRecord } from "../../platform/persistence/types";
import { flushProjectPersistence, type ProjectFile, type ProjectUnitResult } from "../../lib/project-workspace";
import { LATENT_TENSOR_PATH, LATENT_TENSOR_SOURCE } from "../../platform/latent-tensor";

const PROJECT_ID = "browser-chat";
const RUNNER_VERSION = "browser-lab-quickjs-v1";

function loaderFor(path: string): VirtualSourceFile["loader"] {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".json")) return "json";
  return "js";
}

function contractsForPath(path: string) {
  return llmSystemsContractSuite.contracts.filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === path));
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

function prepareSnapshotFiles(files: Record<string, ProjectFile>) {
  const failures: ProjectUnitResult[] = [];
  const entryPoints: string[] = [];
  const prepared = Object.values(files).map((file): VirtualSourceFile => {
    const contracts = contractsForPath(file.path);
    if (!contracts.length) return { path: file.path, contents: file.content, loader: loaderFor(file.path) };
    const exports = [...new Set(contracts.flatMap((contract) => contract.cases.map((exerciseCase) => exerciseCase.invoke.exportName)))];
    try {
      const contents = exposeLessonFunctions(file.content, exports);
      entryPoints.push(file.path);
      return { path: file.path, contents, loader: loaderFor(file.path) };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The lesson module could not expose its tested functions.";
      failures.push(...contracts.map((contract) => preparationFailure(contract, detail)));
      return { path: file.path, contents: file.content, loader: loaderFor(file.path) };
    }
  });
  return { files: prepared, entryPoints, failures };
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
      detail: failures.length
        ? failures.map((failure) => `${failure.caseLabel}: ${failure.detail}`).join(" · ")
        : `${cases.length} isolated case${cases.length === 1 ? "" : "s"} passed host-owned assertions.`,
    };
  });
}

function compileFailureResults(contracts: readonly ExerciseContract[], detail: string) {
  return contracts.map((contract) => preparationFailure(contract, detail));
}

export type BrowserLabProjectRun = {
  results: ProjectUnitResult[];
  sourceHash: SourceHash;
  projectRevision: number;
  program: CompiledProgram | null;
  receipt: TestReceipt | null;
  persistenceReceipt: TestReceiptRecord | null;
};

export async function runPracticeContracts(input: {
  path: string;
  source: string;
  contractIds: readonly string[];
  signal?: AbortSignal;
}) {
  const wanted = new Set(input.contractIds);
  const contracts = llmSystemsContractSuite.contracts.filter((contract) => wanted.has(contract.id));
  if (!contracts.length || contracts.length !== wanted.size) throw new Error("The requested lesson contract is unavailable.");
  if (contracts.some((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath !== input.path))) {
    throw new Error("The lesson contract does not belong to this project file.");
  }
  const exportNames = [...new Set(contracts.flatMap((contract) => contract.cases.map((exerciseCase) => exerciseCase.invoke.exportName)))];
  let contents: string;
  try {
    contents = exposeLessonFunctions(input.source, exportNames);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The practice source could not expose its tested function.";
    return compileFailureResults(contracts, detail);
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
    return compileFailureResults(contracts, error instanceof Error ? error.message : "The isolated compiler failed.");
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
  return aggregateReceipt(receipt, contracts);
}

export async function runLessonContracts(
  files: Record<string, ProjectFile>,
  options: { onlyPath?: string; signal?: AbortSignal } = {},
): Promise<BrowserLabProjectRun> {
  await flushProjectPersistence();
  const { repositories } = await getPersistenceContext();
  const project = await repositories.projects.get(PROJECT_ID);
  if (!project) throw new Error("The persisted project is unavailable.");

  const selectedContracts = options.onlyPath
    ? llmSystemsContractSuite.contracts.filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === options.onlyPath))
    : [...llmSystemsContractSuite.contracts];
  const prepared = prepareSnapshotFiles(files);
  const selectedPaths = new Set(selectedContracts.flatMap((contract) => contract.cases.map((exerciseCase) => exerciseCase.invoke.modulePath)));
  const preparationFailures = prepared.failures.filter((result) => selectedPaths.has(result.path));
  const entryPoints = prepared.entryPoints.filter((path) => selectedPaths.has(path));
  const snapshot: ProjectSnapshot = {
    projectId: PROJECT_ID,
    revision: project.draftRevision,
    files: prepared.files,
  };
  const sourceHash = await hashSnapshot(snapshot);
  if (!selectedContracts.length || preparationFailures.length || entryPoints.length !== selectedPaths.size) {
    const existing = new Set(preparationFailures.map((result) => result.id));
    const results = [
      ...preparationFailures,
      ...selectedContracts.filter((contract) => !existing.has(contract.id)).map((contract) => preparationFailure(contract, "The lesson module is not ready to compile.")),
    ];
    return { results, sourceHash, projectRevision: project.draftRevision, program: null, receipt: null, persistenceReceipt: null };
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
    const detail = error instanceof Error ? error.message : "The isolated compiler failed.";
    return { results: compileFailureResults(selectedContracts, detail), sourceHash, projectRevision: project.draftRevision, program: null, receipt: null, persistenceReceipt: null };
  } finally {
    compiler.dispose();
  }

  const suite = { contractVersion: llmSystemsContractSuite.contractVersion, contracts: selectedContracts };
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
  const assessment = await repositories.assessments.start({
    projectId: PROJECT_ID,
    projectRevision: project.draftRevision,
    sourceTreeHash: job.sourceHash,
    contractVersion: suite.contractVersion,
    runnerVersion: RUNNER_VERSION,
  });
  let receipt: TestReceipt;
  try {
    receipt = await new BrowserLabWorkerClient().runSuite(runRequest, { signal: options.signal });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The isolated test worker failed.";
    return { results: compileFailureResults(selectedContracts, detail), sourceHash, projectRevision: project.draftRevision, program, receipt: null, persistenceReceipt: null };
  }
  const results = aggregateReceipt(receipt, selectedContracts);
  const persistenceReceipt = await repositories.assessments.finish(assessment.id, results.map((result) => ({
    contractId: result.id,
    path: result.path,
    label: result.label,
    passed: result.passed,
    detail: result.detail,
    durationMs: Math.max(0, receipt.completedAt - receipt.startedAt),
  })));
  return { results, sourceHash, projectRevision: project.draftRevision, program, receipt, persistenceReceipt };
}
