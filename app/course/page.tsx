import type { Metadata } from "next";
import Link from "next/link";
import { coursePrograms } from "../lessons/course";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Courses · Latent",
  description: "Begin with linear algebra or machine-learning basics, then build a complete browser-based LLM system.",
};

export default function CourseCatalogPage() {
  const foundations = coursePrograms.filter((program) => program.kind === "foundation");
  const projectCourse = coursePrograms.find((program) => program.kind === "project")!;
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/course">Courses</Link><Link href="/flashcards" aria-label="Flash cards">Cards</Link><Link href="/sources">Sources</Link></nav></header>
      <article className={`course-page ${styles.catalogPage}`}>
        <header className={`course-hero ${styles.catalogHero}`}>
          <h1>Courses</h1>
          <p className="course-thesis">Linear algebra and machine learning are short, independent foundations courses. Building an LLM system is a separate project course that continues through inference, serving, and React.</p>
        </header>
        <Link className={styles.reviewCallout} href="/flashcards">
          <div>
            <span>Review library</span>
            <h2>Make the ideas stick.</h2>
            <p>Filter by subject, search any concept, and mark success or failure. Your progress stays on this device.</p>
          </div>
          <strong>Study flash cards <span aria-hidden="true">→</span></strong>
        </Link>
        <section className={styles.programGroup} aria-labelledby="foundations-title">
          <header><strong id="foundations-title">Foundations</strong><p>Two standalone courses with small NumPy exercises.</p></header>
          <div className="course-track-grid">
            {foundations.map((program) => (
              <Link className="course-track-card catalog-program-card" href={program.href} key={program.id}>
                <header><span>Standalone course</span><em>{program.lessons.length} lessons</em></header>
                <h2>{program.title}</h2>
                <p>{program.thesis}</p>
                <footer><span>Exercises and progress are saved within this course.</span><strong>Open course →</strong></footer>
              </Link>
            ))}
          </div>
        </section>
        <section className={styles.programGroup} aria-labelledby="project-course-title">
          <header><strong id="project-course-title">LLM systems project</strong><p>One cumulative course whose lesson files form a working browser chatbot.</p></header>
          <div className="course-track-grid">
            <Link className="course-track-card catalog-program-card" href={projectCourse.href}>
              <header><span>Project course</span><em>{projectCourse.lessons.length} lessons · 4 modules</em></header>
              <h2>{projectCourse.title}</h2>
              <p>{projectCourse.thesis}</p>
              <footer><span>Lesson files accumulate into the Browser Chat capstone.</span><strong>Open course →</strong></footer>
            </Link>
          </div>
        </section>
        <p className={styles.sequenceNote}>Suggested order: Linear Algebra Basics → Machine Learning Basics → Build an LLM System in Your Browser. You can also open any course directly.</p>
      </article>
    </main>
  );
}
