import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  COURSE_KIT_VALIDATOR_VERSION,
  validateLearningPack,
  validateQuestionGroupLibrary,
} from "./vendor/course-kit-validator.mjs";
import { learningPackProgressIdentity } from "../site/progress.mjs";
import { admitRuntimeLimits } from "../site/runtime-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const issues = [];
const expectedPaths = Object.freeze({
  learningPack: "content/learning-pack.json",
  questionGroups: "content/question-groups.json",
  ideExercises: "trusted/ide-exercises.mjs",
});
const expectedModuleIds = Object.freeze([
  "behavioral-evidence",
  "coding-under-constraints",
  "architecture-webhook-delivery",
]);
const expectedPythonRuntime = Object.freeze({
  language: "python",
  environment: "host-managed",
  engine: "pyodide",
  engineVersion: "314.0.2",
});

function fail(path, message) {
  issues.push({ path, message });
}

function expect(condition, path, message) {
  if (!condition) fail(path, message);
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateJsonValue(value, path, ancestors = new Set()) {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) return;
  if (typeof value === "number") {
    expect(Number.isFinite(value), path, "Use a finite JSON number.");
    return;
  }
  if (typeof value !== "object") {
    fail(path, "Use a JSON-compatible value.");
    return;
  }
  if (ancestors.has(value)) {
    fail(path, "JSON-compatible values may not contain cycles.");
    return;
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      validateJsonValue(entry, `${path}.${index}`, ancestors);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(path, "Use a plain JSON object.");
    } else {
      for (const [key, entry] of Object.entries(value)) {
        validateJsonValue(entry, `${path}.${key}`, ancestors);
      }
      if (Object.getOwnPropertySymbols(value).length) {
        fail(path, "JSON-compatible objects may not use symbol keys.");
      }
    }
  }
  ancestors.delete(value);
}

function validateUniqueNonemptyId(value, path, label, seen) {
  if (!nonempty(value)) {
    fail(path, `${label} must be a non-empty string.`);
    return;
  }
  if (seen.has(value)) {
    fail(path, `Duplicate ${label.toLowerCase()}: ${value}`);
    return;
  }
  seen.add(value);
}

async function readJson(projectPath) {
  try {
    return JSON.parse(await readFile(join(root, projectPath), "utf8"));
  } catch (error) {
    fail(projectPath, error instanceof Error ? error.message : "Could not parse JSON.");
    return null;
  }
}

async function safeProjectFile(projectPath, label) {
  const output = resolve(root, projectPath);
  if (output !== root && !output.startsWith(`${root}${sep}`)) {
    fail(label, "Path escapes the platform directory.");
    return null;
  }
  try {
    const stats = await lstat(output);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      fail(label, "Expected a regular file, not a directory or symlink.");
      return null;
    }
    const canonical = await realpath(output);
    if (canonical !== root && !canonical.startsWith(`${root}${sep}`)) {
      fail(label, "Resolved path escapes the platform directory.");
      return null;
    }
    return output;
  } catch {
    fail(label, `Missing file: ${projectPath}`);
    return null;
  }
}

function reportCanonical(prefix, validation) {
  for (const problem of validation.errors ?? []) {
    fail(`${prefix}.${problem.path}`, `[${problem.code}] ${problem.message}`);
  }
  for (const warning of validation.warnings ?? []) {
    fail(`${prefix}.${warning.path}`, `[strict:${warning.code}] ${warning.message}`);
  }
}

function validateTinyQuestionPlayer(library) {
  const runtimeById = new Map((library?.runtimes ?? []).map((runtime) => [runtime.id, runtime]));
  for (const [groupIndex, group] of (library?.groups ?? []).entries()) {
    for (const [questionIndex, question] of (group.questions ?? []).entries()) {
      const path = `content.questionGroups.groups.${groupIndex}.questions.${questionIndex}`;
      expect(
        question.language === "python",
        `${path}.language`,
        "Interview Loop Lab supports Python questions only.",
      );
      expect(
        typeof question.path === "string" && /^[A-Za-z0-9_-]+\.py$/.test(question.path),
        `${path}.path`,
        "Every learner source file must be a local .py file.",
      );
      expect(
        question.entrypoint?.kind === "function",
        `${path}.entrypoint`,
        "The dependency-free tiny player supports function entrypoints only.",
      );
      for (const [caseIndex, exerciseCase] of (question.cases ?? []).entries()) {
        expect(
          Array.isArray(exerciseCase.assertions)
            && exerciseCase.assertions.every((assertion) => assertion.kind === "deep-equal"),
          `${path}.cases.${caseIndex}.assertions`,
          "The dependency-free tiny player supports deep-equal assertions only.",
        );
      }
      const runtime = runtimeById.get(question.runtimeId);
      if (!runtime) continue;
      expect(
        runtime.language === expectedPythonRuntime.language
          && runtime.environment === expectedPythonRuntime.environment
          && runtime.engine === expectedPythonRuntime.engine
          && runtime.engineVersion === expectedPythonRuntime.engineVersion
          && runtime.capabilities?.includes("function"),
        `${path}.runtimeId`,
        "The player admits only its pinned host-managed Python runtime.",
      );
      try {
        admitRuntimeLimits(runtime.limits);
      } catch (error) {
        fail(
          `content.questionGroups.runtimes.${question.runtimeId}.limits`,
          error instanceof Error ? error.message : "Runtime limits exceed host policy.",
        );
      }
    }
  }
}

function validateIdeExercises(exercises) {
  if (!Array.isArray(exercises)) {
    fail("hostOwned.ideExercises", "Export ideExercises as an array.");
    return;
  }
  expect(
    exercises.length === 1,
    "hostOwned.ideExercises",
    "The tiny player intentionally renders exactly one trusted IDE exercise.",
  );
  const exerciseIds = new Set();
  for (const [exerciseIndex, exercise] of exercises.entries()) {
    const path = `hostOwned.ideExercises.${exerciseIndex}`;
    if (!isRecord(exercise)) {
      fail(path, "Every trusted IDE exercise must be an object.");
      continue;
    }
    validateUniqueNonemptyId(exercise.id, `${path}.id`, "Exercise id", exerciseIds);
    expect(
      nonempty(exercise.contractVersion),
      `${path}.contractVersion`,
      "Contract version must be a non-empty string.",
    );
    expect(nonempty(exercise.title), `${path}.title`, "Exercise title must be a non-empty string.");
    expect(
      nonempty(exercise.summary),
      `${path}.summary`,
      "Exercise summary must be a non-empty string.",
    );
    expect(
      exercise.language === "python",
      `${path}.language`,
      "The trusted coding lab uses Python.",
    );
    expect(
      isRecord(exercise.runtime)
        && exercise.runtime.language === expectedPythonRuntime.language
        && exercise.runtime.environment === expectedPythonRuntime.environment
        && exercise.runtime.engine === expectedPythonRuntime.engine
        && exercise.runtime.engineVersion === expectedPythonRuntime.engineVersion
        && exercise.runtime.capabilities?.includes("function"),
      `${path}.runtime`,
      "The trusted coding lab must declare the pinned host-managed Python runtime.",
    );

    if (!Array.isArray(exercise.files)) {
      fail(`${path}.files`, "Exercise files must be an array.");
    } else {
      expect(
        exercise.files.length === 1,
        `${path}.files`,
        "The tiny IDE intentionally renders exactly one source file.",
      );
      const filePaths = new Set();
      for (const [fileIndex, file] of exercise.files.entries()) {
        const filePath = `${path}.files.${fileIndex}`;
        if (!isRecord(file)) {
          fail(filePath, "Every IDE source file must be an object.");
          continue;
        }
        validateUniqueNonemptyId(
          file.path,
          `${filePath}.path`,
          "File path",
          filePaths,
        );
        expect(
          nonempty(file.content),
          `${filePath}.content`,
          "File content must be a non-empty string.",
        );
        expect(
          typeof file.path === "string" && /^[A-Za-z0-9_-]+\.py$/.test(file.path),
          `${filePath}.path`,
          "The trusted coding lab source must be a local .py file.",
        );
      }
    }

    if (!isRecord(exercise.entrypoint)) {
      fail(`${path}.entrypoint`, "The tiny IDE expects a function entrypoint object.");
    } else {
      expect(
        exercise.entrypoint.kind === "function",
        `${path}.entrypoint.kind`,
        "The tiny IDE expects a function entrypoint.",
      );
      expect(
        typeof exercise.entrypoint.functionName === "string"
          && /^[A-Za-z_][A-Za-z0-9_]*$/.test(exercise.entrypoint.functionName),
        `${path}.entrypoint.functionName`,
        "Entrypoint functionName must be a Python identifier.",
      );
    }

    if (!Array.isArray(exercise.checks)) {
      fail(`${path}.checks`, "Exercise checks must be an array.");
    } else {
      expect(
        exercise.checks.length >= 2,
        `${path}.checks`,
        "Add at least two deterministic host-owned checks.",
      );
      const checkIds = new Set();
      for (const [checkIndex, check] of exercise.checks.entries()) {
        const checkPath = `${path}.checks.${checkIndex}`;
        if (!isRecord(check)) {
          fail(checkPath, "Every IDE check must be an object.");
          continue;
        }
        validateUniqueNonemptyId(check.id, `${checkPath}.id`, "Check id", checkIds);
        expect(
          nonempty(check.label),
          `${checkPath}.label`,
          "Check label must be a non-empty string.",
        );
        if (!Array.isArray(check.args)) {
          fail(`${checkPath}.args`, "Check args must be a JSON-compatible array.");
        } else {
          validateJsonValue(check.args, `${checkPath}.args`);
        }
        if (!Object.hasOwn(check, "expected")) {
          fail(`${checkPath}.expected`, "Every IDE check must declare an expected value.");
        } else {
          validateJsonValue(check.expected, `${checkPath}.expected`);
        }
      }
    }

    try {
      admitRuntimeLimits(exercise.runtime?.limits);
    } catch (error) {
      fail(
        `${path}.limits`,
        error instanceof Error ? error.message : "IDE limits exceed host policy.",
      );
    }
  }
}

const platform = await readJson("platform.json");
expect(platform?.schemaVersion === 1, "platform.schemaVersion", "Expected schema version 1.");
expect(nonempty(platform?.brand?.name), "platform.brand.name", "Add a platform name.");
expect(nonempty(platform?.brand?.tagline), "platform.brand.tagline", "Add a platform promise.");
expect(
  /^#[0-9a-f]{6}$/i.test(platform?.brand?.accent ?? ""),
  "platform.brand.accent",
  "Use a six-digit hex accent.",
);
expect(
  platform?.content?.learningPack === expectedPaths.learningPack,
  "platform.content.learningPack",
  `The tiny player reads exactly ${expectedPaths.learningPack}.`,
);
expect(
  platform?.content?.questionGroups === expectedPaths.questionGroups,
  "platform.content.questionGroups",
  `The tiny player reads exactly ${expectedPaths.questionGroups}.`,
);
expect(
  platform?.hostOwned?.ideExercises === expectedPaths.ideExercises,
  "platform.hostOwned.ideExercises",
  `The tiny player imports exactly ${expectedPaths.ideExercises}.`,
);

await Promise.all([
  ...Object.values(expectedPaths).map((path) => safeProjectFile(path, path)),
  "README.md",
  "GUIDE.md",
  "LICENSE",
  "NOTICE.md",
  "CONTENT_LICENSE.md",
  "site/index.html",
  "site/styles.css",
  "site/app.mjs",
  "site/checker.mjs",
  "site/runtime-policy.mjs",
  "site/progress.mjs",
  "test/python-runtime.test.mjs",
  "test/reference-solutions.test.mjs",
  "test/learning-state.test.mjs",
  "tools/build.mjs",
  "tools/vendor/course-kit-validator.mjs",
  "trusted/python-exercise-runtime.ts",
].map((path) => typeof path === "string" ? safeProjectFile(path, path) : path));

const learningPack = await readJson(expectedPaths.learningPack);
const questionGroups = await readJson(expectedPaths.questionGroups);
const learningPackSource = await readFile(join(root, expectedPaths.learningPack), "utf8");
const learningPackDigest = createHash("sha256").update(learningPackSource, "utf8").digest("hex");
const learningValidation = validateLearningPack(learningPack);
const questionValidation = validateQuestionGroupLibrary(questionGroups);
reportCanonical("content.learningPack", learningValidation);
reportCanonical("content.questionGroups", questionValidation);

expect(
  learningValidation.valid && learningValidation.pack.lessons.length === expectedModuleIds.length,
  "content.learningPack.lessons",
  "The course player requires exactly three navigable modules.",
);
if (learningValidation.valid) {
  const lessons = [...learningValidation.pack.lessons].sort((left, right) => left.order - right.order);
  const progressIdentity = learningPackProgressIdentity(
    learningValidation.pack,
    learningPackDigest,
  );
  expect(
    progressIdentity.packageDigest === learningPackDigest
      && progressIdentity.namespace.endsWith(`sha256:${learningPackDigest}`),
    "site.progress.learningPackIdentity",
    "Learning Pack progress must be namespaced by the exact source digest.",
  );
  expect(
    lessons.every((lesson, index) => lesson.id === expectedModuleIds[index]),
    "content.learningPack.lessons",
    `Expected the module sequence ${expectedModuleIds.join(" → ")}.`,
  );
  for (const [index, lesson] of lessons.entries()) {
    expect(
      lesson.blocks.some((block) => block.type === "quiz"),
      `content.learningPack.lessons.${index}.blocks`,
      "Every navigable module must include at least one deterministic knowledge check.",
    );
    const expectedPrerequisites = index === 0 ? [] : [lessons[index - 1].id];
    expect(
      JSON.stringify(lesson.prerequisiteLessonIds ?? []) === JSON.stringify(expectedPrerequisites),
      `content.learningPack.lessons.${index}.prerequisiteLessonIds`,
      index === 0
        ? "The first module must not declare a prerequisite."
        : `Expected the preceding module ${lessons[index - 1].id} as the sole prerequisite.`,
    );
  }
  expect(
    lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0) === 58,
    "content.learningPack.lessons.durationMinutes",
    "The three modules must total 58 minutes.",
  );
  expect(
    lessons.flatMap((lesson) => lesson.blocks).filter((block) => block.type === "quiz").length === 6,
    "content.learningPack.lessons.blocks",
    "The three modules must contain exactly six knowledge checks.",
  );
  expect(
    lessons[2].summary.includes("24-minute module")
      && lessons[2].summary.includes("separate 45-minute"),
    "content.learningPack.lessons.2.summary",
    "Architecture timing must distinguish the 24-minute module from its separate 45-minute take-away mock.",
  );
  const codingExamples = lessons[1].blocks.filter((block) => block.type === "code");
  expect(
    codingExamples.some((block) => (
      block.language === "python"
      && /^def [a-z_][a-z0-9_]*\(/.test(block.code)
    )),
    "content.learningPack.lessons.1.blocks",
    "The learner-visible coding example must use Python.",
  );
}
expect(
  learningValidation.valid && learningValidation.pack.flashcardDecks.length === 1,
  "content.learningPack.flashcardDecks",
  "The tiny player intentionally renders exactly one flash-card deck.",
);
if (questionValidation.valid) {
  validateTinyQuestionPlayer(questionValidation.library);
  const questions = questionValidation.library.groups.flatMap((group) => group.questions);
  for (const [index, question] of questions.entries()) {
    expect(
      question.prompt.startsWith(`Step ${index + 1} of 4.`),
      `content.questionGroups.questions.${index}.prompt`,
      `Expected coding ladder label "Step ${index + 1} of 4."`,
    );
  }
}

const idePath = resolve(root, expectedPaths.ideExercises);
try {
  const loadedModule = await import(`${pathToFileURL(idePath).href}?validate=${Date.now()}`);
  validateIdeExercises(loadedModule.ideExercises);
  const learnerFacingIde = JSON.stringify(loadedModule.ideExercises);
  expect(
    !/javascript|ecmascript|\.js"/i.test(learnerFacingIde),
    "hostOwned.ideExercises",
    "The learner-visible coding lab must not retain JavaScript source or labels.",
  );
} catch (error) {
  fail(
    "hostOwned.ideExercises",
    error instanceof Error ? error.message : "Could not import trusted IDE exercises.",
  );
}

const portableSource = JSON.stringify({ learningPack, questionGroups }).toLowerCase();
expect(
  !portableSource.includes("\"language\":\"javascript\"")
    && !portableSource.includes("ecmascript")
    && !portableSource.includes(".js\""),
  "content",
  "Portable learner content must not retain JavaScript source or labels.",
);
for (const marker of ["<script", "javascript:", "data:text/html", "importscripts("]) {
  expect(
    !portableSource.includes(marker),
    "content",
    `Portable content contains forbidden executable marker "${marker}".`,
  );
}

if (issues.length) {
  console.error(JSON.stringify({
    ok: false,
    courseKitValidatorVersion: COURSE_KIT_VALIDATOR_VERSION,
    issues,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    courseKitValidatorVersion: COURSE_KIT_VALIDATOR_VERSION,
    platform: platform.brand.name,
    lessons: learningValidation.pack.lessons.length,
    flashcardDecks: 1,
    cards: learningValidation.summary.flashcards,
    questionGroups: questionValidation.summary.groups,
    practiceQuestions: questionValidation.summary.questions,
    ideExercises: 1,
  }, null, 2));
}
