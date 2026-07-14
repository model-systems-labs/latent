import {
  CURRICULUM_MANIFEST_VERSION,
  defineCurriculumManifest,
} from "@latent/course-kit";

export const LLM_SYSTEMS_PROGRAM_ID = "llm-systems" as const;

export type LlmSystemsModuleId =
  | "model-foundations"
  | "inference-runtime"
  | "llm-serving"
  | "chat-integration";

/**
 * The learner-facing program. Module identity, route compatibility, and the
 * virtual project path are separate fields so content can be reorganized
 * without silently moving a learner's saved files.
 */
export const llmSystemsManifest = defineCurriculumManifest({
  schemaVersion: CURRICULUM_MANIFEST_VERSION,
  id: LLM_SYSTEMS_PROGRAM_ID,
  title: "Build an LLM System in Your Browser",
  shortTitle: "LLM Systems",
  thesis:
    "Implement the model, inference runtime, serving boundary, and React integration that form a complete browser-based LLM system.",
  outcome:
    "A tested, locally persisted chatbot that runs a real model and exposes the behavior implemented throughout the program.",
  capstone: {
    title: "Browser Chat",
    description:
      "Assemble the passing model, runtime, serving, and interface artifacts into a functional streaming chatbot.",
    projectPath: "capstone/BrowserChat.tsx",
  },
  modules: [
    {
      id: "model-foundations",
      routeSlug: "models",
      order: 1,
      title: "Model Foundations",
      shortTitle: "Models",
      thesis:
        "Build the numerical path from tokenization and learned representations to causal language modeling and local inference.",
      outcome:
        "A learner-trained character model plus a frozen local-model evaluation harness.",
      lessons: [
        { lessonId: "character-rnns", projectPath: "models/character-rnn.py" },
        { lessonId: "neural-language-models", projectPath: "models/neural-language-model.py" },
        { lessonId: "subword-tokenization", projectPath: "models/bpe-tokenizer.py" },
        { lessonId: "additive-attention", projectPath: "models/additive-attention.py" },
        { lessonId: "transformers", projectPath: "models/causal-transformer.py" },
        { lessonId: "in-context-learning", projectPath: "models/few-shot-evaluation.py" },
      ],
    },
    {
      id: "inference-runtime",
      routeSlug: "systems",
      order: 2,
      title: "Inference Runtime",
      shortTitle: "Runtime",
      thesis:
        "Implement prefill, decode, KV-cache accounting, admission, and continuous batching for autoregressive inference.",
      outcome:
        "An executable runtime model with explicit phase timing, memory use, and scheduling behavior.",
      lessons: [
        { lessonId: "inference-runtime", projectPath: "systems/inference-runtime.py" },
        { lessonId: "scheduling-memory", projectPath: "systems/continuous-batching.py" },
      ],
    },
    {
      id: "llm-serving",
      routeSlug: "backend",
      order: 3,
      title: "LLM Serving",
      shortTitle: "Serving",
      thesis:
        "Implement the streaming, cancellation, retry, failure, and observability contracts around model generation.",
      outcome:
        "A deterministic serving boundary and failure-injection harness for the browser chatbot.",
      lessons: [
        { lessonId: "streaming-transport", projectPath: "backend/streaming-transport.py" },
        { lessonId: "reliability-observability", projectPath: "backend/generation-reliability.py" },
      ],
    },
    {
      id: "chat-integration",
      routeSlug: "product",
      order: 4,
      title: "Chat Integration",
      shortTitle: "React",
      thesis:
        "Connect generation events to a resilient React state machine, context policy, persistence layer, and accessible interface.",
      outcome:
        "A polished streaming chat interface with recovery, context controls, and observable generation state.",
      lessons: [
        { lessonId: "conversation-state", projectPath: "product/chat-reducer.py" },
        { lessonId: "streaming-react", projectPath: "product/streaming-react.py" },
        { lessonId: "chat-actions-context", projectPath: "product/chat-actions.py" },
        { lessonId: "chat-product-quality", projectPath: "product/chat-quality.py" },
      ],
    },
  ],
} as const);

// This assignment makes accidental module-id drift a compile-time failure.
const moduleIds: readonly LlmSystemsModuleId[] = llmSystemsManifest.modules.map(
  (module) => module.id,
);
void moduleIds;
