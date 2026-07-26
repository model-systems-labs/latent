import { RUNTIME_PATHS, type ProjectUnitResult } from "@/app/lib/project-workspace";
import { llmSystemsContractSuite } from "@/examples/learning-platform/llm-learning/content/llm-systems/contracts";
import { CAPSTONE_ENTRY_PATH } from "@/examples/learning-platform/llm-learning/content/browser-chat/project-template";
import {
  CAPSTONE_BEHAVIOR_COMPONENT_PATH,
  CAPSTONE_BEHAVIOR_CONTRACT_ID,
} from "@/app/lib/capstone-behavior-contract";

export type ProjectFileStatusTone =
  | "provided"
  | "ready"
  | "pending"
  | "in-progress"
  | "complete"
  | "passed"
  | "assembled"
  | "failed";

export type ProjectFileStatus = {
  tone: ProjectFileStatusTone;
  label: string;
  complete: boolean;
};

export type ProjectSourceProgress = {
  total: number;
  verified: number;
  partial: number;
  needsWork: number;
  notStarted: number;
  percentage: number;
};

export type ProjectLessonBuildEvidence = {
  projectSource?: string;
  verifiedSource?: string;
  verifiedCells: number;
  totalCells: number;
  trustedResults?: ProjectUnitResult[];
  expectedContractIds?: readonly string[];
};

export type ProjectTestStateEvidence = {
  runner: "none" | "legacy" | "browser-lab-v1";
  results: Readonly<Record<string, ProjectUnitResult[]>>;
  sourceTreeHash: string | null;
  projectRevision: number | null;
  contractVersion: string | null;
  contractIdsByPath: Readonly<Record<string, readonly string[]>>;
};

export function trustedProjectResults(tests: ProjectTestStateEvidence): Readonly<Record<string, ProjectUnitResult[]>> {
  if (!(tests.runner === "browser-lab-v1"
    && tests.sourceTreeHash !== null
    && tests.projectRevision !== null
    && tests.contractVersion === llmSystemsContractSuite.contractVersion)) return {};
  return Object.fromEntries(Object.entries(tests.results).filter(([path, results]) => {
    const expected = expectedProjectTestIdsForPath(path);
    const storedScope = tests.contractIdsByPath[path] ?? [];
    return resultIdsExactlyMatch(storedScope.map((id) => ({ id })), expected)
      && resultIdsExactlyMatch(results, expected);
  }));
}

export function expectedProjectContractIdsForPath(path: string): string[] {
  return llmSystemsContractSuite.contracts
    .filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === path))
    .map((contract) => contract.id);
}

export function expectedProjectTestIdsForPath(path: string): string[] {
  const lessonIds = expectedProjectContractIdsForPath(path);
  if (lessonIds.length) return lessonIds;
  if (Object.values(RUNTIME_PATHS).includes(path as (typeof RUNTIME_PATHS)[keyof typeof RUNTIME_PATHS])) {
    return [`${path}:contract`];
  }
  if (path === CAPSTONE_BEHAVIOR_COMPONENT_PATH) return [CAPSTONE_BEHAVIOR_CONTRACT_ID];
  return path === CAPSTONE_ENTRY_PATH ? [`${CAPSTONE_ENTRY_PATH}:compile`] : [];
}

function resultIdsExactlyMatch(
  results: readonly Pick<ProjectUnitResult, "id">[],
  expectedContractIds: readonly string[],
) {
  const expected = [...expectedContractIds].sort((left, right) => left.localeCompare(right));
  const actual = results.map((result) => result.id).sort((left, right) => left.localeCompare(right));
  return expected.length > 0
    && new Set(expected).size === expected.length
    && new Set(actual).size === actual.length
    && actual.length === expected.length
    && actual.every((id, index) => id === expected[index]);
}

export function resultsCoverExpectedContracts(
  results: readonly ProjectUnitResult[],
  expectedContractIds: readonly string[],
) {
  return resultIdsExactlyMatch(results, expectedContractIds)
    && results.every((result) => result.passed);
}

export function projectResultsForFile(
  resultsByPath: Readonly<Record<string, ProjectUnitResult[]>>,
  path: string,
  sharedCompilePath?: string,
) {
  return resultsByPath[path] ?? (sharedCompilePath ? resultsByPath[sharedCompilePath] : undefined) ?? [];
}

export function projectUsesIntegratedEntryReceipt(
  resultsByPath: Readonly<Record<string, ProjectUnitResult[]>>,
  path: string,
  sharedCompilePath?: string,
) {
  return Boolean(
    sharedCompilePath
    && resultsByPath[path] === undefined
    && resultsByPath[sharedCompilePath] !== undefined,
  );
}

function lessonEvidenceIsBuildReady({
  hasProjectSource,
  sourceMatchesVerification,
  verifiedCells,
  totalCells,
  trustedResults,
  expectedContractIds,
}: {
  hasProjectSource: boolean;
  sourceMatchesVerification: boolean;
  verifiedCells: number;
  totalCells: number;
  trustedResults: ProjectUnitResult[];
  expectedContractIds: readonly string[];
}) {
  const total = Math.max(1, totalCells);
  const verified = Math.min(total, Math.max(0, verifiedCells));
  const hasFailure = trustedResults.some((result) => !result.passed);
  const hasPassingReceipt = resultsCoverExpectedContracts(trustedResults, expectedContractIds);
  return hasProjectSource
    && !hasFailure
    && ((sourceMatchesVerification && verified >= total) || hasPassingReceipt);
}

export function projectLessonIsBuildReady({
  projectSource,
  verifiedSource,
  verifiedCells,
  totalCells,
  trustedResults = [],
  expectedContractIds = [],
}: ProjectLessonBuildEvidence) {
  return lessonEvidenceIsBuildReady({
    hasProjectSource: projectSource !== undefined,
    sourceMatchesVerification: projectSource !== undefined
      && verifiedSource !== undefined
      && projectSource === verifiedSource,
    verifiedCells,
    totalCells,
    trustedResults,
    expectedContractIds,
  });
}

function lessonBuildStatusFromEvidence({
  hasProjectSource,
  sourceMatchesVerification,
  verifiedCells,
  totalCells,
  trustedResults,
  expectedContractIds,
}: {
  hasProjectSource: boolean;
  sourceMatchesVerification: boolean;
  verifiedCells: number;
  totalCells: number;
  trustedResults: ProjectUnitResult[];
  expectedContractIds: readonly string[];
}): ProjectFileStatus {
  const total = Math.max(1, totalCells);
  const verified = Math.min(total, Math.max(0, verifiedCells));
  if (trustedResults.some((result) => !result.passed)) {
    return { tone: "failed", label: "IDE tests failing", complete: false };
  }
  if (lessonEvidenceIsBuildReady({ hasProjectSource, sourceMatchesVerification, verifiedCells, totalCells, trustedResults, expectedContractIds })) {
    return sourceMatchesVerification && verified >= total
      ? { tone: "complete", label: `${total} of ${total} checks verified`, complete: true }
      : { tone: "passed", label: "IDE tests pass", complete: true };
  }
  if (hasProjectSource && !sourceMatchesVerification) {
    return { tone: "in-progress", label: "Source changed · run IDE tests", complete: false };
  }
  if (verified > 0) return { tone: "in-progress", label: `${verified} of ${total} checks verified`, complete: false };
  return { tone: "pending", label: `0 of ${total} checks verified`, complete: false };
}

export function projectLessonBuildStatus({
  projectSource,
  verifiedSource,
  verifiedCells,
  totalCells,
  trustedResults = [],
  expectedContractIds = [],
}: ProjectLessonBuildEvidence): ProjectFileStatus {
  return lessonBuildStatusFromEvidence({
    hasProjectSource: projectSource !== undefined,
    sourceMatchesVerification: projectSource !== undefined
      && verifiedSource !== undefined
      && projectSource === verifiedSource,
    verifiedCells,
    totalCells,
    trustedResults,
    expectedContractIds,
  });
}

export function projectFileStatus({
  isLessonFile,
  readOnly = false,
  requiresPassingTests = false,
  integratedEntryReceipt = false,
  sourceMatchesVerification = true,
  verifiedCells = 0,
  totalCells = 1,
  results = [],
  expectedContractIds = [],
}: {
  isLessonFile: boolean;
  readOnly?: boolean;
  requiresPassingTests?: boolean;
  integratedEntryReceipt?: boolean;
  sourceMatchesVerification?: boolean;
  verifiedCells?: number;
  totalCells?: number;
  results?: ProjectUnitResult[];
  expectedContractIds?: readonly string[];
}): ProjectFileStatus {
  const hasFailure = results.some((result) => !result.passed);

  if (isLessonFile) {
    return lessonBuildStatusFromEvidence({
      hasProjectSource: true,
      sourceMatchesVerification,
      verifiedCells,
      totalCells,
      trustedResults: results,
      expectedContractIds,
    });
  }

  if (hasFailure) {
    return {
      tone: "failed",
      label: integratedEntryReceipt ? "Integrated entry tests failing" : "IDE tests failing",
      complete: false,
    };
  }
  if (results.length && results.every((result) => result.passed)) {
    return integratedEntryReceipt
      ? { tone: "assembled", label: "Integrated entry tests pass", complete: true }
      : { tone: "passed", label: "IDE tests pass", complete: true };
  }
  if (readOnly) return { tone: "provided", label: "Provided", complete: true };
  if (requiresPassingTests) return { tone: "pending", label: "Tests not run", complete: false };
  return { tone: "ready", label: "Ready to edit", complete: true };
}

export function projectLessonIsComplete({
  learnerComplete,
  projectSource,
  verifiedSource,
  verifiedCells,
  totalCells,
  trustedResults = [],
  expectedContractIds = [],
}: {
  learnerComplete: boolean;
} & ProjectLessonBuildEvidence) {
  if (!learnerComplete) return false;
  return projectLessonIsBuildReady({
    projectSource,
    verifiedSource,
    verifiedCells,
    totalCells,
    trustedResults,
    expectedContractIds,
  });
}

export function projectSourceProgress(statuses: readonly ProjectFileStatus[]): ProjectSourceProgress {
  const total = statuses.length;
  const verified = statuses.filter((status) => status.complete).length;
  const partial = statuses.filter((status) => status.tone === "in-progress").length;
  const needsWork = statuses.filter((status) => status.tone === "failed").length;
  const notStarted = Math.max(0, total - verified - partial - needsWork);
  return {
    total,
    verified,
    partial,
    needsWork,
    notStarted,
    percentage: total ? verified / total * 100 : 0,
  };
}

export function projectTimelineVisibleFileCount(
  lessonFileCount: number,
  providedRuntimeFileCount: number,
  applicationShellFileCount: number,
) {
  return Math.max(0, lessonFileCount) + Math.max(0, providedRuntimeFileCount) + Math.max(0, applicationShellFileCount);
}
