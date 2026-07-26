import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the app routes compose separate course and framework product folders", async () => {
  const [rootRoute, selector, viteConfig, frameworkRoute, courses, framework] = await Promise.all([
    read("app/page.tsx"),
    read("products/product-home.ts"),
    read("vite.config.ts"),
    read("app/framework/page.tsx"),
    read("products/courses/CoursesLanding.tsx"),
    read("products/framework/FrameworkLanding.tsx"),
  ]);

  assert.match(rootRoute, /products\/product-home/);
  assert.match(rootRoute, /export default ProductHome/);
  assert.match(selector, /CoursesLanding as ProductHome/);
  assert.match(viteConfig, /LATENT_PRODUCT_HOME === "framework"/);
  assert.match(viteConfig, /products\/framework\/home\.ts/);
  assert.match(viteConfig, /products\/courses\/home\.ts/);

  assert.match(frameworkRoute, /products\/framework\/FrameworkLanding/);
  assert.match(frameworkRoute, /export default FrameworkLanding/);
  assert.doesNotMatch(frameworkRoute, /CoursesLanding/);

  assert.match(courses, /<LearnerHeader current="courses" \/>/);
  assert.doesNotMatch(courses, /href="\/(?:open-learning|workspace)"/);
  assert.doesNotMatch(courses, /LearningPackPublisher|Platform publishing pipeline/);

  assert.match(framework, /href="\/open-learning"/);
  assert.match(framework, /Platform publishing pipeline/);
  assert.doesNotMatch(framework, /<LearnerHeader/);
});

test("product builds opt into distinct deployments and the future repository split is explicit", async () => {
  await assert.rejects(
    access(new URL(".openai/hosting.json", root)),
    undefined,
    "the repository root must not select a Sites deployment",
  );

  const [courseHostingSource, frameworkHostingSource, packageSource, releaseSource, productLlms, sitesPlugin, productsReadme, coursesReadme] = await Promise.all([
    read("products/courses/.openai/hosting.json"),
    read("products/framework/.openai/hosting.json"),
    read("package.json"),
    read("docs/release-status.json"),
    read("products/courses/llms.txt"),
    read("build/sites-vite-plugin.ts"),
    read("products/README.md"),
    read("products/courses/README.md"),
  ]);
  const courseHosting = JSON.parse(courseHostingSource);
  const frameworkHosting = JSON.parse(frameworkHostingSource);
  const manifest = JSON.parse(packageSource);
  const release = JSON.parse(releaseSource);
  const productIntent = productsReadme.replaceAll("**", "");
  const courseIntent = coursesReadme.replaceAll("**", "");

  assert.deepEqual(courseHosting, {
    project_id: "appgprj_6a6571528c3881919c919eec615da43a",
    d1: null,
    r2: null,
  });
  assert.deepEqual(frameworkHosting, {
    project_id: "appgprj_6a657239c5f48191bf017ccbcf13f251",
    d1: null,
    r2: null,
  });
  assert.notEqual(
    courseHosting.project_id,
    release.referenceDeployment.projectId,
    "the evolving course product must not overwrite the immutable v0.2 reference deployment",
  );
  assert.notEqual(frameworkHosting.project_id, release.referenceDeployment.projectId);
  assert.notEqual(courseHosting.project_id, frameworkHosting.project_id);
  assert.equal(
    manifest.scripts["build:courses"],
    "LATENT_PRODUCT_HOME=courses LATENT_HOSTING_CONFIG=products/courses/.openai/hosting.json npm run build",
  );
  assert.equal(
    manifest.scripts["build:framework"],
    "LATENT_PRODUCT_HOME=framework LATENT_HOSTING_CONFIG=products/framework/.openai/hosting.json npm run build",
  );
  assert.match(productLlms, /^# Latent Courses/m);
  assert.doesNotMatch(productLlms, /Authoritative guide|Publish the complete generated static directory/);
  assert.match(sitesPlugin, /explicitHostingConfig && !\(await exists\(hostingConfig\)\)/);
  assert.match(sitesPlugin, /LATENT_HOSTING_CONFIG does not exist/);
  assert.match(sitesPlugin, /productLlms[\s\S]*dist", "client", "llms\.txt"/);

  assert.match(productIntent, /can later become an\s+independent repository/i);
  assert.match(productIntent, /not a separate\s+repository today/i);
  assert.match(productIntent, /not two fully\s+independent applications/i);
  assert.match(courseIntent, /moving Latent Courses into\s+its own repository later/i);
  assert.match(courseIntent, /future architectural option, not the current\s+state/i);
});

test("course and framework routes keep separate social identities", async () => {
  const [rootLayout, frameworkRoute, openLearningLayout, frameworkMetadata] = await Promise.all([
    read("app/layout.tsx"),
    read("app/framework/page.tsx"),
    read("app/open-learning/layout.tsx"),
    read("products/framework/metadata.ts"),
  ]);

  assert.match(rootLayout, /Latent Courses · Learn LLM systems in your browser/);
  assert.match(rootLayout, /"\/og\.png"[\s\S]*width: 1731, height: 909/);
  assert.match(frameworkRoute, /frameworkMetadata/);
  assert.match(openLearningLayout, /frameworkMetadata/);
  assert.match(frameworkMetadata, /Latent Framework · Build a learning platform you own/);
  assert.match(frameworkMetadata, /"\/og-v0\.2\.png"[\s\S]*width: 1733, height: 908/);
});
