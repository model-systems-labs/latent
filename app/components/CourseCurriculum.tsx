"use client";

import Link from "next/link";
import type { CourseLesson } from "@latent/course-kit";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { useProjectState } from "../lib/project-workspace";
import { projectFileStatus } from "../lib/project-file-status";
import { ProjectStructureMap } from "./ProjectStructureMap";

export function CourseCurriculum({ title, lessons }: { title: string; lessons: CourseLesson[] }) {
  const learnerState = useLearnerState();
  const project = useProjectState();
  const completed = lessons.filter((lesson) => lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length)).length;
  const trustedResults = project.tests.runner === "browser-lab-v1" ? project.tests.results : {};
  const fileStatuses = lessons.map((lesson) => {
    const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
    const file = project.files[path];
    const verifiedCells = learnerState.lessons[lesson.id]?.verifiedCells.length ?? file?.verifiedCells ?? 0;
    return projectFileStatus({ isLessonFile: true, verifiedCells, totalCells: lesson.implementation.codeBlocks.length, results: trustedResults[path] ?? [] });
  });
  const completedFiles = fileStatuses.filter((status) => status.complete).length;
  const inProgressFiles = fileStatuses.filter((status) => status.tone === "in-progress").length;
  const pendingFiles = fileStatuses.filter((status) => status.tone === "pending" || status.tone === "failed").length;
  return (
    <>
      <div className="course-progress-record" aria-label={`${completed} of ${lessons.length} lessons complete`}>
        <div><span>Module project</span><strong>{completedFiles}/{lessons.length} files complete{inProgressFiles ? ` · ${inProgressFiles} in progress` : ""} · {pendingFiles} pending</strong></div>
        <i><b style={{ width: `${completedFiles / lessons.length * 100}%` }} /></i>
        <Link href="/workspace">Open project IDE →</Link>
      </div>
      <ProjectStructureMap activeCourseId={lessons[0]?.courseId} />
      <section className="curriculum-list" aria-label={`${title} lessons`}>
        {lessons.map((lesson, index) => {
          const progress = learnerState.lessons[lesson.id];
          const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length);
          const projectPath = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
          const fileStatus = fileStatuses[index];
          return (
            <Link className={`lesson-card ${complete ? "completed" : ""}`} href={`/lessons/${lesson.id}`} key={lesson.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{lesson.title}</h2><p>{lesson.thesis}</p></div>
              <div className="lesson-build">
                <code>{projectPath}</code>
                <small className={`status-${fileStatus.tone}`}>{fileStatus.label}</small>
                <em>{complete ? "Lesson complete" : `${progress?.experimentComplete ? "Experiment complete" : "Experiment pending"}`}</em>
              </div>
              <i>{complete ? "Review →" : "Open →"}</i>
            </Link>
          );
        })}
      </section>
    </>
  );
}
