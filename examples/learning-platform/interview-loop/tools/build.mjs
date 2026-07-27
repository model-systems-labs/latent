import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as bundle } from "esbuild";

import {
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "./vendor/learner-ui.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(root, "../../..");
const target = resolve(root, "dist");
const marker = ".latent-platform-build";
const trustedRuntime = join(root, "trusted/python-exercise-runtime.ts");
const pythonWorker = join(
  repositoryRoot,
  "packages/python-lab/src/worker/python.worker.ts",
);
const pyodidePackage = join(repositoryRoot, "node_modules/pyodide");
const pyodideFiles = Object.freeze([
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
]);
const remotePyodideIndex = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderIndex(platform) {
  const navigationByView = new Map(
    platform.learnerUi.header.navigation.map((item) => [item.dataView, item]),
  );
  const panel = (view, headingId, rootId, loadingText) => {
    const navigation = navigationByView.get(view);
    if (!navigation || !navigation.href.startsWith("#")) {
      throw new Error(`Missing hash navigation for learner view "${view}".`);
    }
    return `      <section class="view" id="${escapeHtml(navigation.href.slice(1))}" data-panel="${escapeHtml(view)}" aria-labelledby="${escapeHtml(headingId)}"${view === "lesson" ? "" : " hidden"}>
        <div id="${escapeHtml(rootId)}" class="learner-empty loading">${escapeHtml(loadingText)}</div>
      </section>`;
  };
  const header = renderLearnerHeader({
    productName: platform.brand.name,
    ...platform.learnerUi.header,
  });
  const footer = renderLearnerFooter(platform.learnerUi.footer);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'"
    >
    <meta name="description" content="${escapeHtml(platform.brand.tagline)}">
    <title>${escapeHtml(platform.brand.name)}</title>
    <link rel="stylesheet" href="./learner-ui.css">
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body class="learner-ui">
    <a class="learner-skip-link" href="#learning-surface">Skip to learning content</a>
    <div class="learner-page">
      ${header}
      <main id="learning-surface" class="learner-main" tabindex="-1">
${panel("lesson", "lesson-heading", "lesson-root", "Loading modules…")}
${panel("practice", "practice-heading", "practice-root", "Loading practice…")}
${panel("cards", "cards-heading", "cards-root", "Loading review…")}
${panel("ide", "ide-heading", "ide-root", "Loading coding lab…")}
      </main>
      ${footer}
    </div>
    <div id="announcement" class="learner-sr-only" role="status" aria-live="polite"></div>
    <script src="./learner-ui.js" defer></script>
    <script type="module" src="./app.mjs"></script>
  </body>
</html>
`;
}

async function inspectTarget() {
  try {
    const stats = await lstat(target);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error("dist must be a real directory.");
    }
    const value = await readFile(join(target, marker), "utf8").catch(() => "");
    if (value.trim() !== "latent-platform-static-v1") {
      throw new Error("Refusing to replace dist without the Latent platform build marker.");
    }
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build source may not contain symlinks: ${relative(root, path)}`);
    if (entry.isDirectory()) output.push(...await collectFiles(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

const existed = await inspectTarget();
const temporary = await mkdtemp(join(root, ".dist.latent-build-"));
try {
  const platform = JSON.parse(await readFile(join(root, "platform.json"), "utf8"));
  const index = renderIndex(platform);
  await Promise.all([
    cp(join(root, "site"), temporary, { recursive: true }),
    cp(join(root, "content"), join(temporary, "content"), { recursive: true }),
    cp(join(root, "trusted"), join(temporary, "trusted"), { recursive: true }),
    cp(join(root, "platform.json"), join(temporary, "platform.json")),
    ...["README.md", "LICENSE", "NOTICE.md", "CONTENT_LICENSE.md"].map((file) => (
      cp(join(root, file), join(temporary, file))
    )),
  ]);
  await Promise.all([
    writeFile(join(temporary, "index.html"), index, "utf8"),
    writeFile(join(temporary, "404.html"), index, "utf8"),
    writeFile(
      join(temporary, "learner-ui.css"),
      createLearnerUiCss(resolveLearnerUiTheme(platform.learnerUi.appearance)),
      "utf8",
    ),
    writeFile(join(temporary, "learner-ui.js"), learnerUiJavaScript, "utf8"),
  ]);
  const assets = join(temporary, "assets");
  await mkdir(assets, { recursive: true });
  await bundle({
    absWorkingDir: repositoryRoot,
    entryPoints: [trustedRuntime],
    outfile: join(assets, "python-runtime.mjs"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "import"],
    legalComments: "inline",
  });
  await bundle({
    absWorkingDir: repositoryRoot,
    entryPoints: [pythonWorker],
    outfile: join(assets, "python-exercise.worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "import"],
    legalComments: "inline",
  });
  const workerPath = join(assets, "python-exercise.worker.js");
  const remoteWorker = await readFile(workerPath, "utf8");
  const remoteLiteral = JSON.stringify(remotePyodideIndex);
  const remoteOccurrences = remoteWorker.split(remoteLiteral).length - 1;
  if (remoteOccurrences !== 1) {
    throw new Error(
      `Expected one pinned Pyodide index in the reviewed worker, found ${remoteOccurrences}.`,
    );
  }
  const localWorker = remoteWorker.replace(
    remoteLiteral,
    "new URL(\"./pyodide/\", import.meta.url).href",
  );
  if (localWorker.includes(remotePyodideIndex)) {
    throw new Error("The generated Python worker retained a remote runtime URL.");
  }
  await writeFile(workerPath, localWorker, "utf8");

  const pyodideOutput = join(assets, "pyodide");
  await mkdir(pyodideOutput, { recursive: true });
  for (const filename of pyodideFiles) {
    const source = join(pyodidePackage, filename);
    const sourceStats = await lstat(source);
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      throw new Error(`Pinned Pyodide asset must be a regular file: ${source}`);
    }
    await copyFile(source, join(pyodideOutput, filename));
  }
  await writeFile(
    join(pyodideOutput, "NOTICE.txt"),
    `Pyodide 314.0.2

The runtime payloads in this directory come from the npm package
pyodide@314.0.2 and are licensed under the Mozilla Public License 2.0.
Project and corresponding source: https://github.com/pyodide/pyodide
License: https://www.mozilla.org/MPL/2.0/
`,
    "utf8",
  );
  await rm(join(temporary, "trusted/python-exercise-runtime.ts"));
  await writeFile(join(temporary, marker), "latent-platform-static-v1\n", "utf8");
  await writeFile(join(temporary, ".nojekyll"), "", "utf8");

  const sourceFiles = [
    join(root, "platform.json"),
    join(root, "README.md"),
    join(root, "LICENSE"),
    join(root, "NOTICE.md"),
    join(root, "CONTENT_LICENSE.md"),
    join(root, "tools/vendor/learner-ui.mjs"),
    ...await collectFiles(join(root, "content")),
    ...await collectFiles(join(root, "trusted")),
    ...await collectFiles(join(root, "site")),
  ].sort();
  const digest = createHash("sha256");
  for (const path of sourceFiles) {
    digest.update(relative(root, path));
    digest.update("\0");
    digest.update(await readFile(path));
    digest.update("\0");
  }
  const runtimeAssets = await Promise.all(
    (await collectFiles(assets)).sort().map(async (path) => {
      const bytes = await readFile(path);
      return {
        path: relative(temporary, path),
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  await writeFile(join(temporary, "build-report.json"), `${JSON.stringify({
    format: "latent-platform-build",
    schemaVersion: 1,
    learnerUiVersion: LEARNER_UI_VERSION,
    sourceSha256: digest.digest("hex"),
    pythonRuntime: {
      engine: "pyodide",
      engineVersion: "314.0.2",
      assets: runtimeAssets,
    },
  }, null, 2)}\n`, "utf8");

  if (existed) await rm(target, { recursive: true });
  await rename(temporary, target);
  console.log(JSON.stringify({ ok: true, output: target }, null, 2));
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  throw error;
}
