import type { Metadata } from "next";
import Link from "next/link";
import { PageAtmosphere } from "../components/PageAtmosphere";
import { OpenLearningStudio } from "./OpenLearningStudio";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Open learning · Latent",
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
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav aria-label="Primary navigation">
          <Link href="/course">Courses</Link>
          <Link aria-current="page" href="/open-learning">Open learning</Link>
          <Link href="/workspace" aria-label="Open coding workspace">Code</Link>
        </nav>
      </header>

      <article className={styles.shell}>
        <header className={styles.hero}>
          <span className="eyebrow">An open format · not another content silo</span>
          <h1>Anyone can publish a lesson.</h1>
          <p>Make a course or a deck with the LLM you choose. Check it locally. Host it on any static site. Learners can use the publisher’s site directly or verify the feed here before saving a copy on their device.</p>
          <div className={styles.heroActions}>
            <a href="#open-a-feed">Open a learning feed <span aria-hidden="true">↓</span></a>
            <a href="/open-learning/reliable-llm-changes/index.html">View the standalone example <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <section className={styles.principles} aria-label="Open learning workflow">
          {workflow.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </section>

        <div id="open-a-feed">
          <OpenLearningStudio />
        </div>

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
        <span>Latent</span>
        <nav aria-label="Footer navigation">
          <Link href="/course">Courses</Link>
          <Link href="/open-learning">Open learning</Link>
          <Link href="/flashcards">Cards</Link>
          <Link href="/sources">Further reading</Link>
        </nav>
      </footer>
    </main>
  );
}
