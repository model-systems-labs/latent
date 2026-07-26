import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "dist");
const marker = ".latent-platform-build";

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
  await Promise.all([
    cp(join(root, "site"), temporary, { recursive: true }),
    cp(join(root, "content"), join(temporary, "content"), { recursive: true }),
    cp(join(root, "trusted"), join(temporary, "trusted"), { recursive: true }),
    cp(join(root, "platform.json"), join(temporary, "platform.json")),
    ...["README.md", "LICENSE", "NOTICE.md", "CONTENT_LICENSE.md"].map((file) => (
      cp(join(root, file), join(temporary, file))
    )),
  ]);
  await cp(join(temporary, "index.html"), join(temporary, "404.html"));
  await writeFile(join(temporary, marker), "latent-platform-static-v1\n", "utf8");
  await writeFile(join(temporary, ".nojekyll"), "", "utf8");

  const sourceFiles = [
    join(root, "platform.json"),
    join(root, "README.md"),
    join(root, "LICENSE"),
    join(root, "NOTICE.md"),
    join(root, "CONTENT_LICENSE.md"),
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
  await writeFile(join(temporary, "build-report.json"), `${JSON.stringify({
    format: "latent-platform-build",
    schemaVersion: 1,
    sourceSha256: digest.digest("hex"),
  }, null, 2)}\n`, "utf8");

  if (existed) await rm(target, { recursive: true });
  await rename(temporary, target);
  console.log(JSON.stringify({ ok: true, output: target }, null, 2));
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  throw error;
}
