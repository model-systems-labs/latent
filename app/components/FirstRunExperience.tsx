"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RnnResult } from "@latent/model-lab/character-rnn";
import { recordLearningEvent } from "../lib/learning-analytics";
import { courseLessons } from "../lessons/course";
import { lessonLearningOutcome } from "../content/llm-systems/learning";
import { initializeLearnerPersistence, lessonIsComplete, useLearnerState } from "../lib/learner-state";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { initializeProjectPersistence, useProjectState } from "../lib/project-workspace";
import styles from "./FirstRunExperience.module.css";

export function FirstRunExperience() {
  const learner = useLearnerState();
  const project = useProjectState();
  const [hydrated, setHydrated] = useState(false);
  const [prompt, setPrompt] = useState("the system ");
  const [result, setResult] = useState<RnnResult | null>(null);
  const [openOutput, setOpenOutput] = useState("");
  const [constrainedOutput, setConstrainedOutput] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([initializeLearnerPersistence(), initializeProjectPersistence()]).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  const generate = async (checkpoint: RnnResult) => {
    const { sampleCharacterRnn } = await import("@latent/model-lab/character-rnn");
    const safePrompt = prompt.trim().slice(0, 64) || "the system";
    setOpenOutput(`…${safePrompt}${sampleCharacterRnn(checkpoint.checkpoint, safePrompt, 96, 1.05, 71, 0)}`);
    setConstrainedOutput(`…${safePrompt}${sampleCharacterRnn(checkpoint.checkpoint, safePrompt, 96, 0.72, 71, 5)}`);
  };

  const run = async () => {
    if (working) return;
    setWorking(true);
    setStatus(result ? "Generating twice with the same weights and seed…" : "Training 1,267 parameters for 100 repeatable updates…");
    void recordLearningEvent("first_run_started");
    try {
      let trained = result;
      if (!trained) {
        const controller = new AbortController();
        abortRef.current = controller;
        const { trainCharacterRnnInWorker } = await import("../runtime/model/train-character-client");
        trained = await trainCharacterRnnInWorker(100, controller.signal);
        setResult(trained);
        abortRef.current = null;
      }
      await generate(trained);
      setStatus(`Loss ${trained.initialLoss.toFixed(3)} → ${trained.finalLoss.toFixed(3)}. The outputs differ only because the generation settings changed.`);
      void recordLearningEvent("first_run_completed", { outcome: "passed" });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setStatus(cancelled ? "Training cancelled." : error instanceof Error ? error.message : "The first run stopped safely.");
      void recordLearningEvent("first_run_completed", { outcome: cancelled ? "cancelled" : "failed" });
    } finally {
      setWorking(false);
    }
  };

  const isComplete = (lesson: (typeof courseLessons)[number]) => lessonIsComplete(
    learner,
    lesson.id,
    lesson.implementation.codeBlocks.map((block) => block.id),
    llmSystemsContractSuite.contractVersion,
    lessonLearningOutcome(lesson.id).check.id,
  );
  const startedLessons = courseLessons
    .filter((lesson) => (learner.lessons[lesson.id]?.updatedAt ?? 0) > 0)
    .sort((left, right) => (learner.lessons[right.id]?.updatedAt ?? 0) - (learner.lessons[left.id]?.updatedAt ?? 0));
  const latestStartedLesson = startedLessons[0];
  const firstIncompleteLesson = courseLessons.find((lesson) => !isComplete(lesson));
  const nextLesson = latestStartedLesson
    ? !isComplete(latestStartedLesson)
      ? latestStartedLesson
      : courseLessons
        .slice(courseLessons.indexOf(latestStartedLesson) + 1)
        .find((lesson) => !isComplete(lesson)) ?? firstIncompleteLesson
    : firstIncompleteLesson;
  const completedLessons = courseLessons.filter(isComplete).length;
  const lastEditedProjectFile = Object.values(project.files)
    .filter((file) => file.sourceProvenance === "ide")
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const projectStarted = Boolean(lastEditedProjectFile || project.tests.ranAt > 0 || project.activeBuild);
  const returning = startedLessons.length > 0 || projectStarted;

  if (!hydrated) {
    return (
      <section className={`course-resume course-resume-loading ${styles.resume} ${styles.loading}`} id="first-run" aria-busy="true" aria-live="polite">
        <p>Restoring your place…</p>
      </section>
    );
  }

  if (returning) {
    const nextPath = startedLessons.length > 0
      ? nextLesson ? `${nextLesson.courseId ?? "models"}/${nextLesson.implementation.filename}` : "capstone/BrowserChat.tsx"
      : lastEditedProjectFile?.path ?? project.selectedPath;
    const nextProgress = nextLesson ? learner.lessons[nextLesson.id] : null;
    const projectOnly = startedLessons.length === 0 && projectStarted;
    return (
      <section className={`course-resume ${styles.resume}`} id="first-run" aria-labelledby="course-resume-title">
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
        <div className={`course-resume-actions ${styles.actions}`}>
          <Link className="primary" href={projectOnly ? `/workspace?file=${encodeURIComponent(nextPath)}` : nextLesson ? `/lessons/${nextLesson.id}` : "/project"}>{projectOnly ? "Resume project" : nextLesson && nextProgress?.updatedAt ? "Resume lesson" : nextLesson ? "Start lesson" : "Review project"} →</Link>
          {projectOnly && nextLesson ? <Link href={`/lessons/${nextLesson.id}`}>Return to {nextLesson.title}</Link> : null}
          {!projectOnly ? <Link href={`/workspace?file=${encodeURIComponent(nextPath)}`}>Open {nextPath}</Link> : null}
        </div>
        <p className={`course-resume-storage ${styles.storage}`}>Progress and code are saved in this browser. You can save an optional backup from the IDE.</p>
      </section>
    );
  }

  return (
    <section className="first-run first-run-minimal" id="first-run" aria-labelledby="first-run-title">
      <header>
        <h2 id="first-run-title">Introductory JavaScript RNN</h2>
        <p>Train 1,267 parameters in a Web Worker, then compare two continuations from the same temporary demo model.</p>
      </header>
      <div className="first-run-layout">
        <div className="first-run-controls">
          <label><span>Prompt prefix</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={64} /></label>
          <button type="button" onClick={() => void run()} disabled={working}>{working ? "Running in worker…" : result ? "Generate both policies" : "Train and generate"}</button>
          <p aria-live="polite">{status}</p>
        </div>
        {openOutput || constrainedOutput ? <div className="first-run-output">
          <article><header><span>Open sampling</span><code>temperature 1.05 · top-k off</code></header><p>{openOutput}</p></article>
          <article><header><span>Top-k sampling</span><code>temperature 0.72 · top-k 5</code></header><p>{constrainedOutput}</p></article>
        </div> : null}
      </div>
      <footer><p>This JavaScript model is not a capstone checkpoint. Later, your source-bound Python training run creates that separately.</p><Link href="/lessons/character-rnns">Continue to Character RNNs →</Link></footer>
    </section>
  );
}
