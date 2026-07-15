import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

let browserPython;
let handoffs;
let notebook;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [handoffs, notebook] = await Promise.all([
    vite.ssrLoadModule("/app/content/pytorch/handoffs.ts"),
    vite.ssrLoadModule("/app/features/pytorch/PyTorchHandoff.tsx"),
  ]);
  const packageManifestUrl = import.meta.resolve("pyodide/package.json");
  browserPython = await loadPyodide({ indexURL: fileURLToPath(new URL(".", packageManifestUrl)) });
});

after(async () => {
  browserPython?.globals.delete("__latent_torch_source");
  await vite?.close();
});

test("PyTorch appears only where a tensor framework clarifies the curriculum", () => {
  assert.deepEqual(Object.keys(handoffs.PYTORCH_HANDOFFS).sort(), [
    "additive-attention",
    "character-rnns",
    "inference-runtime",
    "neural-language-models",
    "transformers",
  ]);
  for (const excluded of [
    "subword-tokenization",
    "in-context-learning",
    "scheduling-memory",
    "streaming-transport",
    "reliability-observability",
    "conversation-state",
    "streaming-react",
    "chat-actions-context",
    "chat-product-quality",
  ]) assert.equal(handoffs.PYTORCH_HANDOFFS[excluded], undefined, excluded);
});

test("every native handoff is valid Python and uses real PyTorch APIs", () => {
  const paths = new Set();
  for (const handoff of Object.values(handoffs.PYTORCH_HANDOFFS)) {
    assert.equal(handoff.files.length, 1);
    assert.ok(handoff.rationale.length > 80, handoff.lessonId);
    assert.equal(handoff.mappings.length, 3, handoff.lessonId);
    for (const file of handoff.files) {
      assert.match(file.path, /^pytorch\/(models|systems)\/[a-z0-9_]+\.py$/);
      assert.equal(paths.has(file.path), false, file.path);
      paths.add(file.path);
      assert.match(file.code, /(^|\n)import torch\n|from torch import nn/);
      assert.match(file.code, /if __name__ == "__main__":/);
      browserPython.globals.set("__latent_torch_source", file.code);
      assert.doesNotThrow(() => browserPython.runPython("import ast; ast.parse(__latent_torch_source); True"), file.path);
    }
  }
  assert.equal(paths.size, 5);
  assert.match(handoffs.PYTORCH_HANDOFFS.transformers.files[0].code, /F\.scaled_dot_product_attention/);
  assert.match(handoffs.PYTORCH_HANDOFFS.transformers.files[0].code, /torch\.onnx\.export/);
  assert.match(handoffs.PYTORCH_HANDOFFS.transformers.files[0].code, /dynamic_shapes=/);
  assert.doesNotMatch(handoffs.PYTORCH_HANDOFFS.transformers.files[0].code, /artifact = export_onnx\(model\)/);
  assert.match(handoffs.PYTORCH_HANDOFFS["character-rnns"].files[0].code, /clip_grad_value_/);
  assert.match(handoffs.PYTORCH_HANDOFFS["inference-runtime"].files[0].code, /element_size\(\)/);
});

test("the downloadable notebook preserves the explicit native runtime boundary", () => {
  const handoff = handoffs.PYTORCH_HANDOFFS.transformers;
  const parsed = JSON.parse(notebook.pytorchNotebookSource(handoff));
  assert.equal(parsed.nbformat, 4);
  assert.equal(parsed.metadata.latent.lessonId, "transformers");
  assert.equal(parsed.metadata.latent.sourcePath, "pytorch/models/causal_transformer_torch.py");
  assert.match(parsed.cells[1].source.join(""), /Requires native Python 3/);
  assert.match(parsed.cells[1].source.join(""), /does not run in Pyodide/);
  assert.match(parsed.cells[2].source.join(""), /torch==2\.9\.0/);
  assert.match(parsed.cells[2].source.join(""), /onnx==1\.22\.0/);
  assert.match(parsed.cells[2].source.join(""), /onnxscript==0\.7\.1/);
  assert.match(parsed.cells[3].source.join(""), /torch\.__version__/);
  assert.match(parsed.cells[4].source.join(""), /class TinyDecoderLM/);
  assert.match(parsed.cells[5].source.join(""), /artifact = export_onnx\(model\)/);
  const characterNotebook = JSON.parse(notebook.pytorchNotebookSource(handoffs.PYTORCH_HANDOFFS["character-rnns"]));
  assert.match(characterNotebook.cells[2].source.join(""), /torch==2\.9\.0/);
  assert.doesNotMatch(characterNotebook.cells[2].source.join(""), /onnx/);
  assert.match(handoffs.PYTORCH_PORTFOLIO_README, /do not run in the browser's Pyodide worker/);
  assert.match(handoffs.PYTORCH_REQUIREMENTS, /^torch==2\.9\.0$/m);
  assert.match(handoffs.PYTORCH_REQUIREMENTS, /^onnx==1\.22\.0$/m);
  assert.match(handoffs.PYTORCH_REQUIREMENTS, /^onnxscript==0\.7\.1$/m);
});
