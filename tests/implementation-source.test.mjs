import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let sourceModule;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  sourceModule = await vite.ssrLoadModule("/app/lessons/implementation-source.ts");
});

after(async () => {
  await vite?.close();
});

function lesson(filename, codeBlocks, options = {}) {
  return {
    implementation: {
      filename,
      intro: "",
      codeBlocks,
      tensorOps: options.tensorOps,
      postlude: options.postlude,
    },
  };
}

function materialize(targetLesson, editableSources) {
  return sourceModule.lessonImplementationSource(
    targetLesson,
    targetLesson.implementation.codeBlocks.map((block, index) => (
      `${sourceModule.lessonBlockComment(targetLesson, index, block.label)}\n${editableSources[index]}`
    )),
  );
}

test("extracts every Python exercise without swallowing the following marker or fixed postlude", () => {
  const target = lesson("sequence.py", [
    { id: "transition", label: "Recurrent transition" },
    { id: "loss", label: "Cross-entropy loss" },
    { id: "clip", label: "Gradient clipping" },
  ], {
    postlude: "def train_reference():\n    return transition([1])",
  });
  const alternatives = [
    "import numpy as np\n\ndef transition(value):\n    return np.tanh(value)\n",
    "\ndef loss(probability):\n    return -np.log(probability)",
    "def clip(gradient):\n    return np.clip(gradient, -5, 5)\n\n",
  ];
  const source = materialize(target, alternatives);

  assert.deepEqual(sourceModule.lessonImplementationBlockSources(target, source), {
    transition: alternatives[0],
    loss: alternatives[1],
    clip: alternatives[2],
  });
});

test("leaves a JavaScript prelude and postlude outside the editable block sources", () => {
  const target = lesson("attention.js", [
    { id: "score", label: "Attention score" },
    { id: "combine", label: "Weighted values" },
  ], {
    tensorOps: ["tensor", "weightedSum"],
    postlude: "export const runtime = { score, combine };",
  });
  const alternatives = [
    "export function score(query, key) {\n  return query * key;\n}",
    "export function combine(values, weights) {\n  return weightedSum(tensor(values), tensor(weights));\n}",
  ];
  const source = materialize(target, alternatives);

  assert.match(source, /^import \{ tensor, weightedSum \} from "\.\.\/runtime\/latent-tensor\.js";/);
  assert.ok(source.endsWith(target.implementation.postlude));
  assert.deepEqual(sourceModule.lessonImplementationBlockSources(target, source), {
    score: alternatives[0],
    combine: alternatives[1],
  });
});

test("preserves edited bytes and ignores marker-like text that is not a complete marker line", () => {
  const target = lesson("sampling.js", [
    { id: "filter", label: "Top-k filter" },
    { id: "sample", label: "Sample token" },
  ]);
  const alternatives = [
    "function filter(note) {\r\n  return \"// 02 · Sample token inside a string\" + note;\r\n}\r\n",
    "\r\nconst sample = () => ({ token: \"a\", probability: 0.7 });\r\n",
  ];
  const source = materialize(target, alternatives);

  assert.deepEqual(sourceModule.lessonImplementationBlockSources(target, source), {
    filter: alternatives[0],
    sample: alternatives[1],
  });
});

test("returns null when an authored marker is missing, duplicated, or out of order", () => {
  const target = lesson("model.py", [
    { id: "first", label: "First step" },
    { id: "second", label: "Second step" },
  ]);
  const source = materialize(target, ["def first():\n    return 1", "def second():\n    return 2"]);
  const firstMarker = sourceModule.lessonBlockComment(target, 0, "First step");
  const secondMarker = sourceModule.lessonBlockComment(target, 1, "Second step");

  assert.equal(sourceModule.lessonImplementationBlockSources(target, source.replace(firstMarker, "# missing")), null);
  assert.equal(sourceModule.lessonImplementationBlockSources(target, source.replace(secondMarker, "# missing")), null);
  assert.equal(sourceModule.lessonImplementationBlockSources(target, `${firstMarker}\n# duplicate\n\n${source}`), null);

  const firstSection = `${firstMarker}\ndef first():\n    return 1`;
  const secondSection = `${secondMarker}\ndef second():\n    return 2`;
  assert.equal(sourceModule.lessonImplementationBlockSources(target, `${secondSection}\n\n${firstSection}`), null);
});

test("returns null when a required postlude or its canonical boundary is missing", () => {
  const postlude = "export function suppliedRuntime() {}";
  const target = lesson("runtime.js", [{ id: "exercise", label: "Exercise" }], { postlude });
  const source = materialize(target, ["export const exercise = true;"]);

  assert.equal(sourceModule.lessonImplementationBlockSources(target, source.slice(0, -postlude.length)), null);
  assert.equal(sourceModule.lessonImplementationBlockSources(target, source.replace(`\n\n${postlude}`, `\n${postlude}`)), null);
});
