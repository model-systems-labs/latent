import Link from "next/link";
import { courseTracks, getTrackLessons } from "./lessons/course";

export default function Home() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="node node-two" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><a href="#courses">Courses</a><Link href="/workspace">IDE</Link><Link href="/capstone">Capstone</Link></nav><span>Model · Runtime · Backend · React</span></header>
      <article className="course-page full-course-page">
        <header className="course-hero full-course-hero">
          <p className="eyebrow">Four courses · fourteen technical labs · one complete system</p>
          <h1>Build an LLM chat system.</h1>
          <p>Train the model, implement the LLM runtime, test it behind a mock backend, and ship the React product—all in the browser.</p>
          <div className="hero-actions"><Link href="/courses/models">Start with the model</Link><Link href="/capstone">Open the capstone</Link></div>
        </header>
        <section className="course-track-grid" id="courses">
          {courseTracks.map((track) => {
            const lessons = getTrackLessons(track.id);
            return (
              <Link className="course-track-card" href={`/courses/${track.id}`} key={track.id}>
                <header><span>Course {String(track.number).padStart(2, "0")}</span><em>{lessons.length} lessons</em></header>
                <h2>{track.title}</h2>
                <p>{track.thesis}</p>
                <ol>{lessons.map((lesson) => <li key={lesson.id}>{lesson.title}</li>)}</ol>
                <footer><span>{track.outcome}</span><strong>View course →</strong></footer>
              </Link>
            );
          })}
        </section>
        <section className="system-architecture">
          <header><span>Capstone architecture</span><strong>Every course contributes a working layer.</strong></header>
          <div>
            <article><span>01</span><strong>React chat</strong><code>reducer · streaming UI · actions</code></article>
            <i>→</i>
            <article><span>02</span><strong>Transport</strong><code>SSE frames · abort · retries</code></article>
            <i>→</i>
            <article><span>03</span><strong>Runtime</strong><code>queue · worker · KV state</code></article>
            <i>→</i>
            <article><span>04</span><strong>Model</strong><code>trained RNN · local Transformer</code></article>
          </div>
        </section>
        <Link className="capstone-banner" href="/capstone"><div><span>Final project</span><h2>Browser Chat</h2><p>A functional streaming chatbot with two real model paths, an SSE-compatible transport, systems metrics, persistence, and accessible React interactions.</p></div><strong>Build and run →</strong></Link>
        <footer className="course-note"><span>Execution contract</span><p>Labs distinguish live training, exact algorithms, local inference, and bounded systems simulation. The learner-trained model is small and real; the chat-quality model is pretrained and genuinely runs locally.</p></footer>
      </article>
    </main>
  );
}
