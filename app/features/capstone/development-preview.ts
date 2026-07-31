"use client";

import {
  createCompileJob,
  hashText,
  type ProjectSnapshot,
} from "@latent/browser-lab";
import {
  BROWSER_LAB_COMPILER_VERSION,
  BrowserLabCompilerClient,
} from "@latent/browser-lab/compiler";
import { runCapstoneBehaviorContract } from "@/app/features/ide/capstone-behavior-runner";
import { prepareProjectSnapshotFiles } from "@/app/features/ide/project-snapshot";
import {
  compileProject,
  type ProjectFile,
  type ProjectRuntime,
} from "@/app/lib/project-workspace";
import {
  sourceBoundPythonRnnArtifactFromCheckpoint,
  type SavedRnnArtifact,
} from "@/app/lib/learner-state";
import type { CheckpointRecord } from "@/app/platform/persistence/types";
import {
  CAPSTONE_COMPONENT_PATH,
  CAPSTONE_ENTRY_PATH,
} from "@/examples/learning-platform/llm-learning/content/browser-chat/project-template";
import {
  verifyPreviewBundle,
  type ValidatedPreviewBundle,
} from "@/app/runtime/capstone/preview-frame";

const PROJECT_ID = "browser-chat";

export type DevelopmentCapstonePreview = {
  bundle: ValidatedPreviewBundle;
  runtime: ProjectRuntime;
};

function developmentPreviewFailure(
  message: string,
  path: string = CAPSTONE_COMPONENT_PATH,
) {
  return Object.assign(new Error(message), {
    code: "DEVELOPMENT_PREVIEW_FAILED",
    path,
  });
}

/**
 * Compiles the current durable project without running or recording the
 * certification suite. This function returns a runnable bundle only after the
 * host-owned behavior contract (including its isolated preflight) passes.
 */
export async function compileDevelopmentCapstonePreview(input: {
  files: Readonly<Record<string, ProjectFile>>;
  runtime: ProjectRuntime;
  projectRevision: number;
  runtimeSource: string;
  signal?: AbortSignal;
}): Promise<DevelopmentCapstonePreview> {
  const runtimeResult = compileProject({ ...input.files }, input.runtime);
  if (!runtimeResult.ok) {
    const message = runtimeResult.errors.join(" ");
    const path = Object.keys(input.files).find((candidate) => message.includes(candidate));
    throw developmentPreviewFailure(message, path);
  }
  const runtime: ProjectRuntime = {
    ...runtimeResult.runtime,
    // Parsing config for a development preview must not imply that another
    // durable full-project build exists.
    buildNumber: input.runtime.buildNumber,
    builtAt: input.runtime.builtAt,
  };

  const prepared = prepareProjectSnapshotFiles(input.files);
  const snapshot: ProjectSnapshot = {
    projectId: PROJECT_ID,
    revision: input.projectRevision,
    files: prepared.files,
  };
  const job = await createCompileJob({
    jobId: `development-preview:${crypto.randomUUID()}`,
    snapshot,
    compilerVersion: BROWSER_LAB_COMPILER_VERSION,
    entryPoints: [CAPSTONE_ENTRY_PATH],
  });
  const compiler = new BrowserLabCompilerClient();
  try {
    const program = await compiler.compile(job, { signal: input.signal });
    const entry = program.modules.find((module) => module.modulePath === CAPSTONE_ENTRY_PATH);
    if (!entry) {
      throw developmentPreviewFailure(
        "The current project did not produce its Browser Chat entrypoint.",
        CAPSTONE_ENTRY_PATH,
      );
    }
    const bundle = await verifyPreviewBundle({
      projectId: PROJECT_ID,
      buildId: `development:${program.sourceHash.slice("sha256:".length, "sha256:".length + 32)}`,
      buildNumber: Math.max(1, runtime.buildNumber),
      projectRevision: program.projectRevision,
      sourceHash: program.sourceHash,
      entryPath: entry.modulePath,
      code: entry.code,
      codeHash: entry.codeHash,
    });
    const behavior = await runCapstoneBehaviorContract({
      modulePath: bundle.entryPath,
      code: bundle.code,
      codeHash: bundle.codeHash,
    }, {
      signal: input.signal,
      runtimeSource: input.runtimeSource,
      fixture: {
        selectedBackend: "local",
        assistantName: runtime.interface.assistantName,
        responsePrefix: runtime.interface.responsePrefix,
        showMetrics: runtime.interface.showMetrics,
      },
    });
    if (!behavior.passed) {
      throw developmentPreviewFailure(behavior.detail, CAPSTONE_COMPONENT_PATH);
    }
    return { bundle, runtime };
  } catch (error) {
    if (input.signal?.aborted) throw error;
    if (error && typeof error === "object"
      && (error as { code?: unknown }).code === "DEVELOPMENT_PREVIEW_FAILED") throw error;
    const message = error instanceof Error
      ? error.message
      : "The current Browser Chat project did not compile.";
    const path = Object.keys(input.files).find((candidate) => message.includes(candidate));
    throw developmentPreviewFailure(message, path);
  } finally {
    compiler.dispose();
  }
}

/** A development preview may use only a checkpoint trained from its exact current model source. */
export async function currentDevelopmentStudentArtifact(
  files: Readonly<Record<string, ProjectFile>>,
  artifact: SavedRnnArtifact | undefined,
  checkpoint: CheckpointRecord | undefined,
  modelPath: string,
): Promise<SavedRnnArtifact | null> {
  const source = files[modelPath]?.content;
  if (!source
    || artifact?.origin !== "python"
    || !artifact.checkpointId
    || checkpoint?.id !== artifact.checkpointId
    || artifact.sourcePath !== modelPath
    || !artifact.sourceHash) return null;
  const sourceHash = await hashText(source);
  if (artifact.sourceHash !== sourceHash) return null;
  return sourceBoundPythonRnnArtifactFromCheckpoint(checkpoint, modelPath, sourceHash);
}
