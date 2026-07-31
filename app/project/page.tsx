import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "@/app/components/ProjectStructureMap";
import { ProjectTimeline } from "@/app/components/ProjectTimeline";
import { LearningDataPanel } from "@/app/components/LearningDataPanel";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { LearnerHeader } from "@/app/components/LearnerHeader";

export const metadata: Metadata = {
  title: "Project structure · Build an LLM System",
  description: "Explore the Browser Chat project, run its current source, and see what is verified for a full build.",
};

export default function ProjectPage() {
  return (
    <>
      <LearnerHeader current="project" experience="llm-systems" />
      <main>
        <PageAtmosphere />
        <article className="project-page" id="main-content" tabIndex={-1}>
          <header className="project-page-hero">
            <h1>Project structure</h1>
            <p>Explore the files, run the current app, and see what is verified for a full build.</p>
            <nav className="project-hero-actions" aria-label="Project actions">
              <Link className="project-hero-link" href="/workspace">Open coding workspace →</Link>
              <Link className="project-hero-link" href="/capstone">Run Browser Chat →</Link>
            </nav>
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
    </>
  );
}
