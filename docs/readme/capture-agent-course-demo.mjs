import { mkdtemp, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const courseUrl = process.argv[2] ?? "http://127.0.0.1:52556/";
const videoPath = join(here, "agent-course-demo.webm");
const posterPath = join(here, "agent-course-demo-poster.png");
const recordingDirectory = await mkdtemp(join(tmpdir(), "latent-agent-demo-"));

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  browser = await chromium.launch({ channel: "chrome", headless: true });
}
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: "light",
  recordVideo: {
    dir: recordingDirectory,
    size: { width: 1280, height: 720 },
  },
});
const page = await context.newPage();

const pause = (milliseconds) => page.waitForTimeout(milliseconds);

async function showReplaySlide({ step, title, copy, prompt, facts = [] }) {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; min-height: 100%; }
          body {
            background:
              radial-gradient(circle at 92% 12%, rgba(115, 226, 207, .22), transparent 34%),
              #f6f4ec;
            color: #1b1f1a;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          main {
            min-height: 720px;
            padding: 58px 72px;
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 34px;
          }
          header, footer { display: flex; align-items: center; justify-content: space-between; }
          .brand, .step {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: .16em;
            text-transform: uppercase;
          }
          .step { color: #43756c; }
          section { align-self: center; max-width: 1120px; }
          h1 {
            max-width: 990px;
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 69px;
            font-weight: 500;
            letter-spacing: -.045em;
            line-height: .98;
          }
          .copy {
            max-width: 900px;
            margin: 24px 0 0;
            color: #5e625d;
            font-size: 23px;
            line-height: 1.45;
          }
          .prompt {
            max-width: 1060px;
            margin-top: 30px;
            border: 1px solid #343a34;
            border-radius: 12px;
            background: #20251f;
            box-shadow: 9px 9px 0 #7fe0d1;
            color: #f8f7f1;
            font: 19px/1.52 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            padding: 26px 30px;
            white-space: pre-wrap;
          }
          .facts { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
          .fact {
            border: 1px solid #343a34;
            border-radius: 999px;
            background: rgba(255, 255, 255, .7);
            padding: 11px 17px;
            font-size: 16px;
            font-weight: 750;
          }
          footer { color: #6b6f69; font-size: 14px; }
          footer strong { color: #1b1f1a; }
        </style>
      </head>
      <body>
        <main>
          <header>
            <span class="brand">Latent</span>
            <span class="step">${step}</span>
          </header>
          <section>
            <h1>${title}</h1>
            ${copy ? `<p class="copy">${copy}</p>` : ""}
            ${prompt ? `<div class="prompt">${prompt}</div>` : ""}
            ${facts.length ? `<div class="facts">${facts.map((fact) => `<span class="fact">${fact}</span>`).join("")}</div>` : ""}
          </section>
          <footer>
            <span><strong>Replay of an actual agent authoring run</strong> · idle time compressed</span>
            <span>Exact prompts and validation record are checked in</span>
          </footer>
        </main>
      </body>
    </html>
  `);
}

try {
  await showReplaySlide({
    step: "The golden path",
    title: "Ask an agent to build the course you wish existed.",
    copy: "Describe the learner, the outcome, and the kinds of practice you want. Then shape the result with ordinary feedback.",
    facts: ["3 real turns", "3 revised modules", "Runs in the browser"],
  });
  await pause(2500);

  await showReplaySlide({
    step: "Turn 1 · create",
    title: "Start with intent, not a config file.",
    prompt: `Create “Interview Loop Lab” for experienced software engineers.

Cover behavioral stories, coding practice, and a reusable architecture framework. Use Latent’s authoring skills, customize all four learning primitives, then validate and build it.`,
  });
  await pause(4300);

  await showReplaySlide({
    step: "First pass · validated",
    title: "The agent made a coherent first course.",
    copy: "It connected every activity through one webhook-delivery scenario—but the result still felt like one long generated lesson.",
    facts: ["1 lesson · 48 min", "5 checks", "14 cards", "3 coding problems", "Build passed"],
  });
  await pause(3000);

  await showReplaySlide({
    step: "Turn 2 · revise",
    title: "Then give it real editorial feedback.",
    prompt: `This still feels like one long generated lesson rather than a course I shaped with you.

Split it into three navigable modules with progress and resume. Show a weak behavioral answer and coached rewrite. Make coding progressive, and turn the architecture section into an explicit seven-pass walkthrough.`,
  });
  await pause(5000);

  await showReplaySlide({
    step: "Second pass · validated",
    title: "The structure changed—not just the copy.",
    copy: "The agent revised the content, trusted player, progress model, checks, and mobile layout, then reran strict validation, the build, and browser QA.",
    facts: ["3 modules · 58 min", "Progress + resume", "6 checks", "9 official sources"],
  });
  await pause(3500);

  await showReplaySlide({
    step: "Turn 3 · review",
    title: "A review found two promises the code did not yet keep.",
    prompt: `Bind module, quiz, and card progress to the exact content digest—not only package and version.

The coding contract promises read-only inputs and fresh output. Enforce both in the trusted runner, add focused tests, and rerun validation and browser QA.`,
  });
  await pause(5000);

  await showReplaySlide({
    step: "Final pass · verified",
    title: "The agent repaired the contract, then proved it.",
    copy: "Changed bytes no longer inherit learner state. Mutating and aliasing solutions fail; an equivalent pure solution passes.",
    facts: ["4 focused tests", "0 validation warnings", "Digest-bound progress", "Pure-output checks"],
  });
  await pause(3500);

  await page.goto(courseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: posterPath });
  await pause(3000);

  await page.getByRole("button", { name: /02 · Progressive coding under constraints/ }).click();
  await pause(2800);

  await page.getByRole("button", { name: "03 Practice", exact: true }).click();
  await pause(3000);

  await page.getByRole("button", { name: "02 Cards", exact: true }).click();
  await pause(1700);
  await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
  await pause(2600);

  await page.getByRole("button", { name: "01 Course", exact: true }).click();
  await page.getByRole("button", { name: /03 · Webhook delivery architecture/ }).click();
  await pause(3500);

  await showReplaySlide({
    step: "Preview · critique · revise",
    title: "The conversation is the authoring workflow.",
    copy: "Keep the source, validation, and finished static course. The agent is an authoring tool—not a dependency in the learner’s browser.",
    facts: ["See the example", "Read both prompts", "Make your own"],
  });
  await pause(3500);
} finally {
  const recordedVideo = page.video();
  await context.close();
  const recordedPath = await recordedVideo.path();
  await copyFile(recordedPath, videoPath);
  await browser.close();
}

console.log(`Wrote ${videoPath}`);
console.log(`Wrote ${posterPath}`);
