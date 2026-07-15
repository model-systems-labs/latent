import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "../components/ProjectStructureMap";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { LearningDataPanel } from "../components/LearningDataPanel";

export const metadata: Metadata = {
  title: "Project structure · Latent",
  description: "See the current checks and past snapshots for the browser-chat project.",
};

export default function ProjectPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav><Link href="/">Course</Link><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link></nav>
      </header>
      <article className="project-page">
        <header className="project-page-hero">
          <h1>Project structure</h1>
          <p>The files you work on across the course become one browser-chat project.</p>
          <Link className="project-hero-link" href="/workspace">Open in IDE →</Link>
        </header>
        <ProjectStructureMap />
        <details className="project-history-disclosure">
          <summary>History and privacy</summary>
          <div className="project-history-body">
            <ProjectTimeline />
            <LearningDataPanel />
          </div>
        </details>
      </article>
    </main>
  );
}
