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
    "Build the model, inference runtime, serving layer, and React integration for a complete LLM system that runs in the browser.",
  outcome:
    "You'll end up with a tested chatbot that saves data locally, runs a real model, loads the RNN checkpoint you trained, and uses browser adapters checked against the same behavior as your Python code.",
  capstone: {
    title: "Browser Chat",
    description:
      "Take your passing Python files, trained checkpoint, matching browser adapters, and React interface and turn them into a working streaming chatbot.",
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
        "Build the full number-crunching path from tokenization and learned representations to causal language modeling and local inference.",
      outcome:
        "You'll have a character model you trained and a test setup for evaluating a frozen local model.",
      overview: {
        title: "From raw text to a model that predicts",
        introduction:
          "Language models are a chain of concrete transformations, not one mysterious operation. You will begin with a recurrent model that predicts one character at a time, then move through learned word representations, subword tokenization, attention, transformers, and repeatable evaluation of a frozen local model. Each lesson adds one piece to Browser Chat's model layer.",
        objectives: [
          "Trace text through tokens, learned vectors, logits, probabilities, and next-token loss.",
          "Explain how attention and causal masking change the way a model uses earlier context.",
          "Train a small character model and evaluate a frozen local model with repeatable tests.",
        ],
      },
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
        "Build prefill, decode, KV-cache accounting, admission, and continuous batching for autoregressive inference.",
      outcome:
        "You'll have a runtime model you can run, with clear timing for each phase, memory use, and scheduling behavior.",
      overview: {
        title: "Make generation measurable and schedulable",
        introduction:
          "A trained model still needs a runtime that can turn prompts into tokens without losing track of time or memory. This module follows one request through prefill and decode, then expands to the scheduling decisions required when several requests share the same model and KV cache.",
        objectives: [
          "Distinguish prefill work from token-by-token decode work and measure both phases.",
          "Account for KV-cache memory before admitting a request.",
          "Use continuous batching to make explicit tradeoffs between throughput and latency.",
        ],
      },
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
        "Build clear rules for streaming, cancellation, retries, failures, and observability around model generation.",
      outcome:
        "You'll have a repeatable serving layer and a failure-injection test setup for the browser chatbot.",
      overview: {
        title: "Turn generation into a dependable stream",
        introduction:
          "Serving begins where model generation meets an unreliable product boundary. You will define the events a client can trust, make cancellation and retry behavior explicit, and add enough evidence to understand failures instead of guessing from a spinner or a partial response.",
        objectives: [
          "Design a streaming event contract with clear terminal and error states.",
          "Handle cancellation, retries, and late events without corrupting request state.",
          "Instrument the serving path and verify recovery with controlled failure injection.",
        ],
      },
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
        "Connect generation events to a React state machine that can recover from problems, manage context, save data, and stay accessible.",
      outcome:
        "You'll have a polished streaming chat interface with recovery tools, context controls, and a clear view of generation state.",
      overview: {
        title: "Give the model a resilient product surface",
        introduction:
          "The final module turns runtime and transport behavior into an interface people can understand and recover. You will model the conversation as explicit state, preserve the identity of actions and attempts, assemble bounded context, and make visible behavior agree with saved and announced state.",
        objectives: [
          "Represent streaming conversation changes with a predictable state machine.",
          "Keep stop, retry, edit, and context-selection behavior bound to the right request.",
          "Ship accessible status, safe persistence, and recovery paths as product behavior.",
        ],
      },
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
