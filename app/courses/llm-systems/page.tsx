import type { Metadata } from "next";
import Link from "next/link";
import { courseTracks, llmSystemsCurriculum } from "../../lessons/course";
import { FirstRunExperience } from "../../components/FirstRunExperience";
import { PageAtmosphere } from "../../components/PageAtmosphere";

export const metadata: Metadata = {
  title: "Build an LLM System in Your Browser · Latent",
  description: "Build model foundations, an inference runtime, LLM serving, and a React chat application as one browser project.",
};

export default function LlmSystemsCoursePage() {
  return (
    <main>
      <PageAtmosphere />
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/course">All courses</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link><Link href="/sources">Sources</Link></nav></header>
      <article className="course-page full-course-page">
        <header className="course-hero full-course-hero home-course-hero">
          <p className="eyebrow">Project course · {llmSystemsCurriculum.lessonCount} lessons · 4 modules</p>
          <h1>{llmSystemsCurriculum.title}</h1>
          <p className="course-thesis">Build the model, runtime, serving layer, and React application that come together as one working local chatbot.</p>
        </header>
        <FirstRunExperience />
        <section className="course-track-grid" id="modules" aria-label="LLM Systems modules">
          {courseTracks.map((track) => (
            <Link className="course-track-card catalog-track-card" href={`/courses/llm-systems/${track.id}`} key={track.id}>
              <h2>{track.title}</h2>
              <p>{track.thesis}</p>
            </Link>
          ))}
        </section>
        <Link className="catalog-capstone-link" href="/capstone"><div><h2>Browser Chat</h2><p>Combine the model, runtime, streaming transport, and React client into one local chatbot.</p></div><span aria-hidden="true">→</span></Link>
      </article>
    </main>
  );
}
