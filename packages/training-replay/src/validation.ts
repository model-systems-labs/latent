import type { ArtifactJson } from "@latent/artifact-runtime/types";
import {
  RECORDED_TRAINING_FORMAT,
  RECORDED_TRAINING_VERSION,
  type RecordedTrainingCheckpoint,
  type RecordedTrainingDocument,
  type RecordedTrainingScenario,
  type TrainingReplayPresentation,
} from "./types.js";

export class RecordedTrainingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordedTrainingValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordedTrainingValidationError(`${label} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RecordedTrainingValidationError(`${label} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new RecordedTrainingValidationError(`${label} must be a non-empty string under ${max} characters.`);
  }
  return value;
}

function json(value: unknown, label: string): ArtifactJson {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let characters = 0;
  while (pending.length) {
    const current = pending.pop()!;
    nodes += 1;
    if (nodes > 250_000 || current.depth > 48) {
      throw new RecordedTrainingValidationError(`${label} exceeds the structural limit.`);
    }
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) throw new RecordedTrainingValidationError(`${label} contains a non-finite number.`);
      continue;
    }
    if (typeof current.value === "string") {
      characters += current.value.length;
      if (characters > 16 * 1024 * 1024) throw new RecordedTrainingValidationError(`${label} exceeds the text limit.`);
      continue;
    }
    if (typeof current.value === "boolean" || current.value === null) continue;
    if (!current.value || typeof current.value !== "object") {
      throw new RecordedTrainingValidationError(`${label} is not JSON-compatible.`);
    }
    if (seen.has(current.value)) throw new RecordedTrainingValidationError(`${label} contains a circular reference.`);
    seen.add(current.value);
    if (Array.isArray(current.value)) {
      current.value.forEach((child) => pending.push({ value: child, depth: current.depth + 1 }));
    } else {
      Object.entries(current.value).forEach(([key, child]) => {
        characters += key.length;
        pending.push({ value: child, depth: current.depth + 1 });
      });
    }
    if (characters > 16 * 1024 * 1024) throw new RecordedTrainingValidationError(`${label} exceeds the text limit.`);
  }
  return value as ArtifactJson;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}

function numericRecord(value: unknown, label: string, allowEmpty = false): Record<string, number> {
  const source = record(value, label);
  const entries = Object.entries(source);
  if (!allowEmpty && entries.length === 0) throw new RecordedTrainingValidationError(`${label} cannot be empty.`);
  return Object.fromEntries(entries.map(([key, item]) => {
    text(key, `${label} key`, 120);
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new RecordedTrainingValidationError(`${label}.${key} must be finite.`);
    }
    return [key, item];
  }));
}

function checkpoint(value: unknown, index: number): RecordedTrainingCheckpoint {
  const source = record(value, `checkpoints[${index}]`);
  if (!Number.isSafeInteger(source.step) || (source.step as number) < 0) {
    throw new RecordedTrainingValidationError(`checkpoints[${index}].step must be a non-negative safe integer.`);
  }
  const metrics = numericRecord(source.metrics, `checkpoints[${index}].metrics`);
  if (Object.hasOwn(metrics, "step")) {
    throw new RecordedTrainingValidationError(`checkpoints[${index}].metrics.step is reserved by the runtime.`);
  }
  const traceSource = record(source.traces, `checkpoints[${index}].traces`);
  if (Object.keys(traceSource).length === 0) throw new RecordedTrainingValidationError(`checkpoints[${index}].traces cannot be empty.`);
  const traces = Object.fromEntries(Object.entries(traceSource).map(([key, values]) => {
    text(key, `checkpoints[${index}].traces key`, 120);
    if (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
      throw new RecordedTrainingValidationError(`checkpoints[${index}].traces.${key} must contain finite values.`);
    }
    return [key, [...values] as number[]];
  }));
  const outputSource = record(source.outputs, `checkpoints[${index}].outputs`);
  const outputs = Object.fromEntries(Object.entries(outputSource).map(([key, output]) => [
    text(key, `checkpoints[${index}].outputs key`, 120),
    json(output, `checkpoints[${index}].outputs.${key}`),
  ]));
  return {
    step: source.step as number,
    metrics,
    traces,
    outputs,
    state: json(source.state, `checkpoints[${index}].state`),
  };
}

export function assertRecordedTrainingDocument(value: unknown): RecordedTrainingDocument {
  const source = record(value, "Recorded training document");
  if (source.format !== RECORDED_TRAINING_FORMAT || source.version !== RECORDED_TRAINING_VERSION) {
    throw new RecordedTrainingValidationError("Recorded training format or version is unsupported.");
  }
  const recordedAt = text(source.recordedAt, "recordedAt", 80);
  const recordedAtEpoch = Date.parse(recordedAt);
  if (!Number.isFinite(recordedAtEpoch) || recordedAtEpoch < 0) {
    throw new RecordedTrainingValidationError("recordedAt must be a valid date on or after the Unix epoch.");
  }
  const producer = record(source.producer, "producer");
  if (!Array.isArray(source.checkpoints) || source.checkpoints.length < 2) {
    throw new RecordedTrainingValidationError("A recorded training run requires at least two checkpoints.");
  }
  const checkpoints = source.checkpoints.map(checkpoint);
  checkpoints.forEach((item, index) => {
    if (index > 0 && item.step <= checkpoints[index - 1].step) {
      throw new RecordedTrainingValidationError("Checkpoint steps must be strictly increasing.");
    }
  });
  if (!Number.isSafeInteger(recordedAtEpoch + checkpoints.at(-1)!.step + 1)) {
    throw new RecordedTrainingValidationError("The recorded timestamp and checkpoint range exceed safe artifact time.");
  }
  return deepFreeze({
    format: RECORDED_TRAINING_FORMAT,
    version: RECORDED_TRAINING_VERSION,
    recordedAt,
    producer: {
      runtime: text(producer.runtime, "producer.runtime", 160),
      version: text(producer.version, "producer.version", 80),
    },
    dataset: json(source.dataset, "dataset"),
    config: json(source.config, "config"),
    checkpoints,
  });
}

export function snapshotRecordedTrainingDescriptors(
  scenario: RecordedTrainingScenario,
  presentation: TrainingReplayPresentation,
) {
  assertRecordedTrainingRegistration(scenario, presentation);
  const scenarioSnapshot: RecordedTrainingScenario = {
    ...scenario,
    checkpoint: { ...scenario.checkpoint, labels: [...scenario.checkpoint.labels] },
    run: {
      ...scenario.run,
      labels: [...scenario.run.labels],
      metrics: scenario.run.metrics ? Object.fromEntries(Object.entries(scenario.run.metrics).map(([key, source]) => [key, { ...source }])) : undefined,
    },
    replay: { ...scenario.replay },
  };
  const presentationSnapshot: TrainingReplayPresentation = {
    ...presentation,
    metrics: presentation.metrics.map((metric) => ({ ...metric, format: { ...metric.format } })),
    output: presentation.output ? { ...presentation.output } : undefined,
  };
  return deepFreeze({ scenario: scenarioSnapshot, presentation: presentationSnapshot });
}

export function assertRecordedTrainingRegistration(
  scenario: RecordedTrainingScenario,
  presentation: TrainingReplayPresentation,
) {
  text(scenario.id, "scenario.id", 160);
  text(scenario.projectId, "scenario.projectId", 160);
  text(scenario.moduleId, "scenario.moduleId", 160);
  text(scenario.lessonId, "scenario.lessonId", 160);
  text(scenario.primaryMetricKey, "scenario.primaryMetricKey", 120);
  text(scenario.checkpoint.kind, "scenario.checkpoint.kind", 100);
  text(scenario.checkpoint.title, "scenario.checkpoint.title", 200);
  text(scenario.checkpoint.description, "scenario.checkpoint.description", 1_200);
  text(scenario.checkpoint.payloadFormat, "scenario.checkpoint.payloadFormat", 160);
  scenario.checkpoint.labels.forEach((label, index) => text(label, `scenario.checkpoint.labels[${index}]`, 100));
  text(scenario.run.kind, "scenario.run.kind", 100);
  text(scenario.run.title, "scenario.run.title", 240);
  text(scenario.run.description, "scenario.run.description", 1_200);
  scenario.run.labels.forEach((label, index) => text(label, `scenario.run.labels[${index}]`, 100));
  text(scenario.replay.unit, "scenario.replay.unit", 80);
  text(scenario.replay.stepLabel, "scenario.replay.stepLabel", 80);
  text(presentation.checkpointEyebrow, "presentation.checkpointEyebrow", 160);
  text(presentation.traceKey, "presentation.traceKey", 120);
  text(presentation.traceLabel, "presentation.traceLabel", 160);
  text(presentation.disclosure, "presentation.disclosure", 1_200);
  if (!presentation.metrics.length) throw new RecordedTrainingValidationError("presentation.metrics cannot be empty.");
  const metricIds = new Set<string>();
  presentation.metrics.forEach((metric, index) => {
    text(metric.id, `presentation.metrics[${index}].id`, 120);
    text(metric.key, `presentation.metrics[${index}].key`, 120);
    text(metric.label, `presentation.metrics[${index}].label`, 120);
    if (metricIds.has(metric.id)) throw new RecordedTrainingValidationError(`Duplicate presentation metric id: ${metric.id}.`);
    metricIds.add(metric.id);
    if (metric.format.kind === "decimal" && metric.format.digits !== undefined
      && (!Number.isInteger(metric.format.digits) || metric.format.digits < 0 || metric.format.digits > 8)) {
      throw new RecordedTrainingValidationError(`presentation.metrics[${index}].format.digits must be between 0 and 8.`);
    }
  });
  if (presentation.output) {
    text(presentation.output.key, "presentation.output.key", 120);
    text(presentation.output.label, "presentation.output.label", 160);
  }
}

export function assertRecordedTrainingCompatibility(
  recording: RecordedTrainingDocument,
  scenario: RecordedTrainingScenario,
  presentation: TrainingReplayPresentation,
) {
  assertRecordedTrainingRegistration(scenario, presentation);
  recording.checkpoints.forEach((item, index) => {
    if (!Object.hasOwn(item.metrics, scenario.primaryMetricKey)) {
      throw new RecordedTrainingValidationError(`Checkpoint ${index} is missing primary metric ${scenario.primaryMetricKey}.`);
    }
    presentation.metrics.forEach((metric) => {
      if (!Object.hasOwn(item.metrics, metric.key)) {
        throw new RecordedTrainingValidationError(`Checkpoint ${index} is missing presentation metric ${metric.key}.`);
      }
    });
    if (!Object.hasOwn(item.traces, presentation.traceKey)) {
      throw new RecordedTrainingValidationError(`Checkpoint ${index} is missing trace ${presentation.traceKey}.`);
    }
    if (presentation.output && typeof item.outputs[presentation.output.key] !== "string") {
      throw new RecordedTrainingValidationError(`Checkpoint ${index} output ${presentation.output.key} must be text.`);
    }
  });
  Object.entries(scenario.run.metrics ?? {}).forEach(([key, source]) => {
    text(key, "scenario.run.metrics key", 120);
    if (source.checkpoint !== "first" && source.checkpoint !== "last") {
      throw new RecordedTrainingValidationError(`Run metric ${key} has an invalid checkpoint selector.`);
    }
    text(source.metric, `scenario.run.metrics.${key}.metric`, 120);
    const selected = source.checkpoint === "first" ? recording.checkpoints[0] : recording.checkpoints.at(-1)!;
    if (!Object.hasOwn(selected.metrics, source.metric)) {
      throw new RecordedTrainingValidationError(`Run metric ${key} references missing checkpoint metric ${source.metric}.`);
    }
  });
}
