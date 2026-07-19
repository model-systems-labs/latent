import type { Flashcard, FlashcardSubjectId } from "./flashcard-schema";

/**
 * A transport-only representation of the fields shared by cards from the same
 * lesson. Tuple positions keep the React server payload smaller than repeating
 * the field names on every card.
 */
export type CompactFlashcardContext = readonly [
  subjectId: FlashcardSubjectId,
  module: string,
  lesson: string,
  source: string | null,
];

export type CompactFlashcardRecord = readonly [
  contextIndex: number,
  id: string,
  concept: string,
  definition: string,
  details: readonly string[],
  example: string,
];

export type CompactFlashcardDeck = readonly [
  contexts: readonly CompactFlashcardContext[],
  cards: readonly CompactFlashcardRecord[],
];

export function compactFlashcardDeck(
  cards: readonly Flashcard[],
): CompactFlashcardDeck {
  const contexts: CompactFlashcardContext[] = [];
  const contextIndexes = new Map<string, number>();
  const compactCards: CompactFlashcardRecord[] = [];

  for (const card of cards) {
    const context = [
      card.subjectId,
      card.module,
      card.lesson,
      card.source ?? null,
    ] as const satisfies CompactFlashcardContext;
    const contextKey = JSON.stringify(context);
    let contextIndex = contextIndexes.get(contextKey);

    if (contextIndex === undefined) {
      contextIndex = contexts.length;
      contexts.push(context);
      contextIndexes.set(contextKey, contextIndex);
    }

    compactCards.push([
      contextIndex,
      card.id,
      card.concept,
      card.definition,
      card.details,
      card.example,
    ]);
  }

  return [contexts, compactCards];
}

export function expandFlashcardDeck(
  deck: CompactFlashcardDeck,
): Flashcard[] {
  const [contexts, cards] = deck;

  return cards.map(([
    contextIndex,
    id,
    concept,
    definition,
    details,
    example,
  ]) => {
    const context = contexts[contextIndex];
    if (!context) {
      throw new Error(`Missing flash-card context at index ${contextIndex}`);
    }
    const [subjectId, module, lesson, source] = context;

    return {
      id,
      concept,
      subjectId,
      module,
      lesson,
      ...(source === null ? {} : { source }),
      definition,
      details,
      example,
    };
  });
}
