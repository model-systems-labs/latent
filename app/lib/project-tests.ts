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
  const results = testingCapstoneFile ? [] : [...lessonRun.results];
  if (!onlyPath || testingCapstoneFile) {
    const compiled = lessonRun.program?.modules.find((module) => module.modulePath === CAPSTONE_ENTRY_PATH);
    results.push({
      id: `${CAPSTONE_ENTRY_PATH}:compile`,
      path: CAPSTONE_ENTRY_PATH,
      label: "Capstone application",
      passed: Boolean(compiled),
      detail: compiled
        ? "The complete React repository compiled from the same tested source snapshot."
        : "The capstone entry or one of its project imports did not compile.",
    });
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
        label: "Runtime configuration",
        passed: !error,
        detail: error ?? "JSON module parses and satisfies its typed runtime bounds.",
      });
    }
  }
  return { ...lessonRun, results };
}
