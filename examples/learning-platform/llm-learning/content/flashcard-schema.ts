export const flashcardSubjects = [
  {
    id: "linear-algebra",
    label: "Linear Algebra",
    shortLabel: "Linear Algebra",
    description: "Shapes, vectors, matrix operations, batches, and broadcasting.",
  },
  {
    id: "machine-learning-basics",
    label: "Machine Learning",
    shortLabel: "ML Basics",
    description: "Data, loss, optimization, classification, and neural networks.",
  },
  {
    id: "model-foundations",
    label: "Model Foundations",
    shortLabel: "Models",
    description: "Tokenization, learned representations, attention, and prompting.",
  },
  {
    id: "inference-runtime",
    label: "Inference Runtime",
    shortLabel: "Runtime",
    description: "Prefill, decode, KV memory, admission, and scheduling.",
  },
  {
    id: "llm-serving",
    label: "LLM Serving",
    shortLabel: "Serving",
    description: "Streaming transport, retries, failures, and observability.",
  },
  {
    id: "chat-integration",
    label: "Chat Integration",
    shortLabel: "Chat",
    description: "Conversation state, streaming UI, context, and product quality.",
  },
  {
    id: "harness-engineering",
    label: "Harness Engineering",
    shortLabel: "Harnesses",
    description: "Agent loops, tool contracts, permissions, recovery, evaluations, and orchestration.",
  },
] as const;

export type FlashcardSubject = (typeof flashcardSubjects)[number];
export type FlashcardSubjectId = FlashcardSubject["id"];

export type Flashcard = {
  id: string;
  concept: string;
  subjectId: FlashcardSubjectId;
  module: string;
  lesson: string;
  source?: string;
  definition: string;
  details: readonly string[];
  example: string;
};

export type FlashcardValue = Omit<Flashcard, "id" | "concept">;
export type FlashcardExplanation = Pick<FlashcardValue, "definition" | "details" | "example">;

export function defineFlashcardLibrary<
  const TCards extends Readonly<Record<string, FlashcardValue>>,
>(cards: TCards) {
  return cards;
}

export function defineFlashcardGroup<
  const TCards extends Readonly<Record<string, FlashcardExplanation>>,
>(
  context: Pick<FlashcardValue, "subjectId" | "module" | "lesson" | "source">,
  cards: TCards,
) {
  return Object.fromEntries(
    Object.entries(cards).map(([concept, explanation]) => [
      concept,
      { ...context, ...explanation },
    ]),
  ) as Record<keyof TCards & string, FlashcardValue>;
}

export function combineFlashcardLibraries(
  ...libraries: ReadonlyArray<Readonly<Record<string, FlashcardValue>>>
) {
  const combined: Record<string, FlashcardValue> = {};
  for (const library of libraries) {
    for (const [concept, value] of Object.entries(library)) {
      if (Object.hasOwn(combined, concept)) {
        throw new Error(`Duplicate flash-card concept: ${concept}`);
      }
      combined[concept] = value;
    }
  }
  return combined;
}

export function flashcardId(concept: string) {
  return concept
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFlashcards(library: Readonly<Record<string, FlashcardValue>>) {
  const conceptsById = new Map<string, string>();
  return Object.entries(library).map(([concept, value]) => {
    const id = flashcardId(concept);
    const priorConcept = conceptsById.get(id);
    if (!id || priorConcept) {
      throw new Error(
        priorConcept
          ? `Flash-card id collision: ${priorConcept} and ${concept}`
          : `Flash-card concept needs an id-safe character: ${concept}`,
      );
    }
    conceptsById.set(id, concept);
    return { id, concept, ...value };
  }) satisfies Flashcard[];
}
