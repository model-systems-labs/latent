import type { BrowserLabDatabase } from "./database";
import { assertBundleIntegrity, createPersistenceId, hashBundleContents, hashText } from "./hash";
import {
  assertStructuredValueWithinLimits,
  certifyValidatedPersistedBuild,
  isValidatedPersistedBuild,
  projectFileId,
  promotionKey,
  structurallyEqual,
  type ValidatedPersistedBuild,
} from "./pure";
import {
  PERSISTENCE_SCHEMA_VERSION,
  type BuildBindings,
  type BuildRecord,
  type CheckpointRecord,
  type ConversationMessageRecord,
  type ConversationRecord,
  type FileRevisionReason,
  type JsonValue,
  type LessonProgressRecord,
  type ProjectFileRecord,
  type ProjectRecord,
  type SettingRecord,
  type TestReceiptRecord,
  type TestResultRecord,
  type TestRunRecord,
} from "./types";

export class PersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceInvariantError";
  }
}

type RepositoryOptions = {
  now?: () => number;
  createId?: (prefix: string) => string;
};

class RepositoryBase {
  protected readonly now: () => number;
  protected readonly createId: (prefix: string) => string;

  constructor(protected readonly database: BrowserLabDatabase, options: RepositoryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? createPersistenceId;
  }
}

export type CreateProjectInput = {
  id?: string;
  title: string;
  courseId: string;
  selectedPath?: string | null;
};

export type SaveProjectFileInput = {
  projectId: string;
  path: string;
  track: string;
  title: string;
  content: string;
  referenceContent?: string | null;
  lessonId?: string | null;
  verifiedCells?: number;
  totalCells?: number;
  sourceProvenance?: "seed" | "lesson" | "ide";
  reason?: FileRevisionReason;
  /**
   * Optional compare-and-save guard. `null` means the caller observed no
   * durable file; an object binds the write to the exact observed revision
   * and source hash. The comparison and write happen in one transaction.
   */
  expected?: { revision: number; sourceHash: string } | null;
};

export type ArchiveProjectFileInput = {
  projectId: string;
  path: string;
  /**
   * The exact durable file observed by the caller. Archival fails closed when
   * another tab edits or removes that revision before this transaction runs.
   */
  expected: { revision: number; sourceHash: string };
  /**
   * Used only when the archived file is still selected. A non-null
   * replacement must already exist in the same project.
   */
  replacementPath?: string | null;
};

export class ProjectRepository extends RepositoryBase {
  async create(input: CreateProjectInput) {
    const timestamp = this.now();
    const record: ProjectRecord = {
      id: input.id ?? this.createId("project"),
      schemaVersion: PERSISTENCE_SCHEMA_VERSION,
      title: input.title,
      courseId: input.courseId,
      selectedPath: input.selectedPath ?? null,
      activeBuildId: null,
      draftRevision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.database.projects.add(record);
    return record;
  }

  get(id: string) {
    return this.database.projects.get(id);
  }

  list() {
    return this.database.projects.orderBy("updatedAt").reverse().toArray();
  }

  listFiles(projectId: string) {
    return this.database.files.where("projectId").equals(projectId).sortBy("path");
  }

  getFile(projectId: string, path: string) {
    return this.database.files.get(projectFileId(projectId, path));
  }

  listFileRevisions(projectId: string, path: string) {
    return this.database.fileRevisions
      .where("fileId")
      .equals(projectFileId(projectId, path))
      .sortBy("revision");
  }

  async selectFile(projectId: string, path: string | null) {
    if (path && !(await this.getFile(projectId, path))) throw new PersistenceInvariantError(`Can't select ${path} because the file isn't there.`);
    const updated = await this.database.projects.update(projectId, { selectedPath: path, updatedAt: this.now() });
    if (!updated) throw new PersistenceInvariantError(`Project ${projectId} doesn't exist.`);
  }

  async saveFile(input: SaveProjectFileInput) {
    assertStructuredValueWithinLimits(input);
    const sourceHash = await hashText(input.content);
    const timestamp = this.now();
    const id = projectFileId(input.projectId, input.path);

    return this.database.transaction("rw", this.database.projects, this.database.files, this.database.fileRevisions, async () => {
      const project = await this.database.projects.get(input.projectId);
      if (!project) throw new PersistenceInvariantError(`Project ${input.projectId} doesn't exist.`);
      const existing = await this.database.files.get(id);
      if (input.expected === null && existing) {
        throw new PersistenceInvariantError(`${input.path} was created in another tab before this save finished.`);
      }
      if (input.expected && (
        !existing
        || existing.revision !== input.expected.revision
        || existing.sourceHash !== input.expected.sourceHash
      )) {
        throw new PersistenceInvariantError(`${input.path} changed in another tab before this save finished.`);
      }
      const contentChanged = !existing || existing.content !== input.content;
      const archivedRevision = existing
        ? 0
        : (await this.database.fileRevisions.where("fileId").equals(id).toArray())
            .reduce((latest, revision) => Math.max(latest, revision.revision), 0);
      const revision = contentChanged ? (existing?.revision ?? archivedRevision) + 1 : existing.revision;
      const record: ProjectFileRecord = {
        id,
        projectId: input.projectId,
        path: input.path,
        track: input.track,
        title: input.title,
        content: input.content,
        referenceContent: input.referenceContent ?? existing?.referenceContent ?? null,
        lessonId: input.lessonId ?? existing?.lessonId ?? null,
        verifiedCells: input.verifiedCells ?? existing?.verifiedCells ?? 0,
        totalCells: input.totalCells ?? existing?.totalCells ?? 1,
        sourceProvenance: input.sourceProvenance ?? existing?.sourceProvenance,
        revision,
        sourceHash,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await this.database.files.put(record);
      if (contentChanged) {
        await this.database.fileRevisions.add({
          id: `${id}@${revision}`,
          projectId: input.projectId,
          fileId: id,
          path: input.path,
          revision,
          sourceHash,
          content: input.content,
          reason: input.reason ?? (existing ? "edit" : "seed"),
          createdAt: timestamp,
        });
        await this.database.projects.update(input.projectId, {
          draftRevision: project.draftRevision + 1,
          selectedPath: input.path,
          updatedAt: timestamp,
        });
      } else if (project.selectedPath !== input.path) {
        await this.database.projects.update(input.projectId, { selectedPath: input.path, updatedAt: timestamp });
      }
      return record;
    });
  }

  async archiveFile(input: ArchiveProjectFileInput) {
    assertStructuredValueWithinLimits(input);
    const timestamp = this.now();
    const id = projectFileId(input.projectId, input.path);

    return this.database.transaction("rw", this.database.projects, this.database.files, this.database.fileRevisions, async () => {
      const project = await this.database.projects.get(input.projectId);
      if (!project) throw new PersistenceInvariantError(`Project ${input.projectId} doesn't exist.`);
      const existing = await this.database.files.get(id);
      if (
        !existing
        || existing.revision !== input.expected.revision
        || existing.sourceHash !== input.expected.sourceHash
      ) {
        throw new PersistenceInvariantError(`${input.path} changed in another tab before the archive finished.`);
      }

      let selectedPath = project.selectedPath;
      if (selectedPath === input.path) {
        const replacementPath = input.replacementPath ?? null;
        if (replacementPath === input.path) {
          throw new PersistenceInvariantError(`You can't keep archived file ${input.path} selected.`);
        }
        if (replacementPath && !(await this.database.files.get(projectFileId(input.projectId, replacementPath)))) {
          throw new PersistenceInvariantError(`You can't select ${replacementPath} after archiving ${input.path} because the replacement file isn't there.`);
        }
        selectedPath = replacementPath;
      }

      await this.database.files.delete(id);
      await this.database.projects.update(input.projectId, {
        draftRevision: project.draftRevision + 1,
        selectedPath,
        updatedAt: timestamp,
      });
      return {
        file: existing,
        draftRevision: project.draftRevision + 1,
        selectedPath,
      };
    });
  }
}

export type StartTestRunInput = {
  id?: string;
  projectId: string;
  projectRevision: number;
  sourceTreeHash: string;
  contractVersion: string;
  runnerVersion: string;
};

export class AssessmentRepository extends RepositoryBase {
  async start(input: StartTestRunInput) {
    if (!(await this.database.projects.get(input.projectId))) throw new PersistenceInvariantError(`Project ${input.projectId} doesn't exist.`);
    const run: TestRunRecord = {
      id: input.id ?? this.createId("test-run"),
      projectId: input.projectId,
      projectRevision: input.projectRevision,
      sourceTreeHash: input.sourceTreeHash,
      contractVersion: input.contractVersion,
      runnerVersion: input.runnerVersion,
      status: "running",
      results: [],
      startedAt: this.now(),
      completedAt: null,
      error: null,
    };
    await this.database.testRuns.add(run);
    return run;
  }

  async finish(runId: string, results: TestResultRecord[], moduleHashes?: Record<string, string>) {
    assertStructuredValueWithinLimits(results);
    if (moduleHashes) assertStructuredValueWithinLimits(moduleHashes);
    return this.database.transaction("rw", this.database.testRuns, this.database.testReceipts, async () => {
      const existingReceipt = await this.database.testReceipts.where("runId").equals(runId).first();
      if (existingReceipt) return existingReceipt;
      const run = await this.database.testRuns.get(runId);
      if (!run) throw new PersistenceInvariantError(`Test run ${runId} doesn't exist.`);
      if (run.status !== "running") throw new PersistenceInvariantError(`Test run ${runId} already finished with status ${run.status}.`);
      const passedCount = results.filter((result) => result.passed).length;
      const passed = results.length > 0 && passedCount === results.length;
      const completedAt = this.now();
      const receipt: TestReceiptRecord = {
        id: `receipt:${run.id}`,
        runId: run.id,
        projectId: run.projectId,
        projectRevision: run.projectRevision,
        sourceTreeHash: run.sourceTreeHash,
        contractVersion: run.contractVersion,
        passed,
        passedCount,
        totalCount: results.length,
        runnerVersion: run.runnerVersion,
        ...(moduleHashes ? { moduleHashes: { ...moduleHashes } } : {}),
        origin: "host",
        createdAt: completedAt,
      };
      await this.database.testRuns.update(run.id, { status: passed ? "passed" : "failed", results, completedAt });
      await this.database.testReceipts.add(receipt);
      return receipt;
    });
  }

  getReceipt(id: string) {
    return this.database.testReceipts.get(id);
  }
}

export type PromotePassingBuildInput = {
  projectId: string;
  projectRevision: number;
  sourceTreeHash: string;
  contractVersion: string;
  testReceiptId: string;
  fileHashes: Record<string, string>;
  bundles: Record<string, string>;
  /** Optional for caller compatibility; promotion always persists computed hashes. */
  bundleHashes?: Record<string, string>;
  runtimeConfig: JsonValue;
  bindings: BuildBindings;
  checkpointId?: string | null;
};

const SOURCE_BOUND_CHARACTER_RNN_PATH = "models/character-rnn.py";

function assertSourceBoundCharacterRnnCheckpoint(
  checkpoint: CheckpointRecord | undefined,
  projectId: string,
  expectedSourceHash: string,
) {
  if (!checkpoint || checkpoint.projectId !== projectId) {
    throw new PersistenceInvariantError("This Python checkpoint isn't part of this project.");
  }
  if (checkpoint.kind !== "character-rnn" || checkpoint.origin !== "python") {
    throw new PersistenceInvariantError("Test and train the model to create a host-verified Python character-RNN checkpoint before you build.");
  }
  if (checkpoint.importedFrom !== undefined) {
    throw new PersistenceInvariantError("Imported checkpoints can restore progress, but they can't approve a build. Test and train this Python file on this device.");
  }
  if (checkpoint.sourcePath !== SOURCE_BOUND_CHARACTER_RNN_PATH || checkpoint.sourceHash !== expectedSourceHash) {
    throw new PersistenceInvariantError("The Python checkpoint came from a different source. Test and train the current models/character-rnn.py file, then build again.");
  }
}

export function assertPromotionEligibility(project: ProjectRecord, receipt: TestReceiptRecord, input: PromotePassingBuildInput) {
  if (!receipt.passed) throw new PersistenceInvariantError("You need a passing test receipt before you can build.");
  if (receipt.origin !== "host") throw new PersistenceInvariantError("An old test receipt can't approve a new validated build.");
  if (project.id !== input.projectId || receipt.projectId !== input.projectId) throw new PersistenceInvariantError("This project and test receipt don't match.");
  if (project.draftRevision !== input.projectRevision || receipt.projectRevision !== input.projectRevision) {
    throw new PersistenceInvariantError("This test receipt is stale because the project has changed.");
  }
  if (receipt.sourceTreeHash !== input.sourceTreeHash) throw new PersistenceInvariantError("The tested source hash doesn't match the build source hash.");
  if (receipt.contractVersion !== input.contractVersion) throw new PersistenceInvariantError("The test contract version doesn't match the build contract version.");
  if (receipt.id !== input.testReceiptId) throw new PersistenceInvariantError("This build didn't use the test receipt you provided.");
  if (!receipt.moduleHashes) throw new PersistenceInvariantError("The test receipt is missing its compiler module hash manifest.");
  if (!input.bundleHashes) throw new PersistenceInvariantError("The build is missing its compiler module hash manifest.");
  const receiptPaths = Object.keys(receipt.moduleHashes).sort((left, right) => left.localeCompare(right));
  const bundlePaths = Object.keys(input.bundleHashes).sort((left, right) => left.localeCompare(right));
  if (receiptPaths.length !== bundlePaths.length || receiptPaths.some((path, index) => path !== bundlePaths[index])) {
    throw new PersistenceInvariantError("The build's bundle manifest doesn't match the compiler modules that were tested.");
  }
  for (const path of receiptPaths) {
    if (receipt.moduleHashes[path] !== input.bundleHashes[path]) {
      throw new PersistenceInvariantError(`The build bundle for ${path} doesn't match the tested compiler module hash.`);
    }
  }
}

export class BuildRepository extends RepositoryBase {
  private certify(build: BuildRecord, receipt: TestReceiptRecord | undefined, run: TestRunRecord | undefined) {
    try {
      return certifyValidatedPersistedBuild(build, receipt, run);
    } catch (error) {
      throw new PersistenceInvariantError(error instanceof Error ? error.message : "This validated build has an invalid test receipt.");
    }
  }

  private async certifyStoredBuild(build: BuildRecord) {
    const receipt = typeof build.testReceiptId === "string"
      ? await this.database.testReceipts.get(build.testReceiptId)
      : undefined;
    const run = receipt ? await this.database.testRuns.get(receipt.runId) : undefined;
    return this.certify(build, receipt, run);
  }

  async promotePassing(input: PromotePassingBuildInput) {
    assertStructuredValueWithinLimits(input);
    await assertBundleIntegrity(input.bundles, input.bundleHashes);
    const bundleHashes = await hashBundleContents(input.bundles);
    const verifiedInput = { ...input, bundleHashes };
    const characterRnnSourceHash = input.fileHashes[SOURCE_BOUND_CHARACTER_RNN_PATH];
    if (characterRnnSourceHash && !input.checkpointId) {
      throw new PersistenceInvariantError("Build blocked: test and train models/character-rnn.py after the latest edit, then build again.");
    }
    const key = promotionKey(input.projectId, input.sourceTreeHash, input.contractVersion, input.checkpointId ?? null);
    // Web Crypto promises must settle before entering the Dexie transaction;
    // otherwise IndexedDB may auto-commit while integrity verification waits.
    const existingBeforeTransaction = await this.database.builds.where("promotionKey").equals(key).first();
    if (existingBeforeTransaction) {
      await assertBundleIntegrity(existingBeforeTransaction.bundles, existingBeforeTransaction.bundleHashes);
    }
    return this.database.transaction("rw", this.database.projects, this.database.testRuns, this.database.testReceipts, this.database.checkpoints, this.database.builds, async () => {
      const [project, receipt, existing, checkpoint] = await Promise.all([
        this.database.projects.get(input.projectId),
        this.database.testReceipts.get(input.testReceiptId),
        this.database.builds.where("promotionKey").equals(key).first(),
        input.checkpointId ? this.database.checkpoints.get(input.checkpointId) : Promise.resolve(undefined),
      ]);
      if (!project) throw new PersistenceInvariantError(`Project ${input.projectId} doesn't exist.`);
      if (!receipt) throw new PersistenceInvariantError(`Test receipt ${input.testReceiptId} doesn't exist.`);
      const run = await this.database.testRuns.get(receipt.runId);
      assertPromotionEligibility(project, receipt, verifiedInput);
      if (characterRnnSourceHash) {
        assertSourceBoundCharacterRnnCheckpoint(checkpoint, project.id, characterRnnSourceHash);
      } else if (input.checkpointId && (!checkpoint || checkpoint.projectId !== project.id)) {
        throw new PersistenceInvariantError("This build checkpoint isn't part of this project.");
      }

      if (existing) {
        const existingReceipt = existing.testReceiptId === receipt.id
          ? receipt
          : typeof existing.testReceiptId === "string"
            ? await this.database.testReceipts.get(existing.testReceiptId)
            : undefined;
        const existingRun = existingReceipt?.runId === run?.id
          ? run
          : existingReceipt
            ? await this.database.testRuns.get(existingReceipt.runId)
            : undefined;
        const certified = this.certify(existing, existingReceipt, existingRun);
        await this.database.projects.update(project.id, { activeBuildId: existing.id, updatedAt: this.now() });
        return certified;
      }
      const latest = await this.database.builds
        .where("[projectId+buildNumber]")
        .between([project.id, 0], [project.id, Number.MAX_SAFE_INTEGER], true, true)
        .last();
      const build: BuildRecord = {
        id: this.createId("build"),
        promotionKey: key,
        projectId: project.id,
        projectRevision: input.projectRevision,
        schemaVersion: PERSISTENCE_SCHEMA_VERSION,
        buildNumber: (latest?.buildNumber ?? 0) + 1,
        sourceTreeHash: input.sourceTreeHash,
        contractVersion: input.contractVersion,
        fileHashes: { ...input.fileHashes },
        bundles: { ...input.bundles },
        bundleHashes,
        runtimeConfig: input.runtimeConfig,
        bindings: { ...input.bindings },
        testReceiptId: receipt.id,
        checkpointId: input.checkpointId ?? null,
        provenance: "validated",
        createdAt: this.now(),
      };
      const certified = this.certify(build, receipt, run);
      await this.database.builds.add(build);
      await this.database.projects.update(project.id, { activeBuildId: build.id, updatedAt: build.createdAt });
      return certified;
    });
  }

  private async activeRecord(projectId: string): Promise<BuildRecord | ValidatedPersistedBuild | undefined> {
    const project = await this.database.projects.get(projectId);
    if (!project?.activeBuildId) return undefined;
    const build = await this.database.builds.get(project.activeBuildId);
    if (!build) throw new PersistenceInvariantError(`Project ${project.id} points to a missing active build.`);
    if (build.projectId !== project.id) throw new PersistenceInvariantError(`Project ${project.id} points to another project's active build.`);
    await assertBundleIntegrity(build.bundles, build.bundleHashes);
    if (build.provenance === "validated") return this.certifyStoredBuild(build);
    if (build.provenance === "legacy") return build;
    throw new PersistenceInvariantError("The active build has invalid provenance, so it can't run.");
  }

  async active(projectId: string): Promise<BuildRecord | undefined> {
    return this.activeRecord(projectId);
  }

  async activeValidated(projectId: string): Promise<ValidatedPersistedBuild | undefined> {
    const build = await this.activeRecord(projectId);
    if (!build) return undefined;
    if (!isValidatedPersistedBuild(build)) {
      throw new PersistenceInvariantError("The trusted runtime needs an active build that passed host validation.");
    }
    return build;
  }

  async list(projectId: string) {
    const builds = await this.database.builds.where("projectId").equals(projectId).sortBy("buildNumber");
    if (builds.some((build) => build.provenance !== "validated" && build.provenance !== "legacy")) {
      throw new PersistenceInvariantError("The build history contains invalid provenance, so it can't be opened safely.");
    }
    await Promise.all(builds.map((build) => assertBundleIntegrity(build.bundles, build.bundleHashes)));
    await Promise.all(builds.filter((build) => build.provenance === "validated").map((build) => this.certifyStoredBuild(build)));
    return builds;
  }
}

export class CheckpointRepository extends RepositoryBase {
  async add(input: Omit<CheckpointRecord, "id" | "createdAt"> & { id?: string; createdAt?: number }) {
    assertStructuredValueWithinLimits(input.payload);
    if (!(await this.database.projects.get(input.projectId))) throw new PersistenceInvariantError(`Project ${input.projectId} doesn't exist.`);
    const checkpoint: CheckpointRecord = { ...input, id: input.id ?? this.createId("checkpoint"), createdAt: input.createdAt ?? this.now() };
    await this.database.checkpoints.add(checkpoint);
    return checkpoint;
  }

  get(id: string) {
    return this.database.checkpoints.get(id);
  }
}

function normalizedProgressRecord(record: LessonProgressRecord, updatedAt: number): LessonProgressRecord {
  return {
    ...record,
    verifiedCellIds: [...new Set(record.verifiedCellIds)],
    verifiedSources: record.verifiedSources ? { ...record.verifiedSources } : undefined,
    verifiedContractVersion: typeof record.verifiedContractVersion === "string" ? record.verifiedContractVersion : undefined,
    hiddenBlockIds: [...new Set(record.hiddenBlockIds)],
    answers: { ...record.answers },
    knowledgeAnswers: record.knowledgeAnswers ? { ...record.knowledgeAnswers } : undefined,
    knowledgeVerifiedIds: record.knowledgeVerifiedIds
      ? [...new Set(record.knowledgeVerifiedIds)]
      : undefined,
    updatedAt,
  };
}

function progressComparisonValue(record: LessonProgressRecord) {
  return {
    ...record,
    verifiedCellIds: [...new Set(record.verifiedCellIds)],
    verifiedSources: record.verifiedSources ?? null,
    verifiedContractVersion: record.verifiedContractVersion ?? null,
    hiddenBlockIds: [...new Set(record.hiddenBlockIds)],
    answers: record.answers,
    knowledgeAnswers: record.knowledgeAnswers ?? null,
    knowledgeVerifiedIds: record.knowledgeVerifiedIds ? [...new Set(record.knowledgeVerifiedIds)] : null,
  };
}

export class ProgressRepository extends RepositoryBase {
  async put(record: LessonProgressRecord) {
    const safe = normalizedProgressRecord(record, this.now());
    assertStructuredValueWithinLimits(safe);
    await this.database.lessonProgress.put(safe);
    return safe;
  }

  /** Atomically binds a lesson write to the exact durable row the tab observed. */
  async compareAndPut(record: LessonProgressRecord, expected: LessonProgressRecord | null) {
    const updatedAt = Number.isFinite(record.updatedAt) ? record.updatedAt : this.now();
    const safe = normalizedProgressRecord(record, updatedAt);
    assertStructuredValueWithinLimits(safe);
    return this.database.transaction("rw", this.database.lessonProgress, async () => {
      const current = await this.database.lessonProgress.get(record.id);
      if (current && structurallyEqual(progressComparisonValue(current), progressComparisonValue(safe))) return current;
      const expectationMatches = expected === null
        ? !current
        : Boolean(current) && structurallyEqual(progressComparisonValue(current!), progressComparisonValue(expected));
      if (!expectationMatches) {
        throw new PersistenceInvariantError(`${record.lessonId} changed in another tab before this save completed.`);
      }
      await this.database.lessonProgress.put(safe);
      return safe;
    });
  }

  get(id: string) {
    return this.database.lessonProgress.get(id);
  }

  forCourse(courseId: string) {
    return this.database.lessonProgress.where("courseId").equals(courseId).sortBy("updatedAt");
  }
}

export class ConversationRepository extends RepositoryBase {
  async create(input: Omit<ConversationRecord, "createdAt" | "updatedAt">) {
    const timestamp = this.now();
    const conversation: ConversationRecord = { ...input, createdAt: timestamp, updatedAt: timestamp };
    await this.database.conversations.add(conversation);
    return conversation;
  }

  async appendMessage(input: Omit<ConversationMessageRecord, "sequence" | "createdAt"> & { createdAt?: number }) {
    assertStructuredValueWithinLimits(input);
    return this.database.transaction("rw", this.database.conversations, this.database.conversationMessages, async () => {
      const conversation = await this.database.conversations.get(input.conversationId);
      if (!conversation) throw new PersistenceInvariantError(`Conversation ${input.conversationId} doesn't exist.`);
      const latest = await this.database.conversationMessages
        .where("[conversationId+sequence]")
        .between([input.conversationId, 0], [input.conversationId, Number.MAX_SAFE_INTEGER], true, true)
        .last();
      const timestamp = input.createdAt ?? this.now();
      const message: ConversationMessageRecord = { ...input, sequence: (latest?.sequence ?? -1) + 1, createdAt: timestamp };
      await this.database.conversationMessages.add(message);
      await this.database.conversations.update(conversation.id, { updatedAt: timestamp });
      return message;
    });
  }

  messages(conversationId: string) {
    return this.database.conversationMessages.where("conversationId").equals(conversationId).sortBy("sequence");
  }

  async updateMessageStatus(id: string, status: ConversationMessageRecord["status"]) {
    const message = await this.database.conversationMessages.get(id);
    if (!message) throw new PersistenceInvariantError(`Message ${id} doesn't exist.`);
    await this.database.conversationMessages.update(id, { status });
    await this.database.conversations.update(message.conversationId, { updatedAt: this.now() });
  }
}

export class SettingsRepository extends RepositoryBase {
  async put(key: string, value: JsonValue) {
    assertStructuredValueWithinLimits(value);
    const setting: SettingRecord = { key, value, updatedAt: this.now() };
    await this.database.settings.put(setting);
    return setting;
  }

  async get<T extends JsonValue = JsonValue>(key: string) {
    return (await this.database.settings.get(key))?.value as T | undefined;
  }
}

export class PersistenceRepositories {
  readonly projects: ProjectRepository;
  readonly assessments: AssessmentRepository;
  readonly builds: BuildRepository;
  readonly checkpoints: CheckpointRepository;
  readonly progress: ProgressRepository;
  readonly conversations: ConversationRepository;
  readonly settings: SettingsRepository;

  constructor(readonly database: BrowserLabDatabase, options: RepositoryOptions = {}) {
    this.projects = new ProjectRepository(database, options);
    this.assessments = new AssessmentRepository(database, options);
    this.builds = new BuildRepository(database, options);
    this.checkpoints = new CheckpointRepository(database, options);
    this.progress = new ProgressRepository(database, options);
    this.conversations = new ConversationRepository(database, options);
    this.settings = new SettingsRepository(database, options);
  }
}
