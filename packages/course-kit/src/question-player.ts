import {
  canonicalQuestionGroupLibraryJson,
  type PracticeQuestion,
  type QuestionGroup,
  type QuestionGroupLibrary,
  type QuestionGroupRuntimeRequirement,
  validateQuestionGroupLibrary,
} from "./question-group.js";
import {
  QUESTION_GROUP_PROGRESS_FORMAT,
  QUESTION_GROUP_PROGRESS_SCHEMA_VERSION,
  queryQuestionGroupProgress,
  questionGroupProgressSchema,
  type QuestionGroupProgress,
  type QuestionGroupProgressQuery,
} from "./question-progress.js";

export type QuestionPlayerRunMode = "examples" | "check";

export type QuestionPlayerCaseResult = {
  id: string;
  passed: boolean;
  detail?: string;
};

export type QuestionPlayerRunResult = {
  passed: boolean;
  cases: QuestionPlayerCaseResult[];
  output?: string;
};

export type QuestionPlayerRuntimeRequest = {
  libraryId: string;
  libraryVersion: string;
  libraryDigest: string;
  group: QuestionGroup;
  question: PracticeQuestion;
  runtime: QuestionGroupRuntimeRequirement;
  contractVersion: string;
  source: string;
  mode: QuestionPlayerRunMode;
  signal?: AbortSignal;
};

/**
 * A runtime is injected by trusted host code. Question Group JSON can select a
 * declared runtime requirement, but it cannot provide or load an adapter.
 */
export type QuestionPlayerRuntimeAdapter = {
  supports(requirement: QuestionGroupRuntimeRequirement): boolean;
  run(request: QuestionPlayerRuntimeRequest): Promise<QuestionPlayerRunResult>;
};

export type QuestionPlayerProgressStore = {
  /**
   * Run `update` atomically for one progress identity.
   *
   * Implementations must serialize this transaction across every tab, worker,
   * and player instance that shares the backing store. The callback is
   * synchronous and may be retried, so it must not perform side effects.
   */
  transact(input: {
    libraryId: string;
    libraryVersion: string;
    libraryDigest: string;
    groupId: string;
    questionId: string;
  }, update: (
    progress: QuestionGroupProgress | null,
  ) => QuestionGroupProgress): Promise<QuestionGroupProgress>;
  list(input: {
    libraryId: string;
    libraryVersion: string;
    libraryDigest: string;
  }): Promise<readonly QuestionGroupProgress[]>;
};

export type QuestionPlayer = {
  readonly library: QuestionGroupLibrary;
  readonly groups: readonly QuestionGroup[];
  question(groupId: string, questionId: string): PracticeQuestion | null;
  contractVersion(groupId: string, questionId: string): string;
  run(input: {
    groupId: string;
    questionId: string;
    source: string;
    mode: QuestionPlayerRunMode;
    signal?: AbortSignal;
  }): Promise<QuestionPlayerRunResult>;
  progress(query?: QuestionGroupProgressQuery): Promise<readonly QuestionGroupProgress[]>;
};

function catalogKey(groupId: string, questionId: string) {
  return `${groupId}\u0000${questionId}`;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function contractVersion(
  library: QuestionGroupLibrary,
  libraryDigest: string,
  groupId: string,
  questionId: string,
) {
  return `question-groups-v${library.schemaVersion}:${library.library.id}@${library.library.version}:sha256:${libraryDigest}:${groupId}/${questionId}`;
}

export async function canonicalQuestionGroupLibraryDigest(
  library: QuestionGroupLibrary,
) {
  const validation = validateQuestionGroupLibrary(library);
  if (!validation.valid) {
    throw new Error(
      `Cannot digest an invalid Question Group library: ${validation.errors[0]?.message ?? "unknown error"}`,
    );
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("This runtime does not provide Web Crypto SHA-256 support.");
  }
  const source = canonicalQuestionGroupLibraryJson(validation.library);
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createQuestionGroupPlayer(input: {
  library: QuestionGroupLibrary;
  libraryDigest: string;
  runtime: QuestionPlayerRuntimeAdapter;
  progress?: QuestionPlayerProgressStore;
  now?: () => number;
}): Promise<QuestionPlayer> {
  const validation = validateQuestionGroupLibrary(input.library);
  if (!validation.valid) {
    throw new Error(
      `Cannot create a player for an invalid Question Group library: ${validation.errors[0]?.message ?? "unknown error"}`,
    );
  }
  if (!/^[a-f0-9]{64}$/.test(input.libraryDigest)) {
    throw new Error("Question Group player requires the canonical library SHA-256 digest.");
  }
  const canonicalDigest = await canonicalQuestionGroupLibraryDigest(validation.library);
  if (canonicalDigest !== input.libraryDigest) {
    throw new Error("Question Group player digest does not match the canonical library bytes.");
  }
  const library = deepFreeze(validation.library);
  const runtimeById = new Map(library.runtimes.map((runtime) => [runtime.id, runtime]));
  const catalog = new Map<string, { group: QuestionGroup; question: PracticeQuestion }>();
  for (const group of library.groups) {
    for (const question of group.questions) {
      catalog.set(catalogKey(group.id, question.id), { group, question });
    }
  }

  const find = (groupId: string, questionId: string) => (
    catalog.get(catalogKey(groupId, questionId)) ?? null
  );
  const versionFor = (groupId: string, questionId: string) => {
    if (!find(groupId, questionId)) {
      throw new Error(`Unknown Question Group question: ${groupId}/${questionId}`);
    }
    return contractVersion(library, input.libraryDigest, groupId, questionId);
  };

  return Object.freeze({
    library,
    groups: library.groups,
    question(groupId: string, questionId: string) {
      return find(groupId, questionId)?.question ?? null;
    },
    contractVersion: versionFor,
    async run(runInput: Parameters<QuestionPlayer["run"]>[0]) {
      const selected = find(runInput.groupId, runInput.questionId);
      if (!selected) {
        throw new Error(`Unknown Question Group question: ${runInput.groupId}/${runInput.questionId}`);
      }
      const runtime = runtimeById.get(selected.question.runtimeId);
      if (!runtime) {
        throw new Error(`Question runtime is missing: ${selected.question.runtimeId}`);
      }
      if (!input.runtime.supports(runtime)) {
        throw new Error(
          `The injected host runtime does not support ${runtime.language} in ${runtime.environment}.`,
        );
      }
      if (runInput.source.length > 200_000) {
        throw new Error("Question source may not exceed 200,000 characters.");
      }
      const currentContractVersion = versionFor(runInput.groupId, runInput.questionId);
      const result = await input.runtime.run({
        libraryId: library.library.id,
        libraryVersion: library.library.version,
        libraryDigest: input.libraryDigest,
        group: selected.group,
        question: selected.question,
        runtime,
        contractVersion: currentContractVersion,
        source: runInput.source,
        mode: runInput.mode,
        signal: runInput.signal,
      });
      if (
        typeof result?.passed !== "boolean"
        || !Array.isArray(result.cases)
        || result.cases.some((entry) => (
          !entry
          || typeof entry.id !== "string"
          || typeof entry.passed !== "boolean"
          || (entry.detail !== undefined && typeof entry.detail !== "string")
        ))
        || (result.output !== undefined && typeof result.output !== "string")
      ) {
        throw new Error("The injected runtime returned an invalid result.");
      }
      if (result.passed !== result.cases.every((entry) => entry.passed)) {
        throw new Error("The injected runtime returned an inconsistent pass result.");
      }
      let resultBytes: number;
      try {
        resultBytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
      } catch {
        throw new Error("The injected runtime returned a non-serializable result.");
      }
      if (resultBytes > runtime.limits.maxOutputBytes) {
        throw new Error("The injected runtime exceeded the declared output limit.");
      }
      const expectedCaseIds = selected.question.cases
        .filter((practiceCase) => (
          runInput.mode === "check" || practiceCase.visibility === "example"
        ))
        .map((practiceCase) => practiceCase.id);
      if (
        result.cases.length !== expectedCaseIds.length
        || new Set(result.cases.map((entry) => entry.id)).size !== result.cases.length
        || expectedCaseIds.some((id) => !result.cases.some((entry) => entry.id === id))
      ) {
        throw new Error("The injected runtime did not return exactly the requested cases.");
      }
      if (input.progress && runInput.mode === "check") {
        const identity = {
          libraryId: library.library.id,
          libraryVersion: library.library.version,
          libraryDigest: input.libraryDigest,
          groupId: selected.group.id,
          questionId: selected.question.id,
        };
        const attemptedAt = (input.now ?? Date.now)();
        await input.progress.transact(identity, (stored) => {
          const parsedStored = stored ? questionGroupProgressSchema.safeParse(stored) : null;
          const previous = parsedStored?.success
            && parsedStored.data.libraryId === identity.libraryId
            && parsedStored.data.libraryVersion === identity.libraryVersion
            && parsedStored.data.libraryDigest === identity.libraryDigest
            && parsedStored.data.groupId === identity.groupId
            && parsedStored.data.questionId === identity.questionId
            && parsedStored.data.contractVersion === currentContractVersion
            ? parsedStored.data
            : null;
          const attemptCount = (previous?.attemptCount ?? 0) + 1;
          const failureCount = (previous?.failureCount ?? 0) + (result.passed ? 0 : 1);
          return questionGroupProgressSchema.parse({
            format: QUESTION_GROUP_PROGRESS_FORMAT,
            schemaVersion: QUESTION_GROUP_PROGRESS_SCHEMA_VERSION,
            ...identity,
            contractVersion: currentContractVersion,
            status: result.passed ? "solved" : "attempted",
            attemptCount,
            failureCount,
            lastAttemptAt: attemptedAt,
            solvedAt: result.passed ? attemptedAt : null,
            updatedAt: attemptedAt,
          });
        });
      }
      return result;
    },
    async progress(query: QuestionGroupProgressQuery = { kind: "all" }) {
      if (!input.progress) return [];
      const entries = await input.progress.list({
        libraryId: library.library.id,
        libraryVersion: library.library.version,
        libraryDigest: input.libraryDigest,
      });
      const validated = entries.flatMap((entry) => {
        const parsed = questionGroupProgressSchema.safeParse(entry);
        const selected = parsed.success
          ? catalog.get(catalogKey(parsed.data.groupId, parsed.data.questionId))
          : null;
        return parsed.success
          && parsed.data.libraryId === library.library.id
          && parsed.data.libraryVersion === library.library.version
          && parsed.data.libraryDigest === input.libraryDigest
          && selected
          && parsed.data.contractVersion === versionFor(
            selected.group.id,
            selected.question.id,
          )
          ? [parsed.data]
          : [];
      });
      return queryQuestionGroupProgress(validated, query);
    },
  });
}
