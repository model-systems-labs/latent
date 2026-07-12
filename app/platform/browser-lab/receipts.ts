import { BrowserLabError, BrowserLabStaleResultError } from "./errors";
import type { SourceHash, TestReceipt } from "./types";

export type ReceiptIdentity = {
  projectId: string;
  projectRevision: number;
  sourceHash: SourceHash;
  contractVersion: string;
};

export function isReceiptCurrent(receipt: TestReceipt, expected: ReceiptIdentity): boolean {
  return receipt.projectId === expected.projectId
    && receipt.projectRevision === expected.projectRevision
    && receipt.sourceHash === expected.sourceHash
    && receipt.contractVersion === expected.contractVersion;
}

export function assertReceiptCurrent(receipt: TestReceipt, expected: ReceiptIdentity): void {
  if (!isReceiptCurrent(receipt, expected)) throw new BrowserLabStaleResultError();
}

export function contractCaseKey(contractId: string, caseId: string): string {
  return `${contractId}\u0000${caseId}`;
}

export function assertReceiptPromotable(receipt: TestReceipt, expected: ReceiptIdentity, expectedCases: readonly { contractId: string; caseId: string }[]): void {
  assertReceiptCurrent(receipt, expected);
  if (receipt.status !== "passed" || !receipt.results.length || receipt.results.some((result) => !result.passed)) {
    throw new BrowserLabError("TESTS_NOT_PASSING", "Only a complete passing test receipt can promote a build.");
  }
  const actual = new Set<string>();
  for (const result of receipt.results) {
    const key = contractCaseKey(result.contractId, result.caseId);
    if (actual.has(key)) throw new BrowserLabError("DUPLICATE_TEST_RESULT", "The receipt contains a duplicate contract case result.");
    actual.add(key);
  }
  const wanted = new Set(expectedCases.map(({ contractId, caseId }) => contractCaseKey(contractId, caseId)));
  if (actual.size !== wanted.size || [...wanted].some((key) => !actual.has(key))) {
    throw new BrowserLabError("INCOMPLETE_TEST_RECEIPT", "The test receipt does not cover the exact required contract cases.");
  }
}
