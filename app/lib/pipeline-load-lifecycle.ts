export type PipelineLoadPhase = "idle" | "loading" | "ready" | "dispose-after-load";

export type PipelineLoadLifecycle = {
  mounted: boolean;
  operation: number;
  phase: PipelineLoadPhase;
};

export function createPipelineLoadLifecycle(): PipelineLoadLifecycle {
  return { mounted: false, operation: 0, phase: "idle" };
}

export function mountPipelineLoad(lifecycle: PipelineLoadLifecycle) {
  lifecycle.mounted = true;
}

export function beginPipelineLoad(lifecycle: PipelineLoadLifecycle) {
  lifecycle.operation += 1;
  lifecycle.phase = "loading";
  return lifecycle.operation;
}

export function pipelineLoadIsCurrent(lifecycle: PipelineLoadLifecycle, operation: number) {
  return lifecycle.mounted && lifecycle.operation === operation && lifecycle.phase === "loading";
}

export function requestPipelineLoadCleanup(lifecycle: PipelineLoadLifecycle) {
  const disposalPending = lifecycle.phase === "loading";
  lifecycle.mounted = false;
  lifecycle.operation += 1;
  lifecycle.phase = disposalPending ? "dispose-after-load" : "idle";
  return { disposalPending };
}

export function settlePipelineLoad(lifecycle: PipelineLoadLifecycle, operation: number): "commit" | "dispose" {
  const shouldDispose = lifecycle.phase === "dispose-after-load"
    || !lifecycle.mounted
    || lifecycle.operation !== operation;
  lifecycle.phase = shouldDispose ? "idle" : "ready";
  return shouldDispose ? "dispose" : "commit";
}

export function settlePipelineLoadFailure(lifecycle: PipelineLoadLifecycle, operation: number) {
  const shouldReport = lifecycle.mounted && lifecycle.operation === operation && lifecycle.phase === "loading";
  if (shouldReport || lifecycle.phase === "dispose-after-load") lifecycle.phase = "idle";
  return shouldReport;
}
