import { llmSystemsManifest } from "../../content/llm-systems/manifest";
import type { ArtifactJson, ArtifactReplayFrame } from "../../platform/artifact-runtime";

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
    title: "Validated recurrent model implementation",
    description: "The learner's tested transition, loss, and gradient-stabilization path, bound to the recorded training run.",
    clock: "step", unit: "sequence position",
    payload: { state: "hidden-state transition", objective: "next-character cross-entropy", stabilization: "elementwise clipping" },
    frames: [
      frame(0, 0, "Encode character", { input: "x_t", state: "h_(t-1)" }),
      frame(1, 1, "Update hidden state", { operation: "tanh(Wx + Uh + b)" }),
      frame(2, 2, "Score next character", { operation: "softmax(Why + b)" }),
    ],
  },
  "neural-language-models": {
    kind: "representation-snapshot",
    title: "Continuous representation artifact",
    description: "A tested context-embedding projection that turns discrete word histories into a shared predictive space.",
    clock: "step", unit: "projection stage",
    payload: { contextWidth: 2, representation: "mean embedding", objective: "next-word likelihood" },
    frames: [
      frame(0, 0, "Look up embeddings", { tokens: ["the", "model"] }),
      frame(1, 1, "Compose context", { dimensions: 8 }),
      frame(2, 2, "Predict next word", { distribution: "normalized vocabulary logits" }),
    ],
  },
  "subword-tokenization": {
    kind: "tokenizer-model",
    title: "Learned subword tokenizer",
    description: "An ordered merge program whose behavior is fixed by the learner's tested pair counting and merge functions.",
    clock: "step", unit: "merge",
    payload: { algorithm: "byte-pair encoding", boundary: "end-of-word marker", reversible: true },
    frames: [
      frame(0, 0, "Initialize symbols", { text: "modeling signals" }, { tokenCount: 15 }),
      frame(1, 1, "Apply frequent merge", { pair: ["i", "n"] }, { tokenCount: 13 }),
      frame(2, 2, "Encode with merge table", { tokens: ["model", "ing", "signal", "s"] }, { tokenCount: 4 }),
    ],
  },
  "additive-attention": {
    kind: "attention-alignment",
    title: "Additive attention alignment",
    description: "A replayable score-normalize-context transformation for aligning a query with encoder states.",
    clock: "state", unit: "alignment stage",
    payload: { scorer: "v^T tanh(Wq + Uh)", normalization: "softmax", output: "weighted context" },
    frames: [
      frame(0, 0, "Score encoder states", { query: "decoder state", keys: 4 }),
      frame(1, 1, "Normalize scores", { probabilityMass: 1 }, { mass: 1 }),
      frame(2, 2, "Aggregate context", { operation: "sum(alpha_i * h_i)" }),
    ],
  },
  transformers: {
    kind: "causal-attention",
    title: "Causal self-attention artifact",
    description: "The tested projection, masking, normalization, and residual path for one causal Transformer block.",
    clock: "token", unit: "sequence position",
    payload: { mask: "upper triangle = -Infinity", normalization: "row softmax", residual: true },
    frames: [
      frame(0, 0, "Project Q, K, V", { positions: 4, headDimension: 8 }),
      frame(1, 1, "Apply causal mask", { futureProbability: 0 }, { maskedCells: 6 }),
      frame(2, 2, "Mix visible values", { outputPositions: 4 }),
    ],
  },
  "in-context-learning": {
    kind: "evaluation-run",
    title: "Few-shot evaluation artifact",
    description: "A reproducible prompt-condition comparison with explicit examples, outputs, and accuracy accounting.",
    clock: "request", unit: "prompt condition",
    payload: { conditions: ["zero-shot", "one-shot", "few-shot"], metric: "exact match" },
    frames: [
      frame(0, 0, "Zero-shot", { demonstrations: 0 }, { demonstrations: 0 }),
      frame(1, 1, "One-shot", { demonstrations: 1 }, { demonstrations: 1 }),
      frame(2, 2, "Few-shot", { demonstrations: 3 }, { demonstrations: 3 }),
    ],
  },
  "inference-runtime": {
    kind: "inference-trace",
    title: "Prefill and decode trace",
    description: "An explicit autoregressive execution trace separating prompt prefill, cached decode, and token emission.",
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
    description: "A replayable request schedule with explicit admission, token budgets, cache pressure, and completion slots.",
    clock: "step", unit: "scheduler tick",
    payload: { policy: "continuous batching", resource: "KV-cache blocks", fairness: "age-aware" },
    frames: [
      frame(0, 0, "Admit requests", { queued: 3, admitted: 2 }, { active: 2 }),
      frame(1, 1, "Advance one token", { sequences: ["A", "B"] }, { batchTokens: 2 }),
      frame(2, 2, "Recycle completed slot", { completed: "A", admitted: "C" }, { active: 2 }),
    ],
  },
  "streaming-transport": {
    kind: "serving-event-log",
    title: "Streaming transport artifact",
    description: "A chunk-independent SSE event log that preserves partial frames until a complete delimiter arrives.",
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
    description: "A bounded failure lifecycle connecting queue deadlines, retry policy, cancellation, and request metrics.",
    clock: "event", unit: "lifecycle event",
    payload: { terminalStates: ["complete", "cancelled", "error"], retries: "bounded", identity: "request id" },
    frames: [
      frame(0, 0, "Queue request", { deadlineMs: 500 }, { queueMs: 12 }),
      frame(1, 1, "Inject failure", { code: "QUEUE_TIMEOUT" }, { attempts: 1 }),
      frame(2, 2, "Record terminal state", { status: "error", retryable: true }, { terminal: 1 }),
    ],
  },
  "conversation-state": {
    kind: "conversation-state",
    title: "Conversation reducer snapshot",
    description: "A deterministic message-state transition log with immutable updates and explicit terminal statuses.",
    clock: "state", unit: "reducer action",
    payload: { ownership: "request id", updates: "immutable", messageStates: ["streaming", "complete", "cancelled", "error"] },
    frames: [
      frame(0, 0, "Append user message", { role: "user", status: "complete" }, { messages: 1 }),
      frame(1, 1, "Start assistant attempt", { role: "assistant", status: "streaming" }, { messages: 2 }),
      frame(2, 2, "Commit terminal status", { role: "assistant", status: "complete" }, { messages: 2 }),
    ],
  },
  "streaming-react": {
    kind: "ui-stream-trace",
    title: "React streaming state trace",
    description: "A request-scoped UI trace that batches deltas, ignores retired attempts, and remains cancellable.",
    clock: "event", unit: "render event",
    payload: { batching: "animation frame", staleEventPolicy: "ignore", cancellation: "AbortController" },
    frames: [
      frame(0, 0, "Open request", { phase: "queued" }),
      frame(1, 1, "Apply token batch", { phase: "streaming", deltas: 4 }, { renders: 1 }),
      frame(2, 2, "Finalize attempt", { phase: "ready" }, { renders: 2 }),
    ],
  },
  "chat-actions-context": {
    kind: "context-window",
    title: "Context and regeneration artifact",
    description: "A token-budgeted context selection with complete-turn boundaries and explicit branch ancestry.",
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
    title: "Chat product quality audit",
    description: "A portable audit record for keyboard behavior, storage, context isolation, recovery, and accessibility.",
    clock: "state", unit: "audit check",
    payload: { areas: ["keyboard", "storage", "backend isolation", "context", "ARIA"], gate: "all checks pass" },
    frames: [
      frame(0, 0, "Run interaction checks", { area: "keyboard and cancellation" }, { passed: 2 }),
      frame(1, 1, "Run state checks", { area: "storage and backend isolation" }, { passed: 4 }),
      frame(2, 2, "Run accessibility checks", { area: "ARIA and focus" }, { passed: 6 }),
    ],
  },
};

export const lessonArtifactBlueprints: LessonArtifactBlueprint[] = llmSystemsManifest.modules.flatMap((module) => module.lessons.map((lesson) => {
  const definition = definitions[lesson.lessonId];
  if (!definition) throw new Error(`Missing artifact blueprint for ${lesson.lessonId}.`);
  return { lessonId: lesson.lessonId, moduleId: module.id, projectPath: lesson.projectPath, ...definition };
}));

export const lessonArtifactBlueprintById = new Map(lessonArtifactBlueprints.map((blueprint) => [blueprint.lessonId, blueprint]));

export function previousArtifactLessonId(lessonId: string) {
  const index = lessonArtifactBlueprints.findIndex((blueprint) => blueprint.lessonId === lessonId);
  return index > 0 ? lessonArtifactBlueprints[index - 1].lessonId : null;
}
