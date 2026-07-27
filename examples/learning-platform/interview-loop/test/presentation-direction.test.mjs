import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Interview Loop is a single vertical course flow with a clearly framed system-design prompt", async () => {
  const [styles, packSource, ideSource] = await Promise.all([
    read("site/styles.css"),
    read("content/learning-pack.json"),
    read("trusted/ide-exercises.mjs"),
  ]);
  const pack = JSON.parse(packSource);
  const architecture = pack.lessons.find(({ id }) => id === "architecture-webhook-delivery");

  assert.equal(pack.package.version, "2.1.0");
  assert.equal(architecture.title, "System design interview: webhook delivery");
  assert.match(architecture.summary, /rehearse a reusable system-design interview method/);
  assert.match(packSource, /A system-design interview in seven explicit passes/);
  assert.match(packSource, /Worked interview prompt: multi-tenant webhook delivery/);
  assert.match(ideSource, /Coding follow-up: schedule bounded retries/);

  assert.match(styles, /\.view-grid \{[\s\S]*?display: block;/);
  assert.match(styles, /\.view-grid \.rail \{[\s\S]*?border-bottom: var\(--learner-border\)/);
  assert.match(styles, /\.view-grid \.work \{[\s\S]*?background: transparent;/);
  assert.doesNotMatch(styles, /\.view-grid \{[^}]*grid-template-columns:/);
});

test("trusted references are read-only disclosures and never portable content", async () => {
  const [app, learningPack, questionGroups] = await Promise.all([
    read("site/app.mjs"),
    read("content/learning-pack.json"),
    read("content/question-groups.json"),
  ]);

  assert.match(app, /function referenceSolutionDisclosure\(source, title\)/);
  assert.match(app, /globalThis\.LearnerUiComponents\?\.createSolutionDisclosure/);
  assert.match(app, /return createSolutionDisclosure\(\{ source, title \}\)/);
  assert.match(app, /import\("\.\/trusted\/reference-solutions\.mjs"\)/);
  assert.doesNotMatch(app, /innerHTML/);
  assert.doesNotMatch(learningPack, /referenceSolution|exampleSolution/);
  assert.doesNotMatch(questionGroups, /referenceSolution|exampleSolution/);
});
