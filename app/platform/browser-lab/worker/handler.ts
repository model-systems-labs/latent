import { BrowserLabError } from "../errors";
import { evaluateExerciseCase } from "../contracts";
import { hashText } from "../hash";
import { createBoundedLogCollector } from "../logs";
import { validateSandboxRunRequest } from "../sandbox-protocol";
import type { SandboxRunRequest, SandboxWorkerResponse, TestReceipt } from "../types";
import type { SandboxEngine } from "./engine";

export type WorkerResponseSink = (message: SandboxWorkerResponse) => void;

export async function handleSandboxRunRequest(
  request: SandboxRunRequest,
  engine: SandboxEngine,
  send: WorkerResponseSink,
  clock: () => number = Date.now,
): Promise<TestReceipt> {
  validateSandboxRunRequest(request);
  for (const compiledModule of request.program.modules) {
    if (await hashText(compiledModule.code) !== compiledModule.codeHash) {
      throw new BrowserLabError("COMPILED_CODE_TAMPERED", `Compiled module ${compiledModule.modulePath} does not match its hash.`);
    }
  }
  const startedAt = clock();
  const logs = createBoundedLogCollector(request.limits.maxLogEntries, request.limits.maxLogCharacters);
  const results = [];
  let harnessFailed = false;
  for (const contract of request.suite.contracts) {
    for (const exerciseCase of contract.cases) {
      let observation;
      try {
        observation = await engine.observe(request, exerciseCase, (level, values) => {
          const entry = logs.append(level, values);
          if (entry) send({ type: "browser-lab/log", jobId: request.jobId, entry });
        });
      } catch (error) {
        observation = { status: "harness-error" as const, message: error instanceof Error ? error.message : "The isolated engine failed." };
      }
      if (observation.status === "harness-error") harnessFailed = true;
      results.push(evaluateExerciseCase(contract, exerciseCase, observation));
    }
  }
  const passed = results.length > 0 && results.every((result) => result.passed);
  return {
    schemaVersion: 1,
    receiptId: `${request.jobId}:receipt`,
    jobId: request.jobId,
    projectId: request.projectId,
    projectRevision: request.projectRevision,
    sourceHash: request.sourceHash,
    contractVersion: request.contractVersion,
    status: harnessFailed ? "sandbox-error" : passed ? "passed" : "failed",
    startedAt,
    completedAt: clock(),
    results,
    logs: logs.entries(),
    logsTruncated: logs.truncated(),
    limits: { ...request.limits },
  };
}
