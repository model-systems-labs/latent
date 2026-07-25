import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const tag = "course-kit-v0.2.0";
const tarball =
  "https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-course-kit-0.2.0.tgz";
const demoUrl =
  "https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-v0.2-demo.webm";
const cloneCommand = `git clone --depth 1 --branch ${tag} \\
  https://github.com/model-systems-labs/latent.git`;
const createCommand = `npm run create:platform -- ../my-school \\
  --title "My School" \\
  --tagline "Learn one useful idea, retrieve it, and put it to work." \\
  --preview`;
const demoCreateCommand = `npm run create:platform -- ../my-school \\
  --title "My School" \\
  --tagline "Learn one useful idea, retrieve it, and put it to work." \\
  --accent "#7c3aed"`;

async function bytes(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath));
}

test("v0.2 release notes and demo pin the exact public workflow", async () => {
  const [notes, demo, workflow, llms] = await Promise.all([
    readFile(resolve(repositoryRoot, `docs/release/${tag}.md`), "utf8"),
    readFile(resolve(repositoryRoot, "docs/release/v0.2-demo-script.md"), "utf8"),
    readFile(resolve(repositoryRoot, ".github/workflows/release-course-kit.yml"), "utf8"),
    readFile(resolve(repositoryRoot, "public/llms.txt"), "utf8"),
  ]);

  assert.match(notes, new RegExp(tag.replaceAll(".", "\\.")));
  assert.ok(notes.includes(cloneCommand));
  assert.ok(notes.includes(createCommand));
  assert.match(demo, new RegExp(tag.replaceAll(".", "\\.")));
  assert.ok(demo.includes(cloneCommand));
  assert.ok(demo.includes(demoCreateCommand));
  assert.ok(demo.includes("cd ../my-school"));
  assert.ok(demo.includes("npm run validate"));
  assert.ok(demo.includes("npm run build"));
  assert.ok(demo.includes("npm run preview"));
  assert.doesNotMatch(demo, /--preview/);
  assert.ok(notes.includes(tarball));
  assert.ok(notes.includes(demoUrl));
  assert.ok(llms.includes(tag));
  for (const name of ["course", "flashcards", "practice", "ide"]) {
    assert.ok(notes.includes(`docs/release/screenshots/${name}.jpg?raw=1`));
  }
  assert.ok(notes.includes("docs/release/architecture-graphic.png?raw=1"));
  assert.match(workflow, /node scripts\/verify-release-ref\.mjs "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /release_notes="docs\/release\/\$\{GITHUB_REF_NAME\}\.md"/);
  assert.match(workflow, /--notes-file "\$release_notes"/);
  assert.match(workflow, /demo="docs\/release\/latent-v0\.2-demo\.webm"/);
  assert.match(workflow, /"\$demo"/);
  assert.doesNotMatch(workflow, /v0\.2-release-notes/);
  assert.doesNotMatch(workflow, /merge-base --is-ancestor/);
  assert.match(
    workflow,
    /\[ "\$question_status" = "404" \] && \[ "\$GITHUB_REF_NAME" = "course-kit-v0\.2\.0" \]/,
  );
});

test("v0.2 image collateral is committed in its real binary formats", async () => {
  const pngs = [
    "docs/release/architecture-graphic.png",
    "public/og-v0.2.png",
  ];
  for (const path of pngs) {
    const source = await bytes(path);
    assert.ok(source.length > 10_000, `${path} is unexpectedly small`);
    assert.deepEqual([...source.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }

  for (const name of ["course", "flashcards", "practice", "ide"]) {
    const path = `docs/release/screenshots/${name}.jpg`;
    const source = await bytes(path);
    assert.ok(source.length > 10_000, `${path} is unexpectedly small`);
    assert.deepEqual([...source.subarray(0, 3)], [255, 216, 255]);
  }

  const demo = await bytes("docs/release/latent-v0.2-demo.webm");
  assert.ok(demo.length > 100_000, "release demo is unexpectedly small");
  assert.deepEqual([...demo.subarray(0, 4)], [26, 69, 223, 163]);
});

test("the tag gate allows local preview language but rejects contradictory release truth", async () => {
  const guide = await readFile(
    resolve(repositoryRoot, "docs/question-groups.md"),
    "utf8",
  );
  assert.match(guide, /bundled preview server/);

  const result = spawnSync(
    process.execPath,
    ["packages/course-kit/scripts/check-release.mjs", tag],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
