import type { ExerciseCase, InvocationObservation, SandboxLogLevel, SandboxRunRequest } from "../types";

export type SandboxLogSink = (level: SandboxLogLevel, values: readonly unknown[]) => void;

/** Adapter implemented by QuickJS. No implementation may use host eval or Function. */
export interface SandboxEngine {
  observe(request: SandboxRunRequest, exerciseCase: ExerciseCase, log: SandboxLogSink): Promise<InvocationObservation>;
}
