"use client";

import { artifactBundleBlob, createArtifact, hashArtifactValue, type ArtifactEnvelope, type ArtifactJson } from "@latent/artifact-runtime";
import { getArtifactRuntime } from "@latent/artifact-runtime/client";
import { lessonArtifactBlueprintById, lessonArtifactBlueprints, previousArtifactLessonId } from "./lesson-blueprints";
import { recordedTrainingRegistry } from "./training-scenarios";
import { llmSystemsContractSuite } from "../../content/llm-systems/contracts";
import { downloadBrowserBlob } from "../../lib/browser-download";

export type ValidatedLessonResult = { id: string; label: string; passed: boolean; detail: string };

export function lessonHasRecordedTraining(lessonId: string) {
  return recordedTrainingRegistry.scenarioIdForLesson(lessonId) !== null;
}

function artifactLink(artifact: ArtifactEnvelope, relation: "input" | "assembled-from" = "input") {
  return { artifactId: artifact.id, contentHash: artifact.contentHash, kind: artifact.kind, relation } as const;
}

export async function recordValidatedLessonArtifact(input: {
  lessonId: string;
  source: string;
  results: ValidatedLessonResult[];
  signal?: AbortSignal;
  isSourceCurrent?: () => boolean | Promise<boolean>;
}) {
  input.signal?.throwIfAborted();
  if (!input.results.length || input.results.some((result) => !result.passed)) throw new Error("Every lesson check must pass before Latent can create a validated artifact.");
  const blueprint = lessonArtifactBlueprintById.get(input.lessonId);
  if (!blueprint) throw new Error(`Latent doesn’t have an artifact adapter for ${input.lessonId}.`);
  const { store } = await getArtifactRuntime();
  input.signal?.throwIfAborted();
  const training = await recordedTrainingRegistry.materializeForLesson(input.lessonId, store);
  input.signal?.throwIfAborted();
  const previousLessonId = previousArtifactLessonId(input.lessonId);
  const previous = previousLessonId ? await store.latestForLesson(previousLessonId) : training?.run;
  input.signal?.throwIfAborted();
  const sourceHash = await hashArtifactValue(input.source);
  input.signal?.throwIfAborted();
  const artifact = await createArtifact({
    kind: blueprint.kind,
    mode: "learner-validated",
    title: blueprint.title,
    description: `${blueprint.description} Your saved code passed the lesson checks. The attached frames explain the result; they are course examples, not output from your code.`,
    projectId: "browser-chat",
    moduleId: blueprint.moduleId,
    lessonId: blueprint.lessonId,
    producer: { runtime: "browser-lab-quickjs", version: "1", operation: "validate-lesson-module", sourceHash },
    validation: {
      status: "passed",
      contractVersion: llmSystemsContractSuite.contractVersion,
      passedCount: input.results.length,
      totalCount: input.results.length,
    },
    labels: ["learner-source", "sandbox-validated", "course-authored-reference", blueprint.kind],
    links: previous ? [artifactLink(previous)] : [],
    metrics: { contractsPassed: input.results.length, referenceFrames: blueprint.frames.length },
    payload: {
      projectPath: blueprint.projectPath,
      sourceHash,
      reference: blueprint.payload,
      contracts: input.results.map((result) => ({ id: result.id, label: result.label, detail: result.detail })),
    } as ArtifactJson,
    replay: { clock: blueprint.clock, unit: blueprint.unit, frames: blueprint.frames },
  });
  input.signal?.throwIfAborted();
  const stored = await store.put(artifact);
  input.signal?.throwIfAborted();
  const activationGuard = input.signal || input.isSourceCurrent
    ? async () => {
        input.signal?.throwIfAborted();
        const current = input.isSourceCurrent ? await input.isSourceCurrent() : true;
        input.signal?.throwIfAborted();
        return current;
      }
    : undefined;
  await store.activate(stored, "lesson-output", input.lessonId, activationGuard);
  input.signal?.throwIfAborted();
  return stored;
}

export async function loadLessonArtifactView(lessonId: string) {
  const { store } = await getArtifactRuntime();
  const training = await recordedTrainingRegistry.materializeForLesson(lessonId, store);
  const previousId = previousArtifactLessonId(lessonId);
  const [current, previous] = await Promise.all([
    store.latestForLesson(lessonId),
    previousId ? store.latestForLesson(previousId) : Promise.resolve(undefined),
  ]);
  const output = current?.mode === "learner-validated" ? current : undefined;
  return { output, input: previous ?? training?.run, training };
}

export async function recordProjectBuildArtifact(input: {
  buildId: string;
  buildNumber: number;
  sourceTreeHash: string;
  testedModules: number;
  totalTests: number;
}) {
  const { store } = await getArtifactRuntime();
  const lessonArtifacts = (await Promise.all(lessonArtifactBlueprints.map((blueprint) => store.latestForLesson(blueprint.lessonId))))
    .filter((artifact): artifact is ArtifactEnvelope => Boolean(artifact?.mode === "learner-validated"));
  const artifact = await createArtifact({
    kind: "browser-chat-build",
    mode: "build",
    title: `Browser Chat build ${input.buildNumber}`,
    description: "The passing project build made from validated lesson artifacts and activated by test results tied to this exact source.",
    projectId: "browser-chat",
    moduleId: null,
    lessonId: null,
    producer: { runtime: "browser-lab-build-gate", version: "1", operation: "promote-build", sourceHash: input.sourceTreeHash },
    validation: { status: "passed", totalCount: input.totalTests, passedCount: input.totalTests, receiptId: input.buildId },
    labels: ["active-build", "capstone", "validated"],
    links: lessonArtifacts.map((item) => artifactLink(item, "assembled-from")),
    metrics: { buildNumber: input.buildNumber, testedModules: input.testedModules, totalTests: input.totalTests },
    payload: { buildId: input.buildId, sourceTreeHash: input.sourceTreeHash, lessonArtifactIds: lessonArtifacts.map((item) => item.id) },
    replay: {
      clock: "state",
      unit: "module assembly",
      frames: lessonArtifacts.map((item, index) => ({ index, at: index, label: item.title, payload: { artifactId: item.id, kind: item.kind }, metrics: { assembled: index + 1 } })),
    },
  });
  const stored = await store.put(artifact);
  await store.activate(stored, "project-build", "browser-chat");
  return stored;
}

export async function recordValidatedProjectLessonArtifacts(
  files: Record<string, { content: string }>,
  results: Array<ValidatedLessonResult & { path: string }>,
) {
  const artifacts: ArtifactEnvelope[] = [];
  for (const blueprint of lessonArtifactBlueprints) {
    const lessonResults = results.filter((result) => result.path === blueprint.projectPath);
    const expectedContracts = llmSystemsContractSuite.contracts.filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === blueprint.projectPath)).length;
    const file = files[blueprint.projectPath];
    if (!file || lessonResults.length !== expectedContracts || lessonResults.some((result) => !result.passed)) {
      throw new Error(`The passing project run didn’t produce all the artifact data needed for ${blueprint.projectPath}.`);
    }
    artifacts.push(await recordValidatedLessonArtifact({ lessonId: blueprint.lessonId, source: file.content, results: lessonResults }));
  }
  return artifacts;
}

export async function latestProjectBuildArtifact() {
  const { store } = await getArtifactRuntime();
  return store.active("browser-chat", "project-build", "browser-chat");
}

export async function downloadArtifact(artifact: ArtifactEnvelope) {
  const { store } = await getArtifactRuntime();
  const bundle = await store.bundle(artifact.id);
  downloadBrowserBlob(artifactBundleBlob(bundle), `${artifact.kind}-${artifact.contentHash.slice(7, 15)}.latent-artifact.json`);
}
