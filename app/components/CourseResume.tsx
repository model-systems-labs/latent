"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { courseLessons } from "@/examples/learning-platform/llm-learning/lessons/course";
import { lessonLearningOutcome } from "@/examples/learning-platform/llm-learning/content/llm-systems/learning";
import { initializeLearnerPersistence, lessonIsComplete, useLearnerState } from "@/app/lib/learner-state";
import { llmSystemsContractSuite } from "@/examples/learning-platform/llm-learning/content/llm-systems/contracts";
import { initializeProjectPersistence, useProjectState } from "@/app/lib/project-workspace";
import styles from "@/app/components/CourseResume.module.css";

export function CourseResume() {
  const learner = useLearnerState();
  const project = useProjectState();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([initializeLearnerPersistence(), initializeProjectPersistence()]).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  if (!hydrated) {
    return (
      <section className={`${styles.resume} ${styles.loading}`} aria-busy="true" aria-live="polite">
        <p>Restoring your place…</p>
      </section>
    );
  }

  const startedLessons = courseLessons.filter((lesson) => (learner.lessons[lesson.id]?.updatedAt ?? 0) > 0);
  const nextLesson = courseLessons.find((lesson) => !lessonIsComplete(
    learner,
    lesson.id,
    lesson.implementation.codeBlocks.map((block) => block.id),
    llmSystemsContractSuite.contractVersion,
    lessonLearningOutcome(lesson.id).check.id,
  ));
  const completedLessons = courseLessons.filter((lesson) => lessonIsComplete(
    learner,
    lesson.id,
    lesson.implementation.codeBlocks.map((block) => block.id),
    llmSystemsContractSuite.contractVersion,
    lessonLearningOutcome(lesson.id).check.id,
  )).length;
  const lastEditedProjectFile = Object.values(project.files)
    .filter((file) => file.sourceProvenance === "ide")
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const projectStarted = Boolean(lastEditedProjectFile || project.tests.ranAt > 0 || project.activeBuild);

  if (startedLessons.length === 0 && !projectStarted) return null;

  const nextPath = startedLessons.length > 0
    ? nextLesson ? `${nextLesson.courseId ?? "models"}/${nextLesson.implementation.filename}` : "capstone/BrowserChat.tsx"
    : lastEditedProjectFile?.path ?? project.selectedPath;
  const nextProgress = nextLesson ? learner.lessons[nextLesson.id] : null;
  const projectOnly = startedLessons.length === 0 && projectStarted;

  return (
    <section className={styles.resume} aria-labelledby="course-resume-title">
      <header>
        <span>{projectOnly ? "Saved project work" : nextLesson ? `${completedLessons} of ${courseLessons.length} lessons complete` : "All lessons complete"}</span>
        <h2 id="course-resume-title">{projectOnly ? "Continue your browser project" : nextLesson ? nextLesson.title : "Build Browser Chat"}</h2>
        <p>{projectOnly
          ? `Your latest saved work is in ${nextPath}. You can reopen it or return to the first unfinished lesson.`
          : nextLesson
          ? nextProgress?.updatedAt
            ? "Continue the reading, implementation, experiment, and check where you left off."
            : "This is the next unfinished lesson in the course sequence."
          : "Review the assembled project, run its full checks, and open the capstone from the passing build."}</p>
      </header>
      <div className={styles.actions}>
        <Link className="primary" href={projectOnly ? `/workspace?file=${encodeURIComponent(nextPath)}` : nextLesson ? `/lessons/${nextLesson.id}` : "/project"}>{projectOnly ? "Resume project" : nextLesson && nextProgress?.updatedAt ? "Resume lesson" : nextLesson ? "Start lesson" : "Review project"} →</Link>
        {projectOnly && nextLesson ? <Link href={`/lessons/${nextLesson.id}`}>Return to {nextLesson.title}</Link> : null}
        {!projectOnly ? <Link href={`/workspace?file=${encodeURIComponent(nextPath)}`}>Open {nextPath}</Link> : null}
      </div>
      <p className={styles.storage}>Progress and code are saved in this browser. You can save an optional backup from the IDE.</p>
    </section>
  );
}
