import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { canonicalQuestionGroupLibraryJson } from "@latent/course-kit/question-group";
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

  assert.match(files["index.html"], />Ten Problems</);
  assert.match(files["index.html"], />Practice</);
  assert.match(files["index.html"], />Review</);
  assert.match(files["index.html"], /href="\.\/leeches\/"/);
  assert.match(files["index.html"], /href="\.\.\/">Learning Studio<\/a>/);
  assert.match(files["index.html"], /href="\.\.\/llm-systems\/">LLM Systems<\/a>/);
  assert.match(files["index.html"], /learner-header__meta">10 Python problems/);
  assert.match(files["index.html"], /Built with Latent\./);
  assert.match(
    files["index.html"],
    new RegExp(tenProblemsMetaContentSecurityPolicy.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
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
  assert.doesNotMatch(combinedHeaders, /^\/\*/m);
  assert.doesNotMatch(combinedHeaders, /^\/assets\/python-question\.worker\.js/m);
});
