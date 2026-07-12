import { BrowserLabError } from "./errors";
import { assertVirtualPath, hashSnapshot, isSourceHash } from "./hash";
import type { CompileJob, CompiledProgram, ProjectSnapshot } from "./types";

export async function createCompileJob(input: {
  jobId: string;
  snapshot: ProjectSnapshot;
  compilerVersion: string;
  entryPoints: readonly string[];
  submittedAt?: number;
}): Promise<CompileJob> {
  if (!input.jobId.trim()) throw new BrowserLabError("INVALID_JOB", "A compile job id is required.");
  if (!input.compilerVersion.trim()) throw new BrowserLabError("INVALID_COMPILER", "A compiler version is required.");
  if (!input.entryPoints.length) throw new BrowserLabError("NO_ENTRY_POINT", "At least one compiler entry point is required.");
  const paths = new Set(input.snapshot.files.map((file) => file.path));
  for (const entryPoint of input.entryPoints) {
    assertVirtualPath(entryPoint);
    if (!paths.has(entryPoint)) throw new BrowserLabError("MISSING_ENTRY_POINT", `Compiler entry point not found: ${entryPoint}.`);
  }
  return {
    schemaVersion: 1,
    jobId: input.jobId,
    projectId: input.snapshot.projectId,
    projectRevision: input.snapshot.revision,
    sourceHash: await hashSnapshot(input.snapshot),
    compilerVersion: input.compilerVersion,
    submittedAt: input.submittedAt ?? Date.now(),
    entryPoints: [...input.entryPoints],
    files: [...input.snapshot.files],
  };
}

export function assertCompiledProgramMatchesJob(program: CompiledProgram, job: CompileJob): void {
  if (program.schemaVersion !== 1 || program.format !== "browser-lab-iife-v1") {
    throw new BrowserLabError("UNSUPPORTED_PROGRAM", "The compiler returned an unsupported Browser Lab program format.");
  }
  if (!isSourceHash(program.sourceHash) || program.compileJobId !== job.jobId || program.projectId !== job.projectId
    || program.projectRevision !== job.projectRevision || program.sourceHash !== job.sourceHash || program.compilerVersion !== job.compilerVersion) {
    throw new BrowserLabError("STALE_COMPILE", "The compiled program does not match the exact compile job and source tree.");
  }
  if (program.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new BrowserLabError("COMPILE_FAILED", "A program with compiler errors cannot enter the sandbox.");
  }
  const modulePaths = new Set<string>();
  const globalNames = new Set<string>();
  for (const compiledModule of program.modules) {
    assertVirtualPath(compiledModule.modulePath);
    if (!/^__browserLab_[A-Za-z0-9_$]+$/.test(compiledModule.globalName)) {
      throw new BrowserLabError("INVALID_GLOBAL", `Unsafe compiled export global: ${compiledModule.globalName}.`);
    }
    if (!isSourceHash(compiledModule.codeHash)) throw new BrowserLabError("INVALID_MODULE_HASH", `Module ${compiledModule.modulePath} has no valid SHA-256 hash.`);
    if (modulePaths.has(compiledModule.modulePath) || globalNames.has(compiledModule.globalName)) {
      throw new BrowserLabError("DUPLICATE_MODULE", `Compiled module paths and globals must be unique: ${compiledModule.modulePath}.`);
    }
    modulePaths.add(compiledModule.modulePath);
    globalNames.add(compiledModule.globalName);
  }
  for (const entryPoint of job.entryPoints) {
    if (!modulePaths.has(entryPoint)) throw new BrowserLabError("MISSING_COMPILED_ENTRY", `No compiled module was emitted for ${entryPoint}.`);
  }
}
