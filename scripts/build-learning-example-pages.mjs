import { spawn } from "node:child_process";
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
const output = join(root, ".pages-site");
const marker = ".latent-learning-examples-pages";
const interviewProject = join(root, "examples/learning-platform/interview-loop");
const practiceProject = join(root, "examples/learning-platform/ten-problems");

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
  await cp(join(interviewProject, "dist"), temporary, { recursive: true });
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
  await writeFile(join(temporary, ".nojekyll"), "", "utf8");

  const files = await collectFiles(temporary);
  await writeFile(join(temporary, "learning-examples-report.json"), `${JSON.stringify({
    format: "latent-learning-examples-pages",
    schemaVersion: 1,
    routes: {
      interviewLoop: ["/", "/interview-loop/"],
      practice: ["/practice/", "/practice/leeches/"],
    },
    fileCount: files.length + 1,
  }, null, 2)}\n`, "utf8");

  if (existed) await rm(output, { recursive: true });
  await rename(temporary, output);
  console.log(JSON.stringify({
    ok: true,
    output,
    routes: ["/", "/interview-loop/", "/practice/", "/practice/leeches/"],
    files: files.length + 1,
  }, null, 2));
} catch (error) {
  await rm(temporary, { force: true, recursive: true });
  throw error;
}
