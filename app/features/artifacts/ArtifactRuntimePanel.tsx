"use client";

import { useEffect, useState } from "react";
import type { CourseLesson } from "@latent/course-kit";
import type { ArtifactEnvelope } from "@latent/artifact-runtime";
import { downloadArtifact, lessonHasRecordedTraining, loadLessonArtifactView } from "@/app/features/artifacts/lesson-artifacts";
import { RecordedTrainingPanel } from "@/app/features/artifacts/RecordedTrainingPanel";

type ArtifactView = Awaited<ReturnType<typeof loadLessonArtifactView>>;

function shortHash(artifact: ArtifactEnvelope) {
  return artifact.contentHash.slice(7, 19);
}

function ArtifactIdentity({ artifact, label }: { artifact: ArtifactEnvelope; label: string }) {
  return (
    <article className="artifact-identity" aria-label={`${label}: ${artifact.title}. ${artifact.description}`}>
      <span>{label}</span>
      <strong>{artifact.title}</strong>
      <code>{shortHash(artifact)}</code>
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
          <button aria-pressed={index === selected} className={index === selected ? "active" : ""} type="button" key={`${frame.index}-${frame.label}`} onClick={() => setSelected(index)}>
            <i />
            <span>{frame.label}</span>
            <code>{frame.at} {artifact.replay?.unit}</code>
          </button>
        ))}
      </div>
      <article className="artifact-frame">
        <span>Result frame {active.index + 1} / {frames.length}</span>
        <strong>{active.label}</strong>
        <pre>{JSON.stringify(active.payload, null, 2)}</pre>
      </article>
    </div>
  );
}

export function ArtifactRuntimePanel({ lesson, refreshKey = 0 }: { lesson: CourseLesson; refreshKey?: number }) {
  const [view, setView] = useState<ArtifactView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRecordedTraining = lessonHasRecordedTraining(lesson.id);

  useEffect(() => {
    let active = true;
    void loadLessonArtifactView(lesson.id).then((next) => {
      if (active) { setView(next); setError(null); }
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "The artifact viewer isn’t available right now.");
    });
    return () => { active = false; };
  }, [lesson.id, refreshKey]);

  return (
    <details className="artifact-runtime-panel" id="artifacts">
      <summary className="artifact-runtime-heading">
        <div>
          <h3 id="artifact-runtime-title">Saved results</h3>
          <p>{hasRecordedTraining ? "Recorded training replay · fixed course run, not your code" : "Results created after your saved code passes its checks"}</p>
        </div>
      </summary>
      <div className="artifact-runtime-body" aria-labelledby="artifact-runtime-title">
        <p className="artifact-runtime-note">The replay is course data. The validation result is tied to the code you saved and checked.</p>
        {error ? <p className="artifact-runtime-error">{error}</p> : null}
        {!view && !error ? <p className="artifact-runtime-loading">Loading…</p> : null}
        {view ? (
          <>
            {view.training ? <RecordedTrainingPanel key={view.training.scenario.id} replay={view.training} onDownload={downloadArtifact} /> : null}
            {view.input || view.output ? (
              <div className="artifact-lineage-grid">
                {view.input ? <ArtifactIdentity artifact={view.input} label="Previous result" /> : null}
                {view.output ? <ArtifactIdentity artifact={view.output} label="Validation result" /> : null}
              </div>
            ) : view.training ? null : <p className="artifact-runtime-loading">No saved results yet.</p>}
            {view.output ? (
              <>
                <ReplayFrames artifact={view.output} key={view.output.id} />
                <div className="artifact-download-row">
                  <p><strong>{view.output.validation.passedCount}/{view.output.validation.totalCount}</strong> checks passed</p>
                  <button type="button" onClick={() => void downloadArtifact(view.output!)}>Download verified result</button>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
