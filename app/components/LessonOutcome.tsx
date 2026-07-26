"use client";

import { useEffect, useState } from "react";
import type { CourseLesson } from "@latent/course-kit";
import type { LessonLearningOutcome } from "@/examples/learning-platform/llm-learning/content/llm-systems/learning";
import { lessonLearningOutcome } from "@/examples/learning-platform/llm-learning/lessons/learning";
import {
  recordKnowledgeCheck,
  useLearnerState,
} from "@/app/lib/learner-state";
import { recordLearningEvent } from "@/app/lib/learning-analytics";
import styles from "@/app/components/LessonOutcome.module.css";

export function LessonOutcome({
  lesson,
  outcome: outcomeProp,
}: {
  lesson: CourseLesson;
  outcome?: LessonLearningOutcome;
}) {
  const learner = useLearnerState();
  const outcome = outcomeProp ?? lessonLearningOutcome(lesson.id);
  const check = outcome.check;
  const lessonState = learner.lessons[lesson.id];
  const storedChoice = lessonState?.knowledgeAnswers[check.id] ?? "";
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [lastSubmittedChoice, setLastSubmittedChoice] = useState<string | null>(null);
  const choice = pendingChoice ?? storedChoice;
  const submittedChoice = lastSubmittedChoice ?? storedChoice;
  useEffect(() => {
    void recordLearningEvent("lesson_opened", {
      lessonId: lesson.id,
      moduleId: lesson.courseId,
    });
  }, [lesson.courseId, lesson.id]);

  const submit = () => {
    if (!choice) return;
    const correct = choice === check.correctChoiceId;
    recordKnowledgeCheck(lesson.id, check.id, choice, correct);
    setLastSubmittedChoice(choice);
    setPendingChoice(null);
    void recordLearningEvent("knowledge_check_completed", {
      lessonId: lesson.id,
      moduleId: lesson.courseId,
      outcome: correct ? "passed" : "failed",
    });
  };

  const submitted = Boolean(submittedChoice);
  const submittedCorrect = submittedChoice === check.correctChoiceId;

  return (
    <section className="paper-section lesson-outcome-section" id="outcome">
      <h2 className="sr-only">Knowledge check</h2>
      <div className={styles.layout}>
        <fieldset className={styles.check} aria-describedby={submitted ? `${lesson.id}-knowledge-feedback` : undefined}>
          <legend id={`${lesson.id}-knowledge-title`}>{check.prompt}</legend>
          <div className={styles.choices}>
            {check.choices.map((candidate) => (
              <label
                className={submitted && candidate.id === submittedChoice
                  ? submittedCorrect ? styles.correct : styles.incorrect
                  : ""}
                key={candidate.id}
              >
                <input
                  type="radio"
                  name={`${lesson.id}-${check.id}`}
                  value={candidate.id}
                  checked={choice === candidate.id}
                  onChange={() => {
                    setPendingChoice(candidate.id);
                    if (candidate.id !== submittedChoice) setLastSubmittedChoice("");
                  }}
                />
                <span>{candidate.label}</span>
              </label>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={submit} disabled={!choice}>
              Check answer
            </button>
            {submitted ? (
              <p className={submittedCorrect ? styles.correctText : styles.incorrectText} id={`${lesson.id}-knowledge-feedback`} role="status">
                <strong>{submittedCorrect ? "Correct." : "Not yet."}</strong> {check.explanation}
              </p>
            ) : null}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
