"use client";

import Link from "next/link";
import type { CourseLesson } from "@latent/course-kit";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { lessonLearningOutcome } from "../content/llm-systems/learning";

export function CourseCurriculum({ title, lessons }: { title: string; lessons: CourseLesson[] }) {
  const learnerState = useLearnerState();
  const completed = lessons.filter((lesson) => lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id)).length;
  const completionPercentage = lessons.length ? completed / lessons.length * 100 : 0;
  return (
    <>
      <div className="course-progress-record" aria-label={`${completed} of ${lessons.length} lessons complete`}>
        <span>{completed} of {lessons.length} complete</span>
        <i aria-hidden="true"><b style={{ width: `${completionPercentage}%` }} /></i>
      </div>
      <section className="curriculum-list" aria-label={`${title} lessons`}>
        {lessons.map((lesson) => {
          const progress = learnerState.lessons[lesson.id];
          const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id);
          const status = complete ? "Complete" : progress?.updatedAt ? "In progress" : null;
          return (
            <Link className={`lesson-card lesson-card-simple ${complete ? "completed" : ""}`} href={`/lessons/${lesson.id}`} key={lesson.id}>
              <div><h2>{lesson.title}</h2><p>{lesson.thesis}</p></div>
              {status ? <span className="lesson-card-status">{status}</span> : null}
            </Link>
          );
        })}
      </section>
    </>
  );
}
