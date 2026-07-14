"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { RnnResult } from "@latent/model-lab/character-rnn";
import { recordLearningEvent } from "../lib/learning-analytics";

type Capability = { label: string; status: "ready" | "fallback" | "blocked"; detail: string };

const subscribeToBrowser = () => () => {};

export function FirstRunExperience() {
  const [prompt, setPrompt] = useState("the system ");
  const [result, setResult] = useState<RnnResult | null>(null);
  const [openOutput, setOpenOutput] = useState("");
  const [constrainedOutput, setConstrainedOutput] = useState("");
  const [status, setStatus] = useState("A worker trains the small model only after you press run.");
  const [working, setWorking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const browserReady = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const capabilities: Capability[] = browserReady ? [
    { label: "Training worker", status: "Worker" in window ? "ready" : "blocked", detail: "Worker" in window ? "isolated thread" : "worker unavailable" },
    { label: "Numerical runtime", status: "WebAssembly" in window ? "ready" : "blocked", detail: "WebAssembly" in window ? "WASM available" : "WASM unavailable" },
    { label: "Project saving", status: "indexedDB" in window ? "ready" : "blocked", detail: "indexedDB" in window ? "device-local IndexedDB" : "saving unavailable" },
    { label: "Transformer", status: "gpu" in navigator ? "ready" : "fallback", detail: "gpu" in navigator ? "WebGPU available" : "WASM fallback" },
  ] : [];

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const generate = async (checkpoint: RnnResult) => {
    const { sampleCharacterRnn } = await import("@latent/model-lab/character-rnn");
    const safePrompt = prompt.trim().slice(0, 64) || "the system";
    setOpenOutput(`…${safePrompt}${sampleCharacterRnn(checkpoint.checkpoint, safePrompt, 96, 1.05, 71, 0)}`);
    setConstrainedOutput(`…${safePrompt}${sampleCharacterRnn(checkpoint.checkpoint, safePrompt, 96, 0.72, 71, 5)}`);
  };

  const run = async () => {
    if (working) return;
    setWorking(true);
    setStatus(result ? "Sampling twice from the same weights and seed…" : "Training 1,267 parameters for 100 deterministic updates…");
    void recordLearningEvent("first_run_started");
    try {
      let trained = result;
      if (!trained) {
        const controller = new AbortController();
        abortRef.current = controller;
        const [{ trainCharacterRnnInWorker }, { saveCharacterRnnArtifact }] = await Promise.all([
          import("../runtime/model/train-character-client"),
          import("../lib/learner-state"),
        ]);
        trained = await trainCharacterRnnInWorker(100, controller.signal);
        saveCharacterRnnArtifact(trained);
        setResult(trained);
        abortRef.current = null;
      }
      await generate(trained);
      setStatus(`Loss ${trained.initialLoss.toFixed(3)} → ${trained.finalLoss.toFixed(3)}. The two outputs differ only because inference policy changed.`);
      void recordLearningEvent("first_run_completed", { outcome: "passed" });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setStatus(cancelled ? "Training cancelled." : error instanceof Error ? error.message : "The first run stopped safely.");
      void recordLearningEvent("first_run_completed", { outcome: cancelled ? "cancelled" : "failed" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="first-run" id="first-run" aria-labelledby="first-run-title">
      <header>
        <div><span>First run · actual training</span><h2 id="first-run-title">Character-level RNN</h2></div>
        <p>Train a 1,267-parameter character-level recurrent neural network in a worker, then sample the same checkpoint under two inference policies. Later, the same project loads a 135M-parameter local Transformer.</p>
      </header>
      <div className="first-run-layout">
        <div className="first-run-controls">
          <label><span>Prompt prefix</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={64} /></label>
          <button type="button" onClick={() => void run()} disabled={working}>{working ? "Running in worker…" : result ? "Generate both policies" : "Train and generate"}</button>
          <p aria-live="polite">{status}</p>
          <div className="environment-readiness" aria-label="Browser environment readiness">
            {capabilities.map((capability) => <span className={capability.status} key={capability.label}><i /> <strong>{capability.label}</strong><em>{capability.detail}</em></span>)}
          </div>
        </div>
        <div className="first-run-output">
          <article><header><span>Open distribution</span><code>temperature 1.05 · top-k off</code></header><p>{openOutput || "Run the model to produce an unconstrained continuation."}</p></article>
          <article><header><span>Restricted distribution</span><code>temperature 0.72 · top-k 5</code></header><p>{constrainedOutput || "The same weights will sample only from the five highest-probability characters."}</p></article>
        </div>
      </div>
      <footer><p>The result is not presented as a capable assistant. It isolates the mechanism you implement in Lesson 01.</p><Link href="/lessons/character-rnns">Open Character RNNs →</Link></footer>
    </section>
  );
}
