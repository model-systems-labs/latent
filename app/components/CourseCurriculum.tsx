"use client";

import Link from "next/link";
import type { CourseLesson } from "../lib/lesson-types";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { useProjectState } from "../lib/project-workspace";

export function CourseCurriculum({ title, lessons }: { title: string; lessons: CourseLesson[] }) {
  const learnerState = useLearnerState();
  const project = useProjectState();
  const completed = lessons.filter((lesson) => lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length)).length;
  const savedFiles = lessons.filter((lesson) => project.files[`${lesson.courseId ?? "models"}/${lesson.implementation.filename}`]).length;
  return (
    <>
      <div className="course-progress-record" aria-label={`${completed} of ${lessons.length} lessons complete`}>
        <div><span>Device-local project</span><strong>{completed}/{lessons.length} lessons complete · {savedFiles}/{lessons.length} source files saved</strong></div>
        <i><b style={{ width: `${completed / lessons.length * 100}%` }} /></i>
        <Link href="/workspace">Open project IDE →</Link>
      </div>
      <section className="curriculum-list" aria-label={`${title} lessons`}>
        {lessons.map((lesson, index) => {
          const progress = learnerState.lessons[lesson.id];
          const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length);
          const projectPath = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
          return (
            <Link className={`lesson-card ${complete ? "completed" : ""}`} href={`/lessons/${lesson.id}`} key={lesson.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{lesson.title}</h2><p>{lesson.thesis}</p></div>
              <div className="lesson-build">
                <em>{lesson.modeLabel}</em>
                <strong>{lesson.experiment.title}</strong>
                <span>{lesson.sources.length} curated sources</span>
                <code>{projectPath}</code>
                <small>{complete ? "Complete on this device" : `${progress?.verifiedCells.length ?? 0}/${lesson.implementation.codeBlocks.length} checks · ${progress?.experimentComplete ? "lab run" : "lab pending"}`}</small>
              </div>
              <i>{complete ? "Review →" : "Open →"}</i>
            </Link>
          );
        })}
      </section>
    </>
  );
}
