"use client";

import { useCallback, useState } from "react";
import type { TestReceipt } from "@latent/browser-lab";
import type { BrowserIdePersistedState } from "@latent/browser-lab/ide";
import {
  loadQuestionProgress,
  saveQuestionAttempt,
  type QuestionProgressIdentity,
} from "../../lib/question-progress";
import { BrowserIdeExtensionWorkbench } from "./BrowserIdeExtensionWorkbench";
import {
  bundledMethodQuestionIdeExercise,
  restoreReviewedQuestionSource,
  type BundledMethodQuestionIdeExercise,
} from "./reviewed-question-extension";
import styles from "./BrowserIdeExtensionWorkbench.module.css";

const exerciseCache = new Map<string, BundledMethodQuestionIdeExercise>();

function bundledExercise(questionId: string): BundledMethodQuestionIdeExercise {
  const cached = exerciseCache.get(questionId);
  if (cached) return cached;
  const exercise = bundledMethodQuestionIdeExercise(questionId);
  exerciseCache.set(questionId, exercise);
  return exercise;
}

export function bundledQuestionProgressIdentity(
  exercise: BundledMethodQuestionIdeExercise,
): QuestionProgressIdentity {
  return {
    libraryId: exercise.libraryId,
    questionId: `${exercise.groupId}/${exercise.question.id}`,
  };
}

async function recordQuestionAttempt(
  exercise: BundledMethodQuestionIdeExercise,
  receipt: TestReceipt,
  state: BrowserIdePersistedState,
) {
  const editableSource = state.files.find((file) => file.path === exercise.question.path);
  if (!editableSource) throw new Error("The checked question source is unavailable.");
  const source = restoreReviewedQuestionSource(exercise.question, editableSource.contents);
  const identity = bundledQuestionProgressIdentity(exercise);
  let current = await loadQuestionProgress(identity);
  const mutationId = `ide-attempt:${receipt.receiptId}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = await saveQuestionAttempt(identity, {
      source,
      contractVersion: receipt.contractVersion,
      passed: receipt.status === "passed",
      expectedEpoch: current.epoch,
      expectedRevision: current.revision,
      mutationId,
    });
    if (!outcome.saved) throw new Error("Question progress could not be saved on this device.");
    current = outcome.value.progress;
    if (
      outcome.value.applied
      && outcome.value.reason !== "stale-epoch"
      && outcome.value.reason !== "stale-revision"
    ) return current;
    current = await loadQuestionProgress(identity);
  }
  throw new Error("Question progress changed in another tab before this result could be recorded.");
}

/**
 * Reviewed Question Groups opt into the generic IDE seam here. The exercise
 * cache gives each question a stable definition and runtime-options identity,
 * while attempts flow into the same progress records used by /practice and
 * the leech query.
 */
export function BundledQuestionIdeWorkbench({
  questionId,
}: {
  readonly questionId: string;
}) {
  const exercise = bundledExercise(questionId);
  const [progressMessage, setProgressMessage] = useState("");
  const onReceipt = useCallback((
    receipt: TestReceipt,
    state: BrowserIdePersistedState,
  ) => {
    setProgressMessage("Recording this attempt in Question Group progress…");
    void recordQuestionAttempt(exercise, receipt, state).then(() => {
      setProgressMessage(
        receipt.status === "passed"
          ? "Solved status recorded for Practice and Leeches."
          : "Attempt recorded. Repeated misses may appear in Leeches.",
      );
    }).catch((error: unknown) => {
      setProgressMessage(
        error instanceof Error
          ? error.message
          : "The check finished, but Question Group progress could not be saved.",
      );
    });
  }, [exercise]);

  return (
    <section className={styles.practiceExercise}>
      <header className={styles.prompt}>
        <p className={styles.promptLabel}>Question Group · {exercise.groupId}</p>
        <h2>{exercise.question.title}</h2>
        <p>{exercise.question.prompt}</p>
        <ul>
          {exercise.question.constraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ul>
      </header>
      <BrowserIdeExtensionWorkbench
        definition={exercise.definition}
        onReceipt={onReceipt}
        runtimeOptions={exercise.runtimeOptions}
      />
      <p aria-live="polite" className={styles.status} role="status">
        {progressMessage}
      </p>
    </section>
  );
}
