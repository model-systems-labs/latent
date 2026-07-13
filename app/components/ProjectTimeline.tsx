"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { courseLessons } from "../lessons/course";
import { lessonIsComplete, useLearnerState } from "../lib/learner-state";

export function ProjectTimeline() {
  const learner = useLearnerState();
  const current = courseLessons.filter((lesson) => lessonIsComplete(
    learner,
    lesson.id,
    lesson.implementation.codeBlocks.length,
  )).length;
  const [selection, setSelection] = useState<number | "current">("current");
  const index = selection === "current" ? current : selection;
  const visible = useMemo(() => courseLessons.slice(0, index), [index]);
  const active = visible.at(-1);

  return (
    <section className="project-timeline" aria-labelledby="project-timeline-title">
      <header>
        <div><span>Curriculum snapshots</span><h2 id="project-timeline-title">See the repository accumulate.</h2></div>
        <p>This view never changes your saved work. It reconstructs which lesson-owned files exist at a selected point in the course.</p>
      </header>
      <div className="project-timeline-controls">
        <div role="group" aria-label="Project timeline presets">
          <button type="button" className={index === 1 && selection !== "current" ? "active" : ""} onClick={() => setSelection(1)}>Lesson 01</button>
          <button type="button" className={index === 7 && selection !== "current" ? "active" : ""} onClick={() => setSelection(7)}>Lesson 07</button>
          <button type="button" className={index === 14 && selection !== "current" ? "active" : ""} onClick={() => setSelection(14)}>Lesson 14</button>
          <button type="button" className={selection === "current" ? "active" : ""} onClick={() => setSelection("current")}>My progress · {current}</button>
        </div>
        <label>
          <span>Snapshot after {index === 0 ? "project initialization" : `lesson ${String(index).padStart(2, "0")}`}</span>
          <input type="range" min="0" max={courseLessons.length} value={index} onChange={(event) => setSelection(Number(event.target.value))} />
        </label>
      </div>
      <div className="project-timeline-view">
        <header><code>browser-chat/</code><span>{4 + visible.length + 5} files visible</span></header>
        <div className="timeline-provided-files"><span>provided runtime</span><code>runtime/latent-tensor.js · model.config.js · transport.config.js · interface.config.js</code></div>
        <ol>
          {visible.length ? visible.map((lesson, lessonIndex) => {
            const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
            const complete = lessonIsComplete(learner, lesson.id, lesson.implementation.codeBlocks.length);
            return (
              <li className={lesson.id === active?.id ? "active" : ""} key={lesson.id}>
                <span>{String(lessonIndex + 1).padStart(2, "0")}</span>
                <Link href={`/workspace?file=${encodeURIComponent(path)}`}><code>{path}</code><em>{complete ? "verified in your project" : "introduced by this snapshot"}</em></Link>
              </li>
            );
          }) : <li className="empty"><span>—</span><p>No lesson files have been introduced at project initialization.</p></li>}
        </ol>
        <div className="timeline-capstone-files"><span>provided application shell</span><code>runtime/host-bridge.ts · vendor/* · capstone/*</code></div>
      </div>
      <footer><p>{active ? `${active.title} is the newest lesson contribution in this snapshot.` : "The runtime and application shell exist before the first lesson file."}</p><Link href="/workspace">Open current project →</Link></footer>
    </section>
  );
}
