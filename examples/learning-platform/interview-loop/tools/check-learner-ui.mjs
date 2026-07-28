import { spawn } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  LEARNER_CODE_EDITOR_VERSION,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerContextNavigation,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "./vendor/learner-ui.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(projectRoot, "../../..");
const generator = resolve(
  repositoryRoot,
  "scripts/generate-learning-platform-learner-ui.mjs",
);
const vendor = resolve(projectRoot, "tools/vendor/learner-ui.mjs");
const editorVendor = resolve(
  projectRoot,
  "tools/vendor/learner-code-editor.js",
);

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(
        signal
          ? `Learner UI freshness check stopped with ${signal}.`
          : `Learner UI freshness check exited with code ${code}.`,
      ));
    });
  });
}

const generatorStats = await lstat(generator).catch(() => null);
if (generatorStats?.isFile() && !generatorStats.isSymbolicLink()) {
  await run(
    "npm",
    ["--prefix", repositoryRoot, "run", "build", "--workspace", "@latent/course-kit"],
    projectRoot,
  );
  await run(
    process.execPath,
    [
      generator,
      "--check",
      "--out",
      vendor,
      "--editor-out",
      editorVendor,
    ],
    repositoryRoot,
  );
} else {
  const editorStats = await lstat(editorVendor).catch(() => null);
  const editorSource = editorStats?.isFile() && !editorStats.isSymbolicLink()
    ? await readFile(editorVendor, "utf8")
    : "";
  if (
    LEARNER_UI_VERSION !== 2
    || LEARNER_CODE_EDITOR_VERSION !== 1
    || LEARNER_CODE_EDITOR_CSP_SOURCE
      !== "'nonce-latent-learner-code-editor-v1'"
    || typeof createLearnerUiCss !== "function"
    || typeof renderLearnerContextNavigation !== "function"
    || typeof renderLearnerHeader !== "function"
    || typeof renderLearnerFooter !== "function"
    || typeof resolveLearnerUiTheme !== "function"
    || typeof learnerUiJavaScript !== "string"
    || learnerUiJavaScript.length === 0
    || !editorSource.includes("LatentLearnerCodeEditorRuntime")
    || editorSource.includes("sourceMappingURL=")
  ) {
    throw new Error(
      "The checked-in standalone learner UI or code editor bundle is invalid.",
    );
  }
  console.log(
    "Using the checked-in learner UI v2 and code editor bundles for this extracted platform.",
  );
}
