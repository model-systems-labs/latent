import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LEARNING_BUILD_MARKER,
  canonicalLearningPackJson,
  createLearningFeed,
} from "../dist/index.js";

const cliPath = fileURLToPath(new URL("../bin/latent-learning.mjs", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const examplePath = fileURLToPath(
  new URL("../../../examples/open-learning/reliable-llm-changes/learning-pack.json", import.meta.url),
);
const example = JSON.parse(await readFile(examplePath, "utf8"));
const questionGuidePath = fileURLToPath(
  new URL("../../../docs/question-groups.md", import.meta.url),
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function runCli(args) {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", resolveExit);
  });
  return { exitCode, stdout, stderr };
}

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

test("build replaces its marked directory without following output symlinks or retaining stale files", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "latent-cli-build-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const output = join(root, "site");
  const victim = join(root, "victim.txt");
  await mkdir(output);
  await writeFile(join(output, ".latent-build"), `${LEARNING_BUILD_MARKER}\n`);
  await writeFile(join(output, "stale-secret.txt"), "stale");
  await writeFile(victim, "outside");
  await symlink(victim, join(output, "index.html"));

  const result = await runCli(["build", examplePath, "--out-dir", output, "--json"]);
  assert.equal(result.exitCode, 0, result.stderr || result.stdout);
  assert.equal(await readFile(victim, "utf8"), "outside");
  assert.equal((await lstat(join(output, "index.html"))).isSymbolicLink(), false);
  await assert.rejects(access(join(output, "stale-secret.txt")));
});

test("Question Group CLI validates, builds, and serves the self-hosted player", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "latent-question-cli-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const sourcePath = join(root, "question-group-library.json");
  const output = join(root, "site");
  const guide = await readFile(questionGuidePath, "utf8");
  const source = guide.match(/```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(source);
  await writeFile(sourcePath, `${source}\n`);

  const validation = await runCli(["questions", "validate", sourcePath, "--strict", "--json"]);
  assert.equal(validation.exitCode, 0, validation.stderr || validation.stdout);
  assert.equal(JSON.parse(validation.stdout).summary.questions, 1);

  const progressSchemaPath = join(root, "question-group-progress.schema.json");
  const progressSchema = await runCli([
    "questions",
    "schema",
    progressSchemaPath,
    "--progress",
    "--json",
  ]);
  assert.equal(progressSchema.exitCode, 0, progressSchema.stderr || progressSchema.stdout);
  assert.match(
    JSON.parse(await readFile(progressSchemaPath, "utf8")).$id,
    /question-group-progress\.schema\.json$/,
  );

  const build = await runCli([
    "questions",
    "build",
    sourcePath,
    "--out-dir",
    output,
    "--json",
  ]);
  assert.equal(build.exitCode, 0, build.stderr || build.stdout);
  assert.equal((await lstat(join(output, "assets", "esbuild.wasm"))).isFile(), true);
  assert.match(await readFile(join(output, "leeches", "index.html"), "utf8"), /leeches/);

  const probe = await listen((_request, response) => response.end());
  const port = Number(new URL(probe.origin).port);
  await probe.close();
  const child = spawn(process.execPath, [
    cliPath,
    "questions",
    "serve",
    output,
    "--port",
    String(port),
  ], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => child.kill("SIGTERM"));
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error("Question Group serve did not start")), 5_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Serving ")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
  });
  const worker = await fetch(`http://127.0.0.1:${port}/assets/sandbox.worker.js`);
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("close", resolveExit));
});

test("Question Group schema output refuses overwrites and never follows symlinks", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "latent-question-schema-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const output = join(root, "question-group-progress.schema.json");
  const victim = join(root, "victim.txt");
  await writeFile(output, "owned");
  await writeFile(victim, "outside");

  const refused = await runCli([
    "questions",
    "schema",
    output,
    "--progress",
    "--json",
  ]);
  assert.equal(refused.exitCode, 2);
  assert.match(refused.stdout, /Refusing to overwrite/);
  assert.equal(await readFile(output, "utf8"), "owned");

  const forced = await runCli([
    "questions",
    "schema",
    output,
    "--progress",
    "--force",
    "--json",
  ]);
  assert.equal(forced.exitCode, 0, forced.stderr || forced.stdout);
  assert.match(JSON.parse(await readFile(output, "utf8")).$id, /question-group-progress/);

  await rm(output);
  await symlink(victim, output);
  const symlinked = await runCli([
    "questions",
    "schema",
    output,
    "--progress",
    "--force",
    "--json",
  ]);
  assert.equal(symlinked.exitCode, 2);
  assert.match(symlinked.stdout, /not a directory or symlink/);
  assert.equal(await readFile(victim, "utf8"), "outside");
  assert.equal((await lstat(output)).isSymbolicLink(), true);
});

test("serve requires a build marker and refuses symlinked files", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "latent-cli-serve-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const unmarked = join(root, "unmarked");
  await mkdir(unmarked);
  const unmarkedResult = await runCli(["serve", unmarked, "--port", "4191"]);
  assert.equal(unmarkedResult.exitCode, 2);
  assert.match(unmarkedResult.stderr, /build marker/i);

  const output = join(root, "site");
  const buildResult = await runCli(["build", examplePath, "--out-dir", output, "--json"]);
  assert.equal(buildResult.exitCode, 0);
  await symlink("/etc/hosts", join(output, "leak.txt"));

  const probe = await listen((_request, response) => response.end());
  const port = Number(new URL(probe.origin).port);
  await probe.close();
  const child = spawn(process.execPath, [cliPath, "serve", output, "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => child.kill("SIGTERM"));
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error("serve did not start")), 5_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Serving ")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
  });
  const response = await fetch(`http://127.0.0.1:${port}/leak.txt`);
  assert.equal(response.status, 404);
  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("close", resolveExit));
});

test("CLI option parsing fails closed on misspelled strict mode", async () => {
  const result = await runCli(["validate", examplePath, "--strcit", "--json"]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /Unknown option/);
});

test("local validation preflights size and rejects invalid UTF-8", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "latent-cli-input-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const oversized = join(root, "oversized.json");
  const invalidUtf8 = join(root, "invalid-utf8.json");
  await writeFile(oversized, Buffer.alloc(2_000_001));
  await writeFile(invalidUtf8, Buffer.from([0xff]));

  const oversizedResult = await runCli(["validate", oversized, "--json"]);
  assert.equal(oversizedResult.exitCode, 2);
  assert.match(oversizedResult.stdout, /exceeds the 2 MB limit/i);

  const utf8Result = await runCli(["validate", invalidUtf8, "--json"]);
  assert.equal(utf8Result.exitCode, 2);
  assert.match(utf8Result.stdout, /not valid UTF-8/i);
});

test("verify-url rejects credential-bearing URLs without echoing secrets", async () => {
  const secret = "audit-secret";
  const result = await runCli([
    "verify-url",
    `http://audit-user:${secret}@127.0.0.1:9/feed.json`,
    "--json",
  ]);
  assert.equal(result.exitCode, 3);
  assert.match(result.stdout, /must not contain credentials/i);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
  assert.doesNotMatch(result.stderr, new RegExp(secret));
});

test("verify-url checks every package, canonical UTF-8 bytes, redirects, and streamed limits", async (context) => {
  const canonical = canonicalLearningPackJson(example);
  const canonicalBytes = Buffer.from(canonical);
  const firstFeed = createLearningFeed(example, sha256(canonicalBytes), {
    bytes: canonicalBytes.byteLength,
    packageUrl: "./pack-one.json",
  });
  const secondPack = structuredClone(example);
  secondPack.package.version = "1.0.1";
  secondPack.package.publishedAt = "2026-07-23T12:00:00Z";
  const secondCanonical = canonicalLearningPackJson(secondPack);
  const secondFeed = createLearningFeed(secondPack, sha256(secondCanonical), {
    bytes: Buffer.byteLength(secondCanonical),
    packageUrl: "./missing.json",
  });
  const multiFeed = { ...firstFeed, packages: [...firstFeed.packages, ...secondFeed.packages] };

  const noncanonical = JSON.stringify(example);
  const noncanonicalFeed = createLearningFeed(example, sha256(noncanonical), {
    bytes: Buffer.byteLength(noncanonical),
    packageUrl: "./noncanonical.json",
  });
  const invalidUtf8 = Buffer.from([0xff]);
  const invalidUtf8Feed = createLearningFeed(example, sha256(invalidUtf8), {
    bytes: invalidUtf8.byteLength,
    packageUrl: "./invalid-utf8.json",
  });
  const overPackageLimitFeed = {
    ...firstFeed,
    packages: Array.from({ length: 101 }, (_, index) => ({
      ...firstFeed.packages[0],
      version: `1.0.${index}`,
      packageUrl: `./capped-${index}.json`,
    })),
  };
  const overByteLimitFeed = {
    ...firstFeed,
    packages: Array.from({ length: 11 }, (_, index) => ({
      ...firstFeed.packages[0],
      version: `2.0.${index}`,
      packageUrl: `./large-${index}.json`,
      bytes: 2_000_000,
    })),
  };
  let missingRequested = false;
  let redirectDestinationRequested = false;
  let cappedPackageRequested = false;
  const fixture = await listen((request, response) => {
    if (request.url === "/multi-feed.json") {
      response.setHeader("content-type", "application/json");
      response.end(`${JSON.stringify(multiFeed, null, 2)}\n`);
      return;
    }
    if (request.url === "/pack-one.json") {
      response.setHeader("content-type", "application/json");
      response.end(canonicalBytes);
      return;
    }
    if (request.url === "/missing.json") {
      missingRequested = true;
      response.writeHead(404).end("missing");
      return;
    }
    if (request.url === "/noncanonical-feed.json") {
      response.end(`${JSON.stringify(noncanonicalFeed, null, 2)}\n`);
      return;
    }
    if (request.url === "/noncanonical.json") {
      response.end(noncanonical);
      return;
    }
    if (request.url === "/invalid-utf8-feed.json") {
      response.end(`${JSON.stringify(invalidUtf8Feed, null, 2)}\n`);
      return;
    }
    if (request.url === "/invalid-utf8.json") {
      response.end(invalidUtf8);
      return;
    }
    if (request.url === "/redirect-feed.json") {
      response.writeHead(302, { location: "/redirect-destination.json" }).end();
      return;
    }
    if (request.url === "/redirect-destination.json") {
      redirectDestinationRequested = true;
      response.end(`${JSON.stringify(firstFeed, null, 2)}\n`);
      return;
    }
    if (request.url === "/oversized-feed.json") {
      response.write("x".repeat(1_100_000));
      response.end("x".repeat(1_100_000));
      return;
    }
    if (request.url === "/too-many-packages.json") {
      response.end(`${JSON.stringify(overPackageLimitFeed, null, 2)}\n`);
      return;
    }
    if (request.url === "/too-many-bytes.json") {
      response.end(`${JSON.stringify(overByteLimitFeed, null, 2)}\n`);
      return;
    }
    if (request.url?.startsWith("/capped-") || request.url?.startsWith("/large-")) {
      cappedPackageRequested = true;
      response.end(canonicalBytes);
      return;
    }
    response.writeHead(404).end("missing");
  });
  context.after(fixture.close);

  const multiResult = await runCli(["verify-url", `${fixture.origin}/multi-feed.json`, "--json"]);
  assert.notEqual(multiResult.exitCode, 0);
  assert.equal(missingRequested, true);

  const canonicalResult = await runCli(["verify-url", `${fixture.origin}/noncanonical-feed.json`, "--json"]);
  assert.equal(canonicalResult.exitCode, 3);
  assert.match(canonicalResult.stdout, /not canonical/i);

  const utf8Result = await runCli(["verify-url", `${fixture.origin}/invalid-utf8-feed.json`, "--json"]);
  assert.equal(utf8Result.exitCode, 3);
  assert.match(utf8Result.stdout, /valid UTF-8/i);

  const redirectResult = await runCli(["verify-url", `${fixture.origin}/redirect-feed.json`, "--json"]);
  assert.equal(redirectResult.exitCode, 3);
  assert.equal(redirectDestinationRequested, false);

  const oversizedResult = await runCli(["verify-url", `${fixture.origin}/oversized-feed.json`, "--json"]);
  assert.equal(oversizedResult.exitCode, 3);
  assert.match(oversizedResult.stdout, /exceeds the 2 MB limit/i);

  const packageLimitResult = await runCli(["verify-url", `${fixture.origin}/too-many-packages.json`, "--json"]);
  assert.equal(packageLimitResult.exitCode, 3);
  assert.match(packageLimitResult.stdout, /limited to 100 packages/i);
  assert.equal(cappedPackageRequested, false);

  const byteLimitResult = await runCli(["verify-url", `${fixture.origin}/too-many-bytes.json`, "--json"]);
  assert.equal(byteLimitResult.exitCode, 3);
  assert.match(byteLimitResult.stdout, /limited to 20 MB/i);
  assert.equal(cappedPackageRequested, false);
});
