import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_QUESTION_GROUP_LEECH_POLICY,
  QUESTION_GROUP_PROGRESS_FORMAT,
  QUESTION_GROUP_PROGRESS_SCHEMA_VERSION,
  canonicalQuestionGroupProgressJson,
  isLeechQuestionProgress,
  queryQuestionGroupProgress,
  questionGroupProgressJsonSchema,
  questionGroupProgressSchema,
} from "../dist/index.js";

function progress(overrides = {}) {
  return {
    format: QUESTION_GROUP_PROGRESS_FORMAT,
    schemaVersion: QUESTION_GROUP_PROGRESS_SCHEMA_VERSION,
    libraryId: "example/methods",
    libraryVersion: "1.0.0",
    libraryDigest: "a".repeat(64),
    groupId: "arrays",
    questionId: "unique-values",
    contractVersion: "question-groups-v1:example/methods@1.0.0:arrays/unique-values",
    status: "attempted",
    attemptCount: 3,
    failureCount: 2,
    lastAttemptAt: 100,
    solvedAt: null,
    updatedAt: 100,
    ...overrides,
  };
}

test("portable Question Group progress is strict, version-bound, and source-free", () => {
  const parsed = questionGroupProgressSchema.parse(progress());
  assert.equal(parsed.libraryVersion, "1.0.0");
  assert.equal("source" in parsed, false);
  assert.throws(() => questionGroupProgressSchema.parse(progress({ source: "private learner code" })));
  assert.throws(() => questionGroupProgressSchema.parse(progress({
    failureCount: 4,
    attemptCount: 3,
  })));
  assert.throws(() => questionGroupProgressSchema.parse(progress({
    status: "solved",
    solvedAt: null,
  })));
  assert.throws(() => questionGroupProgressSchema.parse(progress({
    status: "new",
    attemptCount: 1,
    failureCount: 0,
    lastAttemptAt: 100,
  })));
});

test("leech review is a pure query over unsolved progress", () => {
  assert.deepEqual(DEFAULT_QUESTION_GROUP_LEECH_POLICY, {
    minimumAttempts: 3,
    minimumFailures: 2,
  });
  const leech = progress();
  const solved = progress({ questionId: "solved", status: "solved", solvedAt: 100 });
  const early = progress({
    questionId: "early",
    attemptCount: 2,
    failureCount: 2,
  });
  assert.equal(isLeechQuestionProgress(leech), true);
  assert.equal(isLeechQuestionProgress(solved), false);
  assert.equal(isLeechQuestionProgress(early), false);
  assert.deepEqual(
    queryQuestionGroupProgress([leech, solved, early], { kind: "leeches" }),
    [leech],
  );
  assert.deepEqual(
    queryQuestionGroupProgress([leech, solved, early], {
      kind: "status",
      status: "solved",
    }),
    [solved],
  );
  assert.throws(() => isLeechQuestionProgress(leech, {
    minimumAttempts: 1,
    minimumFailures: 2,
  }));
});

test("canonical progress snapshots are validated and newline terminated", () => {
  const source = canonicalQuestionGroupProgressJson(progress());
  assert.ok(source.endsWith("\n"));
  assert.deepEqual(JSON.parse(source), progress());
});

test("the progress contract has its own immutable v1 schema identity", () => {
  assert.equal(
    questionGroupProgressJsonSchema.$id,
    "https://model-systems-labs.github.io/latent/question-groups/v1/question-group-progress.schema.json",
  );
  assert.equal(questionGroupProgressJsonSchema.additionalProperties, false);
  assert.equal(questionGroupProgressJsonSchema.properties.format.const, QUESTION_GROUP_PROGRESS_FORMAT);
});
