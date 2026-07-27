import { spawn } from "node:child_process";
import {
  lstat,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(projectRoot, "../../..");
const cli = join(repositoryRoot, "packages/course-kit/bin/latent-learning.mjs");
const library = join(projectRoot, "content/question-groups.json");
const output = join(projectRoot, "dist");

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(
        signal
          ? `Practice build stopped with ${signal}.`
          : `Practice build exited with code ${code}.`,
      ));
    });
  });
}

async function replaceExact(relativePath, replacements) {
  const path = join(output, relativePath);
  let source = await readFile(path, "utf8");
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(`Expected generated text was missing from ${relativePath}: ${before}`);
    }
    source = source.replaceAll(before, after);
  }
  await writeFile(path, source, "utf8");
}

await run(process.execPath, [
  cli,
  "questions",
  "build",
  library,
  "--out-dir",
  output,
  "--json",
]);

const stats = await lstat(output);
if (!stats.isDirectory() || stats.isSymbolicLink()) {
  throw new Error("The practice build output must be a real directory.");
}

const navigationReplacements = [
  ["latent practice", "Ten Problems"],
  ["All questions", "Problems"],
  ["Leech review", "Review misses"],
];
await replaceExact("index.html", navigationReplacements);
await replaceExact("leeches/index.html", navigationReplacements);
await replaceExact("assets/player.js", [
  ["Progress query · leeches", "Repeated misses"],
  ["Question Group library", "Problem set"],
  [
    "No leeches yet. A question appears here after at least three attempts and two misses, and leaves when solved.",
    "No repeated misses yet. A problem appears here after three attempts and two misses, and leaves when solved.",
  ],
  ["This library has no questions.", "This problem set is empty."],
]);

await writeFile(join(output, "assets", "player.css"), `${await readFile(
  join(output, "assets", "player.css"),
  "utf8",
)}

/* Learner-facing example theme. The portable problem library remains unchanged. */
:root {
  --paper: #f3f5f8;
  --panel: #ffffff;
  --ink: #171a21;
  --muted: #626a78;
  --line: rgba(23, 26, 33, .14);
  --violet: #3159d9;
  --green: #16724a;
}
.wordmark {
  font-size: .9rem;
  letter-spacing: -.01em;
  text-transform: none;
}
.library h1,
.question-copy h2 {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-weight: 720;
}
.question-copy h2 {
  font-size: clamp(2rem, 3.6vw, 3.2rem);
  letter-spacing: -.045em;
}
.question-link[aria-current="true"] {
  background: #e8edff;
}
textarea {
  background: #fbfcfe;
}
`, "utf8");

await writeFile(join(output, "assets", "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#171a21"/>
  <path d="M25 20 14 32l11 12M39 20l11 12-11 12" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"/>
</svg>
`, "utf8");
await writeFile(join(output, ".nojekyll"), "", "utf8");

console.log(JSON.stringify({
  ok: true,
  output,
  route: "/practice/",
}, null, 2));
