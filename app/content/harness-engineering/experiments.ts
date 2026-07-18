export const harnessExperimentVariants = [
  "agent-loop",
  "tool-contracts",
  "context-selection",
  "permission-boundaries",
  "state-and-recovery",
  "agent-evaluations",
  "task-orchestration",
  "integrated-harness",
] as const;

export type HarnessExperimentVariant = typeof harnessExperimentVariants[number];

export function isHarnessExperimentVariant(value: string): value is HarnessExperimentVariant {
  return (harnessExperimentVariants as readonly string[]).includes(value);
}
