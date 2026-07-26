import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "../components/ProjectStructureMap";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { LearningDataPanel } from "../components/LearningDataPanel";
import { PageAtmosphere } from "../components/PageAtmosphere";

export const metadata: Metadata = {
  title: "Project structure · Latent Courses",
  description: "See which starter files you have completed and what is ready for the browser-chat build.",
};

export default function ProjectPage() {
  return (
    <main>
      <PageAtmosphere />
      <header className="site-header course-header">
        <Link className="wordmark" href="/" aria-label="Latent Courses home"><i />latent courses</Link>
        <nav><Link href="/courses/llm-systems">LLM Systems</Link><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link></nav>
      </header>
      <article className="project-page">
        <header className="project-page-hero">
          <h1>Project structure</h1>
          <p>See which lesson files are ready for the final browser build.</p>
          <Link className="project-hero-link" href="/workspace">Open coding workspace →</Link>
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
