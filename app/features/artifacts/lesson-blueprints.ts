import { llmSystemsManifest } from "../../../products/courses/reference-curriculum/content/llm-systems/manifest";
import type { ArtifactJson, ArtifactReplayFrame } from "@latent/artifact-runtime";

export type LessonArtifactBlueprint = {
  lessonId: string;
  moduleId: string;
  projectPath: string;
  kind: string;
  title: string;
  description: string;
  clock: "step" | "token" | "event" | "request" | "state";
  unit: string;
  payload: ArtifactJson;
  frames: ArtifactReplayFrame[];
};

const frame = (index: number, at: number, label: string, payload: ArtifactJson, metrics: Record<string, number> = {}): ArtifactReplayFrame => ({
  index, at, label, payload, metrics,
});

const definitions: Record<string, Omit<LessonArtifactBlueprint, "lessonId" | "moduleId" | "projectPath">> = {
  "character-rnns": {
    kind: "recurrent-transition",
    title: "Verified recurrent model",
    description: "Your tested transition, loss, and gradient-stabilization code. The adjacent training replay is separate course data.",
    clock: "step", unit: "sequence position",
    payload: { state: "hidden-state transition", objective: "next-character cross-entropy", stabilization: "elementwise clipping" },
    frames: [
      frame(0, 0, "Encode character", { input: "x_t", state: "h_(t-1)" }),
      frame(1, 1, "Update hidden state", { operation: "tanh(Wx + Uh + b)" }),
      frame(2, 2, "Score next character", { operation: "softmax(Why · h_t + b_y)" }),
    ],
  },
  "neural-language-models": {
    kind: "representation-snapshot",
    title: "Word embedding result",
    description: "A tested context-embedding projection that turns separate word histories into vectors the model can reuse for predictions.",
    clock: "step", unit: "projection stage",
    payload: { contextWidth: 2, representation: "mean embedding", objective: "next-word likelihood" },
    frames: [
      frame(0, 0, "Look up embeddings", { tokens: ["the", "model"] }),
      frame(1, 1, "Compose context", { dimensions: 8 }),
      frame(2, 2, "Predict the next word", { distribution: "normalized vocabulary logits" }),
    ],
  },
  "subword-tokenization": {
    kind: "tokenizer-model",
    title: "Learned subword tokenizer",
    description: "An ordered merge program built from your tested pair-counting and merge functions.",
    clock: "step", unit: "merge",
    payload: { algorithm: "byte-pair encoding", boundary: "word-local training; display-only word separator", decoder: "not implemented" },
    frames: [
      frame(0, 0, "Initialize symbols", { text: "modeling signals" }, { tokenCount: 15 }),
      frame(1, 1, "Apply frequent merge", { pair: ["i", "n"] }, { tokenCount: 13 }),
      frame(2, 2, "Encode with merge table", { tokens: ["model", "ing", "signal", "s"] }, { tokenCount: 4 }),
    ],
  },
  "additive-attention": {
    kind: "attention-alignment",
    title: "Additive attention alignment",
    description: "A replay you can step through to see how scores line up a query with encoder states and build a context vector.",
    clock: "state", unit: "alignment stage",
    payload: { scorer: "v^T tanh(Wq q + Wk h_i + b)", normalization: "softmax", output: "weighted context" },
    frames: [
      frame(0, 0, "Score encoder states", { query: "decoder state", keys: 3 }),
      frame(1, 1, "Normalize scores", { probabilityMass: 1 }, { mass: 1 }),
      frame(2, 2, "Build the context", { operation: "sum(alpha_i * h_i)" }),
    ],
  },
  transformers: {
    kind: "causal-attention",
    title: "Causal self-attention result",
    description: "The tested causal mask, visible-value mixing, and layer normalization used inside a causal Transformer block.",
    clock: "token", unit: "sequence position",
    payload: { mask: "upper triangle = -Infinity", normalization: "row softmax", projections: "identity in reference experiment" },
    frames: [
      frame(0, 0, "Use identity Q, K, V", { positions: 6, headDimension: 8 }),
      frame(1, 1, "Apply causal mask", { futureProbability: 0 }, { maskedCells: 15 }),
      frame(2, 2, "Mix visible values", { outputPositions: 6 }),
    ],
  },
  "in-context-learning": {
    kind: "evaluation-run",
    title: "Few-shot comparison",
    description: "A repeatable prompt comparison that shows the examples, outputs, and accuracy for each setup.",
    clock: "request", unit: "prompt condition",
    payload: { conditions: ["zero-shot", "one-shot", "few-shot"], metric: "exact match" },
    frames: [
      frame(0, 0, "Zero-shot", { demonstrations: 0 }, { demonstrations: 0 }),
      frame(1, 1, "One-shot", { demonstrations: 1 }, { demonstrations: 1 }),
      frame(2, 2, "Few-shot", { demonstrations: 4 }, { demonstrations: 4 }),
    ],
  },
  "inference-runtime": {
    kind: "inference-trace",
    title: "Prefill and decode trace",
    description: "A step-by-step autoregressive run that separates prompt prefill, cached decode, and token output.",
    clock: "token", unit: "decode step",
    payload: { phases: ["prefill", "decode"], cache: "per-layer K/V", complexity: "one new position per decode" },
    frames: [
      frame(0, 0, "Prefill prompt", { promptTokens: 24 }, { activeTokens: 24 }),
      frame(1, 1, "Read KV cache", { cachedPositions: 24 }, { cachedPositions: 24 }),
      frame(2, 2, "Decode next token", { newPositions: 1 }, { activeTokens: 1 }),
    ],
  },
  "scheduling-memory": {
    kind: "scheduler-trace",
    title: "Continuous batching trace",
    description: "A request schedule you can replay to see active and finished lanes, admission, token limits, cache pressure, and released pages.",
    clock: "step", unit: "scheduler tick",
    payload: { policy: "continuous batching", resource: "KV-cache blocks", decodeResult: ["active", "completed"], fairness: "age-aware" },
    frames: [
      frame(0, 0, "Accept requests", { active: ["A", "B"], waiting: ["C"] }, { active: 2 }),
      frame(1, 1, "Move every active request forward", { active: ["B"], completed: ["A"] }, { batchTokens: 2 }),
      frame(2, 2, "Release pages and fill the slot", { releasedFor: "A", admitted: "C" }, { active: 2 }),
    ],
  },
  "streaming-transport": {
    kind: "serving-event-log",
    title: "Streaming transport result",
    description: "An SSE event log that works no matter where chunks split and keeps partial frames until the full delimiter arrives.",
    clock: "event", unit: "SSE event",
    payload: { encoding: "UTF-8", delimiter: "blank line", terminalEvent: "done" },
    frames: [
      frame(0, 0, "Receive partial chunk", { bytes: 13, completeEvents: 0 }),
      frame(1, 1, "Complete token frame", { event: "token", delta: "hello" }, { emitted: 1 }),
      frame(2, 2, "Read terminal frame", { event: "done" }, { emitted: 2 }),
    ],
  },
  "reliability-observability": {
    kind: "failure-trace",
    title: "Generation reliability trace",
    description: "A limited failure run that connects queue deadlines, retry rules, canceling, and request metrics.",
    clock: "event", unit: "lifecycle event",
    payload: { terminalStates: ["complete", "cancelled", "error"], retries: "bounded", identity: "request id" },
    frames: [
      frame(0, 0, "Queue request", { deadlineMs: 500 }, { queueMs: 12 }),
      frame(1, 1, "Inject failure", { code: "QUEUE_TIMEOUT" }, { attempts: 1 }),
      frame(2, 2, "Commit the final state", { status: "error", retryable: true }, { terminal: 1 }),
    ],
  },
  "conversation-state": {
    kind: "conversation-state",
    title: "Conversation reducer snapshot",
    description: "A repeatable message-state log that keeps old records unchanged and clearly marks final statuses.",
    clock: "state", unit: "reducer action",
    payload: { ownership: "request id", updates: "immutable", messageStates: ["streaming", "complete", "cancelled", "error"] },
    frames: [
      frame(0, 0, "Append user message", { role: "user", status: "complete" }, { messages: 1 }),
      frame(1, 1, "Start assistant attempt", { role: "assistant", status: "streaming" }, { messages: 2 }),
      frame(2, 2, "Commit the final status", { role: "assistant", status: "complete" }, { messages: 2 }),
    ],
  },
  "streaming-react": {
    kind: "ui-stream-trace",
    title: "React streaming state trace",
    description: "A UI trace for one request that groups deltas, ignores old attempts, and can still be canceled.",
    clock: "event", unit: "render event",
    payload: { batching: "animation frame", staleEventPolicy: "ignore", cancellation: "AbortController" },
    frames: [
      frame(0, 0, "Open request", { phase: "queued" }),
      frame(1, 1, "Apply token batch", { phase: "streaming", deltas: 4 }, { renders: 1 }),
      frame(2, 2, "Finish the attempt", { phase: "ready" }, { renders: 2 }),
    ],
  },
  "chat-actions-context": {
    kind: "context-window",
    title: "Context and regeneration result",
    description: "Context selection with a token limit, complete conversation turns, and a clear branch history.",
    clock: "state", unit: "selection stage",
    payload: { budget: "token-counted", boundary: "complete turns", regeneration: "parent user id + attempt id" },
    frames: [
      frame(0, 0, "Collect complete turns", { candidates: 5 }, { candidates: 5 }),
      frame(1, 1, "Apply token budget", { included: 3 }, { included: 3 }),
      frame(2, 2, "Create regeneration branch", { parentUserId: "m4", attemptId: "a2" }),
    ],
  },
  "chat-product-quality": {
    kind: "quality-audit",
    title: "Chat product quality check",
    description: "A portable report with 11 automated code checks, five written requirements that aren’t run here, and a separate list for hands-on testing.",
    clock: "state", unit: "audit check",
    payload: { areas: ["input and focus", "saving and context", "request flow and recovery", "accessibility and responsive behavior"], gate: "11 automated code checks pass", specifications: 5, mountedBehaviorReceipt: "full build only", manual: ["keyboard", "screen reader", "mobile"] },
    frames: [
      frame(0, 0, "Run input and persistence checks", { areas: 2 }, { passed: 7 }),
      frame(1, 1, "Run lifecycle checks; review written requirements", { areas: 2, specifications: 5 }, { passed: 11 }),
      frame(2, 2, "List the hands-on checks", { groups: 3 }, { manualGroups: 3 }),
    ],
  },
};

export const lessonArtifactBlueprints: LessonArtifactBlueprint[] = llmSystemsManifest.modules.flatMap((module) => module.lessons.map((lesson) => {
  const definition = definitions[lesson.lessonId];
  if (!definition) throw new Error(`Latent is missing the artifact blueprint for ${lesson.lessonId}.`);
  return { lessonId: lesson.lessonId, moduleId: module.id, projectPath: lesson.projectPath, ...definition };
}));

export const lessonArtifactBlueprintById = new Map(lessonArtifactBlueprints.map((blueprint) => [blueprint.lessonId, blueprint]));

export function previousArtifactLessonId(lessonId: string) {
  const index = lessonArtifactBlueprints.findIndex((blueprint) => blueprint.lessonId === lessonId);
  return index > 0 ? lessonArtifactBlueprints[index - 1].lessonId : null;
}
