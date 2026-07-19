import type { Flashcard } from "../content/flashcards";

type SearchForms = {
  words: string;
  compact: string;
};

function searchForms(value: string): SearchForms {
  const words = value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2")
    .toLowerCase()
    .replace(/@/g, " at ")
    .replace(/\^/g, " to the ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return { words, compact: words.replace(/\s/g, "") };
}

function exact(field: SearchForms, query: SearchForms) {
  return field.words === query.words || field.compact === query.compact;
}

function startsWith(field: SearchForms, query: SearchForms) {
  return field.words.startsWith(query.words)
    || (query.compact.length >= 3 && field.compact.startsWith(query.compact));
}

function includes(field: SearchForms, query: SearchForms) {
  return field.words.includes(query.words)
    || (query.compact.length >= 3 && field.compact.includes(query.compact));
}

function searchScore(card: Flashcard, query: SearchForms) {
  const concept = searchForms(card.concept);
  if (exact(concept, query)) return 0;
  if (startsWith(concept, query)) return 1;
  if (includes(concept, query)) return 2;

  const topicFields = [card.lesson, card.module];
  if (topicFields.some((value) => includes(searchForms(value), query))) return 3;

  const answerFields = [
    card.definition,
    card.example,
    ...(card.source ? [card.source] : []),
    ...card.details,
  ];
  if (answerFields.some((value) => includes(searchForms(value), query))) return 4;
  return Number.POSITIVE_INFINITY;
}

export function normalizeFlashcardSearchQuery(value: string) {
  return searchForms(value).words;
}

export function rankFlashcardSearchResults(
  cards: readonly Flashcard[],
  rawQuery: string,
) {
  const query = searchForms(rawQuery);
  if (!query.words) return cards;

  return cards
    .map((card, index) => ({ card, index, score: searchScore(card, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ card }) => card);
}
