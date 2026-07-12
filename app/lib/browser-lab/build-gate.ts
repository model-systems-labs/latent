import type { BrowserLabBuildGate, BrowserLabTestResult } from "./types";

/** Presentation-level summary; execution lives in @latent/browser-lab workers. */
export function gateBrowserLabBuild(results: BrowserLabTestResult[]): BrowserLabBuildGate {
  const failures = results.filter((result) => !result.passed);
  return {
    passed: results.length - failures.length,
    total: results.length,
    failures,
    canPromote: results.length > 0 && failures.length === 0,
  };
}
