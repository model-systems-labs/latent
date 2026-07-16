import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Latent · Notes on LLM systems",
  description:
    "Notes, implementations, and browser experiments for studying language models, inference runtimes, serving systems, and chat interfaces.",
};

const architectureStages = [
  { scope: "Browser input", title: "Prompt + messages", detail: "UTF-8 text" },
  { scope: "Browser input", title: "Tokenizer", detail: "text → token IDs" },
  { scope: "Inference runtime", title: "Scheduler", detail: "admit · batch · cancel" },
  { scope: "Inference runtime", title: "Prefill", detail: "prompt → K,V" },
  { scope: "Inference runtime", title: "Decode loop", detail: "logits → next token" },
  { scope: "Streaming transport", title: "SSE stream", detail: "typed token events" },
  { scope: "Application", title: "React reducer", detail: "events → chat state" },
  { scope: "Application", title: "Browser Chat", detail: "rendered response" },
] as const;

const architectureBoundaries = [
  "Browser input",
  "Inference runtime",
  "Streaming transport",
  "Application",
] as const;

const architectureState = [
  { className: "stateWeights", title: "Model weights", detail: "used by prefill + decode" },
  { className: "stateCache", title: "KV cache", detail: "K,V reused at every decode step" },
  { className: "stateArtifacts", title: "Project artifacts", detail: "lesson files · tests · BrowserChat.tsx" },
  { className: "statePersistence", title: "Browser persistence", detail: "IndexedDB drafts · checkpoints" },
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
        <Link className={styles.headerLink} href="/course">Course notes</Link>
      </header>

      <article className={styles.shell}>
        <section className={styles.hero}>
          <h1>I built this to understand LLM systems.</h1>
          <p>
            Latent is a set of notes, implementations, and browser experiments that follows the path
            from sequence modeling to inference, serving, and interface design. It is how I am
            learning the subject. You can use it too.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/course">Read the notes <span aria-hidden="true">→</span></Link>
            <Link className={styles.secondaryAction} href="/project">Browse the project</Link>
          </div>
        </section>

        <section className={styles.argument} aria-labelledby="system-title">
          <h2 id="system-title">Model, runtime, serving, and interface.</h2>
          <p>
            A paper can explain one mechanism clearly while leaving the surrounding system implicit.
            These lessons begin with recurrence, tokenization, attention, and causal masking, then
            continue into prefill and decoding, KV-cache accounting, continuous batching, SSE framing,
            cancellation, retries, and conversation state. Each example is small enough to inspect
            and run in a browser.
          </p>
          <figure
            className={styles.architecture}
            aria-labelledby="architecture-title"
            aria-describedby="architecture-description"
          >
            <figcaption className={styles.architectureCaption}>
              <div>
                <strong id="architecture-title">Browser-native LLM system</strong>
                <span>One generation request</span>
              </div>
              <p id="architecture-description">
                Text moves left to right. The lower rail shows state that is loaded, reused, or
                persisted rather than streamed with each token.
              </p>
            </figcaption>

            <ol className={styles.architectureBoundaries} aria-label="System boundaries">
              {architectureBoundaries.map((boundary, index) => (
                <li key={boundary}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <strong>{boundary}</strong>
                </li>
              ))}
            </ol>

            <ol className={styles.architectureFlow} aria-label="Request and token event flow">
              {architectureStages.map((stage, index) => (
                <li key={stage.title}>
                  <span className={styles.architectureScope}>{stage.scope}</span>
                  <strong>{stage.title}</strong>
                  <code>{stage.detail}</code>
                  {index < architectureStages.length - 1 ? (
                    <i className={styles.architectureArrow} aria-hidden="true">→</i>
                  ) : null}
                </li>
              ))}
            </ol>

            <div
              className={styles.architectureState}
              role="group"
              aria-label="State reused or persisted across the request path"
            >
              {architectureState.map((state) => (
                <div className={styles[state.className]} key={state.title}>
                  <strong>{state.title}</strong>
                  <code>{state.detail}</code>
                </div>
              ))}
            </div>

            <div className={styles.architectureLegend} aria-hidden="true">
              <span><i className={styles.flowKey} />request + token events</span>
              <span><i className={styles.stateKey} />reused or persisted state</span>
            </div>
          </figure>
        </section>

        <section className={styles.argument} aria-labelledby="project-title">
          <h2 id="project-title">The implementation accumulates.</h2>
          <p>
            Each lesson adds a tested file to the same project. The tests isolate the idea under study;
            the capstone connects browser versions of those pieces into a local chatbot. This is not a
            production-scale model or serving stack. It is a compact implementation for studying where
            the boundaries are and how data moves across them.
          </p>
          <div className={styles.projectTree} role="group" aria-label="Course files accumulating into the Browser Chat capstone">
            <span>browser-chat/</span>
            {projectFiles.map((file, index) => (
              <code key={file}><i aria-hidden="true">{index === projectFiles.length - 1 ? "└──" : "├──"}</i>{file}</code>
            ))}
          </div>
        </section>

        <section className={styles.closing}>
          <p>Begin with a character-level recurrent model. Continue until the pieces form a browser chat system.</p>
          <Link href="/course">Read from the beginning <span aria-hidden="true">→</span></Link>
        </section>
      </article>

      <footer className={styles.footer}>
        <span>Latent</span>
        <nav aria-label="Footer navigation">
          <Link href="/course">Course notes</Link>
          <Link href="/workspace">IDE</Link>
          <Link href="/sources">Sources</Link>
        </nav>
      </footer>
    </main>
  );
}
