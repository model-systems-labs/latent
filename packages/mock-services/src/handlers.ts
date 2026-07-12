import { HttpResponse, http } from "msw";
import { createMockServingStream, type MockServingConfig } from "./sse.js";

export type MockGenerationRequest = {
  prompt: string;
  response?: string;
};

export type MockGenerationHandlerOptions = {
  endpoint?: string;
  stream?: Partial<MockServingConfig>;
  generate?: (request: MockGenerationRequest) => string | Promise<string>;
};

/**
 * Creates the backend seam used by UI and distributed-systems exercises. The
 * LMS never imports MSW directly; it consumes the same HTTP and SSE contract a
 * production serving client would consume.
 */
export function createMockGenerationHandler(options: MockGenerationHandlerOptions = {}) {
  const endpoint = options.endpoint ?? "/api/mock/generate";
  return http.post(endpoint, async ({ request }) => {
    const payload = await request.json() as Partial<MockGenerationRequest>;
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    const response = options.generate
      ? await options.generate({ prompt, response: payload.response })
      : typeof payload.response === "string"
        ? payload.response
        : `A deterministic response to: ${prompt}`;
    const config: MockServingConfig = {
      wordsPerEvent: options.stream?.wordsPerEvent ?? 1,
      delayMs: options.stream?.delayMs ?? 0,
      scenario: options.stream?.scenario,
    };
    return new HttpResponse(createMockServingStream(response, request.signal, config), {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream; charset=utf-8",
        Connection: "keep-alive",
      },
    });
  });
}
