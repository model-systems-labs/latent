import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const expectedPackages = [
  "@latent/artifact-runtime",
  "@latent/browser-lab",
  "@latent/course-kit",
  "@latent/model-lab",
  "@latent/mock-services",
  "@latent/tensor",
  "@latent/training-replay",
];

test("the root application orchestrates seven explicit workspace packages", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "@latent/web");
  assert.deepEqual(manifest.workspaces, ["packages/*"]);
  assert.deepEqual(expectedPackages.filter((name) => manifest.dependencies[name] === "*"), expectedPackages);
  const packageDirectories = (await readdir(new URL("../packages/", import.meta.url), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(packageDirectories, ["artifact-runtime", "browser-lab", "course-kit", "mock-services", "model-lab", "tensor", "training-replay"]);
  for (const directory of packageDirectories) {
    const packageManifest = JSON.parse(await readFile(new URL(`../packages/${directory}/package.json`, import.meta.url), "utf8"));
    assert.equal(packageManifest.private, true);
    assert.match(packageManifest.version, /^\d+\.\d+\.\d+$/);
    assert.ok(packageManifest.exports);
    assert.ok(packageManifest.scripts.test);
    assert.ok(packageManifest.scripts.typecheck);
  }
});

test("legacy in-app package copies have been removed", async () => {
  for (const path of [
    "../app/platform/artifact-runtime/index.ts",
    "../app/platform/browser-lab/index.ts",
    "../app/platform/latent-tensor/index.ts",
    "../app/platform/lms/index.ts",
    "../app/runtime/serving/sse.ts",
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
});

test("lesson content and style layers have independent ownership", async () => {
  const [modelFiles, systemFiles, productFiles, globals] = await Promise.all([
    readdir(new URL("../app/lessons/model/", import.meta.url)),
    readdir(new URL("../app/lessons/extended/systems/", import.meta.url)),
    readdir(new URL("../app/lessons/extended/product/", import.meta.url)),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal(modelFiles.filter((file) => file.endsWith(".ts") && file !== "shared.ts").length, 6);
  assert.equal(systemFiles.filter((file) => file.endsWith(".ts")).length, 4);
  assert.equal(productFiles.filter((file) => file.endsWith(".ts")).length, 4);
  for (const stylesheet of ["tokens", "learning-flow", "course-catalog", "coding-workspace", "capstone", "responsive"]) {
    assert.match(globals, new RegExp(`styles/${stylesheet}\\.css`));
  }
});
