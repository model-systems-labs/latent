export type LearningChoice = {
  id: string;
  label: string;
};

export type LessonLearningOutcome = {
  concept: string;
  before: string;
  after: string;
  check: {
    id: string;
    prompt: string;
    choices: readonly LearningChoice[];
    correctChoiceId: string;
    explanation: string;
  };
};

export type ModuleCheckpointDefinition = {
  courseId: "models" | "systems" | "backend" | "product";
  moduleId: "model-foundations" | "inference-runtime" | "llm-serving" | "chat-integration";
  label: string;
  title: string;
  objective: string;
  before: string;
  after: string;
};

export const lessonLearningOutcomes: Readonly<Record<string, LessonLearningOutcome>> = {
  "character-rnns": {
    concept: "A recurrent hidden state makes the next-character distribution conditional on the complete processed prefix.",
    before: "Characters are treated as unrelated observations with no carried state.",
    after: "The same transition parameters update h_t at every position and produce prefix-conditioned logits.",
    check: {
      id: "state-carrier",
      prompt: "During character-by-character generation, which value carries information from the processed prefix into the next recurrent step?",
      choices: [
        { id: "hidden", label: "The previous hidden state h_(t-1)" },
        { id: "loss", label: "The scalar cross-entropy loss" },
        { id: "temperature", label: "The sampling temperature" },
      ],
      correctChoiceId: "hidden",
      explanation: "h_(t-1) is an input to the recurrent transition. Loss trains parameters, while temperature changes sampling after logits are produced.",
    },
  },
  "neural-language-models": {
    concept: "Learned embeddings and a normalized output layer share statistical strength across related contexts.",
    before: "An unseen exact context has no direct count-based next-word estimate.",
    after: "Context embeddings feed vocabulary logits, softmax probabilities, and target negative log-likelihood.",
    check: {
      id: "target-loss",
      prompt: "If the observed next word receives probability 0.8, which expression is its cross-entropy contribution?",
      choices: [
        { id: "nll", label: "-log(0.8)" },
        { id: "one-minus", label: "1 - 0.8" },
        { id: "entropy", label: "-0.8 log(0.8)" },
      ],
      correctChoiceId: "nll",
      explanation: "For a one-hot target, cross-entropy selects the observed class and contributes -log p(target).",
    },
  },
  "subword-tokenization": {
    concept: "Byte-pair encoding learns an ordered merge program rather than an unordered vocabulary of fragments.",
    before: "Every input remains split into its initial symbols.",
    after: "Frequent adjacent pairs are merged, counts are recomputed, and the learned order deterministically segments new text.",
    check: {
      id: "merge-order",
      prompt: "Why must a BPE tokenizer apply learned merges in training order?",
      choices: [
        { id: "dependencies", label: "Later pairs can depend on symbols created by earlier merges" },
        { id: "softmax", label: "Softmax requires tokens to be sorted by probability" },
        { id: "unicode", label: "Unicode code points must be processed alphabetically" },
      ],
      correctChoiceId: "dependencies",
      explanation: "A later merge may reference a composite symbol that does not exist until an earlier merge has run.",
    },
  },
  "additive-attention": {
    concept: "A decoder query scores every encoder state and softmax turns those scores into a query-specific weighted context.",
    before: "The decoder receives one fixed summary regardless of which output it is producing.",
    after: "Each decoder step constructs a different convex combination of encoder states.",
    check: {
      id: "attention-normalization",
      prompt: "Across which axis is softmax applied when one decoder query attends to a source sequence?",
      choices: [
        { id: "source", label: "Across source positions for that query" },
        { id: "batch", label: "Across unrelated examples in the batch" },
        { id: "hidden", label: "Across hidden dimensions of each key" },
      ],
      correctChoiceId: "source",
      explanation: "The weights for one query must sum to one across the candidate source positions used to form its context vector.",
    },
  },
  transformers: {
    concept: "Causal self-attention permits parallel training while enforcing an autoregressive information boundary.",
    before: "A position can accidentally use representations from tokens that occur later in the sequence.",
    after: "Future logits are masked before softmax, making their attention probability exactly zero.",
    check: {
      id: "causal-mask-order",
      prompt: "When should the causal mask be applied to attention scores?",
      choices: [
        { id: "pre-softmax", label: "Before softmax, by replacing future scores with -Infinity" },
        { id: "post-context", label: "After the weighted context vector is computed" },
        { id: "post-sample", label: "After a next token has been sampled" },
      ],
      correctChoiceId: "pre-softmax",
      explanation: "Masking the logits before normalization prevents any probability mass from being assigned to future positions.",
    },
  },
  "in-context-learning": {
    concept: "Demonstrations in the prompt can change predictions while model weights remain frozen.",
    before: "The model receives only an instruction and must infer the task without examples.",
    after: "Examples alter the activation context used for later token predictions without an optimizer step.",
    check: {
      id: "frozen-weights",
      prompt: "What changes during ordinary few-shot inference?",
      choices: [
        { id: "activations", label: "The prompt-conditioned activations and KV cache" },
        { id: "weights", label: "The model weights through gradient descent" },
        { id: "tokenizer", label: "The tokenizer merge table" },
      ],
      correctChoiceId: "activations",
      explanation: "In-context learning is inference: the prompt and resulting activations change, but no parameter update is performed.",
    },
  },
  "inference-runtime": {
    concept: "Autoregressive inference separates parallel prompt prefill from serial one-token decode and reuses a KV cache.",
    before: "Every decode step recomputes attention keys and values for the complete prefix.",
    after: "Prefill materializes prefix state once; decode appends one position and reuses cached history.",
    check: {
      id: "prefill-decode",
      prompt: "Which phase processes all prompt positions before the first generated token?",
      choices: [
        { id: "prefill", label: "Prefill" },
        { id: "decode", label: "Decode" },
        { id: "sampling", label: "Sampling" },
      ],
      correctChoiceId: "prefill",
      explanation: "Prefill evaluates the prompt and creates its KV state. Decode then advances one generated position at a time.",
    },
  },
  "scheduling-memory": {
    concept: "Admission and continuous batching coordinate per-request KV memory with changing decode-ready work.",
    before: "Requests run to completion in isolated static batches and leave capacity unused.",
    after: "Finished sequences leave and newly admitted requests join at iteration boundaries under a memory budget.",
    check: {
      id: "continuous-batching",
      prompt: "What distinguishes continuous batching from a static batch?",
      choices: [
        { id: "iteration", label: "Requests may enter or leave between decode iterations" },
        { id: "weights", label: "Each request uses a different set of model weights" },
        { id: "tokenizer", label: "Tokenization happens on the GPU" },
      ],
      correctChoiceId: "iteration",
      explanation: "Continuous batching changes batch membership at safe iteration boundaries instead of waiting for every original sequence to finish.",
    },
  },
  "streaming-transport": {
    concept: "A streaming client incrementally decodes bytes, retains incomplete frames, and reduces typed SSE events.",
    before: "Arbitrary network chunks are assumed to be complete text events.",
    after: "TextDecoder preserves split UTF-8 sequences and the parser carries an incomplete SSE remainder forward.",
    check: {
      id: "stream-order",
      prompt: "Why should bytes pass through a streaming TextDecoder before SSE frame parsing?",
      choices: [
        { id: "utf8", label: "A multi-byte UTF-8 character may be split across network chunks" },
        { id: "retry", label: "It automatically retries failed requests" },
        { id: "json", label: "It validates every JSON field against a schema" },
      ],
      correctChoiceId: "utf8",
      explanation: "Network chunk boundaries are unrelated to character boundaries; streaming decoding preserves incomplete byte sequences.",
    },
  },
  "reliability-observability": {
    concept: "Retries, stale-event guards, and phase metrics are attempt-aware rather than status-only.",
    before: "A transient error can duplicate visible text or a late event can mutate a newer attempt.",
    after: "Only retryable failures before visible output retry, and events must match the active request and attempt identity.",
    check: {
      id: "safe-retry",
      prompt: "When is an automatic generation retry safe under this lesson's contract?",
      choices: [
        { id: "before-output", label: "The failure is retryable and no visible output has been emitted" },
        { id: "any-time", label: "Whenever fewer than three attempts have run" },
        { id: "after-output", label: "Only after at least one token is visible" },
      ],
      correctChoiceId: "before-output",
      explanation: "Retrying after visible output risks duplicated or contradictory text unless the product explicitly starts a new attempt.",
    },
  },
  "conversation-state": {
    concept: "Normalized message and attempt identity lets the reducer reject stale deltas without mutating shared input.",
    before: "A late event can append to whichever assistant message currently happens to be streaming.",
    after: "Every delta targets one message, request, and attempt; immutable updates preserve prior state.",
    check: {
      id: "stale-delta",
      prompt: "What should the reducer do with a delta whose attemptId does not match the target message's active attempt?",
      choices: [
        { id: "ignore", label: "Ignore it as stale" },
        { id: "latest", label: "Append it to the newest assistant message" },
        { id: "broadcast", label: "Append it to every streaming message" },
      ],
      correctChoiceId: "ignore",
      explanation: "Attempt identity is the causality guard. Status alone cannot prove that an event belongs to the current generation.",
    },
  },
  "streaming-react": {
    concept: "Transport deltas, visual commits, scrolling, and live-region announcements use independent scheduling policies.",
    before: "Every token forces a React commit, scroll adjustment, and accessibility announcement.",
    after: "Deltas retain order in a buffer, visual work flushes on animation frames, and announcements are coalesced separately.",
    check: {
      id: "render-buffer",
      prompt: "What is the main reason to batch streaming deltas before dispatching a React update?",
      choices: [
        { id: "commits", label: "Reduce visual commits while preserving token order" },
        { id: "network", label: "Increase the server's network bandwidth" },
        { id: "weights", label: "Update model weights less frequently" },
      ],
      correctChoiceId: "commits",
      explanation: "Frame-aligned batching reduces render churn; it does not change transport ordering or model computation.",
    },
  },
  "chat-actions-context": {
    concept: "Stop, retry, edit, and regeneration create explicit branches while a deterministic budget selects request context.",
    before: "Edits overwrite history and context selection silently drops arbitrary messages.",
    after: "Branches retain identity and the request contains the active prompt plus the newest complete turns that fit.",
    check: {
      id: "context-budget",
      prompt: "Under the lesson's context policy, what must be budgeted separately from complete historical turns?",
      choices: [
        { id: "active", label: "The active user prompt" },
        { id: "cancelled", label: "Every cancelled partial response" },
        { id: "metrics", label: "Transport timing metrics" },
      ],
      correctChoiceId: "active",
      explanation: "The request cannot answer a prompt that was displaced by history, so active-prompt capacity is reserved before selecting complete turns.",
    },
  },
  "chat-product-quality": {
    concept: "Persistence, lifecycle labels, focus recovery, and responsive behavior are product contracts rather than incidental UI details.",
    before: "Transient streaming state may be restored as if it were durable and failures can leave ambiguous controls.",
    after: "Only schema-valid terminal records persist, every phase has a label, and recovery restores a usable interaction point.",
    check: {
      id: "durable-state",
      prompt: "Which assistant messages should be restored as durable conversation history?",
      choices: [
        { id: "terminal", label: "Schema-valid terminal messages such as complete, cancelled, or error" },
        { id: "streaming", label: "Any message that was streaming when the tab closed" },
        { id: "unknown", label: "Records with unknown fields so future versions can interpret them" },
      ],
      correctChoiceId: "terminal",
      explanation: "A streaming record is an interrupted process, not a completed durable fact. Strict schemas also prevent accidental secret persistence.",
    },
  },
};

export const moduleCheckpointDefinitions: readonly ModuleCheckpointDefinition[] = [
  {
    courseId: "models",
    moduleId: "model-foundations",
    label: "Module 01 checkpoint",
    title: "Generate from learned state",
    objective: "Verify the numerical model files together, then sample the learner-trained character checkpoint with two inference policies.",
    before: "A prompt is inert text with no learned next-token distribution.",
    after: "Tokenization, learned state, logits, normalization, masking, and sampling form an executable generation path.",
  },
  {
    courseId: "systems",
    moduleId: "inference-runtime",
    label: "Module 02 checkpoint",
    title: "Trace one inference request",
    objective: "Verify prefill, decode, cache accounting, admission, and scheduling, then inspect the resulting request timeline.",
    before: "Generation is represented as one opaque model call.",
    after: "Queue, prefill, iterative decode, KV growth, and completion are explicit runtime phases.",
  },
  {
    courseId: "backend",
    moduleId: "llm-serving",
    label: "Module 03 checkpoint",
    title: "Stream across the serving boundary",
    objective: "Verify framing and reliability contracts, then consume an actual deterministic SSE stream with cancellation available.",
    before: "The interface waits for one complete response and cannot distinguish attempts.",
    after: "Typed frames deliver ordered deltas with cancellation, retry boundaries, request identity, and metrics.",
  },
  {
    courseId: "product",
    moduleId: "chat-integration",
    label: "Module 04 checkpoint",
    title: "Assemble the product state machine",
    objective: "Verify reducer, rendering, action, context, persistence, and quality contracts before promoting the complete Browser Chat build.",
    before: "Model output is an unstructured string with no durable interaction lifecycle.",
    after: "React renders a cancellable, branch-aware, persistent, accessible streaming conversation.",
  },
];

export function lessonLearningOutcome(lessonId: string) {
  const outcome = lessonLearningOutcomes[lessonId];
  if (!outcome) throw new Error(`Missing learning outcome for ${lessonId}.`);
  return outcome;
}

export function moduleCheckpoint(courseId: string) {
  return moduleCheckpointDefinitions.find((checkpoint) => checkpoint.courseId === courseId);
}
