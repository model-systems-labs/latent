import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  canonicalQuestionGroupLibraryJson,
  createQuestionGroupPlayer,
} from "../dist/index.js";

async function exampleLibrary() {
  const guide = await readFile(
    new URL("../../../docs/question-groups.md", import.meta.url),
    "utf8",
  );
  return JSON.parse(guide.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "null");
}

function digest(library) {
  return createHash("sha256")
    .update(canonicalQuestionGroupLibraryJson(library))
    .digest("hex");
}

test("the injectable player resolves only declared content and trusted host runtimes", async () => {
  const library = await exampleLibrary();
  const libraryDigest = digest(library);
  const calls = [];
  const rows = new Map();
  const player = await createQuestionGroupPlayer({
    library,
    libraryDigest,
    now: () => 123,
    runtime: {
      supports: (runtime) => runtime.id === "browser-typescript",
      async run(request) {
        calls.push(request);
        const cases = request.question.cases
          .filter((exerciseCase) => (
            request.mode === "check" || exerciseCase.visibility === "example"
          ))
          .map((exerciseCase) => ({
            id: exerciseCase.id,
            passed: false,
            detail: "Expected five.",
          }));
        return {
          passed: false,
          cases,
        };
      },
    },
    progress: {
      async transact(identity, update) {
        const key = `${identity.groupId}/${identity.questionId}`;
        const value = update(rows.get(key) ?? null);
        rows.set(key, value);
        return value;
      },
      async list() {
        return [...rows.values()];
      },
    },
  });

  assert.equal(player.question("arithmetic", "add-two-values")?.language, "typescript");
  assert.equal(player.question("missing", "missing"), null);
  await assert.rejects(
    player.run({
      groupId: "missing",
      questionId: "missing",
      source: "",
      mode: "check",
    }),
    /Unknown Question Group question/,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await player.run({
      groupId: "arithmetic",
      questionId: "add-two-values",
      source: "class Solution { add(left: number, right: number): number { return left + right; } }",
      mode: "check",
    });
  }
  assert.equal(calls.length, 3);
  assert.equal(calls[0].runtime.environment, "browser-worker");
  assert.equal(calls[0].contractVersion, player.contractVersion("arithmetic", "add-two-values"));
  assert.match(calls[0].contractVersion, new RegExp(`sha256:${libraryDigest}:`));
  assert.equal(calls[0].libraryDigest, libraryDigest);
  assert.equal(calls[0].question.runtimeId, "browser-typescript");
  const leeches = await player.progress({ kind: "leeches" });
  assert.equal(leeches.length, 1);
  assert.equal(leeches[0].attemptCount, 3);
  assert.equal(leeches[0].failureCount, 3);
  assert.equal("source" in leeches[0], false);
});

test("the player rejects unsupported adapters and inconsistent runtime results", async () => {
  const library = await exampleLibrary();
  const libraryDigest = digest(library);
  await assert.rejects(createQuestionGroupPlayer({
    library,
    libraryDigest: "not-a-digest",
    runtime: { supports: () => true, run: async () => ({ passed: true, cases: [] }) },
  }), /canonical library SHA-256 digest/);
  await assert.rejects(createQuestionGroupPlayer({
    library,
    libraryDigest: "b".repeat(64),
    runtime: { supports: () => true, run: async () => ({ passed: true, cases: [] }) },
  }), /does not match the canonical library bytes/);

  const unsupported = await createQuestionGroupPlayer({
    library,
    libraryDigest,
    runtime: {
      supports: () => false,
      run: async () => ({ passed: true, cases: [] }),
    },
  });
  await assert.rejects(
    unsupported.run({
      groupId: "arithmetic",
      questionId: "add-two-values",
      source: "class Solution {}",
      mode: "examples",
    }),
    /does not support typescript in browser-worker/,
  );

  const inconsistent = await createQuestionGroupPlayer({
    library,
    libraryDigest,
    runtime: {
      supports: () => true,
      run: async () => ({
        passed: true,
        cases: [{ id: "small-values", passed: false }],
      }),
    },
  });
  await assert.rejects(
    inconsistent.run({
      groupId: "arithmetic",
      questionId: "add-two-values",
      source: "class Solution {}",
      mode: "examples",
    }),
    /inconsistent pass result/,
  );
});

test("example runs never create attempts, leeches, or solved progress", async () => {
  const library = await exampleLibrary();
  const libraryDigest = digest(library);
  const rows = new Map();
  const player = await createQuestionGroupPlayer({
    library,
    libraryDigest,
    runtime: {
      supports: () => true,
      async run(request) {
        return {
          passed: true,
          cases: request.question.cases
            .filter((exerciseCase) => exerciseCase.visibility === "example")
            .map((exerciseCase) => ({ id: exerciseCase.id, passed: true })),
        };
      },
    },
    progress: {
      async transact(identity, update) {
        const key = `${identity.groupId}/${identity.questionId}`;
        const value = update(rows.get(key) ?? null);
        rows.set(key, value);
        return value;
      },
      async list() {
        return [...rows.values()];
      },
    },
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await player.run({
      groupId: "arithmetic",
      questionId: "add-two-values",
      source: "class Solution { add() { return 5; } }",
      mode: "examples",
    });
  }
  assert.equal(rows.size, 0);
  assert.deepEqual(await player.progress(), []);
  assert.deepEqual(await player.progress({ kind: "leeches" }), []);
});

test("atomic progress transactions preserve concurrent attempts", async () => {
  const library = await exampleLibrary();
  const libraryDigest = digest(library);
  const rows = new Map();
  const tails = new Map();
  const progress = {
    transact(identity, update) {
      const key = `${identity.groupId}/${identity.questionId}`;
      const transaction = (tails.get(key) ?? Promise.resolve()).then(() => {
        const value = update(rows.get(key) ?? null);
        rows.set(key, value);
        return value;
      });
      tails.set(key, transaction.then(() => undefined, () => undefined));
      return transaction;
    },
    async list() {
      await Promise.all(tails.values());
      return [...rows.values()];
    },
  };
  const player = await createQuestionGroupPlayer({
    library,
    libraryDigest,
    now: () => 200,
    runtime: {
      supports: () => true,
      async run(request) {
        return {
          passed: false,
          cases: request.question.cases.map((exerciseCase) => ({
            id: exerciseCase.id,
            passed: false,
          })),
        };
      },
    },
    progress,
  });

  await Promise.all([
    player.run({
      groupId: "arithmetic",
      questionId: "add-two-values",
      source: "bad",
      mode: "check",
    }),
    player.run({
      groupId: "arithmetic",
      questionId: "add-two-values",
      source: "bad",
      mode: "check",
    }),
  ]);

  const [stored] = await player.progress();
  assert.equal(stored.attemptCount, 2);
  assert.equal(stored.failureCount, 2);
});
