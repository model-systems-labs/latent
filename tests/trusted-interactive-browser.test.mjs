import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const clientRoot = join(root, "dist/client");
const serverEntry = join(root, "dist/server/index.js");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webm", "video/webm"],
  [".woff2", "font/woff2"],
]);

let appServer;
let browser;
let page;
let origin;
const browserErrors = [];

function assetPath(pathname) {
  const candidate = normalize(join(clientRoot, decodeURIComponent(pathname).replace(/^\/+/, "")));
  const location = relative(clientRoot, candidate);
  return location.startsWith("..") || location === "" ? null : candidate;
}

async function staticResponse(request) {
  const path = assetPath(new URL(request.url).pathname);
  if (!path) return new Response("Not found", { status: 404 });
  try {
    const info = await stat(path);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    return new Response(await readFile(path), {
      headers: {
        "cache-control": "no-store",
        "content-type": contentTypes.get(extname(path)) ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function sendNodeResponse(response, outgoing) {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    outgoing.end();
    return;
  }
  for await (const chunk of response.body) outgoing.write(Buffer.from(chunk));
  outgoing.end();
}

function frame() {
  return page.frameLocator('iframe[title="Interactive causal self-attention matrix"]');
}

function experimentGate() {
  return page
    .locator('section[aria-label="Lesson progress"] li')
    .filter({ has: page.getByText("Experiment", { exact: true }) });
}

async function waitForFrame(label = "Reveal attention trace") {
  const run = frame().getByRole("button", { name: label, exact: true });
  await run.waitFor({ state: "visible" });
  await assert.doesNotReject(async () => {
    await run.waitFor({ state: "attached" });
    await page.waitForFunction(
      (title) => {
        const iframe = document.querySelector(`iframe[title="${title}"]`);
        return iframe?.dataset === undefined
          ? Boolean(iframe)
          : Boolean(iframe);
      },
      "Interactive causal self-attention matrix",
    );
  });
  return run;
}

before(async () => {
  assert.ok(existsSync(serverEntry), "trusted-interactive browser tests require a completed web build");
  const workerUrl = pathToFileURL(serverEntry);
  workerUrl.searchParams.set("trusted-interactive-browser-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  appServer = createServer(async (incoming, outgoing) => {
    try {
      const request = new Request(new URL(incoming.url ?? "/", origin), {
        headers: incoming.headers,
        method: incoming.method,
      });
      const asset = await staticResponse(request);
      const response = asset.status !== 404
        ? asset
        : await worker.fetch(
          request,
          { ASSETS: { fetch: staticResponse } },
          { waitUntil() {}, passThroughOnException() {} },
        );
      await sendNodeResponse(response, outgoing);
    } catch (error) {
      outgoing.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      outgoing.end(error instanceof Error ? error.stack : String(error));
    }
  });
  await new Promise((resolve, reject) => {
    appServer.once("error", reject);
    appServer.listen(0, "127.0.0.1", resolve);
  });
  const address = appServer.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;

  const chromeCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
  browser = await chromium.launch(executablePath ? { headless: true, executablePath } : { headless: true });
  page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  page.on("console", (message) => {
    if (
      message.type() === "error"
      && !message.location().url.endsWith("/favicon.ico")
      && !message.text().includes("Unrecognized Content-Security-Policy directive 'navigate-to'")
    ) {
      browserErrors.push(`console: ${message.text()} @ ${message.location().url || "unknown"}`);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
});

after(async () => {
  await page?.close();
  await browser?.close();
  if (appServer) await new Promise((resolve) => appServer.close(resolve));
});

test("the trusted causal-attention lesson rejects forged progress and preserves exact state across reload and reset", { timeout: 70_000 }, async () => {
  await page.goto(`${origin}/lessons/transformers`, { waitUntil: "networkidle" });

  const iframe = page.locator('iframe[title="Interactive causal self-attention matrix"]');
  await iframe.waitFor();
  assert.equal(await iframe.getAttribute("sandbox"), "allow-scripts");
  assert.equal(await iframe.getAttribute("referrerpolicy"), "no-referrer");

  await waitForFrame();
  const initialGate = experimentGate();
  await initialGate.getByText("Pending", { exact: true }).waitFor();

  const forged = await frame().locator("html").evaluate(async () => {
    const session = await globalThis.Latent.connect();
    try {
      await session.saveState({
        hasRevealed: true,
        selectedQuery: 3,
        inspectedQueries: [0, 3],
        traceRuns: 1,
      });
      await session.requestCompletion("causal-attention-comparison", {
        tokenCount: 6,
        selectedQuery: 3,
        inspectedQueries: [0, 3],
      });
      return "accepted";
    } catch {
      return "rejected";
    }
  });
  assert.equal(forged, "rejected");
  assert.equal(await initialGate.locator("em").textContent(), "Pending");

  await page.getByRole("button", { name: "Reset interactive", exact: true }).click();
  await page
    .locator('[data-interactive-id="causal-attention"] footer')
    .getByText("Interactive state reset. Completed lesson progress was kept.", { exact: true })
    .waitFor();
  const reveal = await waitForFrame();
  await initialGate.getByText("Pending", { exact: true }).waitFor();

  await reveal.click();
  await frame().getByText(
    "Attention trace revealed. Inspect one different query to compare how the readable prefix changes.",
    { exact: true },
  ).waitFor();
  assert.equal(await initialGate.locator("em").textContent(), "Pending");

  await page.reload({ waitUntil: "networkidle" });
  const replayAfterPartialRestore = await waitForFrame("Replay attention trace");
  await experimentGate().getByText("Pending", { exact: true }).waitFor();
  await frame().locator("#query-tab-3").click();
  await frame().getByText(
    "Replay the attention trace, then compare one other query to record completion.",
    { exact: true },
  ).waitFor();
  assert.equal(await experimentGate().locator("em").textContent(), "Pending");

  await replayAfterPartialRestore.click();
  await frame().getByText(
    "Attention trace replayed. Inspect one different query to make a fresh comparison.",
    { exact: true },
  ).waitFor();
  await frame().locator("#query-tab-5").click();
  await frame().getByText(
    "Two query rows compared. The lesson accepted the experiment evidence.",
    { exact: true },
  ).waitFor();
  await initialGate.getByText("Complete", { exact: true }).waitFor();
  assert.equal(
    await frame().locator("#row-total").textContent(),
    "1.000",
    "the visible deterministic attention row remains normalized",
  );
  assert.equal(
    await frame().locator("tbody tr").first().locator("td").nth(1).textContent(),
    "—",
    "the first future key is causally masked",
  );

  assert.equal(await frame().locator("#query-tab-5").getAttribute("aria-selected"), "true");
  assert.equal(
    await frame().locator("tbody .row-selector").nth(5).getAttribute("aria-pressed"),
    "true",
  );
  await page.waitForTimeout(350);

  await page.reload({ waitUntil: "networkidle" });
  await waitForFrame("Replay attention trace");
  await experimentGate().getByText("Complete", { exact: true }).waitFor();
  assert.equal(await frame().locator("#query-tab-5").getAttribute("aria-selected"), "true");
  assert.equal(await frame().locator("#query-position").textContent(), "Position 6 of 6");
  await page
    .locator('[data-interactive-id="causal-attention"] footer')
    .getByText("Restored your saved interactive state on this device.", { exact: true })
    .waitFor();

  await frame().locator("#query-tab-1").click();
  await frame().getByText(
    "Two query rows compared. The lesson accepted the experiment evidence.",
    { exact: true },
  ).waitFor();
  assert.notEqual(await frame().locator("#lab-status").getAttribute("data-tone"), "error");
  assert.doesNotMatch(
    await frame().locator("#lab-status").textContent(),
    /could not be recorded/i,
  );
  assert.equal(await experimentGate().locator("em").textContent(), "Complete");

  await page.getByRole("button", { name: "Reset interactive", exact: true }).click();
  await page
    .locator('[data-interactive-id="causal-attention"] footer')
    .getByText("Interactive state reset. Completed lesson progress was kept.", { exact: true })
    .waitFor();
  await waitForFrame();
  assert.equal(await frame().locator("#query-tab-0").getAttribute("aria-selected"), "true");
  assert.equal(await frame().locator("#query-tab-0").isDisabled(), true);
  assert.equal(
    await experimentGate().locator("em").textContent(),
    "Complete",
    "reset clears interactive state without revoking host-owned lesson progress",
  );

  await page.reload({ waitUntil: "networkidle" });
  await waitForFrame();
  assert.equal(await frame().locator("#query-tab-0").isDisabled(), true);
  assert.equal(await experimentGate().locator("em").textContent(), "Complete");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frame().getByRole("button", { name: "Reveal attention trace", exact: true }).click();
  await frame().getByText(
    "Attention trace revealed. Inspect one different query to compare how the readable prefix changes.",
    { exact: true },
  ).waitFor();
  await frame().locator("#query-tab-1").click();
  await frame().getByText(
    "Two query rows compared. The lesson accepted the experiment evidence.",
    { exact: true },
  ).waitFor();

  await frame().locator("#query-tab-1").focus();
  await frame().locator("#query-tab-1").press("ArrowRight");
  assert.equal(await frame().locator("#query-tab-2").getAttribute("aria-selected"), "true");

  const compact = await frame().locator("html").evaluate(() => {
    const root = document.documentElement;
    const tabs = document.querySelector("#query-tabs");
    const matrix = document.querySelector(".matrix-scroll");
    const animatedCell = document.querySelector("tbody td");
    return {
      controlHeights: [...document.querySelectorAll("button")]
        .filter((button) => !button.disabled)
        .map((button) => button.getBoundingClientRect().height),
      documentHeight: root.scrollHeight,
      iframeOverflow: root.scrollWidth > root.clientWidth,
      matrixScrollsLocally: matrix.scrollWidth > matrix.clientWidth,
      tabColumns: getComputedStyle(tabs).gridTemplateColumns.split(" ").length,
      transitionSeconds: Number.parseFloat(getComputedStyle(animatedCell).transitionDuration),
      viewportHeight: innerHeight,
    };
  });
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  const resetHeight = await page
    .getByRole("button", { name: "Reset interactive", exact: true })
    .evaluate((button) => button.getBoundingClientRect().height);

  assert.equal(pageOverflow, false);
  assert.equal(compact.iframeOverflow, false);
  assert.ok(
    compact.documentHeight <= compact.viewportHeight + 1,
    `the host should expand the frame instead of creating a nested vertical scroller: ${JSON.stringify(compact)}`,
  );
  assert.equal(compact.matrixScrollsLocally, true);
  assert.equal(compact.tabColumns, 2);
  assert.ok(
    [...compact.controlHeights, resetHeight].every((height) => height >= 44),
    `compact controls must retain 44px targets: ${JSON.stringify({ ...compact, resetHeight })}`,
  );
  assert.ok(compact.transitionSeconds <= 0.001, `reduced motion must suppress transitions: ${compact.transitionSeconds}`);
  await frame().locator("html").evaluate(() => {
    location.assign("about:blank");
  }).catch(() => undefined);
  await page.getByText(
    "The trusted interactive tried to navigate away from its reviewed source.",
    { exact: true },
  ).waitFor();
  assert.deepEqual(browserErrors, []);
});
