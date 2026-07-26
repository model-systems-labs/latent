import type { Metadata } from "next";
import Link from "next/link";
import { FrameworkHeader } from "../../products/framework/FrameworkHeader";
import { PageAtmosphere } from "../components/PageAtmosphere";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Open learning · Latent Framework",
  description: "Create, self-host, verify, and study portable lessons and flash cards made by people or any capable LLM.",
};

const workflow = [
  {
    number: "01",
    title: "Author anywhere",
    body: "A person or any capable LLM writes the same public JSON format. No model-specific API is required.",
  },
  {
    number: "02",
    title: "Check locally",
    body: "Strict schemas, source references, objective coverage, and deterministic builds catch common failures before publishing.",
  },
  {
    number: "03",
    title: "Host anywhere",
    body: "The result is a static site and a digest-pinned feed. The publisher keeps the URL and the learner keeps progress.",
  },
] as const;

export default function OpenLearningPage() {
  return (
    <main>
      <PageAtmosphere />
      <FrameworkHeader current="open-learning" />

      <article className={styles.shell}>
        <header className={styles.hero}>
          <span className="eyebrow">An open format · not another content silo</span>
          <h1>Anyone can publish a lesson.</h1>
          <p>
            Open Learning has two deliberately separate workflows. Publishers
            author and build portable content. Learners verify and read a
            publisher-controlled feed. Neither workflow grants remote content
            new runtime capabilities.
          </p>
          <div className={styles.heroActions}>
            <Link href="/open-learning/read">Read a hosted feed <span aria-hidden="true">→</span></Link>
            <Link href="/open-learning/publish">Publish a Learning Pack <span aria-hidden="true">→</span></Link>
            <a href="/open-learning/reliable-llm-changes/index.html">View the standalone example <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <section className={styles.pathChooser} aria-labelledby="choose-path-title">
          <header>
            <span className="eyebrow">Choose a role</span>
            <h2 id="choose-path-title">Reading and publishing are different jobs.</h2>
          </header>
          <article>
            <span>For learners</span>
            <h3>Verify and read a hosted feed</h3>
            <p>
              Check origin, byte count, package identity, and SHA-256 integrity
              before rendering text or saving progress on this device.
            </p>
            <Link href="/open-learning/read">Open the feed reader →</Link>
          </article>
          <article>
            <span>For publishers</span>
            <h3>Build a portable Learning Pack you host</h3>
            <p>
              Edit or import declarative JSON, pass the local quality gate,
              then host the generated static site at a URL you control.
            </p>
            <Link href="/open-learning/publish">Open the publishing studio →</Link>
          </article>
        </section>

        <section className={styles.principles} aria-label="Open learning workflow">
          {workflow.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </section>

        <section className={styles.protocol} aria-labelledby="protocol-title">
          <div>
            <span className="eyebrow">The public contract</span>
            <h2 id="protocol-title">Portable content. Constrained runtime.</h2>
          </div>
          <dl>
            <div>
              <dt>Publishers own</dt>
              <dd>The source, license, domain, version history, and audience relationship.</dd>
            </div>
            <div>
              <dt>LLMs can extend</dt>
              <dd>Lessons, explanations, quizzes, objectives, citations, decks, cards, and namespaced metadata.</dd>
            </div>
            <div>
              <dt>Packs cannot run</dt>
              <dd>Remote JavaScript, HTML, Python, React, iframes, workers, or executable tests in a learner’s browser.</dd>
            </div>
            <div>
              <dt>Latent may add</dt>
              <dd>Optional discovery, verified publisher identity, editorial review, private registries, and managed hosting.</dd>
            </div>
          </dl>
          <nav aria-label="Open learning documentation">
            <Link href="/open-learning/reliable-llm-changes/learning-pack.json">Example source JSON</Link>
            <Link href="/open-learning/reliable-llm-changes/learning-feed.json">Example feed</Link>
            <Link href="/open-learning/learning-pack.schema.json">Learning Pack JSON Schema</Link>
            <Link href="/llms.txt">LLM authoring entrypoint</Link>
          </nav>
        </section>
      </article>

      <footer className={styles.footer}>
        <span>Latent framework</span>
        <nav aria-label="Footer navigation">
          <Link href="/framework">Framework</Link>
          <Link href="/open-learning">Open learning</Link>
          <Link href="/open-learning/read">Read a feed</Link>
          <Link href="/open-learning/publish">Publish a pack</Link>
          <Link href="/course">Reference courses</Link>
        </nav>
      </footer>
    </main>
  );
}
