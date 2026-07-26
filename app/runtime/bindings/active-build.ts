import {
  isValidatedPersistedBuild,
  type ValidatedPersistedBuild,
} from "@/app/platform/persistence/pure";
import type { BuildRecord } from "@/app/platform/persistence/types";
import {
  BrowserLabError,
  hashText,
  isSourceHash,
  validateBindingManifest,
  verifyCompiledModuleHashes,
  type BindingManifest,
  type BuildArtifact,
  type RuntimeBinding,
  type SourceHash,
} from "@latent/browser-lab";
import {
  LLM_LESSON_SOURCES,
  LLM_RUNTIME_CAPABILITIES,
  type CapstoneRuntimeConsumer,
  type LlmRuntimeCapabilityDefinition,
} from "@/app/runtime/bindings/manifest";

export type ActiveBuildOrigin = "browser-lab-artifact" | "persisted-build";

export type SafeRuntimeBindingReference = {
  bindingId: string;
  capability: string;
  modulePath: string;
  exportName: string;
  kind: RuntimeBinding["kind"];
  required: boolean;
  consumer: CapstoneRuntimeConsumer;
  summary: string;
  executionTarget: "isolated-browser-lab-worker" | "sandboxed-preview-frame";
};

export type ActiveBuildContribution = {
  lessonId: string;
  moduleId: string;
  moduleTitle: string;
  sourcePath: string;
  contributionHash: SourceHash;
  hashKind: "compiled-module" | "source-file";
  mode: "executable-binding" | "provenance-only";
  capabilities: readonly string[];
  enteredActiveBuild: true;
};

export type CapstoneRuntimeDescriptor = {
  schemaVersion: 1;
  origin: ActiveBuildOrigin;
  buildId: string;
  projectId: string;
  buildNumber: number;
  projectRevision: number;
  contractVersion: string;
  compilerVersion: string | null;
  testReceiptId: string;
  createdAt: number;
  fingerprints: {
    sourceTree: SourceHash;
    lessonSources: SourceHash;
    executableModules: SourceHash;
  };
  bindings: readonly SafeRuntimeBindingReference[];
  contributions: readonly ActiveBuildContribution[];
  executionPolicy: {
    pageEvaluationAllowed: false;
    sourceIncluded: false;
    target: "isolated-worker-and-sandboxed-preview-frame";
  };
};

type NormalizedBuild = {
  origin: ActiveBuildOrigin;
  buildId: string;
  projectId: string;
  buildNumber: number;
  projectRevision: number;
  sourceTreeHash: SourceHash;
  contractVersion: string;
  compilerVersion: string | null;
  testReceiptId: string;
  createdAt: number;
  bindingManifest: BindingManifest;
  lessonHashes: ReadonlyMap<string, SourceHash>;
  executableModuleHashes: ReadonlyMap<string, SourceHash>;
  hashKind: ActiveBuildContribution["hashKind"];
};

function fail(code: string, message: string): never {
  throw new BrowserLabError(code, message);
}

function assertPositiveBuildIdentity(build: {
  projectId: string;
  buildNumber: number;
  projectRevision: number;
  contractVersion: string;
  createdAt: number;
}): void {
  if (!build.projectId.trim()) fail("INVALID_ACTIVE_BUILD", "Add a project id to the active build.");
  if (!Number.isSafeInteger(build.buildNumber) || build.buildNumber < 1) {
    fail("INVALID_ACTIVE_BUILD", "The active build number has to be greater than zero.");
  }
  if (!Number.isSafeInteger(build.projectRevision) || build.projectRevision < 0) {
    fail("INVALID_ACTIVE_BUILD", "The active build has an invalid project revision.");
  }
  if (!build.contractVersion.trim() || !Number.isFinite(build.createdAt)) {
    fail("INVALID_ACTIVE_BUILD", "The active build is missing required details.");
  }
}

function assertCanonicalBinding(
  actual: RuntimeBinding,
  expected: LlmRuntimeCapabilityDefinition,
): void {
  const fields = ["bindingId", "capability", "modulePath", "exportName", "kind", "required"] as const;
  const changed = fields.filter((field) => actual[field] !== expected[field]);
  if (changed.length) {
    fail(
      "RUNTIME_BINDING_TAMPERED",
      `Runtime capability ${expected.capability} changed these course-owned fields: ${changed.join(", ")}.`,
    );
  }
}

/**
 * Validates the manifest against the course-owned allowlist. Optional bindings
 * may be omitted, but an unknown binding or a changed path/export/kind is never
 * forwarded to the capstone.
 */
export function assertLlmRuntimeBindingManifest(manifest: BindingManifest): void {
  if (manifest.schemaVersion !== 1) {
    fail("UNSUPPORTED_BINDINGS", "This LLM runtime binding manifest version isn't supported.");
  }
  const expectedByCapability = new Map(
    LLM_RUNTIME_CAPABILITIES.map((definition) => [definition.capability, definition]),
  );
  const seen = new Set<string>();
  for (const binding of manifest.bindings) {
    if (seen.has(binding.capability)) {
      fail("DUPLICATE_CAPABILITY", `Runtime capability ${binding.capability} appears more than once.`);
    }
    seen.add(binding.capability);
    const expected = expectedByCapability.get(binding.capability);
    if (!expected) {
      fail("UNKNOWN_RUNTIME_BINDING", `Runtime capability ${binding.capability} isn't provided by the course.`);
    }
    assertCanonicalBinding(binding, expected);
  }
  for (const expected of LLM_RUNTIME_CAPABILITIES) {
    if (expected.required && !seen.has(expected.capability)) {
      fail(
        "MISSING_REQUIRED_CAPABILITY",
        `The active build is missing required capability ${expected.capability}.`,
      );
    }
  }
}

function safeBindingReferences(manifest: BindingManifest): readonly SafeRuntimeBindingReference[] {
  return Object.freeze(
    manifest.bindings
      .map((binding) => {
        const definition = LLM_RUNTIME_CAPABILITIES.find(
          (candidate) => candidate.capability === binding.capability,
        );
        if (!definition) {
          fail("UNKNOWN_RUNTIME_BINDING", `Runtime capability ${binding.capability} isn't provided by the course.`);
        }
        return Object.freeze({
          bindingId: binding.bindingId,
          capability: binding.capability,
          modulePath: binding.modulePath,
          exportName: binding.exportName,
          kind: binding.kind,
          required: binding.required,
          consumer: definition.consumer,
          summary: definition.summary,
          executionTarget: binding.capability === "ui.mount"
            ? "sandboxed-preview-frame" as const
            : "isolated-browser-lab-worker" as const,
        });
      })
      .sort((left, right) => left.capability.localeCompare(right.capability)),
  );
}

function assertCompleteLessonHashes(
  hashes: ReadonlyMap<string, SourceHash>,
): void {
  const expectedPaths = new Set(LLM_LESSON_SOURCES.map((lesson) => lesson.sourcePath));
  for (const lesson of LLM_LESSON_SOURCES) {
    if (!hashes.has(lesson.sourcePath)) {
      fail(
        "INCOMPLETE_BUILD_CONTRIBUTIONS",
        `The active build is missing the tested lesson source ${lesson.sourcePath}.`,
      );
    }
  }
  for (const path of hashes.keys()) {
    if (expectedPaths.has(path) && !isSourceHash(hashes.get(path))) {
      fail("INVALID_CONTRIBUTION_HASH", `Lesson source ${path} has an invalid SHA-256 hash.`);
    }
  }
}

function persistedBindingManifest(build: BuildRecord): BindingManifest {
  const knownKeys = new Set(
    LLM_RUNTIME_CAPABILITIES.flatMap((definition) => [
      definition.capability,
      definition.bindingId,
    ]),
  );
  for (const key of Object.keys(build.bindings)) {
    if (!knownKeys.has(key)) {
      fail("UNKNOWN_RUNTIME_BINDING", `Saved runtime binding ${key} isn't provided by the course.`);
    }
  }
  const bindings = LLM_RUNTIME_CAPABILITIES.flatMap((definition) => {
    const reference =
      build.bindings[definition.capability] ?? build.bindings[definition.bindingId];
    if (!reference) return [];
    return [
      {
        bindingId: definition.bindingId,
        capability: definition.capability,
        modulePath: reference.modulePath,
        exportName: reference.exportName,
        kind: definition.kind,
        required: definition.required,
      } satisfies RuntimeBinding,
    ];
  });
  return { schemaVersion: 1, bindings };
}

async function normalizeArtifact(artifact: BuildArtifact): Promise<NormalizedBuild> {
  assertPositiveBuildIdentity(artifact);
  if (artifact.schemaVersion !== 1 || artifact.program.schemaVersion !== 1) {
    fail("INVALID_ACTIVE_BUILD", "This Browser Lab build artifact version isn't supported.");
  }
  if (!isSourceHash(artifact.sourceHash)) {
    fail("INVALID_ACTIVE_BUILD", "This Browser Lab artifact has an invalid source hash.");
  }
  if (
    artifact.program.projectId !== artifact.projectId ||
    artifact.program.projectRevision !== artifact.projectRevision ||
    artifact.program.sourceHash !== artifact.sourceHash ||
    artifact.program.compilerVersion !== artifact.compilerVersion
  ) {
    fail("BUILD_IDENTITY_TAMPERED", "The program details in this Browser Lab artifact don't match the artifact.");
  }
  if (!artifact.testReceiptId.trim()) {
    fail("INVALID_ACTIVE_BUILD", "This Browser Lab artifact is missing a passing test receipt.");
  }
  validateBindingManifest(artifact.bindingManifest, artifact.program);
  assertLlmRuntimeBindingManifest(artifact.bindingManifest);
  await verifyCompiledModuleHashes(artifact.program);

  const lessonHashes = new Map<string, SourceHash>();
  for (const compiledModule of artifact.program.modules) {
    if (lessonHashes.has(compiledModule.modulePath)) {
      fail("DUPLICATE_BUILD_MODULE", `Compiled module ${compiledModule.modulePath} appears more than once.`);
    }
    lessonHashes.set(compiledModule.modulePath, compiledModule.codeHash);
  }
  assertCompleteLessonHashes(lessonHashes);

  return {
    origin: "browser-lab-artifact",
    buildId: artifact.artifactId,
    projectId: artifact.projectId,
    buildNumber: artifact.buildNumber,
    projectRevision: artifact.projectRevision,
    sourceTreeHash: artifact.sourceHash,
    contractVersion: artifact.contractVersion,
    compilerVersion: artifact.compilerVersion,
    testReceiptId: artifact.testReceiptId,
    createdAt: artifact.createdAt,
    bindingManifest: artifact.bindingManifest,
    lessonHashes,
    executableModuleHashes: lessonHashes,
    hashKind: "compiled-module",
  };
}

async function normalizePersistedBuild(build: ValidatedPersistedBuild): Promise<NormalizedBuild> {
  assertPositiveBuildIdentity(build);
  if (build.schemaVersion !== 1 || build.provenance !== "validated") {
    fail("UNVALIDATED_ACTIVE_BUILD", "Only a validated saved build can run the capstone.");
  }
  if (!build.testReceiptId?.trim()) {
    fail("UNVALIDATED_ACTIVE_BUILD", "The saved build is missing a host-owned passing test receipt.");
  }
  if (!isSourceHash(build.sourceTreeHash)) {
    fail("INVALID_ACTIVE_BUILD", "The saved build has an invalid source-tree hash.");
  }

  const bindingManifest = persistedBindingManifest(build);
  assertLlmRuntimeBindingManifest(bindingManifest);
  const lessonHashes = new Map<string, SourceHash>();
  for (const [path, hash] of Object.entries(build.fileHashes)) {
    if (isSourceHash(hash)) lessonHashes.set(path, hash);
    else if (LLM_LESSON_SOURCES.some((lesson) => lesson.sourcePath === path)) {
      fail("INVALID_CONTRIBUTION_HASH", `Lesson source ${path} has an invalid SHA-256 hash.`);
    }
  }
  assertCompleteLessonHashes(lessonHashes);

  const executableModuleHashes = new Map<string, SourceHash>();
  for (const binding of bindingManifest.bindings) {
    const bundle = build.bundles[binding.modulePath];
    if (typeof bundle !== "string") {
      fail(
        "MISSING_RUNTIME_BUNDLE",
        `Saved capability ${binding.capability} is missing its isolated bundle for ${binding.modulePath}.`,
      );
    }
    if (!executableModuleHashes.has(binding.modulePath)) {
      executableModuleHashes.set(binding.modulePath, await hashText(bundle));
    }
  }

  return {
    origin: "persisted-build",
    buildId: build.id,
    projectId: build.projectId,
    buildNumber: build.buildNumber,
    projectRevision: build.projectRevision,
    sourceTreeHash: build.sourceTreeHash,
    contractVersion: build.contractVersion,
    compilerVersion: null,
    testReceiptId: build.testReceiptId,
    createdAt: build.createdAt,
    bindingManifest,
    lessonHashes,
    executableModuleHashes,
    hashKind: "source-file",
  };
}

function isBuildArtifact(build: BuildArtifact | ValidatedPersistedBuild): build is BuildArtifact {
  return Boolean(build) && typeof build === "object" && "artifactId" in build && "program" in build && "bindingManifest" in build;
}

async function fingerprintEntries(
  entries: readonly (readonly [string, string])[],
): Promise<SourceHash> {
  return hashText(
    JSON.stringify(
      [...entries].sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

/**
 * Produces metadata that the capstone can display and hand to an isolated
 * runtime loader. It intentionally contains no bundle/source text and never
 * evaluates learner code in the application realm.
 */
export async function createCapstoneRuntimeDescriptor(
  build: BuildArtifact | ValidatedPersistedBuild,
): Promise<CapstoneRuntimeDescriptor> {
  const normalized = isBuildArtifact(build)
    ? await normalizeArtifact(build)
    : isValidatedPersistedBuild(build)
      ? await normalizePersistedBuild(build)
      : fail("UNVALIDATED_ACTIVE_BUILD", "This saved build hasn't been validated. Load it through the validated build repository before using its host-owned passing receipt.");
  const bindings = safeBindingReferences(normalized.bindingManifest);
  const capabilitiesByPath = new Map<string, string[]>();
  for (const binding of bindings) {
    const capabilities = capabilitiesByPath.get(binding.modulePath) ?? [];
    capabilities.push(binding.capability);
    capabilitiesByPath.set(binding.modulePath, capabilities);
  }
  const contributions = Object.freeze(
    LLM_LESSON_SOURCES.map((lesson) => {
      const capabilities = Object.freeze(
        [...(capabilitiesByPath.get(lesson.sourcePath) ?? [])].sort(),
      );
      const contributionHash = normalized.lessonHashes.get(lesson.sourcePath);
      if (!contributionHash) {
        fail("INCOMPLETE_BUILD_CONTRIBUTIONS", `The build is missing contribution ${lesson.sourcePath}.`);
      }
      return Object.freeze({
        ...lesson,
        contributionHash,
        hashKind: normalized.hashKind,
        mode: capabilities.length ? "executable-binding" as const : "provenance-only" as const,
        capabilities,
        enteredActiveBuild: true as const,
      });
    }),
  );
  const lessonSourcesFingerprint = await fingerprintEntries(
    contributions.map((contribution) => [
      contribution.sourcePath,
      contribution.contributionHash,
    ] as const),
  );
  const executableModulesFingerprint = await fingerprintEntries(
    bindings.map((binding) => [
      `${binding.capability}:${binding.modulePath}:${binding.exportName}`,
      normalized.executableModuleHashes.get(binding.modulePath) ?? "missing",
    ] as const),
  );

  return Object.freeze({
    schemaVersion: 1 as const,
    origin: normalized.origin,
    buildId: normalized.buildId,
    projectId: normalized.projectId,
    buildNumber: normalized.buildNumber,
    projectRevision: normalized.projectRevision,
    contractVersion: normalized.contractVersion,
    compilerVersion: normalized.compilerVersion,
    testReceiptId: normalized.testReceiptId,
    createdAt: normalized.createdAt,
    fingerprints: Object.freeze({
      sourceTree: normalized.sourceTreeHash,
      lessonSources: lessonSourcesFingerprint,
      executableModules: executableModulesFingerprint,
    }),
    bindings,
    contributions,
    executionPolicy: Object.freeze({
      pageEvaluationAllowed: false as const,
      sourceIncluded: false as const,
      target: "isolated-worker-and-sandboxed-preview-frame" as const,
    }),
  });
}

export type ValidatedCapstoneBundle = {
  descriptor: CapstoneRuntimeDescriptor;
  entryPath: string;
  code: string;
  codeHash: SourceHash;
};

export type CertifiedCapstoneRuntimeConfig = Readonly<{
  version: 1;
  model: Readonly<{ temperature: number; topK: number; maxTokens: number; seed: number }>;
  transport: Readonly<{ wordsPerEvent: number; delayMs: number }>;
  interface: Readonly<{ assistantName: string; responsePrefix: string; showMetrics: boolean }>;
  buildNumber: number;
  builtAt: number;
}>;

function plainRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactRuntimeKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedRuntimeNumber(value: unknown, minimum: number, maximum: number, integer = false): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    && (!integer || Number.isInteger(value));
}

/** Returns only the fixed runtime settings stored with this exact verified build. */
export function certifiedCapstoneRuntimeConfig(build: ValidatedPersistedBuild): CertifiedCapstoneRuntimeConfig {
  if (!isValidatedPersistedBuild(build)) {
    fail("UNVALIDATED_RUNTIME_CONFIG", "This build record hasn't been validated, so it can't supply the capstone runtime.");
  }
  const root = build.runtimeConfig;
  if (!plainRuntimeRecord(root) || !hasExactRuntimeKeys(root, ["version", "model", "transport", "interface", "buildNumber", "builtAt"]) || root.version !== 1) {
    fail("INVALID_RUNTIME_CONFIG", "The verified build doesn't include the expected runtime settings.");
  }
  const model = root.model;
  const transport = root.transport;
  const presentation = root.interface;
  if (!plainRuntimeRecord(model) || !hasExactRuntimeKeys(model, ["temperature", "topK", "maxTokens", "seed"])
    || !boundedRuntimeNumber(model.temperature, 0.2, 1.8)
    || !boundedRuntimeNumber(model.topK, 0, 64, true)
    || !boundedRuntimeNumber(model.maxTokens, 40, 160, true)
    || !boundedRuntimeNumber(model.seed, 0, 99_999, true)) {
    fail("INVALID_RUNTIME_CONFIG", "The build's model settings are missing or outside the allowed range.");
  }
  if (!plainRuntimeRecord(transport) || !hasExactRuntimeKeys(transport, ["wordsPerEvent", "delayMs"])
    || !boundedRuntimeNumber(transport.wordsPerEvent, 1, 12, true)
    || !boundedRuntimeNumber(transport.delayMs, 0, 200, true)) {
    fail("INVALID_RUNTIME_CONFIG", "The build's transport settings are missing or outside the allowed range.");
  }
  if (!plainRuntimeRecord(presentation) || !hasExactRuntimeKeys(presentation, ["assistantName", "responsePrefix", "showMetrics"])
    || typeof presentation.assistantName !== "string" || !presentation.assistantName.trim()
    || presentation.assistantName !== presentation.assistantName.trim() || presentation.assistantName.length > 24
    || typeof presentation.responsePrefix !== "string" || presentation.responsePrefix.length > 60
    || typeof presentation.showMetrics !== "boolean") {
    fail("INVALID_RUNTIME_CONFIG", "The build's interface settings are missing or outside the allowed range.");
  }
  return Object.freeze({
    version: 1 as const,
    model: Object.freeze({ temperature: model.temperature, topK: model.topK, maxTokens: model.maxTokens, seed: model.seed }),
    transport: Object.freeze({ wordsPerEvent: transport.wordsPerEvent, delayMs: transport.delayMs }),
    interface: Object.freeze({ assistantName: presentation.assistantName, responsePrefix: presentation.responsePrefix, showMetrics: presentation.showMetrics }),
    buildNumber: build.buildNumber,
    builtAt: build.createdAt,
  });
}

/**
 * Returns executable UI bytes only after the active build, canonical binding,
 * and persisted compiler hash have all been verified. Callers must execute the
 * code in the opaque-origin preview frame, never in the application realm.
 */
export async function loadValidatedCapstoneBundle(
  build: BuildArtifact | ValidatedPersistedBuild,
): Promise<ValidatedCapstoneBundle> {
  const descriptor = await createCapstoneRuntimeDescriptor(build);
  const binding = descriptor.bindings.find((candidate) => candidate.capability === "ui.mount");
  if (!binding || binding.executionTarget !== "sandboxed-preview-frame") {
    fail("MISSING_CAPSTONE_UI", "The active build is missing a validated capstone UI entry point.");
  }
  let code: string | undefined;
  let expectedHash: string | undefined;
  if (isBuildArtifact(build)) {
    const compiled = build.program.modules.find((module) => module.modulePath === binding.modulePath);
    code = compiled?.code;
    expectedHash = compiled?.codeHash;
  } else {
    code = build.bundles[binding.modulePath];
    expectedHash = build.bundleHashes?.[binding.modulePath];
  }
  if (!code || !expectedHash || !isSourceHash(expectedHash)) {
    fail("UNVERIFIED_CAPSTONE_UI", "The active build is missing the compiler hash for its capstone UI bundle.");
  }
  const codeHash = await hashText(code);
  if (codeHash !== expectedHash) {
    fail("COMPILED_CODE_TAMPERED", "The capstone UI bundle doesn't match its compiler hash anymore.");
  }
  if (new TextEncoder().encode(code).byteLength > 2_000_000) {
    fail("CAPSTONE_UI_TOO_LARGE", "The capstone UI bundle is too large for the preview.");
  }
  return Object.freeze({ descriptor, entryPath: binding.modulePath, code, codeHash });
}
