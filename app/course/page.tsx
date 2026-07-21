import type { Metadata } from "next";
import Link from "next/link";
import { coursePrograms, type CourseProgram } from "../lessons/course";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Courses · Latent",
  description: "Choose the right starting point for mathematical foundations, machine learning, agent harnesses, or the browser-based LLM systems project.",
};

const startingRoutes = [
  {
    eyebrow: "Start from scratch",
    title: "I’m new to machine learning",
    description: "Begin with arrays and shapes, then move into data, loss, gradients, and small neural networks.",
    href: "/courses/linear-algebra",
    action: "Start Linear Algebra",
  },
  {
    eyebrow: "Skip the refresher",
    title: "I know Python and ML basics",
    description: "If NumPy, loss, and gradients already make sense, start building the model path with Character RNNs.",
    href: "/lessons/character-rnns",
    action: "Start Character RNNs",
  },
  {
    eyebrow: "Go straight to systems",
    title: "I already build with LLMs",
    description: "Jump to Transformers, inference, or serving without completing the earlier lessons first.",
    href: "/courses/llm-systems#fast-tracks",
    action: "See advanced routes",
  },
] as const;

function ProgramCard({
  program,
  label,
  lessonCount,
}: {
  program: CourseProgram;
  label: string;
  lessonCount: string;
}) {
  return (
    <Link className="course-track-card catalog-program-card" href={program.href}>
      <header><span>{label}</span><em>{lessonCount}</em></header>
      <h2>{program.title}</h2>
      <p>{program.thesis}</p>
      <dl style={{ borderBlock: "1px solid var(--line)", display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))", margin: 0, padding: "0.9rem 0" }}>
        <div><dt className="eyebrow">Best for</dt><dd style={{ color: "var(--muted)", fontSize: "max(0.68rem, 11px)", lineHeight: 1.5, margin: 0 }}>{program.audience.description}</dd></div>
        <div><dt className="eyebrow">Before you start</dt><dd style={{ color: "var(--muted)", fontSize: "max(0.68rem, 11px)", lineHeight: 1.5, margin: 0 }}>{program.prerequisite.description}</dd></div>
        <div><dt className="eyebrow">Outcome</dt><dd style={{ color: "var(--muted)", fontSize: "max(0.68rem, 11px)", lineHeight: 1.5, margin: 0 }}>{program.outcome}</dd></div>
      </dl>
      <footer>
        <span><b>{program.runtime.language}</b> · {program.runtime.environment}. {program.runtime.persistence}</span>
        <strong>Open course →</strong>
      </footer>
    </Link>
  );
}

export default function CourseCatalogPage() {
  const foundations = coursePrograms.filter((program) => program.kind === "foundation");
  const appliedPrograms = coursePrograms.filter((program) => program.kind === "applied");
  const projectCourse = coursePrograms.find((program) => program.kind === "project")!;
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/course">Courses</Link><Link href="/flashcards" aria-label="Flash cards">Cards</Link><Link href="/sources">Sources</Link></nav></header>
      <article className={`course-page ${styles.catalogPage}`}>
        <header className={`course-hero ${styles.catalogHero}`}>
          <h1>Courses</h1>
          <p className="course-thesis">Pick the starting point that matches what you already know. The foundation courses are optional refreshers, Harness Engineering stands on its own, and the LLM Systems course builds one cumulative browser project.</p>
        </header>
        <section id="starting-point" aria-labelledby="starting-point-title" style={{ borderBlock: "1px solid var(--line-strong)", padding: "clamp(1.5rem, 3vw, 2.2rem) 0", scrollMarginTop: "1.5rem" }}>
          <header>
            <span className="eyebrow">Choose by experience</span>
          </header>
          <h2 id="starting-point-title" style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.45rem)", fontWeight: 400, letterSpacing: "-0.035em", lineHeight: 1.05, margin: 0 }}>Where should I start?</h2>
          <p className="course-thesis">You do not have to finish every course in order. Pick the route that feels closest to you.</p>
          <div className="course-track-grid" style={{ gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
            {startingRoutes.map((route) => (
              <Link className="course-track-card" href={route.href} key={route.title} style={{ borderTop: "1px solid var(--line)" }}>
                <header><span>{route.eyebrow}</span></header>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.35rem, 2.1vw, 1.7rem)", fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.08, margin: "1.1rem 0 0" }}>{route.title}</h3>
                <p>{route.description}</p>
                <footer><strong>{route.action} <span aria-hidden="true">→</span></strong></footer>
              </Link>
            ))}
          </div>
        </section>
        <section className={styles.programGroup} aria-labelledby="foundations-title">
          <header><strong id="foundations-title">Foundations</strong><p>Two standalone courses with small NumPy exercises.</p></header>
          <div className="course-track-grid">
            {foundations.map((program) => (
              <ProgramCard program={program} label="Standalone course" lessonCount={`${program.lessons.length} lessons`} key={program.id} />
            ))}
          </div>
        </section>
        <section className={styles.programGroup} aria-labelledby="agent-systems-title">
          <header><strong id="agent-systems-title">Agent systems</strong><p>A standalone course about the execution layer around a language model.</p></header>
          <div className="course-track-grid">
            {appliedPrograms.map((program) => (
              <ProgramCard program={program} label="Applied course" lessonCount={`${program.lessons.length} lessons`} key={program.id} />
            ))}
          </div>
        </section>
        <section className={styles.programGroup} aria-labelledby="project-course-title">
          <header><strong id="project-course-title">LLM systems project</strong><p>One cumulative course whose lesson files form a working browser chatbot.</p></header>
          <div className="course-track-grid">
            <ProgramCard program={projectCourse} label="Project course" lessonCount={`${projectCourse.lessons.length} lessons · 4 modules`} />
          </div>
        </section>
        <p className={styles.sequenceNote}>Linear algebra and machine learning prepare you for the LLM systems project. Harness Engineering is independent and studies agent execution around an existing model.</p>
        <Link className={styles.reviewCallout} href="/flashcards">
          <div>
            <span>Review library</span>
            <h2>Make the ideas stick.</h2>
            <p>Filter by subject, search any concept, then mark each card Got it or Needs work. Your progress stays on this device.</p>
          </div>
          <strong>Study flash cards <span aria-hidden="true">→</span></strong>
        </Link>
      </article>
    </main>
  );
}
