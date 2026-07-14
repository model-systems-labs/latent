export class PythonLabError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PythonLabError";
    this.code = code;
  }
}

export class PythonLabTimeoutError extends PythonLabError {
  constructor(timeoutMs: number) {
    super("WALL_TIMEOUT", `The Python worker exceeded its ${timeoutMs} ms wall-clock limit and was restarted.`);
    this.name = "PythonLabTimeoutError";
  }
}

export class PythonLabAbortError extends PythonLabError {
  constructor() {
    super("ABORTED", "The Python operation was cancelled and the interpreter was restarted.");
    this.name = "PythonLabAbortError";
  }
}
