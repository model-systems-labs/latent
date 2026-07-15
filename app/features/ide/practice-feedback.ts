import type { ExerciseCaseResult } from "@latent/browser-lab";

/** Turn host-owned assertions into a learner-facing direction without exposing source. */
export function formatPracticeContractDetail(cases: readonly ExerciseCaseResult[]): string {
  const failures = cases.filter((result) => !result.passed);
  if (!failures.length) {
    return `${cases.length} isolated case${cases.length === 1 ? "" : "s"} passed the course checks.`;
  }

  const firstFailure = failures[0];
  const failedAssertions = firstFailure.assertions.filter((assertion) => !assertion.passed);
  const firstAssertion = failedAssertions[0];
  const assertionDetail = firstAssertion?.detail
    ? `${firstAssertion.detail.charAt(0).toUpperCase()}${firstAssertion.detail.slice(1)}`
    : "";
  const direction = firstAssertion
    ? `${firstFailure.caseLabel}: ${firstAssertion.label}. ${assertionDetail}`
    : `${firstFailure.caseLabel}: ${firstFailure.detail}`;
  const additionalCases = failures.length - 1;
  const additionalChecks = failedAssertions.length - 1;

  if (additionalCases > 0) {
    return `${direction} · ${additionalCases} more case${additionalCases === 1 ? "" : "s"} still ${additionalCases === 1 ? "fails" : "fail"}; run the checks again after this fix.`;
  }
  if (additionalChecks > 0) {
    return `${direction} · ${additionalChecks} more check${additionalChecks === 1 ? "" : "s"} in this case still ${additionalChecks === 1 ? "fails" : "fail"}; run the checks again after this fix.`;
  }
  return direction;
}
