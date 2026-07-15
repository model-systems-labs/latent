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
    concept: "A recurrent hidden state carries what the model has seen so far, so the next-character distribution depends on the whole prefix.",
    before: "Each character looks unrelated because no state carries over from one step to the next.",
    after: "The model uses the same transition parameters to update h_t at every position and produce logits based on the prefix.",
    check: {
      id: "state-carrier",
      prompt: "When the model generates one character at a time, what carries information from the prefix into the next recurrent step?",
      choices: [
        { id: "hidden", label: "The previous hidden state h_(t-1)" },
        { id: "loss", label: "The scalar cross-entropy loss" },
        { id: "temperature", label: "The sampling temperature" },
      ],
      correctChoiceId: "hidden",
      explanation: "h_(t-1) goes into the next recurrent transition. The loss trains the parameters, while temperature only changes sampling after the model produces logits.",
    },
  },
  "neural-language-models": {
    concept: "Learned embeddings and a normalized output layer let related contexts share what the model has learned.",
    before: "If an exact context never showed up in the counts, there's no direct count-based estimate for the next word.",
    after: "Context embeddings produce vocabulary logits, softmax probabilities, and the target's negative log-likelihood.",
    check: {
      id: "target-loss",
      prompt: "If the word that actually comes next gets probability 0.8, which expression gives its cross-entropy contribution?",
      choices: [
        { id: "nll", label: "-log(0.8)" },
        { id: "one-minus", label: "1 - 0.8" },
        { id: "entropy", label: "-0.8 log(0.8)" },
      ],
      correctChoiceId: "nll",
      explanation: "With a one-hot target, cross-entropy picks the class that actually appeared, so its contribution is -log p(target).",
    },
  },
  "subword-tokenization": {
    concept: "Byte-pair encoding learns a list of merges in a specific order, not just an unordered bag of text pieces.",
    before: "Every input stays split into the symbols it started with.",
    after: "The tokenizer merges common neighboring pairs, recounts them, and uses the learned order to split new text the same way every time.",
    check: {
      id: "merge-order",
      prompt: "Why does a BPE tokenizer need to apply its learned merges in training order?",
      choices: [
        { id: "dependencies", label: "A later pair may need a symbol made by an earlier merge" },
        { id: "softmax", label: "Softmax requires tokens to be sorted by probability" },
        { id: "unicode", label: "Unicode code points must be processed alphabetically" },
      ],
      correctChoiceId: "dependencies",
      explanation: "A later merge may use a combined symbol that doesn't exist until an earlier merge runs.",
    },
  },
  "additive-attention": {
    concept: "A decoder query scores every encoder state, and softmax turns those scores into a weighted context made for that query.",
    before: "The decoder gets the same fixed summary no matter which output it's producing.",
    after: "Each decoder step builds a different convex combination of the encoder states.",
    check: {
      id: "attention-normalization",
      prompt: "When one decoder query attends to a source sequence, which axis does softmax use?",
      choices: [
        { id: "source", label: "Across source positions for that query" },
        { id: "batch", label: "Across unrelated examples in the batch" },
        { id: "hidden", label: "Across hidden dimensions of each key" },
      ],
      correctChoiceId: "source",
      explanation: "For one query, the weights need to add up to one across the source positions that build its context vector.",
    },
  },
  transformers: {
    concept: "Causal self-attention lets training run in parallel while still blocking information from future tokens.",
    before: "A position can accidentally use information from tokens that come later in the sequence.",
    after: "The model masks future logits before softmax, which makes their attention probability exactly zero.",
    check: {
      id: "causal-mask-order",
      prompt: "When do you apply the causal mask to the attention scores?",
      choices: [
        { id: "pre-softmax", label: "Before softmax, by replacing future scores with -Infinity" },
        { id: "post-context", label: "After the weighted context vector is computed" },
        { id: "post-sample", label: "After a next token has been sampled" },
      ],
      correctChoiceId: "pre-softmax",
      explanation: "Masking the logits before normalization keeps future positions from getting any probability at all.",
    },
  },
  "in-context-learning": {
    concept: "Examples in the prompt can change the model's predictions without changing its weights.",
    before: "The model gets only an instruction and has to figure out the task without any examples.",
    after: "Examples change the activation context for later token predictions, and no optimizer step is needed.",
    check: {
      id: "frozen-weights",
      prompt: "What changes during a normal few-shot inference request?",
      choices: [
        { id: "activations", label: "The prompt-conditioned activations and KV cache" },
        { id: "weights", label: "The model weights through gradient descent" },
        { id: "tokenizer", label: "The tokenizer merge table" },
      ],
      correctChoiceId: "activations",
      explanation: "In-context learning is still inference. The prompt and the activations it creates change, but the model doesn't update any parameters.",
    },
  },
  "inference-runtime": {
    concept: "Autoregressive inference handles the prompt in a parallel prefill phase, then decodes one token at a time while reusing a KV cache.",
    before: "Every decode step recalculates the attention keys and values for the whole prefix.",
    after: "Prefill creates the prefix state once. Decode adds one position at a time and reuses the cached history.",
    check: {
      id: "prefill-decode",
      prompt: "Which phase handles every prompt position before the first token is generated?",
      choices: [
        { id: "prefill", label: "Prefill" },
        { id: "decode", label: "Decode" },
        { id: "sampling", label: "Sampling" },
      ],
      correctChoiceId: "prefill",
      explanation: "Prefill runs the prompt and creates its KV state. Decode then moves forward one generated position at a time.",
    },
  },
  "scheduling-memory": {
    concept: "Admission and continuous batching keep each request's KV memory in step with the work that's ready to decode.",
    before: "Requests stay in separate static batches until they're done, even when that leaves capacity unused.",
    after: "Finished sequences leave and newly admitted requests join between iterations, all within the memory budget.",
    check: {
      id: "continuous-batching",
      prompt: "What's the main difference between continuous batching and a static batch?",
      choices: [
        { id: "iteration", label: "Requests can enter or leave between decode iterations" },
        { id: "weights", label: "Each request uses a different set of model weights" },
        { id: "tokenizer", label: "Tokenization happens on the GPU" },
      ],
      correctChoiceId: "iteration",
      explanation: "Continuous batching changes who's in the batch at safe points between iterations instead of waiting for every original sequence to finish.",
    },
  },
  "streaming-transport": {
    concept: "A streaming client decodes bytes as they arrive, holds onto incomplete frames, and turns typed SSE events into state updates.",
    before: "The client assumes every network chunk contains one complete text event.",
    after: "TextDecoder saves split UTF-8 sequences, and the parser carries an unfinished SSE frame into the next chunk.",
    check: {
      id: "stream-order",
      prompt: "Why should bytes go through a streaming TextDecoder before you parse SSE frames?",
      choices: [
        { id: "utf8", label: "A multi-byte UTF-8 character may be split across network chunks" },
        { id: "retry", label: "It automatically retries failed requests" },
        { id: "json", label: "It validates every JSON field against a schema" },
      ],
      correctChoiceId: "utf8",
      explanation: "Network chunks don't line up with character boundaries. Streaming decoding saves an incomplete byte sequence until the rest arrives.",
    },
  },
  "reliability-observability": {
    concept: "Retries, old-event guards, and phase metrics need to track the attempt id, not just the status.",
    before: "A temporary error can duplicate text the user already saw, or a late event can change a newer attempt.",
    after: "Only retryable failures that happen before visible output get another try, and every event has to match the active request and attempt ids.",
    check: {
      id: "safe-retry",
      prompt: "Under this lesson's rules, when is it safe to retry generation automatically?",
      choices: [
        { id: "before-output", label: "The failure is retryable and no visible output has been emitted" },
        { id: "any-time", label: "Whenever fewer than three attempts have run" },
        { id: "after-output", label: "Only after at least one token is visible" },
      ],
      correctChoiceId: "before-output",
      explanation: "If output is already visible, a retry can duplicate it or contradict it unless the product clearly starts a separate attempt.",
    },
  },
  "conversation-state": {
    concept: "Normalized message and attempt ids let the reducer reject old deltas without changing shared input data.",
    before: "A late event can get added to whichever assistant message happens to be streaming now.",
    after: "Every delta points to one message, request, and attempt, and updates leave the earlier state untouched.",
    check: {
      id: "stale-delta",
      prompt: "What should the reducer do when a delta's attemptId doesn't match the target message's active attempt?",
      choices: [
        { id: "ignore", label: "Ignore it as stale" },
        { id: "latest", label: "Append it to the newest assistant message" },
        { id: "broadcast", label: "Append it to every streaming message" },
      ],
      correctChoiceId: "ignore",
      explanation: "The attempt id tells you whether the event belongs to this generation. Status by itself isn't enough.",
    },
  },
  "streaming-react": {
    concept: "Transport deltas, screen updates, scrolling, and live-region announcements each follow their own timing rules.",
    before: "Every token forces a React update, moves the scroll, and triggers an accessibility announcement.",
    after: "A buffer keeps deltas in order, screen updates run on animation frames, and announcements are grouped on their own schedule.",
    check: {
      id: "render-buffer",
      prompt: "What's the main reason to group streaming deltas before sending a React update?",
      choices: [
        { id: "commits", label: "Cut down on screen updates while keeping token order" },
        { id: "network", label: "Increase the server's network bandwidth" },
        { id: "weights", label: "Update model weights less frequently" },
      ],
      correctChoiceId: "commits",
      explanation: "Grouping updates by animation frame cuts down on render churn. It doesn't change the transport order or what the model computes.",
    },
  },
  "chat-actions-context": {
    concept: "Stop, retry, edit, and regenerate create clear conversation branches, while a fixed budget decides which context goes into the request.",
    before: "Edits overwrite history, and context selection drops messages without explaining why.",
    after: "Branches keep their ids, and the request includes the current prompt plus the newest complete turns that fit.",
    check: {
      id: "context-budget",
      prompt: "Under this lesson's context rules, what needs its own reserved space apart from complete history turns?",
      choices: [
        { id: "active", label: "The active user prompt" },
        { id: "cancelled", label: "Every cancelled partial response" },
        { id: "metrics", label: "Transport timing metrics" },
      ],
      correctChoiceId: "active",
      explanation: "The model can't answer the current prompt if history pushes it out, so you reserve room for that prompt before choosing complete past turns.",
    },
  },
  "chat-product-quality": {
    concept: "Saving data, lifecycle labels, focus recovery, and responsive behavior are core product rules, not little UI extras.",
    before: "The app may restore interrupted streaming state as if it were finished, and a failure can leave the controls confusing.",
    after: "Only final records that pass the schema are saved, every phase has a clear label, and recovery puts the user back at a useful control.",
    check: {
      id: "durable-state",
      prompt: "Which assistant messages should come back as saved conversation history after a reload?",
      choices: [
        { id: "terminal", label: "Finished messages that match the saved-data rules, such as complete, cancelled, or error" },
        { id: "streaming", label: "Any message that was streaming when the tab closed" },
        { id: "unknown", label: "Records with unknown fields so future versions can interpret them" },
      ],
      correctChoiceId: "terminal",
      explanation: "A streaming record is an interrupted process, not finished history. A strict schema also keeps the app from saving secrets by accident.",
    },
  },
};

export const moduleCheckpointDefinitions: readonly ModuleCheckpointDefinition[] = [
  {
    courseId: "models",
    moduleId: "model-foundations",
    label: "Module 01 checkpoint",
    title: "Generate from learned state",
    objective: "Check the numerical model files together, then sample the character checkpoint you trained with two inference settings.",
    before: "A prompt is just text with no learned distribution for the next token.",
    after: "Tokenization, learned state, logits, normalization, masking, and sampling now make up a generation path you can run.",
  },
  {
    courseId: "systems",
    moduleId: "inference-runtime",
    label: "Module 02 checkpoint",
    title: "Trace one inference request",
    objective: "Check prefill, decode, cache accounting, admission, and scheduling, then walk through the request timeline they produce.",
    before: "Generation looks like one model call with no view into what happens inside.",
    after: "Queue, prefill, repeated decode, KV growth, and completion are now clear runtime phases.",
  },
  {
    courseId: "backend",
    moduleId: "llm-serving",
    label: "Module 03 checkpoint",
    title: "Stream across the serving boundary",
    objective: "Check the framing and reliability rules, then read a real fixed SSE stream that you can cancel.",
    before: "The interface waits for the whole response and can't tell one attempt from another.",
    after: "Typed frames deliver deltas in order, with cancellation, retry limits, request ids, and metrics.",
  },
  {
    courseId: "product",
    moduleId: "chat-integration",
    label: "Module 04 checkpoint",
    title: "Assemble the product state machine",
    objective: "Check the rules for the reducer, rendering, actions, context, saved data, and product quality before you move on to the complete Browser Chat build.",
    before: "Model output is just an unstructured string with no saved interaction history.",
    after: "React renders a streaming conversation you can cancel, branch, save, and use accessibly.",
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
