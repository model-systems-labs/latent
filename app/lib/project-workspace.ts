"use client";

import { useEffect, useState } from "react";
import type { BrowserLabTestResult } from "./browser-lab";
import { getPersistenceContext } from "../platform/persistence/client";
import type { JsonValue } from "../platform/persistence/types";
import { LATENT_TENSOR_PATH, LATENT_TENSOR_SOURCE } from "@latent/tensor/browser-source";
import { CANONICAL_BROWSER_CHAT_FILES } from "../content/browser-chat/project-template";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { hashProjectSnapshotSources, projectSnapshotSourcePayload } from "../features/ide/project-snapshot";
import type { BuildRecord } from "../platform/persistence/types";

export const PROJECT_STORAGE_KEY = "latent-project-v1";
export const PROJECT_DRAFT_RECOVERY_KEY = "latent-project-draft-recovery-v2:";
const LEGACY_PROJECT_DRAFT_RECOVERY_KEY = "latent-project-draft-recovery-v1";
const PROJECT_RECOVERY_SESSION_KEY = "latent-project-recovery-session-v1";
const PROJECT_CHANGE_EVENT = "latent-project-change";
const PROJECT_PERSISTENCE_EVENT = "latent-project-persistence";
const PROJECT_ID = "browser-chat";

export type ProjectCourse = "runtime" | "models" | "systems" | "backend" | "product" | "app";

export type ProjectFile = {
  path: string;
  courseId: ProjectCourse;
  title: string;
  content: string;
  referenceContent: string;
  lessonId?: string;
  verifiedCells: number;
  totalCells: number;
  updatedAt: number;
  readOnly?: boolean;
  sourceProvenance?: "seed" | "lesson" | "ide";
};

export type ProjectRuntime = {
  version: 1;
  model: { temperature: number; topK: number; maxTokens: number; seed: number };
  transport: { wordsPerEvent: number; delayMs: number };
  interface: { assistantName: string; responsePrefix: string; showMetrics: boolean };
  buildNumber: number;
  builtAt: number;
};

export type ProjectActiveBuild = {
  id: string;
  buildNumber: number;
  sourceTreeHash: string;
  projectRevision: number;
  contractVersion: string;
};

export type ProjectUnitResult = BrowserLabTestResult;

export type ProjectState = {
  version: 1;
  files: Record<string, ProjectFile>;
  selectedPath: string;
  runtime: ProjectRuntime;
  activeBuild: ProjectActiveBuild | null;
  output: { previous: string; current: string };
  tests: {
    results: Record<string, ProjectUnitResult[]>;
    ranAt: number;
    runner: "none" | "legacy" | "browser-lab-v1";
    sourceTreeHash: string | null;
    projectRevision: number | null;
    contractVersion: string | null;
    contractIdsByPath: Record<string, string[]>;
  };
};

export type ProjectDraftRecovery = Record<string, { content: string; updatedAt: number }>;
export type ProjectDraftRecoveryCandidate = { sessionId: string; path: string; content: string; updatedAt: number };

type ProjectPersistenceSnapshot = {
  state: ProjectState;
  previous: ProjectState | null;
};

export type ProjectTestCommitResult =
  | { accepted: true }
  | { accepted: false; reason: "stale-source" | "contract-version" | "invalid-scope" | "client-draft" };

export type SaveProjectTestResultsInput = {
  results: ProjectUnitResult[];
  expectedIdsByPath: Readonly<Record<string, readonly string[]>>;
  replaceAll?: boolean;
  sourceTreeHash: string;
  projectRevision: number;
  contractVersion: string;
  isClientSnapshotCurrent?: () => boolean;
};

export type LessonProjectSeed = Omit<ProjectFile, "updatedAt">;

export const RUNTIME_PATHS = {
  tensor: LATENT_TENSOR_PATH,
  model: "runtime/model.config.js",
  transport: "runtime/transport.config.js",
  interface: "runtime/interface.config.js",
} as const;

const DEFAULT_RUNTIME: ProjectRuntime = {
  version: 1,
  model: { temperature: 0.78, topK: 0, maxTokens: 160, seed: 71 },
  transport: { wordsPerEvent: 1, delayMs: 24 },
  interface: { assistantName: "Model", responsePrefix: "", showMetrics: true },
  buildNumber: 1,
  builtAt: 0,
};

function configSource(value: object) {
  return `export default ${JSON.stringify(value, null, 2)};`;
}

function runtimeFiles(): Record<string, ProjectFile> {
  const now = Date.now();
  const definitions = [
    { path: RUNTIME_PATHS.tensor, title: "Latent Tensor", content: LATENT_TENSOR_SOURCE, readOnly: true },
    { path: RUNTIME_PATHS.model, title: "Sampling runtime", content: configSource(DEFAULT_RUNTIME.model) },
    { path: RUNTIME_PATHS.transport, title: "Streaming transport", content: configSource(DEFAULT_RUNTIME.transport) },
    { path: RUNTIME_PATHS.interface, title: "Chat presentation", content: configSource(DEFAULT_RUNTIME.interface) },
  ];
  const runtime = definitions.map((file) => [file.path, {
    ...file,
    courseId: "runtime" as const,
    referenceContent: file.content,
    verifiedCells: 1,
    totalCells: 1,
    updatedAt: now,
    readOnly: file.readOnly,
    sourceProvenance: "seed" as const,
  }] as const);
  const application = CANONICAL_BROWSER_CHAT_FILES.map((file) => [file.path, {
    path: file.path,
    courseId: "app" as const,
    title: file.title,
    content: file.source,
    referenceContent: file.source,
    verifiedCells: file.editable ? 0 : 1,
    totalCells: 1,
    updatedAt: now,
    readOnly: !file.editable,
    sourceProvenance: "seed" as const,
  }] as const);
  return Object.fromEntries([...runtime, ...application]);
}

export function emptyProjectState(): ProjectState {
  return {
    version: 1,
    files: runtimeFiles(),
    selectedPath: RUNTIME_PATHS.model,
    runtime: { ...DEFAULT_RUNTIME, model: { ...DEFAULT_RUNTIME.model }, transport: { ...DEFAULT_RUNTIME.transport }, interface: { ...DEFAULT_RUNTIME.interface } },
    activeBuild: null,
    output: { previous: "", current: "" },
    tests: { results: {}, ranAt: 0, runner: "none", sourceTreeHash: null, projectRevision: null, contractVersion: null, contractIdsByPath: {} },
  };
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeRuntime(value: unknown): ProjectRuntime {
  if (!value || typeof value !== "object") return emptyProjectState().runtime;
  const runtime = value as Partial<ProjectRuntime>;
  return {
    version: 1,
    model: {
      temperature: finiteNumber(runtime.model?.temperature, DEFAULT_RUNTIME.model.temperature),
      topK: finiteNumber(runtime.model?.topK, DEFAULT_RUNTIME.model.topK),
      maxTokens: finiteNumber(runtime.model?.maxTokens, DEFAULT_RUNTIME.model.maxTokens),
      seed: finiteNumber(runtime.model?.seed, DEFAULT_RUNTIME.model.seed),
    },
    transport: {
      wordsPerEvent: finiteNumber(runtime.transport?.wordsPerEvent, DEFAULT_RUNTIME.transport.wordsPerEvent),
      delayMs: finiteNumber(runtime.transport?.delayMs, DEFAULT_RUNTIME.transport.delayMs),
    },
    interface: {
      assistantName: typeof runtime.interface?.assistantName === "string" ? runtime.interface.assistantName : DEFAULT_RUNTIME.interface.assistantName,
      responsePrefix: typeof runtime.interface?.responsePrefix === "string" ? runtime.interface.responsePrefix : DEFAULT_RUNTIME.interface.responsePrefix,
      showMetrics: typeof runtime.interface?.showMetrics === "boolean" ? runtime.interface.showMetrics : DEFAULT_RUNTIME.interface.showMetrics,
    },
    buildNumber: Math.max(1, Math.round(finiteNumber(runtime.buildNumber, 1))),
    builtAt: finiteNumber(runtime.builtAt, 0),
  };
}

function sanitizeActiveBuild(value: unknown): ProjectActiveBuild | null {
  if (!value || typeof value !== "object") return null;
  const build = value as Partial<ProjectActiveBuild>;
  if (
    typeof build.id !== "string"
    || !build.id
    || typeof build.sourceTreeHash !== "string"
    || typeof build.contractVersion !== "string"
    || typeof build.buildNumber !== "number"
    || !Number.isSafeInteger(build.buildNumber)
    || build.buildNumber < 1
    || typeof build.projectRevision !== "number"
    || !Number.isSafeInteger(build.projectRevision)
    || build.projectRevision < 0
  ) return null;
  return {
    id: build.id,
    buildNumber: build.buildNumber,
    sourceTreeHash: build.sourceTreeHash,
    projectRevision: build.projectRevision,
    contractVersion: build.contractVersion,
  };
}

export function projectActiveBuildIdentity(build: Pick<BuildRecord, "id" | "buildNumber" | "sourceTreeHash" | "projectRevision" | "contractVersion">): ProjectActiveBuild {
  return {
    id: build.id,
    buildNumber: build.buildNumber,
    sourceTreeHash: build.sourceTreeHash,
    projectRevision: build.projectRevision,
    contractVersion: build.contractVersion,
  };
}

function sanitizeProjectState(value: unknown): ProjectState {
  const base = emptyProjectState();
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) return base;
  const candidate = value as Partial<ProjectState>;
  const files: Record<string, ProjectFile> = { ...base.files };
  if (candidate.files && typeof candidate.files === "object") {
    for (const [path, raw] of Object.entries(candidate.files)) {
      if (base.files[path]?.readOnly) continue;
      if (!raw || typeof raw !== "object") continue;
      const file = raw as Partial<ProjectFile>;
      if (typeof file.content !== "string" || typeof file.title !== "string") continue;
      const courseId = ["runtime", "models", "systems", "backend", "product", "app"].includes(String(file.courseId)) ? file.courseId as ProjectCourse : "runtime";
      files[path] = {
        path,
        courseId,
        title: file.title,
        content: file.content,
        referenceContent: typeof file.referenceContent === "string" ? file.referenceContent : file.content,
        lessonId: typeof file.lessonId === "string" ? file.lessonId : undefined,
        verifiedCells: Math.max(0, Math.round(finiteNumber(file.verifiedCells, 0))),
        totalCells: Math.max(1, Math.round(finiteNumber(file.totalCells, 1))),
        updatedAt: finiteNumber(file.updatedAt, 0),
        readOnly: false,
        sourceProvenance: file.sourceProvenance === "seed" || file.sourceProvenance === "lesson" || file.sourceProvenance === "ide"
          ? file.sourceProvenance
          : undefined,
      };
    }
  }
  const selectedPath = typeof candidate.selectedPath === "string" && files[candidate.selectedPath] ? candidate.selectedPath : RUNTIME_PATHS.model;
  const rawOutput = candidate.output as Partial<ProjectState["output"]> | undefined;
  const output = {
    previous: typeof rawOutput?.previous === "string" ? rawOutput.previous : "",
    current: typeof rawOutput?.current === "string" ? rawOutput.current : "",
  };
  const rawTests = candidate.tests as Partial<ProjectState["tests"]> | undefined;
  const testResults: Record<string, ProjectUnitResult[]> = {};
  if (rawTests?.results && typeof rawTests.results === "object") {
    for (const [path, results] of Object.entries(rawTests.results)) {
      if (!Array.isArray(results)) continue;
      testResults[path] = results.filter((result): result is ProjectUnitResult => Boolean(result) && typeof result === "object" && typeof result.id === "string" && typeof result.label === "string" && typeof result.passed === "boolean" && typeof result.detail === "string")
        .map((result) => ({ ...result, path }));
    }
  }
  const tests = {
    results: testResults,
    ranAt: finiteNumber(rawTests?.ranAt, 0),
    runner: rawTests?.runner === "browser-lab-v1" ? "browser-lab-v1" as const : Object.keys(testResults).length ? "legacy" as const : "none" as const,
    sourceTreeHash: typeof rawTests?.sourceTreeHash === "string" ? rawTests.sourceTreeHash : null,
    projectRevision: typeof rawTests?.projectRevision === "number" && Number.isSafeInteger(rawTests.projectRevision) && rawTests.projectRevision >= 0
      ? rawTests.projectRevision
      : null,
    contractVersion: typeof rawTests?.contractVersion === "string" ? rawTests.contractVersion : null,
    contractIdsByPath: rawTests?.contractIdsByPath && typeof rawTests.contractIdsByPath === "object"
      ? Object.fromEntries(Object.entries(rawTests.contractIdsByPath).flatMap(([path, ids]) => (
          Array.isArray(ids) && ids.every((id) => typeof id === "string") ? [[path, [...ids]]] : []
        )))
      : {},
  };
  return { version: 1, files, selectedPath, runtime: sanitizeRuntime(candidate.runtime), activeBuild: sanitizeActiveBuild(candidate.activeBuild), output, tests };
}

function emptyProjectTestState(): ProjectState["tests"] {
  return {
    results: {},
    ranAt: 0,
    runner: "none",
    sourceTreeHash: null,
    projectRevision: null,
    contractVersion: null,
    contractIdsByPath: {},
  };
}

function sanitizeProjectDraftRecovery(value: unknown): ProjectDraftRecovery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([path, draft]) => {
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return [];
    const candidate = draft as { content?: unknown; updatedAt?: unknown };
    if (typeof candidate.content !== "string") return [];
    return [[path, {
      content: candidate.content,
      updatedAt: finiteNumber(candidate.updatedAt, 0),
    }]];
  }));
}

let inMemoryRecoverySessionId: string | null = null;

function projectRecoverySessionId() {
  if (inMemoryRecoverySessionId) return inMemoryRecoverySessionId;
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage?.getItem(PROJECT_RECOVERY_SESSION_KEY);
    if (existing) return (inMemoryRecoverySessionId = existing);
    const created = `tab-${crypto.randomUUID()}`;
    window.sessionStorage?.setItem(PROJECT_RECOVERY_SESSION_KEY, created);
    return (inMemoryRecoverySessionId = created);
  } catch {
    return (inMemoryRecoverySessionId = `tab-${crypto.randomUUID()}`);
  }
}

export function projectDraftRecoveryStorageKey(sessionId = projectRecoverySessionId()) {
  return `${PROJECT_DRAFT_RECOVERY_KEY}${sessionId}`;
}

function readRecoveryKey(key: string): ProjectDraftRecovery {
  if (typeof window === "undefined") return {};
  try {
    const serialized = window.localStorage.getItem(key);
    return serialized ? sanitizeProjectDraftRecovery(JSON.parse(serialized)) : {};
  } catch {
    return {};
  }
}

function projectRecoveryKeys() {
  if (typeof window === "undefined") return [];
  const keys = new Set<string>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(PROJECT_DRAFT_RECOVERY_KEY)) keys.add(key);
    }
  } catch {
    // Some test/private storage implementations do not expose key iteration.
  }
  keys.add(projectDraftRecoveryStorageKey());
  return [...keys];
}

function readProjectDraftRecovery(): ProjectDraftRecovery {
  const key = projectDraftRecoveryStorageKey();
  const current = readRecoveryKey(key);
  if (Object.keys(current).length || typeof window === "undefined") return current;
  const legacy = readRecoveryKey(LEGACY_PROJECT_DRAFT_RECOVERY_KEY);
  if (!Object.keys(legacy).length) return current;
  try {
    window.localStorage.setItem(key, JSON.stringify(legacy));
    window.localStorage.removeItem(LEGACY_PROJECT_DRAFT_RECOVERY_KEY);
  } catch {
    // The legacy journal remains readable if migration storage is unavailable.
  }
  return legacy;
}

export function listProjectDraftRecoveryCandidates(path?: string): ProjectDraftRecoveryCandidate[] {
  if (typeof window === "undefined") return [];
  const candidates = projectRecoveryKeys().flatMap((key) => {
    const sessionId = key.slice(PROJECT_DRAFT_RECOVERY_KEY.length);
    return Object.entries(readRecoveryKey(key)).flatMap(([candidatePath, draft]) => (
      !path || path === candidatePath ? [{ sessionId, path: candidatePath, ...draft }] : []
    ));
  });
  const legacy = readRecoveryKey(LEGACY_PROJECT_DRAFT_RECOVERY_KEY);
  for (const [candidatePath, draft] of Object.entries(legacy)) {
    if (!path || path === candidatePath) candidates.push({ sessionId: "legacy", path: candidatePath, ...draft });
  }
  return candidates.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function discardProjectDraftRecoveryCandidate(sessionId: string, path: string) {
  if (typeof window === "undefined") return;
  const key = sessionId === "legacy" ? LEGACY_PROJECT_DRAFT_RECOVERY_KEY : projectDraftRecoveryStorageKey(sessionId);
  const recovery = readRecoveryKey(key);
  delete recovery[path];
  try {
    if (Object.keys(recovery).length) window.localStorage.setItem(key, JSON.stringify(recovery));
    else window.localStorage.removeItem(key);
  } catch {
    // Keep the visible candidate when storage cannot be changed.
  }
}

export function projectStateWithRecoveredDrafts(state: ProjectState, recovery: ProjectDraftRecovery): ProjectState {
  const files = { ...state.files };
  let changed = false;
  for (const [path, draft] of Object.entries(recovery)) {
    const file = files[path];
    if (!file || file.readOnly || file.content === draft.content) continue;
    files[path] = {
      ...file,
      content: draft.content,
      verifiedCells: file.lessonId ? 0 : file.verifiedCells,
      updatedAt: Math.max(file.updatedAt, draft.updatedAt),
      sourceProvenance: "ide",
    };
    changed = true;
  }
  return changed ? { ...state, files, tests: emptyProjectTestState() } : state;
}

export function stageProjectDraftRecovery(path: string, content: string, updatedAt = Date.now()) {
  if (typeof window === "undefined") return false;
  try {
    const recovery = readProjectDraftRecovery();
    recovery[path] = { content, updatedAt };
    window.localStorage.setItem(projectDraftRecoveryStorageKey(), JSON.stringify(recovery));
    return true;
  } catch {
    // IndexedDB autosave still runs when synchronous recovery storage is unavailable.
    return false;
  }
}

export function loadProjectDraftRecoveryCandidate(candidate: ProjectDraftRecoveryCandidate, minimumUpdatedAt = 0) {
  const currentSessionId = projectRecoverySessionId();
  const restaged = stageProjectDraftRecovery(
    candidate.path,
    candidate.content,
    Math.max(Date.now(), minimumUpdatedAt, candidate.updatedAt + 1),
  );
  if (!restaged) return false;
  if (candidate.sessionId !== currentSessionId) {
    discardProjectDraftRecoveryCandidate(candidate.sessionId, candidate.path);
  }
  return true;
}

function clearPersistedProjectDraftRecovery(state: ProjectState, durablePaths: ReadonlySet<string>) {
  if (typeof window === "undefined") return;
  try {
    const recovery = readProjectDraftRecovery();
    const remaining = Object.fromEntries(Object.entries(recovery).filter(([path, draft]) => (
      !durablePaths.has(path) || state.files[path]?.content !== draft.content
    )));
    if (Object.keys(remaining).length) {
      window.localStorage.setItem(projectDraftRecoveryStorageKey(), JSON.stringify(remaining));
    } else {
      window.localStorage.removeItem(projectDraftRecoveryStorageKey());
    }
  } catch {
    // A stale recovery journal is harmless: hydration only reapplies its exact bytes.
  }
}

/**
 * Numeric revisions are ordering metadata, not byte identity. Imports can
 * legitimately contain the same revision number with different source, so
 * hydration re-hashes the restored VFS before admitting any saved receipt.
 */
export async function projectTestsForRestoredSnapshot(
  tests: ProjectState["tests"],
  files: Readonly<Record<string, ProjectFile>>,
  currentProjectRevision: number,
): Promise<ProjectState["tests"]> {
  if (tests.runner === "none" && !Object.keys(tests.results).length) return tests;
  if (
    tests.runner !== "browser-lab-v1"
    || tests.projectRevision !== currentProjectRevision
    || tests.sourceTreeHash === null
    || tests.contractVersion !== llmSystemsContractSuite.contractVersion
  ) return emptyProjectTestState();
  const currentSourceTreeHash = await hashProjectSnapshotSources(files);
  return currentSourceTreeHash === tests.sourceTreeHash ? tests : emptyProjectTestState();
}

function loadLegacyProjectState() {
  if (typeof window === "undefined") return emptyProjectState();
  try {
    const serialized = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!serialized) return emptyProjectState();
    const legacy = sanitizeProjectState(JSON.parse(serialized));
    // Active-build authority lives in the validated build repository. A
    // denormalized localStorage field can never mint portfolio eligibility.
    return projectStateWithRecoveredDrafts({ ...legacy, activeBuild: null }, readProjectDraftRecovery());
  } catch {
    return projectStateWithRecoveredDrafts(emptyProjectState(), readProjectDraftRecovery());
  }
}

let cachedProject: ProjectState | null = null;
let hydrationPromise: Promise<void> | null = null;
let persistenceQueue: Promise<void> = Promise.resolve();
let recoveredProjectPersistenceBase: ProjectState | null = null;
let pendingPersistence: ProjectPersistenceSnapshot | null = null;
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
let projectPersistenceError: string | null = null;

function announceProjectChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT));
}

export function loadProjectState() {
  return cachedProject ?? loadLegacyProjectState();
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function persistedFileMatchesProjectFile(
  persisted: { track: string; title: string; content: string; referenceContent: string | null; lessonId: string | null; verifiedCells?: number; totalCells?: number; sourceProvenance?: "seed" | "lesson" | "ide"; revision: number },
  file: ProjectFile,
) {
  const persistedProvenance = persisted.sourceProvenance ?? (persisted.revision > 1 ? "ide" : undefined);
  return persisted.track === file.courseId
    && persisted.title === file.title
    && persisted.content === file.content
    && persisted.referenceContent === file.referenceContent
    && persisted.lessonId === (file.lessonId ?? null)
    && (persisted.verifiedCells ?? 0) === file.verifiedCells
    && (persisted.totalCells ?? 1) === file.totalCells
    && persistedProvenance === file.sourceProvenance;
}

function projectPersistenceDiff(state: ProjectState, previous: ProjectState | null) {
  if (!previous) return { changedPaths: Object.keys(state.files), removedPaths: [] as string[] };
  const changedPaths = Object.keys(state.files).filter((path) => {
    const before = previous.files[path];
    const after = state.files[path];
    return !before || !sameJson({ ...before, updatedAt: 0 }, { ...after, updatedAt: 0 });
  });
  const removedPaths = Object.keys(previous.files).filter((path) => !state.files[path]);
  return { changedPaths, removedPaths };
}

function setProjectPersistenceError(error: unknown) {
  projectPersistenceError = error
    ? error instanceof Error ? error.message : "This browser can't save the project."
    : null;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROJECT_PERSISTENCE_EVENT));
}

export function getProjectPersistenceError() {
  return projectPersistenceError;
}

async function persistProjectState(state: ProjectState, previous: ProjectState | null) {
  const { repositories } = await getPersistenceContext();
  let project = await repositories.projects.get(PROJECT_ID);
  if (!project) {
    project = await repositories.projects.create({
      id: PROJECT_ID,
      title: "Browser Chat",
      courseId: "llm-systems",
      selectedPath: state.selectedPath,
    });
  }
  const { changedPaths, removedPaths } = projectPersistenceDiff(state, previous);
  const durablePaths = new Set<string>();
  for (const path of changedPaths) {
    const file = state.files[path];
    const before = previous?.files[path];
    const persisted = await repositories.projects.getFile(PROJECT_ID, path);
    if (persisted && persistedFileMatchesProjectFile(persisted, file)) {
      durablePaths.add(path);
      continue;
    }
    if (persisted && before && !persistedFileMatchesProjectFile(persisted, before)) {
      throw new Error(`${path} changed in another tab. Your recovery copy is safe; reload before choosing which version to keep.`);
    }
    if (persisted && !before) {
      throw new Error(`${path} was created in another tab. Your recovery copy is safe; reload before choosing which version to keep.`);
    }
    await repositories.projects.saveFile({
      projectId: PROJECT_ID,
      path: file.path,
      track: file.courseId,
      title: file.title,
      content: file.content,
      referenceContent: file.referenceContent,
      lessonId: file.lessonId ?? null,
      verifiedCells: file.verifiedCells,
      totalCells: file.totalCells,
      sourceProvenance: file.sourceProvenance,
      reason: "edit",
      expected: persisted ? { revision: persisted.revision, sourceHash: persisted.sourceHash } : null,
    });
    durablePaths.add(path);
  }
  for (const path of removedPaths) {
    const before = previous?.files[path];
    if (!before) continue;
    const persisted = await repositories.projects.getFile(PROJECT_ID, path);
    if (!persisted) continue;
    if (!persistedFileMatchesProjectFile(persisted, before)) {
      throw new Error(`${path} changed in another tab. Your recovery copy is safe; reload before choosing which version to keep.`);
    }
    await repositories.projects.archiveFile({
      projectId: PROJECT_ID,
      path,
      expected: { revision: persisted.revision, sourceHash: persisted.sourceHash },
      replacementPath: state.selectedPath,
    });
  }
  if (changedPaths.length || removedPaths.length || !previous || previous.selectedPath !== state.selectedPath) {
    await repositories.projects.selectFile(PROJECT_ID, state.selectedPath);
  }
  const settings: Array<Promise<unknown>> = [];
  if (!previous || !sameJson(previous.runtime, state.runtime)) settings.push(repositories.settings.put("project.runtime", state.runtime as unknown as JsonValue));
  if (!previous || !sameJson(previous.output, state.output)) settings.push(repositories.settings.put("project.output", state.output as unknown as JsonValue));
  if (!previous || !sameJson(previous.tests, state.tests)) settings.push(repositories.settings.put("project.tests", state.tests as unknown as JsonValue));
  await Promise.all(settings);
  return durablePaths;
}

function enqueuePendingProjectPersistence() {
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = null;
  const pending = pendingPersistence;
  pendingPersistence = null;
  if (!pending) return;
  persistenceQueue = persistenceQueue
    .then(async () => {
      const durablePaths = await persistProjectState(pending.state, pending.previous);
      clearPersistedProjectDraftRecovery(pending.state, durablePaths);
      setProjectPersistenceError(null);
    })
    .catch((error) => {
      setProjectPersistenceError(error);
      console.error("Project persistence failed", error);
    });
}

function scheduleProjectPersistence(state: ProjectState, previous: ProjectState | null = null) {
  if (pendingPersistence) pendingPersistence.state = state;
  else pendingPersistence = { state, previous };
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(enqueuePendingProjectPersistence, 220);
}

export async function projectStateFromPersistence(): Promise<ProjectState | null> {
  const { database, repositories } = await getPersistenceContext();
  const project = await repositories.projects.get(PROJECT_ID);
  if (!project) return null;
  const certifiedActiveBuild = repositories.builds.activeValidated(PROJECT_ID).catch((error) => {
    // Source and recovery history must remain available after a contract
    // upgrade invalidates an older build. Runtime authority fails closed to
    // null; the learner can create a fresh certified build from the IDE.
    console.warn("The saved active build was rejected and will not run.", error);
    return null;
  });
  const [records, storedRuntime, storedOutput, storedTests, activeBuild, runs] = await Promise.all([
    repositories.projects.listFiles(PROJECT_ID),
    repositories.settings.get<JsonValue>("project.runtime"),
    repositories.settings.get<JsonValue>("project.output"),
    repositories.settings.get<JsonValue>("project.tests"),
    certifiedActiveBuild,
    database.testRuns.where("projectId").equals(PROJECT_ID).sortBy("completedAt"),
  ]);
  const legacy = loadLegacyProjectState();
  // Once a durable project exists, its current-file table is authoritative.
  // Legacy localStorage remains import/recovery evidence, but must not
  // resurrect a path that was deliberately archived from IndexedDB.
  const files: Record<string, ProjectFile> = { ...emptyProjectState().files };
  for (const record of records) {
    if (files[record.path]?.readOnly) continue;
    const previous = files[record.path];
    const courseId = ["runtime", "models", "systems", "backend", "product", "app"].includes(record.track) ? record.track as ProjectCourse : "models";
    files[record.path] = {
      path: record.path,
      courseId,
      title: record.title,
      content: record.content,
      referenceContent: record.referenceContent ?? previous?.referenceContent ?? record.content,
      lessonId: record.lessonId ?? previous?.lessonId,
      verifiedCells: Math.max(0, Math.round(finiteNumber(record.verifiedCells, previous?.verifiedCells ?? 0))),
      totalCells: Math.max(1, Math.round(finiteNumber(record.totalCells, previous?.totalCells ?? 1))),
      updatedAt: record.updatedAt,
      readOnly: false,
      sourceProvenance: record.sourceProvenance === "seed" || record.sourceProvenance === "lesson" || record.sourceProvenance === "ide"
        ? record.sourceProvenance
        : record.revision > 1
          ? "ide"
          : undefined,
    };
  }
  const latestRun = runs.at(-1);
  const testsFromRuns = latestRun?.results.reduce<Record<string, ProjectUnitResult[]>>((grouped, result) => {
    (grouped[result.path] ??= []).push({
      id: result.contractId,
      path: result.path,
      label: result.label,
      passed: result.passed,
      detail: result.detail,
    });
    return grouped;
  }, {});
  const activeRuntime = activeBuild
    && activeBuild.runtimeConfig
    && typeof activeBuild.runtimeConfig === "object"
    && !Array.isArray(activeBuild.runtimeConfig)
    ? {
        ...activeBuild.runtimeConfig,
        buildNumber: activeBuild.buildNumber,
        builtAt: activeBuild.createdAt,
      }
    : null;
  const candidate = {
    version: 1,
    files,
    selectedPath: project.selectedPath ?? legacy.selectedPath,
    runtime: activeRuntime ?? storedRuntime ?? legacy.runtime,
    activeBuild: activeBuild ? projectActiveBuildIdentity(activeBuild) : null,
    output: storedOutput ?? legacy.output,
    tests: storedTests ?? (testsFromRuns ? {
      results: testsFromRuns,
      ranAt: latestRun?.completedAt ?? 0,
      runner: latestRun?.runnerVersion === "browser-lab-quickjs-v1"
        || latestRun?.runnerVersion === "browser-lab-cpython-v1"
        ? "browser-lab-v1"
        : "legacy",
      sourceTreeHash: latestRun?.sourceTreeHash ?? null,
      projectRevision: latestRun?.projectRevision ?? null,
      contractVersion: latestRun?.contractVersion ?? null,
      contractIdsByPath: {},
    } : legacy.tests),
  };
  const persistedBase = sanitizeProjectState(candidate);
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const safeRecovery = Object.fromEntries(Object.entries(readProjectDraftRecovery()).filter(([path, draft]) => {
    const record = recordsByPath.get(path);
    return !record || record.content === draft.content || draft.updatedAt > record.updatedAt;
  }));
  const restored = projectStateWithRecoveredDrafts(persistedBase, safeRecovery);
  recoveredProjectPersistenceBase = restored === persistedBase ? null : persistedBase;
  restored.tests = await projectTestsForRestoredSnapshot(restored.tests, restored.files, project.draftRevision);
  clearPersistedProjectDraftRecovery(restored, new Set(records.filter((record) => restored.files[record.path]?.content === record.content).map((record) => record.path)));
  return restored;
}

export function initializeProjectPersistence() {
  if (typeof window === "undefined") return Promise.resolve();
  hydrationPromise ??= (async () => {
    const persisted = await projectStateFromPersistence();
    const recoveryBase = recoveredProjectPersistenceBase;
    recoveredProjectPersistenceBase = null;
    if (cachedProject) {
      scheduleProjectPersistence(cachedProject, recoveryBase ?? persisted);
    } else {
      cachedProject = persisted ?? loadLegacyProjectState();
      if (recoveryBase) scheduleProjectPersistence(cachedProject, recoveryBase);
      else if (!persisted) scheduleProjectPersistence(cachedProject);
    }
    announceProjectChange();
  })().catch((error) => {
    console.error("Project hydration failed", error);
    cachedProject ??= loadLegacyProjectState();
    announceProjectChange();
  });
  return hydrationPromise;
}

export async function flushProjectPersistence() {
  await initializeProjectPersistence();
  enqueuePendingProjectPersistence();
  await persistenceQueue;
  if (projectPersistenceError) throw new Error(projectPersistenceError);
}

/**
 * Fail closed before promoting source-bound output. The in-memory comparison
 * catches this tab, recovery journals catch unsaved edits from another tab,
 * and the repository read bypasses the tab-local cache for durable edits.
 */
export async function projectFileSourceIsCurrent(
  path: string,
  expectedContent: string,
) {
  await initializeProjectPersistence();
  if (loadProjectState().files[path]?.content !== expectedContent) return false;
  const { repositories } = await getPersistenceContext();
  const persisted = await repositories.projects.getFile(PROJECT_ID, path);
  if (!persisted || persisted.content !== expectedContent) return false;
  const revisions = await repositories.projects.listFileRevisions(PROJECT_ID, path);
  const sourceRevision = revisions.find((revision) => revision.revision === persisted.revision);
  const durableSourceUpdatedAt = sourceRevision?.createdAt ?? persisted.updatedAt;
  return !listProjectDraftRecoveryCandidates(path).some((candidate) => (
    candidate.content !== expectedContent && candidate.updatedAt >= durableSourceUpdatedAt
  ));
}

export function updateProjectState(update: (state: ProjectState) => ProjectState) {
  const previous = loadProjectState();
  cachedProject = sanitizeProjectState(update(previous));
  scheduleProjectPersistence(cachedProject, previous);
  announceProjectChange();
  return cachedProject;
}

export function ensureProjectWorkspace(seeds: LessonProjectSeed[]) {
  return updateProjectState((state) => {
    const files = { ...state.files };
    const testResults = { ...state.tests.results };
    let selectedPath = state.selectedPath;
    let sourceTreeChanged = false;
    for (const seed of seeds) {
      for (const [path, file] of Object.entries(files)) {
        if (seed.lessonId && file.lessonId === seed.lessonId && path !== seed.path) {
          sourceTreeChanged = true;
          delete files[path];
          if (testResults[path]) {
            testResults[seed.path] = testResults[path].map((result) => ({ ...result, path: seed.path }));
            delete testResults[path];
          }
          if (selectedPath === path) selectedPath = seed.path;
        }
      }
      if (!files[seed.path]) {
        files[seed.path] = { ...seed, updatedAt: Date.now(), sourceProvenance: "seed" };
        sourceTreeChanged = true;
      } else if (seed.readOnly) {
        const current = files[seed.path];
        if (current.content !== seed.content || current.referenceContent !== seed.referenceContent || !current.readOnly) {
          files[seed.path] = { ...seed, updatedAt: current.updatedAt, sourceProvenance: "seed" };
          sourceTreeChanged = true;
        }
      } else if (files[seed.path].referenceContent !== seed.referenceContent) {
        const current = files[seed.path];
        // Seed-owned source is always safe to refresh when lesson authors revise
        // a starter. Legacy records without provenance still need the stricter
        // authored-baseline check so learner edits remain authoritative.
        const untouched = current.sourceProvenance === "seed"
          || (current.sourceProvenance === undefined && current.content === current.referenceContent);
        const nextContent = untouched
          ? seed.content
          : seed.content.startsWith("import {") && !current.content.startsWith("import {")
            ? `${seed.content.split("\n", 1)[0]}\n\n${current.content}`
            : current.content;
        files[seed.path] = {
          ...current,
          ...seed,
          content: nextContent,
          verifiedCells: nextContent === seed.content ? seed.verifiedCells : 0,
          updatedAt: nextContent === current.content ? current.updatedAt : Date.now(),
          sourceProvenance: untouched ? "seed" : current.sourceProvenance,
        };
        sourceTreeChanged = true;
      } else {
        const current = files[seed.path];
        // Challenge-first lessons use an incomplete starter as their canonical
        // working file. Refresh seed-owned source or an old untouched authored
        // baseline; a learner-edited IDE file remains authoritative.
        const migrateSeedContent = current.sourceProvenance === "seed" && current.content !== seed.content;
        const migrateAuthoredBaseline = current.sourceProvenance === undefined
          && current.content === seed.referenceContent
          && seed.content !== seed.referenceContent;
        const migrateUntouchedSource = migrateSeedContent || migrateAuthoredBaseline;
        const nextContent = migrateUntouchedSource ? seed.content : current.content;
        const nextReadOnly = seed.readOnly ?? current.readOnly;
        const nextVerifiedCells = nextContent === seed.content ? seed.verifiedCells : 0;
        if (
          current.content !== nextContent
          || current.courseId !== seed.courseId
          || current.lessonId !== seed.lessonId
          || current.title !== seed.title
          || current.verifiedCells !== nextVerifiedCells
          || current.totalCells !== seed.totalCells
          || current.readOnly !== nextReadOnly
        ) {
          files[seed.path] = {
            ...current,
            content: nextContent,
            courseId: seed.courseId,
            lessonId: seed.lessonId,
            title: seed.title,
            verifiedCells: nextVerifiedCells,
            totalCells: seed.totalCells,
            readOnly: nextReadOnly,
            updatedAt: current.content === nextContent ? current.updatedAt : Date.now(),
            sourceProvenance: migrateUntouchedSource ? "seed" : current.sourceProvenance,
          };
          if (current.content !== nextContent) sourceTreeChanged = true;
        }
      }
    }
    return {
      ...state,
      files,
      selectedPath: files[selectedPath] ? selectedPath : RUNTIME_PATHS.model,
      tests: sourceTreeChanged
        ? { results: {}, ranAt: 0, runner: "none", sourceTreeHash: null, projectRevision: null, contractVersion: null, contractIdsByPath: {} }
        : { ...state.tests, results: testResults },
    };
  });
}

export function projectStateAfterFileEdit(state: ProjectState, path: string, content: string, updatedAt = Date.now()): ProjectState {
  const file = state.files[path];
  if (!file) return state;
  if (file.readOnly) return { ...state, selectedPath: path };
  if (file.content === content) return { ...state, selectedPath: path };
  return {
    ...state,
    selectedPath: path,
    files: {
      ...state.files,
      [path]: { ...file, content, verifiedCells: file.lessonId ? 0 : file.verifiedCells, updatedAt, sourceProvenance: "ide" },
    },
    tests: { results: {}, ranAt: 0, runner: "none" as const, sourceTreeHash: null, projectRevision: null, contractVersion: null, contractIdsByPath: {} },
  };
}

export function saveProjectFile(path: string, content: string) {
  stageProjectDraftRecovery(path, content);
  return updateProjectState((state) => projectStateAfterFileEdit(state, path, content));
}

export function saveLessonProjectFile(seed: LessonProjectSeed) {
  stageProjectDraftRecovery(seed.path, seed.content);
  return updateProjectState((state) => {
    const existing = state.files[seed.path];
    const contentChanged = existing?.content !== seed.content;
    const metadataChanged = !existing
      || existing.courseId !== seed.courseId
      || existing.lessonId !== seed.lessonId
      || existing.title !== seed.title
      || existing.referenceContent !== seed.referenceContent
      || existing.verifiedCells !== seed.verifiedCells
      || existing.totalCells !== seed.totalCells
      || existing.readOnly !== seed.readOnly;
    return {
      ...state,
      files: { ...state.files, [seed.path]: { ...seed, updatedAt: contentChanged || metadataChanged ? Date.now() : existing?.updatedAt ?? Date.now(), sourceProvenance: "lesson" } },
      tests: contentChanged
        ? { results: {}, ranAt: 0, runner: "none", sourceTreeHash: null, projectRevision: null, contractVersion: null, contractIdsByPath: {} }
        : state.tests,
    };
  });
}

export function selectProjectFile(path: string) {
  updateProjectState((state) => state.files[path] ? { ...state, selectedPath: path } : state);
}

function parseConfig(source: string, path: string) {
  const match = source.trim().match(/^export\s+default\s+([\s\S]+?);?\s*$/);
  if (!match) throw new Error(`${path}: start with export default, followed by a JSON object.`);
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    throw new Error(`${path}: use JSON syntax in the exported object, including quoted keys and strings.`);
  }
}

function rangedNumber(value: unknown, path: string, name: string, minimum: number, maximum: number, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    throw new Error(`${path}: ${name} must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function compileProject(files: Record<string, ProjectFile>, previous: ProjectRuntime) {
  const errors: string[] = [];
  try {
    const value = parseConfig(files[RUNTIME_PATHS.model]?.content ?? "", RUNTIME_PATHS.model);
    previous = { ...previous, model: {
      temperature: rangedNumber(value.temperature, RUNTIME_PATHS.model, "temperature", 0.2, 1.8),
      topK: rangedNumber(value.topK, RUNTIME_PATHS.model, "topK", 0, 64, true),
      maxTokens: rangedNumber(value.maxTokens, RUNTIME_PATHS.model, "maxTokens", 40, 160, true),
      seed: rangedNumber(value.seed, RUNTIME_PATHS.model, "seed", 0, 99999, true),
    } };
  } catch (error) { errors.push(error instanceof Error ? error.message : "We couldn't read the model config."); }
  try {
    const value = parseConfig(files[RUNTIME_PATHS.transport]?.content ?? "", RUNTIME_PATHS.transport);
    previous = { ...previous, transport: {
      wordsPerEvent: rangedNumber(value.wordsPerEvent, RUNTIME_PATHS.transport, "wordsPerEvent", 1, 12, true),
      delayMs: rangedNumber(value.delayMs, RUNTIME_PATHS.transport, "delayMs", 0, 200, true),
    } };
  } catch (error) { errors.push(error instanceof Error ? error.message : "We couldn't read the transport config."); }
  try {
    const value = parseConfig(files[RUNTIME_PATHS.interface]?.content ?? "", RUNTIME_PATHS.interface);
    if (typeof value.assistantName !== "string" || !value.assistantName.trim() || value.assistantName.length > 24) throw new Error(`${RUNTIME_PATHS.interface}: assistantName must be 1–24 characters long.`);
    if (typeof value.responsePrefix !== "string" || value.responsePrefix.length > 60) throw new Error(`${RUNTIME_PATHS.interface}: responsePrefix must be 60 characters or fewer.`);
    if (typeof value.showMetrics !== "boolean") throw new Error(`${RUNTIME_PATHS.interface}: showMetrics must be true or false.`);
    previous = { ...previous, interface: { assistantName: value.assistantName.trim(), responsePrefix: value.responsePrefix, showMetrics: value.showMetrics } };
  } catch (error) { errors.push(error instanceof Error ? error.message : "We couldn't read the interface config."); }
  if (errors.length) return { ok: false as const, errors };
  return { ok: true as const, errors: [], runtime: { ...previous, version: 1 as const, buildNumber: previous.buildNumber + 1, builtAt: Date.now() } };
}

export function saveProjectRuntime(runtime: ProjectRuntime, preview: string, activeBuild: ProjectActiveBuild) {
  return updateProjectState((state) => ({ ...state, runtime, activeBuild, output: { previous: state.output.current, current: preview } }));
}

function normalizedProjectTestScope(
  results: readonly ProjectUnitResult[],
  expectedIdsByPath: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> | null {
  const expectedPaths = Object.keys(expectedIdsByPath).sort((left, right) => left.localeCompare(right));
  if (!expectedPaths.length) return null;
  const resultPaths = [...new Set(results.map((result) => result.path))].sort((left, right) => left.localeCompare(right));
  if (resultPaths.length !== expectedPaths.length || resultPaths.some((path, index) => path !== expectedPaths[index])) return null;
  const normalized: Record<string, string[]> = {};
  for (const path of expectedPaths) {
    const expected = [...expectedIdsByPath[path]].sort((left, right) => left.localeCompare(right));
    const expectedSet = new Set(expected);
    const actual = results.filter((result) => result.path === path).map((result) => result.id).sort((left, right) => left.localeCompare(right));
    const actualSet = new Set(actual);
    if (
      !expected.length
      || expectedSet.size !== expected.length
      || actualSet.size !== actual.length
      || actual.length !== expected.length
      || actual.some((id, index) => id !== expected[index])
    ) return null;
    normalized[path] = expected;
  }
  return normalized;
}

export function projectTestResultScopeIsExact(
  results: readonly ProjectUnitResult[],
  expectedIdsByPath: Readonly<Record<string, readonly string[]>>,
) {
  return normalizedProjectTestScope(results, expectedIdsByPath) !== null;
}

export async function saveProjectTestResults({
  results,
  expectedIdsByPath,
  replaceAll = false,
  sourceTreeHash,
  projectRevision,
  contractVersion,
  isClientSnapshotCurrent = () => true,
}: SaveProjectTestResultsInput): Promise<ProjectTestCommitResult> {
  const normalizedScope = normalizedProjectTestScope(results, expectedIdsByPath);
  if (!normalizedScope) return { accepted: false, reason: "invalid-scope" };
  if (contractVersion !== llmSystemsContractSuite.contractVersion) {
    return { accepted: false, reason: "contract-version" };
  }
  if (!isClientSnapshotCurrent()) return { accepted: false, reason: "client-draft" };
  await flushProjectPersistence();
  const { repositories } = await getPersistenceContext();
  const [persistedProject, persistedFiles] = await Promise.all([
    repositories.projects.get(PROJECT_ID),
    repositories.projects.listFiles(PROJECT_ID),
  ]);
  const persistedSources = Object.fromEntries(persistedFiles.map((file) => [file.path, {
    path: file.path,
    content: file.content,
  }]));
  const [persistedSourceHash, persistedPayload] = await Promise.all([
    hashProjectSnapshotSources(persistedSources),
    Promise.resolve(projectSnapshotSourcePayload(persistedSources)),
  ]);
  const currentPayload = projectSnapshotSourcePayload(loadProjectState().files);
  if (
    !persistedProject
    || persistedProject.draftRevision !== projectRevision
    || persistedSourceHash !== sourceTreeHash
    || currentPayload !== persistedPayload
  ) {
    return { accepted: false, reason: "stale-source" };
  }
  if (!isClientSnapshotCurrent()) return { accepted: false, reason: "client-draft" };
  updateProjectState((state) => {
    const canMerge = state.tests.runner === "browser-lab-v1"
      && state.tests.sourceTreeHash === sourceTreeHash
      && state.tests.projectRevision === projectRevision
      && state.tests.contractVersion === contractVersion;
    const nextResults = replaceAll || !canMerge ? {} as Record<string, ProjectUnitResult[]> : { ...state.tests.results };
    const nextContractIdsByPath = replaceAll || !canMerge ? {} as Record<string, string[]> : { ...state.tests.contractIdsByPath };
    for (const path of Object.keys(normalizedScope)) {
      nextResults[path] = [];
      nextContractIdsByPath[path] = normalizedScope[path];
    }
    for (const result of results) {
      nextResults[result.path].push(result);
    }
    return {
      ...state,
      tests: { results: nextResults, ranAt: Date.now(), runner: "browser-lab-v1", sourceTreeHash, projectRevision, contractVersion, contractIdsByPath: nextContractIdsByPath },
    };
  });
  return { accepted: true };
}

export function useProjectState() {
  const [state, setState] = useState<ProjectState>(() => emptyProjectState());
  useEffect(() => {
    const refresh = () => setState(loadProjectState());
    refresh();
    void initializeProjectPersistence();
    window.addEventListener(PROJECT_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROJECT_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return state;
}

export function useProjectPersistenceError() {
  const [error, setError] = useState<string | null>(() => getProjectPersistenceError());
  useEffect(() => {
    const refresh = () => setError(getProjectPersistenceError());
    window.addEventListener(PROJECT_PERSISTENCE_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_PERSISTENCE_EVENT, refresh);
  }, []);
  return error;
}
