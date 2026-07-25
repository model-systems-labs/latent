import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const verifier = join(repositoryRoot, "scripts/verify-release-ref.mjs");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function verify(cwd, tag) {
  return spawnSync(process.execPath, [verifier, tag], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("the release ref gate accepts only an annotated tag at exact current main", async () => {
  const root = await mkdtemp(join(tmpdir(), "latent-release-ref-"));
  const remote = join(root, "origin.git");
  const checkout = join(root, "checkout");
  run("git", ["init", "--bare", remote], root);
  run("git", ["init", checkout], root);
  run("git", ["config", "user.name", "Latent Release Test"], checkout);
  run("git", ["config", "user.email", "release-test@example.invalid"], checkout);
  await writeFile(join(checkout, "release.txt"), "first\n", "utf8");
  run("git", ["add", "release.txt"], checkout);
  run("git", ["commit", "-m", "first"], checkout);
  run("git", ["branch", "-M", "main"], checkout);
  run("git", ["remote", "add", "origin", remote], checkout);
  run("git", ["push", "-u", "origin", "main"], checkout);

  run(
    "git",
    ["tag", "-a", "course-kit-v0.2.0", "-m", "Course Kit v0.2.0"],
    checkout,
  );
  run(
    "git",
    ["push", "origin", "refs/tags/course-kit-v0.2.0"],
    checkout,
  );
  // actions/checkout may materialize a tag-triggered checkout as a local
  // commit ref. Remote peeling remains the authoritative annotation proof.
  run("git", ["tag", "-f", "course-kit-v0.2.0"], checkout);
  const accepted = verify(checkout, "course-kit-v0.2.0");
  assert.equal(accepted.status, 0, `${accepted.stdout}\n${accepted.stderr}`);
  assert.match(accepted.stdout, /annotated tag on current main/);

  run("git", ["tag", "course-kit-v0.2.1"], checkout);
  run(
    "git",
    ["push", "origin", "refs/tags/course-kit-v0.2.1"],
    checkout,
  );
  const lightweight = verify(checkout, "course-kit-v0.2.1");
  assert.notEqual(lightweight.status, 0);
  assert.match(lightweight.stderr, /must be an annotated tag/);

  await writeFile(join(checkout, "release.txt"), "second\n", "utf8");
  run("git", ["add", "release.txt"], checkout);
  run("git", ["commit", "-m", "second"], checkout);
  run("git", ["push", "origin", "main"], checkout);
  const stale = verify(checkout, "course-kit-v0.2.0");
  assert.notEqual(stale.status, 0);
  assert.match(
    stale.stderr,
    /tag, checkout, and current main must identify the same commit/,
  );
  assert.match(stale.stderr, /tag=[0-9a-f]{40}/);
  assert.match(stale.stderr, /main=[0-9a-f]{40}/);
  assert.match(stale.stderr, /checkout=[0-9a-f]{40}/);
});
