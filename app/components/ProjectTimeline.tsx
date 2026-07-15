"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { courseLessons } from "../lessons/course";
import { CANONICAL_BROWSER_CHAT_FILES } from "../content/browser-chat/project-template";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { expectedProjectContractIdsForPath, projectLessonIsComplete, projectTimelineVisibleFileCount, trustedProjectResults } from "../lib/project-file-status";
import { RUNTIME_PATHS, useProjectState } from "../lib/project-workspace";
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
  const completedLessons = courseLessons.filter(currentLessonComplete).length;
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
  const providedRuntimePaths = Object.values(RUNTIME_PATHS);

  return (
    <section className="project-timeline" aria-labelledby="project-timeline-title">
      <header>
        <div><span>Course history</span><h2 id="project-timeline-title">Project snapshots</h2></div>
        <p>These snapshots show when each source file gets added. To finish a lesson, complete its lab, verify its code, and make sure there’s no trusted failing IDE result.</p>
      </header>
      <div className="project-timeline-controls">
        <div role="group" aria-label="Project timeline presets">
          <button type="button" aria-pressed={index === 1 && selection !== "current"} className={index === 1 && selection !== "current" ? "active" : ""} onClick={() => setSelection(1)}>Lesson 01</button>
          <button type="button" aria-pressed={index === 7 && selection !== "current"} className={index === 7 && selection !== "current" ? "active" : ""} onClick={() => setSelection(7)}>Lesson 07</button>
          <button type="button" aria-pressed={index === 14 && selection !== "current"} className={index === 14 && selection !== "current" ? "active" : ""} onClick={() => setSelection(14)}>Lesson 14</button>
          <button type="button" aria-pressed={selection === "current"} className={selection === "current" ? "active" : ""} onClick={() => setSelection("current")}>My course position · {currentPosition || "start"}</button>
        </div>
        <label>
          <span>{selection === "current"
            ? `${completedLessons} current ${completedLessons === 1 ? "lesson" : "lessons"} complete · ${currentPosition} lesson ${currentPosition === 1 ? "file" : "files"} introduced historically`
            : index === 0 ? "Course snapshot · before lesson files" : `Course snapshot · first ${index} lesson ${index === 1 ? "file" : "files"}`}</span>
          <input aria-valuetext={index === 0 ? "Before lesson files" : `${index} lesson ${index === 1 ? "file" : "files"} introduced`} type="range" min="0" max={courseLessons.length} value={index} onChange={(event) => setSelection(Number(event.target.value))} />
        </label>
      </div>
      <div className="project-timeline-view">
        <header><code>browser-chat/</code><span>{projectTimelineVisibleFileCount(visible.length, providedRuntimePaths.length, CANONICAL_BROWSER_CHAT_FILES.length)} files visible</span></header>
        <div className="timeline-provided-files"><span>provided runtime</span><code>{providedRuntimePaths.join(" · ")}</code></div>
        <ol>
          {visible.length ? visible.map((lesson, lessonIndex) => {
            const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
            const learnerComplete = lessonIsComplete(learner, lesson.id, lesson.implementation.codeBlocks.length, lessonLearningOutcome(lesson.id).check.id);
            const complete = currentLessonComplete(lesson);
            return (
              <li aria-current={lesson.id === active?.id ? "step" : undefined} className={lesson.id === active?.id ? "active" : ""} key={lesson.id}>
                <span>{String(lessonIndex + 1).padStart(2, "0")}</span>
                <Link href={`/workspace?file=${encodeURIComponent(path)}`}><code>{path}</code><em>{complete ? "Lesson done" : learnerComplete ? "Current code needs another check" : "File added here"}</em></Link>
              </li>
            );
          }) : <li className="empty"><span>—</span><p>The project starts before any lesson files are added.</p></li>}
        </ol>
        <div className="timeline-capstone-files"><span>provided application shell</span><code>runtime/host-bridge.ts · vendor/* · capstone/*</code></div>
      </div>
      <footer><p>{active ? `${active.title} is the newest lesson file in this snapshot.` : "The runtime and app shell are already there before the first lesson file."}</p><Link href="/workspace">Open current project →</Link></footer>
    </section>
  );
}
