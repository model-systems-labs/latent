import type { BuildRecord } from "../../platform/persistence/types";
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
} from "./manifest";

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
  executionTarget: "isolated-browser-lab-worker";
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
    target: "isolated-browser-lab-worker";
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
  if (!build.projectId.trim()) fail("INVALID_ACTIVE_BUILD", "The active build needs a project id.");
  if (!Number.isSafeInteger(build.buildNumber) || build.buildNumber < 1) {
    fail("INVALID_ACTIVE_BUILD", "The active build needs a positive build number.");
  }
  if (!Number.isSafeInteger(build.projectRevision) || build.projectRevision < 0) {
    fail("INVALID_ACTIVE_BUILD", "The active build revision is invalid.");
  }
  if (!build.contractVersion.trim() || !Number.isFinite(build.createdAt)) {
    fail("INVALID_ACTIVE_BUILD", "The active build metadata is incomplete.");
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
      `Runtime capability ${expected.capability} changed its course-owned ${changed.join(", ")} contract.`,
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
    fail("UNSUPPORTED_BINDINGS", "Unsupported LLM runtime binding manifest version.");
  }
  const expectedByCapability = new Map(
    LLM_RUNTIME_CAPABILITIES.map((definition) => [definition.capability, definition]),
  );
  const seen = new Set<string>();
  for (const binding of manifest.bindings) {
    if (seen.has(binding.capability)) {
      fail("DUPLICATE_CAPABILITY", `Runtime capability ${binding.capability} is duplicated.`);
    }
    seen.add(binding.capability);
    const expected = expectedByCapability.get(binding.capability);
    if (!expected) {
      fail("UNKNOWN_RUNTIME_BINDING", `Runtime capability ${binding.capability} is not course-authored.`);
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
          fail("UNKNOWN_RUNTIME_BINDING", `Runtime capability ${binding.capability} is not course-authored.`);
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
          executionTarget: "isolated-browser-lab-worker" as const,
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
        `The active build does not include tested lesson source ${lesson.sourcePath}.`,
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
      fail("UNKNOWN_RUNTIME_BINDING", `Persisted runtime binding ${key} is not course-authored.`);
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
    fail("INVALID_ACTIVE_BUILD", "Unsupported Browser Lab build artifact version.");
  }
  if (!isSourceHash(artifact.sourceHash)) {
    fail("INVALID_ACTIVE_BUILD", "The Browser Lab artifact has an invalid source hash.");
  }
  if (
    artifact.program.projectId !== artifact.projectId ||
    artifact.program.projectRevision !== artifact.projectRevision ||
    artifact.program.sourceHash !== artifact.sourceHash ||
    artifact.program.compilerVersion !== artifact.compilerVersion
  ) {
    fail("BUILD_IDENTITY_TAMPERED", "The Browser Lab program identity does not match its artifact.");
  }
  if (!artifact.testReceiptId.trim()) {
    fail("INVALID_ACTIVE_BUILD", "The Browser Lab artifact has no passing test receipt.");
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

async function normalizePersistedBuild(build: BuildRecord): Promise<NormalizedBuild> {
  assertPositiveBuildIdentity(build);
  if (build.schemaVersion !== 1 || build.provenance !== "validated") {
    fail("UNVALIDATED_ACTIVE_BUILD", "Only a validated persisted build may power the capstone.");
  }
  if (!build.testReceiptId?.trim()) {
    fail("UNVALIDATED_ACTIVE_BUILD", "The persisted build has no host-owned passing test receipt.");
  }
  if (!isSourceHash(build.sourceTreeHash)) {
    fail("INVALID_ACTIVE_BUILD", "The persisted build has an invalid source-tree hash.");
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
        `Persisted capability ${binding.capability} has no isolated bundle for ${binding.modulePath}.`,
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

function isBuildArtifact(build: BuildArtifact | BuildRecord): build is BuildArtifact {
  return "artifactId" in build && "program" in build && "bindingManifest" in build;
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
  build: BuildArtifact | BuildRecord,
): Promise<CapstoneRuntimeDescriptor> {
  const normalized = isBuildArtifact(build)
    ? await normalizeArtifact(build)
    : await normalizePersistedBuild(build);
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
        fail("INCOMPLETE_BUILD_CONTRIBUTIONS", `Missing contribution ${lesson.sourcePath}.`);
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
      target: "isolated-browser-lab-worker" as const,
    }),
  });
}
