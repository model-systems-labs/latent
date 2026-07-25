import assert from "node:assert/strict";
import test from "node:test";

import {
  parseArguments,
  sha256,
} from "../scripts/verify-public-release.mjs";

test("the public release verifier requires explicit version identity", () => {
  assert.deepEqual(parseArguments(["--version", "0.2.0"]), {
    version: "0.2.0",
    repository: "model-systems-labs/latent",
    pagesUrl: "https://model-systems-labs.github.io/latent",
    siteUrl: "https://latent-llm-learning.cswansondeveloper.chatgpt.site",
    exampleUrl: undefined,
  });
  assert.throws(
    () => parseArguments(["--site-url"]),
    /--site-url requires a value/,
  );
  assert.throws(() => parseArguments(["0.2.0"]), /Unexpected argument/);
});

test("the public release verifier computes standard SHA-256 evidence", () => {
  assert.equal(
    sha256(new TextEncoder().encode("latent\n")),
    "6417aed8ced7ff061c447e09d0814e00ac0b1b65f270c8d6744da20c0f91acc0",
  );
});
