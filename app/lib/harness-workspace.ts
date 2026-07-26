"use client";

import { useSyncExternalStore } from "react";
import type { CourseLesson } from "@latent/course-kit";
import { getPersistenceContext } from "@/app/platform/persistence/client";
import { hashSourceTree } from "@/app/platform/persistence/hash";
import type {
  FileRevisionRecord,
  ProjectFileRecord,
  ProjectRecord,
  TestReceiptRecord,
  TestResultRecord,
  TestRunRecord,
} from "@/app/platform/persistence/types";
import {
  HARNESS_PROJECT_CONTRACT_VERSION,
  HARNESS_PROJECT_ID,
  HARNESS_PROJECT_RUNNER_VERSION,
  HARNESS_PROJECT_STARTER_FILES,
  HARNESS_PROJECT_TITLE,
  harnessLessonProjectSeed,
  type HarnessProjectSeed,
} from "@/app/lib/harness-project";
import { harnessEngineeringLessons } from "@/examples/learning-platform/llm-learning/lessons/harness-engineering";
import { loadLearnerState } from "@/app/lib/learner-state";
import { restoreWorkingSourceVerification, workingPracticeSources } from "@/app/features/ide/practice-state";

export const HARNESS_RECOVERY_PREFIX = "latent-harness-workspace-recovery-v1:";

export type HarnessWorkspaceState = {
  ready: boolean;
  project: ProjectRecord | null;
  files: Readonly<Record<string, ProjectFileRecord>>;
  selectedPath: string | null;
  error: string | null;
};

const EMPTY_STATE: HarnessWorkspaceState = {
  ready: false,
  project: null,
  files: {},
  selectedPath: null,
  error: null,
};

let state = EMPTY_STATE;
let initializePromise: Promise<HarnessWorkspaceState> | null = null;
let persistenceQueue: Promise<unknown> = Promise.resolve();
const optimisticContents = new Map<string, string>();
const lastSaveByPath = new Map<string, Promise<ProjectFileRecord>>();
const stagedLessonSeeds = new Map<string, HarnessProjectSeed>();
const stagedLessonTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function publish(next: HarnessWorkspaceState) {
  state = next;
  emit();
  return state;
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "This browser could not save the Harness project.";
}

function filesByPath(files: readonly ProjectFileRecord[]) {
  return Object.fromEntries(files.map((file) => [file.path, file]));
}

async function reloadState() {
  const { repositories } = await getPersistenceContext();
  const project = await repositories.projects.get(HARNESS_PROJECT_ID) ?? null;
  const files = await repositories.projects.listFiles(HARNESS_PROJECT_ID);
  return publish({
    ready: true,
    project,
    files: filesByPath(files),
    selectedPath: project?.selectedPath ?? files[0]?.path ?? null,
    error: null,
  });
}

async function seedMissingFiles() {
  const { repositories } = await getPersistenceContext();
  let project = await repositories.projects.get(HARNESS_PROJECT_ID);
  if (!project) {
    project = await repositories.projects.create({
      id: HARNESS_PROJECT_ID,
      title: HARNESS_PROJECT_TITLE,
      courseId: HARNESS_PROJECT_ID,
      selectedPath: HARNESS_PROJECT_STARTER_FILES[0]?.path ?? null,
    });
  }
  const existing = new Map((await repositories.projects.listFiles(HARNESS_PROJECT_ID)).map((file) => [file.path, file]));
  for (const seed of HARNESS_PROJECT_STARTER_FILES) {
    const current = existing.get(seed.path);
    if (current && current.sourceProvenance !== "seed") continue;
    if (current
      && current.content === seed.content
      && current.referenceContent === seed.referenceContent
      && current.lessonId === seed.lessonId
      && current.totalCells === seed.totalCells) continue;
    await repositories.projects.saveFile({
      projectId: HARNESS_PROJECT_ID,
      path: seed.path,
      track: seed.track,
      title: seed.title,
      content: seed.content,
      referenceContent: seed.referenceContent,
      lessonId: seed.lessonId,
      verifiedCells: seed.verifiedCells,
      totalCells: seed.totalCells,
      sourceProvenance: "seed",
      reason: "seed",
      expected: current ? { revision: current.revision, sourceHash: current.sourceHash } : null,
    });
  }
}

export function initializeHarnessWorkspace() {
  if (initializePromise) return initializePromise;
  initializePromise = (async () => {
    try {
      await seedMissingFiles();
      return await reloadState();
    } catch (error) {
      initializePromise = null;
      return publish({ ...state, ready: true, error: messageFor(error) });
    }
  })();
  return initializePromise;
}

export function loadHarnessWorkspaceState() {
  return state;
}

export function subscribeHarnessWorkspace(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHarnessWorkspaceState() {
  return useSyncExternalStore(subscribeHarnessWorkspace, loadHarnessWorkspaceState, () => EMPTY_STATE);
}

function enqueueSave(seed: HarnessProjectSeed, provenance: "lesson" | "ide") {
  const observed = state.files[seed.path];
  const previousSave = lastSaveByPath.get(seed.path);
  optimisticContents.set(seed.path, seed.content);
  const operation = persistenceQueue.then(async () => {
    await initializeHarnessWorkspace();
    const { repositories } = await getPersistenceContext();
    const current = previousSave ? await previousSave : observed;
    const saved = await repositories.projects.saveFile({
      projectId: HARNESS_PROJECT_ID,
      path: seed.path,
      track: seed.track,
      title: seed.title,
      content: seed.content,
      referenceContent: seed.referenceContent,
      lessonId: seed.lessonId,
      verifiedCells: seed.verifiedCells,
      totalCells: seed.totalCells,
      sourceProvenance: provenance,
      reason: "edit",
      expected: current ? { revision: current.revision, sourceHash: current.sourceHash } : null,
    });
    if (optimisticContents.get(seed.path) === seed.content) optimisticContents.delete(seed.path);
    state = {
      ...state,
      project: await repositories.projects.get(HARNESS_PROJECT_ID) ?? state.project,
      files: { ...state.files, [seed.path]: saved },
      selectedPath: state.selectedPath ?? saved.path,
      error: null,
    };
    emit();
    return saved;
  }).catch(async (error) => {
    if (optimisticContents.get(seed.path) === seed.content) optimisticContents.delete(seed.path);
    try { await reloadState(); } catch { /* Preserve the original save error. */ }
    state = { ...state, error: messageFor(error) };
    emit();
    throw error;
  });
  lastSaveByPath.set(seed.path, operation);
  void operation.finally(() => {
    if (lastSaveByPath.get(seed.path) === operation) lastSaveByPath.delete(seed.path);
  }).catch(() => undefined);
  persistenceQueue = operation.catch(() => undefined);
  return operation;
}

export function saveHarnessLessonFile(seed: HarnessProjectSeed) {
  return enqueueSave(seed, "lesson");
}

export function stageHarnessLessonFile(seed: HarnessProjectSeed) {
  optimisticContents.set(seed.path, seed.content);
  stagedLessonSeeds.set(seed.path, seed);
  const existing = stagedLessonTimers.get(seed.path);
  if (existing) clearTimeout(existing);
  stagedLessonTimers.set(seed.path, setTimeout(() => {
    stagedLessonTimers.delete(seed.path);
    const latest = stagedLessonSeeds.get(seed.path);
    stagedLessonSeeds.delete(seed.path);
    if (latest) void saveHarnessLessonFile(latest).catch(() => undefined);
  }, 350));
}

function drainStagedLessonFiles() {
  const seeds = [...stagedLessonSeeds.values()];
  stagedLessonSeeds.clear();
  for (const timer of stagedLessonTimers.values()) clearTimeout(timer);
  stagedLessonTimers.clear();
  for (const seed of seeds) void saveHarnessLessonFile(seed).catch(() => undefined);
}

export function saveHarnessWorkspaceFile(path: string, content: string) {
  const current = state.files[path];
  if (!current) return Promise.reject(new Error(`${path} is not part of the Harness project.`));
  return enqueueSave({
    path,
    track: "harness",
    title: current.title,
    content,
    referenceContent: current.referenceContent ?? content,
    lessonId: current.lessonId ?? "",
    verifiedCells: content === current.content ? current.verifiedCells ?? 0 : 0,
    totalCells: current.totalCells ?? 1,
  }, "ide");
}

export function harnessFileSourceIsCurrent(path: string, content: string) {
  return (optimisticContents.get(path) ?? state.files[path]?.content) === content;
}

export function flushHarnessWorkspacePersistence() {
  drainStagedLessonFiles();
  return persistenceQueue.then(() => undefined);
}

export async function selectHarnessWorkspaceFile(path: string) {
  await initializeHarnessWorkspace();
  const { repositories } = await getPersistenceContext();
  await repositories.projects.selectFile(HARNESS_PROJECT_ID, path);
  state = { ...state, selectedPath: path, project: state.project ? { ...state.project, selectedPath: path } : state.project };
  emit();
}

export async function harnessFileRevisions(path: string): Promise<FileRevisionRecord[]> {
  const { repositories } = await getPersistenceContext();
  return repositories.projects.listFileRevisions(HARNESS_PROJECT_ID, path);
}

/** Restore source-bound lesson work without overwriting a newer IDE draft. */
export async function reconcileHarnessWorkspaceWithLearner() {
  await initializeHarnessWorkspace();
  const learner = loadLearnerState();
  for (const lesson of harnessEngineeringLessons) {
    const progress = learner.lessons[lesson.id];
    if (!progress) continue;
    const working = workingPracticeSources(
      lesson.implementation.filename,
      lesson.implementation.codeBlocks,
      progress.answers,
    );
    const verification = restoreWorkingSourceVerification(
      lesson.implementation.codeBlocks.map((block) => block.id),
      working,
      progress.verifiedCells,
      progress.verifiedSources ?? {},
      progress.verifiedContractVersion,
      HARNESS_PROJECT_CONTRACT_VERSION,
    );
    const desired = harnessLessonProjectSeed(lesson, working, verification.ids);
    const current = state.files[desired.path];
    if (!current || current.sourceProvenance === "ide") continue;
    if (current.content === desired.content && current.verifiedCells === desired.verifiedCells) continue;
    await saveHarnessLessonFile(desired);
  }
  await flushHarnessWorkspacePersistence();
  return state;
}

export type HarnessRunEvidence = {
  projectRevision: number;
  sourceTreeHash: string;
  files: Readonly<Record<string, string>>;
};

export function firstHarnessSourceMismatch(
  visibleFiles: Readonly<Record<string, string>>,
  durableFiles: Readonly<Record<string, string>>,
) {
  const paths = [...new Set([...Object.keys(visibleFiles), ...Object.keys(durableFiles)])].sort();
  return paths.find((path) => visibleFiles[path] !== durableFiles[path]) ?? null;
}

export async function harnessRunEvidence(): Promise<HarnessRunEvidence> {
  await flushHarnessWorkspacePersistence();
  const { repositories } = await getPersistenceContext();
  const project = await repositories.projects.get(HARNESS_PROJECT_ID);
  if (!project) throw new Error("The Harness project is not available.");
  const files = await repositories.projects.listFiles(HARNESS_PROJECT_ID);
  const sourceFiles = files.map((file) => ({ path: file.path, content: file.content }));
  return {
    projectRevision: project.draftRevision,
    sourceTreeHash: await hashSourceTree(sourceFiles),
    files: Object.fromEntries(sourceFiles.map((file) => [file.path, file.content])),
  };
}

export async function recordHarnessTestRun(
  evidence: HarnessRunEvidence,
  results: readonly TestResultRecord[],
): Promise<TestReceiptRecord> {
  const current = await harnessRunEvidence();
  if (current.projectRevision !== evidence.projectRevision || current.sourceTreeHash !== evidence.sourceTreeHash) {
    throw new Error("The project changed while its tests were running. Run the current source again.");
  }
  const { repositories } = await getPersistenceContext();
  const run = await repositories.assessments.start({
    projectId: HARNESS_PROJECT_ID,
    projectRevision: evidence.projectRevision,
    sourceTreeHash: evidence.sourceTreeHash,
    contractVersion: HARNESS_PROJECT_CONTRACT_VERSION,
    runnerVersion: HARNESS_PROJECT_RUNNER_VERSION,
  });
  return repositories.assessments.finish(run.id, [...results]);
}

export type CurrentHarnessReceipt = {
  receipt: TestReceiptRecord;
  run: TestRunRecord;
} | null;

export async function currentHarnessReceipt(): Promise<CurrentHarnessReceipt> {
  const evidence = await harnessRunEvidence();
  const { database } = await getPersistenceContext();
  const receipts = await database.testReceipts.where("projectId").equals(HARNESS_PROJECT_ID).reverse().sortBy("createdAt");
  const receipt = receipts.find((candidate) => (
    candidate.projectRevision === evidence.projectRevision
    && candidate.sourceTreeHash === evidence.sourceTreeHash
    && candidate.contractVersion === HARNESS_PROJECT_CONTRACT_VERSION
    && candidate.runnerVersion === HARNESS_PROJECT_RUNNER_VERSION
    && candidate.origin === "host"
  ));
  if (!receipt) return null;
  const run = await database.testRuns.get(receipt.runId);
  return run ? { receipt, run } : null;
}

export function harnessLessonForPath(path: string): CourseLesson | undefined {
  return harnessEngineeringLessons.find((lesson) => harnessLessonProjectSeed(lesson).path === path);
}
