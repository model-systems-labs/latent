"use client";

import { courseLessons } from "../lessons/course";
import { runBrowserLabContract } from "./browser-lab";
import {
  compileProject,
  RUNTIME_PATHS,
  type ProjectFile,
  type ProjectRuntime,
  type ProjectUnitResult,
} from "./project-workspace";

export function runProjectUnitTests(files: Record<string, ProjectFile>, runtime: ProjectRuntime, onlyPath?: string) {
  const results: ProjectUnitResult[] = [];
  for (const lesson of courseLessons) {
    const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
    if (onlyPath && path !== onlyPath) continue;
    const source = files[path]?.content ?? "";
    for (const block of lesson.implementation.codeBlocks) {
      results.push(runBrowserLabContract({ path, source, id: `${lesson.id}:${block.id}`, label: block.label, assertion: block.checkCode }));
    }
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
        label: "Runtime contract",
        passed: !error,
        detail: error ?? "JSON module parses and satisfies its typed runtime bounds.",
      });
    }
  }
  return results;
}
