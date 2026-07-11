"use client";

import { useEffect, useState } from "react";

export const PROJECT_STORAGE_KEY = "latent-project-v1";
const PROJECT_CHANGE_EVENT = "latent-project-change";

export type ProjectCourse = "runtime" | "models" | "systems" | "product";

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
};

export type ProjectRuntime = {
  version: 1;
  model: { temperature: number; topK: number; maxTokens: number; seed: number };
  transport: { wordsPerEvent: number; delayMs: number };
  interface: { assistantName: string; responsePrefix: string; showMetrics: boolean };
  buildNumber: number;
  builtAt: number;
};

export type ProjectUnitResult = {
  id: string;
  path: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ProjectState = {
  version: 1;
  files: Record<string, ProjectFile>;
  selectedPath: string;
  runtime: ProjectRuntime;
  output: { previous: string; current: string };
  tests: { results: Record<string, ProjectUnitResult[]>; ranAt: number };
};

export type LessonProjectSeed = Omit<ProjectFile, "updatedAt">;

export const RUNTIME_PATHS = {
  model: "runtime/model.config.js",
  transport: "runtime/transport.config.js",
  interface: "runtime/interface.config.js",
} as const;

const DEFAULT_RUNTIME: ProjectRuntime = {
  version: 1,
  model: { temperature: 0.78, topK: 0, maxTokens: 180, seed: 71 },
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
    { path: RUNTIME_PATHS.model, title: "Sampling runtime", content: configSource(DEFAULT_RUNTIME.model) },
    { path: RUNTIME_PATHS.transport, title: "Streaming transport", content: configSource(DEFAULT_RUNTIME.transport) },
    { path: RUNTIME_PATHS.interface, title: "Chat presentation", content: configSource(DEFAULT_RUNTIME.interface) },
  ];
  return Object.fromEntries(definitions.map((file) => [file.path, {
    ...file,
    courseId: "runtime" as const,
    referenceContent: file.content,
    verifiedCells: 1,
    totalCells: 1,
    updatedAt: now,
  }]));
}

export function emptyProjectState(): ProjectState {
  return {
    version: 1,
    files: runtimeFiles(),
    selectedPath: RUNTIME_PATHS.model,
    runtime: { ...DEFAULT_RUNTIME, model: { ...DEFAULT_RUNTIME.model }, transport: { ...DEFAULT_RUNTIME.transport }, interface: { ...DEFAULT_RUNTIME.interface } },
    output: { previous: "", current: "" },
    tests: { results: {}, ranAt: 0 },
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

function sanitizeProjectState(value: unknown): ProjectState {
  const base = emptyProjectState();
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) return base;
  const candidate = value as Partial<ProjectState>;
  const files: Record<string, ProjectFile> = { ...base.files };
  if (candidate.files && typeof candidate.files === "object") {
    for (const [path, raw] of Object.entries(candidate.files)) {
      if (!raw || typeof raw !== "object") continue;
      const file = raw as Partial<ProjectFile>;
      if (typeof file.content !== "string" || typeof file.title !== "string") continue;
      const courseId = ["runtime", "models", "systems", "product"].includes(String(file.courseId)) ? file.courseId as ProjectCourse : "runtime";
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
  const tests = { results: testResults, ranAt: finiteNumber(rawTests?.ranAt, 0) };
  return { version: 1, files, selectedPath, runtime: sanitizeRuntime(candidate.runtime), output, tests };
}

export function loadProjectState(): ProjectState {
  if (typeof window === "undefined") return emptyProjectState();
  try {
    const serialized = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    return serialized ? sanitizeProjectState(JSON.parse(serialized)) : emptyProjectState();
  } catch {
    return emptyProjectState();
  }
}

function storeProjectState(state: ProjectState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT));
}

export function updateProjectState(update: (state: ProjectState) => ProjectState) {
  const next = update(loadProjectState());
  storeProjectState(next);
  return next;
}

export function ensureProjectWorkspace(seeds: LessonProjectSeed[]) {
  return updateProjectState((state) => {
    const files = { ...state.files };
    for (const seed of seeds) {
      if (!files[seed.path]) files[seed.path] = { ...seed, updatedAt: Date.now() };
    }
    return { ...state, files };
  });
}

export function saveProjectFile(path: string, content: string) {
  return updateProjectState((state) => {
    const file = state.files[path];
    if (!file) return state;
    return { ...state, selectedPath: path, files: { ...state.files, [path]: { ...file, content, updatedAt: Date.now() } } };
  });
}

export function saveLessonProjectFile(seed: LessonProjectSeed) {
  return updateProjectState((state) => ({
    ...state,
    files: { ...state.files, [seed.path]: { ...seed, updatedAt: Date.now() } },
  }));
}

export function selectProjectFile(path: string) {
  updateProjectState((state) => state.files[path] ? { ...state, selectedPath: path } : state);
}

function parseConfig(source: string, path: string) {
  const match = source.trim().match(/^export\s+default\s+([\s\S]+?);?\s*$/);
  if (!match) throw new Error(`${path}: expected export default followed by a JSON object.`);
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    throw new Error(`${path}: the exported object must use JSON syntax with quoted keys and strings.`);
  }
}

function rangedNumber(value: unknown, path: string, name: string, minimum: number, maximum: number, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    throw new Error(`${path}: ${name} must be ${integer ? "an integer" : "a number"} from ${minimum} to ${maximum}.`);
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
      maxTokens: rangedNumber(value.maxTokens, RUNTIME_PATHS.model, "maxTokens", 40, 240, true),
      seed: rangedNumber(value.seed, RUNTIME_PATHS.model, "seed", 0, 99999, true),
    } };
  } catch (error) { errors.push(error instanceof Error ? error.message : "Model config failed."); }
  try {
    const value = parseConfig(files[RUNTIME_PATHS.transport]?.content ?? "", RUNTIME_PATHS.transport);
    previous = { ...previous, transport: {
      wordsPerEvent: rangedNumber(value.wordsPerEvent, RUNTIME_PATHS.transport, "wordsPerEvent", 1, 12, true),
      delayMs: rangedNumber(value.delayMs, RUNTIME_PATHS.transport, "delayMs", 0, 200, true),
    } };
  } catch (error) { errors.push(error instanceof Error ? error.message : "Transport config failed."); }
  try {
    const value = parseConfig(files[RUNTIME_PATHS.interface]?.content ?? "", RUNTIME_PATHS.interface);
    if (typeof value.assistantName !== "string" || !value.assistantName.trim() || value.assistantName.length > 24) throw new Error(`${RUNTIME_PATHS.interface}: assistantName must contain 1–24 characters.`);
    if (typeof value.responsePrefix !== "string" || value.responsePrefix.length > 60) throw new Error(`${RUNTIME_PATHS.interface}: responsePrefix must contain at most 60 characters.`);
    if (typeof value.showMetrics !== "boolean") throw new Error(`${RUNTIME_PATHS.interface}: showMetrics must be true or false.`);
    previous = { ...previous, interface: { assistantName: value.assistantName.trim(), responsePrefix: value.responsePrefix, showMetrics: value.showMetrics } };
  } catch (error) { errors.push(error instanceof Error ? error.message : "Interface config failed."); }
  if (errors.length) return { ok: false as const, errors };
  return { ok: true as const, errors: [], runtime: { ...previous, version: 1 as const, buildNumber: previous.buildNumber + 1, builtAt: Date.now() } };
}

export function saveProjectRuntime(runtime: ProjectRuntime, preview: string) {
  return updateProjectState((state) => ({ ...state, runtime, output: { previous: state.output.current, current: preview } }));
}

export function saveProjectTestResults(results: ProjectUnitResult[], replaceAll = false) {
  return updateProjectState((state) => {
    const nextResults = replaceAll ? {} as Record<string, ProjectUnitResult[]> : { ...state.tests.results };
    for (const path of new Set(results.map((result) => result.path))) nextResults[path] = [];
    for (const result of results) {
      nextResults[result.path].push(result);
    }
    return { ...state, tests: { results: nextResults, ranAt: Date.now() } };
  });
}

export function useProjectState() {
  const [state, setState] = useState<ProjectState>(() => emptyProjectState());
  useEffect(() => {
    const refresh = () => setState(loadProjectState());
    refresh();
    window.addEventListener(PROJECT_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROJECT_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return state;
}
