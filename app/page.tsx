import Link from "next/link";
import { courseTracks } from "./lessons/course";
import { FirstRunExperience } from "./components/FirstRunExperience";

export default function Home() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><a href="#modules" aria-label="Modules"><span className="nav-label-full">Modules</span><span className="nav-label-short">Learn</span></a><Link href="/project">Project</Link><Link href="/workspace">IDE</Link><Link href="/capstone" aria-label="Capstone"><span className="nav-label-full">Capstone</span><span className="nav-label-short">Chat</span></Link><Link href="/sources">Sources</Link></nav></header>
      <article className="course-page full-course-page">
        <header className="course-hero full-course-hero home-course-hero">
          <h1>Build an LLM system right in your browser.</h1>
          <p className="course-thesis">Build the model basics, inference runtime, serving layer, and React app that come together as a working local chatbot.</p>
          <div className="hero-actions"><a href="#first-run">Run the first model</a></div>
        </header>
        <FirstRunExperience />
        <section className="course-track-grid" id="modules" aria-label="LLM Systems modules">
          {courseTracks.map((track) => (
            <Link className="course-track-card catalog-track-card" href={`/courses/${track.id}`} key={track.id}>
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
