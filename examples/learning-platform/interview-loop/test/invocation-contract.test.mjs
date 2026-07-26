import assert from "node:assert/strict";
import { test } from "node:test";

import { assessCase } from "../site/checker.mjs";
import { createInvocationGuard } from "../site/invocation-contract.mjs";

const exerciseCase = {
  id: "dedupe",
  label: "keeps the first occurrence",
  assertions: [{
    id: "result",
    label: "returns the expected value",
    kind: "deep-equal",
    expected: [{ deliveryId: "evt-a", status: "accepted" }],
  }],
};

test("read-only guarded inputs reject a mutating implementation", () => {
  const guard = createInvocationGuard([[
    { deliveryId: "evt-a", status: "accepted" },
  ]]);
  const mutatingImplementation = (attempts) => {
    attempts[0].status = "changed";
    return attempts;
  };

  assert.throws(
    () => mutatingImplementation(...guard.args),
    TypeError,
  );
});

test("a value-correct implementation fails when its output aliases input", () => {
  const guard = createInvocationGuard([[
    { deliveryId: "evt-a", status: "accepted" },
  ]]);
  const aliasingImplementation = (attempts) => attempts;
  const value = aliasingImplementation(...guard.args);
  const result = assessCase(exerciseCase, value, guard.assess(value));

  assert.equal(result.assertions[0].passed, true);
  assert.equal(
    result.assertions.find((assertion) => assertion.id === "platform-output-fresh")?.passed,
    false,
  );
  assert.equal(result.passed, false);
});

test("an equivalent pure implementation passes value and ownership checks", () => {
  const guard = createInvocationGuard([[
    { deliveryId: "evt-a", status: "accepted" },
  ]]);
  const pureImplementation = (attempts) => attempts.map(({ deliveryId, status }) => ({
    deliveryId,
    status,
  }));
  const value = pureImplementation(...guard.args);
  const result = assessCase(exerciseCase, value, guard.assess(value));

  assert.equal(result.passed, true);
  assert.equal(result.assertions.length, 3);
  assert.equal(result.assertions.every((assertion) => assertion.passed), true);
});
