"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RnnResult } from "@latent/model-lab/character-rnn";
import { recordLearningEvent } from "../lib/learning-analytics";

export function FirstRunExperience() {
  const [prompt, setPrompt] = useState("the system ");
  const [result, setResult] = useState<RnnResult | null>(null);
  const [openOutput, setOpenOutput] = useState("");
  const [constrainedOutput, setConstrainedOutput] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
    setStatus(result ? "Generating twice with the same weights and seed…" : "Training 1,267 parameters for 100 repeatable updates…");
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
      setStatus(`Loss ${trained.initialLoss.toFixed(3)} → ${trained.finalLoss.toFixed(3)}. The outputs differ only because the generation settings changed.`);
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
    <section className="first-run first-run-minimal" id="first-run" aria-labelledby="first-run-title">
      <header>
        <h2 id="first-run-title">Character-level RNN training</h2>
        <p>Train 1,267 parameters in a Web Worker, then compare two continuations from the same checkpoint.</p>
      </header>
      <div className="first-run-layout">
        <div className="first-run-controls">
          <label><span>Prompt prefix</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={64} /></label>
          <button type="button" onClick={() => void run()} disabled={working}>{working ? "Running in worker…" : result ? "Generate both policies" : "Train and generate"}</button>
          <p aria-live="polite">{status}</p>
        </div>
        {openOutput || constrainedOutput ? <div className="first-run-output">
          <article><header><span>Open sampling</span><code>temperature 1.05 · top-k off</code></header><p>{openOutput}</p></article>
          <article><header><span>Top-k sampling</span><code>temperature 0.72 · top-k 5</code></header><p>{constrainedOutput}</p></article>
        </div> : null}
      </div>
      <footer><Link href="/lessons/character-rnns">Continue to Character RNNs →</Link></footer>
    </section>
  );
}
