import type { Metadata } from "next";
import Link from "next/link";
import {
  EditableHomepageLink,
  EditableText,
  HomepageCopyProvider,
} from "./components/HomepageCopyEditor";
import { PageAtmosphere } from "./components/PageAtmosphere";
import type { SiteCopyKey, SiteCopyValues } from "./content/site-copy";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Latent · Hands-on courses on LLM systems",
  description:
    "Learn machine learning and LLM systems with clear explanations, runnable browser exercises, and a cumulative local chatbot project.",
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

const architectureMovements = [
  { number: "01", title: "Model", detail: "Text becomes tokens, then model state." },
  { number: "02", title: "Runtime", detail: "Prefill, cache, scheduling, and decode." },
  { number: "03", title: "Product", detail: "Events become a responsive conversation." },
] as const;

const projectFiles = [
  "models/character-rnn.py",
  "systems/inference-runtime.py",
  "backend/streaming-transport.py",
  "product/chat-reducer.py",
  "capstone/BrowserChat.tsx",
] as const;

const homepageCopyDefaults = {
  "hero.title": "Learn how LLM systems actually work.",
  "hero.body": "Start with the math if you need it, or jump straight into models, inference, serving, and chat product code. Every lesson pairs a clear explanation with code you can run in your browser.",
  "hero.primaryAction": "Find your starting point",
  "hero.secondaryAction": "Open LLM systems",
  "system.title": "Model, runtime, serving, and interface.",
  "system.body": "A paper can explain one mechanism clearly while leaving the surrounding system implicit. These lessons begin with recurrence, tokenization, attention, and causal masking, then continue into prefill and decoding, KV-cache accounting, continuous batching, SSE framing, cancellation, retries, and conversation state. Each example is small enough to inspect and run in a browser.",
  "architecture.title": "Browser-native LLM system",
  "architecture.kicker": "One request · three movements",
  "architecture.description": "Text moves left to right. The lower rail shows state that is loaded, reused, or persisted rather than streamed with each token.",
  "project.title": "The implementation accumulates.",
  "project.body": "Each lesson adds a tested file to the same project. The tests isolate the idea under study; the capstone connects browser versions of those pieces into a local chatbot. This is not a production-scale model or serving stack. It is a compact implementation for studying where the boundaries are and how data moves across them.",
  "closing.body": "Begin with a character-level recurrent model. Continue until the pieces form a browser chat system.",
  "closing.action": "Open the LLM systems course",
} satisfies SiteCopyValues;

const copy = (key: SiteCopyKey) => homepageCopyDefaults[key];

export default function Home() {
  return (
    <HomepageCopyProvider defaults={homepageCopyDefaults}>
      <main className={styles.page}>
        <PageAtmosphere />

        <header className={`site-header course-header ${styles.header}`}>
          <Link className="wordmark" href="/"><i />latent</Link>
          <nav aria-label="Primary navigation">
            <Link className={styles.headerLink} href="/course">Courses</Link>
            <Link className={styles.headerLink} href="/workspace" aria-label="Open coding workspace">Code</Link>
          </nav>
        </header>

        <article className={styles.shell}>
          <section className={styles.hero}>
            <span className="eyebrow">Hands-on courses · runs locally in your browser</span>
            <EditableText as="h1" copyKey="hero.title" fallback={copy("hero.title")} />
            <EditableText as="p" copyKey="hero.body" fallback={copy("hero.body")} />
            <div className={styles.actions}>
              <EditableHomepageLink
                arrow
                className={styles.primaryAction}
                copyKey="hero.primaryAction"
                fallback={copy("hero.primaryAction")}
                href="/course#starting-point"
              />
              <EditableHomepageLink
                className={styles.secondaryAction}
                copyKey="hero.secondaryAction"
                fallback={copy("hero.secondaryAction")}
                href="/courses/llm-systems"
              />
            </div>
          </section>

          <section className={styles.argument} aria-labelledby="system-title">
            <EditableText as="h2" copyKey="system.title" fallback={copy("system.title")} id="system-title" />
            <EditableText as="p" copyKey="system.body" fallback={copy("system.body")} />
            <figure
              className={styles.architecture}
              aria-labelledby="architecture-title"
              aria-describedby="architecture-description"
            >
              <figcaption className={styles.architectureCaption}>
                <div>
                  <EditableText
                    as="strong"
                    copyKey="architecture.title"
                    fallback={copy("architecture.title")}
                    id="architecture-title"
                  />
                  <EditableText as="span" copyKey="architecture.kicker" fallback={copy("architecture.kicker")} />
                </div>
                <EditableText
                  as="p"
                  copyKey="architecture.description"
                  fallback={copy("architecture.description")}
                  id="architecture-description"
                />
              </figcaption>

              <ol className={styles.architectureOverview} aria-label="Model, runtime, and product path">
                {architectureMovements.map((movement) => (
                  <li key={movement.title}>
                    <span>{movement.number}</span>
                    <strong>{movement.title}</strong>
                    <p>{movement.detail}</p>
                  </li>
                ))}
              </ol>

              <details className="calm-disclosure">
                <summary>
                  <span>Follow the generation request, step by step</span>
                  <small>8 stages · 4 boundaries</small>
                </summary>
                <div className={styles.architectureDeepDive}>
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
                </div>
              </details>
            </figure>
          </section>

          <section className={styles.argument} aria-labelledby="project-title">
            <EditableText as="h2" copyKey="project.title" fallback={copy("project.title")} id="project-title" />
            <EditableText as="p" copyKey="project.body" fallback={copy("project.body")} />
            <details className={`${styles.projectDetails} calm-disclosure`}>
              <summary>See how the five course files come together</summary>
              <div className={styles.projectTree} role="group" aria-label="Course files accumulating into the Browser Chat capstone">
                <span>browser-chat/</span>
                {projectFiles.map((file, index) => (
                  <code key={file}><i aria-hidden="true">{index === projectFiles.length - 1 ? "└──" : "├──"}</i>{file}</code>
                ))}
              </div>
            </details>
          </section>
        </article>

        <footer className={styles.footer}>
          <span>Latent</span>
          <nav aria-label="Footer navigation">
            <Link href="/course">Courses</Link>
            <Link href="/workspace">IDE</Link>
            <Link href="/sources">Further reading</Link>
          </nav>
        </footer>
      </main>
    </HomepageCopyProvider>
  );
}
