import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "../components/ProjectStructureMap";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { LearningDataPanel } from "../components/LearningDataPanel";

export const metadata: Metadata = {
  title: "Project structure · Latent",
  description: "See which starter files you have completed and what is ready for the browser-chat build.",
};

export default function ProjectPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav><Link href="/courses/llm-systems">LLM Systems</Link><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link></nav>
      </header>
      <article className="project-page">
        <header className="project-page-hero">
          <h1>Project structure</h1>
          <p>See which lesson files are ready for the final browser build.</p>
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
