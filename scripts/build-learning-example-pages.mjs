import { spawn } from "node:child_process";
import {
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

import {
  LEARNER_UI_FAVICON_SVG,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerAtmosphere,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "@latent/course-kit/learner-ui";
import {
  createLearningSuiteHeaderNavigation,
  createLearningSuiteNavigation,
  learningSuite,
  learningSuiteRouteReport,
} from "#root/examples/learning-platform/learning-suite.mjs";
import { renderTenProblemsHeaders } from "#root/examples/learning-platform/ten-problems/security-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".pages-site");
const marker = ".latent-learning-examples-pages";
const interviewProject = join(root, "examples/learning-platform/interview-loop");
const practiceProject = join(root, "examples/learning-platform/ten-problems");
const courseExport = join(root, "dist/client");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLanding() {
  const navigationOptions = {
    rootHref: "./",
    currentId: learningSuite.home.id,
    includeHome: false,
  };
  const familyDestinations = createLearningSuiteNavigation(navigationOptions);
  const familyNavigation = createLearningSuiteHeaderNavigation(navigationOptions);
  const hrefByExperience = new Map(
    familyDestinations.map((destination) => [destination.id, destination.href]),
  );
  const header = renderLearnerHeader({
    productName: learningSuite.title,
    homeHref: "./",
    homeLabel: `${learningSuite.title} home`,
    navigationLabel: learningSuite.navigationLabel,
    navigation: familyNavigation,
    menuLabel: "Experiences",
    meta: learningSuite.headerMeta,
  });
  const footer = renderLearnerFooter({
    summary: learningSuite.footerSummary,
    attribution: "Built with Latent.",
  });
  const cards = learningSuite.experiences.map((experience) => `<article class="learner-card studio-card">
  <p class="learner-eyebrow">${escapeHtml(experience.eyebrow)}</p>
  <h2>${escapeHtml(experience.title)}</h2>
  <p class="learner-summary">${escapeHtml(experience.description)}</p>
  <ul>${experience.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>
  <a class="learner-button" data-variant="primary" href="${escapeHtml(hrefByExperience.get(experience.id))}">${escapeHtml(experience.action)}</a>
</article>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(learningSuite.intro.description)}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
  <title>${escapeHtml(learningSuite.title)}</title>
  <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./assets/learner-ui.css">
  <link rel="stylesheet" href="./assets/studio.css">
</head>
<body class="learner-ui">
  <a class="learner-skip-link" href="#experiences">Skip to learning experiences</a>
  ${renderLearnerAtmosphere()}
  <div class="learner-page">
    ${header}
    <main class="learner-main studio-main" id="experiences" tabindex="-1">
      <section class="studio-intro" aria-labelledby="studio-title">
        <p class="learner-eyebrow">${escapeHtml(learningSuite.intro.eyebrow)}</p>
        <h1 id="studio-title">${escapeHtml(learningSuite.intro.heading)}</h1>
        <p>${escapeHtml(learningSuite.intro.description)}</p>
      </section>
      <section class="studio-grid" aria-label="Learning experiences">${cards}</section>
    </main>
    ${footer}
  </div>
  <script src="./assets/learner-ui.js" defer></script>
</body>
</html>
`;
}

const studioCss = `
.studio-main { padding: clamp(2rem, 6vw, 5rem) clamp(1rem, 4vw, 3rem); }
.studio-intro { margin: 0 auto clamp(2rem, 5vw, 4rem); max-width: 58rem; text-align: center; }
.studio-intro h1 {
  font-family: var(--learner-font-reading);
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  font-weight: 500;
  letter-spacing: -.055em;
  line-height: .98;
  margin: .5rem 0 1.25rem;
}
.studio-intro > p:last-child {
  color: var(--learner-color-muted);
  font-size: clamp(1rem, 2vw, 1.2rem);
  line-height: 1.7;
  margin: 0 auto;
  max-width: 47rem;
}
.studio-grid {
  margin: 0 auto;
  max-width: 52rem;
}
.studio-card {
  background: transparent;
  border: 0;
  border-radius: 0;
  border-top: var(--learner-border);
  min-height: 0;
  padding: clamp(2rem, 5vw, 3.5rem) 0;
}
.studio-card h2 {
  font-family: var(--learner-font-reading);
  font-size: clamp(1.7rem, 3vw, 2.2rem);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1.05;
  margin: .35rem 0 .75rem;
}
.studio-card ul { color: var(--learner-color-muted); line-height: 1.7; padding-left: 1.2rem; }
.studio-card .learner-button { margin-top: var(--learner-space-4); text-decoration: none; }
`;

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(
        signal
          ? `${command} stopped with ${signal}.`
          : `${command} exited with code ${code}.`,
      ));
    });
  });
}

async function inspectOutput() {
  try {
    const stats = await lstat(output);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(".pages-site must be a real directory.");
    }
    const value = await readFile(join(output, marker), "utf8").catch(() => "");
    if (value.trim() !== "latent-learning-examples-pages-v1") {
      throw new Error("Refusing to replace .pages-site without its build marker.");
    }
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Pages artifacts may not contain symlinks: ${relative(root, path)}`);
    }
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

await run("npm", ["run", "build"], interviewProject);
await run("npm", ["run", "build"], practiceProject);

const existed = await inspectOutput();
const temporary = await mkdtemp(join(root, ".pages-site-build-"));
try {
  await cp(
    join(interviewProject, "dist"),
    join(temporary, "interview-loop"),
    { recursive: true },
  );
  await cp(
    join(practiceProject, "dist"),
    join(temporary, "practice"),
    { recursive: true },
  );
  await cp(courseExport, join(temporary, "llm-systems"), { recursive: true });
  await mkdir(join(temporary, "assets"), { recursive: true });
  await cp(
    join(root, "public/open-learning"),
    join(temporary, "open-learning"),
    { recursive: true },
  );
  await cp(
    join(root, "public/question-groups"),
    join(temporary, "question-groups"),
    { recursive: true },
  );
  await writeFile(
    join(temporary, marker),
    "latent-learning-examples-pages-v1\n",
    "utf8",
  );
  await writeFile(join(temporary, "index.html"), renderLanding(), "utf8");
  await writeFile(join(temporary, "404.html"), renderLanding(), "utf8");
  await writeFile(
    join(temporary, "assets/learner-ui.css"),
    createLearnerUiCss(
      resolveLearnerUiTheme({ palette: "paper" }),
      { palette: "paper" },
    ),
    "utf8",
  );
  await writeFile(join(temporary, "assets/learner-ui.js"), learnerUiJavaScript, "utf8");
  await writeFile(join(temporary, "assets/favicon.svg"), `${LEARNER_UI_FAVICON_SVG}\n`, "utf8");
  await writeFile(join(temporary, "assets/studio.css"), studioCss, "utf8");
  await writeFile(
    join(temporary, "_headers"),
    `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()

${renderTenProblemsHeaders({
    pagePattern: "/practice/*",
    sitePrefixes: ["/practice"],
  })}`,
    "utf8",
  );
  await writeFile(join(temporary, ".nojekyll"), "", "utf8");

  const files = await collectFiles(temporary);
  const routes = learningSuiteRouteReport();
  await writeFile(join(temporary, "learning-examples-report.json"), `${JSON.stringify({
    format: "latent-learning-examples-pages",
    schemaVersion: 1,
    routes,
    fileCount: files.length + 1,
  }, null, 2)}\n`, "utf8");

  if (existed) await rm(output, { recursive: true });
  await rename(temporary, output);
  console.log(JSON.stringify({
    ok: true,
    output,
    routes: Object.values(routes).flat(),
    files: files.length + 1,
  }, null, 2));
} catch (error) {
  await rm(temporary, { force: true, recursive: true });
  throw error;
}
