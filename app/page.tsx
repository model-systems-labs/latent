import Link from "next/link";
import { courseTracks, getTrackLessons, llmSystemsCurriculum } from "./lessons/course";
import { FirstRunExperience } from "./components/FirstRunExperience";

export default function Home() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="node node-two" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><a href="#modules" aria-label="Modules"><span className="nav-label-full">Modules</span><span className="nav-label-short">Learn</span></a><Link href="/project">Project</Link><Link href="/workspace">IDE</Link><Link href="/capstone" aria-label="Capstone"><span className="nav-label-full">Capstone</span><span className="nav-label-short">Chat</span></Link><Link href="/sources">Sources</Link></nav></header>
      <article className="course-page full-course-page">
        <header className="course-hero full-course-hero">
          <p className="eyebrow">One course · four modules · {llmSystemsCurriculum.testCount} executable contracts</p>
          <h1>Build an LLM system in your browser.</h1>
          <p className="course-thesis">Implement the model foundations, inference runtime, serving boundary, and React integration that produce a working local chatbot.</p>
          <div className="hero-actions"><a href="#first-run">Run the first model</a><Link href="/courses/models">Start the course</Link></div>
        </header>
        <FirstRunExperience />
        <section className="course-track-grid" id="modules" aria-label="LLM Systems modules">
          {courseTracks.map((track) => {
            const lessons = getTrackLessons(track.id);
            return (
              <Link className="course-track-card" href={`/courses/${track.id}`} key={track.id}>
                <header><span>Module {String(track.number).padStart(2, "0")}</span><em>{lessons.length} lessons</em></header>
                <h2>{track.title}</h2>
                <p>{track.thesis}</p>
                <footer><span>{track.outcome}</span><strong>Explore module →</strong></footer>
              </Link>
            );
          })}
        </section>
        <section className="system-architecture">
          <header><span>Capstone architecture</span><strong>Every module contributes a tested layer.</strong></header>
          <div>
            <article><span>01</span><strong>React chat</strong><code>reducer · streaming UI · actions</code></article>
            <i>→</i>
            <article><span>02</span><strong>Serving</strong><code>SSE frames · abort · retries</code></article>
            <i>→</i>
            <article><span>03</span><strong>Runtime</strong><code>queue · worker · KV state</code></article>
            <i>→</i>
            <article><span>04</span><strong>Model</strong><code>trained RNN · local Transformer</code></article>
          </div>
        </section>
        <Link className="capstone-banner" href="/capstone"><div><span>Final project</span><h2>Browser Chat</h2><p>A functional streaming chatbot with a learner-trained model, a real local Transformer, a deterministic serving boundary, systems metrics, persistence, and accessible React interactions.</p></div><strong>Build and run →</strong></Link>
        <footer className="course-note"><p>Labs clearly distinguish live training, local inference, and bounded systems simulation.</p><Link href="/sources">Sources, datasets, and licenses →</Link></footer>
      </article>
    </main>
  );
}
