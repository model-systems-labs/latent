export type ModuleCheckpointAttempt = Readonly<{
  id: number;
  controller: AbortController;
}>;

/**
 * Owns the single asynchronous checkpoint attempt allowed at a time.
 *
 * Cancellation intentionally does not release the attempt. The stream (or
 * other asynchronous work) must settle first, so a rerun cannot overlap the
 * cancelled attempt while it is still unwinding.
 */
export class ModuleCheckpointAttemptCoordinator {
  private nextId = 0;
  private activeAttempt: ModuleCheckpointAttempt | null = null;

  begin() {
    if (this.activeAttempt) return null;
    const attempt = Object.freeze({
      id: ++this.nextId,
      controller: new AbortController(),
    });
    this.activeAttempt = attempt;
    return attempt;
  }

  owns(attempt: ModuleCheckpointAttempt) {
    return this.activeAttempt === attempt;
  }

  cancelCurrent() {
    if (!this.activeAttempt || this.activeAttempt.controller.signal.aborted) return null;
    const attempt = this.activeAttempt;
    attempt.controller.abort();
    return attempt;
  }

  settle(attempt: ModuleCheckpointAttempt) {
    if (!this.owns(attempt)) return false;
    this.activeAttempt = null;
    return true;
  }

  invalidate() {
    this.activeAttempt?.controller.abort();
    this.activeAttempt = null;
  }
}
