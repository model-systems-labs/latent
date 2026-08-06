import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const expectedPackages = [
  "@latent/artifact-runtime",
  "@latent/browser-lab",
  "@latent/course-kit",
  "@latent/model-lab",
  "@latent/mock-services",
  "@latent/python-lab",
  "@latent/tensor",
  "@latent/training-replay",
];

test("the root application orchestrates eight explicit workspace packages", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "@latent/web");
  assert.deepEqual(manifest.workspaces, ["packages/*"]);
  assert.deepEqual(expectedPackages.filter((name) => manifest.dependencies[name] === "*"), expectedPackages);
  const packageDirectories = (await readdir(new URL("../packages/", import.meta.url), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(packageDirectories, ["artifact-runtime", "browser-lab", "course-kit", "mock-services", "model-lab", "python-lab", "tensor", "training-replay"]);
  for (const directory of packageDirectories) {
    const packageManifest = JSON.parse(await readFile(new URL(`../packages/${directory}/package.json`, import.meta.url), "utf8"));
    if (directory === "course-kit") {
      assert.notEqual(packageManifest.private, true);
    } else {
      assert.equal(packageManifest.private, true);
    }
    assert.match(packageManifest.version, /^\d+\.\d+\.\d+$/);
    assert.ok(packageManifest.exports);
    assert.ok(packageManifest.scripts.test);
    assert.ok(packageManifest.scripts.typecheck);
  }
});

test("Course Kit is independently licensed, packable, and guarded for public releases", async () => {
  const [manifestSource, license, readme, ci, release] = await Promise.all([
    readFile(new URL("../packages/course-kit/package.json", import.meta.url), "utf8"),
    readFile(new URL("../packages/course-kit/LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../packages/course-kit/README.md", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/release-course-kit.yml", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const rootManifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(rootManifest.version, manifest.version);
  assert.equal(manifest.license, "Apache-2.0");
  assert.equal(manifest.publishConfig.access, "public");
  assert.equal(manifest.bin["latent-learning"], "bin/latent-learning.mjs");
  assert.deepEqual(
    ["LICENSE", "README.md", "bin", "dist", "docs", "schema"].filter((entry) => manifest.files.includes(entry)),
    ["LICENSE", "README.md", "bin", "dist", "docs", "schema"],
  );
  assert.match(manifest.scripts.prepack, /clean.*build.*prepare:package.*test:built/);
  assert.match(license, /Apache License[\s\S]*Version 2\.0/);
  assert.match(readme, /Course Kit v0\.2\.0 is the latest published release/);
  assert.match(readme, /releases\/download\/course-kit-v0\.2\.0\/latent-course-kit-0\.2\.0\.tgz/);
  assert.match(readme, /not currently published on npm/);
  assert.match(readme, /npm exec --yes --package "\$COURSE_KIT_RELEASE" --/);
  assert.match(ci, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(ci, /uses: [^@\n]+@v\d/);
  assert.match(ci, /npm run smoke:package --workspace @latent\/course-kit/);
  assert.match(release, /course-kit-v\*/);
  assert.doesNotMatch(release, /NPM_TOKEN/);
  assert.doesNotMatch(release, /uses: [^@\n]+@v\d/);
  assert.match(release, /release:check --workspace @latent\/course-kit/);
  assert.match(release, /Validate the exact tagged repository[\s\S]*npm run validate/);
  assert.match(release, /npm run validate[\s\S]*git diff --exit-code/);
  assert.match(release, /actions\/upload-artifact@[0-9a-f]{40} # v7\.0\.1/);
  assert.match(release, /actions\/download-artifact@[0-9a-f]{40} # v4/);
  assert.match(release, /github-release:[\s\S]*?gh release create "\$GITHUB_REF_NAME"/);
  assert.match(release, /npm publishing is intentionally deferred/);
  assert.doesNotMatch(release, /NPM_PUBLISH_ENABLED|run:\s*npm publish/);
  assert.match(release, /_schema-site\/open-learning\/v1/);
  assert.match(release, /actions\/deploy-pages@[0-9a-f]{40} # v4/);
});

test("Course Kit schema ids use immutable versioned Pages paths with exact convenience copies", async () => {
  for (const [name, expectedId] of [
    [
      "learning-pack.schema.json",
      "https://model-systems-labs.github.io/latent/open-learning/v1/learning-pack.schema.json",
    ],
    [
      "learning-feed.schema.json",
      "https://model-systems-labs.github.io/latent/open-learning/v1/learning-feed.schema.json",
    ],
  ]) {
    const copies = await Promise.all([
      readFile(new URL(`../packages/course-kit/schema/${name}`, import.meta.url), "utf8"),
      readFile(new URL(`../docs/${name}`, import.meta.url), "utf8"),
      readFile(new URL(`../public/open-learning/${name}`, import.meta.url), "utf8"),
      readFile(new URL(`../public/open-learning/v1/${name}`, import.meta.url), "utf8"),
    ]);
    assert.equal(new Set(copies).size, 1, `${name} copies must be byte-identical`);
    assert.equal(JSON.parse(copies[0]).$id, expectedId);
  }
});

test("the v0.2 contract separates portable content from trusted executable source", async () => {
  const [
    launchContract,
    releaseStatusSource,
    packageManifestSource,
    architecture,
    decision,
    security,
    releaseCheck,
  ] = await Promise.all([
    readFile(new URL("../docs/v0.2-launch-contract.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/release-status.json", import.meta.url), "utf8"),
    readFile(new URL("../packages/course-kit/package.json", import.meta.url), "utf8"),
    readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../docs/decisions/0001-portable-content-and-trusted-extensions.md",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
    readFile(
      new URL("../packages/course-kit/scripts/check-release.mjs", import.meta.url),
      "utf8",
    ),
  ]);

  const releaseStatus = JSON.parse(releaseStatusSource);
  const packageManifest = JSON.parse(packageManifestSource);
  const courseKitStatus = releaseStatus.courseKit;
  assert.equal(releaseStatus.schemaVersion, 1);
  assert.equal(courseKitStatus.sourceVersion, packageManifest.version);
  assert.equal(courseKitStatus.state, "released");
  assert.equal(courseKitStatus.npmState, "unpublished");
  assert.equal(courseKitStatus.latestPublishedVersion, packageManifest.version);
  assert.equal(courseKitStatus.questionGroupSchemaState, "published");
  assert.equal(
    courseKitStatus.latestPublishedTag,
    `course-kit-v${packageManifest.version}`,
  );
  assert.equal(
    courseKitStatus.installUrl,
    `https://github.com/model-systems-labs/latent/releases/download/${courseKitStatus.latestPublishedTag}/latent-course-kit-${packageManifest.version}.tgz`,
  );
  assert.match(courseKitStatus.releaseCommit, /^[0-9a-f]{40}$/);
  assert.equal(
    courseKitStatus.releaseUrl,
    `https://github.com/model-systems-labs/latent/releases/tag/${courseKitStatus.latestPublishedTag}`,
  );
  assert.match(courseKitStatus.tarballSha256, /^[0-9a-f]{64}$/);
  assert.equal(releaseStatus.referenceDeployment.state, "released");
  assert.equal(releaseStatus.referenceDeployment.provider, "Sites");
  assert.match(
    releaseStatus.referenceDeployment.projectId,
    /^appgprj_[0-9a-f]+$/,
  );
  assert.match(
    releaseStatus.referenceDeployment.versionId,
    /^appgprj_[0-9a-f]+~appgver_[0-9a-f]+$/,
  );
  assert.match(
    releaseStatus.referenceDeployment.deploymentId,
    /^appgdep_[0-9a-f]+$/,
  );
  assert.match(
    releaseStatus.referenceDeployment.sourceArchiveSha256,
    /^[0-9a-f]{64}$/,
  );
  assert.equal(
    releaseStatus.referenceDeployment.provenanceVerification.mode,
    "provider-authenticated",
  );
  assert.equal(
    releaseStatus.referenceDeployment.provenanceVerification.publiclyReproducible,
    false,
  );
  assert.equal(
    releaseStatus.referenceDeployment.commitSha,
    courseKitStatus.releaseCommit,
  );
  assert.equal(
    releaseStatus.referenceDeployment.url,
    "https://latent-llm-learning.cswansondeveloper.chatgpt.site",
  );
  assert.equal(
    releaseStatus.referenceDeployment.llmsUrl,
    `${releaseStatus.referenceDeployment.url}/llms.txt`,
  );
  assert.ok(
    Number.isInteger(releaseStatus.referenceDeployment.versionNumber)
      && releaseStatus.referenceDeployment.versionNumber > 0,
  );
  assert.equal(releaseStatus.schemas.state, "published");
  assert.equal(releaseStatus.schemas.artifacts.length, 4);
  for (const schema of releaseStatus.schemas.artifacts) {
    assert.match(schema.url, /^https:\/\/model-systems-labs\.github\.io\/latent\//);
    assert.match(schema.sha256, /^[0-9a-f]{64}$/);
  }
  assert.match(launchContract, /Status: \*\*released\*\*/);
  assert.doesNotMatch(launchContract, /\bpreview\b|not yet released/i);
  assert.match(launchContract, /Portable content/);
  assert.match(launchContract, /Trusted platform source/);
  assert.match(launchContract, /Question Groups include the release-ready authorship/);
  assert.match(architecture, /@latent\/python-lab/);
  assert.match(architecture, /application-owned question adapter/);
  assert.match(architecture, /application source and contract binding/);
  assert.match(decision, /Models and agents operate at authoring and build time/);
  assert.match(decision, /never downloaded and activated as remote executable/);
  assert.match(security, /Python Lab is not a\s+hostile-code security sandbox/);
  assert.match(releaseCheck, /"README\.md"/);
  assert.match(releaseCheck, /contains stale Course Kit release/);
  assert.match(releaseCheck, /release-status\.json/);
  assert.match(releaseCheck, /Status: \*\*released\*\*/);
  assert.match(releaseCheck, /CHANGELOG\.md must contain a dated/);
  assert.match(releaseCheck, /npmState/);
  assert.match(releaseCheck, /release section still contains pre-release wording/);
});

test("the source inventory attributes the browser Python runtime", async () => {
  const source = await readFile(new URL("../app/sources/page.tsx", import.meta.url), "utf8");
  assert.match(source, /name: "Pyodide", version: "314\.0\.2", license: "MPL-2\.0"/);
  assert.match(source, /name: "NumPy", version: "2\.4\.3", license: "BSD-3-Clause"/);
  assert.match(source, /name: "CodeMirror Python language", version: "6\.2\.1", license: "MIT"/);
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
    readdir(new URL("../examples/learning-platform/llm-learning/lessons/model/", import.meta.url)),
    readdir(new URL("../examples/learning-platform/llm-learning/lessons/extended/systems/", import.meta.url)),
    readdir(new URL("../examples/learning-platform/llm-learning/lessons/extended/product/", import.meta.url)),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const modelLessonFiles = modelFiles.filter((file) => file.endsWith(".ts") && !["shared.ts", "character-rnn-training.ts"].includes(file));
  assert.equal(modelLessonFiles.length, 6);
  assert.ok(modelFiles.includes("character-rnn-training.ts"), "the CPython character-RNN training postlude has its own infrastructure module");
  assert.equal(systemFiles.filter((file) => file.endsWith(".ts")).length, 4);
  assert.equal(productFiles.filter((file) => file.endsWith(".ts")).length, 4);
  for (const stylesheet of ["tokens", "learning-flow", "course-catalog", "coding-workspace", "capstone", "responsive"]) {
    assert.match(globals, new RegExp(`styles/${stylesheet}\\.css`));
  }
});
