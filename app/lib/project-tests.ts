"use client";

import { courseLessons } from "../lessons/course";
import {
  compileProject,
  RUNTIME_PATHS,
  type ProjectFile,
  type ProjectRuntime,
  type ProjectUnitResult,
} from "./project-workspace";

function runSourceTest(path: string, source: string, id: string, label: string, checkCode?: string): ProjectUnitResult {
  try {
    const value = checkCode
      ? new Function(`"use strict";\n${source}\n${checkCode}`)() as { passed?: unknown; detail?: unknown }
      : (new Function(`"use strict";\n${source}`)(), { passed: true, detail: "Source is syntactically valid." });
    return {
      id,
      path,
      label,
      passed: value?.passed === true,
      detail: typeof value?.detail === "string" ? value.detail : value?.passed === true ? "Behavioral contract passed." : "Behavioral contract failed.",
    };
  } catch (error) {
    return { id, path, label, passed: false, detail: error instanceof Error ? error.message : "The unit test could not run." };
  }
}

export function runProjectUnitTests(files: Record<string, ProjectFile>, runtime: ProjectRuntime, onlyPath?: string) {
  const results: ProjectUnitResult[] = [];
  for (const lesson of courseLessons) {
    const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
    if (onlyPath && path !== onlyPath) continue;
    const source = files[path]?.content ?? "";
    for (const block of lesson.implementation.codeBlocks) {
      results.push(runSourceTest(path, source, `${lesson.id}:${block.id}`, block.label, block.checkCode));
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
