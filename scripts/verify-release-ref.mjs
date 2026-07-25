#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout.trim();
}

function verifyReleaseRef({
  cwd = process.cwd(),
  tag,
  mainRef = "refs/remotes/origin/main",
  remote = "origin",
} = {}) {
  if (!tag || !/^course-kit-v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(
      `release tag must match course-kit-vX.Y.Z, received ${JSON.stringify(tag ?? "")}`,
    );
  }

  const tagRef = `refs/tags/${tag}`;
  const remoteTags = new Map(
    git(cwd, ["ls-remote", "--tags", remote, tagRef, `${tagRef}^{}`])
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [object, ref] = line.split(/\s+/);
        return [ref, object];
      }),
  );
  const tagObject = remoteTags.get(tagRef);
  const tagCommit = remoteTags.get(`${tagRef}^{}`);
  if (!tagObject || !tagCommit) {
    throw new Error(
      `${tag} must be an annotated tag on remote ${remote}`,
    );
  }

  const mainCommit = git(cwd, ["rev-parse", `${mainRef}^{commit}`]);
  const checkoutCommit = git(cwd, ["rev-parse", "HEAD^{commit}"]);

  if (tagCommit !== mainCommit || tagCommit !== checkoutCommit) {
    throw new Error(
      [
        "tag, checkout, and current main must identify the same commit",
        `tag=${tagCommit}`,
        `main=${mainCommit}`,
        `checkout=${checkoutCommit}`,
      ].join("; "),
    );
  }

  return { tag, tagObject, tagCommit, mainCommit, checkoutCommit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = verifyReleaseRef({ tag: process.argv[2] });
    process.stdout.write(
      `${report.tag} is an annotated tag on current main at ${report.tagCommit}.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Release ref verification failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = 1;
  }
}

export { verifyReleaseRef };
