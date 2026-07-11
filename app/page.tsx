import { courseLessons } from "./lessons/course";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true">
        <span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" />
        <span className="node node-one" /><span className="node node-two" /><span className="warm-star" />
      </div>
      <header className="site-header course-header">
        <Link className="wordmark" href="/" aria-label="Latent course home"><i />latent</Link>
        <span>LLM fundamentals · six paper labs</span>
      </header>
      <article className="course-page">
        <header className="course-hero">
          <p className="eyebrow">Browser course · JavaScript · local models</p>
          <h1>Language model fundamentals.</h1>
          <p>Read the source, question its claims, implement the mechanism, and produce an executable artifact.</p>
        </header>
        <section className="curriculum-list" aria-label="Course lessons">
          {courseLessons.map((lesson) => (
            <Link className="lesson-card" href={`/papers/${lesson.id}`} key={lesson.id}>
              <span>{String(lesson.number).padStart(2, "0")}</span>
              <div><h2>{lesson.title}</h2><p>{lesson.paperTitle}</p></div>
              <div className="lesson-build"><em>{lesson.modeLabel}</em><strong>{lesson.experiment.title}</strong></div>
              <i>Open →</i>
            </Link>
          ))}
        </section>
        <footer className="course-note">
          <span>Execution contract</span>
          <p>Lessons distinguish live micro-training, exact core mechanisms, and real local inference. Supplied datasets are fixed and license-safe.</p>
        </footer>
      </article>
    </main>
  );
}
