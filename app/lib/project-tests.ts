"use client";

import { runLessonContracts, type BrowserLabProjectRun } from "../features/ide/browser-lab-service";
import {
  compileProject,
  RUNTIME_PATHS,
  type ProjectFile,
  type ProjectRuntime,
  type ProjectUnitResult,
} from "./project-workspace";
import { CAPSTONE_ENTRY_PATH, CANONICAL_BROWSER_CHAT_FILES } from "../content/browser-chat/project-template";
import {
  CAPSTONE_BEHAVIOR_COMPONENT_PATH,
  CAPSTONE_BEHAVIOR_CONTRACT_ID,
} from "./capstone-behavior-contract";

export type ProjectTestRun = Omit<BrowserLabProjectRun, "results"> & {
  results: ProjectUnitResult[];
};

export async function runProjectUnitTests(
  files: Record<string, ProjectFile>,
  runtime: ProjectRuntime,
  onlyPath?: string,
): Promise<ProjectTestRun> {
  const appPaths = new Set(CANONICAL_BROWSER_CHAT_FILES.map((file) => file.path));
  const testingCapstoneFile = Boolean(onlyPath && appPaths.has(onlyPath));
  const lessonRun = await runLessonContracts(files, { onlyPath: testingCapstoneFile ? undefined : onlyPath });
  const results = testingCapstoneFile
    ? lessonRun.results.filter((result) => result.id === CAPSTONE_BEHAVIOR_CONTRACT_ID)
    : [...lessonRun.results];
  const expectedIdsByPath = testingCapstoneFile
    ? {
      [CAPSTONE_BEHAVIOR_COMPONENT_PATH]: [CAPSTONE_BEHAVIOR_CONTRACT_ID],
    } as Record<string, string[]>
    : Object.fromEntries(Object.entries(lessonRun.expectedIdsByPath).map(([path, ids]) => [path, [...ids]]));
  if (!onlyPath || testingCapstoneFile) {
    const compileId = `${CAPSTONE_ENTRY_PATH}:compile`;
    const compiled = lessonRun.program?.modules.find((module) => module.modulePath === CAPSTONE_ENTRY_PATH);
    results.push({
      id: compileId,
      path: CAPSTONE_ENTRY_PATH,
      label: "Capstone application",
      passed: Boolean(compiled),
      detail: compiled
        ? "The full React project compiled from the same files the tests checked."
        : "The capstone entry or one of the files it imports didn't compile.",
    });
    expectedIdsByPath[CAPSTONE_ENTRY_PATH] = [compileId];
  }
  const runtimePaths = Object.values(RUNTIME_PATHS);
  if (!onlyPath || runtimePaths.includes(onlyPath as (typeof runtimePaths)[number])) {
    const compile = compileProject(files, runtime);
    for (const path of runtimePaths) {
      if (onlyPath && path !== onlyPath) continue;
      const error = compile.errors.find((detail) => detail.startsWith(path));
      results.push({
        id: `${path}:contract`,
        path,
        label: "Runtime settings",
        passed: !error,
        detail: error ?? "The JSON module parses and stays within the allowed runtime settings.",
      });
      expectedIdsByPath[path] = [`${path}:contract`];
    }
  }
  return { ...lessonRun, results, expectedIdsByPath };
}
