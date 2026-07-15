"use client";

import { useEffect, useState } from "react";
import type { CourseLesson } from "@latent/course-kit";
import type { ArtifactEnvelope } from "@latent/artifact-runtime";
import { downloadArtifact, loadLessonArtifactView } from "./lesson-artifacts";
import { RecordedTrainingPanel } from "./RecordedTrainingPanel";

type ArtifactView = Awaited<ReturnType<typeof loadLessonArtifactView>>;

function shortHash(artifact: ArtifactEnvelope) {
  return artifact.contentHash.slice(7, 19);
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
          <button aria-pressed={index === selected} className={index === selected ? "active" : ""} type="button" key={`${frame.index}-${frame.label}`} onClick={() => setSelected(index)}>
            <i />
            <span>{frame.label}</span>
            <code>{frame.at} {artifact.replay?.unit}</code>
          </button>
        ))}
      </div>
      <article className="artifact-frame">
        <span>Course example frame {active.index + 1} / {frames.length}</span>
        <strong>{active.label}</strong>
        <pre>{JSON.stringify(active.payload, null, 2)}</pre>
      </article>
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
      if (active) setError(reason instanceof Error ? reason.message : "The artifact viewer isn’t available right now.");
    });
    return () => { active = false; };
  }, [lesson.id, refreshKey]);

  return (
    <details className="artifact-runtime-panel" id="artifacts">
      <summary className="artifact-runtime-heading">
        <div><span>Saved results</span><h3 id="artifact-runtime-title">Proof tied to the exact code you ran.</h3></div>
        <span className="artifact-runtime-action">Take a look</span>
      </summary>
      <div className="artifact-runtime-body" aria-labelledby="artifact-runtime-title">
        <p className="artifact-runtime-intro">When your code passes, Latent saves its source hash and check results on this device. The replay frames are examples made for the course, not output calculated from your code.</p>
        {error ? <p className="artifact-runtime-error">{error}</p> : null}
        {!view && !error ? <p className="artifact-runtime-loading">Loading the saved artifact history…</p> : null}
        {view ? (
          <>
            {view.training ? <RecordedTrainingPanel key={view.training.scenario.id} replay={view.training} onDownload={downloadArtifact} /> : null}
            <div className="artifact-lineage-grid">
              {view.input ? <ArtifactIdentity artifact={view.input} label="Previous result" /> : <article className="artifact-identity pending"><span>Previous result still needed</span><strong>Finish the previous lesson</strong><p>Its saved result will become the starting point for this lesson&apos;s artifact history.</p></article>}
              {view.output ? <ArtifactIdentity artifact={view.output} label="Validation result" /> : <article className="artifact-identity pending"><span>Result still needed</span><strong>Pass every behavior check</strong><p>Your passing code and check results will become a validation file you can download.</p></article>}
            </div>
            {view.output ? (
              <>
                <ReplayFrames artifact={view.output} key={view.output.id} />
                <div className="artifact-download-row">
                  <p><strong>{view.output.validation.passedCount}/{view.output.validation.totalCount}</strong> checks passed</p>
                  <button type="button" onClick={() => void downloadArtifact(view.output!)}>Download with history</button>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
