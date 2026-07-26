"use client";

import Link from "next/link";
import { PageAtmosphere } from "../../app/components/PageAtmosphere";
import styles from "./framework.module.css";

const platformFlow = [
  {
    number: "01",
    title: "Author",
    detail: "Portable content or reviewed application source",
  },
  {
    number: "02",
    title: "Validate",
    detail: "Schemas, quality checks, tests, and deterministic builds",
  },
  {
    number: "03",
    title: "Publish",
    detail: "A static site on infrastructure you control",
  },
  {
    number: "04",
    title: "Learn",
    detail: "Browser-native lessons with device-local progress",
  },
] as const;

const repositoryFiles = [
  "packages/course-kit/",
  "packages/browser-lab/",
  "products/framework/",
  "products/courses/",
  "skills/author-course/",
  "examples/open-learning/",
  "app/  # shared route composition",
] as const;

export function FrameworkLanding() {
  return (
    <main className={styles.page}>
      <PageAtmosphere />

      <header className={`site-header course-header ${styles.header}`}>
        <Link className="wordmark" href="/framework"><i />latent <small>framework</small></Link>
        <nav aria-label="Primary navigation">
          <Link className={styles.headerLink} href="/open-learning">Open learning</Link>
          <Link className={styles.headerLink} href="/course">Reference courses</Link>
          <a
            className={styles.headerLink}
            href="https://github.com/model-systems-labs/latent"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </header>

      <article className={styles.shell}>
        <section className={styles.hero}>
          <span className="eyebrow">Open source · agent-friendly · host it yourself</span>
          <h1>Build a learning platform you own.</h1>
          <p>
            Latent is an open-source framework for browser-native courses, coding
            lessons, flash cards, and programming practice. Its public contracts
            keep portable course content separate from the trusted application
            code that renders and runs it.
          </p>
          <div className={styles.actions}>
            <a
              className={styles.primaryAction}
              href="https://github.com/model-systems-labs/latent"
              rel="noreferrer"
              target="_blank"
            >
              View the framework source <span aria-hidden="true">↗</span>
            </a>
            <Link className={styles.secondaryAction} href="/open-learning">
              Publish portable content
            </Link>
          </div>
        </section>

        <section className={styles.argument} aria-labelledby="boundary-title">
          <span className="eyebrow">Two products, one explicit boundary</span>
          <h2 id="boundary-title">The platform is not the course library.</h2>
          <p>
            This monorepo currently contains the framework and the Latent Courses
            learner product behind separate product surfaces. They still share
            reviewed runtimes, route composition, and release history today; the
            folder boundary is the intended starting point for a later repository
            split, not a claim that it has already happened.
          </p>
          <div className={styles.boundaryGrid}>
            <article className={styles.boundaryCard}>
              <span>Framework</span>
              <h3>Build and publish a platform</h3>
              <p>
                Fork the source, extend trusted runtime adapters, or publish
                declarative Learning Packs with Course Kit.
              </p>
              <Link href="/open-learning">Open the publishing tools →</Link>
            </article>
            <article className={styles.boundaryCard}>
              <span>Reference content</span>
              <h3>Inspect courses built with Latent</h3>
              <p>
                The bundled math, machine-learning, harness, and LLM courses show
                what one instance can look like. They are examples, not the
                platform’s identity.
              </p>
              <Link href="/course">Browse the reference courses →</Link>
            </article>
          </div>
        </section>

        <section className={styles.argument} aria-labelledby="flow-title">
          <h2 id="flow-title">A visible path from source to learner.</h2>
          <p>
            Agents help at authoring and build time. The learner runtime never
            makes a hidden model call and never executes code supplied by a
            remote course pack.
          </p>
          <figure className={styles.architecture} aria-labelledby="pipeline-title">
            <figcaption className={styles.architectureCaption}>
              <div>
                <strong id="pipeline-title">Platform pipeline</strong>
                <span>Source-controlled behavior · portable content</span>
              </div>
              <p>
                Trusted application code and untrusted course data meet only
                through versioned, validated contracts.
              </p>
            </figcaption>
            <ol className={styles.platformFlow} aria-label="Platform publishing pipeline">
              {platformFlow.map((stage) => (
                <li key={stage.title}>
                  <span>{stage.number}</span>
                  <strong>{stage.title}</strong>
                  <p>{stage.detail}</p>
                </li>
              ))}
            </ol>
          </figure>
        </section>

        <section className={styles.argument} aria-labelledby="repository-title">
          <h2 id="repository-title">The code is organized around those boundaries.</h2>
          <p>
            Leaf packages own portable schemas, browser runtimes, and persistence
            contracts. The application composes them. Course packs remain bounded
            data and can be hosted without this repository or a central directory.
          </p>
          <div className={styles.projectTree} role="group" aria-label="Framework repository structure">
            <span>latent/</span>
            {repositoryFiles.map((file, index) => (
              <code key={file}>
                <i aria-hidden="true">{index === repositoryFiles.length - 1 ? "└──" : "├──"}</i>
                {file}
              </code>
            ))}
          </div>
        </section>
      </article>

      <footer className={styles.footer}>
        <span>Latent framework</span>
        <nav aria-label="Footer navigation">
          <Link href="/open-learning">Open learning</Link>
          <Link href="/open-learning/guide.md">Format guide</Link>
          <Link href="/course">Reference courses</Link>
          <a href="https://github.com/model-systems-labs/latent" rel="noreferrer" target="_blank">
            GitHub
          </a>
        </nav>
      </footer>
    </main>
  );
}
