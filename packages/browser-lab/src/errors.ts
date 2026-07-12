export class BrowserLabError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BrowserLabError";
    this.code = code;
  }
}

export class BrowserLabTimeoutError extends BrowserLabError {
  constructor(timeoutMs: number) {
    super("WALL_TIMEOUT", `The isolated test worker exceeded its ${timeoutMs} ms wall-clock limit.`);
    this.name = "BrowserLabTimeoutError";
  }
}

export class BrowserLabStaleResultError extends BrowserLabError {
  constructor(message = "The test result does not match the current project revision, source hash, and contract version.") {
    super("STALE_RESULT", message);
    this.name = "BrowserLabStaleResultError";
  }
}

export class BrowserLabAbortError extends BrowserLabError {
  constructor() {
    super("ABORTED", "The isolated test run was cancelled.");
    this.name = "BrowserLabAbortError";
  }
}
