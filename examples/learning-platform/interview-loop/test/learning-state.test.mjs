import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLearningPackStateStore,
  sha256Hex,
} from "../site/progress.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("Learning Pack state restores only for unchanged bytes", async () => {
  const storage = memoryStorage();
  const unchangedBytes = '{"package":{"id":"demo/interview-loop","version":"1.2.0"}}';
  const changedBytes = '{"package": {"id":"demo/interview-loop","version":"1.2.0"}}';
  const pack = JSON.parse(unchangedBytes);
  const unchangedDigest = await sha256Hex(unchangedBytes);
  const changedDigest = await sha256Hex(changedBytes);

  assert.notEqual(unchangedDigest, changedDigest);

  const firstLoad = createLearningPackStateStore(storage, pack, unchangedDigest);
  firstLoad.store.write("module-progress", {
    activeId: "coding-under-constraints",
    completedIds: ["behavioral-evidence"],
  });
  firstLoad.store.write("quiz-progress", {
    "story-evidence-check": { selected: "evidence", correct: true },
  });
  firstLoad.store.write("card-ratings", {
    "behavior-ownership": "good",
  });

  const unchangedReload = createLearningPackStateStore(storage, pack, unchangedDigest);
  assert.deepEqual(unchangedReload.store.read("module-progress", null), {
    activeId: "coding-under-constraints",
    completedIds: ["behavioral-evidence"],
  });
  assert.deepEqual(unchangedReload.store.read("quiz-progress", null), {
    "story-evidence-check": { selected: "evidence", correct: true },
  });
  assert.deepEqual(unchangedReload.store.read("card-ratings", null), {
    "behavior-ownership": "good",
  });

  const changedReload = createLearningPackStateStore(storage, pack, changedDigest);
  assert.equal(changedReload.store.read("module-progress", null), null);
  assert.equal(changedReload.store.read("quiz-progress", null), null);
  assert.equal(changedReload.store.read("card-ratings", null), null);
  assert.match(unchangedReload.identity.namespace, new RegExp(`sha256:${unchangedDigest}$`));
  assert.match(changedReload.identity.namespace, new RegExp(`sha256:${changedDigest}$`));
});
