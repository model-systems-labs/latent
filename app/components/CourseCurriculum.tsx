"use client";

import Link from "next/link";
import type { CourseLesson } from "@latent/course-kit";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { lessonLearningOutcome } from "../content/llm-systems/learning";

export function CourseCurriculum({ title, lessons }: { title: string; lessons: CourseLesson[] }) {
  const learnerState = useLearnerState();
  const completed = lessons.filter((lesson) => lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id)).length;
  return (
    <>
      <div className="course-progress-record" aria-label={`${completed} of ${lessons.length} lessons complete`}>
        <div><span>Your progress</span><strong>{completed}/{lessons.length} lessons done</strong></div>
        <i><b style={{ width: `${completed / lessons.length * 100}%` }} /></i>
        <Link href="/project">View project →</Link>
      </div>
      <section className="curriculum-list" aria-label={`${title} lessons`}>
        {lessons.map((lesson, index) => {
          const progress = learnerState.lessons[lesson.id];
          const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id);
          return (
            <Link className={`lesson-card ${complete ? "completed" : ""}`} href={`/lessons/${lesson.id}`} key={lesson.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{lesson.title}</h2><p>{lesson.thesis}</p></div>
              <div className="lesson-build">
                <em>{lesson.modeLabel}</em>
                <strong>{lesson.experiment.title}</strong>
                <small>{complete ? "Done on this device" : `${progress?.verifiedCells.length ?? 0}/${lesson.implementation.codeBlocks.length} checks · ${progress?.experimentComplete ? "lab done" : "lab still to do"}`}</small>
              </div>
              <i>{complete ? "Review →" : "Open →"}</i>
            </Link>
          );
        })}
      </section>
    </>
  );
}
