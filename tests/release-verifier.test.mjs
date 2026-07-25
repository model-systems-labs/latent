import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { resolve } from "node:path";
import test from "node:test";

import {
  parseArguments,
  sha256,
  verifyRelease,
} from "../scripts/verify-public-release.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

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

test("the public release verifier checks release bytes, schemas, routes, and identity", async () => {
  const version = "0.2.0";
  const tag = `course-kit-v${version}`;
  const tarballName = `latent-course-kit-${version}.tgz`;
  const tarball = Buffer.from("deterministic Course Kit tarball fixture\n");
  const schemaPaths = [
    "open-learning/v1/learning-pack.schema.json",
    "open-learning/v1/learning-feed.schema.json",
    "question-groups/v1/question-group-library.schema.json",
    "question-groups/v1/question-group-progress.schema.json",
  ];
  const schemas = new Map(
    await Promise.all(
      schemaPaths.map(async (path) => [
        `/pages/${path}`,
        await readFile(resolve(repositoryRoot, "public", path)),
      ]),
    ),
  );
  const state = {
    checksum: sha256(tarball),
    checksumName: tarballName,
    schemaOverride: null,
    llms: `Latent release ${tag}\n`,
    missingRoute: null,
  };
  const siteRoutes = new Set([
    "/site/",
    "/site/course",
    "/site/flashcards",
    "/site/practice",
    "/site/practice/leeches",
    "/site/practice/ide/unique-values",
    "/site/project",
    "/site/open-learning",
  ]);

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path === `/release/${tarballName}`) {
      response.end(tarball);
      return;
    }
    if (path === "/release/SHA256SUMS") {
      response.end(`${state.checksum}  ${state.checksumName}\n`);
      return;
    }
    if (schemas.has(path)) {
      response.setHeader("content-type", "application/schema+json");
      response.end(
        state.schemaOverride?.path === path
          ? state.schemaOverride.bytes
          : schemas.get(path),
      );
      return;
    }
    if (path === "/site/llms.txt") {
      response.end(state.llms);
      return;
    }
    if (siteRoutes.has(path) && path !== state.missingRoute) {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("<h1>Build your own learning platform with agents</h1>");
      return;
    }
    if (path === "/example") {
      response.end("<h1>Example platform</h1>");
      return;
    }
    response.statusCode = 404;
    response.end("not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const options = {
      version,
      repository: "example/latent",
      pagesUrl: `${base}/pages`,
      siteUrl: `${base}/site`,
      exampleUrl: `${base}/example`,
    };
    const overrides = { releaseBaseUrl: `${base}/release` };

    const report = await verifyRelease(options, overrides);
    assert.equal(report.tag, tag);
    assert.equal(report.tarball.sha256, state.checksum);
    assert.equal(report.schemas.length, 4);
    assert.equal(report.routes.length, 8);
    assert.equal(report.example.finalUrl, `${base}/example`);

    state.checksum = "0".repeat(64);
    await assert.rejects(
      verifyRelease(options, overrides),
      /checksum mismatch/,
    );
    state.checksum = sha256(tarball);

    state.checksumName = "wrong-package.tgz";
    await assert.rejects(
      verifyRelease(options, overrides),
      /SHA256SUMS did not name/,
    );
    state.checksumName = tarballName;

    state.schemaOverride = {
      path: "/pages/question-groups/v1/question-group-library.schema.json",
      bytes: Buffer.from("{}\n"),
    };
    await assert.rejects(
      verifyRelease(options, overrides),
      /does not match .*question-group-library\.schema\.json/,
    );
    state.schemaOverride = null;

    state.llms = "stale release identity\n";
    await assert.rejects(
      verifyRelease(options, overrides),
      /llms\.txt did not contain/,
    );
    state.llms = `Latent release ${tag}\n`;

    state.missingRoute = "/site/practice/leeches";
    await assert.rejects(
      verifyRelease(options, overrides),
      /practice\/leeches returned HTTP 404/,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});
