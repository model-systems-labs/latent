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
    notation: "hₜ = tanh(Wₓₕxₜ + Wₕₕhₜ₋₁ + b)",
  },
  "neural-language-models": {
    tone: "plum",
    notation: "mean(E[xₜ₋₂], E[xₜ₋₁]) → p(xₜ)",
  },
  "subword-tokenization": {
    tone: "plum",
    notation: "s · i · g · n → si · g · n",
  },
  "additive-attention": {
    tone: "plum",
    notation: "eₜᵢ = vᵀ tanh(Wq qₜ + Wk hᵢ + b)",
  },
  transformers: {
    tone: "plum",
    notation: "softmax(QKᵀ / √dₖ + M)V",
  },
  "in-context-learning": {
    tone: "plum",
    notation: "0 / 1 / 4 examples · θ fixed",
  },
  "inference-runtime": {
    tone: "blue",
    notation: "prefill → token₁ → decode ×31",
  },
  "scheduling-memory": {
    tone: "blue",
    notation: "a completes @14 · d admitted @15",
  },
  "streaming-transport": {
    tone: "rust",
    notation: "E2 82 | AC → €",
  },
  "reliability-observability": {
    tone: "rust",
    notation: "a₁ timeout · 0 visible → retry a₂",
  },
  "conversation-state": {
    tone: "forest",
    notation: "m-a1 → a-17.2 → r-17.2",
  },
  "streaming-react": {
    tone: "forest",
    notation: "2 / 7 / 11 ms → commit @ 16 ms",
  },
  "chat-actions-context": {
    tone: "forest",
    notation: "m-u3 → {r-31, r-32, r-33}",
  },
  "chat-product-quality": {
    tone: "forest",
    notation: "v1 · terminal records · secrets rejected",
  },
} as const satisfies Record<string, LessonFlair>;

export function getLessonFlair(lessonId: string): LessonFlair | undefined {
  return lessonFlairRegistry[lessonId as keyof typeof lessonFlairRegistry];
}
