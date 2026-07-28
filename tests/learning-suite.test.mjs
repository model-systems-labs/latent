import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createLearningSuiteHeaderConfiguration,
  createLearningSuiteHeaderNavigation,
  createLearningSuiteNavigation,
  learningSuite,
  learningSuiteRouteReport,
  validateLearningSuite,
} from "#root/examples/learning-platform/learning-suite.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the trusted learning suite declares three independent static experiences", () => {
  assert.equal(learningSuite.schemaVersion, 1);
  assert.equal(learningSuite.home.id, "learning-studio");
  assert.deepEqual(
    learningSuite.experiences.map(({ id, kind, mount }) => ({ id, kind, mount })),
    [
      { id: "llm-systems", kind: "course", mount: "llm-systems" },
      { id: "interview-loop", kind: "course", mount: "interview-loop" },
      { id: "ten-problems", kind: "practice", mount: "practice" },
    ],
  );
  assert.deepEqual(learningSuiteRouteReport(), {
    home: ["/"],
    llmSystems: ["/llm-systems/"],
    interviewLoop: ["/interview-loop/"],
    practice: ["/practice/", "/practice/leeches/"],
  });
  assert.equal(learningSuite.headerMeta, "Courses and practice");
  assert.equal(learningSuite.intro.eyebrow, "Learning paths");
  assert.match(learningSuite.intro.description, /Build an LLM system/);
  assert.match(learningSuite.intro.description, /engineering interview scenario/);
  assert.match(learningSuite.intro.description, /ten Python problems/);
  assert.doesNotMatch(
    `${learningSuite.headerMeta} ${learningSuite.intro.description}`,
    /framework|separately built|directory|account dashboard/i,
  );
  assert.match(learningSuite.footerSummary, /stores its progress separately/);
  assert.ok(Object.isFrozen(learningSuite));
  assert.ok(Object.isFrozen(learningSuite.experiences));
});

test("suite navigation derives root, sibling, and Pages-subpath links", () => {
  assert.deepEqual(
    createLearningSuiteNavigation({
      rootHref: "./",
      currentId: "learning-studio",
      includeHome: false,
    }),
    [
      { id: "llm-systems", label: "LLM Systems", href: "./llm-systems/", current: undefined },
      { id: "interview-loop", label: "Interview Loop", href: "./interview-loop/", current: undefined },
      { id: "ten-problems", label: "Ten Problems", href: "./practice/", current: undefined },
    ],
  );
  assert.deepEqual(
    createLearningSuiteNavigation({
      rootHref: "../",
      currentId: "interview-loop",
    }),
    [
      { id: "learning-studio", label: "Learning Studio", href: "../", current: undefined },
      { id: "llm-systems", label: "LLM Systems", href: "../llm-systems/", current: undefined },
      { id: "interview-loop", label: "Interview Loop", href: "./", current: true },
      { id: "ten-problems", label: "Ten Problems", href: "../practice/", current: undefined },
    ],
  );
  assert.deepEqual(
    createLearningSuiteNavigation({
      rootHref: "/latent/",
      currentId: "llm-systems",
    }).map(({ id, href, current }) => ({ id, href, current })),
    [
      { id: "learning-studio", href: "/latent/", current: undefined },
      { id: "llm-systems", href: "/latent/llm-systems/", current: true },
      { id: "interview-loop", href: "/latent/interview-loop/", current: undefined },
      { id: "ten-problems", href: "/latent/practice/", current: undefined },
    ],
  );
  assert.throws(
    () => createLearningSuiteNavigation({ rootHref: "https://example.com/", currentId: "llm-systems" }),
    /absolute local path/,
  );
  assert.throws(
    () => createLearningSuiteNavigation({ rootHref: "./", currentId: "unknown" }),
    /Unknown learning suite destination/,
  );
  assert.deepEqual(
    createLearningSuiteHeaderNavigation({
      rootHref: "../",
      currentId: "ten-problems",
    })[3],
    { label: "Ten Problems", href: "./", current: true },
  );
  assert.deepEqual(
    createLearningSuiteHeaderConfiguration({
      rootHref: "../",
      currentId: "interview-loop",
    }),
    {
      productName: "Learning Studio",
      homeHref: "../",
      homeLabel: "Learning Studio home",
      navigationLabel: "Learning suite",
      navigation: [
        { label: "LLM Systems", href: "../llm-systems/", current: undefined },
        { label: "Interview Loop", href: "./", current: true },
        { label: "Ten Problems", href: "../practice/", current: undefined },
      ],
      menuLabel: "Experiences",
      meta: "Courses and practice",
    },
  );
});

test("suite validation rejects duplicate ids and routes", () => {
  const duplicateId = structuredClone(learningSuite);
  duplicateId.experiences[1].id = duplicateId.experiences[0].id;
  assert.throws(
    () => validateLearningSuite(duplicateId),
    /experience id is duplicated/,
  );

  const duplicateMount = structuredClone(learningSuite);
  duplicateMount.experiences[1].mount = duplicateMount.experiences[0].mount;
  assert.throws(
    () => validateLearningSuite(duplicateMount),
    /mount is duplicated/,
  );
});

test("the deployment directory stays distinct from the internal LLM course catalog", async () => {
  const [courseSource, builder] = await Promise.all([
    read("examples/learning-platform/llm-learning/lessons/course.ts"),
    read("scripts/build-learning-example-pages.mjs"),
  ]);
  for (const courseId of [
    "linear-algebra",
    "machine-learning-basics",
    "harness-engineering",
    "llm-systems",
  ]) {
    assert.match(courseSource, new RegExp(`id: "${courseId}"`));
  }
  assert.deepEqual(
    learningSuite.experiences.map((experience) => experience.id),
    ["llm-systems", "interview-loop", "ten-problems"],
  );
  assert.doesNotMatch(
    JSON.stringify(learningSuite),
    /linear-algebra|machine-learning-basics|harness-engineering/,
  );
  assert.doesNotMatch(builder, /coursePrograms/);
});

test("suite consumers derive sibling navigation from the manifest", async () => {
  const [builder, header, interviewPlatform, interviewConfig, tenConfig] = await Promise.all([
    read("scripts/build-learning-example-pages.mjs"),
    read("app/components/LearnerHeader.tsx"),
    read("examples/learning-platform/interview-loop/platform.json"),
    read("examples/learning-platform/interview-loop/site-config.mjs"),
    read("examples/learning-platform/ten-problems/site-config.mjs"),
  ]);

  assert.match(builder, /learningSuite\.experiences\.map/);
  assert.match(builder, /learningSuiteRouteReport\(\)/);
  assert.match(builder, /createLearningSuiteHeaderConfiguration/);
  assert.doesNotMatch(builder, /grid-template-columns:\s*repeat\(3/);
  assert.match(header, /createLearningSuiteHeaderConfiguration/);
  assert.match(header, /suiteHeader\.navigationLabel/);
  assert.doesNotMatch(header, /const suiteDestinations = \[/);
  assert.equal(JSON.parse(interviewPlatform).learnerUi.header, undefined);
  assert.ok(JSON.parse(interviewPlatform).learnerUi.contextNavigation);
  for (const config of [interviewConfig, tenConfig]) {
    assert.match(config, /createLearningSuiteHeaderConfiguration/);
    assert.doesNotMatch(config, /label:\s*"Learning Studio"/);
  }
  assert.match(interviewConfig, /createInterviewLoopHeader/);
  assert.match(tenConfig, /suiteHeader:\s*createLearningSuiteHeaderConfiguration/);
});
