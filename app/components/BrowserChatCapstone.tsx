"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sampleCharacterRnn } from "@latent/model-lab/character-rnn";
import { sourceBoundPythonRnnArtifactFromCheckpoint, useLearnerState, type SavedRnnArtifact } from "../lib/learner-state";
import { useProjectState, type ProjectState } from "../lib/project-workspace";
import { expectedProjectContractIdsForPath, projectLessonBuildStatus, projectResultsForFile, trustedProjectResults } from "../lib/project-file-status";
import { canonicalLessonSeeds, reconcileCanonicalProject } from "../lib/canonical-project";
import { recordLearningEvent } from "../lib/learning-analytics";
import { createLatestConversationWriter, loadCapstoneConversation } from "../features/capstone/conversation-store";
import { LocalModelClient } from "../runtime/model/local-model-client";
import { LOCAL_MODEL_MAX_NEW_TOKENS, type ModelMessage } from "../runtime/model/protocol";
import { getPersistenceContext } from "../platform/persistence/client";
import { createMockServingStream, parseSseChunk as parseMockSseChunk } from "@latent/mock-services/sse";
import {
  LLM_LESSON_SOURCES,
  LLM_RUNTIME_CAPABILITIES,
  certifiedCapstoneRuntimeConfig,
  loadValidatedCapstoneBundle,
  type CapstoneRuntimeDescriptor,
  type CertifiedCapstoneRuntimeConfig,
} from "../runtime/bindings";
import {
  mountPreviewFrame,
  PREVIEW_REACT_RUNTIME_PATH,
  verifyPreviewBundle,
  verifyPreviewRuntime,
  type PreviewFrameSession,
  type PreviewJson,
  type PreviewRequestMessage,
  type ValidatedPreviewBundle,
  type ValidatedPreviewRuntime,
} from "../runtime/capstone/preview-frame";
import type { CapstoneBackend, PersistedChatMessage } from "../lib/capstone-contract";
import { CAPSTONE_COMPONENT_PATH as CANONICAL_CAPSTONE_COMPONENT_PATH } from "../../products/courses/reference-curriculum/content/browser-chat/project-template";
import { PYTHON_CHARACTER_RNN_PATH } from "../features/python/character-rnn-source";
import { courseLessons, getLesson } from "../../products/courses/reference-curriculum/lessons/course";
import { portfolioReadiness } from "../lib/portfolio-export";

const ALLOWED_METHODS = new Set(["initialize", "load-local", "generate", "cancel", "persist"]);

type GenerationPayload = {
  logicalRequestId: string;
  attemptId: string;
  requestId: string;
  backend: CapstoneBackend;
  messages: ModelMessage[];
  requestFrame: string;
  options: { temperature: number; topK: number; maxTokens: number };
};

type ActiveGenerationResource = {
  controller: AbortController;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  decoder: TextDecoder | null;
  frameRemainder: string;
};

async function releaseGenerationResource(resource: ActiveGenerationResource, cancelReader: boolean) {
  const reader = resource.reader;
  resource.reader = null;
  resource.decoder = null;
  resource.frameRemainder = "";
  if (!reader) return;
  try {
    if (cancelReader) await reader.cancel("Generation lifecycle ended.");
  } catch {
    // The stream may already have closed while cancellation was propagating.
  } finally {
    try { reader.releaseLock(); } catch { /* The reader may already be released. */ }
  }
}

export async function cancelActiveGenerationResources(
  generationRequests: Map<string, ActiveGenerationResource>,
  cancelLocalRequest: (requestId: string) => void,
) {
  const releases: Promise<void>[] = [];
  for (const [requestId, resource] of generationRequests) {
    resource.controller.abort();
    try { cancelLocalRequest(requestId); } catch { /* Teardown must continue across every active request. */ }
    releases.push(releaseGenerationResource(resource, true));
  }
  generationRequests.clear();
  await Promise.all(releases);
}

type HostStatus = "loading" | "ready" | "missing" | "error";

type CapstoneFailure = {
  code: string | null;
  message: string;
};

export type CapstoneProgress = {
  verifiedLessonFiles: number;
  totalLessonFiles: number;
  passingTests: number;
  totalTests: number;
  nextPath: string;
  nextTitle: string;
};

export type CapstoneRecovery = {
  eyebrow: string;
  title: string;
  summary: string;
  path: string | null;
  pathLabel: string;
  why: string;
  action: "lesson" | "project" | "workspace" | "retry";
  actionLabel: string;
  actionPath?: string;
  href: string;
  blockedStage: "source" | "build" | "preview";
};

const CAPSTONE_COMPONENT_PATH = CANONICAL_CAPSTONE_COMPONENT_PATH;
const CAPSTONE_ENTRY_PATH = LLM_RUNTIME_CAPABILITIES.find((definition) => definition.capability === "ui.mount")?.modulePath
  ?? "capstone/main.tsx";

const CAPABILITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "ui.mount": "React preview entrypoint · export mount",
  "transport.parse-sse": "Streaming parser · export parseSseChunk",
  "serving.should-retry": "Retry policy · export shouldRetry",
  "chat.select-context": "Context policy · export selectContext",
});

const CAPABILITY_SOURCE: Readonly<Record<string, { path: string; label: string }>> = Object.freeze(Object.fromEntries(
  LLM_RUNTIME_CAPABILITIES.filter((definition) => definition.required).map((definition) => [definition.capability, {
    path: definition.modulePath,
    label: CAPABILITY_LABELS[definition.capability]
      ?? `${definition.modulePath.split("/").at(-1) ?? definition.modulePath} · export ${definition.exportName}`,
  }]),
));

const CAPABILITY_LESSON: Readonly<Record<string, string>> = Object.freeze({
  "ui.mount": "chat-product-quality",
  "transport.parse-sse": "streaming-transport",
  "serving.should-retry": "reliability-observability",
  "chat.select-context": "chat-actions-context",
});

function workspaceHref(path: string) {
  return `/workspace?file=${encodeURIComponent(path)}`;
}

function lessonTargetForPath(path: string) {
  const source = LLM_LESSON_SOURCES.find((lesson) => lesson.sourcePath === path);
  const lesson = source ? getLesson(source.lessonId) : undefined;
  return source ? {
    href: `/lessons/${source.lessonId}#implementation`,
    title: lesson?.title ?? source.moduleTitle,
  } : null;
}

/** Summarizes only learner-visible evidence; it never treats a partial test run as a passing build. */
export function summarizeCapstoneProgress(
  project: Pick<ProjectState, "files" | "tests">,
  verifiedLessons: Readonly<Record<string, { content: string; verifiedCells: number; totalCells: number }>>,
): CapstoneProgress {
  const trustedResults = trustedProjectResults(project.tests);
  const lessonFiles = LLM_LESSON_SOURCES.map((lesson) => {
    const file = project.files[lesson.sourcePath] ?? {
      path: lesson.sourcePath,
      title: lesson.sourcePath.split("/").at(-1) ?? lesson.sourcePath,
      content: undefined,
      verifiedCells: 0,
      totalCells: 1,
    };
    const expected = verifiedLessons[lesson.sourcePath];
    return {
      file,
      status: projectLessonBuildStatus({
        projectSource: file.content,
        verifiedSource: expected?.content,
        verifiedCells: expected?.verifiedCells ?? 0,
        totalCells: expected?.totalCells ?? file.totalCells,
        trustedResults: projectResultsForFile(trustedResults, lesson.sourcePath),
        expectedContractIds: expectedProjectContractIdsForPath(lesson.sourcePath),
      }),
    };
  });
  const verifiedLessonFiles = lessonFiles.filter(({ status }) => status.complete).length;
  const results = Object.values(trustedResults).flat();
  const next = lessonFiles.find(({ status }) => !status.complete);
  const nextPath = next?.file.path ?? CAPSTONE_COMPONENT_PATH;
  return {
    verifiedLessonFiles,
    totalLessonFiles: lessonFiles.length,
    passingTests: results.filter((result) => result.passed).length,
    totalTests: results.length,
    nextPath,
    nextTitle: project.files[nextPath]?.title ?? nextPath.split("/").at(-1) ?? nextPath,
  };
}

export function capstoneMissingBuildRecovery(progress: CapstoneProgress): CapstoneRecovery {
  const sourceComplete = progress.totalLessonFiles > 0 && progress.verifiedLessonFiles === progress.totalLessonFiles;
  if (!sourceComplete) {
    const lessonTarget = lessonTargetForPath(progress.nextPath);
    return {
      eyebrow: "You need a passing build",
      title: "Finish the next module.",
      summary: progress.totalLessonFiles
        ? `${progress.verifiedLessonFiles} of ${progress.totalLessonFiles} lesson files are verified.`
        : "No lesson files are ready yet.",
      path: progress.nextPath,
      pathLabel: `Next source · ${progress.nextPath}`,
      why: "This is the first unfinished lesson contribution the capstone still needs. Return to its explanation and implementation before opening the file in the IDE.",
      action: lessonTarget ? "lesson" : "workspace",
      actionLabel: lessonTarget ? `Continue ${lessonTarget.title}` : `Open ${progress.nextTitle}`,
      href: lessonTarget?.href ?? workspaceHref(progress.nextPath),
      blockedStage: "source",
    };
  }
  return {
    eyebrow: "Run a full build",
    title: "Run the full project tests.",
    summary: `All ${progress.totalLessonFiles} lesson files are verified. The preview needs one passing build of the current source.`,
    path: CAPSTONE_COMPONENT_PATH,
    pathLabel: `Final integration · ${CAPSTONE_COMPONENT_PATH}`,
    why: "A passing full build puts every verified Python lesson, the tested browser adapters, and the React app into one snapshot before any project code reaches the preview.",
    action: "project",
    actionLabel: "Review the project and run the full build",
    href: "/project",
    blockedStage: "build",
  };
}

export function capstoneReadyGateCopy(buildNumber: number) {
  return {
    eyebrow: `Verified build ${buildNumber}`,
    title: "Browser Chat is ready.",
    summary: "The current source and React app passed together and can run in the isolated browser preview.",
  } as const;
}

export function capstoneStaleBuildRecovery(buildNumber: number, progress: CapstoneProgress): CapstoneRecovery {
  return {
    eyebrow: `Last passing build ${buildNumber}`,
    title: "Rebuild your current changes.",
    summary: `Build #${buildNumber} still passes its saved source, but the project has changed since then.`,
    path: progress.nextPath,
    pathLabel: `Current project · ${progress.nextPath}`,
    why: "Run the full project checks again so the active build and preview use the files that are open now.",
    action: "project",
    actionLabel: "Review the project and rebuild",
    href: "/project",
    blockedStage: "build",
  };
}

export function capstoneMilestoneEvidence(
  status: HostStatus,
  verifiedBuildNumber: number | null,
  lastPassingBuildNumber: number | null,
  progress: CapstoneProgress,
  artifact: SavedRnnArtifact | undefined,
) {
  const lessonFiles = progress.totalLessonFiles
    ? `${progress.verifiedLessonFiles}/${progress.totalLessonFiles} ready`
    : "Restoring project files";
  const checkpoint = status === "ready"
    ? "Current source-bound Python checkpoint"
    : artifact?.origin === "python" && artifact.sourcePath === PYTHON_CHARACTER_RNN_PATH && artifact.sourceHash
      ? "Source-bound Python checkpoint saved · retrain after model edits"
      : artifact?.origin === "python"
        ? "Python checkpoint is not bound to the current source"
        : artifact
          ? "JavaScript lesson model only · Python checkpoint required"
          : "Not trained from Python yet";
  const appBuild = status === "ready" && verifiedBuildNumber
    ? `Build #${verifiedBuildNumber} passes the current source`
    : status === "loading"
      ? "Checking the current source"
      : lastPassingBuildNumber
        ? `Last passing build #${lastPassingBuildNumber} · current changes need rebuild`
        : "No passing full-project build yet";
  return [
    { label: "Lesson files", value: lessonFiles },
    { label: "Model checkpoint", value: checkpoint },
    { label: "App build", value: appBuild },
  ] as const;
}

function failureRecord(error: unknown): CapstoneFailure {
  if (!error || typeof error !== "object") {
    return { code: null, message: typeof error === "string" ? error : "Latent couldn’t verify the active capstone build." };
  }
  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate.code === "string" ? candidate.code : null,
    message: typeof candidate.message === "string" ? candidate.message : "Latent couldn’t verify the active capstone build.",
  };
}

/** Converts host verification failures into a concrete, non-jargon repair step without weakening the gate. */
export function capstoneRecoveryForFailure(error: unknown, progress: CapstoneProgress): CapstoneRecovery {
  const failure = failureRecord(error);
  if (failure.code === "MISSING_SOURCE_BOUND_CHECKPOINT") {
    return {
      eyebrow: "You need a Python checkpoint",
      title: "Train the current model file.",
      summary: `The active build has no checkpoint trained from the current ${PYTHON_CHARACTER_RNN_PATH}.`,
      path: PYTHON_CHARACTER_RNN_PATH,
      pathLabel: `Model source · ${PYTHON_CHARACTER_RNN_PATH}`,
      why: "Return to Character RNNs for the model contract, then open its project file and choose Test & train. The capstone can’t use imported checkpoints, JavaScript demo weights, or checkpoints from older source.",
      action: "lesson",
      actionLabel: "Return to Character RNNs",
      actionPath: PYTHON_CHARACTER_RNN_PATH,
      href: "/lessons/character-rnns#implementation",
      blockedStage: "build",
    };
  }
  const capability = Object.keys(CAPABILITY_SOURCE).find((candidate) => failure.message.includes(candidate));
  const source = capability ? CAPABILITY_SOURCE[capability as keyof typeof CAPABILITY_SOURCE] : null;
  if (source || failure.code === "MISSING_CAPSTONE_UI" || failure.code === "UNVERIFIED_CAPSTONE_UI") {
    const target = source ?? CAPABILITY_SOURCE["ui.mount"];
    const isEntrypoint = target.path === CAPSTONE_ENTRY_PATH;
    const lessonId = capability ? CAPABILITY_LESSON[capability] : CAPABILITY_LESSON["ui.mount"];
    const lesson = lessonId ? getLesson(lessonId) : undefined;
    return {
      eyebrow: "The build is missing a required piece",
      title: isEntrypoint ? "Rebuild the React entrypoint." : "Rebuild the missing runtime export.",
      summary: `The active build does not verify ${target.path}.`,
      path: target.path,
      pathLabel: target.label,
      why: isEntrypoint
        ? "This provided entrypoint mounts your editable BrowserChat component in the isolated preview. A fresh full build reconnects it; you don’t need to edit the provided file."
        : "The finished chatbot needs this tested export. Rebuilding adds its current source and test result to the active build.",
      action: lessonId ? "lesson" : "workspace",
      actionLabel: lessonId ? `Return to ${lesson?.title ?? "the relevant lesson"}` : `Open ${isEntrypoint ? "BrowserChat.tsx" : target.path.split("/").at(-1)} · Test, build & run`,
      actionPath: isEntrypoint ? CAPSTONE_COMPONENT_PATH : target.path,
      href: lessonId ? `/lessons/${lessonId}#implementation` : workspaceHref(isEntrypoint ? CAPSTONE_COMPONENT_PATH : target.path),
      blockedStage: "build",
    };
  }
  if (failure.message.includes("trusted React preview runtime") || failure.code === "PREVIEW_RUNTIME_ERROR") {
    return {
      eyebrow: "The preview can’t start",
      title: "Reload the isolated preview.",
      summary: "The passing build is intact, but the preview runtime did not start.",
      path: null,
      pathLabel: "Course preview runtime · your source didn’t change",
      why: "Reloading tries the course runtime again and rechecks the bundle before the iframe gets any code.",
      action: "retry",
      actionLabel: "Reload and verify again",
      href: "/capstone",
      blockedStage: "preview",
    };
  }
  if (failure.code === "INCOMPLETE_BUILD_CONTRIBUTIONS") {
    const missingPath = LLM_LESSON_SOURCES.find((lesson) => failure.message.includes(lesson.sourcePath))?.sourcePath
      ?? progress.nextPath;
    const lessonTarget = lessonTargetForPath(missingPath);
    return {
      eyebrow: "A lesson file is missing",
      title: "Rebuild the whole project.",
      summary: "The active build does not include every lesson file.",
      path: missingPath,
      pathLabel: `Missing contribution · ${missingPath}`,
      why: "The capstone keeps track of every lesson file in the build, even when the app doesn’t call a file directly at runtime.",
      action: lessonTarget ? "lesson" : "workspace",
      actionLabel: lessonTarget ? `Return to ${lessonTarget.title}` : `Open ${missingPath.split("/").at(-1)} · run the full build`,
      actionPath: missingPath,
      href: lessonTarget?.href ?? workspaceHref(missingPath),
      blockedStage: "source",
    };
  }
  const lessonTarget = lessonTargetForPath(progress.nextPath);
  return {
    eyebrow: "Your project changed",
    title: "Build the current code.",
    summary: "The active build does not match the current project.",
    path: progress.nextPath,
    pathLabel: `Start with · ${progress.nextPath}`,
    why: "A new full build rechecks the source hashes, required exports, and React entrypoint together.",
    action: lessonTarget ? "lesson" : "project",
    actionLabel: lessonTarget ? `Return to ${lessonTarget.title}` : "Review the project and rebuild",
    href: lessonTarget?.href ?? "/project",
    blockedStage: "build",
  };
}

export type CapabilityAdmission =
  | "accepted"
  | "model-preparation-busy"
  | "duplicate-generation"
  | "generation-busy";

/** Pure admission gate kept outside the iframe's control. */
export class CapstoneCapabilityGate {
  #preparation: "train" | "load" | null = null;
  readonly #generations = new Set<string>();

  beginPreparation(kind: "train" | "load"): CapabilityAdmission {
    if (this.#preparation) return "model-preparation-busy";
    if (this.#generations.size) return "generation-busy";
    this.#preparation = kind;
    return "accepted";
  }

  finishPreparation(kind: "train" | "load"): void {
    if (this.#preparation === kind) this.#preparation = null;
  }

  beginGeneration(requestId: string): CapabilityAdmission {
    if (this.#preparation) return "model-preparation-busy";
    if (this.#generations.has(requestId)) return "duplicate-generation";
    if (this.#generations.size) return "generation-busy";
    this.#generations.add(requestId);
    return "accepted";
  }

  finishGeneration(requestId: string): void {
    this.#generations.delete(requestId);
  }

  reset(): void {
    this.#preparation = null;
    this.#generations.clear();
  }
}

const COURSE_GROUNDING = [
  {
    terms: ["causal", "mask", "future"],
    minTerms: 2,
    answer: "A causal mask keeps position t from looking at later positions. Softmax gives those logits zero probability, so a token can’t peek at the target it’s supposed to predict.",
  },
  {
    terms: ["sse", "stream", "chunk"],
    minTerms: 1,
    answer: "SSE events end with a blank line, but network chunks can break anywhere. A good parser holds onto incomplete bytes and only sends out complete events.",
  },
  {
    terms: ["token", "subword", "bpe"],
    minTerms: 1,
    answer: "Subword tokenization learns which symbols often go together. Common sequences get shorter, while rare words can still be built from smaller pieces.",
  },
];

function courseReference(question: string) {
  const normalized = question.toLowerCase();
  const match = COURSE_GROUNDING.find((entry) => entry.terms.filter((term) => normalized.includes(term)).length >= entry.minTerms);
  return match?.answer ?? null;
}

export function composeLocalModelResponse(question: string, draft: string) {
  const modelDraft = draft.trim();
  const reference = courseReference(question);
  const sampledSection = modelDraft || "[The local model returned no text for this sample.]";
  return {
    modelDraft,
    reference,
    response: [
      "Local Transformer sample · using your generation settings",
      sampledSection,
      ...(reference ? [
        "Course note · fixed explanation · generation settings don’t change this section · not counted in generated units",
        reference,
      ] : []),
    ].join("\n\n"),
  };
}

export function applyInterfaceResponsePrefix(prefix: string, response: string) {
  return `${prefix}${response}`;
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number, integer = false) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const bounded = Math.min(maximum, Math.max(minimum, numeric));
  return integer ? Math.round(bounded) : bounded;
}

export function canonicalGenerationRequestFrame(
  logicalRequestId: string,
  attemptId: string,
  requestId: string,
  backend: CapstoneBackend,
  messages: readonly ModelMessage[],
) {
  return `event: request\ndata: ${JSON.stringify({
    logicalRequestId,
    attemptId,
    requestId,
    backend,
    messages: messages.map(({ role, content }) => ({ role, content })),
  })}\n\n`;
}

export function generationPayload(value: PreviewJson): GenerationPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, PreviewJson>;
  const backend = candidate.backend;
  const logicalRequestId = candidate.logicalRequestId;
  const attemptId = candidate.attemptId;
  const requestId = candidate.requestId;
  const requestFrame = candidate.requestFrame;
  const rawMessages = candidate.messages;
  const rawOptions = candidate.options;
  if ((backend !== "student" && backend !== "local")
    || typeof logicalRequestId !== "string" || !logicalRequestId.trim() || logicalRequestId.length > 128
    || typeof attemptId !== "string" || !attemptId.trim() || attemptId.length > 128
    || typeof requestId !== "string" || !requestId.trim() || requestId.length > 128
    || typeof requestFrame !== "string" || requestFrame.length > 64_000 || !Array.isArray(rawMessages)
    || rawMessages.length > 32 || !rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions)) return null;
  const messages: ModelMessage[] = [];
  let characters = 0;
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const message = raw as Record<string, PreviewJson>;
    if ((message.role !== "system" && message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return null;
    characters += message.content.length;
    if (characters > 48_000) return null;
    messages.push({ role: message.role, content: message.content });
  }
  const options = rawOptions as Record<string, PreviewJson>;
  if (requestFrame !== canonicalGenerationRequestFrame(logicalRequestId, attemptId, requestId, backend, messages)) return null;
  return {
    logicalRequestId,
    attemptId,
    requestId,
    backend,
    messages,
    requestFrame,
    options: {
      temperature: boundedNumber(options.temperature, 0.72, 0.2, 1.8),
      topK: boundedNumber(options.topK, 24, 0, 64, true),
      maxTokens: boundedNumber(options.maxTokens, LOCAL_MODEL_MAX_NEW_TOKENS, 40, LOCAL_MODEL_MAX_NEW_TOKENS, true),
    },
  };
}

function safeConversationWrite(value: PreviewJson): { selectedBackend: CapstoneBackend; messages: PersistedChatMessage[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, PreviewJson>;
  if (Object.keys(payload).length !== 2 || !("record" in payload) || !("selectedBackend" in payload)
    || (payload.selectedBackend !== "student" && payload.selectedBackend !== "local")) return null;
  const record = payload.record;
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const candidate = record as Record<string, PreviewJson>;
  const recordKeys = Object.keys(candidate);
  if (recordKeys.length !== 3 || !recordKeys.every((key) => ["version", "id", "messages"].includes(key))) return null;
  if (candidate.version !== 1 || typeof candidate.id !== "string" || !candidate.id.trim() || candidate.id.length > 128
    || !Array.isArray(candidate.messages) || candidate.messages.length > 200) return null;
  const messages: PersistedChatMessage[] = [];
  let characters = 0;
  for (const raw of candidate.messages) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const message = raw as Record<string, PreviewJson>;
    const messageKeys = Object.keys(message);
    if (!messageKeys.every((key) => ["id", "role", "backend", "content", "status", "attemptId", "parentUserId"].includes(key))
      || !["id", "role", "backend", "content", "status"].every((key) => key in message)) return null;
    if (typeof message.id !== "string" || !message.id.trim() || message.id.length > 128
      || (message.role !== "user" && message.role !== "assistant")
      || (message.backend !== "student" && message.backend !== "local") || typeof message.content !== "string" || message.content.length > 20_000
      || (message.status !== "complete" && message.status !== "cancelled" && message.status !== "error")) return null;
    if (("attemptId" in message && (typeof message.attemptId !== "string" || !message.attemptId.trim() || message.attemptId.length > 128))
      || ("parentUserId" in message && (typeof message.parentUserId !== "string" || !message.parentUserId.trim() || message.parentUserId.length > 128))) return null;
    characters += message.content.length;
    if (characters > 200_000) return null;
    messages.push({
      id: message.id,
      role: message.role,
      backend: message.backend,
      content: message.content,
      status: message.status,
      ...(typeof message.attemptId === "string" ? { attemptId: message.attemptId } : {}),
      ...(typeof message.parentUserId === "string" ? { parentUserId: message.parentUserId } : {}),
    });
  }
  return { selectedBackend: payload.selectedBackend, messages };
}

function portableMessages(messages: PersistedChatMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    backend: message.backend,
    ...(message.attemptId ? { attemptId: message.attemptId } : {}),
    ...(message.parentUserId ? { parentUserId: message.parentUserId } : {}),
  }));
}

export function capstonePathPresentation(
  status: HostStatus,
  progress: CapstoneProgress,
  blockedStage?: CapstoneRecovery["blockedStage"],
  activeBuildIsCurrent = true,
) {
  const sourceComplete = progress.totalLessonFiles > 0 && progress.verifiedLessonFiles === progress.totalLessonFiles;
  const currentStatus: HostStatus = status === "ready" && !activeBuildIsCurrent ? "error" : status;
  return {
    sourceState: sourceComplete ? "complete" : blockedStage === "source" ? "current" : "pending",
    buildState: currentStatus === "ready" ? "complete" : currentStatus === "loading" || blockedStage === "build" || !activeBuildIsCurrent ? "current" : "pending",
    previewState: currentStatus === "ready" || blockedStage === "preview" ? "current" : "pending",
    previewDetail: currentStatus === "ready" ? "ready to run" : blockedStage === "preview" ? "reload the runtime" : "locked until the build passes",
  } as const;
}

export function BrowserChatCapstone() {
  const project = useProjectState();
  const learner = useLearnerState();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<PreviewFrameSession | null>(null);
  const runPreviewButtonRef = useRef<HTMLButtonElement | null>(null);
  const resetPreviewButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreRunFocusRef = useRef(false);
  const studentRef = useRef<SavedRnnArtifact | null>(null);
  const localModelRef = useRef<LocalModelClient | null>(null);
  const [conversationWriter] = useState(() => createLatestConversationWriter());
  const localReadyRef = useRef(false);
  const [bundle, setBundle] = useState<ValidatedPreviewBundle | null>(null);
  const [reactRuntime, setReactRuntime] = useState<ValidatedPreviewRuntime | null>(null);
  const [descriptor, setDescriptor] = useState<CapstoneRuntimeDescriptor | null>(null);
  const [buildRuntime, setBuildRuntime] = useState<CertifiedCapstoneRuntimeConfig | null>(null);
  const [status, setStatus] = useState<HostStatus>("loading");
  const [detail, setDetail] = useState("Loading your last passing project build…");
  const [runRequested, setRunRequested] = useState(false);
  const [failure, setFailure] = useState<CapstoneFailure | null>(null);
  const activeBuildIsCurrent = portfolioReadiness({ project, learner, lessons: courseLessons }).activeBuildMatchesTests;
  const presentedStatus: HostStatus = status === "ready" && !activeBuildIsCurrent ? "error" : status;

  useEffect(() => {
    let active = true;
    void (async () => {
      await reconcileCanonicalProject();
      if (!active) return;
      setStatus("loading");
      setBundle(null);
      setReactRuntime(null);
      setDescriptor(null);
      setBuildRuntime(null);
      studentRef.current = null;
      setRunRequested(false);
      setFailure(null);
      setDetail("Loading your last passing project build…");
      const { repositories } = await getPersistenceContext();
      const build = await repositories.builds.activeValidated("browser-chat");
      if (!build) {
        if (active) { setStatus("missing"); setDetail("There isn’t a passing full-project build on this device yet."); }
        return;
      }
      const expectedSourceHash = build.fileHashes[PYTHON_CHARACTER_RNN_PATH];
      const checkpoint = build.checkpointId
        ? await repositories.checkpoints.get(build.checkpointId)
        : undefined;
      const buildStudent = expectedSourceHash
        ? sourceBoundPythonRnnArtifactFromCheckpoint(checkpoint, PYTHON_CHARACTER_RNN_PATH, expectedSourceHash)
        : null;
      if (!buildStudent || buildStudent.checkpointId !== build.checkpointId) {
        throw Object.assign(
          new Error(`The active build has no local Python checkpoint trained from its exact ${PYTHON_CHARACTER_RNN_PATH} source.`),
          { code: "MISSING_SOURCE_BOUND_CHECKPOINT" },
        );
      }
      const loaded = await loadValidatedCapstoneBundle(build);
      const certifiedRuntime = certifiedCapstoneRuntimeConfig(build);
      const runtimeResponse = await fetch(PREVIEW_REACT_RUNTIME_PATH, {
        cache: "force-cache",
        credentials: "same-origin",
      });
      if (!runtimeResponse.ok) throw new Error("The trusted React preview runtime isn’t available.");
      const [verified, verifiedRuntime] = await Promise.all([
        verifyPreviewBundle({
          projectId: loaded.descriptor.projectId,
          buildId: loaded.descriptor.buildId,
          buildNumber: loaded.descriptor.buildNumber,
          projectRevision: loaded.descriptor.projectRevision,
          sourceHash: loaded.descriptor.fingerprints.sourceTree,
          entryPath: loaded.entryPath,
          code: loaded.code,
          codeHash: loaded.codeHash,
        }),
        runtimeResponse.text().then((source) => verifyPreviewRuntime(source)),
      ]);
      if (!active) return;
      studentRef.current = buildStudent;
      setDescriptor(loaded.descriptor);
      setBuildRuntime(certifiedRuntime);
      setBundle(verified);
      setReactRuntime(verifiedRuntime);
      setStatus("ready");
      setDetail(`Build ${loaded.descriptor.buildNumber} is verified. It runs with limited, isolated browser access. A stuck synchronous loop may still require reloading this tab.`);
    })().catch((error) => {
      if (!active) return;
      studentRef.current = null;
      setFailure(failureRecord(error));
      setStatus("error");
      setDetail("The active capstone build couldn’t be verified, so it didn’t run.");
    });
    return () => { active = false; };
  }, [project.activeBuild?.id]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!activeBuildIsCurrent || !iframe || !bundle || !reactRuntime || !descriptor || !buildRuntime || !runRequested) return;
    let disposed = false;
    const capabilityGate = new CapstoneCapabilityGate();
    const generationRequests = new Map<string, ActiveGenerationResource>();

    const emit = (requestId: string, event: string, payload: PreviewJson) => {
      if (disposed) return;
      try { sessionRef.current?.emit(requestId, event, payload); } catch { /* The frame may have closed. */ }
    };
    const respond = (requestId: string, value: PreviewJson) => {
      if (disposed) return;
      try { sessionRef.current?.respond(requestId, value); } catch { /* The frame may have closed. */ }
    };
    const fail = (requestId: string, code: string, message: string) => {
      if (disposed) return;
      try { sessionRef.current?.fail(requestId, code, message); } catch { /* The frame may have closed. */ }
    };

    const generate = async (bridgeRequestId: string, payload: GenerationPayload) => {
      const controller = new AbortController();
      const resource: ActiveGenerationResource = {
        controller,
        reader: null,
        decoder: null,
        frameRemainder: "",
      };
      generationRequests.set(payload.requestId, resource);
      const started = performance.now();
      emit(bridgeRequestId, "phase", { type: "phase", phase: "queued" });
      try {
        await Promise.resolve();
        const queueMs = performance.now() - started;
        emit(bridgeRequestId, "phase", { type: "phase", phase: "prefill" });
        const modelStarted = performance.now();
        const latestUser = [...payload.messages].reverse().find((message) => message.role === "user")?.content ?? "";
        let response: string;
        let generatedUnits = 0;
        let generatedUnitLabel = "Generated units";
        if (payload.backend === "student") {
          const student = studentRef.current;
          if (!student) throw new Error("This build doesn’t have a Python checkpoint for the current source. Test and train the model file, then rebuild.");
          const continuation = sampleCharacterRnn(student.checkpoint, latestUser, payload.options.maxTokens, payload.options.temperature, buildRuntime.model.seed, payload.options.topK);
          const checkpointLabel = student.origin === "python"
            ? "Python + NumPy checkpoint"
            : "checkpoint trained in the browser";
          response = `${checkpointLabel}\n\nCharacter continuation based on your prompt:\n\n…${latestUser.slice(-32)}${continuation}`;
          generatedUnits = continuation.length;
          generatedUnitLabel = "Generated characters";
        } else {
          const client = localModelRef.current;
          if (!client || !localReadyRef.current || !client.isReady()) {
            localReadyRef.current = false;
            throw new Error("Load the local model before you generate a response.");
          }
          let draft = "";
          const generation = await client.generate(payload.requestId, payload.messages.slice(-12), payload.options, { onDelta: (delta) => { draft += delta; } });
          const composed = composeLocalModelResponse(latestUser, draft);
          response = composed.response;
          generatedUnits = generation.generatedUnits;
          generatedUnitLabel = generation.unit === "stream-chunks" ? "Model stream chunks" : "Generated units";
        }
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const modelMs = performance.now() - modelStarted;
        emit(bridgeRequestId, "phase", { type: "phase", phase: "streaming" });
        const stream = createMockServingStream(
          applyInterfaceResponsePrefix(buildRuntime.interface.responsePrefix, response),
          controller.signal,
          buildRuntime.transport,
        );
        const reader = stream.getReader();
        const decoder = new TextDecoder("utf-8", { fatal: true });
        resource.reader = reader;
        resource.decoder = decoder;
        const acceptDecodedText = (decoded: string) => {
          if (!decoded) return;
          const parsed = parseMockSseChunk(resource.frameRemainder, decoded);
          resource.frameRemainder = parsed.remainder;
          emit(bridgeRequestId, "chunk", { type: "chunk", chunk: decoded });
        };
        let firstChunk = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted || resource.decoder !== decoder) throw new DOMException("Aborted", "AbortError");
          if (!firstChunk) firstChunk = performance.now();
          acceptDecodedText(decoder.decode(value, { stream: true }));
        }
        if (controller.signal.aborted || resource.decoder !== decoder) throw new DOMException("Aborted", "AbortError");
        let finalDecoded = "";
        try {
          finalDecoded = decoder.decode();
        } catch (error) {
          throw new Error("The generation stream ended with incomplete or invalid UTF-8 bytes.", { cause: error });
        }
        acceptDecodedText(finalDecoded);
        if (resource.frameRemainder.trim()) throw new Error("The generation stream ended with an incomplete SSE frame.");
        if (controller.signal.aborted || resource.decoder !== decoder) throw new DOMException("Aborted", "AbortError");
        await releaseGenerationResource(resource, false);
        const durationMs = performance.now() - started;
        emit(bridgeRequestId, "metrics", {
          type: "metrics",
          metrics: {
            queueMs: Math.round(queueMs),
            modelMs: Math.round(modelMs),
            ttftMs: Math.round((firstChunk || performance.now()) - started),
            generatedUnits,
            generatedUnitLabel,
            durationMs: Math.round(durationMs),
          },
        });
        emit(bridgeRequestId, "phase", { type: "phase", phase: controller.signal.aborted ? "cancelled" : "complete" });
        respond(bridgeRequestId, { status: controller.signal.aborted ? "cancelled" : "complete" });
      } catch (error) {
        const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
        if (!cancelled) controller.abort();
        await releaseGenerationResource(resource, true);
        if (cancelled) {
          emit(bridgeRequestId, "phase", { type: "phase", phase: "cancelled" });
          respond(bridgeRequestId, { status: "cancelled" });
        } else {
          const message = error instanceof Error ? error.message : "Generation failed.";
          emit(bridgeRequestId, "error", { type: "error", message, transient: false });
          fail(bridgeRequestId, "generation-failed", message);
        }
      } finally {
        await releaseGenerationResource(resource, false);
        if (generationRequests.get(payload.requestId) === resource) generationRequests.delete(payload.requestId);
        capabilityGate.finishGeneration(payload.requestId);
      }
    };

    const handleRequest = (request: PreviewRequestMessage) => {
      void (async () => {
        if (request.method === "initialize") {
          const saved = await loadCapstoneConversation();
          respond(request.requestId, {
            buildId: descriptor.buildId,
            buildNumber: descriptor.buildNumber,
            selectedBackend: saved.selectedBackend,
            studentReady: Boolean(studentRef.current),
            localReady: localReadyRef.current,
            conversation: { version: 1, id: "active", messages: portableMessages(saved.messages) },
            runtime: buildRuntime as unknown as PreviewJson,
          });
          return;
        }
        if (request.method === "load-local") {
          const admission = capabilityGate.beginPreparation("load");
          if (admission !== "accepted") return fail(request.requestId, admission, "Another model preparation or generation job is already active.");
          try {
            let client = localModelRef.current;
            if (!client) {
              client = new LocalModelClient();
              client.setUnavailableHandler(() => { localReadyRef.current = false; });
              localModelRef.current = client;
            }
            await client.load({ onProgress: (progress, progressDetail) => emit(request.requestId, "progress", { type: "progress", progress, detail: progressDetail }) });
            localReadyRef.current = client.isReady();
            if (!localReadyRef.current) throw new Error("The local-model worker never reported that it was ready.");
            respond(request.requestId, { ready: true });
          } finally {
            capabilityGate.finishPreparation("load");
          }
          return;
        }
        if (request.method === "generate") {
          const payload = generationPayload(request.payload);
          if (!payload) return fail(request.requestId, "invalid-generation", "The generation request was invalid or too large.");
          const admission = capabilityGate.beginGeneration(payload.requestId);
          if (admission !== "accepted") return fail(request.requestId, admission, "Only one unique model generation may run at a time.");
          await generate(request.requestId, payload);
          return;
        }
        if (request.method === "cancel") {
          const payload = request.payload && typeof request.payload === "object" && !Array.isArray(request.payload) ? request.payload as Record<string, PreviewJson> : null;
          if (typeof payload?.requestId === "string") {
            const resource = generationRequests.get(payload.requestId);
            if (resource) {
              resource.controller.abort();
              await releaseGenerationResource(resource, true);
            }
            localModelRef.current?.cancel(payload.requestId);
          }
          respond(request.requestId, null);
          return;
        }
        if (request.method === "persist") {
          const write = safeConversationWrite(request.payload);
          if (!write) return fail(request.requestId, "invalid-conversation", "The conversation record didn’t match the saved-data format.");
          await conversationWriter.enqueue(write.selectedBackend, write.messages);
          respond(request.requestId, null);
          return;
        }
        fail(request.requestId, "unknown-method", "The preview asked for a browser feature that isn’t available.");
      })().catch((error) => fail(request.requestId, "host-capability-failed", error instanceof Error ? error.message : "The browser feature stopped with an error."));
    };

    const previewSession = mountPreviewFrame({
      iframe,
      bundle,
      runtime: reactRuntime,
      allowedMethods: ALLOWED_METHODS,
      handlers: {
        onRequest: handleRequest,
        onReady: () => setDetail(`Build ${descriptor.buildNumber} is running from the IDE project.`),
        onError: (message) => {
          setFailure({ code: "PREVIEW_RUNTIME_ERROR", message: message.message });
          setStatus("error");
          setRunRequested(false);
          setDetail("The preview stopped before your code could continue.");
        },
        onProtocolViolation: () => setDetail("The preview ignored a message the app doesn’t allow."),
      },
    });
    sessionRef.current = previewSession;

    return () => {
      disposed = true;
      previewSession.dispose();
      sessionRef.current = null;
      const localModel = localModelRef.current;
      void cancelActiveGenerationResources(generationRequests, (requestId) => localModel?.cancel(requestId));
      capabilityGate.reset();
    };
  }, [activeBuildIsCurrent, buildRuntime, bundle, conversationWriter, descriptor, reactRuntime, runRequested]);

  useEffect(() => () => {
    sessionRef.current?.dispose();
    localModelRef.current?.dispose();
    localModelRef.current = null;
  }, []);

  useEffect(() => {
    if (presentedStatus !== "ready") return;
    const frame = window.requestAnimationFrame(() => {
      if (runRequested) {
        resetPreviewButtonRef.current?.focus();
      } else if (restoreRunFocusRef.current) {
        restoreRunFocusRef.current = false;
        runPreviewButtonRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [presentedStatus, runRequested]);

  const verifiedLessons = Object.fromEntries(canonicalLessonSeeds(learner).map((seed) => [seed.path, {
    content: seed.content,
    verifiedCells: seed.verifiedCells,
    totalCells: seed.totalCells,
  }]));
  const progress = summarizeCapstoneProgress(project, verifiedLessons);
  const staleBuild = status === "ready" && !activeBuildIsCurrent;
  const recovery = staleBuild
    ? capstoneStaleBuildRecovery(project.activeBuild?.buildNumber ?? descriptor?.buildNumber ?? 1, progress)
    : presentedStatus === "missing"
      ? capstoneMissingBuildRecovery(progress)
      : presentedStatus === "error"
        ? capstoneRecoveryForFailure(failure, progress)
        : null;
  const gateCopy = presentedStatus === "loading"
    ? {
        eyebrow: "Checking the build",
        title: "Checking your build",
        summary: "Verifying the current test result and preview bundle.",
      }
    : presentedStatus === "ready"
      ? capstoneReadyGateCopy(descriptor?.buildNumber ?? project.activeBuild?.buildNumber ?? 1)
      : recovery ?? capstoneMissingBuildRecovery(progress);
  const milestones = capstoneMilestoneEvidence(
    presentedStatus,
    presentedStatus === "ready" ? descriptor?.buildNumber ?? null : null,
    project.activeBuild?.buildNumber ?? null,
    progress,
    learner.artifacts.characterRnn,
  );

  return (
    <main className="compiled-capstone-shell">
      <header className="capstone-topbar">
        <Link className="wordmark" href="/" aria-label="Latent Courses home"><i />latent courses</Link>
        <div><strong>Browser Chat</strong></div>
        <nav><Link href="/courses/llm-systems">LLM Systems</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav>
      </header>
      {presentedStatus === "ready" && bundle && reactRuntime && buildRuntime && runRequested ? (
        <section className="compiled-capstone-runtime">
          <header><strong role="status" aria-live="polite" aria-atomic="true">{detail}</strong><button ref={resetPreviewButtonRef} type="button" onClick={() => { restoreRunFocusRef.current = true; setRunRequested(false); }}>Reset preview</button></header>
          <iframe ref={iframeRef} title="Browser Chat compiled project" sandbox="allow-scripts" />
        </section>
      ) : (
        <section
          className={`capstone-build-gate ${presentedStatus}`}
          aria-labelledby="capstone-gate-title"
          aria-busy={presentedStatus === "loading"}
        >
          <div className="capstone-gate-copy" role="status" aria-live="polite" aria-atomic="true">
            <h1 id="capstone-gate-title">{gateCopy.title}</h1>
            <p>{gateCopy.summary}</p>
          </div>

          <div className="capstone-progress-line" aria-label="Current project status">
            <progress
              aria-label="Verified lesson files"
              value={progress.verifiedLessonFiles}
              max={Math.max(1, progress.totalLessonFiles)}
            />
          </div>

          <dl className="capstone-milestones" aria-label="Capstone build evidence">
            {milestones.map((milestone) => <div key={milestone.label}><dt>{milestone.label}</dt><dd>{milestone.value}</dd></div>)}
          </dl>

          <div className="capstone-action">
            {presentedStatus === "ready" ? (
              <button ref={runPreviewButtonRef} type="button" onClick={() => { setRunRequested(true); void recordLearningEvent("capstone_started", { outcome: "passed" }); }}>
                Run preview
              </button>
            ) : recovery?.action === "retry" ? (
              <button type="button" onClick={() => window.location.reload()}>{recovery.actionLabel}</button>
            ) : recovery ? (
              <Link href={recovery.href} aria-label={recovery.action === "lesson"
                ? `${recovery.actionLabel}. Opens the lesson before the IDE.`
                : recovery.action === "project"
                  ? `${recovery.actionLabel}. Opens the project overview.`
                  : `${recovery.actionLabel}. Opens ${recovery.actionPath ?? recovery.path ?? "the project"} in the IDE.`}>{recovery.actionLabel} →</Link>
            ) : (
              <span className="capstone-verifying">Verifying…</span>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
