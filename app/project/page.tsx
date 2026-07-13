import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStructureMap } from "../components/ProjectStructureMap";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { LearningDataPanel } from "../components/LearningDataPanel";

export const metadata: Metadata = {
  title: "Project structure · Latent",
  description: "See the browser-chat project fill in as each LLM systems lesson passes its behavioral checks.",
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
          <p>Every lesson owns a source file in one browser-chat repository. The complete tree is visible from the start; files move from pending to complete as their behavioral checks pass.</p>
          <div className="hero-actions"><Link href="/workspace">Open the IDE</Link><Link href="/courses/models">Continue the course</Link></div>
        </header>
        <ProjectStructureMap />
        <ProjectTimeline />
        <section className="project-structure-note">
          <span>Progress model</span>
          <p>Source, test results, and build artifacts are saved on this device. Lesson checks verify each file independently, so unfinished work never invalidates the files you have already completed.</p>
        </section>
        <LearningDataPanel />
      </article>
    </main>
  );
}
