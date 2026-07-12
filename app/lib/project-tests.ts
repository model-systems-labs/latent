"use client";

import { runLessonContracts, type BrowserLabProjectRun } from "../features/ide/browser-lab-service";
import {
  compileProject,
  RUNTIME_PATHS,
  type ProjectFile,
  type ProjectRuntime,
  type ProjectUnitResult,
} from "./project-workspace";

export type ProjectTestRun = Omit<BrowserLabProjectRun, "results"> & {
  results: ProjectUnitResult[];
};

export async function runProjectUnitTests(
  files: Record<string, ProjectFile>,
  runtime: ProjectRuntime,
  onlyPath?: string,
): Promise<ProjectTestRun> {
  const lessonRun = await runLessonContracts(files, { onlyPath });
  const results = [...lessonRun.results];
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
