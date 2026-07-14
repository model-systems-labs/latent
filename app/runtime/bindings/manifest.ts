import { llmSystemsManifest, type LlmSystemsModuleId } from "../../content/llm-systems";
import { BROWSER_CHAT_ADAPTER_PATHS } from "../../content/browser-chat/project-template";
import type {
  BindingManifest,
  RuntimeBinding,
} from "@latent/browser-lab";

export type CapstoneRuntimeConsumer =
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

/**
 * These are real JavaScript integration seams for the capstone. Learner
 * CPython and each matching course-provided adapter are checked against the
 * same host-owned behavioral cases. The exact passing Python bytes remain in
 * the promoted source identity; the trained character-RNN also crosses the
 * boundary as the checkpoint used by the student-model backend. Only adapters
 * enumerated here are claimed as runtime capabilities; the remaining read-only
 * adapters stay explicit, contract-tested instructional implementations.
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
        "Mounts the validated React capstone inside an opaque-origin sandboxed preview frame; its JavaScript imports resolve through course-provided adapters checked against the same contracts as the source-bound CPython lessons.",
    },
    {
      bindingId: "transport-encode-sse",
      capability: "transport.encode-sse",
      modulePath: BROWSER_CHAT_ADAPTER_PATHS.streamingTransport,
      exportName: "encodeSse",
      kind: "function",
      required: false,
      requirement: "adapter",
      consumer: "mock-stream-producer",
      summary:
        "A course-provided JavaScript adapter frames typed generation events for React and must pass every matching behavioral case used for the streaming-transport CPython implementation.",
    },
    {
      bindingId: "transport-parse-sse",
      capability: "transport.parse-sse",
      modulePath: BROWSER_CHAT_ADAPTER_PATHS.streamingTransport,
      exportName: "parseSseChunk",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "stream-consumer",
      summary:
        "A course-provided JavaScript adapter incrementally turns SSE text into typed React events and must pass every matching behavioral case used for the CPython parser.",
    },
    {
      bindingId: "serving-retry-policy",
      capability: "serving.should-retry",
      modulePath: BROWSER_CHAT_ADAPTER_PATHS.generationReliability,
      exportName: "shouldRetry",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "generation-recovery",
      summary:
        "A course-provided JavaScript adapter applies retry guards inside the React runtime and must pass every matching behavioral case used for the reliability CPython implementation.",
    },
    {
      bindingId: "chat-context-selection",
      capability: "chat.select-context",
      modulePath: BROWSER_CHAT_ADAPTER_PATHS.chatActions,
      exportName: "selectContext",
      kind: "function",
      required: true,
      requirement: "core",
      consumer: "prompt-context",
      summary:
        "A course-provided JavaScript adapter selects React's bounded prompt context and must pass every matching behavioral case used for the actions-and-context CPython implementation.",
    },
    {
      bindingId: "chat-generation-status",
      capability: "chat.generation-status",
      modulePath: BROWSER_CHAT_ADAPTER_PATHS.chatQuality,
      exportName: "generationStatusLabel",
      kind: "function",
      required: false,
      requirement: "adapter",
      consumer: "generation-presentation",
      summary:
        "A course-provided JavaScript adapter maps runtime phases to accessible React status text and must pass every matching behavioral case used for the product-quality CPython implementation.",
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
