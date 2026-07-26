"use client";

import Link from "next/link";
import type { CourseLesson } from "@latent/course-kit";
import { lessonIsComplete, useLearnerState, useLearnerStateHydrated } from "../lib/learner-state";
import { lessonLearningOutcome } from "../../products/courses/reference-curriculum/lessons/learning";
import { contractSuiteForLesson } from "../../products/courses/reference-curriculum/lessons/contract-suite";

export function CourseCurriculum({
  title,
  lessons,
  completionLabel = "Module lessons complete",
}: {
  title: string;
  lessons: CourseLesson[];
  completionLabel?: string;
}) {
  const learnerState = useLearnerState();
  const hydrated = useLearnerStateHydrated();
  const isComplete = (lesson: CourseLesson) => lessonIsComplete(
    learnerState,
    lesson.id,
    lesson.implementation.codeBlocks.map((block) => block.id),
    contractSuiteForLesson(lesson.id).contractVersion,
    lessonLearningOutcome(lesson.id).check.id,
  );
  const completed = lessons.filter(isComplete).length;
  const completionPercentage = lessons.length ? completed / lessons.length * 100 : 0;
  const hasProgress = hydrated && lessons.some((lesson) => (learnerState.lessons[lesson.id]?.updatedAt ?? 0) > 0);
  const nextLesson = lessons.find((lesson) => !isComplete(lesson));
  return (
    <>
      <div className="course-progress-record" aria-label={hydrated ? `${completed} of ${lessons.length} lessons complete` : "Restoring lesson progress"} aria-busy={!hydrated}>
        <span>{hydrated ? `${completed} of ${lessons.length} complete` : "Restoring progress…"}</span>
        <i aria-hidden="true"><b style={{ width: hydrated ? `${completionPercentage}%` : "0%" }} /></i>
      </div>
      {hydrated ? (
        <div className="course-progress-next">
          {nextLesson
            ? <Link href={`/lessons/${nextLesson.id}`}>{hasProgress ? "Continue" : "Start"} {nextLesson.title} →</Link>
            : <span>{completionLabel}</span>}
        </div>
      ) : null}
      <section className="curriculum-list" aria-label={`${title} lessons`}>
        {lessons.map((lesson, index) => {
          const progress = learnerState.lessons[lesson.id];
          const complete = isComplete(lesson);
          const status = hydrated ? complete ? "Complete" : progress?.updatedAt ? "In progress" : null : null;
          return (
            <Link className={`lesson-card lesson-card-simple ${complete ? "completed" : ""}`} href={`/lessons/${lesson.id}`} key={lesson.id}>
              <div style={{ alignItems: "start", display: "grid", gap: "1.1rem", gridTemplateColumns: "2.25rem minmax(0, 1fr)" }}>
                <span style={{ color: "var(--violet)", fontFamily: "var(--mono)", fontSize: "max(0.68rem, 11px)", letterSpacing: "0.08em", paddingTop: "0.2rem" }}><span className="sr-only">Lesson </span>{String(index + 1).padStart(2, "0")}</span>
                <div><h2>{lesson.title}</h2><p>{lesson.thesis}</p></div>
              </div>
              {status ? <span className="lesson-card-status">{status}</span> : null}
            </Link>
          );
        })}
      </section>
    </>
  );
}
