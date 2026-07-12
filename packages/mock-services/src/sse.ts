export type ServingEvent =
  | { type: "token"; data: { delta: string } }
  | { type: "done"; data: { tokens: number } }
  | { type: "cancelled"; data: Record<string, never> }
  | { type: "error"; data: { code: string; message: string; retryable: boolean } };

export type MockServingScenario = "healthy" | "slow-first-token" | "malformed-frame" | "timeout-before-first-token";

export type MockServingConfig = {
  wordsPerEvent: number;
  delayMs: number;
  scenario?: MockServingScenario;
};

export function encodeSse(event: ServingEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export function parseSseChunk(buffer: string, chunk: string) {
  const frames = `${buffer}${chunk}`.split("\n\n");
  const remainder = frames.pop() ?? "";
  const events = frames.filter(Boolean).map((frame): ServingEvent => {
    const lines = frame.split("\n");
    const type = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "error";
    const raw = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "{}";
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (type === "token") return { type, data: { delta: String(data.delta ?? "") } };
    if (type === "done") return { type, data: { tokens: Number(data.tokens ?? 0) } };
    if (type === "cancelled") return { type, data: {} };
    return {
      type: "error",
      data: {
        code: String(data.code ?? "MALFORMED_EVENT"),
        message: String(data.message ?? "The mock service emitted an unknown event."),
        retryable: data.retryable === true,
      },
    };
  });
  return { events, remainder };
}

export function shouldRetryGeneration({
  attempt,
  maxAttempts,
  emittedVisibleOutput,
  retryable,
}: {
  attempt: number;
  maxAttempts: number;
  emittedVisibleOutput: boolean;
  retryable: boolean;
}) {
  return retryable && !emittedVisibleOutput && attempt < maxAttempts;
}

export function createMockServingStream(text: string, signal: AbortSignal, config: MockServingConfig) {
  const encoder = new TextEncoder();
  const wordsPerEvent = Math.max(1, Math.round(config.wordsPerEvent));
  const delayMs = Math.max(0, Math.round(config.delayMs));
  const words = text.match(/\S+\s*/g) ?? [text];
  const pieces = Array.from(
    { length: Math.ceil(words.length / wordsPerEvent) },
    (_, index) => words.slice(index * wordsPerEvent, (index + 1) * wordsPerEvent).join(""),
  );
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let index = 0;
      const closeWith = (event: ServingEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)));
        controller.close();
      };
      const push = () => {
        if (signal.aborted) {
          closeWith({ type: "cancelled", data: {} });
          return;
        }
        if (config.scenario === "timeout-before-first-token" && index === 0) {
          closeWith({ type: "error", data: { code: "QUEUE_TIMEOUT", message: "The deterministic queue deadline elapsed.", retryable: true } });
          return;
        }
        if (index >= pieces.length) {
          closeWith({ type: "done", data: { tokens: pieces.length } });
          return;
        }
        if (config.scenario === "malformed-frame" && index === 1) {
          controller.enqueue(encoder.encode("event: token\ndata: {not-json}\n\n"));
          controller.close();
          return;
        }
        const frame = encodeSse({ type: "token", data: { delta: pieces[index] } });
        const midpoint = Math.max(1, Math.floor(frame.length * 0.62));
        controller.enqueue(encoder.encode(frame.slice(0, midpoint)));
        controller.enqueue(encoder.encode(frame.slice(midpoint)));
        index += 1;
        globalThis.setTimeout(push, delayMs);
      };
      const firstDelay = config.scenario === "slow-first-token" ? Math.max(420, delayMs * 8) : Math.min(120, delayMs * 3);
      globalThis.setTimeout(push, firstDelay);
    },
  });
}

export async function consumeSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ServingEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }));
    buffer = parsed.remainder;
    for (const event of parsed.events) onEvent(event);
  }
  if (buffer.trim()) throw new Error("The stream ended with an incomplete SSE frame.");
}
