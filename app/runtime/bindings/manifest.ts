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
 * These are the JavaScript connection points used by the capstone. The
 * learner's CPython and each matching course adapter have to pass the same
 * host-owned behavior tests. The passing Python source stays tied to the build,
 * and the trained character RNN comes along as the student model's checkpoint.
 * Only the adapters listed here count as runtime capabilities. The rest stay
 * visible as read-only, tested examples.
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
        "The trusted host verifies the React capstone, then runs it in an opaque-origin sandboxed preview. Its JavaScript imports use course adapters that pass the same tests as the matching CPython lessons.",
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
        "This course-provided JavaScript adapter frames typed generation events for React and has to pass the same behavior tests as the streaming-transport CPython code.",
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
        "This course-provided JavaScript adapter turns incoming SSE text into typed React events as it arrives. It has to pass the same behavior tests as the CPython parser.",
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
        "This course-provided JavaScript adapter handles safe retries in React and has to pass the same behavior tests as the reliability CPython code.",
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
        "This course-provided JavaScript adapter chooses the prompt context that fits React's limit. It has to pass the same behavior tests as the actions-and-context CPython code.",
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
        "This course-provided JavaScript adapter turns runtime phases into accessible React status text. It has to pass the same behavior tests as the product-quality CPython code.",
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
