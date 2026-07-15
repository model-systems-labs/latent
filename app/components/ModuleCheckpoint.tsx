"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { consumeSse, createMockServingStream } from "@latent/mock-services/sse";
import { sampleCharacterRnn } from "@latent/model-lab/character-rnn";
import { moduleCheckpoint } from "../content/llm-systems/learning";
import { llmSystemsCurriculum } from "../lessons/course";
import { lessonImplementationIsComplete, lessonKnowledgeIsComplete, useLearnerState } from "../lib/learner-state";
import { reconcileCanonicalProject } from "../lib/canonical-project";
import { runProjectUnitTests } from "../lib/project-tests";
import { saveProjectTestResults, useProjectState, type ProjectUnitResult } from "../lib/project-workspace";
import { recordLearningEvent } from "../lib/learning-analytics";
import { lessonLearningOutcome } from "../content/llm-systems/learning";
import {
  ModuleCheckpointAttemptCoordinator,
  type ModuleCheckpointAttempt,
} from "../lib/module-checkpoint-attempt";

type CheckpointStatus = "idle" | "verifying" | "running" | "passed" | "failed" | "cancelled";

export function ModuleCheckpoint({ courseId }: { courseId: "models" | "systems" | "backend" | "product" }) {
  const definition = moduleCheckpoint(courseId)!;
  const curriculumModule = llmSystemsCurriculum.moduleByRouteSlug[courseId]!;
  const learner = useLearnerState();
  const project = useProjectState();
  const [status, setStatus] = useState<CheckpointStatus>("idle");
  const [detail, setDetail] = useState("Run this checkpoint on the exact files currently saved in your project.");
  const [output, setOutput] = useState("");
  const [trace, setTrace] = useState<string[]>([]);
  const [score, setScore] = useState({ passed: 0, total: 0 });
  const [failures, setFailures] = useState<ProjectUnitResult[]>([]);
  const [ready, setReady] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [attemptCoordinator] = useState(() => new ModuleCheckpointAttemptCoordinator());

  const ownsAttempt = (attempt: ModuleCheckpointAttempt) => attemptCoordinator.owns(attempt);
  const setAttemptStatus = (attempt: ModuleCheckpointAttempt, next: CheckpointStatus) => {
    if (ownsAttempt(attempt)) setStatus(next);
  };
  const setAttemptDetail = (attempt: ModuleCheckpointAttempt, next: string) => {
    if (ownsAttempt(attempt)) setDetail(next);
  };
  const replaceAttemptOutput = (attempt: ModuleCheckpointAttempt, next: string) => {
    if (ownsAttempt(attempt)) setOutput(next);
  };
  const updateAttemptOutput = (attempt: ModuleCheckpointAttempt, update: (current: string) => string) => {
    if (ownsAttempt(attempt)) setOutput(update);
  };
  const replaceAttemptTrace = (attempt: ModuleCheckpointAttempt, next: string[]) => {
    if (ownsAttempt(attempt)) setTrace(next);
  };
  const updateAttemptTrace = (attempt: ModuleCheckpointAttempt, update: (current: string[]) => string[]) => {
    if (ownsAttempt(attempt)) setTrace(update);
  };

  useEffect(() => {
    let active = true;
    void reconcileCanonicalProject().then(() => { if (active) setReady(true); }).catch((error) => {
      if (!active) return;
      setStatus("failed");
      setDetail(error instanceof Error ? error.message : "Latent couldn’t load the saved project.");
    });
    return () => { active = false; attemptCoordinator.invalidate(); };
  }, [attemptCoordinator]);

  const lessonReadiness = useMemo(() => curriculumModule.lessons.map(({ lesson, projectPath }) => {
    const check = lessonLearningOutcome(lesson.id).check;
    return {
      lesson,
      projectPath,
      implementation: lessonImplementationIsComplete(learner, lesson.id, lesson.implementation.codeBlocks.length),
      knowledge: lessonKnowledgeIsComplete(learner, lesson.id, check.id),
    };
  }), [learner, curriculumModule.lessons]);
  const readyLessons = lessonReadiness.filter((item) => item.implementation).length;
  const masteredLessons = lessonReadiness.filter((item) => item.knowledge).length;

  const runModuleBehavior = async (attempt: ModuleCheckpointAttempt) => {
    if (courseId === "models") {
      const artifact = learner.artifacts.characterRnn;
      if (!artifact) {
        replaceAttemptOutput(attempt, "There isn’t a checkpoint from your training run yet. Run the Character RNN lab, then come back to compare open and top-k sampling with the same weights.");
        replaceAttemptTrace(attempt, ["look for checkpoint → none found", "skip generation → don’t make up weights"]);
        return "failed" as const;
      }
      const prompt = "the system ";
      const open = sampleCharacterRnn(artifact.checkpoint, prompt, 120, 0.9, 71, 0);
      const constrained = sampleCharacterRnn(artifact.checkpoint, prompt, 120, 0.72, 71, 5);
      replaceAttemptOutput(attempt, `OPEN SAMPLING\n…${prompt}${open}\n\nTOP-K = 5\n…${prompt}${constrained}`);
      replaceAttemptTrace(attempt, [
        "prompt characters → vocabulary ids",
        "recurrent transition → prefix-conditioned hidden state",
        "output projection → logits → stable softmax",
        "same checkpoint + seed → two inference policies",
      ]);
      return "passed" as const;
    }

    if (courseId === "systems") {
      const promptTokens = 96;
      const decodeTokens = Math.min(24, project.runtime.model.maxTokens);
      const subsequentDecodeForwards = Math.max(0, decodeTokens - 1);
      const kvUnits = promptTokens + decodeTokens;
      replaceAttemptOutput(attempt, [
        "worked example · fixed course data; your files were checked separately",
        `request accepted · ${promptTokens}-token prompt`,
        `prefill · ${promptTokens} positions in parallel · first generated token sampled · KV length ${promptTokens}`,
        `decode · ${subsequentDecodeForwards} later one-position forwards · KV length ${kvUnits}`,
        `complete · ${decodeTokens} generated tokens · cache released`,
      ].join("\n"));
      replaceAttemptTrace(attempt, [
        "queue → check available capacity",
        "prefill → prepare the first token",
        "continuous batch → one decode position per active request",
        "final event → release the KV allocation",
      ]);
      return "passed" as const;
    }

    if (courseId === "backend") {
      const { controller } = attempt;
      replaceAttemptOutput(attempt, "");
      replaceAttemptTrace(attempt, ["request r-checkpoint-1 admitted", "waiting for first SSE frame"]);
      const text = "The verified serving path keeps UTF-8 text, typed event boundaries, cancellation, and request identity intact.";
      const stream = createMockServingStream(text, controller.signal, project.runtime.transport);
      await consumeSse(stream, (event) => {
        if (!ownsAttempt(attempt)) return;
        if (event.type === "token") {
          updateAttemptOutput(attempt, (current) => current + event.data.delta);
          updateAttemptTrace(attempt, (current) => [...current.slice(-4), `token event · ${JSON.stringify(event.data.delta)}`]);
        }
        if (event.type === "done") updateAttemptTrace(attempt, (current) => [...current, `done · ${event.data.tokens} token events`]);
        if (event.type === "cancelled") updateAttemptTrace(attempt, (current) => [...current, "cancelled · reader closed"]);
        if (event.type === "error") updateAttemptTrace(attempt, (current) => [...current, `error · ${event.data.code}`]);
      });
      return controller.signal.aborted ? "cancelled" as const : "passed" as const;
    }

    replaceAttemptOutput(attempt, [
      "worked example · fixed course data; your files were checked separately",
      "user message → normalized record m-u1",
      "context policy → active prompt + newest complete turns",
      "request r1 / attempt a1 → queued → prefill → streaming",
      "ordered deltas → frame-buffered React commits",
      "final assistant message → strict saved-data format",
      "focus → restored to the next usable action",
    ].join("\n"));
    replaceAttemptTrace(attempt, [
      "state identity stays stable while React renders",
      "stop, retry, and edit each create a clear state change",
      "ignore unknown or still-streaming saved records",
      "the passing project can now be promoted in the IDE",
    ]);
    return "passed" as const;
  };

  const runCheckpoint = async () => {
    const coordinator = attemptCoordinator;
    const attempt = coordinator.begin();
    if (!attempt) return;
    setCancelRequested(false);
    setAttemptStatus(attempt, "verifying");
    replaceAttemptOutput(attempt, "");
    replaceAttemptTrace(attempt, []);
    if (ownsAttempt(attempt)) setFailures([]);
    setAttemptDetail(attempt, `Checking ${curriculumModule.lessonCount} project files in the isolated browser lab…`);
    const results = [];
    try {
      for (const item of curriculumModule.lessons) {
        const run = await runProjectUnitTests(project.files, project.runtime, item.projectPath);
        if (!ownsAttempt(attempt)) return;
        const committed = await saveProjectTestResults({
          results: run.results,
          expectedIdsByPath: run.expectedIdsByPath,
          replaceAll: false,
          sourceTreeHash: run.sourceHash,
          projectRevision: run.projectRevision,
          contractVersion: run.contractVersion,
        });
        if (!ownsAttempt(attempt)) return;
        if (!committed.accepted) {
          setAttemptStatus(attempt, "failed");
          setAttemptDetail(attempt, committed.reason === "stale-source"
            ? "We ignored this result because the saved project changed while the checks were running. Run the checkpoint again."
            : "We ignored this result because its checklist is out of date. Reload and run it again.");
          return;
        }
        results.push(...run.results.filter((result) => result.path === item.projectPath));
      }
      const passed = results.filter((result) => result.passed).length;
      const nextFailures = results.filter((result) => !result.passed);
      if (ownsAttempt(attempt)) {
        setScore({ passed, total: results.length });
        setFailures(nextFailures);
      }
      if (!results.length || passed !== results.length) {
        setAttemptStatus(attempt, "failed");
        setAttemptDetail(attempt, `${passed} of ${results.length} module checks pass. Fix the first failure below; files that already passed stay verified.`);
        void recordLearningEvent("module_checkpoint_completed", {
          moduleId: definition.moduleId,
          outcome: "failed",
          count: passed,
        });
        return;
      }
      setAttemptStatus(attempt, "running");
      setAttemptDetail(attempt, courseId === "systems" || courseId === "product"
        ? "The checks pass. Now replaying the module’s fixed worked example…"
        : "The checks pass. Now running the module behavior…");
      const finalStatus = await runModuleBehavior(attempt);
      if (!ownsAttempt(attempt)) return;
      setAttemptStatus(attempt, finalStatus);
      setAttemptDetail(attempt, finalStatus === "cancelled"
        ? "The serving run was canceled, and its stream closed without a late update."
        : finalStatus === "passed"
          ? courseId === "systems" || courseId === "product"
            ? `${results.length} checks tied to this source pass, and the fixed example finished.`
            : `${results.length} checks tied to this source pass, and the module behavior finished.`
          : "The code checks pass, but this part needs the checkpoint from your module training run.");
      void recordLearningEvent("module_checkpoint_completed", {
        moduleId: definition.moduleId,
        outcome: finalStatus === "passed" ? "passed" : finalStatus === "cancelled" ? "cancelled" : "failed",
        count: results.length,
      });
    } catch (error) {
      setAttemptStatus(attempt, "failed");
      setAttemptDetail(attempt, error instanceof Error ? error.message : "The module checkpoint stopped safely.");
    } finally {
      if (coordinator.settle(attempt)) setCancelRequested(false);
    }
  };

  const cancel = () => {
    const attempt = attemptCoordinator.cancelCurrent();
    if (!attempt) return;
    setCancelRequested(true);
    setAttemptDetail(attempt, "Cancel requested. Waiting for the stream to close; you can run it again once that finishes.");
  };

  return (
    <article className="module-checkpoint-page">
      <header className="module-checkpoint-hero">
        <p className="eyebrow">{definition.label}</p>
        <h1>{definition.title}</h1>
        <p>{definition.objective}</p>
        <div className="checkpoint-readiness" aria-label={`${readyLessons} implementations and ${masteredLessons} concepts complete`}>
          <span><strong>{readyLessons}/{curriculumModule.lessonCount}</strong> implementations</span>
          <span><strong>{masteredLessons}/{curriculumModule.lessonCount}</strong> predictions</span>
          <span><strong>{score.total ? `${score.passed}/${score.total}` : "—"}</strong> latest checks</span>
        </div>
      </header>

      <section className="checkpoint-change">
        <article><span>Before this module</span><p>{definition.before}</p></article>
        <i aria-hidden="true">→</i>
        <article><span>After this module</span><p>{definition.after}</p></article>
      </section>

      <section className="checkpoint-console" aria-live="polite" aria-busy={status === "verifying" || status === "running"}>
        <header>
          <div><span>Live checkpoint</span><strong className={`status-${status}`}>{status}</strong></div>
          <div>
            {courseId === "backend" && status === "running" ? <button type="button" onClick={cancel} disabled={cancelRequested}>{cancelRequested ? "Cancelling…" : "Cancel stream"}</button> : null}
            <button className="primary" type="button" onClick={() => void runCheckpoint()} disabled={!ready || status === "verifying" || status === "running"}>
              {!ready ? "Restoring project…" : status === "idle" ? "Verify and run" : status === "verifying" || status === "running" ? "Running…" : "Run checkpoint again"}
            </button>
          </div>
        </header>
        <p className="checkpoint-detail">{detail}</p>
        {failures.length ? (
          <aside className="checkpoint-repair" aria-label="First failing module check">
            <div>
              <span>First failing check</span>
              <code>{failures[0].path}</code>
              <strong>{failures[0].label}</strong>
              <p>{failures[0].detail}</p>
              {failures.length > 1 ? <small>+ {failures.length - 1} more failing {failures.length === 2 ? "check" : "checks"}</small> : null}
            </div>
            <Link href={`/workspace?file=${encodeURIComponent(failures[0].path)}`}>Open this file in the IDE →</Link>
          </aside>
        ) : null}
        <div className="checkpoint-console-grid">
          <pre aria-label="Module behavior output">{output || "Output will show up after the current project files pass their checks."}</pre>
          <ol aria-label="Module execution trace">
            {trace.length ? trace.map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>) : <li><span>—</span><p>No execution trace yet.</p></li>}
          </ol>
        </div>
      </section>

      <section className="checkpoint-files" aria-label="Module project files">
        {lessonReadiness.map((item) => (
          <Link href={`/workspace?file=${encodeURIComponent(item.projectPath)}`} key={item.lesson.id}>
            <code>{item.projectPath}</code>
            <span>{item.implementation ? "code verified" : "code still to do"}</span>
            <span>{item.knowledge ? "concept verified" : "prediction still to do"}</span>
          </Link>
        ))}
      </section>

      <footer className="checkpoint-navigation">
        <Link href={`/courses/${courseId}`}>← Review module</Link>
        {courseId === "product" ? <Link href="/workspace?file=capstone%2FBrowserChat.tsx">Build the complete project →</Link> : (() => {
          const index = llmSystemsCurriculum.modules.findIndex((candidate) => candidate.routeSlug === courseId);
          const nextModule = llmSystemsCurriculum.modules[index + 1];
          return nextModule ? <Link href={`/courses/${nextModule.routeSlug}`}>Continue to {nextModule.title} →</Link> : null;
        })()}
      </footer>
    </article>
  );
}
