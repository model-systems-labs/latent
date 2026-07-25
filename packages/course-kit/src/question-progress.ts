import { z } from "zod";

export const QUESTION_GROUP_PROGRESS_FORMAT = "latent-question-group-progress" as const;
export const QUESTION_GROUP_PROGRESS_SCHEMA_VERSION = 1 as const;

const libraryIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,63}$/;
const contentIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const libraryIdSchema = z.string().min(3).max(129).regex(
  libraryIdPattern,
  "Use the namespaced id from the Question Group library.",
);
const contentIdSchema = z.string().min(1).max(80).regex(
  contentIdPattern,
  "Use the stable id from the Question Group library.",
);
const timestampSchema = z.number().int().nonnegative().max(8_640_000_000_000);

export const questionGroupProgressStatusSchema = z.enum(["new", "attempted", "solved"]);

/**
 * Portable progress deliberately excludes learner source and host persistence
 * metadata. Hosts may keep those privately, then export this bounded snapshot
 * for interoperable status and leech queries.
 */
export const questionGroupProgressSchema = z.object({
  format: z.literal(QUESTION_GROUP_PROGRESS_FORMAT),
  schemaVersion: z.literal(QUESTION_GROUP_PROGRESS_SCHEMA_VERSION),
  libraryId: libraryIdSchema,
  libraryVersion: z.string().regex(semverPattern, "Use the Question Group library version."),
  libraryDigest: z.string().regex(/^[a-f0-9]{64}$/, "Use the canonical library SHA-256 digest."),
  groupId: contentIdSchema,
  questionId: contentIdSchema,
  contractVersion: z.string().trim().min(1).max(256),
  status: questionGroupProgressStatusSchema,
  attemptCount: z.number().int().nonnegative().max(1_000_000),
  failureCount: z.number().int().nonnegative().max(1_000_000),
  lastAttemptAt: timestampSchema.nullable(),
  solvedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema,
}).strict().superRefine((progress, context) => {
  if (progress.failureCount > progress.attemptCount) {
    context.addIssue({
      code: "custom",
      path: ["failureCount"],
      message: "Failure count may not exceed attempt count.",
    });
  }
  if (progress.status === "new" && (
    progress.attemptCount !== 0
    || progress.failureCount !== 0
    || progress.lastAttemptAt !== null
    || progress.solvedAt !== null
  )) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "New progress may not contain attempts, failures, or completion timestamps.",
    });
  }
  if (progress.status !== "new" && (
    progress.attemptCount === 0
    || progress.lastAttemptAt === null
  )) {
    context.addIssue({
      code: "custom",
      path: ["attemptCount"],
      message: "Attempted or solved progress must contain at least one timestamped attempt.",
    });
  }
  if ((progress.status === "solved") !== (progress.solvedAt !== null)) {
    context.addIssue({
      code: "custom",
      path: ["solvedAt"],
      message: "Solved progress requires solvedAt; unsolved progress must leave it null.",
    });
  }
  if (
    progress.lastAttemptAt !== null
    && progress.lastAttemptAt > progress.updatedAt
  ) {
    context.addIssue({
      code: "custom",
      path: ["lastAttemptAt"],
      message: "Last attempt time may not be newer than the snapshot.",
    });
  }
  if (progress.solvedAt !== null && progress.solvedAt > progress.updatedAt) {
    context.addIssue({
      code: "custom",
      path: ["solvedAt"],
      message: "Solved time may not be newer than the snapshot.",
    });
  }
});

export type QuestionGroupProgressStatus = z.infer<typeof questionGroupProgressStatusSchema>;
export type QuestionGroupProgress = z.infer<typeof questionGroupProgressSchema>;

export type QuestionGroupLeechPolicy = {
  minimumAttempts: number;
  minimumFailures: number;
};

export const DEFAULT_QUESTION_GROUP_LEECH_POLICY: Readonly<QuestionGroupLeechPolicy> =
  Object.freeze({
    minimumAttempts: 3,
    minimumFailures: 2,
  });

export type QuestionGroupProgressQuery =
  | { kind: "all" }
  | { kind: "status"; status: QuestionGroupProgressStatus }
  | { kind: "leeches"; policy?: Partial<QuestionGroupLeechPolicy> };

function normalizedLeechPolicy(
  policy: Partial<QuestionGroupLeechPolicy> = {},
): QuestionGroupLeechPolicy {
  const value = {
    ...DEFAULT_QUESTION_GROUP_LEECH_POLICY,
    ...policy,
  };
  for (const [name, threshold] of Object.entries(value)) {
    if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > 1_000_000) {
      throw new Error(`${name} must be an integer between 1 and 1,000,000.`);
    }
  }
  if (value.minimumFailures > value.minimumAttempts) {
    throw new Error("minimumFailures may not exceed minimumAttempts.");
  }
  return value;
}

export function isLeechQuestionProgress(
  progress: Pick<QuestionGroupProgress, "status" | "attemptCount" | "failureCount">,
  policy: Partial<QuestionGroupLeechPolicy> = {},
) {
  const normalized = normalizedLeechPolicy(policy);
  return progress.status !== "solved"
    && progress.attemptCount >= normalized.minimumAttempts
    && progress.failureCount >= normalized.minimumFailures;
}

export function queryQuestionGroupProgress(
  progress: readonly QuestionGroupProgress[],
  query: QuestionGroupProgressQuery,
) {
  if (query.kind === "all") return [...progress];
  if (query.kind === "status") {
    return progress.filter((entry) => entry.status === query.status);
  }
  return progress.filter((entry) => isLeechQuestionProgress(entry, query.policy));
}

export function canonicalQuestionGroupProgressJson(progress: QuestionGroupProgress) {
  const parsed = questionGroupProgressSchema.parse(progress);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export const questionGroupProgressJsonSchema = {
  ...z.toJSONSchema(questionGroupProgressSchema, {
    target: "draft-07",
    unrepresentable: "any",
  }),
  $id: "https://model-systems-labs.github.io/latent/question-groups/v1/question-group-progress.schema.json",
  title: "Latent Question Group Progress v1",
  description: "Framework-neutral, source-free progress snapshots for Question Group status and leech queries.",
};
