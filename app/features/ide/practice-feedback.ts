import type { ExerciseCaseResult } from "@latent/browser-lab";

/** Turn host-owned assertions into a learner-facing direction without exposing source. */
export function formatPracticeContractDetail(cases: readonly ExerciseCaseResult[]): string {
  const failures = cases.filter((result) => !result.passed);
  if (!failures.length) {
    return `${cases.length} isolated case${cases.length === 1 ? "" : "s"} passed host-owned assertions.`;
  }

  const directions = failures.flatMap((failure) => {
    const assertions = failure.assertions.filter((assertion) => !assertion.passed);
    if (!assertions.length) return [{ key: failure.caseId, text: `${failure.caseLabel}: ${failure.detail}` }];
    return assertions.map((assertion) => ({
      key: `${failure.caseId}\u0000${assertion.label}`,
      text: `${failure.caseLabel}: ${assertion.label}. ${assertion.detail}`,
    }));
  });

  return [...new Map(directions.map((direction) => [direction.key, direction.text])).values()].join(" · ");
}
