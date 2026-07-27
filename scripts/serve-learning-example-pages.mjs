import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".pages-site");
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const host = valueAfter("--host", "127.0.0.1");
const port = Number(valueAfter("--port", "4173"));
const productionBasePath = "/latent";

if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error("Port must be an integer from 0 to 65535.");
}
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error("Preview binds to loopback hosts only.");
}

const stats = await lstat(root);
if (stats.isSymbolicLink() || !stats.isDirectory()) {
  throw new Error("Preview requires a real .pages-site build directory.");
}
if (
  (await readFile(join(root, ".latent-learning-examples-pages"), "utf8")).trim()
  !== "latent-learning-examples-pages-v1"
) {
  throw new Error("Preview requires the learning-examples Pages marker.");
}
const canonicalRoot = await realpath(root);

async function regularFileInsideRoot(candidate) {
  const fileStats = await lstat(candidate).catch(() => null);
  if (!fileStats?.isFile() || fileStats.isSymbolicLink()) return null;
  const canonical = await realpath(candidate);
  return canonical === canonicalRoot || canonical.startsWith(`${canonicalRoot}${sep}`)
    ? canonical
    : null;
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const decoded = decodeURIComponent(url.pathname);
    const localPath = decoded === productionBasePath
      ? "/"
      : decoded.startsWith(`${productionBasePath}/`)
        ? decoded.slice(productionBasePath.length)
        : decoded;
    const requested = localPath.endsWith("/") ? `${localPath}index.html` : localPath;
    const requestedPath = resolve(canonicalRoot, `.${requested}`);
    if (
      requestedPath !== canonicalRoot
      && !requestedPath.startsWith(`${canonicalRoot}${sep}`)
    ) {
      response.writeHead(400).end("Bad request");
      return;
    }
    let path = await regularFileInsideRoot(requestedPath);
    if (!path && !extname(localPath)) {
      path = await regularFileInsideRoot(join(requestedPath, "index.html"));
    }
    if (!path) {
      path = await regularFileInsideRoot(join(canonicalRoot, "404.html"));
      if (!path) throw new Error("The preview 404 page is unavailable.");
      response.statusCode = 404;
    }
    response.setHeader("Content-Type", contentTypes[extname(path)] ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (path.endsWith(`${sep}assets${sep}sandbox.worker.js`)) {
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; object-src 'none'",
      );
    } else if (
      path.endsWith(`${sep}assets${sep}python-question.worker.js`)
      || path.endsWith(`${sep}assets${sep}python-exercise.worker.js`)
    ) {
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'",
      );
    }
    if (extname(path) === ".json") {
      response.setHeader("Access-Control-Allow-Origin", "*");
    }
    createReadStream(path).pipe(response);
  } catch {
    response
      .writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Preview error");
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(port, host, resolveListen);
});
const address = server.address();
const actualPort = address && typeof address === "object" ? address.port : port;
console.log(`Preview: http://${host === "::1" ? "[::1]" : host}:${actualPort}/`);
console.log(`Interview Loop: http://${host === "::1" ? "[::1]" : host}:${actualPort}/interview-loop/`);
console.log(`Ten Problems: http://${host === "::1" ? "[::1]" : host}:${actualPort}/practice/`);
console.log(`LLM Systems: http://${host === "::1" ? "[::1]" : host}:${actualPort}/llm-systems/`);
console.log(`Production-base mirror: http://${host === "::1" ? "[::1]" : host}:${actualPort}${productionBasePath}/`);

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
