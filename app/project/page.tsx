import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "../components/ProjectStructureMap";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { LearningDataPanel } from "../components/LearningDataPanel";

export const metadata: Metadata = {
  title: "Project structure · Latent",
  description: "Inspect current source verification and historical repository snapshots for the browser-chat project.",
};

export default function ProjectPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="node node-two" /><span className="warm-star" /></div>
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav><Link href="/">Course</Link><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link></nav>
      </header>
      <article className="project-page">
        <header className="project-page-hero">
          <p className="eyebrow">Device-local project</p>
          <h1>Project structure</h1>
          <p>Every lesson owns a source file in one browser-chat repository. The complete tree is visible from the start; each file reports whether its behavioral checks are not started, partial, failed, or verified.</p>
          <div className="hero-actions"><Link href="/workspace">Open the IDE</Link><Link href="/courses/models">Continue the course</Link></div>
        </header>
        <ProjectStructureMap />
        <details className="project-history-disclosure">
          <summary><span>Secondary project views</span><strong>History and learning data</strong><em>Inspect</em></summary>
          <div className="project-history-body">
            <ProjectTimeline />
            <section className="project-structure-note">
              <span>Progress model</span>
              <p>Current workspace source, test results, and active build snapshots are saved on this device. Editing a lesson source clears that file’s check verification; editing any file invalidates the current full-project test receipt. Other exact saved lesson proofs remain verified, while the last active build snapshot stays unchanged until a new full build passes.</p>
            </section>
            <LearningDataPanel />
          </div>
        </details>
      </article>
    </main>
  );
}
