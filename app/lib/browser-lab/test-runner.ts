import type { BrowserLabBuildGate, BrowserLabContract, BrowserLabTestResult } from "./types";

export function runBrowserLabContract(contract: BrowserLabContract): BrowserLabTestResult {
  try {
    const value = contract.assertion
      ? new Function(`"use strict";\n${contract.source}\n${contract.assertion}`)() as { passed?: unknown; detail?: unknown }
      : (new Function(`"use strict";\n${contract.source}`)(), { passed: true, detail: "Source is syntactically valid." });
    return {
      id: contract.id,
      path: contract.path,
      label: contract.label,
      passed: value?.passed === true,
      detail: typeof value?.detail === "string" ? value.detail : value?.passed === true ? "Behavioral contract passed." : "Behavioral contract failed.",
    };
  } catch (error) {
    return { ...contract, passed: false, detail: error instanceof Error ? error.message : "The unit test could not run." };
  }
}

export function gateBrowserLabBuild(results: BrowserLabTestResult[]): BrowserLabBuildGate {
  const failures = results.filter((result) => !result.passed);
  return { passed: results.length - failures.length, total: results.length, failures, canPromote: results.length > 0 && failures.length === 0 };
}
