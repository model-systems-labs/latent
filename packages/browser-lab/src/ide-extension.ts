import { BROWSER_LAB_COMPILER_VERSION, BrowserLabCompilerClient } from "./compiler";
import { createCompileJob } from "./compiler-protocol";
import { validateExerciseContract } from "./contracts";
import {
  BrowserLabAbortError,
  BrowserLabError,
  BrowserLabStaleResultError,
} from "./errors";
import { assertVirtualPath, canonicalizeSourceFiles, hashSnapshot, hashText } from "./hash";
import { assertReceiptCurrent, contractCaseKey } from "./receipts";
import type {
  CompileJob,
  CompiledProgram,
  ContractSuite,
  ProjectSnapshot,
  SandboxLogEntry,
  SandboxResourceLimits,
  SandboxRunRequest,
  SourceHash,
  TestReceipt,
  VirtualSourceFile,
} from "./types";
import { DEFAULT_SANDBOX_LIMITS, validateSandboxLimits } from "./sandbox-protocol";
import { BrowserLabWorkerClient } from "./worker-client";

const EXTENSION_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SUPPORTED_LOADERS = new Set<VirtualSourceFile["loader"]>(["js", "jsx", "ts", "tsx", "json"]);
const FILE_EXTENSION_BY_LOADER: Readonly<Record<Exclude<VirtualSourceFile["loader"], "css">, readonly string[]>> = {
  js: [".js"],
  jsx: [".jsx"],
  ts: [".ts"],
  tsx: [".tsx"],
  json: [".json"],
};

export const BROWSER_IDE_EXTENSION_SCHEMA_VERSION = 1 as const;
export const BROWSER_IDE_STATE_SCHEMA_VERSION = 1 as const;
export const BROWSER_IDE_MAX_FILES = 256;
export const BROWSER_IDE_MAX_SOURCE_BYTES = 2_000_000;
export const BROWSER_IDE_MAX_FILE_BYTES = 512_000;
export const BROWSER_IDE_MAX_CONTRACTS = 128;
export const BROWSER_IDE_MAX_CASES = 512;
export const BROWSER_IDE_MAX_ASSERTIONS = 2_048;

export type BrowserIdeSourceFile = VirtualSourceFile & {
  readonly title: string;
  readonly editable: boolean;
};

/**
 * A trusted-source IDE definition. It is deliberately data-only: the host
 * injects editor rendering, execution, and persistence separately.
 *
 * Browser IDE v1 supports JavaScript and TypeScript virtual projects only.
 * Python Lab remains a distinct trusted integration and is not a remote
 * execution target for this seam.
 */
export type BrowserIdeExtensionDefinition = {
  readonly schemaVersion: typeof BROWSER_IDE_EXTENSION_SCHEMA_VERSION;
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly initialFilePath: string;
  readonly files: readonly BrowserIdeSourceFile[];
  readonly entryPoints: readonly string[];
  readonly checks: ContractSuite;
};

export type BrowserIdePersistedState = {
  readonly schemaVersion: typeof BROWSER_IDE_STATE_SCHEMA_VERSION;
  readonly extensionId: string;
  readonly definitionFingerprint: SourceHash;
  readonly revision: number;
  readonly selectedPath: string;
  readonly files: readonly VirtualSourceFile[];
  readonly updatedAt: number;
};

export type BrowserIdePersistenceIdentity = {
  readonly revision: number;
  readonly sourceHash: SourceHash;
};

export type BrowserIdeReceiptArtifact = {
  readonly artifactKey: string;
  readonly extensionId: string;
  readonly sourceHash: SourceHash;
  readonly contractVersion: string;
  readonly receiptId: string;
};

export type BrowserIdePersistenceLoad = {
  /** Untrusted persisted bytes for the session to validate. */
  readonly value: unknown;
  /** Opaque adapter-owned compare-and-delete token for this exact record. */
  readonly token: string;
};

export type BrowserIdeEditorModel = {
  readonly extensionId: string;
  readonly revision: number;
  readonly selectedPath: string;
  readonly file: BrowserIdeSourceFile;
  readonly value: string;
  readonly dirty: boolean;
  readonly running: boolean;
};

export type BrowserIdeEditorActions = {
  readonly change: (contents: string) => void;
  readonly select: (path: string) => void;
  readonly save: () => Promise<void>;
  readonly run: (options?: BrowserIdeRunOptions) => Promise<TestReceipt>;
};

/**
 * Rendering stays generic so React, Vue, a terminal UI, or a native shell can
 * provide the editor without Browser Lab depending on any UI framework.
 */
export interface BrowserIdeEditorAdapter<RenderedEditor> {
  readonly adapterId: string;
  supports(file: BrowserIdeSourceFile): boolean;
  render(model: BrowserIdeEditorModel, actions: BrowserIdeEditorActions): RenderedEditor;
}

export type BrowserIdeRuntimeInput = {
  readonly extensionId: string;
  readonly snapshot: ProjectSnapshot;
  readonly entryPoints: readonly string[];
  readonly suite: ContractSuite;
  readonly signal?: AbortSignal;
};

export interface BrowserIdeRuntimeAdapter {
  readonly runtimeId: string;
  run(input: BrowserIdeRuntimeInput): Promise<TestReceipt>;
}

/**
 * `load().value` is unknown because browser storage is an untrusted boundary.
 * The session validates every stored byte against the trusted definition
 * before admitting it. Its opaque token lets recovery compare-and-delete only
 * the exact rejected record.
 */
export interface BrowserIdePersistenceAdapter {
  readonly adapterId: string;
  load(extensionId: string): Promise<BrowserIdePersistenceLoad | null>;
  save(
    state: BrowserIdePersistedState,
    identity: BrowserIdePersistenceIdentity,
    expected: BrowserIdePersistenceIdentity | null,
  ): Promise<BrowserIdePersistenceIdentity>;
  stageReceipt(extensionId: string, receipt: TestReceipt): Promise<BrowserIdeReceiptArtifact>;
  admitReceipt(
    extensionId: string,
    artifact: BrowserIdeReceiptArtifact,
    expected: BrowserIdePersistenceIdentity,
  ): Promise<boolean>;
  reset(extensionId: string, rejectedToken: string): Promise<boolean>;
  flush?(): Promise<void>;
}

export type BrowserIdeHostBindings<RenderedEditor> = {
  readonly editor: BrowserIdeEditorAdapter<RenderedEditor>;
  readonly runtime: BrowserIdeRuntimeAdapter;
  readonly persistence: BrowserIdePersistenceAdapter;
};

export type BrowserIdeSessionState = BrowserIdePersistedState & {
  readonly dirty: boolean;
  readonly running: boolean;
  readonly lastReceipt: TestReceipt | null;
  readonly recovery: BrowserIdeStateRecovery | null;
};

export type BrowserIdeStateRecovery = {
  readonly code: "invalid-state" | "definition-changed";
  readonly message: string;
};

export type BrowserIdeRunOptions = {
  readonly signal?: AbortSignal;
};

export type BrowserLabIdeRuntimeOptions = {
  readonly compilerVersion?: string;
  readonly limits?: Partial<SandboxResourceLimits>;
  readonly deterministicSeed?: number;
  readonly deterministicNowMs?: number;
  readonly now?: () => number;
  readonly createId?: (prefix: string) => string;
  readonly createCompiler?: () => BrowserIdeCompiler;
  readonly createRunner?: () => BrowserIdeSandboxRunner;
};

export interface BrowserIdeCompiler {
  compile(job: CompileJob, options?: { signal?: AbortSignal }): Promise<CompiledProgram>;
  dispose(): void;
}

export interface BrowserIdeSandboxRunner {
  runSuite(
    request: SandboxRunRequest,
    options?: { signal?: AbortSignal; onLog?: (entry: SandboxLogEntry) => void },
  ): Promise<TestReceipt>;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new BrowserLabError("INVALID_IDE_EXTENSION", `${label} must be a non-empty string no longer than ${maximum} characters.`);
  }
  return value;
}

function loaderMatchesPath(file: Pick<VirtualSourceFile, "path" | "loader">): boolean {
  if (file.loader === "css") return false;
  return FILE_EXTENSION_BY_LOADER[file.loader].some((extension) => file.path.endsWith(extension));
}

function validateSourceFiles(files: readonly BrowserIdeSourceFile[]): readonly BrowserIdeSourceFile[] {
  if (!Array.isArray(files) || !files.length || files.length > BROWSER_IDE_MAX_FILES) {
    throw new BrowserLabError("INVALID_IDE_FILES", `A Browser IDE extension needs between 1 and ${BROWSER_IDE_MAX_FILES} files.`);
  }
  for (const file of files) {
    if (
      !file
      || typeof file !== "object"
      || typeof file.path !== "string"
      || typeof file.loader !== "string"
      || typeof file.contents !== "string"
      || typeof file.title !== "string"
      || typeof file.editable !== "boolean"
    ) {
      throw new BrowserLabError("INVALID_IDE_FILE", "Every Browser IDE file needs a path, loader, contents, title, and editable flag.");
    }
  }
  const metadata = new Map(files.map((file) => [file.path, file]));
  const canonical = canonicalizeSourceFiles(files);
  let totalBytes = 0;
  for (const file of canonical) {
    const declared = metadata.get(file.path)!;
    if (!SUPPORTED_LOADERS.has(file.loader) || !loaderMatchesPath(file)) {
      throw new BrowserLabError(
        "UNSUPPORTED_IDE_LANGUAGE",
        `Browser IDE v1 supports matching .js, .jsx, .ts, .tsx, and .json files, not ${file.path} (${file.loader}).`,
      );
    }
    boundedText(declared.title, `The title for ${file.path}`, 160);
    if (typeof declared.editable !== "boolean") {
      throw new BrowserLabError("INVALID_IDE_FILE", `The editable flag for ${file.path} must be boolean.`);
    }
    const fileBytes = byteLength(file.contents);
    if (fileBytes > BROWSER_IDE_MAX_FILE_BYTES) {
      throw new BrowserLabError("IDE_FILE_TOO_LARGE", `${file.path} exceeds ${BROWSER_IDE_MAX_FILE_BYTES} UTF-8 bytes.`);
    }
    totalBytes += fileBytes;
  }
  if (totalBytes > BROWSER_IDE_MAX_SOURCE_BYTES) {
    throw new BrowserLabError("IDE_PROJECT_TOO_LARGE", `Browser IDE source exceeds ${BROWSER_IDE_MAX_SOURCE_BYTES} UTF-8 bytes.`);
  }
  return canonical.map((file) => ({
    ...file,
    title: metadata.get(file.path)!.title,
    editable: metadata.get(file.path)!.editable,
  }));
}

function validateSuite(suite: ContractSuite, entryPoints: ReadonlySet<string>): ContractSuite {
  boundedText(suite?.contractVersion, "The contract version", 160);
  if (
    !Array.isArray(suite.contracts)
    || !suite.contracts.length
    || suite.contracts.length > BROWSER_IDE_MAX_CONTRACTS
  ) {
    throw new BrowserLabError(
      "INVALID_IDE_CHECKS",
      `A Browser IDE extension needs between 1 and ${BROWSER_IDE_MAX_CONTRACTS} host-owned exercise contracts.`,
    );
  }
  const contractIds = new Set<string>();
  const caseKeys = new Set<string>();
  let caseCount = 0;
  let assertionCount = 0;
  for (const contract of suite.contracts) {
    validateExerciseContract(contract);
    boundedText(contract.label, `The label for contract ${contract.id}`, 240);
    if (contractIds.has(contract.id)) {
      throw new BrowserLabError("DUPLICATE_CONTRACT", `Duplicate exercise contract id: ${contract.id}.`);
    }
    contractIds.add(contract.id);
    for (const exerciseCase of contract.cases) {
      caseCount += 1;
      assertionCount += exerciseCase.assertions.length;
      if (caseCount > BROWSER_IDE_MAX_CASES || assertionCount > BROWSER_IDE_MAX_ASSERTIONS) {
        throw new BrowserLabError(
          "IDE_CHECKS_TOO_LARGE",
          `Browser IDE checks may contain at most ${BROWSER_IDE_MAX_CASES} cases and ${BROWSER_IDE_MAX_ASSERTIONS} assertions.`,
        );
      }
      boundedText(exerciseCase.label, `The label for case ${contract.id}/${exerciseCase.id}`, 240);
      if (!entryPoints.has(exerciseCase.invoke.modulePath)) {
        throw new BrowserLabError(
          "UNBOUND_IDE_CHECK",
          `Contract ${contract.id} invokes ${exerciseCase.invoke.modulePath}, which is not a declared entry point.`,
        );
      }
      const key = contractCaseKey(contract.id, exerciseCase.id);
      if (caseKeys.has(key)) throw new BrowserLabError("DUPLICATE_CASE", `Duplicate exercise case: ${contract.id}/${exerciseCase.id}.`);
      caseKeys.add(key);
      for (const assertion of exerciseCase.assertions) {
        boundedText(assertion.label, `The label for assertion ${contract.id}/${exerciseCase.id}/${assertion.id}`, 240);
      }
    }
  }
  try {
    return structuredClone(suite);
  } catch (error) {
    throw new BrowserLabError("INVALID_IDE_CHECKS", "Browser IDE checks must be structured-cloneable data.", { cause: error });
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}

function freezeDefinition(definition: BrowserIdeExtensionDefinition): BrowserIdeExtensionDefinition {
  return deepFreeze(definition);
}

export function defineBrowserIdeExtension(
  input: BrowserIdeExtensionDefinition,
): BrowserIdeExtensionDefinition {
  if (!input || input.schemaVersion !== BROWSER_IDE_EXTENSION_SCHEMA_VERSION) {
    throw new BrowserLabError("INVALID_IDE_EXTENSION", "Browser IDE extensions require schemaVersion 1.");
  }
  const id = boundedText(input.id, "The extension id", 120);
  if (!EXTENSION_ID.test(id)) {
    throw new BrowserLabError("INVALID_IDE_EXTENSION", "The extension id must be a lowercase dot-or-dash-separated identifier.");
  }
  const title = boundedText(input.title, "The extension title", 160);
  const description = input.description === undefined
    ? undefined
    : boundedText(input.description, "The extension description", 1_000);
  const files = validateSourceFiles(input.files);
  const byPath = new Map(files.map((file) => [file.path, file]));
  assertVirtualPath(input.initialFilePath);
  if (!byPath.has(input.initialFilePath)) {
    throw new BrowserLabError("MISSING_IDE_FILE", `The initial file does not exist: ${input.initialFilePath}.`);
  }
  if (!byPath.get(input.initialFilePath)?.editable) {
    throw new BrowserLabError("READ_ONLY_IDE_FILE", "The initial Browser IDE file must be editable.");
  }
  if (!Array.isArray(input.entryPoints) || !input.entryPoints.length) {
    throw new BrowserLabError("NO_ENTRY_POINT", "A Browser IDE extension needs at least one entry point.");
  }
  const entryPoints = [...input.entryPoints];
  const entryPointSet = new Set<string>();
  for (const entryPoint of entryPoints) {
    assertVirtualPath(entryPoint);
    const file = byPath.get(entryPoint);
    if (!file) throw new BrowserLabError("MISSING_ENTRY_POINT", `Browser IDE entry point not found: ${entryPoint}.`);
    if (file.loader === "json") throw new BrowserLabError("INVALID_ENTRY_POINT", `JSON cannot be an executable entry point: ${entryPoint}.`);
    if (entryPointSet.has(entryPoint)) throw new BrowserLabError("DUPLICATE_ENTRY_POINT", `Duplicate Browser IDE entry point: ${entryPoint}.`);
    entryPointSet.add(entryPoint);
  }
  const checks = validateSuite(input.checks, entryPointSet);
  return freezeDefinition({
    schemaVersion: BROWSER_IDE_EXTENSION_SCHEMA_VERSION,
    id,
    title,
    ...(description ? { description } : {}),
    initialFilePath: input.initialFilePath,
    files,
    entryPoints,
    checks,
  });
}

/**
 * Stable logical identity for UI composition. A host may reuse a session while
 * this value is unchanged; changing files or checks without changing the
 * contract version is still detected by the cryptographic fingerprint below.
 */
export function browserIdeDefinitionIdentity(
  definition: Pick<BrowserIdeExtensionDefinition, "schemaVersion" | "id" | "checks">,
): string {
  return `${definition.schemaVersion}:${definition.id}:${definition.checks.contractVersion}`;
}

export function browserIdeDefinitionFingerprint(
  definition: BrowserIdeExtensionDefinition,
): Promise<SourceHash> {
  return hashText(JSON.stringify({
    schemaVersion: definition.schemaVersion,
    id: definition.id,
    initialFilePath: definition.initialFilePath,
    files: definition.files.map(({ path, loader, contents, editable }) => ({
      path,
      loader,
      contents,
      editable,
    })),
    entryPoints: definition.entryPoints,
    checks: definition.checks,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function filesFromPersistedState(
  definition: BrowserIdeExtensionDefinition,
  value: unknown,
): readonly VirtualSourceFile[] {
  if (!Array.isArray(value) || value.length !== definition.files.length) {
    throw new BrowserLabError("INVALID_IDE_STATE", "Saved IDE files do not match the trusted extension file tree.");
  }
  const trustedByPath = new Map(definition.files.map((file) => [file.path, file]));
  const files: VirtualSourceFile[] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate)
      || typeof candidate.path !== "string"
      || typeof candidate.contents !== "string"
      || typeof candidate.loader !== "string"
    ) {
      throw new BrowserLabError("INVALID_IDE_STATE", "Saved IDE files contain an invalid record.");
    }
    const trusted = trustedByPath.get(candidate.path);
    if (!trusted || trusted.loader !== candidate.loader) {
      throw new BrowserLabError("INVALID_IDE_STATE", `Saved IDE file metadata is not trusted: ${candidate.path}.`);
    }
    if (!trusted.editable && candidate.contents !== trusted.contents) {
      throw new BrowserLabError("READ_ONLY_IDE_FILE", `Saved IDE state modified read-only file ${candidate.path}.`);
    }
    files.push({ path: trusted.path, loader: trusted.loader, contents: candidate.contents });
  }
  const validated = validateSourceFiles(files.map((file) => ({
    ...file,
    title: trustedByPath.get(file.path)!.title,
    editable: trustedByPath.get(file.path)!.editable,
  })));
  return validated.map(({ path, loader, contents }) => ({ path, loader, contents }));
}

export async function validateBrowserIdePersistedState(
  definition: BrowserIdeExtensionDefinition,
  value: unknown,
  expectedFingerprint?: SourceHash,
): Promise<BrowserIdePersistedState> {
  const fingerprint = expectedFingerprint ?? await browserIdeDefinitionFingerprint(definition);
  if (
    !isRecord(value)
    || value.schemaVersion !== BROWSER_IDE_STATE_SCHEMA_VERSION
    || value.extensionId !== definition.id
    || typeof value.definitionFingerprint !== "string"
    || value.definitionFingerprint !== fingerprint
    || typeof value.revision !== "number"
    || !Number.isSafeInteger(value.revision)
    || value.revision < 0
    || typeof value.selectedPath !== "string"
    || typeof value.updatedAt !== "number"
    || !Number.isFinite(value.updatedAt)
    || value.updatedAt < 0
  ) {
    throw new BrowserLabError("INVALID_IDE_STATE", "Saved IDE state has invalid identity or revision metadata.");
  }
  const files = filesFromPersistedState(definition, value.files);
  if (!files.some((file) => file.path === value.selectedPath)) {
    throw new BrowserLabError("INVALID_IDE_STATE", "Saved IDE state selects a file outside the trusted file tree.");
  }
  return {
    schemaVersion: BROWSER_IDE_STATE_SCHEMA_VERSION,
    extensionId: definition.id,
    definitionFingerprint: fingerprint,
    revision: value.revision,
    selectedPath: value.selectedPath,
    files,
    updatedAt: value.updatedAt,
  };
}

function initialState(
  definition: BrowserIdeExtensionDefinition,
  definitionFingerprint: SourceHash,
  now: number,
): BrowserIdePersistedState {
  return {
    schemaVersion: BROWSER_IDE_STATE_SCHEMA_VERSION,
    extensionId: definition.id,
    definitionFingerprint,
    revision: 0,
    selectedPath: definition.initialFilePath,
    files: definition.files.map(({ path, loader, contents }) => ({ path, loader, contents })),
    updatedAt: now,
  };
}

function cloneState(state: BrowserIdePersistedState): BrowserIdePersistedState {
  return { ...state, files: state.files.map((file) => ({ ...file })) };
}

function assertReceiptCoversSuite(receipt: TestReceipt, suite: ContractSuite): void {
  const expected = new Set(suite.contracts.flatMap((contract) => (
    contract.cases.map((exerciseCase) => contractCaseKey(contract.id, exerciseCase.id))
  )));
  const actual = new Set<string>();
  for (const result of receipt.results) {
    const key = contractCaseKey(result.contractId, result.caseId);
    if (actual.has(key)) throw new BrowserLabError("DUPLICATE_TEST_RESULT", "The IDE receipt contains a duplicate contract case result.");
    actual.add(key);
  }
  if (actual.size !== expected.size || [...expected].some((key) => !actual.has(key))) {
    throw new BrowserLabError("INCOMPLETE_TEST_RECEIPT", "The IDE receipt does not cover the exact trusted check suite.");
  }
  if (receipt.status === "passed" !== receipt.results.every((result) => result.passed)) {
    throw new BrowserLabError("INVALID_TEST_RECEIPT", "The IDE receipt status disagrees with its case results.");
  }
}

export class BrowserIdeSession<RenderedEditor> {
  readonly definition: BrowserIdeExtensionDefinition;
  private state: BrowserIdePersistedState | null = null;
  private definitionFingerprint: SourceHash | null = null;
  private persistedIdentity: BrowserIdePersistenceIdentity | null = null;
  private recovery: BrowserIdeStateRecovery | null = null;
  private dirty = false;
  private running = false;
  private admittingReceipt = false;
  private initialized = false;
  private disposed = false;
  private lastReceipt: TestReceipt | null = null;
  private lastAcceptedReceiptState: {
    readonly receiptId: string;
    readonly state: BrowserIdePersistedState;
  } | null = null;
  private activeRunAbort: AbortController | null = null;
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    definition: BrowserIdeExtensionDefinition,
    readonly bindings: BrowserIdeHostBindings<RenderedEditor>,
    private readonly now: () => number = Date.now,
  ) {
    this.definition = defineBrowserIdeExtension(definition);
    if (!bindings.editor?.adapterId || !bindings.runtime?.runtimeId || !bindings.persistence?.adapterId) {
      throw new BrowserLabError("INVALID_IDE_BINDINGS", "The IDE host must inject named editor, runtime, and persistence adapters.");
    }
  }

  async initialize(): Promise<BrowserIdeSessionState> {
    this.assertActive();
    if (!this.initialized) {
      const definitionFingerprint = await browserIdeDefinitionFingerprint(this.definition);
      this.definitionFingerprint = definitionFingerprint;
      const fresh = initialState(this.definition, definitionFingerprint, this.now());
      let loaded = await this.bindings.persistence.load(this.definition.id);
      for (let recoveryAttempt = 0; loaded !== null && recoveryAttempt < 3; recoveryAttempt += 1) {
        if (typeof loaded.token !== "string" || !loaded.token) {
          throw new BrowserLabError(
            "INVALID_IDE_PERSISTENCE",
            "The persistence adapter returned saved IDE state without an opaque record token.",
          );
        }
        const persisted = loaded.value;
        try {
          this.state = await validateBrowserIdePersistedState(
            this.definition,
            persisted,
            definitionFingerprint,
          );
          this.persistedIdentity = await this.identityForState(this.state);
          if (this.recovery) {
            this.recovery = {
              ...this.recovery,
              message: `${this.recovery.message} A newer valid saved state arrived during recovery and was kept.`,
            };
          }
          break;
        } catch {
          const definitionChanged = isRecord(persisted)
            && typeof persisted.definitionFingerprint === "string"
            && persisted.definitionFingerprint !== definitionFingerprint;
          this.recovery ??= {
            code: definitionChanged ? "definition-changed" : "invalid-state",
            message: definitionChanged
              ? "The exercise definition changed, so its incompatible saved IDE state was reset."
              : "Invalid saved IDE state was discarded and reset to the reviewed starter.",
          };
          try {
            const removed = await this.bindings.persistence.reset(
              this.definition.id,
              loaded.token,
            );
            if (removed) {
              loaded = null;
              break;
            }
            loaded = await this.bindings.persistence.load(this.definition.id);
          } catch {
            this.recovery = {
              ...this.recovery,
              message: `${this.recovery.message} The invalid browser record could not be removed, so this tab is using a clean in-memory copy.`,
            };
            loaded = null;
            break;
          }
        }
      }
      if (!this.state) {
        this.state = fresh;
        this.persistedIdentity = null;
        if (loaded !== null && this.recovery) {
          this.recovery = {
            ...this.recovery,
            message: `${this.recovery.message} Browser state kept changing during recovery, so this tab is using a clean in-memory copy.`,
          };
        }
      }
      this.initialized = true;
    }
    return this.getState();
  }

  getState(): BrowserIdeSessionState {
    this.assertReady();
    return {
      ...cloneState(this.currentState()),
      dirty: this.dirty,
      running: this.running,
      lastReceipt: this.lastReceipt,
      recovery: this.recovery,
    };
  }

  /**
   * Return the exact source state admitted with a receipt, even if the learner
   * has already started the next edit by the time a UI effect handles it.
   */
  getReceiptState(receiptId: string): BrowserIdePersistedState | null {
    this.assertReady();
    return this.lastAcceptedReceiptState?.receiptId === receiptId
      ? cloneState(this.lastAcceptedReceiptState.state)
      : null;
  }

  select(path: string): void {
    this.assertReady();
    assertVirtualPath(path);
    const state = this.currentState();
    if (!state.files.some((file) => file.path === path)) {
      throw new BrowserLabError("MISSING_IDE_FILE", `The IDE extension does not contain ${path}.`);
    }
    this.state = { ...state, selectedPath: path, updatedAt: this.now() };
    this.dirty = true;
  }

  change(contents: string): void {
    this.assertReady();
    if (this.admittingReceipt) {
      throw new BrowserLabError("IDE_BUSY", "Wait for the current receipt admission to finish before editing.");
    }
    if (typeof contents !== "string") throw new BrowserLabError("INVALID_IDE_SOURCE", "Editor source must be a string.");
    const state = this.currentState();
    const trusted = this.definition.files.find((file) => file.path === state.selectedPath);
    if (!trusted) throw new BrowserLabError("MISSING_IDE_FILE", "The selected IDE file is no longer in the trusted definition.");
    if (!trusted.editable) throw new BrowserLabError("READ_ONLY_IDE_FILE", `${trusted.path} is read-only.`);
    if (byteLength(contents) > BROWSER_IDE_MAX_FILE_BYTES) {
      throw new BrowserLabError("IDE_FILE_TOO_LARGE", `${trusted.path} exceeds ${BROWSER_IDE_MAX_FILE_BYTES} UTF-8 bytes.`);
    }
    const files = state.files.map((file) => (
      file.path === trusted.path ? { ...file, contents } : file
    ));
    const totalBytes = files.reduce((sum, file) => sum + byteLength(file.contents), 0);
    if (totalBytes > BROWSER_IDE_MAX_SOURCE_BYTES) {
      throw new BrowserLabError("IDE_PROJECT_TOO_LARGE", `Browser IDE source exceeds ${BROWSER_IDE_MAX_SOURCE_BYTES} UTF-8 bytes.`);
    }
    this.state = {
      ...state,
      revision: state.revision + 1,
      files,
      updatedAt: this.now(),
    };
    this.dirty = true;
    this.lastReceipt = null;
  }

  renderEditor(): RenderedEditor {
    this.assertReady();
    const state = this.currentState();
    const trusted = this.definition.files.find((file) => file.path === state.selectedPath);
    const current = state.files.find((file) => file.path === state.selectedPath);
    if (!trusted || !current) throw new BrowserLabError("MISSING_IDE_FILE", "The selected IDE file is unavailable.");
    if (!this.bindings.editor.supports(trusted)) {
      throw new BrowserLabError("UNSUPPORTED_EDITOR", `${this.bindings.editor.adapterId} cannot edit ${trusted.path}.`);
    }
    return this.bindings.editor.render({
      extensionId: this.definition.id,
      revision: state.revision,
      selectedPath: state.selectedPath,
      file: trusted,
      value: current.contents,
      dirty: this.dirty,
      running: this.running,
    }, {
      change: (contents) => this.change(contents),
      select: (path) => this.select(path),
      save: () => this.save(),
      run: (options) => this.runChecks(options),
    });
  }

  async save(): Promise<void> {
    this.assertReady();
    const snapshot = cloneState(this.currentState());
    await this.enqueueStateSave(snapshot);
    await this.flushWrites();
    const current = this.currentState();
    if (
      current.revision === snapshot.revision
      && current.selectedPath === snapshot.selectedPath
      && current.updatedAt === snapshot.updatedAt
    ) this.dirty = false;
  }

  async runChecks(options: BrowserIdeRunOptions = {}): Promise<TestReceipt> {
    this.assertReady();
    if (this.running) throw new BrowserLabError("IDE_BUSY", "Wait for the current IDE check run to finish.");
    this.running = true;
    const runAbort = new AbortController();
    const onExternalAbort = () => runAbort.abort();
    this.activeRunAbort = runAbort;
    if (options.signal?.aborted) runAbort.abort();
    else options.signal?.addEventListener("abort", onExternalAbort, { once: true });
    const candidate = cloneState(this.currentState());
    try {
      this.assertRunActive(runAbort);
      const expectedIdentity = await this.enqueueStateSave(candidate);
      await this.flushWrites();
      this.assertRunActive(runAbort);
      const snapshot: ProjectSnapshot = {
        projectId: this.definition.id,
        revision: candidate.revision,
        files: candidate.files,
      };
      const expectedHash = await hashSnapshot(snapshot);
      const receipt = await this.bindings.runtime.run({
        extensionId: this.definition.id,
        snapshot,
        entryPoints: this.definition.entryPoints,
        suite: this.definition.checks,
        signal: runAbort.signal,
      });
      this.assertRunActive(runAbort);
      assertReceiptCurrent(receipt, {
        projectId: this.definition.id,
        projectRevision: candidate.revision,
        sourceHash: expectedHash,
        contractVersion: this.definition.checks.contractVersion,
      });
      assertReceiptCoversSuite(receipt, this.definition.checks);
      const artifact = await this.bindings.persistence.stageReceipt(this.definition.id, receipt);
      this.assertRunActive(runAbort);
      if (
        !artifact.artifactKey
        || artifact.extensionId !== this.definition.id
        || artifact.sourceHash !== receipt.sourceHash
        || artifact.contractVersion !== receipt.contractVersion
        || artifact.receiptId !== receipt.receiptId
      ) {
        throw new BrowserLabError(
          "INVALID_IDE_PERSISTENCE",
          "The persistence adapter staged a receipt artifact with the wrong source identity.",
        );
      }
      const currentHash = await hashSnapshot({
        projectId: this.definition.id,
        revision: this.currentState().revision,
        files: this.currentState().files,
      });
      if (
        this.currentState().revision !== candidate.revision
        || currentHash !== expectedHash
      ) {
        throw new BrowserLabStaleResultError("The IDE source changed while checks were running; the old result was discarded.");
      }
      this.assertRunActive(runAbort);
      this.admittingReceipt = true;
      let admitted = false;
      try {
        admitted = await this.bindings.persistence.admitReceipt(
          this.definition.id,
          artifact,
          expectedIdentity,
        );
      } finally {
        this.admittingReceipt = false;
      }
      this.assertRunActive(runAbort);
      if (!admitted) throw new BrowserLabStaleResultError("Saved IDE source changed before the receipt could be admitted.");
      this.lastReceipt = receipt;
      this.lastAcceptedReceiptState = {
        receiptId: receipt.receiptId,
        state: cloneState(candidate),
      };
      const current = this.currentState();
      if (
        current.selectedPath === candidate.selectedPath
        && current.updatedAt === candidate.updatedAt
      ) this.dirty = false;
      return receipt;
    } finally {
      options.signal?.removeEventListener("abort", onExternalAbort);
      if (this.activeRunAbort === runAbort) this.activeRunAbort = null;
      this.running = false;
    }
  }

  dispose(): void {
    this.activeRunAbort?.abort();
    this.activeRunAbort = null;
    this.disposed = true;
    this.lastReceipt = null;
    this.lastAcceptedReceiptState = null;
  }

  private assertActive(): void {
    if (this.disposed) throw new BrowserLabError("IDE_DISPOSED", "This Browser IDE session has been disposed.");
  }

  private assertReady(): void {
    this.assertActive();
    if (!this.initialized || !this.state || !this.definitionFingerprint) {
      throw new BrowserLabError("IDE_NOT_INITIALIZED", "Initialize the Browser IDE session before using it.");
    }
  }

  private assertRunActive(runAbort: AbortController): void {
    this.assertActive();
    if (runAbort.signal.aborted) throw new BrowserLabAbortError();
  }

  private currentState(): BrowserIdePersistedState {
    if (!this.state) throw new BrowserLabError("IDE_NOT_INITIALIZED", "Initialize the Browser IDE session before using it.");
    return this.state;
  }

  private async identityForState(state: BrowserIdePersistedState): Promise<BrowserIdePersistenceIdentity> {
    return {
      revision: state.revision,
      sourceHash: await hashSnapshot({
        projectId: this.definition.id,
        revision: state.revision,
        files: state.files,
      }),
    };
  }

  private enqueueStateSave(
    snapshot: BrowserIdePersistedState,
  ): Promise<BrowserIdePersistenceIdentity> {
    const operation = this.writeTail.then(async () => {
      this.assertActive();
      const identity = await this.identityForState(snapshot);
      const admitted = await this.bindings.persistence.save(
        snapshot,
        identity,
        this.persistedIdentity,
      );
      if (
        admitted.revision !== identity.revision
        || admitted.sourceHash !== identity.sourceHash
      ) {
        throw new BrowserLabError("INVALID_IDE_PERSISTENCE", "The persistence adapter admitted a different IDE source identity.");
      }
      this.persistedIdentity = admitted;
      return admitted;
    });
    this.writeTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async flushWrites(): Promise<void> {
    await this.writeTail;
    await this.bindings.persistence.flush?.();
  }
}

export function createBrowserIdeSession<RenderedEditor>(
  definition: BrowserIdeExtensionDefinition,
  bindings: BrowserIdeHostBindings<RenderedEditor>,
  options: { now?: () => number } = {},
): BrowserIdeSession<RenderedEditor> {
  return new BrowserIdeSession(definition, bindings, options.now);
}

function completeLimits(overrides: Partial<SandboxResourceLimits> = {}): SandboxResourceLimits {
  const limits = { ...DEFAULT_SANDBOX_LIMITS, ...overrides };
  validateSandboxLimits(limits);
  return limits;
}

/**
 * The hardened first-party runtime adapter. Source compiles in a dedicated
 * worker and executes in disposable QuickJS with no DOM, network, storage, or
 * worker capabilities.
 */
export function createBrowserLabIdeRuntime(
  options: BrowserLabIdeRuntimeOptions = {},
): BrowserIdeRuntimeAdapter {
  const compilerVersion = options.compilerVersion ?? BROWSER_LAB_COMPILER_VERSION;
  const limits = completeLimits(options.limits);
  const deterministicSeed = options.deterministicSeed ?? 71;
  const deterministicNowMs = options.deterministicNowMs ?? 1_700_000_000_000;
  const now = options.now ?? Date.now;
  const createId = options.createId ?? ((prefix: string) => `${prefix}-${crypto.randomUUID()}`);
  if (!Number.isSafeInteger(deterministicSeed)) throw new BrowserLabError("INVALID_SEED", "The deterministic seed must be a safe integer.");
  if (!Number.isSafeInteger(deterministicNowMs) || deterministicNowMs < 0) {
    throw new BrowserLabError("INVALID_CLOCK", "The deterministic runtime clock must be a non-negative safe integer.");
  }
  return {
    runtimeId: `browser-lab:${compilerVersion}`,
    async run(input) {
      if (input.extensionId !== input.snapshot.projectId) {
        throw new BrowserLabError("INVALID_IDE_RUNTIME_INPUT", "The IDE extension id must match the runtime project id.");
      }
      const job = await createCompileJob({
        jobId: createId("ide-compile"),
        snapshot: input.snapshot,
        compilerVersion,
        entryPoints: input.entryPoints,
        submittedAt: now(),
      });
      const compiler = options.createCompiler?.() ?? new BrowserLabCompilerClient();
      let program;
      try {
        program = await compiler.compile(job, { signal: input.signal });
      } finally {
        compiler.dispose();
      }
      return (options.createRunner?.() ?? new BrowserLabWorkerClient()).runSuite({
        schemaVersion: 1,
        jobId: createId("ide-check"),
        projectId: input.snapshot.projectId,
        projectRevision: input.snapshot.revision,
        sourceHash: job.sourceHash,
        contractVersion: input.suite.contractVersion,
        requestedAt: now(),
        deterministicSeed,
        deterministicNowMs,
        program,
        suite: input.suite,
        limits,
      }, { signal: input.signal });
    },
  };
}

export function browserIdeReceiptIdentity(receipt: TestReceipt): {
  projectId: string;
  projectRevision: number;
  sourceHash: SourceHash;
  contractVersion: string;
} {
  return {
    projectId: receipt.projectId,
    projectRevision: receipt.projectRevision,
    sourceHash: receipt.sourceHash,
    contractVersion: receipt.contractVersion,
  };
}
