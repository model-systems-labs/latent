"use client";

import { artifactBundleBlob, createArtifact, hashArtifactValue, type ArtifactEnvelope, type ArtifactJson } from "@latent/artifact-runtime";
import { getArtifactRuntime } from "@latent/artifact-runtime/client";
import { lessonArtifactBlueprintById, lessonArtifactBlueprints, previousArtifactLessonId } from "./lesson-blueprints";
import { recordedTrainingRegistry } from "./training-scenarios";
import { llmSystemsContractSuite } from "../../content/llm-systems/contracts";

export type ValidatedLessonResult = { id: string; label: string; passed: boolean; detail: string };

function artifactLink(artifact: ArtifactEnvelope, relation: "input" | "assembled-from" = "input") {
  return { artifactId: artifact.id, contentHash: artifact.contentHash, kind: artifact.kind, relation } as const;
}

export async function recordValidatedLessonArtifact(input: {
  lessonId: string;
  source: string;
  results: ValidatedLessonResult[];
}) {
  if (!input.results.length || input.results.some((result) => !result.passed)) throw new Error("Only a fully passing lesson can produce a validated artifact.");
  const blueprint = lessonArtifactBlueprintById.get(input.lessonId);
  if (!blueprint) throw new Error(`No artifact adapter is registered for ${input.lessonId}.`);
  const { store } = await getArtifactRuntime();
  const training = await recordedTrainingRegistry.materializeForLesson(input.lessonId, store);
  const previousLessonId = previousArtifactLessonId(input.lessonId);
  const previous = previousLessonId ? await store.latestForLesson(previousLessonId) : training?.run;
  const sourceHash = await hashArtifactValue(input.source);
  const artifact = await createArtifact({
    kind: blueprint.kind,
    mode: "learner-validated",
    title: blueprint.title,
    description: blueprint.description,
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
    labels: ["learner-source", "sandbox-validated", blueprint.kind],
    links: previous ? [artifactLink(previous)] : [],
    metrics: { contractsPassed: input.results.length, replayFrames: blueprint.frames.length },
    payload: {
      projectPath: blueprint.projectPath,
      sourceHash,
      result: blueprint.payload,
      contracts: input.results.map((result) => ({ id: result.id, label: result.label, detail: result.detail })),
    } as ArtifactJson,
    replay: { clock: blueprint.clock, unit: blueprint.unit, frames: blueprint.frames },
  });
  const stored = await store.put(artifact);
  await store.activate(stored, "lesson-output", input.lessonId);
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
    description: "The passing project build assembled from validated lesson artifacts and promoted by the source-bound test receipt.",
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
      throw new Error(`The passing project run did not produce a complete artifact input for ${blueprint.projectPath}.`);
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
  const url = URL.createObjectURL(artifactBundleBlob(bundle));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${artifact.kind}-${artifact.contentHash.slice(7, 15)}.latent-artifact.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
