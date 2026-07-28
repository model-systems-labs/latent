import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { canonicalQuestionGroupLibraryJson } from "@latent/course-kit/question-group";
import {
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  LEARNER_CODE_EDITOR_VERSION,
} from "@latent/course-kit/learner-code-editor";
import { buildStandaloneQuestionGroupSite } from "@latent/course-kit/question-group-site";

import {
  renderTenProblemsHeaders,
  tenProblemsMetaContentSecurityPolicy,
} from "../security-config.mjs";
import { tenProblemsSiteUi } from "../site-config.mjs";
import { tenProblemsReferenceSolutions } from "../trusted/reference-solutions.mjs";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));

test("the trusted build input configures a Python-only learner site without output patches", async () => {
  const runtimeAdapterJavaScript = "globalThis.LatentQuestionPlayerRuntime = trustedPythonAdapter;\n";
  const files = await buildStandaloneQuestionGroupSite(library, {
    runtimeAdapterJavaScript,
    bundledBrowserRuntime: false,
    metaContentSecurityPolicy: tenProblemsMetaContentSecurityPolicy,
    referenceSolutions: tenProblemsReferenceSolutions,
    ui: tenProblemsSiteUi,
  });

  assert.equal(
    files["question-group-library.json"],
    canonicalQuestionGroupLibraryJson(library),
  );
  assert.equal(files["assets/runtime-adapter.js"], runtimeAdapterJavaScript);
  assert.equal(files["assets/esbuild.js"], undefined);
  assert.equal(files["assets/esbuild.wasm"], undefined);
  assert.equal(files["assets/sandbox.worker.js"], undefined);
  assert.ok(files["assets/learner-ui.js"]);
  assert.match(
    files["assets/learner-code-editor.js"],
    /LatentLearnerCodeEditorRuntime/,
  );
  assert.match(
    files["THIRD_PARTY_NOTICES.md"],
    /CodeMirror 6[\s\S]*Lezer[\s\S]*MIT/,
  );
  assert.match(files["assets/player.css"], /--learner-background-recipe: cobalt;/);
  assert.match(files["assets/player.css"], /--learner-atmosphere-glint-strength: \.38;/);
  assert.match(
    files["assets/player.css"],
    /\.learner-editor-frame \.learner-solution\s*\{[^}]*border-top:\s*0;[^}]*margin-top:\s*0;[^}]*padding:\s*0 var\(--learner-space-4\);/,
  );

  assert.equal((files["index.html"].match(/<header\b/g) ?? []).length, 1);
  assert.match(files["index.html"], /<span>Learning Studio<\/span>/);
  assert.match(files["index.html"], />Ten Problems</);
  assert.match(files["index.html"], />Practice</);
  assert.match(files["index.html"], />Review</);
  assert.match(files["index.html"], /href="\.\/leeches\/"/);
  assert.match(
    files["index.html"],
    /class="learner-wordmark" href="\.\.\/" aria-label="Learning Studio home"/,
  );
  assert.match(files["index.html"], /href="\.\.\/llm-systems\/">LLM Systems<\/a>/);
  assert.match(files["index.html"], /learner-header__meta">Courses and practice/);
  assert.match(
    files["index.html"],
    /<nav class="learner-context-nav" aria-label="Ten Problems navigation">/,
  );
  assert.match(
    files["leeches/index.html"],
    /class="learner-wordmark" href="\.\.\/\.\.\/" aria-label="Learning Studio home"/,
  );
  assert.match(
    files["leeches/index.html"],
    /href="\.\.\/" aria-current="page">Ten Problems<\/a>/,
  );
  assert.match(files["leeches/index.html"], /href="\.\.\/">Practice<\/a>/);
  assert.match(
    files["leeches/index.html"],
    /href="\.\/" aria-current="page">Review<\/a>/,
  );
  assert.match(files["index.html"], /Built with Latent\./);
  assert.match(
    files["index.html"],
    new RegExp(tenProblemsMetaContentSecurityPolicy.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.match(files["index.html"], /src="\.\/assets\/learner-code-editor\.js"/);
  assert.match(
    files["leeches/index.html"],
    /src="\.\.\/assets\/learner-code-editor\.js"/,
  );
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
  assert.doesNotMatch(files["index.html"], /worker-src 'self' blob:/);
  assert.doesNotMatch(files["index.html"], /assets\/esbuild\.js/);
  assert.ok(files["leeches/index.html"]);
  assert.equal(files["review/index.html"], undefined);

  assert.match(files["assets/player.js"], /Running your Python code/);
  assert.match(files["assets/player.js"], /Run the public example, then check every published case/);
  assert.match(files["assets/player.js"], /new AbortController/);
  assert.match(files["assets/player.js"], /publicExamplesHeading/);
  assert.match(files["assets/player.js"], /View example solution/);
  assert.match(files["assets/player.js"], /def first_echo\(values\)/);
  assert.match(files["assets/player.js"], /def minimum_daily_capacity\(loads, days\)/);
  assert.match(files["assets/player.js"], /LearnerUiComponents\?\.createSolutionDisclosure/);
  assert.match(files["assets/player.js"], /LearnerUiComponents\?\.createEditableExamples/);
  assert.match(files["assets/player.js"], /LearnerUiComponents\?\.prepareCodeEditor/);
  assert.match(files["assets/player.js"], /runLabel: copy\.runInput/);
  assert.match(files["assets/player.js"], /return normalizeObservation\(result\?\.observation\)/);
  assert.match(
    files["assets/player.js"],
    /question: \{ \.\.\.question, cases: \[scopedCase\] \}/,
  );
  assert.match(
    files["assets/player.js"],
    /if \(mode === "check"\) \{[\s\S]*writeProgress/,
  );
  assert.match(
    files["assets/player.js"],
    /tabSize: question\.language === "python" \? 4 : 2/,
  );
  assert.match(
    files["assets/player.js"],
    /language: question\.language,[\s\S]*onRun: \(mode\)/,
  );
  assert.doesNotMatch(files["assets/player.js"], /event\.key === "Tab"|setRangeText/);
  assert.match(files["assets/learner-ui.js"], /const prepareCodeEditor = /);
  assert.match(files["assets/learner-ui.js"], /const createEditableExamples = /);
  assert.match(files["assets/learner-ui.js"], /Use an array of function arguments/);
  assert.match(files["assets/learner-ui.js"], /This run does not affect progress/);
  assert.match(
    files["assets/learner-ui.js"],
    /Python code editor\.[\s\S]*Tab indents [\s\S]*Shift\+Tab outdents\. Press Escape, then Tab, to leave the editor\./,
  );
  assert.match(files["assets/learner-ui.js"], /code\.textContent = trustedSource/);
  assert.match(
    files["assets/learner-ui.js"],
    /Compare the control flow and boundary cases with your draft\. Opening this reference does not replace your work or update progress\./,
  );
  assert.doesNotMatch(
    files["question-group-library.json"],
    /seen = set\(\)|low = max\(loads\)/,
  );
  assert.doesNotMatch(
    files["assets/runtime-adapter.js"],
    /seen = set\(\)|low = max\(loads\)/,
  );
  assert.match(files["assets/player.css"], /--learner-color-canvas: #eaf0fa/);
  assert.match(files["assets/player.css"], /--learner-color-accent: #42629b/);
  assert.match(files["assets/player.css"], /--learner-background-recipe: cobalt/);
  assert.match(files["assets/player.css"], /\.learner-textarea/);
  assert.match(files["assets/player.css"], /\.learner-example__actions/);
  assert.match(files["assets/player.css"], /--learner-background-size: 100% 42rem/);
  assert.match(files["assets/player.css"], /\.learner-atmosphere__line--intro/);
  assert.match(files["assets/player.css"], /--learner-font-reading: "Iowan Old Style"/);
  assert.match(files["assets/favicon.svg"], /M25 20 14 32l11 12/);

  const report = JSON.parse(files["build-report.json"]);
  const libraryDigest = createHash("sha256")
    .update(files["question-group-library.json"])
    .digest("hex");
  assert.equal(report.sha256, libraryDigest);
  assert.equal(report.reviewDirectory, "leeches");
  assert.equal(report.bundledBrowserRuntime, false);
  assert.equal(report.metaContentSecurityPolicy, "custom");
  assert.equal(report.playerVersion, 2);
  assert.deepEqual(report.learnerCodeEditor, {
    version: LEARNER_CODE_EDITOR_VERSION,
    bytes: Buffer.byteLength(files["assets/learner-code-editor.js"], "utf8"),
    sha256: createHash("sha256")
      .update(files["assets/learner-code-editor.js"])
      .digest("hex"),
  });
  assert.equal(report.referenceSolutions.count, 10);
  assert.match(report.referenceSolutions.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.browserRuntimes, []);

  const buildSource = await readFile(
    new URL("../tools/build.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(buildSource, /replaceExact|navigationReplacements/);
  assert.doesNotMatch(buildSource, /assets\/esbuild\.js|assets\/sandbox\.worker\.js/);
  assert.match(buildSource, /referenceSolutions: tenProblemsReferenceSolutions/);

  const combinedHeaders = renderTenProblemsHeaders({
    pagePattern: "/practice/*",
    sitePrefixes: ["/practice"],
  });
  assert.match(combinedHeaders, /^\/practice\/\*/);
  assert.match(combinedHeaders, /\/practice\/assets\/python-question\.worker\.js/);
  assert.match(combinedHeaders, /\/practice\/question-group-library\.json/);
  assert.match(
    combinedHeaders,
    new RegExp(LEARNER_CODE_EDITOR_CSP_SOURCE),
  );
  assert.doesNotMatch(combinedHeaders, /style-src[^\n]*'unsafe-inline'/);
  assert.doesNotMatch(combinedHeaders, /^\/\*/m);
  assert.doesNotMatch(combinedHeaders, /^\/assets\/python-question\.worker\.js/m);
});
