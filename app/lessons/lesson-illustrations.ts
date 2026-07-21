export const LESSON_ILLUSTRATION_SEED = "latent-editorial-v1";
export const LESSON_ILLUSTRATION_MIN_USEFULNESS = 0.75;
export const LESSON_ILLUSTRATION_CHANCE_SCALE = 0.5;

/**
 * Incremental value beyond each lesson's existing worked diagram and experiment.
 * These scores cover every public lesson, including the ones that do not get art.
 */
export const lessonIllustrationUsefulness = {
  "arrays-and-shapes": 0.58,
  "vector-operations": 0.49,
  "dot-products": 0.91,
  "matrix-multiplication": 0.88,
  "batches-and-broadcasting": 0.95,
  "ml-training-data": 0.54,
  "ml-linear-regression": 0.81,
  "ml-gradient-descent": 0.98,
  "ml-binary-classification": 0.84,
  "ml-neural-networks": 0.92,
  "agent-loop": 0.77,
  "tool-contracts": 0.43,
  "context-selection": 0.59,
  "permissions-and-sandboxes": 0.92,
  "state-and-recovery": 0.95,
  "agent-evaluations": 0.56,
  "task-orchestration": 0.94,
  "integrated-harness": 0.87,
  "character-rnns": 0.57,
  "neural-language-models": 0.86,
  "subword-tokenization": 0.76,
  "additive-attention": 0.84,
  transformers: 0.93,
  "in-context-learning": 0.82,
  "inference-runtime": 0.94,
  "streaming-transport": 0.52,
  "scheduling-memory": 0.91,
  "reliability-observability": 0.61,
  "conversation-state": 0.68,
  "streaming-react": 0.49,
  "chat-actions-context": 0.79,
  "chat-product-quality": 0.38,
} as const;

export type IllustratedLessonId = keyof typeof lessonIllustrationUsefulness;

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function lessonIllustrationDraw(lessonId: IllustratedLessonId): number {
  return fnv1a(`${LESSON_ILLUSTRATION_SEED}:${lessonId}`) / 0x100000000;
}

export function lessonPassesIllustrationDraw(lessonId: IllustratedLessonId): boolean {
  const usefulness = lessonIllustrationUsefulness[lessonId];
  return usefulness >= LESSON_ILLUSTRATION_MIN_USEFULNESS
    && lessonIllustrationDraw(lessonId) < usefulness * LESSON_ILLUSTRATION_CHANCE_SCALE;
}

export const selectedLessonIllustrationIds = Object.keys(lessonIllustrationUsefulness)
  .filter((lessonId): lessonId is IllustratedLessonId => lessonPassesIllustrationDraw(lessonId as IllustratedLessonId));

export type LessonIllustration = {
  src: string;
  title: string;
  caption: string;
  alt: string;
};

export const lessonIllustrations = {
  "batches-and-broadcasting": {
    src: "/lesson-diagrams/batches-and-broadcasting.jpg",
    title: "Shared math, repeated across the batch",
    caption: "Every row uses the same learned transformation, and broadcasting adds the same bias without copying it by hand.",
    alt: "Five rows of input cubes pass through one shared violet transformation, then each output row receives the same three coral bias beads.",
  },
  "ml-linear-regression": {
    src: "/lesson-diagrams/ml-linear-regression.jpg",
    title: "A fitted line turns distance into loss",
    caption: "Each residual measures how far one prediction misses. Training looks for weights that make those misses smaller together.",
    alt: "Purple observations sit above and below a fitted diagonal line, with coral residual lines gathering into a loss vessel.",
  },
  "ml-binary-classification": {
    src: "/lesson-diagrams/ml-binary-classification.jpg",
    title: "A score becomes a bounded probability",
    caption: "The sigmoid squeezes any real-valued score into a probability; a confident mismatch then receives the larger penalty.",
    alt: "A row of score beads enters an S-shaped channel, emerges on a bounded rail, and branches toward small and large penalty vessels.",
  },
  "agent-loop": {
    src: "/lesson-diagrams/agent-loop.jpg",
    title: "Actions become the next observation",
    caption: "The model proposes, the harness validates, the tool runs, and the result returns as evidence for the next turn—or the loop stops.",
    alt: "A model core, validation gate, tool mechanism, and observation card form a circular loop, with a separate branch ending at a stop marker.",
  },
  "permissions-and-sandboxes": {
    src: "/lesson-diagrams/permissions-and-sandboxes.jpg",
    title: "Policy decides what the sandbox can reach",
    caption: "Normalization and permission checks happen before execution, while protected resources remain outside the enforced boundary.",
    alt: "An action passes through a sieve and branching policy gate into a sandbox containing file, process, and network mechanisms; a credential vault remains separate.",
  },
  "task-orchestration": {
    src: "/lesson-diagrams/task-orchestration.jpg",
    title: "Ready work fans out; dependent work waits",
    caption: "Independent tasks can run together, but their results converge through one coordinator and return in a predictable order.",
    alt: "A dependency graph fans into three parallel worker lanes, then converges through one coral coordinator into an ordered row of result tiles.",
  },
  "additive-attention": {
    src: "/lesson-diagrams/additive-attention.jpg",
    title: "Attention builds a fresh context for each output",
    caption: "Instead of squeezing the whole source into one fixed summary, the decoder can place a different weight on every source memory at every step.",
    alt: "A decoder query shines weighted beams over source-memory cubes and gathers them into a context, contrasted with a second sequence squeezed through one fixed bottle-shaped bottleneck.",
  },
  transformers: {
    src: "/lesson-diagrams/transformers.jpg",
    title: "Causal attention mixes only the past",
    caption: "Each position can gather useful earlier information in parallel, while the causal mask keeps future tokens out of view.",
    alt: "Token blocks sit beneath a triangular backward-visibility canopy, split into parallel attention streams, and recombine through stacked residual blocks.",
  },
  "inference-runtime": {
    src: "/lesson-diagrams/inference-runtime.jpg",
    title: "Prefill is wide; decoding is one step at a time",
    caption: "The prompt can be processed in parallel, but generated tokens arrive serially while the key-value cache grows with the sequence.",
    alt: "Several rows of prompt cubes enter a processor together, narrow into a single-file token stream, and fill an expanding shelf of cache pages below.",
  },
  "chat-actions-context": {
    src: "/lesson-diagrams/chat-actions-context.jpg",
    title: "History branches; each request stays bounded",
    caption: "Stop, retry, and edit preserve different branches, while the next model request projects only valid paired messages that fit the context window.",
    alt: "A conversation spine branches into stopped, retried, and edited paths, while a bounded frame admits paired message tiles and leaves stale or oversized tiles outside.",
  },
} as const satisfies Partial<Record<IllustratedLessonId, LessonIllustration>>;

export function getLessonIllustration(lessonId: string): LessonIllustration | undefined {
  return lessonIllustrations[lessonId as keyof typeof lessonIllustrations];
}
