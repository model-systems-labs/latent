import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader,
} from "./vendor/learner-ui.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(projectRoot, "../../..");
const generator = resolve(
  repositoryRoot,
  "scripts/generate-learning-platform-learner-ui.mjs",
);
const vendor = resolve(projectRoot, "tools/vendor/learner-ui.mjs");

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
    [generator, "--check", "--out", vendor],
    repositoryRoot,
  );
} else {
  if (
    LEARNER_UI_VERSION !== 1
    || typeof createLearnerUiCss !== "function"
    || typeof renderLearnerHeader !== "function"
    || typeof renderLearnerFooter !== "function"
    || typeof learnerUiJavaScript !== "string"
    || learnerUiJavaScript.length === 0
  ) {
    throw new Error("The checked-in standalone learner UI bundle is invalid.");
  }
  console.log("Using the checked-in learner UI v1 bundle for this extracted platform.");
}
