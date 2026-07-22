import type { Metadata } from "next";
import Link from "next/link";
import { coursePrograms, courseTracks, llmSystemsCurriculum } from "../../lessons/course";
import { CourseGuide } from "../../components/CourseGuide";
import { CourseResume } from "../../components/CourseResume";
import { PageAtmosphere } from "../../components/PageAtmosphere";

export const metadata: Metadata = {
  title: "Build an LLM System in Your Browser · Latent",
  description: "Build model foundations, an inference runtime, LLM serving, and a React chat application as one browser project.",
};

export default function LlmSystemsCoursePage() {
  const program = coursePrograms.find((candidate) => candidate.id === "llm-systems")!;
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
        <CourseResume />
        <CourseGuide
          program={program}
          title="Build the whole path, or jump to the part you need"
          primaryLink={{ href: "/lessons/character-rnns", label: "Start with Character RNNs" }}
          quickLinks={{
            id: "fast-tracks",
            label: "Already comfortable with the model basics?",
            description: "You can open any lesson directly and return to earlier material when you need a refresher. The complete Browser Chat build still requires the full project.",
            links: [
              { href: "/lessons/transformers", label: "Transformer mechanics" },
              { href: "/lessons/inference-runtime", label: "Inference runtime" },
              { href: "/lessons/reliability-observability", label: "Serving reliability" },
            ],
          }}
        />
        <section className="course-track-grid" id="modules" aria-label="LLM Systems modules">
          {courseTracks.map((track) => (
            <Link className="course-track-card catalog-track-card" href={`/courses/llm-systems/${track.id}`} key={track.id}>
              <header><span>Module {String(track.number).padStart(2, "0")}</span><em>{track.lessonIds.length} {track.lessonIds.length === 1 ? "lesson" : "lessons"}</em></header>
              <h2>{track.title}</h2>
              <p>{track.thesis}</p>
              <div className="catalog-track-outcome" style={{ borderTop: "1px solid var(--line)", marginTop: "1.1rem", padding: "1rem 0" }}><span className="eyebrow">Outcome</span><p style={{ color: "var(--muted)", fontSize: "max(0.7rem, 12px)", lineHeight: 1.55, margin: 0 }}>{track.outcome}</p></div>
              <footer><span>Lesson code is saved in the cumulative Browser Chat project.</span><strong>Open module →</strong></footer>
            </Link>
          ))}
        </section>
        <Link className="catalog-capstone-link" href="/capstone"><div><h2>Browser Chat</h2><p>Combine the model, runtime, streaming transport, and React client into one local chatbot.</p></div><span aria-hidden="true">→</span></Link>
      </article>
    </main>
  );
}
