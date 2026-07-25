#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REPOSITORY = "model-systems-labs/latent";
const DEFAULT_PAGES_URL = "https://model-systems-labs.github.io/latent";
const DEFAULT_SITE_URL =
  "https://latent-llm-learning.cswansondeveloper.chatgpt.site";

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values.set(argument.slice(2), value);
    index += 1;
  }
  return {
    version: values.get("version"),
    repository: values.get("repository") ?? DEFAULT_REPOSITORY,
    pagesUrl: values.get("pages-url") ?? DEFAULT_PAGES_URL,
    siteUrl: values.get("site-url") ?? DEFAULT_SITE_URL,
    exampleUrl: values.get("example-url"),
  };
}

function normalizedBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "latent-release-verifier" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "",
    finalUrl: response.url,
  };
}

async function fetchText(url) {
  const response = await fetchBytes(url);
  return {
    ...response,
    text: new TextDecoder("utf-8", { fatal: true }).decode(response.bytes),
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} did not contain ${JSON.stringify(expected)}`);
  }
}

async function verifySchema({ remoteUrl, localPath }) {
  const [remote, local] = await Promise.all([
    fetchBytes(remoteUrl),
    readFile(resolve(localPath)),
  ]);
  if (!Buffer.from(remote.bytes).equals(local)) {
    throw new Error(`${remoteUrl} does not match ${localPath}`);
  }
  return {
    url: remoteUrl,
    sha256: sha256(remote.bytes),
    bytes: remote.bytes.byteLength,
  };
}

async function verifyRelease(options) {
  if (!options.version || !/^\d+\.\d+\.\d+$/.test(options.version)) {
    throw new Error("--version must be a semantic version such as 0.2.0");
  }

  const tag = `course-kit-v${options.version}`;
  const releaseBase =
    `https://github.com/${options.repository}/releases/download/${tag}`;
  const tarballName = `latent-course-kit-${options.version}.tgz`;
  const [tarball, checksums] = await Promise.all([
    fetchBytes(`${releaseBase}/${tarballName}`),
    fetchText(`${releaseBase}/SHA256SUMS`),
  ]);
  const checksumLine = checksums.text
    .split(/\r?\n/)
    .find((line) => line.trim().endsWith(`  ${tarballName}`));
  if (!checksumLine) {
    throw new Error(`SHA256SUMS did not name ${tarballName}`);
  }
  const expectedChecksum = checksumLine.trim().split(/\s+/)[0];
  const actualChecksum = sha256(tarball.bytes);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(
      `${tarballName} checksum mismatch: expected ${expectedChecksum}, received ${actualChecksum}`,
    );
  }

  const pagesBase = normalizedBaseUrl(options.pagesUrl);
  const schemas = await Promise.all([
    verifySchema({
      remoteUrl: `${pagesBase}/open-learning/v1/learning-pack.schema.json`,
      localPath: "public/open-learning/v1/learning-pack.schema.json",
    }),
    verifySchema({
      remoteUrl: `${pagesBase}/open-learning/v1/learning-feed.schema.json`,
      localPath: "public/open-learning/v1/learning-feed.schema.json",
    }),
    verifySchema({
      remoteUrl:
        `${pagesBase}/question-groups/v1/question-group-library.schema.json`,
      localPath:
        "public/question-groups/v1/question-group-library.schema.json",
    }),
  ]);

  const siteBase = normalizedBaseUrl(options.siteUrl);
  const routeResults = [];
  for (const path of [
    "/",
    "/course",
    "/flashcards",
    "/practice",
    "/project",
    "/open-learning",
  ]) {
    const result = await fetchText(`${siteBase}${path}`);
    routeResults.push({
      path,
      finalUrl: result.finalUrl,
      bytes: result.bytes.byteLength,
    });
  }
  const homepage = await fetchText(`${siteBase}/`);
  requireText(
    homepage.text,
    "Build your own learning platform with agents",
    "homepage",
  );
  const llms = await fetchText(`${siteBase}/llms.txt`);
  requireText(llms.text, tag, "llms.txt");

  let example;
  if (options.exampleUrl) {
    const result = await fetchText(options.exampleUrl);
    example = {
      url: options.exampleUrl,
      finalUrl: result.finalUrl,
      bytes: result.bytes.byteLength,
    };
  }

  return {
    version: options.version,
    tag,
    tarball: {
      url: `${releaseBase}/${tarballName}`,
      bytes: tarball.bytes.byteLength,
      sha256: actualChecksum,
    },
    schemas,
    routes: routeResults,
    llms: `${siteBase}/llms.txt`,
    example,
    verifiedAt: new Date().toISOString(),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await verifyRelease(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `Release verification failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = 1;
  }
}

export { parseArguments, sha256, verifyRelease };
