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
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="node node-two" /><span className="warm-star" /></div>
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav><Link href="/">Course</Link><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link></nav>
      </header>
      <article className="project-page">
        <header className="project-page-hero">
          <p className="eyebrow">A project saved on your device</p>
          <h1>Project structure</h1>
          <p>Each lesson has its own source file in the browser-chat project. You can see the whole file tree from the start, and every file shows whether its checks haven’t started, are partly done, failed, or passed.</p>
          <div className="hero-actions"><Link href="/workspace">Open the IDE</Link><Link href="/courses/models">Continue the course</Link></div>
        </header>
        <ProjectStructureMap />
        <details className="project-history-disclosure">
          <summary><span>More project details</span><strong>History and learning data</strong><em>Take a look</em></summary>
          <div className="project-history-body">
            <ProjectTimeline />
            <section className="project-structure-note">
              <span>How progress works</span>
              <p>Your current code, test results, and active build snapshots stay on this device. When you edit a lesson file, that file needs to pass its checks again. Editing any file also makes the latest full-project test result out of date. Other unchanged lesson results stay verified, and your last active build stays in place until a new full build passes.</p>
            </section>
            <LearningDataPanel />
          </div>
        </details>
      </article>
    </main>
  );
}
