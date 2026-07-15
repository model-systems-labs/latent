"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { courseLessons } from "../lessons/course";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { expectedProjectContractIdsForPath, projectLessonIsComplete, trustedProjectResults } from "../lib/project-file-status";
import { useProjectState } from "../lib/project-workspace";
import { canonicalLessonSeeds } from "../lib/canonical-project";
import { lessonLearningOutcome } from "../content/llm-systems/learning";

export function ProjectTimeline() {
  const learner = useLearnerState();
  const project = useProjectState();
  const trustedResults = trustedProjectResults(project.tests);
  const expectedLessonEvidence = new Map(canonicalLessonSeeds(learner).map((seed) => [seed.path, seed]));
  const currentLessonComplete = (lesson: (typeof courseLessons)[number]) => {
    const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
    const file = project.files[path];
    const expected = expectedLessonEvidence.get(path);
    return projectLessonIsComplete({
      learnerComplete: lessonIsComplete(learner, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id),
      projectSource: file?.content,
      verifiedSource: expected?.content,
      verifiedCells: expected?.verifiedCells ?? 0,
      totalCells: lesson.implementation.codeBlocks.length,
      trustedResults: trustedResults[path] ?? [],
      expectedContractIds: expectedProjectContractIdsForPath(path),
    });
  };
  const currentPosition = courseLessons.reduce((furthest, lesson, lessonIndex) => {
    const progress = learner.lessons[lesson.id];
    const hasProgress = Boolean(progress && (
      progress.verifiedCells.length > 0 || progress.experimentComplete || progress.knowledgeVerified.length > 0
    ));
    return hasProgress ? lessonIndex + 1 : furthest;
  }, 0);
  const [selection, setSelection] = useState<number | "current">("current");
  const index = selection === "current" ? currentPosition : selection;
  const visible = useMemo(() => courseLessons.slice(0, index), [index]);
  const active = visible.at(-1);

  return (
    <section className="project-timeline" aria-labelledby="project-timeline-title">
      <header>
        <h2 id="project-timeline-title">Project history</h2>
        <p>Move through the course to see when each lesson file joins the project.</p>
      </header>
      <div className="project-timeline-controls">
        <label>
          <span>{selection === "current"
            ? `My course position · ${currentPosition || "start"}`
            : index === 0 ? "Before lesson files" : `After lesson ${index}`}</span>
          <input aria-valuetext={index === 0 ? "Before lesson files" : `${index} lesson ${index === 1 ? "file" : "files"} introduced`} type="range" min="0" max={courseLessons.length} value={index} onChange={(event) => setSelection(Number(event.target.value))} />
        </label>
        {selection !== "current" ? <button type="button" onClick={() => setSelection("current")}>Return to my progress</button> : null}
      </div>
      <div className="project-timeline-view">
        <header><code>browser-chat/</code></header>
        <ol>
          {visible.length ? visible.map((lesson) => {
            const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
            const learnerComplete = lessonIsComplete(learner, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id);
            const complete = currentLessonComplete(lesson);
            return (
              <li aria-current={lesson.id === active?.id ? "step" : undefined} className={lesson.id === active?.id ? "active" : ""} key={lesson.id}>
                <Link href={`/workspace?file=${encodeURIComponent(path)}`}><code>{path}</code><em>{complete ? "Lesson done" : learnerComplete ? "Current code needs another check" : "File added here"}</em></Link>
              </li>
            );
          }) : <li className="empty"><p>No lesson files yet.</p></li>}
        </ol>
      </div>
    </section>
  );
}
