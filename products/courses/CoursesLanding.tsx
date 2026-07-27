import type { Metadata } from "next";
import Link from "next/link";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { coursePrograms } from "@/examples/learning-platform/llm-learning/lessons/course";
import styles from "@/products/courses/courses.module.css";

export const coursesMetadata: Metadata = {
  title: "Latent Courses · Learn LLM systems in your browser",
  description:
    "Four bundled, browser-native reference courses in linear algebra, machine learning, harness engineering, and LLM systems.",
};

const startingRoutes = [
  {
    label: "Start from scratch",
    title: "Build the foundations",
    body: "Begin with arrays and shapes, then learn data, loss, gradients, and small neural networks.",
    href: "/courses/linear-algebra",
  },
  {
    label: "I know Python and ML",
    title: "Start with model mechanics",
    body: "Build a character model, tokenization, attention, and Transformers before moving into serving.",
    href: "/lessons/character-rnns",
  },
  {
    label: "I build with LLMs",
    title: "Go straight to systems",
    body: "Study inference, scheduling, streaming, reliability, state, and product behavior.",
    href: "/courses/llm-systems#fast-tracks",
  },
] as const;

const projectStages = [
  { number: "01", title: "Model", body: "Tokens, recurrence, attention, and Transformers." },
  { number: "02", title: "Runtime", body: "Prefill, KV caches, scheduling, and decode." },
  { number: "03", title: "Serving", body: "Streaming transport, retries, and observability." },
  { number: "04", title: "Product", body: "Conversation state, React streaming, and quality." },
] as const;

const programKinds = {
  foundation: "Foundation course",
  applied: "Applied course",
  project: "Project course",
} as const;

export function CoursesLanding() {
  return (
    <main className={styles.page}>
      <PageAtmosphere />
      <LearnerHeader current="courses" />

      <article className={styles.shell} id="main-content" tabIndex={-1}>
        <section className={styles.hero}>
          <span className="eyebrow">Bundled reference courses · run in your browser</span>
          <h1>Learn how language-model systems actually work.</h1>
          <p>
            Start with the math and machine-learning foundations, study the
            software around reliable agents, or build a complete LLM system
            from model mechanics through a streaming React chatbot. Every
            exercise runs in your browser, and your work stays on this device.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/course#starting-point">
              Choose a course <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.secondaryAction} href="/courses/llm-systems">
              Open LLM Systems
            </Link>
          </div>
          <p className={styles.productNote}>
            These are Latent&apos;s bundled reference courses—not a shared
            catalog of courses other publishers make.{" "}
            <Link href="/framework">
              Use Latent Framework to publish a course you own.
            </Link>
          </p>
        </section>

        <section className={styles.startingPoint} aria-labelledby="starting-title">
          <header>
            <span className="eyebrow">Choose where to start</span>
            <h2 id="starting-title">Match the course to what you already know.</h2>
          </header>
          <ol>
            {startingRoutes.map((route, index) => (
              <li key={route.title}>
                <Link href={route.href}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <small>{route.label}</small>
                  <h3>{route.title}</h3>
                  <p>{route.body}</p>
                  <strong aria-hidden="true">→</strong>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.programs} aria-labelledby="programs-title">
          <header>
            <span className="eyebrow">Four courses · different entry points</span>
            <h2 id="programs-title">Learn the layer you need next.</h2>
          </header>
          <div className={styles.programGrid}>
            {coursePrograms.map((program) => (
              <article className={styles.programCard} key={program.id}>
                <span>{programKinds[program.kind]}</span>
                <em>{program.lessons.length} lessons</em>
                <h3><Link href={program.href}>{program.title}</Link></h3>
                <p>{program.thesis}</p>
                <dl>
                  <div><dt>Best for</dt><dd>{program.audience.description}</dd></div>
                  <div><dt>Outcome</dt><dd>{program.outcome}</dd></div>
                </dl>
                <Link href={program.href}>Open course →</Link>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.project} aria-labelledby="project-title">
          <header>
            <span className="eyebrow">Featured project · LLM Systems</span>
            <h2 id="project-title">Build Browser Chat, one tested file at a time.</h2>
            <p>
              Fourteen lessons accumulate into one saved browser project. The
              capstone connects the model, runtime, transport, and product
              layers without requiring an API key.
            </p>
          </header>
          <ol aria-label="LLM Systems project stages">
            {projectStages.map((stage) => (
              <li key={stage.title}>
                <span>{stage.number}</span>
                <strong>{stage.title}</strong>
                <p>{stage.body}</p>
              </li>
            ))}
          </ol>
          <Link href="/courses/llm-systems">See the complete project course →</Link>
        </section>

        <section className={styles.study} aria-labelledby="study-title">
          <header>
            <span className="eyebrow">Practice beyond the lessons</span>
            <h2 id="study-title">Retrieve it. Run it. Read deeper.</h2>
          </header>
          <nav aria-label="Study tools">
            <Link href="/practice">
              <strong>Method practice</strong>
              <span>Work original programming questions in a focused browser IDE.</span>
            </Link>
            <Link href="/flashcards">
              <strong>Flash cards</strong>
              <span>Review 638 concept cards and revisit what still needs work.</span>
            </Link>
            <Link href="/sources">
              <strong>Further reading</strong>
              <span>Trace lessons back to papers, specifications, datasets, and guides.</span>
            </Link>
          </nav>
        </section>

        <section className={styles.local} aria-labelledby="local-title">
          <span className="eyebrow">Local by default</span>
          <h2 id="local-title">Your work stays with you.</h2>
          <p>
            No install or API key is required. Exercises, code, and progress
            are saved only in this browser on this device; Latent Courses does
            not sync them to an account. The optional pretrained model
            downloads only when you choose to load it.
          </p>
        </section>
      </article>

      <footer className={styles.footer}>
        <span>Latent Courses</span>
        <p>
          These are Latent&apos;s bundled reference courses. To publish your
          own, use <Link href="/framework">Latent Framework</Link> to build a
          portable Learning Pack and host it at a URL you control.
        </p>
      </footer>
    </main>
  );
}
