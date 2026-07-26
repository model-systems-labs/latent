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
  assert.match(viteConfig, /"process\.env\.LATENT_PRODUCT_HOME"/);
  assert.match(viteConfig, /products\/framework\/home\.ts/);
  assert.match(viteConfig, /products\/courses\/home\.ts/);

  assert.match(frameworkRoute, /products\/framework\/FrameworkLanding/);
  assert.match(frameworkRoute, /export default FrameworkLanding/);
  assert.doesNotMatch(frameworkRoute, /CoursesLanding/);

  assert.match(courses, /<LearnerHeader current="courses" \/>/);
  assert.match(courses, /bundled reference courses/i);
  assert.match(courses, /href="\/framework"/);
  assert.match(courses, /host it at a URL you control/);
  assert.doesNotMatch(courses, /href="\/(?:open-learning|workspace)"/);
  assert.doesNotMatch(courses, /LearningPackPublisher|Platform publishing pipeline/);

  assert.match(framework, /href="\/open-learning"/);
  assert.match(framework, /<FrameworkHeader current="overview" \/>/);
  assert.match(framework, /not added to Latent Courses/);
  assert.match(framework, /courses\/authored/);
  assert.doesNotMatch(framework, /<LearnerHeader/);
});

test("product builds opt into distinct deployments and the future repository split is explicit", async () => {
  await assert.rejects(
    access(new URL(".openai/hosting.json", root)),
    undefined,
    "the repository root must not select a Sites deployment",
  );

  const [
    courseHostingSource,
    frameworkHostingSource,
    packageSource,
    releaseSource,
    productLlms,
    sitesPlugin,
    boundaryScript,
    productsReadme,
    coursesReadme,
    courseOwnershipReadme,
    authoredCoursesReadme,
    referenceCurriculumReadme,
  ] = await Promise.all([
    read("products/courses/.openai/hosting.json"),
    read("products/framework/.openai/hosting.json"),
    read("package.json"),
    read("docs/release-status.json"),
    read("products/courses/llms.txt"),
    read("build/sites-vite-plugin.ts"),
    read("scripts/check-package-boundaries.mjs"),
    read("products/README.md"),
    read("products/courses/README.md"),
    read("courses/README.md"),
    read("courses/authored/README.md"),
    read("examples/learning-platform/llm-learning/README.md"),
  ]);
  const courseHosting = JSON.parse(courseHostingSource);
  const frameworkHosting = JSON.parse(frameworkHostingSource);
  const manifest = JSON.parse(packageSource);
  const release = JSON.parse(releaseSource);
  const productIntent = productsReadme.replaceAll("**", "");
  const courseIntent = coursesReadme.replaceAll("**", "");

  await Promise.all([
    access(new URL("examples/learning-platform/llm-learning/lessons/course.ts", root)),
    access(new URL("examples/learning-platform/llm-learning/content/llm-systems/manifest.ts", root)),
    access(new URL("courses/authored/README.md", root)),
  ]);
  await Promise.all([
    assert.rejects(access(new URL("app/lessons/course.ts", root))),
    assert.rejects(access(new URL("app/content/llm-systems/manifest.ts", root))),
    assert.rejects(access(new URL("products/courses/reference-curriculum", root))),
  ]);

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
  assert.match(productLlms, /bundled, browser-native reference courses/i);
  assert.match(productLlms, /not added to this\s+bundled learner catalog/i);
  assert.doesNotMatch(productLlms, /Authoritative guide|Publish the complete generated static directory/);
  assert.match(sitesPlugin, /explicitHostingConfig && !\(await exists\(hostingConfig\)\)/);
  assert.match(sitesPlugin, /LATENT_HOSTING_CONFIG does not exist/);
  assert.match(sitesPlugin, /productLlms[\s\S]*dist", "client", "llms\.txt"/);

  assert.match(productIntent, /can later become an\s+independent repository/i);
  assert.match(productIntent, /not a separate\s+repository today/i);
  assert.match(productIntent, /not two fully\s+independent applications/i);
  assert.match(productIntent, /full reference learning project in `examples\/`/i);
  assert.match(productIntent, /courses\/authored/);
  assert.match(courseIntent, /Mount the full learning project from/i);
  assert.match(courseIntent, /not a second copy of the learning project/i);
  assert.match(courseOwnershipReadme, /two kinds of course source deliberately separate/i);
  assert.match(courseOwnershipReadme, /learner progress[\s\S]*learner's browser/i);
  assert.match(authoredCoursesReadme, /does not automatically upload/i);
  assert.match(referenceCurriculumReadme, /Full browser-course example/i);
  assert.match(referenceCurriculumReadme, /must not\s+import `app\/` or `products\/`/i);
  assert.match(referenceCurriculumReadme, /not[\s\S]*a storage location[\s\S]*Open Learning/i);
  assert.match(boundaryScript, /resolve\(root, "examples\/learning-platform\/llm-learning"\)/);
  assert.match(boundaryScript, /reverses the example boundary/);
});

test("course and framework routes keep separate social identities", async () => {
  const [
    rootLayout,
    frameworkRoute,
    openLearningLayout,
    openLearningPage,
    readerPage,
    publisherPage,
    frameworkHeader,
    frameworkMetadata,
  ] = await Promise.all([
    read("app/layout.tsx"),
    read("app/framework/page.tsx"),
    read("app/open-learning/layout.tsx"),
    read("app/open-learning/page.tsx"),
    read("app/open-learning/read/page.tsx"),
    read("app/open-learning/publish/page.tsx"),
    read("products/framework/FrameworkHeader.tsx"),
    read("products/framework/metadata.ts"),
  ]);

  assert.match(rootLayout, /Latent Courses · Learn LLM systems in your browser/);
  assert.match(rootLayout, /"\/og\.png"[\s\S]*width: 1731, height: 909/);
  assert.match(frameworkRoute, /frameworkMetadata/);
  assert.match(openLearningLayout, /frameworkMetadata/);
  assert.match(frameworkMetadata, /Latent Framework · Learning software that runs in the browser/);
  assert.match(frameworkMetadata, /"\/og-framework\.png"[\s\S]*width: 1731, height: 909/);

  assert.match(frameworkHeader, /styles\.header/);
  assert.match(frameworkHeader, /\.\/FrameworkHeader\.module\.css/);
  assert.doesNotMatch(frameworkHeader, /\.\/framework\.module\.css/);
  assert.match(frameworkHeader, /frameworkHomeHref = process\.env\.LATENT_PRODUCT_HOME/);
  assert.match(frameworkHeader, /aria-label="Latent framework home"/);
  assert.match(frameworkHeader, /latent <small>framework<\/small>/);
  assert.match(frameworkHeader, /\{ id: "overview", href: frameworkHomeHref, label: "Overview" \}/);
  assert.match(openLearningPage, /<FrameworkHeader current="open-learning" \/>/);
  assert.match(readerPage, /<FrameworkHeader current="read" \/>/);
  assert.match(publisherPage, /<FrameworkHeader current="publish" \/>/);
  assert.match(publisherPage, /Build a portable Learning Pack you host/);
  assert.match(publisherPage, /Latent does not[\s\S]*add it to the bundled courses/);
  assert.match(readerPage, /Progress is never sent to the publisher/);

  for (const route of [openLearningPage, readerPage, publisherPage]) {
    assert.match(route, /Latent Framework/);
    assert.doesNotMatch(route, /Latent Open Learning/);
  }
});
