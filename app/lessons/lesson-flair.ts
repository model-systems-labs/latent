export type LessonFlairTone = "plum" | "rust" | "forest" | "blue" | "slate";

export type LessonFlair = {
  tone: LessonFlairTone;
  notation: string;
};

/**
 * Presentation-only lesson signatures. Keeping them outside the curriculum
 * schema makes this experiment easy to approve, revise, or remove.
 */
export const lessonFlairRegistry = {
  "character-rnns": {
    tone: "plum",
    notation: "hₜ = tanh(Wxh xₜ + Whh hₜ₋₁ + b)",
  },
  "neural-language-models": {
    tone: "blue",
    notation: "mean(E[xₜ₋₂], E[xₜ₋₁]) → p(xₜ)",
  },
  "subword-tokenization": {
    tone: "rust",
    notation: "l · o · w → lo · w",
  },
  "additive-attention": {
    tone: "forest",
    notation: "eₜᵢ = vᵀ tanh(Wq qₜ + Wk hᵢ + b)",
  },
  transformers: {
    tone: "plum",
    notation: "mask(QKᵀ / √dₖ)",
  },
  "in-context-learning": {
    tone: "slate",
    notation: "0 | 1 | 4 examples · θ fixed",
  },
  "inference-runtime": {
    tone: "blue",
    notation: "queue → prefill → token₁ → decode",
  },
  "scheduling-memory": {
    tone: "rust",
    notation: "complete → release pages → admit",
  },
  "streaming-transport": {
    tone: "blue",
    notation: "e2 82 │ ac → €",
  },
  "reliability-observability": {
    tone: "rust",
    notation: "a₁ timeout · visible=0 → a₂ complete",
  },
  "conversation-state": {
    tone: "forest",
    notation: "m-a1 → a-17.2 → r-17.2",
  },
  "streaming-react": {
    tone: "plum",
    notation: "2 · 7 · 11 ms → commit@16",
  },
  "chat-actions-context": {
    tone: "slate",
    notation: "prefix → {stop, retry, edit}",
  },
  "chat-product-quality": {
    tone: "forest",
    notation: "queued → loading → prefill → streaming → complete",
  },
} as const satisfies Record<string, LessonFlair>;

export function getLessonFlair(lessonId: string): LessonFlair | undefined {
  return lessonFlairRegistry[lessonId as keyof typeof lessonFlairRegistry];
}
