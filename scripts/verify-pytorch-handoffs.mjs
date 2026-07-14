import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createServer } from "vite";

const execFile = promisify(execFileCallback);
const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.PYTORCH_PYTHON || process.argv[2] || "python3";
const temporary = await mkdtemp(join(tmpdir(), "latent-pytorch-handoffs-"));
const vite = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});

try {
  const handoffs = await vite.ssrLoadModule("/app/content/pytorch/handoffs.ts");
  const expectedVersions = Object.fromEntries(
    handoffs.PYTORCH_REQUIREMENTS.trim().split("\n").map((requirement) => requirement.split("==")),
  );
  const environmentCheck = [
    "import json, sys",
    "from importlib.metadata import version",
    "import onnx, onnxscript, torch",
    "expected = json.loads(sys.argv[1])",
    "actual = {package: version(package) for package in expected}",
    "assert actual == expected, f'expected {expected}, found {actual}'",
    "print(' '.join(f'{package}={value}' for package, value in actual.items()))",
  ].join("; ");
  const environment = await execFile(
    python,
    ["-c", environmentCheck, JSON.stringify(expectedVersions)],
    { maxBuffer: 1_000_000 },
  );
  process.stdout.write(environment.stdout);

  for (const file of handoffs.PYTORCH_HANDOFF_FILES) {
    const target = join(temporary, file.path.replace(/^pytorch\//, ""));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.code, "utf8");
    const run = await execFile(python, ["-W", "error", target], { cwd: temporary, maxBuffer: 2_000_000 });
    process.stdout.write(`${file.path}: ${run.stdout.trim()}\n`);
  }

  const transformerDirectory = join(temporary, "models");
  const exportCheck = [
    "import onnx, torch",
    "from onnx.reference import ReferenceEvaluator",
    "from causal_transformer_torch import TinyDecoderLM, export_onnx",
    "torch.manual_seed(29)",
    "model = TinyDecoderLM(vocabulary_size=32)",
    "path = export_onnx(model, 'tiny_decoder.onnx')",
    "artifact = onnx.load(path)",
    "onnx.checker.check_model(artifact)",
    "runtime = ReferenceEvaluator(artifact)",
    "for length in (4, 12):",
    "    token_ids = torch.randint(0, 32, (1, length), dtype=torch.long)",
    "    with torch.inference_mode():",
    "        expected = model(token_ids)",
    "    actual = torch.from_numpy(runtime.run(None, {'token_ids': token_ids.numpy()})[0])",
    "    torch.testing.assert_close(actual, expected, rtol=1e-4, atol=1e-5)",
    "print(f'{path} accepts sequence lengths 4 and 12')",
  ].join("\n");
  const exported = await execFile(python, ["-W", "error", "-c", exportCheck], {
    cwd: transformerDirectory,
    maxBuffer: 4_000_000,
  });
  process.stdout.write(`ONNX export: ${exported.stdout.trim()}\n`);
} finally {
  await vite.close();
  await rm(temporary, { recursive: true, force: true });
}
