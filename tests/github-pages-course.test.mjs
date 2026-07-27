import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the original LLM Systems course has a subpath-safe static export", async () => {
  const [
    manifestSource,
    nextConfig,
    viteConfig,
    assetPath,
    exportPreparation,
    rootLayout,
  ] = await Promise.all([
    read("package.json"),
    read("next.config.ts"),
    read("vite.config.ts"),
    read("app/lib/public-asset-path.ts"),
    read("scripts/prepare-pages-course-export.mjs"),
    read("app/layout.tsx"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const pagesBuild = manifest.scripts["build:pages-course"];

  assert.match(pagesBuild, /LATENT_PRODUCT_HOME=courses/);
  assert.match(pagesBuild, /LATENT_COURSE_HOME=llm-systems/);
  assert.match(pagesBuild, /LATENT_LEARNING_SUITE_BASE_PATH=\/latent/);
  assert.match(pagesBuild, /LATENT_GITHUB_PAGES_BASE_PATH=\/latent\/llm-systems/);
  assert.match(pagesBuild, /LATENT_STATIC_EXPORT_ORIGIN=https:\/\/model-systems-labs\.github\.io\/latent\/llm-systems/);
  assert.match(pagesBuild, /prepare-pages-course-export\.mjs \/latent\/llm-systems/);
  assert.match(nextConfig, /output: "export"/);
  assert.match(nextConfig, /trailingSlash: true/);
  assert.doesNotMatch(nextConfig, /\bbasePath:/);
  assert.match(viteConfig, /name: "github-pages-base-path"/);
  assert.match(viteConfig, /process\.env\.__NEXT_ROUTER_BASEPATH/);
  assert.match(assetPath, /process\.env\.__NEXT_ROUTER_BASEPATH/);
  assert.match(exportPreparation, /const lessonIds = \[[\s\S]*"chat-product-quality"/);
  assert.match(exportPreparation, /"index\.html"/);
  assert.match(exportPreparation, /protected LLM Systems course/);
  assert.match(exportPreparation, /Content-Security-Policy/);
  assert.match(rootLayout, /Build an LLM System · Interactive browser course/);
  assert.match(rootLayout, /LATENT_COURSE_HOME === "llm-systems"/);
  assert.match(rootLayout, /httpEquiv="Content-Security-Policy"/);
  assert.match(rootLayout, /worker-src 'self' blob:/);
  assert.match(exportPreparation, /capstone-react-runtime\.js/);
  assert.match(exportPreparation, /capstone-sandbox-worker\.js/);
  assert.match(exportPreparation, /learningSuiteBasePath/);
  assert.match(exportPreparation, /`\$\{learningSuiteBasePath\}\/`/);
  assert.match(exportPreparation, /Unprefixed static URL/);
});

test("both Pages publishers retain public artifacts and the LLM Systems example", async () => {
  const [deploy, release, readme, previewServer, suiteBuilder] = await Promise.all([
    read(".github/workflows/deploy-interview-loop-pages.yml"),
    read(".github/workflows/release-course-kit.yml"),
    read("README.md"),
    read("scripts/serve-learning-example-pages.mjs"),
    read("scripts/build-learning-example-pages.mjs"),
  ]);

  assert.match(deploy, /npm run learning-examples:build/);
  assert.match(deploy, /Build the complete learner suite/);
  assert.match(deploy, /public\/\*\*/);
  assert.match(deploy, /scripts\/\*\*/);
  assert.match(release, /npm run learning-examples:build/);
  assert.match(release, /path: \.pages-site/);
  assert.match(release, /cmp "\$existing" "\.pages-site\/open-learning\/v1\/\$schema"/);
  assert.match(release, /cmp "\$question_existing" "\.pages-site\/question-groups\/v1\/\$question_schema"/);
  for (const workflow of [deploy, release]) {
    assert.match(workflow, /open-learning\/v1\/learning-pack\.schema\.json/);
    assert.match(workflow, /question-group-progress\.schema\.json/);
    assert.match(workflow, /actions\/deploy-pages@[0-9a-f]{40} # v4/);
  }
  assert.match(
    readme,
    /https:\/\/model-systems-labs\.github\.io\/latent\/llm-systems\//,
  );
  assert.match(readme, /14 browser labs that become a working chat capstone/);
  assert.match(previewServer, /join\(requestedPath, "index\.html"\)/);
  assert.match(previewServer, /python-exercise\.worker\.js/);
  assert.match(
    suiteBuilder,
    /createLearnerUiCss\([\s\S]*?resolveLearnerUiTheme\(\{ palette: "paper" \}\),[\s\S]*?\{ palette: "paper" \}/,
  );
});
