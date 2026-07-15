import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Latent · Build the system around the transformer",
  description:
    "A browser course where model, runtime, serving, and React implementations become one tested LLM chatbot.",
};

const systemPath = [
  { title: "Model", detail: "Weights and tokens" },
  { title: "Runtime", detail: "Prefill and decode" },
  { title: "Serving", detail: "Streams and recovery" },
  { title: "Interface", detail: "React state" },
  { title: "Chatbot", detail: "One local build" },
] as const;

const projectFiles = [
  "models/character-rnn.py",
  "systems/inference-runtime.py",
  "backend/streaming-transport.py",
  "product/chat-reducer.py",
  "capstone/BrowserChat.tsx",
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <div className="page-atmosphere" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="node node-one" />
        <span className="warm-star" />
      </div>

      <header className={`site-header course-header ${styles.header}`}>
        <Link className="wordmark" href="/"><i />latent</Link>
        <Link className={styles.headerLink} href="/course">Open the course</Link>
      </header>

      <article className={styles.shell}>
        <section className={styles.hero}>
          <h1>The transformer is one file. Build the system around it.</h1>
          <p>
            Token generation is the midpoint, not the finish line. Latent continues into inference,
            serving, and React—fourteen tested project files that become one browser chatbot.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/course">Open the course <span aria-hidden="true">→</span></Link>
            <Link className={styles.secondaryAction} href="/project">See the project structure</Link>
          </div>
        </section>

        <section className={styles.argument} aria-labelledby="system-title">
          <h2 id="system-title">One system, from weights to interface.</h2>
          <p>
            Implement recurrence, tokenization, attention, and causal masking. Then keep going:
            prefill and decode, KV-cache accounting, continuous batching, SSE framing,
            cancellation, retries, and conversation state.
          </p>
          <ol className={styles.systemPath} aria-label="The system built across the course">
            {systemPath.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.argument} aria-labelledby="project-title">
          <h2 id="project-title">Your code survives the lesson.</h2>
          <p>
            Each lesson leaves behind a tested file. Your project keeps all fourteen; the capstone
            runs browser versions checked against the same behavior. Source, checkpoints, and builds
            stay on your device.
          </p>
          <div className={styles.projectTree} role="group" aria-label="Course files accumulating into the Browser Chat capstone">
            <span>browser-chat/</span>
            {projectFiles.map((file, index) => (
              <code key={file}><i aria-hidden="true">{index === projectFiles.length - 1 ? "└──" : "├──"}</i>{file}</code>
            ))}
          </div>
        </section>

        <section className={styles.closing}>
          <p>Start with <code>models/character-rnn.py</code>.<br />Finish with <code>capstone/BrowserChat.tsx</code>.</p>
          <Link href="/course">Build the system <span aria-hidden="true">→</span></Link>
        </section>
      </article>

      <footer className={styles.footer}>
        <span>Latent</span>
        <nav aria-label="Footer navigation">
          <Link href="/course">Course</Link>
          <Link href="/workspace">IDE</Link>
          <Link href="/sources">Sources</Link>
        </nav>
      </footer>
    </main>
  );
}
