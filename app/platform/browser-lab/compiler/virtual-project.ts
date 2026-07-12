import type { BuildOptions, BuildResult, Loader, Message, Plugin } from "esbuild-wasm";
import { assertCompiledProgramMatchesJob } from "../compiler-protocol";
import { BrowserLabError } from "../errors";
import { assertVirtualPath, canonicalizeSourceFiles, hashSnapshot, hashText, isSourceHash } from "../hash";
import type { CompileDiagnostic, CompileJob, CompiledModule, CompiledProgram, VirtualSourceFile } from "../types";

const VFS_NAMESPACE = "browser-lab-vfs";
const SUPPORTED_LOADERS = new Set<VirtualSourceFile["loader"]>(["js", "jsx", "ts", "tsx", "json"]);
const RESOLVE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".json"] as const;
const DEFAULT_MAX_DIAGNOSTICS = 50;
const MAX_DIAGNOSTICS_LIMIT = 100;
const MAX_DIAGNOSTIC_CHARACTERS = 500;
const MAX_SOURCE_FILES = 256;
const MAX_SOURCE_BYTES = 2_000_000;
const MAX_OUTPUT_BYTES = 2_000_000;

export type EsbuildCompiler = {
  version: string;
  build(options: BuildOptions): Promise<BuildResult<BuildOptions>>;
};

export type VirtualCompileOptions = {
  maxDiagnostics?: number;
};

export function compilerVersionForEsbuild(version: string): string {
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
    throw new BrowserLabError("INVALID_COMPILER", "The esbuild adapter reported an invalid version.");
  }
  return `esbuild-wasm-${version}`;
}

function normalizeSegments(path: string): string {
  const normalized: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!normalized.length) throw new BrowserLabError("IMPORT_OUTSIDE_PROJECT", `Import escapes the virtual project: ${path}.`);
      normalized.pop();
    } else {
      normalized.push(segment);
    }
  }
  const result = normalized.join("/");
  assertVirtualPath(result);
  return result;
}

function hasKnownExtension(path: string): boolean {
  return RESOLVE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

export function resolveVirtualImport(specifier: string, importer: string, availablePaths: ReadonlySet<string>): string {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    throw new BrowserLabError("EXTERNAL_IMPORT_BLOCKED", `Only relative imports from the virtual project are allowed: ${specifier}.`);
  }
  if (specifier.includes("\\") || specifier.includes("?") || specifier.includes("#") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(specifier)) {
    throw new BrowserLabError("EXTERNAL_IMPORT_BLOCKED", `URL and host imports are not allowed: ${specifier}.`);
  }
  assertVirtualPath(importer);
  const importerSegments = importer.split("/");
  importerSegments.pop();
  const base = normalizeSegments([...importerSegments, specifier].join("/"));
  const candidates = hasKnownExtension(base)
    ? [base]
    : [base, ...RESOLVE_EXTENSIONS.map((extension) => `${base}${extension}`), ...RESOLVE_EXTENSIONS.map((extension) => `${base}/index${extension}`)];
  const match = candidates.find((candidate) => availablePaths.has(candidate));
  if (!match) throw new BrowserLabError("UNRESOLVED_IMPORT", `Virtual import not found: ${specifier} from ${importer}.`);
  return match;
}

export function globalNameForModulePath(path: string): string {
  assertVirtualPath(path);
  let hash = 0x811c9dc5;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const readable = path.replace(/[^A-Za-z0-9_$]/g, "_").slice(0, 64) || "module";
  return `__browserLab_${readable}_${(hash >>> 0).toString(36)}`;
}

function pluginError(error: unknown): { errors: { text: string }[] } {
  return { errors: [{ text: error instanceof Error ? error.message : "The virtual import could not be resolved." }] };
}

export function createVirtualProjectPlugin(files: readonly VirtualSourceFile[]): Plugin {
  const canonicalFiles = canonicalizeSourceFiles(files);
  const byPath = new Map(canonicalFiles.map((file) => [file.path, file]));
  const availablePaths = new Set(byPath.keys());
  return {
    name: "browser-lab-vfs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        try {
          if (args.kind === "entry-point") {
            assertVirtualPath(args.path);
            if (!availablePaths.has(args.path)) throw new BrowserLabError("MISSING_ENTRY_POINT", `Compiler entry point not found: ${args.path}.`);
            return { path: args.path, namespace: VFS_NAMESPACE };
          }
          if (args.namespace !== VFS_NAMESPACE) throw new BrowserLabError("EXTERNAL_IMPORT_BLOCKED", `Imports outside the virtual project are not allowed: ${args.path}.`);
          return { path: resolveVirtualImport(args.path, args.importer, availablePaths), namespace: VFS_NAMESPACE };
        } catch (error) {
          return pluginError(error);
        }
      });
      build.onLoad({ filter: /.*/, namespace: VFS_NAMESPACE }, (args) => {
        const file = byPath.get(args.path);
        if (!file) return pluginError(new BrowserLabError("UNRESOLVED_IMPORT", `Virtual file not found: ${args.path}.`));
        if (!SUPPORTED_LOADERS.has(file.loader)) return pluginError(new BrowserLabError("UNSUPPORTED_LOADER", `Browser Lab does not compile ${file.loader} files: ${file.path}.`));
        return { contents: file.contents, loader: file.loader as Loader, resolveDir: "/" };
      });
    },
  };
}

function messageText(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length <= MAX_DIAGNOSTIC_CHARACTERS ? compact : `${compact.slice(0, MAX_DIAGNOSTIC_CHARACTERS - 1)}…`;
}

function toDiagnostic(message: Message, severity: CompileDiagnostic["severity"]): CompileDiagnostic {
  const location = message.location;
  return {
    severity,
    message: messageText(message.text || "The compiler reported an error."),
    ...(location?.file ? { path: location.file.slice(0, 240) } : {}),
    ...(location ? { line: location.line, column: location.column + 1 } : {}),
  };
}

function boundedDiagnostics(diagnostics: readonly CompileDiagnostic[], maximum: number): CompileDiagnostic[] {
  return diagnostics.slice(0, maximum).map((diagnostic) => ({ ...diagnostic, message: messageText(diagnostic.message) }));
}

function validateCompileJob(job: CompileJob, expectedCompilerVersion: string): Promise<void> {
  if (!job || job.schemaVersion !== 1 || !job.jobId?.trim()) throw new BrowserLabError("INVALID_JOB", "A valid compiler job is required.");
  if (!Number.isSafeInteger(job.projectRevision) || job.projectRevision < 0) throw new BrowserLabError("INVALID_REVISION", "Project revision must be a non-negative safe integer.");
  if (!isSourceHash(job.sourceHash)) throw new BrowserLabError("INVALID_SOURCE_HASH", "The compile job has no valid SHA-256 source hash.");
  if (job.compilerVersion !== expectedCompilerVersion) throw new BrowserLabError("INVALID_COMPILER", `Compile job requires ${job.compilerVersion}; this worker provides ${expectedCompilerVersion}.`);
  if (!job.entryPoints.length) throw new BrowserLabError("NO_ENTRY_POINT", "At least one compiler entry point is required.");
  if (job.files.length > MAX_SOURCE_FILES) throw new BrowserLabError("PROJECT_TOO_LARGE", `A virtual project may contain at most ${MAX_SOURCE_FILES} files.`);
  const totalBytes = job.files.reduce((sum, file) => sum + new TextEncoder().encode(file.contents).byteLength, 0);
  if (totalBytes > MAX_SOURCE_BYTES) throw new BrowserLabError("PROJECT_TOO_LARGE", `Virtual project source exceeds ${MAX_SOURCE_BYTES} bytes.`);
  for (const file of job.files) {
    assertVirtualPath(file.path);
    if (!SUPPORTED_LOADERS.has(file.loader)) throw new BrowserLabError("UNSUPPORTED_LOADER", `Browser Lab supports js, jsx, ts, tsx, and json, not ${file.loader}.`);
  }
  const availablePaths = new Set(job.files.map((file) => file.path));
  for (const entryPoint of job.entryPoints) {
    assertVirtualPath(entryPoint);
    if (!availablePaths.has(entryPoint)) throw new BrowserLabError("MISSING_ENTRY_POINT", `Compiler entry point not found: ${entryPoint}.`);
  }
  return hashSnapshot({ projectId: job.projectId, revision: job.projectRevision, files: job.files }).then((actualHash) => {
    if (actualHash !== job.sourceHash) throw new BrowserLabError("STALE_COMPILE", "The compile job source hash does not match its virtual file tree.");
  });
}

function buildFailureMessages(error: unknown): { errors: Message[]; warnings: Message[] } | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errors?: unknown; warnings?: unknown };
  if (!Array.isArray(candidate.errors) || !Array.isArray(candidate.warnings)) return undefined;
  return { errors: candidate.errors as Message[], warnings: candidate.warnings as Message[] };
}

export async function compileVirtualProject(job: CompileJob, compiler: EsbuildCompiler, options: VirtualCompileOptions = {}): Promise<CompiledProgram> {
  const expectedCompilerVersion = compilerVersionForEsbuild(compiler.version);
  await validateCompileJob(job, expectedCompilerVersion);
  const maximumDiagnostics = Math.max(1, Math.min(MAX_DIAGNOSTICS_LIMIT, Math.trunc(options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS)));
  const diagnostics: CompileDiagnostic[] = [];
  const modules: CompiledModule[] = [];
  const plugin = createVirtualProjectPlugin(job.files);

  for (const entryPoint of job.entryPoints) {
    const globalName = globalNameForModulePath(entryPoint);
    try {
      const result = await compiler.build({
        entryPoints: [entryPoint],
        bundle: true,
        write: false,
        format: "iife",
        globalName,
        platform: "browser",
        target: "es2020",
        charset: "utf8",
        legalComments: "none",
        treeShaking: true,
        sourcemap: false,
        logLevel: "silent",
        jsx: "transform",
        plugins: [plugin],
      });
      diagnostics.push(...result.errors.map((message) => toDiagnostic(message, "error")), ...result.warnings.map((message) => toDiagnostic(message, "warning")));
      if (result.errors.length) continue;
      if (!result.outputFiles || result.outputFiles.length !== 1) throw new BrowserLabError("INVALID_COMPILER_OUTPUT", `Compiler emitted ${result.outputFiles?.length ?? 0} files for ${entryPoint}; exactly one IIFE is required.`);
      const code = result.outputFiles[0].text;
      if (new TextEncoder().encode(code).byteLength > MAX_OUTPUT_BYTES) throw new BrowserLabError("OUTPUT_TOO_LARGE", `Compiled module ${entryPoint} exceeds ${MAX_OUTPUT_BYTES} bytes.`);
      modules.push({ modulePath: entryPoint, globalName, code, codeHash: await hashText(code) });
    } catch (error) {
      const failure = buildFailureMessages(error);
      if (!failure) throw error instanceof BrowserLabError ? error : new BrowserLabError("COMPILER_FAILURE", "The isolated compiler failed closed.", { cause: error });
      diagnostics.push(...failure.errors.map((message) => toDiagnostic(message, "error")), ...failure.warnings.map((message) => toDiagnostic(message, "warning")));
    }
  }

  const program: CompiledProgram = {
    schemaVersion: 1,
    format: "browser-lab-iife-v1",
    compileJobId: job.jobId,
    projectId: job.projectId,
    projectRevision: job.projectRevision,
    sourceHash: job.sourceHash,
    compilerVersion: job.compilerVersion,
    modules,
    diagnostics: boundedDiagnostics(diagnostics, maximumDiagnostics),
  };
  if (!program.diagnostics.some((diagnostic) => diagnostic.severity === "error")) assertCompiledProgramMatchesJob(program, job);
  return program;
}

export async function verifyCompiledProgramHashes(program: CompiledProgram): Promise<void> {
  for (const compiledModule of program.modules) {
    if (await hashText(compiledModule.code) !== compiledModule.codeHash) throw new BrowserLabError("COMPILED_CODE_TAMPERED", `Compiled module ${compiledModule.modulePath} does not match its SHA-256 hash.`);
  }
}
