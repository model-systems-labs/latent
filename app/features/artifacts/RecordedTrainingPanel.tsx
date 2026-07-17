"use client";

import { useMemo, useState } from "react";
import { trainingCheckpointView } from "@latent/training-replay/presentation";
import type { ArtifactEnvelope } from "@latent/artifact-runtime";
import type { MaterializedRecordedTraining } from "@latent/training-replay/types";

function shortHash(artifact: ArtifactEnvelope) {
  return artifact.contentHash.slice(7, 19);
}

export function RecordedTrainingPanel({
  replay,
  onDownload,
}: {
  replay: MaterializedRecordedTraining;
  onDownload: (artifact: ArtifactEnvelope) => Promise<void>;
}) {
  const [selected, setSelected] = useState(replay.checkpoints.length - 1);
  const active = useMemo(() => trainingCheckpointView(replay, selected), [replay, selected]);
  const minimum = Math.min(...active.trace.values);
  const maximum = Math.max(...active.trace.values);
  const range = Math.max(maximum - minimum, 1e-9);

  return (
    <div className="training-replay">
      <p className="training-replay-intro"><strong>Recorded training replay.</strong> Fixed checkpoints from a repeatable course run; moving between them does not run your code.</p>
      <div className="training-replay-controls" role="group" aria-label={`${replay.scenario.run.title} checkpoints`}>
        {replay.recording.checkpoints.map((checkpoint, index) => (
          <button className={selected === index ? "active" : ""} type="button" key={replay.checkpoints[index].id} onClick={() => setSelected(index)}>
            <span>{checkpoint.step}</span><em>{replay.scenario.replay.stepLabel}</em>
          </button>
        ))}
      </div>
      <div className="training-replay-stage">
        <header>
          <div><span>{active.eyebrow}</span><strong>{active.frameLabel}</strong></div>
          <code>{shortHash(active.artifact)}</code>
        </header>
        <div className="artifact-metrics">
          {active.metrics.map((metric) => <span key={metric.id}><em>{metric.label}</em><strong>{metric.display}</strong></span>)}
        </div>
        <div className="artifact-loss-bars" aria-label={active.trace.label}>
          {active.trace.values.map((value, index) => (
            <i key={`${index}-${value}`} style={{ height: `${12 + ((value - minimum) / range) * 88}%` }} />
          ))}
        </div>
        {active.output ? <article className="artifact-sample"><span>{active.output.label}</span><p>{active.output.text}</p></article> : null}
        <footer>
          <p>{active.disclosure}</p>
          <div><button type="button" onClick={() => void onDownload(active.artifact)}>Download recorded checkpoint</button><button type="button" onClick={() => void onDownload(replay.run)}>Download recorded run</button></div>
        </footer>
      </div>
    </div>
  );
}
