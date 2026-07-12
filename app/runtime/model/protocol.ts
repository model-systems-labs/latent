export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LocalModelOptions = {
  maxTokens: number;
  temperature: number;
  topK: number;
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
  | { type: "done"; requestId: string }
  | { type: "cancelled"; requestId: string }
  | { type: "error"; requestId?: string; message: string };
