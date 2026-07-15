import { exposeLessonFunctions } from "@latent/browser-lab/compiler";
import {
  canonicalSourcePayload,
  hashText,
  type ExerciseContract,
  type SourceHash,
  type VirtualSourceFile,
} from "@latent/browser-lab";
import { llmSystemsContractSuite } from "../../content/llm-systems/contracts";

export type ProjectSnapshotSource = {
  path: string;
  content: string;
};

export type ProjectSnapshotPreparationFailure = {
  contract: ExerciseContract;
  detail: string;
};

function loaderFor(path: string): VirtualSourceFile["loader"] {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".json")) return "json";
  return "js";
}

function contractsForPath(path: string) {
  return llmSystemsContractSuite.contracts.filter((contract) => (
    contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === path)
  ));
}

/**
 * Browser Lab intentionally cannot execute Python. A JSON identity carrier
 * keeps every Python byte inside the same source-tree hash and stale-result
 * boundary without ever treating `.py` as JavaScript. Keeping the learner's
 * path on the compiled identity module also lets build provenance prove that
 * every routed lesson entered the exact promoted snapshot.
 */
function pythonIdentityFile(file: ProjectSnapshotSource): VirtualSourceFile {
  return {
    path: file.path,
    contents: JSON.stringify({ path: file.path, contents: file.content }),
    loader: "json",
  };
}

/**
 * Produces the exact source files hashed by Browser Lab. Keeping this outside
 * React and persistence lets result admission recompute the same source
 * identity after an asynchronous run finishes.
 */
export function prepareProjectSnapshotFiles(files: Readonly<Record<string, ProjectSnapshotSource>>) {
  const failures: ProjectSnapshotPreparationFailure[] = [];
  const entryPoints: string[] = [];
  const prepared = Object.values(files).map((file): VirtualSourceFile => {
    const contracts = contractsForPath(file.path);
    if (file.path.endsWith(".py")) {
      if (contracts.length) entryPoints.push(file.path);
      return pythonIdentityFile(file);
    }
    if (!contracts.length) return { path: file.path, contents: file.content, loader: loaderFor(file.path) };
    const exports = [...new Set(contracts.flatMap((contract) => (
      contract.cases.map((exerciseCase) => exerciseCase.invoke.exportName)
    )))];
    try {
      const contents = exposeLessonFunctions(file.content, exports);
      entryPoints.push(file.path);
      return { path: file.path, contents, loader: loaderFor(file.path) };
    } catch (error) {
      const detail = error instanceof Error
        ? error.message
        : "The lesson module didn’t make its tested functions available.";
      failures.push(...contracts.map((contract) => ({ contract, detail })));
      return { path: file.path, contents: file.content, loader: loaderFor(file.path) };
    }
  });
  return { files: prepared, entryPoints, failures };
}

export function projectSnapshotSourcePayload(files: Readonly<Record<string, ProjectSnapshotSource>>) {
  return canonicalSourcePayload(prepareProjectSnapshotFiles(files).files);
}

export function hashProjectSnapshotSources(files: Readonly<Record<string, ProjectSnapshotSource>>): Promise<SourceHash> {
  return hashText(projectSnapshotSourcePayload(files));
}
