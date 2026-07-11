"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { trainCharacterRnn, type RnnResult } from "../lib/lab-engines";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; status: "complete" | "streaming" | "cancelled" | "error" };
type ChatState = { messages: ChatMessage[] };
type ChatAction =
  | { type: "user"; message: ChatMessage }
  | { type: "start"; message: ChatMessage }
  | { type: "delta"; id: string; delta: string }
  | { type: "terminal"; id: string; status: ChatMessage["status"] }
  | { type: "reset"; messages: ChatMessage[] };
type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type TextGenerator = (input: ModelMessage[], options?: Record<string, unknown>) => Promise<unknown>;
type MetricState = { queueMs: number; modelMs: number; ttftMs: number; tokens: number; durationMs: number; events: number };

const initialMessages: ChatMessage[] = [{
  id: "welcome",
  role: "assistant",
  content: "This capstone connects the model, transport, systems, and React layers. Train the student model or load the local chat model, then send a message.",
  status: "complete",
}];

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "reset") return { messages: action.messages };
  if (action.type === "user" || action.type === "start") return { messages: [...state.messages, action.message] };
  if (action.type === "delta") return {
    messages: state.messages.map((message) => message.id === action.id && message.status === "streaming" ? { ...message, content: message.content + action.delta } : message),
  };
  return { messages: state.messages.map((message) => message.id === action.id ? { ...message, status: action.status } : message) };
}

function extractGeneratedText(result: unknown) {
  if (!Array.isArray(result) || !result.length) return "";
  const generated = (result[0] as { generated_text?: unknown }).generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const final = generated.at(-1) as { content?: unknown } | undefined;
    return typeof final?.content === "string" ? final.content : "";
  }
  return "";
}

function createSseStream(text: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  const pieces = text.match(/\S+\s*/g) ?? [text];
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let index = 0;
      const push = () => {
        if (signal.aborted) {
          controller.enqueue(encoder.encode(`event: cancelled\ndata: {}\n\n`));
          controller.close();
          return;
        }
        if (index >= pieces.length) {
          controller.enqueue(encoder.encode(`event: done\ndata: {"tokens":${pieces.length}}\n\n`));
          controller.close();
          return;
        }
        const frame = `event: token\ndata: ${JSON.stringify({ delta: pieces[index] })}\n\n`;
        const midpoint = Math.max(1, Math.floor(frame.length * 0.62));
        controller.enqueue(encoder.encode(frame.slice(0, midpoint)));
        controller.enqueue(encoder.encode(frame.slice(midpoint)));
        index += 1;
        window.setTimeout(push, 24);
      };
      window.setTimeout(push, 70);
    },
  });
}

async function consumeSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const lines = frame.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
      const raw = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "{}";
      onEvent(event, JSON.parse(raw) as Record<string, unknown>);
    }
  }
}

export function BrowserChatCapstone() {
  const [state, dispatch] = useReducer(chatReducer, { messages: initialMessages });
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"student" | "local">("student");
  const [student, setStudent] = useState<RnnResult | null>(null);
  const [training, setTraining] = useState(false);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelDetail, setModelDetail] = useState("Not loaded");
  const [requestPhase, setRequestPhase] = useState("ready");
  const [metrics, setMetrics] = useState<MetricState>({ queueMs: 0, modelMs: 0, ttftMs: 0, tokens: 0, durationMs: 0, events: 0 });
  const generatorRef = useRef<TextGenerator | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeMessageRef = useRef<string | null>(null);
  const skipInitialPersistRef = useRef(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("latent-capstone-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as { version?: number; messages?: ChatMessage[] };
        if (parsed.version === 1 && Array.isArray(parsed.messages) && parsed.messages.length) {
          dispatch({ type: "reset", messages: parsed.messages });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false;
      return;
    }
    if (state.messages.some((message) => message.status === "streaming")) return;
    try {
      window.localStorage.setItem("latent-capstone-v1", JSON.stringify({ version: 1, messages: state.messages }));
    } catch {}
  }, [state.messages]);

  const trainStudent = () => {
    setTraining(true);
    setRequestPhase("training");
    window.setTimeout(() => {
      setStudent(trainCharacterRnn(600));
      setTraining(false);
      setRequestPhase("ready");
    }, 40);
  };

  const loadLocalModel = async () => {
    if (modelStatus === "loading" || modelStatus === "ready") return;
    setModelStatus("loading");
    setModelProgress(0);
    setRequestPhase("loading");
    try {
      const transformers = await import("@huggingface/transformers");
      const progressCallback = (info: unknown) => {
        const update = info as { progress?: number; file?: string; status?: string };
        if (typeof update.progress === "number") setModelProgress(Math.round(update.progress));
        if (update.file) setModelDetail(update.file.split("/").at(-1) ?? update.file);
      };
      const common = { dtype: "q4", progress_callback: progressCallback };
      let generator: TextGenerator;
      if ("gpu" in navigator) {
        try {
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "webgpu" }) as unknown as TextGenerator;
        } catch {
          generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "wasm" }) as unknown as TextGenerator;
        }
      } else {
        generator = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "wasm" }) as unknown as TextGenerator;
      }
      generatorRef.current = generator;
      setModelStatus("ready");
      setModelProgress(100);
      setModelDetail("SmolLM2-135M-Instruct · q4 · local");
      setRequestPhase("ready");
    } catch (error) {
      setModelStatus("error");
      setModelDetail(error instanceof Error ? error.message : "Model load failed");
      setRequestPhase("error");
    }
  };

  const generateResponse = async (userText: string) => {
    if (mode === "student") {
      if (!student) throw new Error("Train the student model first.");
      return `Learner-trained character model output:\n\n${student.sample}`;
    }
    const generator = generatorRef.current;
    if (!generator) throw new Error("Load the local model first.");
    const context: ModelMessage[] = [
      { role: "system", content: "Answer in concise technical prose. Do not use markdown headings." },
      ...state.messages.filter((message) => message.id !== "welcome" && message.status === "complete").slice(-6).map((message) => ({ role: message.role, content: message.content } as ModelMessage)),
      { role: "user", content: userText },
    ];
    const result = await generator(context, { max_new_tokens: 90, do_sample: true, temperature: 0.72, top_p: 0.9, repetition_penalty: 1.08 });
    return extractGeneratedText(result).trim() || "The local model returned no text.";
  };

  const send = async (override?: string) => {
    const userText = (override ?? input).trim();
    if (!userText || requestPhase !== "ready") return;
    const requestId = `r-${Date.now()}`;
    const userMessage: ChatMessage = { id: `u-${requestId}`, role: "user", content: userText, status: "complete" };
    const assistantId = `a-${requestId}`;
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "", status: "streaming" };
    dispatch({ type: "user", message: userMessage });
    dispatch({ type: "start", message: assistantMessage });
    activeMessageRef.current = assistantId;
    setInput("");
    setRequestPhase("queued");
    setMetrics({ queueMs: 12, modelMs: 0, ttftMs: 0, tokens: 0, durationMs: 0, events: 0 });
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 12));
      setRequestPhase("prefill");
      const modelStarted = performance.now();
      const response = await generateResponse(userText);
      const modelMs = performance.now() - modelStarted;
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setRequestPhase("streaming");
      let firstEvent = 0;
      let eventCount = 0;
      let tokens = 0;
      const stream = createSseStream(response, controller.signal);
      await consumeSse(stream, (event, data) => {
        eventCount += 1;
        if (!firstEvent && event === "token") firstEvent = performance.now();
        if (event === "token") {
          tokens += 1;
          dispatch({ type: "delta", id: assistantId, delta: String(data.delta ?? "") });
        }
        if (event === "cancelled") dispatch({ type: "terminal", id: assistantId, status: "cancelled" });
      });
      if (controller.signal.aborted) {
        dispatch({ type: "terminal", id: assistantId, status: "cancelled" });
        setRequestPhase("cancelled");
      } else {
        dispatch({ type: "terminal", id: assistantId, status: "complete" });
        setRequestPhase("ready");
      }
      setMetrics({ queueMs: 12, modelMs: Math.round(modelMs), ttftMs: Math.round((firstEvent || performance.now()) - started), tokens, durationMs: Math.round(performance.now() - started), events: eventCount });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      dispatch({ type: "terminal", id: assistantId, status: cancelled ? "cancelled" : "error" });
      setRequestPhase(cancelled ? "cancelled" : "error");
    } finally {
      abortRef.current = null;
      activeMessageRef.current = null;
      window.setTimeout(() => setRequestPhase((phase) => phase === "cancelled" || phase === "error" ? "ready" : phase), 500);
    }
  };

  const stop = () => abortRef.current?.abort();
  const regenerate = () => {
    const lastUser = [...state.messages].reverse().find((message) => message.role === "user");
    if (lastUser) void send(lastUser.content);
  };
  const reset = () => {
    abortRef.current?.abort();
    dispatch({ type: "reset", messages: initialMessages });
    window.localStorage.removeItem("latent-capstone-v1");
  };
  const readyForMode = mode === "student" ? Boolean(student) : modelStatus === "ready";
  const generating = ["queued", "prefill", "streaming"].includes(requestPhase);

  return (
    <main className="capstone-shell">
      <header className="capstone-topbar">
        <Link className="wordmark" href="/"><i />latent</Link>
        <div><span>Capstone</span><strong>Browser Chat</strong></div>
        <nav><Link href="/courses/models">Model</Link><Link href="/courses/systems">Platform</Link><Link href="/courses/product">React</Link></nav>
      </header>
      <div className="capstone-layout">
        <aside className="capstone-sidebar">
          <section>
            <span>Model backend</span>
            <div className="mode-switch"><button className={mode === "student" ? "active" : ""} type="button" onClick={() => setMode("student")}>Student model</button><button className={mode === "local" ? "active" : ""} type="button" onClick={() => setMode("local")}>Local chat model</button></div>
            {mode === "student" ? (
              <div className="backend-card"><strong>18-unit character RNN</strong><p>Genuinely trained in this tab on the supplied Signal Notes corpus.</p>{student ? <dl><div><dt>Parameters</dt><dd>{student.parameters.toLocaleString()}</dd></div><div><dt>Final loss</dt><dd>{student.finalLoss.toFixed(3)}</dd></div></dl> : null}<button type="button" onClick={trainStudent} disabled={training}>{training ? "Training…" : student ? "Retrain model" : "Train model"}</button></div>
            ) : (
              <div className="backend-card"><strong>SmolLM2-135M · q4</strong><p>Quantized pretrained Transformer running through WebGPU or WASM.</p><div className="load-progress"><i><b style={{ width: `${modelProgress}%` }} /></i><em>{modelDetail}</em></div><button type="button" onClick={loadLocalModel} disabled={modelStatus === "loading" || modelStatus === "ready"}>{modelStatus === "ready" ? "Model ready" : modelStatus === "loading" ? `${modelProgress}% loaded` : "Load ~181 MB"}</button></div>
            )}
          </section>
          <section className="runtime-panel">
            <span>Request lifecycle</span>
            <div className="phase-row">{["queued", "prefill", "streaming"].map((phase) => <i className={requestPhase === phase ? "active" : ""} key={phase}>{phase}</i>)}</div>
            <dl><div><dt>Queue</dt><dd>{metrics.queueMs} ms</dd></div><div><dt>Model</dt><dd>{metrics.modelMs} ms</dd></div><div><dt>TTFT</dt><dd>{metrics.ttftMs} ms</dd></div><div><dt>Events</dt><dd>{metrics.events}</dd></div><div><dt>Tokens</dt><dd>{metrics.tokens}</dd></div><div><dt>Total</dt><dd>{metrics.durationMs} ms</dd></div></dl>
          </section>
          <section className="transport-panel"><span>Transport</span><strong>SSE-compatible ReadableStream</strong><code>token · done · cancelled</code><p>Each logical event is deliberately split across byte chunks before parsing.</p></section>
          <footer><span>Device-local history</span><button type="button" onClick={reset}>Clear conversation</button></footer>
        </aside>
        <section className="chat-workspace">
          <header><div><span>{mode === "student" ? "Learner-trained model" : "Local pretrained model"}</span><strong>{readyForMode ? "Ready" : mode === "student" ? "Train before chatting" : "Load before chatting"}</strong></div><div className={`runtime-status ${requestPhase}`}><i />{requestPhase}</div></header>
          <div className="capstone-messages" role="log" aria-live="polite" aria-label="Conversation">
            {state.messages.map((message) => (
              <article className={`capstone-message ${message.role} ${message.status}`} key={message.id}>
                <span>{message.role === "user" ? "You" : "Model"}</span>
                <p>{message.content || (message.status === "streaming" ? "Processing context…" : "No output")}</p>
                {message.status !== "complete" ? <em>{message.status}</em> : null}
              </article>
            ))}
          </div>
          <div className="chat-actions"><button type="button" onClick={regenerate} disabled={generating || !readyForMode}>Regenerate</button>{generating ? <button className="stop" type="button" onClick={stop}>Stop generation</button> : null}</div>
          <form className="capstone-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={readyForMode ? "Send a message to the selected model…" : "Prepare the selected model first…"} disabled={!readyForMode || generating} aria-label="Chat message" />
            <div><span>Enter to send · Shift+Enter for newline</span><button type="submit" disabled={!readyForMode || generating || !input.trim()}>Send</button></div>
          </form>
          <footer className="capstone-contract"><span>Execution contract</span><p>The student backend is truly trained here but is intentionally small and completion-oriented. The chat backend is pretrained, quantized, and runs locally. Both use the same React reducer and mock SSE transport.</p></footer>
        </section>
      </div>
    </main>
  );
}
