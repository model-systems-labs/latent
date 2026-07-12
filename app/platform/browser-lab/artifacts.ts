import { BrowserLabError } from "./errors";
import { hashText } from "./hash";
import { assertReceiptPromotable, type ReceiptIdentity } from "./receipts";
import type { BindingManifest, BuildArtifact, CompiledProgram, RuntimeBinding, TestReceipt } from "./types";

const CAPABILITY_NAME = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const EXPORT_NAME = /^[A-Za-z_$][\w$]*$/;

export function validateBindingManifest(manifest: BindingManifest, program: CompiledProgram): void {
  if (manifest.schemaVersion !== 1) throw new BrowserLabError("UNSUPPORTED_BINDINGS", "Unsupported runtime binding manifest version.");
  const modules = new Set(program.modules.map((compiledModule) => compiledModule.modulePath));
  const bindingIds = new Set<string>();
  const capabilities = new Set<string>();
  for (const binding of manifest.bindings) {
    if (!binding.bindingId.trim() || bindingIds.has(binding.bindingId)) throw new BrowserLabError("DUPLICATE_BINDING", "Runtime binding ids must be present and unique.");
    if (!CAPABILITY_NAME.test(binding.capability) || capabilities.has(binding.capability)) throw new BrowserLabError("DUPLICATE_CAPABILITY", `Runtime capability is invalid or duplicated: ${binding.capability}.`);
    if (!modules.has(binding.modulePath)) throw new BrowserLabError("MISSING_BINDING_MODULE", `Binding ${binding.bindingId} points to an uncompiled module.`);
    if (!EXPORT_NAME.test(binding.exportName)) throw new BrowserLabError("INVALID_BINDING_EXPORT", `Binding ${binding.bindingId} has an unsafe export name.`);
    bindingIds.add(binding.bindingId);
    capabilities.add(binding.capability);
  }
}

export async function verifyCompiledModuleHashes(program: CompiledProgram): Promise<void> {
  for (const compiledModule of program.modules) {
    if (await hashText(compiledModule.code) !== compiledModule.codeHash) throw new BrowserLabError("COMPILED_CODE_TAMPERED", `Compiled module ${compiledModule.modulePath} no longer matches its hash.`);
  }
}

export async function createBuildArtifact(input: {
  artifactId: string;
  buildNumber: number;
  createdAt?: number;
  program: CompiledProgram;
  receipt: TestReceipt;
  bindingManifest: BindingManifest;
  expectedCases: readonly { contractId: string; caseId: string }[];
}): Promise<BuildArtifact> {
  if (!input.artifactId.trim() || !Number.isSafeInteger(input.buildNumber) || input.buildNumber < 1) {
    throw new BrowserLabError("INVALID_BUILD", "A build artifact needs an id and positive build number.");
  }
  const expected: ReceiptIdentity = {
    projectId: input.program.projectId,
    projectRevision: input.program.projectRevision,
    sourceHash: input.program.sourceHash,
    contractVersion: input.receipt.contractVersion,
  };
  assertReceiptPromotable(input.receipt, expected, input.expectedCases);
  validateBindingManifest(input.bindingManifest, input.program);
  await verifyCompiledModuleHashes(input.program);
  return {
    schemaVersion: 1,
    artifactId: input.artifactId,
    projectId: input.program.projectId,
    buildNumber: input.buildNumber,
    projectRevision: input.program.projectRevision,
    sourceHash: input.program.sourceHash,
    contractVersion: input.receipt.contractVersion,
    compilerVersion: input.program.compilerVersion,
    createdAt: input.createdAt ?? Date.now(),
    testReceiptId: input.receipt.receiptId,
    program: input.program,
    bindingManifest: input.bindingManifest,
  };
}

export function findRequiredBinding(manifest: BindingManifest, capability: string): RuntimeBinding {
  const binding = manifest.bindings.find((candidate) => candidate.capability === capability);
  if (!binding || !binding.required) throw new BrowserLabError("MISSING_RUNTIME_BINDING", `The active build does not provide required capability ${capability}.`);
  return binding;
}
