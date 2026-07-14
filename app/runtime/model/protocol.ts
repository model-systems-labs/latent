export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LocalModelOptions = {
  maxTokens: number;
  temperature: number;
  topK: number;
};

export const LOCAL_MODEL_MAX_NEW_TOKENS = 160;

export type LocalModelGenerationResult = {
  generatedUnits: number;
  unit: "stream-chunks";
};

export type ModelWorkerRequest =
  | { type: "load" }
  | { type: "generate"; requestId: string; messages: ModelMessage[]; options: LocalModelOptions }
  | { type: "cancel"; requestId: string }
  | { type: "dispose" };

export type ModelWorkerResponse =
  | { type: "progress"; progress: number; detail: string }
  | { type: "ready"; detail: string; device: "webgpu" | "wasm" }
  | { type: "start"; requestId: string }
  | { type: "delta"; requestId: string; delta: string }
  | { type: "done"; requestId: string; generatedUnits: number; unit: "stream-chunks" }
  | { type: "cancelled"; requestId: string; generatedUnits: number; unit: "stream-chunks" }
  | { type: "error"; requestId?: string; message: string };
