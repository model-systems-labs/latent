import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
let adapter;
let content;
let courseKit;
let progressContract;
let runner;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [adapter, content, courseKit, progressContract, runner] = await Promise.all([
    vite.ssrLoadModule("/app/features/practice/question-adapter.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/practice/question-library.ts"),
    vite.ssrLoadModule("/packages/course-kit/src/question-group.ts"),
    vite.ssrLoadModule("/packages/course-kit/src/question-progress.ts"),
    vite.ssrLoadModule("/app/features/practice/question-runner.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("the first-party method library is a valid portable question-group primitive", () => {
  const validation = courseKit.validateQuestionGroupLibrary(content.methodQuestionLibrary);
  assert.equal(validation.valid, true, validation.errors?.map((issue) => issue.message).join("\n"));
  assert.deepEqual(validation.summary, {
    groups: 2,
    questions: 6,
    cases: 24,
    exampleCases: 12,
    checkCases: 12,
  });
  assert.equal(content.methodQuestions.length, 6);
  assert.equal(new Set(content.methodQuestions.map((question) => question.id)).size, 6);
});

test("the published and packaged question-group contracts match Course Kit", async () => {
  const expected = `${JSON.stringify(courseKit.questionGroupLibraryJsonSchema, null, 2)}\n`;
  const expectedProgress = `${JSON.stringify(progressContract.questionGroupProgressJsonSchema, null, 2)}\n`;
  const [
    published,
    packaged,
    publishedProgress,
    packagedProgress,
    publicGuide,
    packageGuide,
    sourceGuide,
  ] = await Promise.all([
    readFile(new URL("public/question-groups/v1/question-group-library.schema.json", root), "utf8"),
    readFile(new URL("packages/course-kit/schema/question-group-library.schema.json", root), "utf8"),
    readFile(new URL("public/question-groups/v1/question-group-progress.schema.json", root), "utf8"),
    readFile(new URL("packages/course-kit/schema/question-group-progress.schema.json", root), "utf8"),
    readFile(new URL("public/question-groups/guide.md", root), "utf8"),
    readFile(new URL("packages/course-kit/docs/question-groups.md", root), "utf8"),
    readFile(new URL("docs/question-groups.md", root), "utf8"),
  ]);
  assert.equal(published, expected);
  assert.equal(packaged, expected);
  assert.equal(publishedProgress, expectedProgress);
  assert.equal(packagedProgress, expectedProgress);
  assert.equal(
    publicGuide,
    sourceGuide
      .replace(
        "../packages/course-kit/schema/question-group-library.schema.json",
        "./v1/question-group-library.schema.json",
      )
      .replace(
        "../packages/course-kit/schema/question-group-progress.schema.json",
        "./v1/question-group-progress.schema.json",
      ),
  );
  assert.equal(
    packageGuide,
    sourceGuide
      .replace(
        "../packages/course-kit/schema/question-group-library.schema.json",
        "../schema/question-group-library.schema.json",
      )
      .replace(
        "../packages/course-kit/schema/question-group-progress.schema.json",
        "../schema/question-group-progress.schema.json",
      ),
  );
});

test("every shipped problem uses a real class method and data-only host checks", () => {
  for (const question of content.methodQuestions) {
    assert.equal(question.entrypoint.kind, "class-method");
    assert.match(question.starterCode, new RegExp(`class\\s+${question.entrypoint.className}\\b`));
    assert.match(question.starterCode, new RegExp(`${question.entrypoint.methodName}\\s*\\(`));
    assert.doesNotMatch(`${question.title}\n${question.prompt}`, /leetcode/i);

    const adapted = adapter.adaptPracticeQuestion(question, question.starterCode, {
      contractId: `${question.groupId}/${question.id}`,
    });
    assert.equal(adapted.contract.cases.length, question.cases.length);
    assert.ok(adapted.contract.cases.every((exerciseCase) => (
      exerciseCase.invoke.exportName === adapted.exportName
      && exerciseCase.invoke.modulePath === question.path
      && exerciseCase.assertions.length > 0
    )));
    assert.match(adapted.source, /new Solution\(\.\.\.__latent_constructor_args\)/);
    assert.doesNotMatch(JSON.stringify(adapted.contract), /checkCode|starterCode|function\s*\(/);
  }
});

test("example and full runs have stable source-bound contract versions", () => {
  const question = content.methodQuestions[0];
  const version = runner.contractVersionForMethodQuestion(
    content.methodQuestionLibrary.library.version,
    question,
  );
  assert.equal(version, "question-groups-v1:1.0.0:unique-values:1");
  assert.equal(
    runner.contractVersionForMethodQuestion(content.methodQuestionLibrary.library.version, question),
    version,
  );
});

test("the practice route reuses the shared editor and independent progress layer", async () => {
  const [page, leechPage, workbench, editor] = await Promise.all([
    readFile(new URL("app/practice/page.tsx", root), "utf8"),
    readFile(new URL("app/practice/leeches/page.tsx", root), "utf8"),
    readFile(new URL("app/practice/PracticeWorkbench.tsx", root), "utf8"),
    readFile(new URL("app/features/ide/CodeEditor.tsx", root), "utf8"),
  ]);
  assert.match(page, /<PracticeWorkbench \/>/);
  assert.match(workbench, /<CodeEditor/);
  assert.match(workbench, /runMethodQuestion/);
  assert.match(workbench, /subscribeQuestionLibraryProgress/);
  assert.match(workbench, /applyQuestionDraftMutation/);
  assert.match(workbench, /applyQuestionAttemptMutation/);
  assert.match(workbench, /applyQuestionResetMutation/);
  assert.match(workbench, /isLeechQuestionProgress/);
  assert.match(workbench, /initialProgressQuery === "leeches"/);
  assert.match(workbench, /openQuestion\(firstVisibleQuestion\)/);
  assert.match(workbench, /initialProgressQuery === "leeches" && !isLeech\(activeQuestion\)/);
  assert.match(workbench, /storageUnavailableRef/);
  assert.match(leechPage, /<PracticeWorkbench initialProgressQuery="leeches" \/>/);
  assert.match(leechPage, /no separate leech content is created/i);
  assert.doesNotMatch(workbench, /PaperLab|project-workspace|learner-state/);
  assert.match(editor, /const hasRunHandler = Boolean\(onRun\)/);
  assert.match(editor, /\.\.\.\(hasRunHandler \? \[\{[\s\S]*?key:\s*"Mod-Enter"[\s\S]*?preventDefault:\s*true/);
  assert.match(editor, /\[ariaLabel, hasRunHandler,/);
  assert.doesNotMatch(editor, /if \(!runRef\.current\) return false/);
});

test("the mobile workspace exposes honest Question, Code, and Results views", async () => {
  const [workbench, css] = await Promise.all([
    readFile(new URL("app/practice/PracticeWorkbench.tsx", root), "utf8"),
    readFile(new URL("app/practice/PracticeWorkbench.module.css", root), "utf8"),
  ]);
  assert.match(workbench, /\["question", "code", "results"\]/);
  assert.match(workbench, /aria-pressed=\{mobileView === view\}/);
  assert.match(workbench, /focusMobileView\("results"\)/);
  assert.match(workbench, /ref=\{resultsRef\}/);
  assert.match(workbench, /tabIndex=\{-1\}/);
  assert.match(css, /height:\s*calc\(100dvh/);
  assert.match(css, /\.editorHost :global\(\.cm-editor\)\s*\{\s*font-size:\s*16px/);
  assert.match(css, /\.results:focus/);
  assert.match(css, /touch-action:\s*pan-x pan-y pinch-zoom/);
});
