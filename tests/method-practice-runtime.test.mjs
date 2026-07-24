import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild-wasm";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
let adapter;
let browserLab;
let content;
let temporaryDirectory;
let vite;
let worker;

before(async () => {
  temporaryDirectory = await mkdtemp(join(fileURLToPath(root), ".method-practice-runtime-"));
  const browserLabOutput = join(temporaryDirectory, "browser-lab.mjs");
  const workerOutput = join(temporaryDirectory, "worker.mjs");
  await Promise.all([
    esbuild.build({
      entryPoints: [fileURLToPath(new URL("packages/browser-lab/src/index.ts", root))],
      outfile: browserLabOutput,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
    }),
    esbuild.build({
      entryPoints: [fileURLToPath(new URL("packages/browser-lab/src/worker/index.ts", root))],
      outfile: workerOutput,
      bundle: true,
      packages: "external",
      platform: "node",
      format: "esm",
      target: "node22",
    }),
  ]);
  [browserLab, worker] = await Promise.all([
    import(`${pathToFileURL(browserLabOutput).href}?test=${Date.now()}`),
    import(`${pathToFileURL(workerOutput).href}?test=${Date.now()}`),
  ]);
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [adapter, content] = await Promise.all([
    vite.ssrLoadModule("/app/features/practice/question-adapter.ts"),
    vite.ssrLoadModule("/app/content/practice/question-library.ts"),
  ]);
});

after(async () => {
  await vite?.close();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

async function evaluateSource(question, learnerSource) {
  const adapted = adapter.adaptPracticeQuestion(question, learnerSource);
  const source = browserLab.exposeLessonFunctions(adapted.source, [adapted.exportName]);
  const snapshot = {
    projectId: `practice-${question.id}`,
    revision: 0,
    files: [{ path: adapted.path, loader: "ts", contents: source }],
  };
  const job = await browserLab.createCompileJob({
    jobId: `compile-${question.id}`,
    snapshot,
    compilerVersion: browserLab.compilerVersionForEsbuild(esbuild.version),
    entryPoints: [adapted.path],
    submittedAt: 100,
  });
  const program = await browserLab.compileVirtualProject(job, {
    version: esbuild.version,
    build: esbuild.build,
  });
  assert.deepEqual(program.diagnostics, []);

  const request = {
    schemaVersion: 1,
    jobId: `run-${question.id}`,
    projectId: snapshot.projectId,
    projectRevision: snapshot.revision,
    sourceHash: job.sourceHash,
    contractVersion: "method-practice-test-v1",
    requestedAt: 100,
    deterministicSeed: 71,
    deterministicNowMs: 1_700_000_000_000,
    program,
    suite: {
      contractVersion: "method-practice-test-v1",
      contracts: [adapted.contract],
    },
    limits: { ...browserLab.DEFAULT_SANDBOX_LIMITS, cpuTimeoutMs: 250 },
  };
  const engine = new worker.QuickJSSandboxEngine();
  return Promise.all(adapted.contract.cases.map(async (exerciseCase) => {
    const observation = await engine.observe(request, exerciseCase, () => {});
    return browserLab.evaluateExerciseCase(adapted.contract, exerciseCase, observation);
  }));
}

const referenceSolutions = {
  "unique-values": `class Solution {
  uniqueValues(values: number[]): number[] {
    return [...new Set(values)];
  }
}
`,
  "pair-target-indices": `class Solution {
  pairTargetIndices(values: number[], target: number): number[] {
    const earliestIndex = new Map<number, number>();
    for (let index = 0; index < values.length; index += 1) {
      const partnerIndex = earliestIndex.get(target - values[index]);
      if (partnerIndex !== undefined) return [partnerIndex, index];
      if (!earliestIndex.has(values[index])) earliestIndex.set(values[index], index);
    }
    return [];
  }
}
`,
  "group-equivalent-words": `class Solution {
  groupEquivalentWords(words: string[]): string[][] {
    const groups = new Map<string, string[]>();
    for (const word of words) {
      const signature = [...word].sort().join("");
      const group = groups.get(signature);
      if (group) group.push(word);
      else groups.set(signature, [word]);
    }
    return [...groups.values()];
  }
}
`,
  "balanced-delimiters": `class Solution {
  balancedDelimiters(text: string): boolean {
    const stack: string[] = [];
    const closing: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const character of text) {
      if (character === "(" || character === "[" || character === "{") {
        stack.push(character);
      } else if (character in closing && stack.pop() !== closing[character]) {
        return false;
      }
    }
    return stack.length === 0;
  }
}
`,
  "normalize-path": `class Solution {
  normalizePath(path: string): string {
    const segments: string[] = [];
    for (const segment of path.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") segments.pop();
      else segments.push(segment);
    }
    return "/" + segments.join("/");
  }
}
`,
  "longest-unique-window": `class Solution {
  longestUniqueWindow(text: string): number {
    const characters = [...text];
    const lastIndex = new Map<string, number>();
    let left = 0;
    let longest = 0;
    for (let right = 0; right < characters.length; right += 1) {
      const previous = lastIndex.get(characters[right]);
      if (previous !== undefined && previous >= left) left = previous + 1;
      lastIndex.set(characters[right], right);
      longest = Math.max(longest, right - left + 1);
    }
    return longest;
  }
}
`,
};

test("every shipped class-method question accepts a reference solution at the real QuickJS boundary", async () => {
  assert.equal(Object.keys(referenceSolutions).length, content.methodQuestions.length);
  for (const question of content.methodQuestions) {
    const reference = referenceSolutions[question.id];
    assert.equal(typeof reference, "string", `Missing a reference solution for ${question.id}.`);
    const results = await evaluateSource(question, reference);
    assert.equal(results.length, question.cases.length, question.id);
    assert.ok(
      results.every((result) => result.passed),
      `${question.id}: ${results.map((result) => result.detail).join("\n")}`,
    );
  }
});

test("no shipped starter can earn a solved result", async () => {
  for (const question of content.methodQuestions) {
    const results = await evaluateSource(question, question.starterCode);
    assert.ok(
      results.some((result) => !result.passed),
      `${question.id} starter unexpectedly passed every case.`,
    );
  }
});
