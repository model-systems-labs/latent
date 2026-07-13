import type {
  MaterializedRecordedTraining,
  TrainingCheckpointView,
  TrainingMetricFormat,
} from "./types.js";

export function formatTrainingMetric(value: number, format: TrainingMetricFormat) {
  if (format.kind === "integer") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return value.toFixed(format.digits ?? 3);
}

export function trainingCheckpointView(
  replay: MaterializedRecordedTraining,
  requestedIndex: number,
): TrainingCheckpointView {
  const index = Math.max(0, Math.min(replay.recording.checkpoints.length - 1, Math.round(requestedIndex)));
  const checkpoint = replay.recording.checkpoints[index];
  const previous = index > 0 ? replay.recording.checkpoints[index - 1] : null;
  const output = replay.presentation.output;
  return {
    artifact: replay.checkpoints[index],
    index,
    step: checkpoint.step,
    stepLabel: replay.scenario.replay.stepLabel,
    frameLabel: `${checkpoint.step} ${replay.scenario.replay.stepLabel}`,
    eyebrow: replay.presentation.checkpointEyebrow,
    metrics: replay.presentation.metrics.map((metric) => {
      const value = metric.comparison
        ? previous ? checkpoint.metrics[metric.key] - previous.metrics[metric.key] : null
        : checkpoint.metrics[metric.key];
      return {
        id: metric.id,
        label: metric.label,
        value,
        display: value === null ? "—" : formatTrainingMetric(value, metric.format),
      };
    }),
    trace: {
      key: replay.presentation.traceKey,
      label: replay.presentation.traceLabel,
      values: checkpoint.traces[replay.presentation.traceKey],
    },
    output: output ? {
      key: output.key,
      label: output.label,
      text: checkpoint.outputs[output.key] as string,
    } : null,
    disclosure: replay.presentation.disclosure,
  };
}
