import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "@/app/components/ProjectStructureMap";
import { ProjectTimeline } from "@/app/components/ProjectTimeline";
import { LearningDataPanel } from "@/app/components/LearningDataPanel";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { LearnerActionLink } from "@/app/components/LearnerActionLink";

export const metadata: Metadata = {
  title: "Project structure · Build an LLM System",
  description: "See which starter files you have completed and what is ready for the browser-chat build.",
};

export default function ProjectPage() {
  return (
    <main>
      <PageAtmosphere />
      <LearnerHeader current="courses" />
      <header className="site-header course-header" style={{ height: "auto", minHeight: "3.35rem" }}>
        <LearnerActionLink href="/courses/llm-systems">Course</LearnerActionLink>
        <nav aria-label="Project tools">
          <Link href="/workspace">Coding workspace</Link>
          <Link href="/capstone">Capstone</Link>
        </nav>
      </header>
      <article className="project-page" id="main-content" tabIndex={-1}>
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
