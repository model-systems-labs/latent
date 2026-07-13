"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { consumeSse, createMockServingStream } from "@latent/mock-services/sse";
import { sampleCharacterRnn } from "@latent/model-lab/character-rnn";
import { moduleCheckpoint } from "../content/llm-systems/learning";
import { llmSystemsCurriculum } from "../lessons/course";
import { lessonIsComplete, lessonKnowledgeIsComplete, useLearnerState } from "../lib/learner-state";
import { reconcileCanonicalProject } from "../lib/canonical-project";
import { runProjectUnitTests } from "../lib/project-tests";
import { saveProjectTestResults, useProjectState, type ProjectUnitResult } from "../lib/project-workspace";
import { recordLearningEvent } from "../lib/learning-analytics";
import { lessonLearningOutcome } from "../content/llm-systems/learning";

type CheckpointStatus = "idle" | "verifying" | "running" | "passed" | "failed" | "cancelled";

export function ModuleCheckpoint({ courseId }: { courseId: "models" | "systems" | "backend" | "product" }) {
  const definition = moduleCheckpoint(courseId)!;
  const curriculumModule = llmSystemsCurriculum.moduleByRouteSlug[courseId]!;
  const learner = useLearnerState();
  const project = useProjectState();
  const [status, setStatus] = useState<CheckpointStatus>("idle");
  const [detail, setDetail] = useState("Run the checkpoint against the exact files currently saved in your project.");
  const [output, setOutput] = useState("");
  const [trace, setTrace] = useState<string[]>([]);
  const [score, setScore] = useState({ passed: 0, total: 0 });
  const [failures, setFailures] = useState<ProjectUnitResult[]>([]);
  const [ready, setReady] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void reconcileCanonicalProject().then(() => { if (active) setReady(true); }).catch((error) => {
      if (!active) return;
      setStatus("failed");
      setDetail(error instanceof Error ? error.message : "The saved project could not be restored.");
    });
    return () => { active = false; controllerRef.current?.abort(); };
  }, []);

  const lessonReadiness = useMemo(() => curriculumModule.lessons.map(({ lesson, projectPath }) => {
    const check = lessonLearningOutcome(lesson.id).check;
    return {
      lesson,
      projectPath,
      implementation: lessonIsComplete(learner, lesson.id, lesson.implementation.codeBlocks.length),
      knowledge: lessonKnowledgeIsComplete(learner, lesson.id, check.id),
    };
  }), [learner, curriculumModule.lessons]);
  const readyLessons = lessonReadiness.filter((item) => item.implementation).length;
  const masteredLessons = lessonReadiness.filter((item) => item.knowledge).length;

  const runModuleBehavior = async () => {
    if (courseId === "models") {
      const artifact = learner.artifacts.characterRnn;
      if (!artifact) {
        setOutput("No learner-trained checkpoint is available. Run the Character RNN experiment, then return to compare open and constrained sampling from the same weights.");
        setTrace(["checkpoint lookup → missing", "generation withheld → no fabricated weights"]);
        return "failed" as const;
      }
      const prompt = "the system ";
      const open = sampleCharacterRnn(artifact.checkpoint, prompt, 120, 0.9, 71, 0);
      const constrained = sampleCharacterRnn(artifact.checkpoint, prompt, 120, 0.72, 71, 5);
      setOutput(`OPEN SAMPLING\n…${prompt}${open}\n\nTOP-K = 5\n…${prompt}${constrained}`);
      setTrace([
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
      const kvUnits = promptTokens + decodeTokens;
      setOutput([
        `request accepted · prompt ${promptTokens} tokens`,
        `prefill · ${promptTokens} positions in parallel · KV length ${promptTokens}`,
        `decode · ${decodeTokens} serial iterations · KV length ${kvUnits}`,
        `complete · ${decodeTokens} generated tokens · cache released`,
      ].join("\n"));
      setTrace([
        "queue → admission checks capacity",
        "prefill → first-token state",
        "continuous batch → one decode position per active request",
        "terminal event → release KV allocation",
      ]);
      return "passed" as const;
    }

    if (courseId === "backend") {
      const controller = new AbortController();
      controllerRef.current = controller;
      setOutput("");
      setTrace(["request r-checkpoint-1 admitted", "waiting for first SSE frame"]);
      const text = "The verified serving path preserves UTF-8 text, typed event boundaries, cancellation, and request identity.";
      const stream = createMockServingStream(text, controller.signal, project.runtime.transport);
      await consumeSse(stream, (event) => {
        if (event.type === "token") {
          setOutput((current) => current + event.data.delta);
          setTrace((current) => [...current.slice(-4), `token event · ${JSON.stringify(event.data.delta)}`]);
        }
        if (event.type === "done") setTrace((current) => [...current, `done · ${event.data.tokens} token events`]);
        if (event.type === "cancelled") setTrace((current) => [...current, "cancelled · reader closed"]);
        if (event.type === "error") setTrace((current) => [...current, `error · ${event.data.code}`]);
      });
      const finalStatus = controller.signal.aborted ? "cancelled" as const : "passed" as const;
      controllerRef.current = null;
      return finalStatus;
    }

    setOutput([
      "user message → normalized record m-u1",
      "context policy → active prompt + newest complete turns",
      "request r1 / attempt a1 → queued → prefill → streaming",
      "ordered deltas → frame-buffered React commits",
      "terminal assistant message → strict persistence schema",
      "focus → restored to the next usable action",
    ].join("\n"));
    setTrace([
      "state identity remains stable across rendering",
      "stop, retry, and edit create explicit lifecycle transitions",
      "unknown or streaming persistence records are rejected",
      "the passing project can now be promoted in the IDE",
    ]);
    return "passed" as const;
  };

  const runCheckpoint = async () => {
    if (status === "verifying" || status === "running") return;
    setStatus("verifying");
    setOutput("");
    setTrace([]);
    setFailures([]);
    setDetail(`Verifying ${curriculumModule.lessonCount} project files in the isolated browser lab…`);
    const results = [];
    try {
      for (const item of curriculumModule.lessons) {
        const run = await runProjectUnitTests(project.files, project.runtime, item.projectPath);
        saveProjectTestResults(run.results, false, run.sourceHash, run.projectRevision);
        results.push(...run.results.filter((result) => result.path === item.projectPath));
      }
      const passed = results.filter((result) => result.passed).length;
      const nextFailures = results.filter((result) => !result.passed);
      setScore({ passed, total: results.length });
      setFailures(nextFailures);
      if (!results.length || passed !== results.length) {
        setStatus("failed");
        setDetail(`${passed} of ${results.length} module contracts pass. Repair the first failure below; completed files stay verified.`);
        void recordLearningEvent("module_checkpoint_completed", {
          moduleId: definition.moduleId,
          outcome: "failed",
          count: passed,
        });
        return;
      }
      setStatus("running");
      setDetail("Contracts pass. Running the module-level behavior…");
      const finalStatus = await runModuleBehavior();
      setStatus(finalStatus);
      setDetail(finalStatus === "cancelled"
        ? "The serving run was cancelled and its stream closed without a late update."
        : finalStatus === "passed"
          ? `${results.length} source-bound contracts pass and the module behavior completed.`
          : "The code contracts pass, but this behavior requires the learner-trained checkpoint produced by the module experiment.");
      void recordLearningEvent("module_checkpoint_completed", {
        moduleId: definition.moduleId,
        outcome: finalStatus === "passed" ? "passed" : finalStatus === "cancelled" ? "cancelled" : "failed",
        count: results.length,
      });
    } catch (error) {
      setStatus("failed");
      setDetail(error instanceof Error ? error.message : "The module checkpoint stopped safely.");
    }
  };

  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("cancelled");
    setDetail("Cancellation requested. No new stream events will be accepted.");
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
          <span><strong>{score.total ? `${score.passed}/${score.total}` : "—"}</strong> latest contracts</span>
        </div>
      </header>

      <section className="checkpoint-change">
        <article><span>Before this module</span><p>{definition.before}</p></article>
        <i aria-hidden="true">→</i>
        <article><span>After this module</span><p>{definition.after}</p></article>
      </section>

      <section className="checkpoint-console" aria-live="polite" aria-busy={status === "verifying" || status === "running"}>
        <header>
          <div><span>Executable checkpoint</span><strong className={`status-${status}`}>{status}</strong></div>
          <div>
            {courseId === "backend" && status === "running" ? <button type="button" onClick={cancel}>Cancel stream</button> : null}
            <button className="primary" type="button" onClick={() => void runCheckpoint()} disabled={!ready || status === "verifying" || status === "running"}>
              {!ready ? "Restoring project…" : status === "idle" ? "Verify and run" : status === "verifying" || status === "running" ? "Running…" : "Run checkpoint again"}
            </button>
          </div>
        </header>
        <p className="checkpoint-detail">{detail}</p>
        {failures.length ? (
          <aside className="checkpoint-repair" aria-label="First failing module contract">
            <div>
              <span>First failing contract</span>
              <code>{failures[0].path}</code>
              <strong>{failures[0].label}</strong>
              <p>{failures[0].detail}</p>
              {failures.length > 1 ? <small>+ {failures.length - 1} more failing {failures.length === 2 ? "contract" : "contracts"}</small> : null}
            </div>
            <Link href={`/workspace?file=${encodeURIComponent(failures[0].path)}`}>Open this file in the IDE →</Link>
          </aside>
        ) : null}
        <div className="checkpoint-console-grid">
          <pre aria-label="Module behavior output">{output || "Output appears after the current project files pass their contracts."}</pre>
          <ol aria-label="Module execution trace">
            {trace.length ? trace.map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>) : <li><span>—</span><p>No execution trace yet.</p></li>}
          </ol>
        </div>
      </section>

      <section className="checkpoint-files" aria-label="Module project files">
        {lessonReadiness.map((item) => (
          <Link href={`/workspace?file=${encodeURIComponent(item.projectPath)}`} key={item.lesson.id}>
            <code>{item.projectPath}</code>
            <span>{item.implementation ? "implementation verified" : "implementation pending"}</span>
            <span>{item.knowledge ? "concept verified" : "prediction pending"}</span>
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
