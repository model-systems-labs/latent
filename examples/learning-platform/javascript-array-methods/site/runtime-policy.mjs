const numberIsInteger = Number.isInteger.bind(Number);

export const HOST_RUNTIME_BOUNDS = Object.freeze({
  minimumTimeoutMs: 100,
  maximumTimeoutMs: 2_000,
  minimumOutputBytes: 1_024,
  maximumOutputBytes: 100_000,
});

export function admitRuntimeLimits(input) {
  const timeoutMs = input?.timeoutMs;
  const maxOutputBytes = input?.maxOutputBytes;
  if (
    !numberIsInteger(timeoutMs)
    || timeoutMs < HOST_RUNTIME_BOUNDS.minimumTimeoutMs
    || timeoutMs > HOST_RUNTIME_BOUNDS.maximumTimeoutMs
  ) {
    throw new Error(
      `This host accepts timeoutMs from ${HOST_RUNTIME_BOUNDS.minimumTimeoutMs} to ${HOST_RUNTIME_BOUNDS.maximumTimeoutMs}.`,
    );
  }
  if (
    !numberIsInteger(maxOutputBytes)
    || maxOutputBytes < HOST_RUNTIME_BOUNDS.minimumOutputBytes
    || maxOutputBytes > HOST_RUNTIME_BOUNDS.maximumOutputBytes
  ) {
    throw new Error(
      `This host accepts maxOutputBytes from ${HOST_RUNTIME_BOUNDS.minimumOutputBytes} to ${HOST_RUNTIME_BOUNDS.maximumOutputBytes}.`,
    );
  }
  return Object.freeze({ timeoutMs, maxOutputBytes });
}
