import type { BrowserLabDatabase } from "./database";
import { assertBundleIntegrity, createPersistenceId, hashBundleContents, hashText } from "./hash";
import { assertStructuredValueWithinLimits, projectFileId, promotionKey } from "./pure";
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
  reason?: FileRevisionReason;
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

  async selectFile(projectId: string, path: string | null) {
    if (path && !(await this.getFile(projectId, path))) throw new PersistenceInvariantError(`Cannot select missing file ${path}.`);
    const updated = await this.database.projects.update(projectId, { selectedPath: path, updatedAt: this.now() });
    if (!updated) throw new PersistenceInvariantError(`Project ${projectId} does not exist.`);
  }

  async saveFile(input: SaveProjectFileInput) {
    assertStructuredValueWithinLimits(input);
    const sourceHash = await hashText(input.content);
    const timestamp = this.now();
    const id = projectFileId(input.projectId, input.path);

    return this.database.transaction("rw", this.database.projects, this.database.files, this.database.fileRevisions, async () => {
      const project = await this.database.projects.get(input.projectId);
      if (!project) throw new PersistenceInvariantError(`Project ${input.projectId} does not exist.`);
      const existing = await this.database.files.get(id);
      const contentChanged = !existing || existing.content !== input.content;
      const revision = contentChanged ? (existing?.revision ?? 0) + 1 : existing.revision;
      const record: ProjectFileRecord = {
        id,
        projectId: input.projectId,
        path: input.path,
        track: input.track,
        title: input.title,
        content: input.content,
        referenceContent: input.referenceContent ?? existing?.referenceContent ?? null,
        lessonId: input.lessonId ?? existing?.lessonId ?? null,
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
    if (!(await this.database.projects.get(input.projectId))) throw new PersistenceInvariantError(`Project ${input.projectId} does not exist.`);
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
      if (!run) throw new PersistenceInvariantError(`Test run ${runId} does not exist.`);
      if (run.status !== "running") throw new PersistenceInvariantError(`Test run ${runId} is already ${run.status}.`);
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

export function assertPromotionEligibility(project: ProjectRecord, receipt: TestReceiptRecord, input: PromotePassingBuildInput) {
  if (!receipt.passed) throw new PersistenceInvariantError("Only a passing test receipt can be promoted.");
  if (receipt.origin !== "host") throw new PersistenceInvariantError("Legacy receipts cannot authorize a new validated build.");
  if (project.id !== input.projectId || receipt.projectId !== input.projectId) throw new PersistenceInvariantError("The project and test receipt do not match.");
  if (project.draftRevision !== input.projectRevision || receipt.projectRevision !== input.projectRevision) {
    throw new PersistenceInvariantError("The test receipt is stale for the current project revision.");
  }
  if (receipt.sourceTreeHash !== input.sourceTreeHash) throw new PersistenceInvariantError("The tested source hash does not match the build source hash.");
  if (receipt.contractVersion !== input.contractVersion) throw new PersistenceInvariantError("The test contract version does not match the build contract version.");
  if (receipt.id !== input.testReceiptId) throw new PersistenceInvariantError("The supplied test receipt was not used for this build.");
  if (!receipt.moduleHashes) throw new PersistenceInvariantError("The test receipt has no compiler module hash manifest.");
  if (!input.bundleHashes) throw new PersistenceInvariantError("The promoted build has no compiler module hash manifest.");
  const receiptPaths = Object.keys(receipt.moduleHashes).sort((left, right) => left.localeCompare(right));
  const bundlePaths = Object.keys(input.bundleHashes).sort((left, right) => left.localeCompare(right));
  if (receiptPaths.length !== bundlePaths.length || receiptPaths.some((path, index) => path !== bundlePaths[index])) {
    throw new PersistenceInvariantError("The promoted bundle manifest does not match the tested compiler modules.");
  }
  for (const path of receiptPaths) {
    if (receipt.moduleHashes[path] !== input.bundleHashes[path]) {
      throw new PersistenceInvariantError(`The promoted bundle for ${path} does not match the tested compiler module hash.`);
    }
  }
}

export class BuildRepository extends RepositoryBase {
  async promotePassing(input: PromotePassingBuildInput) {
    assertStructuredValueWithinLimits(input);
    await assertBundleIntegrity(input.bundles, input.bundleHashes);
    const bundleHashes = await hashBundleContents(input.bundles);
    const verifiedInput = { ...input, bundleHashes };
    const key = promotionKey(input.projectId, input.sourceTreeHash, input.contractVersion);
    // Web Crypto promises must settle before entering the Dexie transaction;
    // otherwise IndexedDB may auto-commit while integrity verification waits.
    const existingBeforeTransaction = await this.database.builds.where("promotionKey").equals(key).first();
    if (existingBeforeTransaction) {
      await assertBundleIntegrity(existingBeforeTransaction.bundles, existingBeforeTransaction.bundleHashes);
    }
    return this.database.transaction("rw", this.database.projects, this.database.testReceipts, this.database.checkpoints, this.database.builds, async () => {
      const [project, receipt, existing] = await Promise.all([
        this.database.projects.get(input.projectId),
        this.database.testReceipts.get(input.testReceiptId),
        this.database.builds.where("promotionKey").equals(key).first(),
      ]);
      if (!project) throw new PersistenceInvariantError(`Project ${input.projectId} does not exist.`);
      if (!receipt) throw new PersistenceInvariantError(`Test receipt ${input.testReceiptId} does not exist.`);
      assertPromotionEligibility(project, receipt, verifiedInput);

      if (existing) {
        await this.database.projects.update(project.id, { activeBuildId: existing.id, updatedAt: this.now() });
        return existing;
      }
      if (input.checkpointId) {
        const checkpoint = await this.database.checkpoints.get(input.checkpointId);
        if (!checkpoint || checkpoint.projectId !== project.id) throw new PersistenceInvariantError("The build checkpoint does not belong to this project.");
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
      await this.database.builds.add(build);
      await this.database.projects.update(project.id, { activeBuildId: build.id, updatedAt: build.createdAt });
      return build;
    });
  }

  async active(projectId: string) {
    const project = await this.database.projects.get(projectId);
    const build = project?.activeBuildId ? await this.database.builds.get(project.activeBuildId) : undefined;
    if (build) await assertBundleIntegrity(build.bundles, build.bundleHashes);
    return build;
  }

  async list(projectId: string) {
    const builds = await this.database.builds.where("projectId").equals(projectId).sortBy("buildNumber");
    await Promise.all(builds.map((build) => assertBundleIntegrity(build.bundles, build.bundleHashes)));
    return builds;
  }
}

export class CheckpointRepository extends RepositoryBase {
  async add(input: Omit<CheckpointRecord, "id" | "createdAt"> & { id?: string; createdAt?: number }) {
    assertStructuredValueWithinLimits(input.payload);
    if (!(await this.database.projects.get(input.projectId))) throw new PersistenceInvariantError(`Project ${input.projectId} does not exist.`);
    const checkpoint: CheckpointRecord = { ...input, id: input.id ?? this.createId("checkpoint"), createdAt: input.createdAt ?? this.now() };
    await this.database.checkpoints.add(checkpoint);
    return checkpoint;
  }

  get(id: string) {
    return this.database.checkpoints.get(id);
  }
}

export class ProgressRepository extends RepositoryBase {
  async put(record: LessonProgressRecord) {
    const safe = {
      ...record,
      verifiedCellIds: [...new Set(record.verifiedCellIds)],
      hiddenBlockIds: [...new Set(record.hiddenBlockIds)],
      answers: { ...record.answers },
      updatedAt: this.now(),
    };
    assertStructuredValueWithinLimits(safe);
    await this.database.lessonProgress.put(safe);
    return safe;
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
      if (!conversation) throw new PersistenceInvariantError(`Conversation ${input.conversationId} does not exist.`);
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
    if (!message) throw new PersistenceInvariantError(`Message ${id} does not exist.`);
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
