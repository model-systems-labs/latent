import { llmSystemsManifest, type LlmSystemsModuleId } from "../../content/llm-systems";
import type {
  BindingManifest,
  RuntimeBinding,
} from "@latent/browser-lab";

export type CapstoneRuntimeConsumer =
  | "local-model-sampling"
  | "mock-stream-producer"
  | "stream-consumer"
  | "generation-recovery"
  | "prompt-context"
  | "generation-presentation"
  | "compiled-chat-ui";

export type LlmRuntimeCapabilityDefinition = RuntimeBinding & {
  consumer: CapstoneRuntimeConsumer;
  summary: string;
  /**
   * Core capabilities are needed to start the capstone runtime. Adapter
   * capabilities are used only when that backend or presentation feature is
   * selected and may be absent from an otherwise valid active build.
   */
  requirement: "core" | "adapter";
};

export type LlmLessonSourceDefinition = {
  lessonId: string;
  moduleId: LlmSystemsModuleId;
  moduleTitle: string;
  sourcePath: string;
};

const lessonSources = llmSystemsManifest.modules.flatMap((module) =>
  module.lessons.map((lesson) => ({
    lessonId: lesson.lessonId,
    moduleId: module.id as LlmSystemsModuleId,
    moduleTitle: module.title,
    sourcePath: lesson.projectPath,
  })),
);

/** The stable learner-owned source surface, derived from the curriculum. */
export const LLM_LESSON_SOURCES: readonly LlmLessonSourceDefinition[] =
  Object.freeze(lessonSources);

function sourcePathFor(lessonId: string): string {
  const lesson = LLM_LESSON_SOURCES.find((candidate) => candidate.lessonId === lessonId);
  if (!lesson) throw new Error(`LLM runtime binding references unknown lesson ${lessonId}.`);
  return lesson.sourcePath;
}

/**
 * These are real integration seams for the capstone. A binding only means the
 * export is eligible for isolated worker execution; it does not claim that
 * every lesson file is executable at runtime. Files without a binding remain
 * build provenance and are identified as such by the active-build adapter.
 */
export const LLM_RUNTIME_CAPABILITIES: readonly LlmRuntimeCapabilityDefinition[] =
  Object.freeze([
    {
      bindingId: "capstone-ui-mount",
      capability: "ui.mount",
      modulePath: "capstone/main.tsx",
      exportName: "mount",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "compiled-chat-ui",
      summary:
        "Mounts the validated React capstone inside an opaque-origin sandboxed preview frame.",
    },
    {
      bindingId: "model-softmax",
      capability: "model.softmax",
      modulePath: sourcePathFor("neural-language-models"),
      exportName: "stableSoftmax",
      kind: "function",
      required: false,
      requirement: "adapter",
      consumer: "local-model-sampling",
      summary:
        "Normalizes logits when the learner-built sampling adapter is selected; Transformers.js backends may own sampling internally.",
    },
    {
      bindingId: "transport-encode-sse",
      capability: "transport.encode-sse",
      modulePath: sourcePathFor("streaming-transport"),
      exportName: "encodeSse",
      kind: "function",
      required: false,
      requirement: "adapter",
      consumer: "mock-stream-producer",
      summary:
        "Frames typed generation events when the deterministic mock serving adapter is active.",
    },
    {
      bindingId: "transport-parse-sse",
      capability: "transport.parse-sse",
      modulePath: sourcePathFor("streaming-transport"),
      exportName: "parseSseChunk",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "stream-consumer",
      summary:
        "Incrementally turns streamed SSE bytes into typed generation events for the chat runtime.",
    },
    {
      bindingId: "serving-retry-policy",
      capability: "serving.should-retry",
      modulePath: sourcePathFor("reliability-observability"),
      exportName: "shouldRetry",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "generation-recovery",
      summary:
        "Decides whether a failed generation can be retried without duplicating visible output.",
    },
    {
      bindingId: "chat-context-selection",
      capability: "chat.select-context",
      modulePath: sourcePathFor("chat-actions-context"),
      exportName: "selectContext",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "prompt-context",
      summary:
        "Selects the bounded conversation prefix supplied to the model before each generation.",
    },
    {
      bindingId: "chat-generation-status",
      capability: "chat.generation-status",
      modulePath: sourcePathFor("chat-product-quality"),
      exportName: "generationStatusLabel",
      kind: "function",
      required: false,
      requirement: "adapter",
      consumer: "generation-presentation",
      summary:
        "Maps runtime phases to visible status text; the host retains an accessible fallback label.",
    },
  ] satisfies readonly LlmRuntimeCapabilityDefinition[]);

/** The course-authored manifest supplied when a passing build is promoted. */
export const llmRuntimeBindingManifest: BindingManifest = Object.freeze({
  schemaVersion: 1,
  bindings: Object.freeze(
    LLM_RUNTIME_CAPABILITIES.map(
      ({ bindingId, capability, modulePath, exportName, kind, required }) => ({
        bindingId,
        capability,
        modulePath,
        exportName,
        kind,
        required,
      }),
    ),
  ),
});

export const REQUIRED_LLM_RUNTIME_CAPABILITIES: readonly string[] = Object.freeze(
  LLM_RUNTIME_CAPABILITIES.filter((binding) => binding.required).map(
    (binding) => binding.capability,
  ),
);
