import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const positional = args.filter((value, index) => !value.startsWith("--") && !args[index - 1]?.startsWith("--"));
const directory = resolve(projectRoot, positional[0] ?? "dist");
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const host = valueAfter("--host", "127.0.0.1");
const port = Number(valueAfter("--port", "4173"));

if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("Port must be an integer from 0 to 65535.");
if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("Preview binds to loopback hosts only.");

const rootStats = await lstat(directory);
if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new Error("Preview requires a real build directory.");
if ((await readFile(join(directory, ".latent-platform-build"), "utf8")).trim() !== "latent-platform-static-v1") {
  throw new Error("Preview requires a Latent platform build marker.");
}
const canonicalRoot = await realpath(directory);

async function regularFileInsideRoot(candidate) {
  const fileStats = await lstat(candidate).catch(() => null);
  if (!fileStats?.isFile() || fileStats.isSymbolicLink()) return null;
  const canonical = await realpath(candidate);
  if (canonical !== canonicalRoot && !canonical.startsWith(`${canonicalRoot}${sep}`)) {
    return null;
  }
  return canonical;
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".zip": "application/zip",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const decoded = decodeURIComponent(url.pathname);
    const requested = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
    const requestedPath = resolve(canonicalRoot, `.${requested}`);
    if (
      requestedPath !== canonicalRoot
      && !requestedPath.startsWith(`${canonicalRoot}${sep}`)
    ) {
      response.writeHead(400).end("Bad request");
      return;
    }
    let path = await regularFileInsideRoot(requestedPath);
    if (!path) {
      path = await regularFileInsideRoot(join(canonicalRoot, "404.html"));
      if (!path) throw new Error("The preview 404 page is unavailable.");
      response.statusCode = 404;
    }
    response.setHeader("Content-Type", contentTypes[extname(path)] ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (extname(path) === ".json") response.setHeader("Access-Control-Allow-Origin", "*");
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Preview error");
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(port, host, resolveListen);
});
const address = server.address();
const actualPort = address && typeof address === "object" ? address.port : port;
console.log(`Preview: http://${host === "::1" ? "[::1]" : host}:${actualPort}/`);

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
