import type { ExerciseCaseResult } from "@latent/browser-lab";

/** Turn host-owned assertions into a learner-facing direction without exposing source. */
export function formatPracticeContractDetail(cases: readonly ExerciseCaseResult[]): string {
  const failures = cases.filter((result) => !result.passed);
  if (!failures.length) {
    return `${cases.length} isolated case${cases.length === 1 ? "" : "s"} passed host-owned assertions.`;
  }

  return failures.flatMap((failure) => {
    const assertions = failure.assertions.filter((assertion) => !assertion.passed);
    if (!assertions.length) return [`${failure.caseLabel}: ${failure.detail}`];
    return assertions.map((assertion) => `${failure.caseLabel}: ${assertion.label}. ${assertion.detail}`);
  }).join(" · ");
}
