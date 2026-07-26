import type { Metadata } from "next";
import Link from "next/link";
import { LearnerHeader } from "../components/LearnerHeader";
import { coursePrograms, type CourseProgram } from "../../examples/learning-platform/llm-learning/lessons/course";
import { PageAtmosphere } from "../components/PageAtmosphere";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Courses · Latent Courses",
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
    <article className="course-track-card catalog-program-card">
      <header><span>{label}</span><em>{lessonCount}</em></header>
      <h2><Link href={program.href}>{program.title}</Link></h2>
      <p>{program.thesis}</p>
      <details className={`${styles.programDetails} calm-disclosure`}>
        <summary>Fit, prerequisites, and outcome</summary>
        <dl>
          <div><dt className="eyebrow">Best for</dt><dd>{program.audience.description}</dd></div>
          <div><dt className="eyebrow">Before you start</dt><dd>{program.prerequisite.description}</dd></div>
          <div><dt className="eyebrow">Outcome</dt><dd>{program.outcome}</dd></div>
        </dl>
      </details>
      <footer>
        <span><b>{program.runtime.language}</b> · {program.runtime.environment}. {program.runtime.persistence}</span>
        <Link href={program.href}><strong>Open course →</strong></Link>
      </footer>
    </article>
  );
}

export default function CourseCatalogPage() {
  const foundations = coursePrograms.filter((program) => program.kind === "foundation");
  const appliedPrograms = coursePrograms.filter((program) => program.kind === "applied");
  const projectCourse = coursePrograms.find((program) => program.kind === "project")!;
  return (
    <main>
      <PageAtmosphere />
      <LearnerHeader current="courses" />
      <article className={`course-page ${styles.catalogPage}`}>
        <header className={`course-hero ${styles.catalogHero}`}>
          <h1>Courses</h1>
          <p className="course-thesis">These are Latent&apos;s four bundled reference courses. Pick the starting point that matches what you already know. The foundation courses are optional refreshers, Harness Engineering stands on its own, and the LLM Systems course builds one cumulative browser project.</p>
        </header>
        <section className={styles.startingPoint} id="starting-point" aria-labelledby="starting-point-title">
          <header>
            <span className="eyebrow">Choose by experience</span>
          </header>
          <h2 id="starting-point-title">Where should I start?</h2>
          <p className="course-thesis">You do not have to finish every course in order. Pick the route that feels closest to you.</p>
          <nav aria-label="Starting points">
            <ol className={styles.startingRoutes}>
              {startingRoutes.map((route, index) => (
                <li key={route.title}>
                  <Link className={styles.startingRoute} href={route.href}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><small>{route.eyebrow}</small><h3>{route.title}</h3><p>{route.description}</p></div>
                    <strong aria-label={route.action}>→</strong>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
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
        <Link className={styles.reviewCallout} href="/flashcards">
          <div>
            <span>Review library</span>
            <h2>Make the ideas stick.</h2>
            <p>Filter by subject, search any concept, then mark each card Got it or Needs work. Your progress stays on this device.</p>
          </div>
          <strong>Study flash cards <span aria-hidden="true">→</span></strong>
        </Link>
        <Link className={styles.reviewCallout} href="/practice">
          <div>
            <span>Method practice</span>
            <h2>Work the problem, then check the code.</h2>
            <p>Practice original interview-style questions in the browser. Drafts and solved status stay on this device.</p>
          </div>
          <strong>Open practice <span aria-hidden="true">→</span></strong>
        </Link>
      </article>
    </main>
  );
}
