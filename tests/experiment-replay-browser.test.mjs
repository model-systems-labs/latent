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

before(async () => {
  assert.ok(existsSync(serverEntry), "browser replay tests require a completed web build");
  const workerUrl = pathToFileURL(serverEntry);
  workerUrl.searchParams.set("experiment-replay-browser-test", `${process.pid}-${Date.now()}`);
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
  page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
});

after(async () => {
  await page?.close();
  await browser?.close();
  if (appServer) await new Promise((resolve) => appServer.close(resolve));
});

test("a hydrated lesson replays, pauses, resets, and directly inspects request construction", { timeout: 20_000 }, async () => {
  await page.goto(`${origin}/lessons/chat-actions-context`, { waitUntil: "networkidle" });

  const replay = page.getByRole("button", { name: "Replay selected request", exact: true });
  await replay.waitFor();
  await assert.doesNotReject(replay.click());
  await page.getByText("Full attempt record", { exact: true }).waitFor();

  assert.equal(await page.getByText("Messages sent to the model", { exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Save record a-31", exact: true }).getAttribute("aria-pressed"), "true");

  await page.getByRole("button", { name: "Edit prompt", exact: true }).click();
  assert.equal(await page.getByText("Full attempt record", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Replay selected request", exact: true }).count(), 1);

  await page.getByRole("button", { name: "Replay selected request", exact: true }).click();
  await page.getByRole("button", { name: "Pause request replay", exact: true }).click();
  await page.waitForTimeout(1_400);
  assert.equal(await page.getByRole("button", { name: "Apply action Edit prompt", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByText("Full attempt record", { exact: true }).count(), 0);

  await page.getByRole("button", { name: "Save record a-33", exact: true }).click();
  await page.getByText("Full attempt record", { exact: true }).waitFor();
  assert.equal(await page.getByText("Messages sent to the model", { exact: true }).count(), 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.locator(".experiment-lab").evaluate((experiment) => {
    const stages = Array.from(experiment.querySelectorAll(".replay-stage-bar button"));
    return {
      actionHeights: Array.from(experiment.querySelectorAll(".context-action-controls button"))
        .map((button) => button.getBoundingClientRect().height),
      columns: getComputedStyle(experiment.querySelector(".replay-stage-bar")).gridTemplateColumns.split(" ").length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      stageHeights: stages.map((button) => button.getBoundingClientRect().height),
    };
  });
  assert.equal(layout.columns, 2);
  assert.equal(layout.overflow, false);
  assert.ok(
    [...layout.actionHeights, ...layout.stageHeights].every((height) => height >= 44),
    `compact replay controls must retain 44px targets: ${JSON.stringify(layout)}`,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Replay selected request", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Pause request replay", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Save record a-31", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByText("Full attempt record", { exact: true }).count(), 1);
});
