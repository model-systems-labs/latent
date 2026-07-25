import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { Worker } from "node:worker_threads";

import {
  validateLearningPack,
  validateQuestionGroupLibrary,
} from "@latent/course-kit";
import {
  isLeechProgress,
  nextPracticeProgress,
  practiceProgressIdentity,
  progressMatchesIdentity,
} from "../examples/learning-platform/javascript-array-methods/site/progress.mjs";
import {
  assessCase,
} from "../examples/learning-platform/javascript-array-methods/site/checker.mjs";
import {
  HOST_RUNTIME_BOUNDS,
  admitRuntimeLimits,
} from "../examples/learning-platform/javascript-array-methods/site/runtime-policy.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const exampleRoot = join(
  repositoryRoot,
  "examples/learning-platform/javascript-array-methods",
);

function run(command, args, cwd, timeout = 20_000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout;
}

function runFailure(command, args, cwd, timeout = 20_000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
  });
  assert.notEqual(
    result.status,
    0,
    `${command} ${args.join(" ")} unexpectedly passed.\n${result.stdout}\n${result.stderr}`,
  );
  return `${result.stdout}\n${result.stderr}`;
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyExample(target) {
  await cp(exampleRoot, target, {
    recursive: true,
    filter(source) {
      return basename(source) !== "dist";
    },
  });
}

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

async function treeDigest(directory) {
  const digest = createHash("sha256");
  const paths = (await filesUnder(directory)).sort();
  for (const path of paths) {
    digest.update(relative(directory, path));
    digest.update("\0");
    digest.update(await readFile(path));
    digest.update("\0");
  }
  return digest.digest("hex");
}

test("tiny non-LLM example passes canonical validators with all four primitives", async () => {
  const learningPack = await json(join(exampleRoot, "content/learning-pack.json"));
  const questions = await json(join(exampleRoot, "content/question-groups.json"));
  const trusted = await import(`../examples/learning-platform/javascript-array-methods/trusted/ide-exercises.mjs?test=${Date.now()}`);

  const learningValidation = validateLearningPack(learningPack);
  assert.equal(learningValidation.valid, true);
  assert.deepEqual(learningValidation.warnings, []);
  assert.deepEqual(learningValidation.summary, {
    lessons: 1,
    quizzes: 1,
    flashcardDecks: 1,
    flashcards: 6,
    objectives: 2,
    sources: 4,
  });

  const questionValidation = validateQuestionGroupLibrary(questions);
  assert.equal(questionValidation.valid, true);
  assert.deepEqual(questionValidation.warnings, []);
  assert.deepEqual(questionValidation.summary, {
    groups: 1,
    questions: 1,
    cases: 3,
    exampleCases: 1,
    checkCases: 2,
  });
  assert.equal(trusted.ideExercises.length, 1);
  assert.equal(trusted.ideExercises[0].language, "javascript");
  assert.ok(trusted.ideExercises[0].checks.length >= 2);
});

test("the checked-in offline validator is generated deterministically from public Course Kit exports", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-validator-generate-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const generated = join(temporary, "course-kit-validator.mjs");
  run(process.execPath, [
    "scripts/generate-learning-platform-validator.mjs",
    "--out",
    generated,
  ], repositoryRoot);
  assert.deepEqual(
    await readFile(generated),
    await readFile(join(exampleRoot, "tools/vendor/course-kit-validator.mjs")),
  );
  run(process.execPath, [
    "scripts/generate-learning-platform-validator.mjs",
    "--check",
  ], repositoryRoot);
});

test("offline validation agrees with canonical Course Kit failures", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-validator-differential-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));

  const duplicateObjectiveProject = join(temporary, "duplicate-objective");
  await copyExample(duplicateObjectiveProject);
  const packPath = join(duplicateObjectiveProject, "content/learning-pack.json");
  const pack = await json(packPath);
  pack.objectives.push({ ...pack.objectives[0] });
  await writeJson(packPath, pack);
  const packCanonical = validateLearningPack(pack);
  assert.equal(packCanonical.valid, false);
  const packFailure = runFailure(process.execPath, ["tools/validate.mjs"], duplicateObjectiveProject);
  assert.match(packFailure, new RegExp(packCanonical.errors[0].code));

  const duplicateQuestionProject = join(temporary, "duplicate-question");
  await copyExample(duplicateQuestionProject);
  const questionsPath = join(duplicateQuestionProject, "content/question-groups.json");
  const questions = await json(questionsPath);
  questions.groups[0].questions.push({ ...questions.groups[0].questions[0] });
  await writeJson(questionsPath, questions);
  const questionCanonical = validateQuestionGroupLibrary(questions);
  assert.equal(questionCanonical.valid, false);
  const questionFailure = runFailure(process.execPath, ["tools/validate.mjs"], duplicateQuestionProject);
  assert.match(questionFailure, new RegExp(questionCanonical.errors[0].code));
});

test("the tiny player rejects path drift, unsupported multiplicity, and excessive runtime limits", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-player-contract-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));

  const pathProject = join(temporary, "path-drift");
  await copyExample(pathProject);
  const platformPath = join(pathProject, "platform.json");
  const platform = await json(platformPath);
  platform.content.learningPack = "content/renamed-learning-pack.json";
  await cp(
    join(pathProject, "content/learning-pack.json"),
    join(pathProject, platform.content.learningPack),
  );
  await writeJson(platformPath, platform);
  assert.match(
    runFailure(process.execPath, ["tools/validate.mjs"], pathProject),
    /reads exactly content\/learning-pack\.json/,
  );

  const multiplicityProject = join(temporary, "multiplicity");
  await copyExample(multiplicityProject);
  const packPath = join(multiplicityProject, "content/learning-pack.json");
  const pack = await json(packPath);
  pack.lessons.push({ ...pack.lessons[0], id: "second-lesson" });
  pack.flashcardDecks.push({ ...pack.flashcardDecks[0], id: "second-deck" });
  await writeJson(packPath, pack);
  await writeFile(
    join(multiplicityProject, "trusted/ide-exercises.mjs"),
    `${await readFile(join(multiplicityProject, "trusted/ide-exercises.mjs"), "utf8")}
ideExercises.push({ ...ideExercises[0], id: "second-ide" });
`,
    "utf8",
  );
  const multiplicityFailure = runFailure(
    process.execPath,
    ["tools/validate.mjs"],
    multiplicityProject,
  );
  assert.match(multiplicityFailure, /exactly one lesson/);
  assert.match(multiplicityFailure, /exactly one flash-card deck/);
  assert.match(multiplicityFailure, /exactly one trusted IDE exercise/);

  const filesProject = join(temporary, "ide-files");
  await copyExample(filesProject);
  await writeFile(
    join(filesProject, "trusted/ide-exercises.mjs"),
    `${await readFile(join(filesProject, "trusted/ide-exercises.mjs"), "utf8")}
ideExercises[0].files.push({ ...ideExercises[0].files[0], path: "extra.js" });
`,
    "utf8",
  );
  assert.match(
    runFailure(process.execPath, ["tools/validate.mjs"], filesProject),
    /exactly one source file/,
  );

  const runtimeProject = join(temporary, "runtime-limits");
  await copyExample(runtimeProject);
  const questionsPath = join(runtimeProject, "content/question-groups.json");
  const questions = await json(questionsPath);
  questions.runtimes[0].limits.timeoutMs = HOST_RUNTIME_BOUNDS.maximumTimeoutMs + 1;
  await writeJson(questionsPath, questions);
  assert.match(
    runFailure(process.execPath, ["tools/validate.mjs"], runtimeProject),
    /accepts timeoutMs/,
  );
});

test("trusted IDE validation rejects a duplicated second check", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-ide-duplicate-check-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const project = join(temporary, "duplicate-check");
  await copyExample(project);
  const exercisePath = join(project, "trusted/ide-exercises.mjs");
  await writeFile(
    exercisePath,
    `${await readFile(exercisePath, "utf8")}
ideExercises[0].checks.push({ ...ideExercises[0].checks[1] });
`,
    "utf8",
  );

  assert.match(
    runFailure(process.execPath, ["tools/validate.mjs"], project),
    /Duplicate check id: surrounding-space/,
  );
});

test("trusted IDE validation rejects every empty or malformed runtime and UI field", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-ide-malformed-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const project = join(temporary, "malformed-exercise");
  await copyExample(project);
  const exercisePath = join(project, "trusted/ide-exercises.mjs");
  await writeFile(
    exercisePath,
    `${await readFile(exercisePath, "utf8")}
ideExercises[0].id = "";
ideExercises[0].contractVersion = "";
ideExercises[0].title = "";
ideExercises[0].summary = " ";
ideExercises[0].language = "typescript";
ideExercises[0].files[0].path = "";
ideExercises[0].files[0].content = 42;
ideExercises[0].entrypoint.kind = "method";
ideExercises[0].entrypoint.functionName = "initials()";
ideExercises[0].checks[0].id = "";
ideExercises[0].checks[0].label = "";
ideExercises[0].checks[0].args = {};
ideExercises[0].checks[0].expected = undefined;
`,
    "utf8",
  );

  const failure = runFailure(process.execPath, ["tools/validate.mjs"], project);
  for (const expected of [
    "Exercise id must be a non-empty string.",
    "Contract version must be a non-empty string.",
    "Exercise title must be a non-empty string.",
    "Exercise summary must be a non-empty string.",
    "The dependency-free tiny player uses JavaScript.",
    "File path must be a non-empty string.",
    "File content must be a non-empty string.",
    "The tiny IDE expects a function entrypoint.",
    "Entrypoint functionName must be a JavaScript identifier.",
    "Check id must be a non-empty string.",
    "Check label must be a non-empty string.",
    "Check args must be a JSON-compatible array.",
    "Use a JSON-compatible value.",
  ]) {
    assert.match(failure, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("golden-path command creates and validates a branded platform without installing dependencies", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-platform-create-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const target = join(temporary, "field-school");
  const started = performance.now();
  const stdout = run(process.execPath, [
    "scripts/create-learning-platform.mjs",
    target,
    "--title",
    "Field Notes School",
    "--tagline",
    "Learn field observation by reading, recalling, and practicing one small skill.",
    "--accent",
    "#7dd3fc",
    "--json",
  ], repositoryRoot);
  const elapsed = performance.now() - started;
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.title, "Field Notes School");
  assert.equal(report.courseKitValidation.learningPack.ok, true);
  assert.equal(report.courseKitValidation.questionGroups.ok, true);
  assert.deepEqual(report.preview, {
    cwd: target,
    command: "npm run preview",
  });
  assert.deepEqual(report.primitives, [
    "lesson",
    "flash-card-deck",
    "question-group",
    "browser-ide-exercise",
  ]);
  assert.ok(elapsed < 30_000, `Scaffold took ${Math.round(elapsed)}ms`);
  assert.equal((await json(join(target, "platform.json"))).brand.name, "Field Notes School");
  assert.equal((await json(join(target, "package.json"))).name, "field-notes-school");
  await assert.rejects(stat(join(target, "node_modules")));
  await assert.rejects(stat(join(target, "dist")));

  run("npm", ["run", "build"], target);
  assert.match(await readFile(join(target, "dist/index.html"), "utf8"), /Field Notes School/);
  assert.equal((await json(join(target, "dist/content/learning-pack.json"))).format, "latent-learning-pack");
  assert.equal((await json(join(target, "dist/content/question-groups.json"))).format, "latent-question-group-library");
  assert.match(
    await readFile(join(target, ".github/workflows/deploy-pages.yml"), "utf8"),
    /path: dist/,
  );
  assert.equal(
    (await stat(target)).mode & 0o777,
    0o777 & ~process.umask(),
  );
});

test("golden path escapes hostile brand text and preserves an existing empty directory mode", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-platform-brand-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const target = join(temporary, "safe-school");
  await mkdir(target);
  await chmod(target, 0o750);
  const title = 'Study </title><meta http-equiv="refresh" content="x"> & "Lab"';
  const report = JSON.parse(run(process.execPath, [
    "scripts/create-learning-platform.mjs",
    target,
    "--title",
    title,
    "--tagline",
    "Practice one durable skill without allowing brand text to become executable markup.",
    "--json",
  ], repositoryRoot));

  assert.equal(report.title, title);
  assert.equal((await stat(target)).mode & 0o777, 0o750);
  assert.equal((await json(join(target, "platform.json"))).brand.name, title);
  const html = await readFile(join(target, "site/index.html"), "utf8");
  assert.match(html, /&lt;\/title&gt;&lt;meta http-equiv=&quot;refresh&quot;/);
  assert.doesNotMatch(html, /<meta http-equiv="refresh"/i);
});

test("tiny platform build is deterministic and its exact artifact previews over loopback", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-platform-build-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const project = join(temporary, "platform");
  await cp(exampleRoot, project, {
    recursive: true,
    filter(source) {
      return basename(source) !== "dist";
    },
  });

  run("npm", ["run", "build"], project);
  const first = await treeDigest(join(project, "dist"));
  run("npm", ["run", "build"], project);
  assert.equal(await treeDigest(join(project, "dist")), first);

  const child = spawn(process.execPath, ["tools/serve.mjs", "dist", "--port", "0"], {
    cwd: project,
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });
  const previewUrl = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error("Preview did not start.")), 5_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      const match = chunk.match(/Preview: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (!match) return;
      clearTimeout(timer);
      resolveUrl(match[1]);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Preview exited with ${code}.`));
    });
  });

  const [page, packResponse, questionResponse] = await Promise.all([
    fetch(previewUrl),
    fetch(new URL("content/learning-pack.json", previewUrl)),
    fetch(new URL("content/question-groups.json", previewUrl)),
  ]);
  assert.equal(page.status, 200);
  assert.equal(packResponse.status, 200);
  assert.equal(questionResponse.status, 200);
  assert.match(await page.text(), /Array Method School/);
  assert.equal((await packResponse.json()).format, "latent-learning-pack");
  assert.equal((await questionResponse.json()).format, "latent-question-group-library");

  const outside = join(temporary, "outside.txt");
  await writeFile(outside, "must stay outside the preview root", "utf8");
  await symlink(outside, join(project, "dist/escape.txt"));
  const escaped = await fetch(new URL("escape.txt", previewUrl));
  assert.equal(escaped.status, 404);
  assert.doesNotMatch(await escaped.text(), /must stay outside/);

  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("exit", resolveExit));
});

test("practice progress is provenance-bound and leeches are a progress query", async () => {
  const library = await json(join(exampleRoot, "content/question-groups.json"));
  const question = {
    ...library.groups[0].questions[0],
    groupId: library.groups[0].id,
  };
  const libraryDigest = "a".repeat(64);
  const identity = practiceProgressIdentity(library, libraryDigest, question);
  assert.deepEqual(identity, {
    libraryId: library.library.id,
    libraryVersion: library.library.version,
    libraryDigest,
    groupId: library.groups[0].id,
    questionId: question.id,
    contractVersion: [
      `question-groups-v${library.schemaVersion}`,
      `${library.library.id}@${library.library.version}`,
      `sha256:${libraryDigest}`,
      `${library.groups[0].id}/${question.id}`,
    ].join(":"),
  });

  let progress = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    progress = nextPracticeProgress(identity, progress, {
      sourceDigest: String(attempt).repeat(64),
      passed: false,
      attemptedAt: attempt,
    });
  }
  assert.equal(progress.status, "attempted");
  assert.equal(progress.attemptCount, 3);
  assert.equal(progress.failureCount, 3);
  assert.equal(isLeechProgress(progress), true);
  assert.equal(progressMatchesIdentity(progress, identity), true);
  assert.equal(
    progressMatchesIdentity(progress, { ...identity, libraryDigest: "b".repeat(64) }),
    false,
  );

  const solved = nextPracticeProgress(identity, progress, {
    sourceDigest: "f".repeat(64),
    passed: true,
    attemptedAt: 4,
  });
  assert.equal(solved.status, "solved");
  assert.equal(isLeechProgress(solved), false);
});

test("runtime admission enforces the portable host envelope", () => {
  assert.deepEqual(admitRuntimeLimits({
    timeoutMs: HOST_RUNTIME_BOUNDS.minimumTimeoutMs,
    maxOutputBytes: HOST_RUNTIME_BOUNDS.minimumOutputBytes,
  }), {
    timeoutMs: HOST_RUNTIME_BOUNDS.minimumTimeoutMs,
    maxOutputBytes: HOST_RUNTIME_BOUNDS.minimumOutputBytes,
  });
  assert.throws(
    () => admitRuntimeLimits({
      timeoutMs: HOST_RUNTIME_BOUNDS.maximumTimeoutMs + 1,
      maxOutputBytes: HOST_RUNTIME_BOUNDS.minimumOutputBytes,
    }),
    /accepts timeoutMs/,
  );
  assert.throws(
    () => admitRuntimeLimits({
      timeoutMs: HOST_RUNTIME_BOUNDS.minimumTimeoutMs,
      maxOutputBytes: HOST_RUNTIME_BOUNDS.maximumOutputBytes + 1,
    }),
    /accepts maxOutputBytes/,
  );
});

test("learner code cannot forge a passing result by mutating worker globals", async (context) => {
  const executorUrl = new URL(
    "../examples/learning-platform/javascript-array-methods/site/executor.worker.mjs",
    import.meta.url,
  ).href;
  const bootstrap = `
    import { parentPort } from "node:worker_threads";
    globalThis.postMessage = (value) => parentPort.postMessage(value);
    globalThis.addEventListener = (type, listener) => {
      if (type === "message") parentPort.on("message", (data) => listener({ data }));
    };
    await import(${JSON.stringify(executorUrl)});
    parentPort.postMessage({ bootstrapReady: true });
  `;
  const worker = new Worker(
    new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`),
    { type: "module" },
  );
  context.after(() => worker.terminate());
  const nonce = "host-owned-nonce";
  let sawForgedMessage = false;
  const execution = await new Promise((resolveExecution, reject) => {
    const timer = setTimeout(() => reject(new Error("Executor worker timed out.")), 5_000);
    worker.on("error", reject);
    worker.on("message", (message) => {
      if (message?.bootstrapReady) {
        worker.postMessage({
          nonce,
          source: `
            globalThis.postMessage({
              nonce: "forged",
              ok: true,
              value: ["EXPECTED"],
            });
            globalThis.postMessage = () => {};
            Object.is = () => true;
            globalThis.structuredClone = () => ["EXPECTED"];
            function solve() {
              return ["WRONG"];
            }
          `,
          entrypoint: { kind: "function", functionName: "solve" },
          args: [],
        });
        return;
      }
      if (message?.nonce === "forged") {
        sawForgedMessage = true;
        return;
      }
      if (message?.nonce !== nonce) return;
      clearTimeout(timer);
      resolveExecution(message);
    });
  });

  assert.equal(sawForgedMessage, true);
  assert.equal(execution.ok, true);
  assert.deepEqual(execution.value, ["WRONG"]);
  const assessed = assessCase({
    id: "host-case",
    label: "host-owned expected value",
    assertions: [{
      id: "host-assertion",
      label: "matches",
      kind: "deep-equal",
      expected: ["EXPECTED"],
    }],
  }, execution.value);
  assert.equal(assessed.passed, false);

  const identity = {
    libraryId: "security/course",
    libraryVersion: "1.0.0",
    libraryDigest: "a".repeat(64),
    groupId: "security",
    questionId: "forgery",
    contractVersion: "security-v1",
  };
  const persisted = nextPracticeProgress(identity, null, {
    sourceDigest: "b".repeat(64),
    passed: assessed.passed,
    attemptedAt: 1,
  });
  assert.equal(persisted.status, "attempted");
  assert.notEqual(persisted.status, "solved");
});

test("one command can scaffold, validate, build, and start the branded preview", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "latent-platform-preview-"));
  context.after(() => rm(temporary, { force: true, recursive: true }));
  const target = join(temporary, "preview-school");
  const child = spawn(process.execPath, [
    "scripts/create-learning-platform.mjs",
    target,
    "--title",
    "Preview School",
    "--tagline",
    "Learn a small JavaScript idea through four connected kinds of practice.",
    "--preview",
    "--port",
    "0",
  ], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });
  const previewUrl = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error("Golden-path preview did not start.")), 8_000);
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Preview: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (!match) return;
      clearTimeout(timer);
      resolveUrl(match[1]);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Golden path exited with ${code}.\n${output}`));
    });
  });
  const response = await fetch(previewUrl);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Preview School/);
  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("exit", resolveExit));
});

test("starter workflow validates before deploying only the static artifact", async () => {
  const workflow = await readFile(
    join(exampleRoot, ".github/workflows/deploy-pages.yml"),
    "utf8",
  );
  assert.match(workflow, /node-version: 22\.13\.0/);
  assert.ok(workflow.indexOf("run: npm run validate") < workflow.indexOf("run: npm run build"));
  assert.match(workflow, /actions\/upload-pages-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /actions\/deploy-pages@[0-9a-f]{40}/);

  const app = await readFile(join(exampleRoot, "site/app.mjs"), "utf8");
  assert.match(app, /leechesOnly/);
  assert.match(app, /isLeechProgress/);
  assert.match(app, /quiz-progress/);
  assert.match(app, /ide-result:/);
  assert.match(app, /sourceDigest === await sha256Hex\(ideSource\)/);
  assert.match(app, /new Worker\("\.\/runner\.worker\.mjs"/);
});

test("all platform workflows declare their editable layer and validation", async () => {
  const workflows = [
    "author-learning-platform",
    "author-course",
    "author-ide-exercise",
    "author-flash-card-deck",
    "author-question-group",
    "review-learning-design",
    "publish-learning-platform",
  ];
  for (const name of workflows) {
    const skill = await readFile(join(repositoryRoot, "skills", name, "SKILL.md"), "utf8");
    const agent = await readFile(join(repositoryRoot, "skills", name, "agents/openai.yaml"), "utf8");
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`, "m"));
    assert.match(skill, /layer/i);
    assert.match(skill, /validat/i);
    assert.match(agent, new RegExp(`\\$${name}`));
  }
});
