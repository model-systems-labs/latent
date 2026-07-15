"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CourseLesson } from "@latent/course-kit";
import { lessonLearningOutcome, moduleCheckpoint } from "../content/llm-systems/learning";
import {
  lessonImplementationIsComplete,
  lessonKnowledgeIsComplete,
  recordKnowledgeCheck,
  useLearnerState,
} from "../lib/learner-state";
import { recordLearningEvent } from "../lib/learning-analytics";
import { courseLessons } from "../lessons/course";

export function LessonOutcome({ lesson }: { lesson: CourseLesson }) {
  const learner = useLearnerState();
  const outcome = lessonLearningOutcome(lesson.id);
  const check = outcome.check;
  const lessonState = learner.lessons[lesson.id];
  const storedChoice = lessonState?.knowledgeAnswers[check.id] ?? "";
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [lastSubmittedChoice, setLastSubmittedChoice] = useState<string | null>(null);
  const choice = pendingChoice ?? storedChoice;
  const submittedChoice = lastSubmittedChoice ?? storedChoice;
  const implementationComplete = lessonImplementationIsComplete(
    learner,
    lesson.id,
    lesson.implementation.codeBlocks.length,
  );
  const knowledgeComplete = lessonKnowledgeIsComplete(learner, lesson.id, check.id);
  const currentIndex = courseLessons.findIndex((candidate) => candidate.id === lesson.id);
  const next = courseLessons[currentIndex + 1];
  const nextInModule = next?.courseId === lesson.courseId ? next : null;
  const checkpoint = moduleCheckpoint(lesson.courseId ?? "models");
  const projectPath = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;

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
      <div className="section-title"><span>03</span><h2>Verify the result</h2></div>
      <div className="lesson-outcome-layout">
        <section className="knowledge-check" aria-labelledby={`${lesson.id}-knowledge-title`}>
          <header>
            <span>Prediction check</span>
            <strong id={`${lesson.id}-knowledge-title`}>{check.prompt}</strong>
          </header>
          <fieldset>
            <legend className="sr-only">Choose one answer</legend>
            {check.choices.map((candidate) => (
              <label
                className={submitted && candidate.id === submittedChoice
                  ? submittedCorrect ? "selected correct" : "selected incorrect"
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
          </fieldset>
          <footer>
            <button type="button" onClick={submit} disabled={!choice}>
              {submitted ? "Check again" : "Check prediction"}
            </button>
            {submitted ? (
              <p className={submittedCorrect ? "correct" : "incorrect"} role="status">
                <strong>{submittedCorrect ? "Correct." : "Not yet."}</strong> {check.explanation}
              </p>
            ) : <p>Choose before revealing the explanation.</p>}
          </footer>
        </section>

        <section className="lesson-change-record" aria-label="Lesson project change">
          <header><span>Project source</span><code>{projectPath}</code></header>
          <div><span>Implemented</span><p>{outcome.concept}</p></div>
          <div className="behavior-change">
            <article><span>Before</span><p>{outcome.before}</p></article>
            <i aria-hidden="true">→</i>
            <article><span>After</span><p>{outcome.after}</p></article>
          </div>
          <dl>
            <div><dt>Implementation</dt><dd className={implementationComplete ? "complete" : "pending"}>{implementationComplete ? "Verified" : "Complete code + experiment"}</dd></div>
            <div><dt>Concept</dt><dd className={knowledgeComplete ? "complete" : "pending"}>{knowledgeComplete ? "Verified" : "Prediction pending"}</dd></div>
          </dl>
          <p className="project-source-note">This exact Python source gates the promoted build. Browser adapters are read-only and checked against the same matching cases; the trained Character RNN additionally enters the chatbot as a checkpoint.</p>
          <footer>
            <Link href={`/workspace?file=${encodeURIComponent(projectPath)}`}>Open changed file</Link>
            {nextInModule ? (
              <Link className="primary" href={`/lessons/${nextInModule.id}`}>Continue to {nextInModule.title} →</Link>
            ) : checkpoint ? (
              <Link className="primary" href={`/checkpoints/${checkpoint.courseId}`}>Run module checkpoint →</Link>
            ) : null}
          </footer>
        </section>
      </div>
    </section>
  );
}
