import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  buildStandaloneLearningSite,
  canonicalLearningPackJson,
  createLearningFeed,
  createStarterLearningPack,
  learningFeedJsonSchema,
  learningFeedSchema,
  learningPackJsonSchema,
  parseLearningPackJson,
  validateLearningPack,
} from "../dist/index.js";

const exampleSource = await readFile(
  new URL("../../../examples/open-learning/reliable-llm-changes/learning-pack.json", import.meta.url),
  "utf8",
);
const example = JSON.parse(exampleSource);

function copy(value) {
  return structuredClone(value);
}

function digest(source) {
  return createHash("sha256").update(source).digest("hex");
}

test("the example learning pack passes strict structural and teaching-quality checks", () => {
  const validation = validateLearningPack(example);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.warnings, []);
  assert.deepEqual(validation.summary, {
    lessons: 2,
    quizzes: 2,
    flashcardDecks: 1,
    flashcards: 8,
    objectives: 3,
    sources: 3,
  });
});

test("learning packs reject unknown fields, unresolved references, and duplicate identities", () => {
  const unknownField = copy(example);
  unknownField.package.untrusted = true;
  assert.equal(validateLearningPack(unknownField).valid, false);

  const unresolved = copy(example);
  unresolved.lessons[0].sourceIds.push("missing-source");
  assert.match(
    validateLearningPack(unresolved).errors.map((entry) => entry.message).join("\n"),
    /Unknown source id "missing-source"/,
  );

  const duplicate = copy(example);
  duplicate.flashcardDecks[0].cards[1].id = duplicate.flashcardDecks[0].cards[0].id;
  assert.match(
    validateLearningPack(duplicate).errors.map((entry) => entry.message).join("\n"),
    /card id .* used more than once/i,
  );

  const longPublisher = copy(example);
  longPublisher.package.id = `${"a".repeat(65)}/topic`;
  assert.match(
    validateLearningPack(longPublisher).errors.map((entry) => entry.message).join("\n"),
    /publisher namespace may not exceed 64/i,
  );

  const credentialUrl = copy(example);
  credentialUrl.sources[0].url = "https://user:secret@example.com/source";
  assert.match(
    validateLearningPack(credentialUrl).errors.map((entry) => entry.message).join("\n"),
    /without embedded credentials/i,
  );
});

test("learning packs fail closed on unfinished or executable authored content", () => {
  const starter = createStarterLearningPack();
  assert.match(
    validateLearningPack(starter).errors.map((entry) => entry.code).join("\n"),
    /unfinished-content/,
  );

  const unfinished = copy(example);
  unfinished.lessons[0].blocks[0].text = "TODO: write this later";
  assert.match(
    validateLearningPack(unfinished).errors.map((entry) => entry.code).join("\n"),
    /unfinished-content/,
  );

  const executable = copy(example);
  executable.flashcardDecks[0].cards[0].back = "<script>alert('no')</script>";
  assert.match(
    validateLearningPack(executable).errors.map((entry) => entry.code).join("\n"),
    /unsafe-content/,
  );
});

test("canonical package output is key-order independent and newline terminated", () => {
  const reordered = {
    flashcardDecks: example.flashcardDecks,
    lessons: example.lessons,
    sources: example.sources,
    objectives: example.objectives,
    package: example.package,
    schemaVersion: example.schemaVersion,
    format: example.format,
    extensions: example.extensions,
  };
  assert.equal(canonicalLearningPackJson(example), canonicalLearningPackJson(reordered));
  assert.ok(canonicalLearningPackJson(example).endsWith("\n"));

  const withExtension = copy(example);
  withExtension.extensions = { "org.example/order": { a: 1, Z: 2 } };
  const canonical = canonicalLearningPackJson(withExtension);
  const extensionStart = canonical.indexOf('"org.example/order"');
  assert.ok(canonical.indexOf('"Z"', extensionStart) < canonical.indexOf('"a"', extensionStart));
});

test("lesson-only and flash-card-only packs can pass the strict release gate", () => {
  const lessonOnly = copy(example);
  lessonOnly.flashcardDecks = [];
  const lessonValidation = validateLearningPack(lessonOnly);
  assert.equal(lessonValidation.valid, true);
  assert.deepEqual(lessonValidation.warnings, []);

  const cardsOnly = copy(example);
  cardsOnly.lessons = [];
  const cardValidation = validateLearningPack(cardsOnly);
  assert.equal(cardValidation.valid, true);
  assert.deepEqual(cardValidation.warnings, []);
});

test("lesson prerequisite cycles and unbounded extension data are rejected", () => {
  const cyclic = copy(example);
  cyclic.lessons[0].prerequisiteLessonIds = [cyclic.lessons[1].id];
  cyclic.lessons[1].prerequisiteLessonIds = [cyclic.lessons[0].id];
  assert.match(
    validateLearningPack(cyclic).errors.map((entry) => entry.code).join("\n"),
    /cyclic-prerequisite/,
  );

  const forwardPrerequisite = copy(example);
  forwardPrerequisite.lessons[0].prerequisiteLessonIds = [forwardPrerequisite.lessons[1].id];
  assert.match(
    validateLearningPack(forwardPrerequisite).errors.map((entry) => entry.code).join("\n"),
    /out-of-order-prerequisite/,
  );

  const nonJson = copy(example);
  nonJson.extensions = { "org.example/non-json": 1n };
  assert.match(
    validateLearningPack(nonJson).errors.map((entry) => entry.message).join("\n"),
    /JSON data only/,
  );

  const tooDeep = copy(example);
  let nested = { value: "leaf" };
  for (let index = 0; index < 10; index += 1) nested = { nested };
  tooDeep.extensions = { "org.example/deep": nested };
  assert.match(
    validateLearningPack(tooDeep).errors.map((entry) => entry.message).join("\n"),
    /nested more than 8 levels/,
  );
});

test("feeds require relative same-origin paths and publisher namespaces", () => {
  const packageJson = canonicalLearningPackJson(example);
  const valid = createLearningFeed(example, digest(packageJson), {
    bytes: Buffer.byteLength(packageJson),
  });
  assert.equal(learningFeedSchema.safeParse(valid).success, true);

  const absolute = copy(valid);
  absolute.packages[0].packageUrl = "https://other.example/package.json";
  assert.equal(learningFeedSchema.safeParse(absolute).success, false);

  const traversal = copy(valid);
  traversal.packages[0].packageUrl = "../private.json";
  assert.equal(learningFeedSchema.safeParse(traversal).success, false);

  const wrongPublisher = copy(valid);
  wrongPublisher.publisher.id = "someone-else";
  assert.equal(learningFeedSchema.safeParse(wrongPublisher).success, false);
});

test("standalone builds derive integrity, are deterministic, self-contained, and script-free from authored text", async () => {
  const safeMarkup = copy(example);
  safeMarkup.lessons[0].blocks[0].text = "The symbols <img src=x onerror=alert(1)> should remain visible text.";
  const packageJson = canonicalLearningPackJson(safeMarkup);
  const expectedDigest = digest(packageJson);
  const first = await buildStandaloneLearningSite(safeMarkup, {
    sha256: "0".repeat(64),
    packageBytes: 1,
  });
  const second = await buildStandaloneLearningSite(safeMarkup);
  assert.deepEqual(first, second);
  const feed = JSON.parse(first["learning-feed.json"]);
  const report = JSON.parse(first["build-report.json"]);
  assert.equal(feed.packages[0].sha256, expectedDigest);
  assert.equal(feed.packages[0].bytes, Buffer.byteLength(packageJson));
  assert.equal(report.sha256, expectedDigest);
  assert.equal(report.packageBytes, Buffer.byteLength(packageJson));
  assert.equal(report.learnerUiVersion, 1);
  assert.match(first["index.html"], /Content-Security-Policy/);
  assert.match(first["index.html"], /<body class="learner-ui"/);
  assert.match(first["index.html"], /class="learner-skip-link"/);
  assert.match(first["index.html"], /<main class="learner-content" id="content" tabindex="-1">/);
  assert.match(first["index.html"], /class="learner-header"/);
  assert.match(first["index.html"], /src="\.\/assets\/learner-ui\.js"/);
  assert.doesNotMatch(first["index.html"], /<img src=x onerror=/);
  assert.match(first["index.html"], /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(first["assets/player.css"], /--learner-font-sans:/);
  assert.match(first["assets/player.css"], /\.learner-ui :focus-visible/);
  assert.match(first["assets/learner-ui.js"], /event\.key !== "Escape"/);
  assert.match(first["assets/player.js"], /localStorage\.getItem\(storageKey\)/);
  assert.match(first["assets/player.js"], /focus\(\{ preventScroll: true \}\)/);
  assert.match(
    first["assets/player.js"],
    /querySelectorAll\("\.learning-view\[data-view\]"\)/,
  );
  assert.doesNotMatch(
    first["assets/player.js"],
    /querySelectorAll\("\[data-view\]"\)/,
  );
  assert.doesNotMatch(first["assets/player.js"], /\beval\s*\(|new Function|dangerouslySetInnerHTML/);
  assert.match(first["_headers"], /Access-Control-Allow-Origin: \*/);
  assert.match(first["_headers"], /Content-Security-Policy:/);
  assert.equal(Object.keys(first).includes("learning-feed.json"), true);
  assert.equal(Object.keys(first).includes("learning-pack.json"), true);
  assert.deepEqual(JSON.parse(first["build-report.json"]).files, Object.keys(first).sort());

  const nestedCitation = copy(example);
  nestedCitation.sources.push({
    id: "nested-only",
    kind: "specification",
    title: "A source cited only by a quiz",
    url: "https://example.com/nested-only",
    note: "Supports the quiz-specific claim in this regression fixture.",
  });
  const quiz = nestedCitation.lessons[0].blocks.find((block) => block.type === "quiz");
  quiz.sourceIds.push("nested-only");
  const nestedFiles = await buildStandaloneLearningSite(nestedCitation);
  assert.match(nestedFiles["index.html"], /A source cited only by a quiz/);
});

test("standalone Learning Pack UI configuration changes presentation without changing canonical content identity", async () => {
  const baseline = await buildStandaloneLearningSite(example);
  const configured = await buildStandaloneLearningSite(copy(example), {
    ui: {
      productName: "Interview <Loop>",
      navigationLabel: "Course navigation",
      modulesLabel: "Modules & lessons",
      reviewLabel: "Review cards",
      menuLabel: "Browse course",
      footerSummary: "Progress stays on this device.",
      attribution: "A quiet attribution.",
      theme: {
        accent: "#345ABC",
        focus: "#FEDCBA",
      },
    },
  });

  assert.match(configured["index.html"], /Interview &lt;Loop&gt;/);
  assert.doesNotMatch(configured["index.html"], /Interview <Loop>/);
  assert.match(configured["index.html"], /aria-label="Course navigation"/);
  assert.match(configured["index.html"], />Browse course<\/summary>/);
  assert.match(configured["index.html"], /Modules &amp; lessons/);
  assert.match(configured["index.html"], /Review cards/);
  assert.match(configured["index.html"], /Progress stays on this device\./);
  assert.match(configured["index.html"], /A quiet attribution\./);
  assert.match(configured["assets/player.css"], /--learner-color-accent: #345abc;/);
  assert.match(configured["assets/player.css"], /--learner-color-focus: #fedcba;/);
  assert.equal(
    configured["assets/learner-ui.js"],
    baseline["assets/learner-ui.js"],
  );
  assert.equal(configured["learning-pack.json"], baseline["learning-pack.json"]);
  assert.equal(configured["learning-feed.json"], baseline["learning-feed.json"]);
  assert.equal(
    JSON.parse(configured["build-report.json"]).sha256,
    JSON.parse(baseline["build-report.json"]).sha256,
  );
});

test("JSON parsing enforces the two-megabyte package limit", () => {
  const oversized = " ".repeat(2_000_001);
  const validation = parseLearningPackJson(oversized);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors[0].code, "file-too-large");

  const oversizedUtf8 = "é".repeat(1_000_001);
  const unicodeValidation = parseLearningPackJson(oversizedUtf8);
  assert.equal(unicodeValidation.valid, false);
  assert.equal(unicodeValidation.errors[0].code, "file-too-large");
});

test("the exported schema describes the public versioned format", () => {
  assert.equal(learningPackJsonSchema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.ok(JSON.stringify(learningPackJsonSchema).includes("latent-learning-pack"));
  assert.equal(
    learningPackJsonSchema.$id,
    "https://model-systems-labs.github.io/latent/open-learning/v1/learning-pack.schema.json",
  );
  assert.equal(learningFeedJsonSchema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.ok(JSON.stringify(learningFeedJsonSchema).includes("latent-learning-feed"));
  assert.equal(
    learningFeedJsonSchema.$id,
    "https://model-systems-labs.github.io/latent/open-learning/v1/learning-feed.schema.json",
  );
});
