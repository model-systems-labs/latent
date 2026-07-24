#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import {
  basename,
  dirname,
  extname,
  join,
  parse,
  resolve,
  sep,
} from "node:path";
import {
  LEARNING_BUILD_MARKER,
  buildStandaloneLearningSite,
  canonicalLearningPackJson,
  createStarterLearningPack,
  learningFeedJsonSchema,
  learningFeedSchema,
  learningPackJsonSchema,
  parseLearningPackJson,
} from "../dist/index.js";

const MAX_REMOTE_BYTES = 2_000_000;
const MAX_VERIFY_PACKAGES = 100;
const MAX_VERIFY_TOTAL_BYTES = 20_000_000;
const VERIFY_DEADLINE_MS = 30_000;
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);
const COMMAND_OPTIONS = new Map([
  ["init", new Set(["--json"])],
  ["inspect", new Set(["--json"])],
  ["validate", new Set(["--json", "--strict"])],
  ["schema", new Set(["--feed", "--json"])],
  ["build", new Set(["--json", "--out-dir"])],
  ["serve", new Set(["--host", "--port"])],
  ["verify-url", new Set(["--json"])],
]);
const OPTION_VALUE_NAMES = new Set(["--host", "--out-dir", "--port"]);
const POSITIONAL_LIMITS = new Map([
  ["init", [1, 1]],
  ["inspect", [1, 1]],
  ["validate", [1, 1]],
  ["schema", [0, 1]],
  ["build", [1, 1]],
  ["serve", [1, 1]],
  ["verify-url", [1, 1]],
]);

function usage() {
  return `Latent Open Learning

Usage:
  latent-learning init <directory> [--json]
  latent-learning inspect <learning-pack.json> [--json]
  latent-learning validate <learning-pack.json> [--strict] [--json]
  latent-learning schema [output.json] [--feed] [--json]
  latent-learning build <learning-pack.json> --out-dir <directory> [--json]
  latent-learning serve <directory> [--host 127.0.0.1] [--port 4173]
  latent-learning verify-url <learning-feed.json URL> [--json]

Exit codes: 0 success, 1 invalid content, 2 invalid invocation, 3 hosting or network failure.
`;
}

function argumentValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new InvocationError(`${name} requires a value.`);
  return value;
}

function positionalArgs(args) {
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    const entry = args[index];
    if (entry.startsWith("--")) {
      if (OPTION_VALUE_NAMES.has(entry)) index += 1;
      continue;
    }
    output.push(entry);
  }
  return output;
}

function validateCommandArguments(command, args) {
  const allowed = COMMAND_OPTIONS.get(command);
  if (!allowed) return;
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const entry = args[index];
    if (!entry.startsWith("--")) continue;
    if (!allowed.has(entry)) throw new InvocationError(`Unknown option "${entry}" for ${command}.`);
    if (seen.has(entry)) throw new InvocationError(`Option "${entry}" may be provided only once.`);
    seen.add(entry);
    if (OPTION_VALUE_NAMES.has(entry)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new InvocationError(`${entry} requires a value.`);
      index += 1;
    }
  }
  const positional = positionalArgs(args);
  const [minimum, maximum] = POSITIONAL_LIMITS.get(command);
  if (positional.length < minimum || positional.length > maximum) {
    throw new InvocationError(
      `${command} expects ${minimum === maximum ? minimum : `${minimum}-${maximum}`} positional argument${maximum === 1 ? "" : "s"}.`,
    );
  }
}

class InvocationError extends Error {}
class NetworkError extends Error {}

function report(command, payload, asJson) {
  const normalized = { command, ...payload };
  if (asJson) {
    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${payload.ok ? "✓" : "✗"} ${command}\n`);
  if (payload.summary) {
    process.stdout.write(
      `  ${payload.summary.lessons} lessons · ${payload.summary.quizzes} quizzes · ${payload.summary.flashcards} flash cards · ${payload.summary.sources} sources\n`,
    );
  }
  for (const warning of payload.warnings ?? []) {
    process.stdout.write(`  warning ${warning.path}: ${warning.message}\n`);
  }
  for (const error of payload.errors ?? []) {
    process.stdout.write(`  error ${error.path}: ${error.message}\n`);
  }
  for (const artifact of payload.artifacts ?? []) process.stdout.write(`  wrote ${artifact}\n`);
}

async function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

async function readPack(path) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const file = await handle.stat();
    if (!file.isFile()) throw new InvocationError(`Learning pack input must be a regular file: ${path}`);
    if (file.size > MAX_REMOTE_BYTES) {
      throw new InvocationError(`Learning pack input exceeds the 2 MB limit: ${path}`);
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > MAX_REMOTE_BYTES) {
      throw new InvocationError(`Learning pack input exceeds the 2 MB limit: ${path}`);
    }
    let source;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new InvocationError(`Learning pack input is not valid UTF-8: ${path}`);
    }
    return { source, validation: parseLearningPackJson(source) };
  } catch (error) {
    if (error instanceof InvocationError) throw error;
    throw new InvocationError(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await handle?.close();
  }
}

async function initCommand(args, asJson) {
  const directory = positionalArgs(args)[0];
  if (!directory) throw new InvocationError("init requires a directory.");
  const target = resolve(directory, "learning-pack.json");
  await mkdir(resolve(directory), { recursive: true });
  try {
    await access(target);
    throw new InvocationError(`Refusing to overwrite ${target}.`);
  } catch (error) {
    if (error instanceof InvocationError) throw error;
  }
  const pack = createStarterLearningPack();
  await writeFile(target, canonicalLearningPackJson(pack), "utf8");
  report("init", { ok: true, errors: [], warnings: [], summary: null, artifacts: [target] }, asJson);
}

async function inspectOrValidateCommand(command, args, asJson) {
  const path = positionalArgs(args)[0];
  if (!path) throw new InvocationError(`${command} requires a learning-pack.json path.`);
  const { validation } = await readPack(resolve(path));
  const strictFailure = args.includes("--strict") && validation.warnings.length > 0;
  const ok = validation.valid && !strictFailure;
  report(command, {
    ok,
    errors: validation.errors,
    warnings: validation.warnings,
    summary: validation.summary,
    artifacts: [],
  }, asJson);
  if (!ok) process.exitCode = 1;
}

async function schemaCommand(args, asJson) {
  const output = positionalArgs(args)[0];
  const schema = args.includes("--feed") ? learningFeedJsonSchema : learningPackJsonSchema;
  const source = `${JSON.stringify(schema, null, 2)}\n`;
  if (!output) {
    if (asJson) report("schema", { ok: true, errors: [], warnings: [], summary: null, schema, artifacts: [] }, true);
    else process.stdout.write(source);
    return;
  }
  const target = resolve(output);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, source, "utf8");
  report("schema", { ok: true, errors: [], warnings: [], summary: null, artifacts: [target] }, asJson);
}

async function inspectBuildTarget(target) {
  if (target === parse(target).root) {
    throw new InvocationError("Refusing to use a filesystem root as a build output.");
  }
  let targetStat;
  try {
    targetStat = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (targetStat.isSymbolicLink() || !targetStat.isDirectory()) {
    throw new InvocationError(`Build output must be a real directory, not a file or symlink: ${target}`);
  }
  const existing = await readdir(target);
  if (!existing.length) return true;
  const markerPath = join(target, ".latent-build");
  let markerStat;
  try {
    markerStat = await lstat(markerPath);
  } catch {
    throw new InvocationError(`Refusing to replace a nonempty directory without a Latent build marker: ${target}`);
  }
  if (markerStat.isSymbolicLink() || !markerStat.isFile()) {
    throw new InvocationError(`The Latent build marker must be a regular file: ${markerPath}`);
  }
  const marker = (await readFile(markerPath, "utf8")).trim();
  if (marker !== LEARNING_BUILD_MARKER) {
    throw new InvocationError(`Refusing to replace a nonempty directory without a Latent build marker: ${target}`);
  }
  return true;
}

async function buildCommand(args, asJson) {
  const input = positionalArgs(args)[0];
  const outDir = argumentValue(args, "--out-dir");
  if (!input || !outDir) throw new InvocationError("build requires a learning-pack.json path and --out-dir.");
  const { validation } = await readPack(resolve(input));
  if (!validation.valid) {
    report("build", {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
      summary: null,
      artifacts: [],
    }, asJson);
    process.exitCode = 1;
    return;
  }
  const target = resolve(outDir);
  const targetExists = await inspectBuildTarget(target);
  const files = await buildStandaloneLearningSite(validation.pack);
  const artifacts = [];
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, `.${basename(target)}.latent-build-`));
  try {
    for (const [relativePath, source] of Object.entries(files).sort(([left], [right]) => (
      left < right ? -1 : left > right ? 1 : 0
    ))) {
      const output = resolve(temporary, relativePath);
      if (!output.startsWith(`${temporary}${sep}`)) {
        throw new InvocationError(`Generated path escaped the build directory: ${relativePath}`);
      }
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, source, "utf8");
      artifacts.push(resolve(target, relativePath));
    }
    if (targetExists) await rm(target, { recursive: true });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true, recursive: true });
    throw error;
  }
  report("build", {
    ok: true,
    errors: [],
    warnings: validation.warnings,
    summary: validation.summary,
    sha256: JSON.parse(files["build-report.json"]).sha256,
    artifacts,
  }, asJson);
}

function safeServePath(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }
  const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const output = resolve(root, `.${requested}`);
  return output === root || output.startsWith(`${root}${sep}`) ? output : null;
}

async function resolveBuiltRoot(directory) {
  const root = resolve(directory);
  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch {
    throw new InvocationError(`Could not read built directory: ${root}`);
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new InvocationError(`serve requires a real built directory, not a file or symlink: ${root}`);
  }
  const markerPath = join(root, ".latent-build");
  let markerStat;
  try {
    markerStat = await lstat(markerPath);
  } catch {
    throw new InvocationError(`serve requires a Latent build marker: ${markerPath}`);
  }
  if (markerStat.isSymbolicLink() || !markerStat.isFile()) {
    throw new InvocationError(`The Latent build marker must be a regular file: ${markerPath}`);
  }
  if ((await readFile(markerPath, "utf8")).trim() !== LEARNING_BUILD_MARKER) {
    throw new InvocationError(`The built directory has an invalid Latent marker: ${root}`);
  }
  return realpath(root);
}

async function serveCommand(args) {
  const directory = positionalArgs(args)[0];
  if (!directory) throw new InvocationError("serve requires a built directory.");
  const root = await resolveBuiltRoot(directory);
  const host = argumentValue(args, "--host", "127.0.0.1");
  const port = Number(argumentValue(args, "--port", "4173"));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new InvocationError("--port must be between 1 and 65535.");
  const server = createServer(async (request, response) => {
    const path = safeServePath(root, request.url ?? "/");
    if (!path) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }
    let handle;
    try {
      const pathStat = await lstat(path);
      if (pathStat.isSymbolicLink()) throw new Error("Symlinks are not served");
      const resolvedPath = await realpath(path);
      if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${sep}`)) {
        throw new Error("Path escaped the built directory");
      }
      handle = await open(resolvedPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
      const file = await handle.stat();
      if (!file.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "content-type": MIME_TYPES.get(extname(resolvedPath)) ?? "application/octet-stream",
        "content-length": file.size,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...(extname(resolvedPath) === ".json" ? { "access-control-allow-origin": "*" } : {}),
      });
      handle.createReadStream().pipe(response);
      handle = undefined;
    } catch {
      await handle?.close();
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolveListen);
  });
  process.stdout.write(`Serving ${root} at http://${host}:${port}\n`);
}

function allowedFeedUrl(value) {
  const url = new URL(value);
  if (url.username || url.password) {
    throw new NetworkError("Feed URLs must not contain credentials.");
  }
  if (url.protocol === "https:") return url;
  if (url.protocol !== "http:") throw new NetworkError("Feed URLs must use HTTPS.");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new NetworkError("Plain HTTP is allowed only for loopback local preview.");
  }
  return url;
}

async function fetchBounded(url, expectedOrigin, deadline = Date.now() + 10_000) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new NetworkError("Remote verification exceeded its 30 second deadline.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(10_000, remaining));
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new NetworkError(`${url.host} returned HTTP ${response.status}.`);
    if (new URL(response.url).origin !== expectedOrigin) {
      throw new NetworkError("Cross-origin redirects are not allowed.");
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      if (!/^\d+$/.test(contentLength)) throw new NetworkError("Remote Content-Length is invalid.");
      if (Number(contentLength) > MAX_REMOTE_BYTES) throw new NetworkError("Remote file exceeds the 2 MB limit.");
    }
    if (!response.body) throw new NetworkError("Remote response has no readable body.");
    const chunks = [];
    let total = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REMOTE_BYTES) {
        controller.abort();
        await reader.cancel().catch(() => {});
        throw new NetworkError("Remote file exceeds the 2 MB limit.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new NetworkError("Remote file is not valid UTF-8.");
    }
    return { bytes, text };
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    if (Date.now() >= deadline) {
      throw new NetworkError("Remote verification exceeded its 30 second deadline.");
    }
    throw new NetworkError(`Could not fetch remote JSON from ${url.host}.`);
  } finally {
    clearTimeout(timer);
  }
}

async function verifyUrlCommand(args, asJson) {
  const rawUrl = positionalArgs(args)[0];
  if (!rawUrl) throw new InvocationError("verify-url requires a learning-feed.json URL.");
  let feedUrl;
  try {
    feedUrl = allowedFeedUrl(rawUrl);
  } catch (error) {
    throw error instanceof NetworkError ? error : new NetworkError("The feed URL is invalid.");
  }
  const verificationDeadline = Date.now() + VERIFY_DEADLINE_MS;
  const feedResponse = await fetchBounded(feedUrl, feedUrl.origin, verificationDeadline);
  let parsedFeed;
  try {
    parsedFeed = learningFeedSchema.safeParse(JSON.parse(feedResponse.text));
  } catch {
    parsedFeed = { success: false, error: { issues: [{ path: [], code: "invalid-json", message: "Feed is not valid JSON." }] } };
  }
  if (!parsedFeed.success) {
    report("verify-url", {
      ok: false,
      errors: parsedFeed.error.issues.map((entry) => ({
        path: entry.path.length ? entry.path.map(String).join(".") : "$",
        code: entry.code,
        message: entry.message,
      })),
      warnings: [],
      summary: null,
      artifacts: [],
    }, asJson);
    process.exitCode = 1;
    return;
  }
  if (parsedFeed.data.packages.length > MAX_VERIFY_PACKAGES) {
    throw new NetworkError(`Feed verification is limited to ${MAX_VERIFY_PACKAGES} packages per run.`);
  }
  const declaredPackageBytes = parsedFeed.data.packages.reduce((total, entry) => total + entry.bytes, 0);
  if (declaredPackageBytes > MAX_VERIFY_TOTAL_BYTES) {
    throw new NetworkError("Feed verification is limited to 20 MB of declared package data per run.");
  }
  const packages = [];
  const warnings = [];
  const summary = {
    lessons: 0,
    quizzes: 0,
    flashcardDecks: 0,
    flashcards: 0,
    objectives: 0,
    sources: 0,
  };
  for (const [entryIndex, entry] of parsedFeed.data.packages.entries()) {
    const packageUrl = new URL(entry.packageUrl, feedUrl);
    if (packageUrl.origin !== feedUrl.origin) throw new NetworkError("Package URLs must stay on the feed origin.");
    const packageResponse = await fetchBounded(packageUrl, feedUrl.origin, verificationDeadline);
    if (packageResponse.bytes.byteLength !== entry.bytes) {
      throw new NetworkError(`Package byte count mismatch for ${entry.packageId}@${entry.version}: expected ${entry.bytes}, received ${packageResponse.bytes.byteLength}.`);
    }
    const digest = await sha256(packageResponse.bytes);
    if (digest !== entry.sha256) {
      throw new NetworkError(`Package SHA-256 does not match the feed for ${entry.packageId}@${entry.version}.`);
    }
    const packageValidation = parseLearningPackJson(packageResponse.text);
    if (!packageValidation.valid) {
      report("verify-url", {
        ok: false,
        errors: packageValidation.errors.map((error) => ({
          ...error,
          path: `packages.${entryIndex}.${error.path}`,
        })),
        warnings: packageValidation.warnings,
        summary: null,
        artifacts: [],
      }, asJson);
      process.exitCode = 1;
      return;
    }
    const canonical = canonicalLearningPackJson(packageValidation.pack);
    const canonicalBytes = new TextEncoder().encode(canonical);
    const bytesMatch = canonicalBytes.byteLength === packageResponse.bytes.byteLength
      && canonicalBytes.every((value, index) => value === packageResponse.bytes[index]);
    if (!bytesMatch) {
      throw new NetworkError(`Package JSON is not canonical for ${entry.packageId}@${entry.version}.`);
    }
    if (
      packageValidation.pack.package.id !== entry.packageId
      || packageValidation.pack.package.version !== entry.version
      || packageValidation.pack.package.title !== entry.title
      || packageValidation.pack.package.description !== entry.description
      || packageValidation.pack.package.publishedAt !== entry.publishedAt
    ) {
      throw new NetworkError(`Package metadata does not match the feed entry for ${entry.packageId}@${entry.version}.`);
    }
    for (const key of Object.keys(summary)) summary[key] += packageValidation.summary[key];
    warnings.push(...packageValidation.warnings.map((warning) => ({
      ...warning,
      path: `packages.${entryIndex}.${warning.path}`,
    })));
    packages.push({
      id: entry.packageId,
      version: entry.version,
      sha256: digest,
      url: packageUrl.toString(),
    });
  }
  report("verify-url", {
    ok: true,
    errors: [],
    warnings,
    summary,
    package: packages[0],
    packages,
    artifacts: [],
  }, asJson);
}

async function main() {
  const [, , command, ...args] = process.argv;
  const asJson = args.includes("--json");
  if (!command || ["help", "--help", "-h"].includes(command)) {
    process.stdout.write(usage());
    return;
  }
  validateCommandArguments(command, args);
  if (command === "init") await initCommand(args, asJson);
  else if (command === "inspect" || command === "validate") await inspectOrValidateCommand(command, args, asJson);
  else if (command === "schema") await schemaCommand(args, asJson);
  else if (command === "build") await buildCommand(args, asJson);
  else if (command === "serve") await serveCommand(args);
  else if (command === "verify-url") await verifyUrlCommand(args, asJson);
  else throw new InvocationError(`Unknown command "${command}".\n\n${usage()}`);
}

try {
  await main();
} catch (error) {
  const exitCode = error instanceof NetworkError ? 3 : 2;
  const message = error instanceof Error ? error.message : String(error);
  const asJson = process.argv.includes("--json");
  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      command: process.argv[2] ?? "unknown",
      ok: false,
      errors: [{ path: "$", code: exitCode === 3 ? "network-error" : "invocation-error", message }],
      warnings: [],
      summary: null,
      artifacts: [],
    }, null, 2)}\n`);
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  process.exitCode = exitCode;
}
