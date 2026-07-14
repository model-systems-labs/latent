export type PendingDraftSnapshot = {
  path: string;
  content: string;
};

export type ExpectedDraftSnapshot = PendingDraftSnapshot & {
  epoch: number;
};

export function draftSnapshotIsCurrent(
  pending: PendingDraftSnapshot | null,
  currentEpoch: number,
  expected: ExpectedDraftSnapshot,
) {
  return pending?.path === expected.path
    && pending.content === expected.content
    && currentEpoch === expected.epoch;
}

export function revisionResponseIsCurrent(input: {
  requestedPath: string;
  requestId: number;
  selectedPath: string | null;
  currentRequestId: number;
}) {
  return input.requestedPath === input.selectedPath && input.requestId === input.currentRequestId;
}

export function revisionCanRestore(selectedPath: string | null, revisionPath: string) {
  return Boolean(selectedPath) && selectedPath === revisionPath;
}

export function actionableBuildFailurePath(input: {
  failurePath: string;
  readOnly: boolean;
  editableFallbackPath: string;
}) {
  return input.readOnly ? input.editableFallbackPath : input.failurePath;
}
