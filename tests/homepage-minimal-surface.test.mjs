import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const courseCatalogCssUrl = new URL("../app/styles/course-catalog.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);
const projectCourseUrl = new URL("../app/courses/llm-systems/page.tsx", import.meta.url);
const coursesLandingUrl = new URL("../products/courses/CoursesLanding.tsx", import.meta.url);
const frameworkLandingUrl = new URL("../products/framework/FrameworkLanding.tsx", import.meta.url);
const pageAtmosphereUrl = new URL("../app/components/PageAtmosphere.tsx", import.meta.url);
const coursesCssUrl = new URL("../products/courses/courses.module.css", import.meta.url);
const frameworkCssUrl = new URL("../products/framework/framework.module.css", import.meta.url);

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("the project course leads directly from its introduction to the modules", async () => {
  const page = await readFile(projectCourseUrl, "utf8");

  assert.match(page, /<CourseResume \/>/);
  assert.match(page, /<section className="course-track-grid"/);
  assert.doesNotMatch(page, /FirstRunExperience|Introductory JavaScript RNN|Train and generate/);
});

test("the course CTA does not reintroduce a dark surface", async () => {
  const [courseCatalogCss, responsiveCss] = await Promise.all([
    readFile(courseCatalogCssUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);

  const courseCta = cssRule(courseCatalogCss, ".catalog-capstone-link");
  assert.doesNotMatch(courseCta, /background:/);
  assert.match(courseCta, /border-top:\s*1px solid var\(--line-strong\)/);
  assert.doesNotMatch(courseCatalogCss, /\.first-run/);
  assert.doesNotMatch(responsiveCss, /\.first-run/);
});

test("the learner landing presents courses without platform publishing controls", async () => {
  const [page, atmosphere, css] = await Promise.all([
    readFile(coursesLandingUrl, "utf8"),
    readFile(pageAtmosphereUrl, "utf8"),
    readFile(coursesCssUrl, "utf8"),
  ]);

  assert.match(page, /<PageAtmosphere \/>/);
  assert.match(page, /<LearnerHeader current="courses" \/>/);
  assert.match(atmosphere, /data-learner-atmosphere/);
  assert.match(atmosphere, /data-learner-atmosphere-intro/);
  assert.equal(
    atmosphere.match(/data-learner-atmosphere-trace/g)?.length,
    3,
  );
  assert.doesNotMatch(atmosphere, /page-atmosphere|orbit|node-one|warm-star/);
  assert.match(page, /Learn how language-model systems actually work/);
  assert.match(page, /Bundled reference courses/);
  assert.match(page, /not a shared[\s\S]*catalog of courses other publishers make/);
  assert.match(page, /does[\s\S]*not sync them to an account/);
  assert.match(page, /href="\/framework"/);
  assert.match(page, /href="\/course#starting-point"/);
  assert.match(page, /href="\/courses\/llm-systems"/);
  assert.match(page, /href="\/practice"/);
  assert.match(page, /href="\/flashcards"/);
  assert.match(page, /href="\/sources"/);
  assert.match(page, /coursePrograms\.map/);
  assert.doesNotMatch(page, /href="\/(?:open-learning|workspace)"/);
  assert.doesNotMatch(page, /Platform publishing pipeline|Publish portable content/);
  assert.doesNotMatch(page, /HomepageCopy|EditableText|testimonial|trusted by/i);
  assert.doesNotMatch(css, /box-shadow|linear-gradient|#[0-9a-f]{3,8}/i);
  assert.match(css, /\.startingPoint,[^{]*\{[^}]*border-top:\s*1px solid var\(--line-strong\)/);
});

test("the framework landing leads with local browser execution and agent-ready publishing", async () => {
  const [page, css] = await Promise.all([
    readFile(frameworkLandingUrl, "utf8"),
    readFile(frameworkCssUrl, "utf8"),
  ]);

  assert.match(page, /<PageAtmosphere \/>/);
  assert.match(page, /<FrameworkHeader current="overview" \/>/);
  assert.match(page, /Build learning software that runs in the browser/);
  assert.match(page, /Course Kit \+ starter/);
  assert.match(page, /CPython through WebAssembly/);
  assert.match(page, /Understanding comes from changing the code/);
  assert.match(page, /Latent Courses[\s\S]*bundled[\s\S]*reference-course product/);
  assert.match(page, /not added to Latent Courses/);
  assert.match(page, /There is no hidden Latent course cloud/);
  assert.match(page, /courses\/authored/);
  assert.match(page, /Progress is browser-local/);
  assert.match(page, /aria-label="Agent-assisted publishing workflow"/);
  assert.match(page, /packages\/course-kit\//);
  assert.match(page, /packages\/python-lab\//);
  assert.match(page, /examples\/learning-platform\/llm-learning\//);
  assert.match(page, /href="\/open-learning"/);
  assert.doesNotMatch(page, /Two products, one explicit boundary|The platform is not the course library/);
  assert.doesNotMatch(page, /FirstRunExperience|courseTracks|testimonial|trusted by/i);
  assert.doesNotMatch(page, /HomepageCopy|EditableText|href="\/workspace"/);
  assert.doesNotMatch(css, /box-shadow|linear-gradient|#[0-9a-f]{3,8}/i);
  assert.match(cssRule(css, ".argument"), /border-top:\s*1px solid var\(--line-strong\)/);
  assert.match(css, /\.browserProof\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.agentFlow\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.browserProof,[\s\S]*\.agentFlow,[\s\S]*grid-template-columns:\s*1fr/);
});
