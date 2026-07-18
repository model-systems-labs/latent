"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Flashcard,
  FlashcardSubject,
  FlashcardSubjectId,
} from "../content/flashcards";
import {
  applyFlashcardClearMutation,
  chooseNewestFlashcardProgress,
  clearFlashcardProgress,
  EMPTY_FLASHCARD_PROGRESS,
  flashcardResultRecordMatches,
  recordFlashcardResult,
  saveFlashcardResult,
  subscribeFlashcardProgress,
  undoFlashcardResult,
  type FlashcardMarkReceipt,
  type FlashcardProgress,
  type FlashcardResult,
  type FlashcardResultRecord,
} from "../lib/flashcard-progress";
import {
  normalizeFlashcardSearchQuery,
  rankFlashcardSearchResults,
} from "../lib/flashcard-search";
import styles from "./FlashcardDeck.module.css";

type CardStatusFilter = "all" | "new" | FlashcardResult;

type LastMark = {
  cardId: string;
  concept: string;
  previous: FlashcardResultRecord | null;
  written: FlashcardResultRecord;
  receipt: FlashcardMarkReceipt | null;
};

type PendingFocus = "answer" | "front" | "empty" | "clear-confirmation" | "clear-trigger" | "clear-section" | null;

const statusFilters: ReadonlyArray<{ id: CardStatusFilter; label: string }> = [
  { id: "all", label: "All cards" },
  { id: "new", label: "New" },
  { id: "success", label: "Got it" },
  { id: "failure", label: "Needs work" },
];

function cardMatchesStatus(
  card: Flashcard,
  progress: FlashcardProgress,
  filter: CardStatusFilter,
) {
  const result = progress.results[card.id]?.lastResult;
  if (filter === "all") return true;
  if (filter === "new") return !result;
  return result === filter;
}

function resultLabel(result?: FlashcardResult) {
  if (result === "success") return "Got it";
  if (result === "failure") return "Needs work";
  return "New";
}

function cardMixScore(cardId: string, seed: number) {
  let score = 2166136261 ^ seed;
  for (let index = 0; index < cardId.length; index += 1) {
    score = Math.imul(score ^ cardId.charCodeAt(index), 16777619);
  }
  return score >>> 0;
}

function orderCards(cards: readonly Flashcard[], seed: number) {
  if (!seed) return cards;
  return [...cards].sort((left, right) => (
    cardMixScore(left.id, seed) - cardMixScore(right.id, seed)
      || left.id.localeCompare(right.id)
  ));
}

function restoreFlashcardResult(
  progress: FlashcardProgress,
  cardId: string,
  previous: FlashcardResultRecord | null,
) {
  const results = { ...progress.results };
  if (previous) results[cardId] = previous;
  else delete results[cardId];
  return {
    ...progress,
    revision: progress.revision + 1,
    results,
  };
}

export function FlashcardDeck({
  cards,
  subjects,
}: {
  cards: readonly Flashcard[];
  subjects: readonly FlashcardSubject[];
}) {
  const allSubjectIds = useMemo(() => subjects.map((subject) => subject.id), [subjects]);
  const validCardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const [activeSubjects, setActiveSubjects] = useState<FlashcardSubjectId[]>(allSubjectIds);
  const [statusFilter, setStatusFilter] = useState<CardStatusFilter>("new");
  const [progress, setProgress] = useState<FlashcardProgress>(EMPTY_FLASHCARD_PROGRESS);
  const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [mutationPending, setMutationPending] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [lastMark, setLastMark] = useState<LastMark | null>(null);
  const [announcement, setAnnouncement] = useState("Loading saved card results.");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mixSeed, setMixSeed] = useState(0);
  const answerHeadingRef = useRef<HTMLHeadingElement>(null);
  const cardFrontRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const clearConfirmationRef = useRef<HTMLButtonElement>(null);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearSectionRef = useRef<HTMLElement>(null);
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocusRef = useRef<PendingFocus>(null);
  const lastAnnouncedQueryRef = useRef("");
  const progressRef = useRef<FlashcardProgress>(EMPTY_FLASHCARD_PROGRESS);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    let observedRevision = -1;
    subscribeFlashcardProgress(
      validCardIds,
      (stored) => {
        if (cancelled || stored.revision < observedRevision) return;
        const initial = observedRevision < 0;
        observedRevision = stored.revision;
        if (!initial && stored.revision <= progressRef.current.revision) return;
        progressRef.current = stored;
        setProgress(stored);
        setLastMark((current) => {
          if (!current) return null;
          const storedRecord = stored.results[current.cardId];
          return stored.epoch === (current.receipt?.epoch ?? stored.epoch)
            && storedRecord?.mutationId === current.written.mutationId
            ? current
            : null;
        });
        setStorageStatus("ready");
        setAnnouncement(initial
          ? "Saved card results loaded."
          : "Saved card results updated from another tab.");
      },
      () => {
        if (cancelled) return;
        setStorageStatus("unavailable");
        setAnnouncement("Card results will stay in this tab because device storage is unavailable.");
      },
    )
      .then((stop) => {
        if (cancelled) stop();
        else unsubscribe = stop;
      })
      .catch(() => {
        if (cancelled) return;
        setStorageStatus("unavailable");
        setAnnouncement("Card results will stay in this tab because device storage is unavailable.");
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [validCardIds]);

  const activeSubjectSet = useMemo(() => new Set(activeSubjects), [activeSubjects]);
  const subjectCards = useMemo(
    () => cards.filter((card) => activeSubjectSet.has(card.subjectId)),
    [activeSubjectSet, cards],
  );
  const normalizedQuery = normalizeFlashcardSearchQuery(query);
  const searchedCards = useMemo(
    () => rankFlashcardSearchResults(subjectCards, normalizedQuery),
    [normalizedQuery, subjectCards],
  );
  const visibleCards = useMemo(() => orderCards(
    searchedCards.filter((card) => cardMatchesStatus(card, progress, statusFilter)),
    mixSeed,
  ), [mixSeed, progress, searchedCards, statusFilter]);
  const currentPosition = visibleCards.length ? ((cursor % visibleCards.length) + visibleCards.length) % visibleCards.length : 0;
  const currentCard = visibleCards[currentPosition];

  useEffect(() => {
    const pending = pendingFocusRef.current;
    const bringCardIntoView = () => {
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      cardRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    };
    if (pending === "answer" && revealed) {
      answerHeadingRef.current?.focus();
      bringCardIntoView();
    } else if (pending === "front" && !revealed && currentCard) {
      cardFrontRef.current?.focus();
      bringCardIntoView();
    } else if (pending === "empty" && !currentCard) emptyHeadingRef.current?.focus();
    else if (pending === "clear-confirmation" && confirmingClear) clearConfirmationRef.current?.focus();
    else if (pending === "clear-trigger" && !confirmingClear) clearTriggerRef.current?.focus();
    else if (pending === "clear-section" && !confirmingClear) clearSectionRef.current?.focus();
    else return;
    pendingFocusRef.current = null;
  }, [confirmingClear, currentCard, mixSeed, revealed]);

  useEffect(() => {
    if (!normalizedQuery) {
      lastAnnouncedQueryRef.current = "";
      return;
    }
    if (lastAnnouncedQueryRef.current === normalizedQuery) return;
    lastAnnouncedQueryRef.current = normalizedQuery;
    const timeout = window.setTimeout(() => {
      setAnnouncement(`${visibleCards.length} ${visibleCards.length === 1 ? "card matches" : "cards match"} ${query.trim()}.`);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery, query, visibleCards.length]);

  const selectedStats = useMemo(() => {
    let success = 0;
    let failure = 0;
    for (const card of subjectCards) {
      const result = progress.results[card.id]?.lastResult;
      if (result === "success") success += 1;
      if (result === "failure") failure += 1;
    }
    return { success, failure, new: subjectCards.length - success - failure };
  }, [progress, subjectCards]);

  const chooseSubjects = (next: FlashcardSubjectId[]) => {
    setActiveSubjects(next);
    setCursor(0);
    setRevealed(false);
    setLastMark(null);
    setAnnouncement(`${next.length} ${next.length === 1 ? "subject" : "subjects"} selected.`);
  };

  const toggleSubject = (subjectId: FlashcardSubjectId) => {
    if (activeSubjects.length === allSubjectIds.length) {
      chooseSubjects([subjectId]);
      return;
    }
    chooseSubjects(
      activeSubjectSet.has(subjectId)
        ? activeSubjects.filter((id) => id !== subjectId)
        : allSubjectIds.filter((id) => activeSubjectSet.has(id) || id === subjectId),
    );
  };

  const chooseStatus = (next: CardStatusFilter) => {
    setStatusFilter(next);
    setCursor(0);
    setRevealed(false);
    setLastMark(null);
    setAnnouncement(`${statusFilters.find((filter) => filter.id === next)?.label ?? "Card"} filter selected.`);
  };

  const searchConcepts = (next: string) => {
    const startingSearch = Boolean(next.trim()) && !query.trim();
    if (!next.trim() && query.trim()) setAnnouncement("Card search cleared.");
    if (startingSearch && statusFilter === "new") {
      setStatusFilter("all");
      setAnnouncement("Searching all card results.");
    }
    setQuery(next);
    setMixSeed(0);
    setCursor(0);
    setRevealed(false);
    setLastMark(null);
  };

  const move = (direction: -1 | 1) => {
    if (visibleCards.length < 2) return;
    setCursor((current) => current + direction);
    pendingFocusRef.current = "front";
    setRevealed(false);
    setLastMark(null);
    const next = (currentPosition + direction + visibleCards.length) % visibleCards.length;
    setAnnouncement(`Card ${next + 1} of ${visibleCards.length}: ${visibleCards[next].concept}.`);
  };

  const mixCards = () => {
    if (visibleCards.length < 2) return;
    const nextSeed = Date.now();
    setMixSeed((current) => current === nextSeed ? nextSeed + 1 : nextSeed);
    setCursor(0);
    pendingFocusRef.current = "front";
    setRevealed(false);
    setLastMark(null);
    setAnnouncement(`${visibleCards.length} cards mixed into a new order.`);
  };

  const markCard = async (result: FlashcardResult) => {
    if (!currentCard || storageStatus === "loading" || mutationPending) return;
    setMutationPending(true);
    const markedCard = currentCard;
    const updatedAt = Date.now();
    const mutationId = crypto.randomUUID();
    let localPrevious = progress.results[markedCard.id] ?? null;
    let nextProgress = recordFlashcardResult(
      progress,
      markedCard.id,
      result,
      updatedAt,
      mutationId,
    );
    let receipt: FlashcardMarkReceipt | null = null;
    let persistenceFailed = storageStatus === "unavailable";

    if (!persistenceFailed) {
      const outcome = await saveFlashcardResult({
        cardId: markedCard.id,
        result,
        updatedAt,
        mutationId,
        expectedEpoch: progress.epoch,
      });
      if (outcome.saved) {
        setStorageStatus("ready");
        nextProgress = chooseNewestFlashcardProgress(
          outcome.value.progress,
          progressRef.current,
        );
        const outcomeReceipt = outcome.value.receipt;
        const resultIsCurrent = outcome.value.applied
          && outcomeReceipt
          && nextProgress.epoch === outcomeReceipt.epoch
          && flashcardResultRecordMatches(
            nextProgress.results[markedCard.id],
            outcomeReceipt.written,
          );
        if (!resultIsCurrent || !outcomeReceipt) {
          progressRef.current = nextProgress;
          setProgress(nextProgress);
          setLastMark(null);
          setAnnouncement(outcome.value.applied
            ? "This card changed again in another tab, so its newer result was kept."
            : "Progress was cleared in another tab; this result was not applied.");
          setMutationPending(false);
          return;
        }
        receipt = outcomeReceipt;
      } else {
        persistenceFailed = true;
        setStorageStatus("unavailable");
        const latestProgress = chooseNewestFlashcardProgress(
          progressRef.current,
          progress,
        );
        if (latestProgress.epoch !== progress.epoch
          || !flashcardResultRecordMatches(
            latestProgress.results[markedCard.id],
            localPrevious,
          )) {
          progressRef.current = latestProgress;
          setProgress(latestProgress);
          setLastMark(null);
          setAnnouncement("Progress changed in another tab, and this result could not be saved.");
          setMutationPending(false);
          return;
        }
        localPrevious = latestProgress.results[markedCard.id] ?? null;
        nextProgress = {
          ...recordFlashcardResult(
            latestProgress,
            markedCard.id,
            result,
            updatedAt,
            mutationId,
          ),
          revision: latestProgress.revision,
        };
      }
    }
    if (persistenceFailed && nextProgress.revision > progressRef.current.revision) {
      nextProgress = { ...nextProgress, revision: progressRef.current.revision };
    }

    const nextVisibleCards = orderCards(
      searchedCards.filter((card) => cardMatchesStatus(card, nextProgress, statusFilter)),
      mixSeed,
    );
    const currentRemains = cardMatchesStatus(markedCard, nextProgress, statusFilter);
    const nextCursor = nextVisibleCards.length === 0
      ? 0
      : currentRemains
        ? (nextVisibleCards.findIndex((card) => card.id === markedCard.id) + 1) % nextVisibleCards.length
        : Math.min(currentPosition, nextVisibleCards.length - 1);

    progressRef.current = nextProgress;
    setProgress(nextProgress);
    setLastMark({
      cardId: markedCard.id,
      concept: markedCard.concept,
      previous: receipt?.previous ?? localPrevious,
      written: receipt?.written ?? nextProgress.results[markedCard.id],
      receipt,
    });
    setCursor(nextCursor);
    pendingFocusRef.current = nextVisibleCards.length ? "front" : "empty";
    setRevealed(false);
    setAnnouncement(persistenceFailed
      ? `${markedCard.concept} marked ${result === "success" ? "got it" : "needs work"} in this tab, but device storage could not save it.`
      : `${markedCard.concept} marked ${result === "success" ? "got it" : "needs work"}.`);
    setMutationPending(false);
  };

  const undoLastMark = async () => {
    if (!lastMark || mutationPending) return;
    setMutationPending(true);
    const mark = lastMark;
    let nextProgress = restoreFlashcardResult(progress, mark.cardId, mark.previous);
    let persistenceFailed = storageStatus === "unavailable" || !mark.receipt;

    if (!persistenceFailed && mark.receipt) {
      const outcome = await undoFlashcardResult(mark.receipt);
      if (outcome.saved) {
        setStorageStatus("ready");
        nextProgress = chooseNewestFlashcardProgress(
          outcome.value.progress,
          progressRef.current,
        );
        const undoIsCurrent = outcome.value.applied
          && nextProgress.epoch === mark.receipt.epoch
          && flashcardResultRecordMatches(
            nextProgress.results[mark.cardId],
            mark.receipt.previous,
          );
        if (!undoIsCurrent) {
          progressRef.current = nextProgress;
          setProgress(nextProgress);
          setLastMark(null);
          setRevealed(false);
          pendingFocusRef.current = nextProgress.results[mark.cardId] ? "front" : null;
          setAnnouncement("This card changed in another tab, so its newer result was kept.");
          setMutationPending(false);
          return;
        }
      } else {
        persistenceFailed = true;
        setStorageStatus("unavailable");
        const latestProgress = chooseNewestFlashcardProgress(
          progressRef.current,
          progress,
        );
        const markIsCurrent = latestProgress.epoch === mark.receipt.epoch
          && flashcardResultRecordMatches(
            latestProgress.results[mark.cardId],
            mark.written,
          );
        if (!markIsCurrent) {
          progressRef.current = latestProgress;
          setProgress(latestProgress);
          setLastMark(null);
          setRevealed(false);
          pendingFocusRef.current = latestProgress.results[mark.cardId] ? "front" : null;
          setAnnouncement("This card changed in another tab, so its newer result was kept.");
          setMutationPending(false);
          return;
        }
        nextProgress = {
          ...restoreFlashcardResult(latestProgress, mark.cardId, mark.previous),
          revision: latestProgress.revision,
        };
      }
    }
    if (persistenceFailed && nextProgress.revision > progressRef.current.revision) {
      nextProgress = { ...nextProgress, revision: progressRef.current.revision };
    }

    let nextVisibleCards = orderCards(
      searchedCards.filter((card) => cardMatchesStatus(card, nextProgress, statusFilter)),
      mixSeed,
    );
    let target = nextVisibleCards.findIndex((card) => card.id === mark.cardId);
    if (target < 0) {
      setStatusFilter("all");
      nextVisibleCards = orderCards(searchedCards, mixSeed);
      target = nextVisibleCards.findIndex((card) => card.id === mark.cardId);
    }
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    setCursor(Math.max(0, target));
    pendingFocusRef.current = "answer";
    setRevealed(true);
    setAnnouncement(persistenceFailed
      ? `Undid the result for ${mark.concept} in this tab, but device storage could not save the change.`
      : `Undid the result for ${mark.concept}.`);
    setLastMark(null);
    setMutationPending(false);
  };

  const clearResults = async () => {
    if (mutationPending) return;
    setMutationPending(true);
    let nextProgress = applyFlashcardClearMutation(progress).progress;
    let persistenceFailed = storageStatus === "unavailable";
    let newerProgressWasKept = false;
    if (!persistenceFailed) {
      const outcome = await clearFlashcardProgress();
      if (outcome.saved) {
        setStorageStatus("ready");
        nextProgress = chooseNewestFlashcardProgress(
          outcome.value.progress,
          progressRef.current,
        );
        newerProgressWasKept = nextProgress.revision > outcome.value.progress.revision;
      } else {
        persistenceFailed = true;
        setStorageStatus("unavailable");
        const latestProgress = chooseNewestFlashcardProgress(
          progressRef.current,
          progress,
        );
        nextProgress = {
          ...applyFlashcardClearMutation(latestProgress).progress,
          revision: latestProgress.revision,
        };
      }
    }
    if (persistenceFailed && nextProgress.revision > progressRef.current.revision) {
      nextProgress = { ...nextProgress, revision: progressRef.current.revision };
    }
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    setStatusFilter("new");
    setCursor(0);
    setRevealed(false);
    setLastMark(null);
    pendingFocusRef.current = "clear-section";
    setConfirmingClear(false);
    setAnnouncement(persistenceFailed
      ? "Results cleared in this tab, but device storage could not save the change."
      : newerProgressWasKept
        ? "Results were cleared; newer progress from another tab was kept."
        : "All flash card results cleared.");
    setMutationPending(false);
  };

  const reviewedCount = selectedStats.success + selectedStats.failure;
  const totalReviewedCount = Object.keys(progress.results).length;
  const selectedSubjectLabel = activeSubjects.length === subjects.length
    ? "All subjects"
    : `${activeSubjects.length} of ${subjects.length} subjects`;
  const selectedResultLabel = statusFilters.find((filter) => filter.id === statusFilter)?.label ?? "Cards";
  const filterSummary = normalizedQuery
    ? `“${query.trim()}” · ${selectedSubjectLabel} · ${selectedResultLabel} · ${visibleCards.length}`
    : `${selectedSubjectLabel} · ${selectedResultLabel}`;

  return (
    <section className={styles.study} aria-labelledby="flashcard-study-title" aria-busy={mutationPending}>
      <h2 className={styles.srOnly} id="flashcard-study-title">Flash card study deck</h2>

      <div className={styles.studyControls}>
        <section className={styles.overview} aria-label="Study progress">
          <div className={styles.progressHeading}>
            <div>
              <span>{selectedSubjectLabel}</span>
              <strong>{reviewedCount} of {subjectCards.length} reviewed</strong>
            </div>
            <p className={storageStatus === "unavailable" ? styles.storageWarning : undefined}>
              {mutationPending
                ? "Saving card results…"
                : storageStatus === "loading"
                ? "Loading saved results…"
                : storageStatus === "ready"
                  ? "Results save on this device."
                  : "Results are not saving on this device."}
            </p>
          </div>
          <div
            className={styles.progressTrack}
            {...(subjectCards.length > 0 ? {
              role: "progressbar",
              "aria-label": "Cards reviewed in selected subjects",
              "aria-valuemin": 0,
              "aria-valuemax": subjectCards.length,
              "aria-valuenow": reviewedCount,
            } : { "aria-hidden": true })}
          >
            <i
              className={styles.successSegment}
              style={{ width: subjectCards.length ? `${(selectedStats.success / subjectCards.length) * 100}%` : "0%" }}
            />
            <i
              className={styles.failureSegment}
              style={{ width: subjectCards.length ? `${(selectedStats.failure / subjectCards.length) * 100}%` : "0%" }}
            />
          </div>
          <dl className={styles.stats}>
            <div><dt>New</dt><dd>{selectedStats.new}</dd></div>
            <div><dt>Got it</dt><dd>{selectedStats.success}</dd></div>
            <div><dt>Needs work</dt><dd>{selectedStats.failure}</dd></div>
          </dl>
        </section>

        <div className={styles.filterDisclosure}>
        <button
          type="button"
          className={styles.filterToggle}
          disabled={mutationPending}
          aria-expanded={filtersOpen}
          aria-controls="flashcard-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span>Filters</span>
          <strong>{filterSummary}</strong>
        </button>
        <section
          className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`}
          id="flashcard-filters"
          aria-label="Filter flash cards"
        >
          <label className={styles.conceptSearch}>
            <span>Search cards</span>
            <input
              type="search"
              disabled={mutationPending}
              value={query}
              placeholder="Concept, lesson, or term"
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="search"
              spellCheck={false}
              onChange={(event) => searchConcepts(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Subjects</legend>
            <div className={styles.filterScroller}>
              <button
                type="button"
                disabled={mutationPending}
                aria-pressed={activeSubjects.length === subjects.length}
                className={activeSubjects.length === subjects.length ? styles.activeFilter : undefined}
                onClick={() => chooseSubjects(allSubjectIds)}
              >
                All <span>{cards.length}</span>
              </button>
              {subjects.map((subject) => {
                const active = activeSubjectSet.has(subject.id);
                const count = cards.filter((card) => card.subjectId === subject.id).length;
                return (
                  <button
                    type="button"
                    disabled={mutationPending}
                    aria-pressed={active}
                    className={active ? styles.activeFilter : undefined}
                    key={subject.id}
                    onClick={() => toggleSubject(subject.id)}
                  >
                    {subject.shortLabel} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend>Results</legend>
            <div className={styles.filterScroller}>
              {statusFilters.map((filter) => (
                <button
                  type="button"
                  aria-pressed={statusFilter === filter.id}
                  disabled={mutationPending || (storageStatus === "loading" && filter.id !== "all")}
                  className={statusFilter === filter.id ? styles.activeFilter : undefined}
                  key={filter.id}
                  onClick={() => chooseStatus(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>

      {currentCard ? (
        <div className={styles.deck}>
          <header className={styles.deckHeader}>
            <div>
              <p>Card {currentPosition + 1} of {visibleCards.length}</p>
              <button type="button" disabled={mutationPending || visibleCards.length < 2} onClick={mixCards}>
                <span aria-hidden="true">↝</span> Mix deck
              </button>
            </div>
            <span data-result={progress.results[currentCard.id]?.lastResult ?? "new"}>
              {resultLabel(progress.results[currentCard.id]?.lastResult)}
            </span>
          </header>

          <article
            ref={cardRef}
            className={styles.card}
            data-revealed={revealed}
            data-subject={currentCard.subjectId}
          >
            {!revealed ? (
              <button
                ref={cardFrontRef}
                type="button"
                className={styles.cardFront}
                disabled={mutationPending || storageStatus === "loading"}
                aria-expanded="false"
                aria-controls={`answer-${currentCard.id}`}
                onClick={() => {
                  pendingFocusRef.current = "answer";
                  setRevealed(true);
                  setLastMark(null);
                  setAnnouncement(`Answer shown for ${currentCard.concept}.`);
                }}
              >
                <span>{currentCard.module}</span>
                <h3>{currentCard.concept}</h3>
                <p>{currentCard.lesson}</p>
                <strong>Show answer <i aria-hidden="true">↓</i></strong>
              </button>
            ) : (
              <section className={styles.cardBack} id={`answer-${currentCard.id}`}>
                <header>
                  <div>
                    <span>{currentCard.module}</span>
                    <h3 ref={answerHeadingRef} tabIndex={-1}>{currentCard.concept}</h3>
                  </div>
                  <button
                    type="button"
                    disabled={mutationPending}
                    aria-expanded="true"
                    aria-controls={`answer-${currentCard.id}`}
                    onClick={() => {
                      pendingFocusRef.current = "front";
                      setRevealed(false);
                    }}
                  >Hide answer</button>
                </header>
                <p className={styles.definition}>{currentCard.definition}</p>
                <p className={styles.keyPointsLabel}>Three things to remember</p>
                <ol>
                  {currentCard.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ol>
                <p className={styles.example}><span>Example</span>{currentCard.example}</p>
                {currentCard.source ? (
                  <p className={styles.sourceTrail}>
                    <span>Source trail</span>
                    {currentCard.source}
                  </p>
                ) : null}
                <footer className={styles.ratingActions} aria-label={`Rate ${currentCard.concept}`}>
                  <button type="button" className={styles.failureAction} disabled={mutationPending || storageStatus === "loading"} onClick={() => void markCard("failure")}>
                    <span aria-hidden="true">↺</span> Needs work
                  </button>
                  <button type="button" className={styles.successAction} disabled={mutationPending || storageStatus === "loading"} onClick={() => void markCard("success")}>
                    <span aria-hidden="true">✓</span> Got it
                  </button>
                </footer>
              </section>
            )}
          </article>

          <nav className={styles.cardNavigation} aria-label="Move through filtered cards">
            <button type="button" disabled={mutationPending || visibleCards.length < 2} onClick={() => move(-1)}>← Previous</button>
            {lastMark ? <button type="button" className={styles.undoAction} disabled={mutationPending} onClick={() => void undoLastMark()}>Undo last result</button> : <span />}
            <button type="button" disabled={mutationPending || visibleCards.length < 2} onClick={() => move(1)}>Next →</button>
          </nav>
        </div>
      ) : (
        <section className={styles.emptyState}>
          <span aria-hidden="true">○</span>
          <h3 ref={emptyHeadingRef} tabIndex={-1}>No cards match these filters.</h3>
          <p>
            {activeSubjects.length === 0
              ? "Choose at least one subject to build a deck."
              : normalizedQuery
                ? searchedCards.length > 0
                  ? `Matching cards exist, but none are in the ${selectedResultLabel.toLowerCase()} result filter.`
                  : `No card in these subjects matches “${query.trim()}.”`
              : statusFilter === "new"
                ? "You have reviewed every card in these subjects. Review the ones that need work or study the full deck again."
                : "Try another result filter or add more subjects."}
          </p>
          <button type="button" disabled={mutationPending} onClick={() => {
            pendingFocusRef.current = "front";
            if (normalizedQuery && searchedCards.length > 0) {
              chooseStatus("all");
              return;
            }
            chooseSubjects(allSubjectIds);
            setStatusFilter("all");
            setQuery("");
          }}>
            {normalizedQuery && searchedCards.length > 0
              ? "Show all matching cards"
              : normalizedQuery
                ? "Clear search and filters"
                : "Show all cards"}
          </button>
          {lastMark ? <button type="button" disabled={mutationPending} onClick={() => void undoLastMark()}>Undo last result</button> : null}
        </section>
      )}

      <section
        ref={clearSectionRef}
        className={styles.clearSection}
        aria-label="Clear flash card results"
        tabIndex={-1}
      >
        {!confirmingClear ? (
          <button
            ref={clearTriggerRef}
            type="button"
            onClick={() => {
              pendingFocusRef.current = "clear-confirmation";
              setConfirmingClear(true);
            }}
            disabled={mutationPending || totalReviewedCount === 0}
          >Clear results</button>
        ) : (
          <div role="group" aria-label="Confirm clearing flash card results">
            <p>Clear every saved card result?</p>
            <button
              ref={clearConfirmationRef}
              type="button"
              disabled={mutationPending}
              onClick={() => {
                pendingFocusRef.current = "clear-trigger";
                setConfirmingClear(false);
              }}
            >Keep results</button>
            <button type="button" className={styles.confirmClear} disabled={mutationPending} onClick={() => void clearResults()}>Clear all</button>
          </div>
        )}
      </section>
    </section>
  );
}
