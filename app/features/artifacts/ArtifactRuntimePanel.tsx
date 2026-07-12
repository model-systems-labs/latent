"use client";

import { useEffect, useMemo, useState } from "react";
import type { CourseLesson } from "../../lib/lesson-types";
import { compareArtifacts, type ArtifactEnvelope, type ArtifactJson } from "../../platform/artifact-runtime";
import { downloadArtifact, loadLessonArtifactView } from "./lesson-artifacts";

type ArtifactView = Awaited<ReturnType<typeof loadLessonArtifactView>>;

function shortHash(artifact: ArtifactEnvelope) {
  return artifact.contentHash.slice(7, 19);
}

function payloadRecord(artifact: ArtifactEnvelope) {
  return artifact.payload as Record<string, ArtifactJson>;
}

function ArtifactIdentity({ artifact, label }: { artifact: ArtifactEnvelope; label: string }) {
  return (
    <article className="artifact-identity">
      <span>{label}</span>
      <strong>{artifact.title}</strong>
      <p>{artifact.description}</p>
      <div><code>{artifact.kind}</code><code>{shortHash(artifact)}</code></div>
    </article>
  );
}

function ReplayFrames({ artifact }: { artifact: ArtifactEnvelope }) {
  const [selected, setSelected] = useState(Math.max(0, (artifact.replay?.frames.length ?? 1) - 1));
  const frames = artifact.replay?.frames ?? [];
  const active = frames[selected];
  if (!active) return null;
  return (
    <div className="artifact-replay">
      <div className="artifact-timeline" role="group" aria-label={`${artifact.title} replay frames`}>
        {frames.map((frame, index) => (
          <button className={index === selected ? "active" : ""} type="button" key={`${frame.index}-${frame.label}`} onClick={() => setSelected(index)}>
            <i />
            <span>{frame.label}</span>
            <code>{frame.at} {artifact.replay?.unit}</code>
          </button>
        ))}
      </div>
      <article className="artifact-frame">
        <span>Replay frame {active.index + 1} / {frames.length}</span>
        <strong>{active.label}</strong>
        <pre>{JSON.stringify(active.payload, null, 2)}</pre>
      </article>
    </div>
  );
}

function TrainingReplay({ view }: { view: ArtifactView }) {
  const [selected, setSelected] = useState(view.training.checkpoints.length - 1);
  const checkpoints = view.training.checkpoints;
  const active = checkpoints[selected];
  const previous = checkpoints[Math.max(0, selected - 1)];
  const comparison = useMemo(() => compareArtifacts(previous, active), [active, previous]);
  const payload = payloadRecord(active);
  const sample = typeof payload.sample === "string" ? payload.sample : "No sample recorded.";
  const lossTrace = Array.isArray(payload.lossTrace) ? payload.lossTrace.filter((value): value is number => typeof value === "number") : [];
  const maximum = Math.max(...lossTrace, 1);

  return (
    <div className="training-replay">
      <div className="training-replay-controls" role="group" aria-label="Recorded training checkpoints">
        {checkpoints.map((checkpoint, index) => (
          <button className={selected === index ? "active" : ""} type="button" key={checkpoint.id} onClick={() => setSelected(index)}>
            <span>{checkpoint.metrics.steps}</span><em>updates</em>
          </button>
        ))}
      </div>
      <div className="training-replay-stage">
        <header>
          <div><span>Actual checkpoint weights</span><strong>{active.metrics.steps} optimizer updates</strong></div>
          <code>{shortHash(active)}</code>
        </header>
        <div className="artifact-metrics">
          <span><em>Loss</em><strong>{active.metrics.finalLoss.toFixed(3)}</strong></span>
          <span><em>Change</em><strong>{comparison.metrics.find((metric) => metric.key === "finalLoss")?.delta?.toFixed(3) ?? "—"}</strong></span>
          <span><em>Parameters</em><strong>{active.metrics.parameters.toLocaleString()}</strong></span>
          <span><em>Vocabulary</em><strong>{active.metrics.vocabularySize}</strong></span>
        </div>
        <div className="artifact-loss-bars" aria-label="Recorded loss trace">
          {lossTrace.map((loss, index) => <i key={`${index}-${loss}`} style={{ height: `${Math.max(8, loss / maximum * 100)}%` }} />)}
        </div>
        <article className="artifact-sample"><span>Sample generated from this checkpoint</span><p>{sample}</p></article>
        <footer>
          <p>Training time is replayed. The loss, generated text, and downloadable tensors come from the recorded deterministic run.</p>
          <div><button type="button" onClick={() => void downloadArtifact(active)}>Download checkpoint</button><button type="button" onClick={() => void downloadArtifact(view.training.run)}>Download full run</button></div>
        </footer>
      </div>
    </div>
  );
}

export function ArtifactRuntimePanel({ lesson, refreshKey = 0 }: { lesson: CourseLesson; refreshKey?: number }) {
  const [view, setView] = useState<ArtifactView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadLessonArtifactView(lesson.id).then((next) => {
      if (active) { setView(next); setError(null); }
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Artifact Runtime is unavailable.");
    });
    return () => { active = false; };
  }, [lesson.id, refreshKey]);

  return (
    <section className="artifact-runtime-panel" id="artifacts" aria-labelledby="artifact-runtime-title">
      <header className="artifact-runtime-heading">
        <div><span>Artifact Runtime</span><h3 id="artifact-runtime-title">Replay the expensive parts. Execute the important parts.</h3></div>
        <code>content-addressed · device-local</code>
      </header>
      <p className="artifact-runtime-intro">Each passing lesson turns the learner&apos;s tested source into an immutable output. The next lesson can consume that output without pretending GPU-scale work happened in this tab.</p>
      {error ? <p className="artifact-runtime-error">{error}</p> : null}
      {!view && !error ? <p className="artifact-runtime-loading">Loading local artifact lineage…</p> : null}
      {view ? (
        <>
          {lesson.id === "character-rnns" ? <TrainingReplay view={view} /> : null}
          <div className="artifact-lineage-grid">
            {view.input ? <ArtifactIdentity artifact={view.input} label={lesson.id === "character-rnns" ? "Recorded training input" : "Input from previous lesson"} /> : <article className="artifact-identity pending"><span>Input pending</span><strong>Complete the previous lesson</strong><p>Its active validated artifact will become this lesson&apos;s immutable input.</p></article>}
            {view.output ? <ArtifactIdentity artifact={view.output} label="Learner-validated output" /> : <article className="artifact-identity pending"><span>Output pending</span><strong>Pass every behavioral check</strong><p>The runtime will bind the passing source hash to a replayable, downloadable artifact.</p></article>}
          </div>
          {view.output ? (
            <>
              <ReplayFrames artifact={view.output} key={view.output.id} />
              <div className="artifact-download-row">
                <p><strong>{view.output.validation.passedCount}/{view.output.validation.totalCount}</strong> host-owned contracts authorize this artifact.</p>
                <button type="button" onClick={() => void downloadArtifact(view.output!)}>Download artifact + lineage</button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
