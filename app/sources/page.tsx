import type { Metadata } from "next";
import Link from "next/link";
import { courseLessons } from "../lessons/course";

export const metadata: Metadata = {
  title: "Sources and licenses · Latent",
  description: "Paper links, dataset provenance, model licensing, and open-source runtime notices for the Latent LLM Systems course.",
};

const runtimeNotices = [
  { name: "SmolLM2-135M-Instruct", version: "upstream model", license: "Apache-2.0", url: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct", use: "The optional local pretrained Transformer used for browser inference." },
  { name: "SmolLM2-135M-Instruct-ONNX", version: "ONNX conversion", license: "upstream Apache-2.0 model", url: "https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX", use: "Quantized browser-compatible weights downloaded only after learner action." },
  { name: "Transformers.js", version: "3.8.1", license: "Apache-2.0", url: "https://github.com/huggingface/transformers.js", use: "WebGPU and WASM model loading and inference." },
  { name: "React + React DOM", version: "19.2.6", license: "MIT", url: "https://github.com/facebook/react", use: "Course and capstone interface runtime." },
  { name: "Dexie", version: "4.4.4", license: "Apache-2.0", url: "https://github.com/dexie/Dexie.js", use: "Device-local IndexedDB persistence." },
  { name: "CodeMirror", version: "6.0.2", license: "MIT", url: "https://github.com/codemirror/dev", use: "Browser project editor." },
  { name: "CodeMirror Python language", version: "6.2.1", license: "MIT", url: "https://github.com/codemirror/lang-python", use: "Python syntax parsing and highlighting in the browser IDE." },
  { name: "Pyodide", version: "314.0.2", license: "MPL-2.0", url: "https://github.com/pyodide/pyodide", use: "CPython and its standard library compiled to WebAssembly for opt-in browser execution." },
  { name: "NumPy", version: "2.4.3", license: "BSD-3-Clause", url: "https://github.com/numpy/numpy", use: "The curated numerical array package used by local Python model labs." },
  { name: "esbuild-wasm", version: "0.28.1", license: "MIT", url: "https://github.com/evanw/esbuild", use: "Virtual TypeScript and JavaScript compilation." },
  { name: "QuickJS Emscripten", version: "0.32.0", license: "MIT", url: "https://github.com/justjake/quickjs-emscripten", use: "Bounded learner-code execution outside the application realm." },
  { name: "Mock Service Worker", version: "2.15.0", license: "MIT", url: "https://github.com/mswjs/msw", use: "Deterministic mock service and request behavior." },
] as const;

export default function SourcesPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/">Course</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav></header>
      <article className="sources-page">
        <header className="sources-hero"><p className="eyebrow">Provenance and reuse</p><h1>Sources and licenses</h1><p>Latent links to original research and specifications, supplies small course-authored datasets, and runs explicitly identified open-source software and model weights.</p></header>

        <section className="source-policy">
          <span>Content boundary</span>
          <div><strong>Research remains with its authors.</strong><p>The course links to papers and documentation; it does not redistribute their full text. Lesson explanations, diagrams, exercises, deterministic scenarios, and supplied CC0 toy datasets are authored for Latent.</p></div>
          <div><strong>Implementations are educational.</strong><p>Browser experiments reproduce bounded mechanisms and state their limits. They are not represented as official author implementations or production benchmark reproductions.</p></div>
        </section>

        <section className="runtime-notices" aria-labelledby="runtime-notices-title">
          <header><span>Runtime notices</span><h2 id="runtime-notices-title">Models and open-source software</h2></header>
          <div>
            {runtimeNotices.map((notice) => <a href={notice.url} target="_blank" rel="noreferrer" key={notice.name}><span><strong>{notice.name}</strong><em>{notice.version}</em></span><p>{notice.use}</p><code>{notice.license} ↗</code></a>)}
          </div>
          <p className="license-note">This index is a practical attribution record, not legal advice. The linked license and model-card text controls if a summary here ever differs.</p>
        </section>

        <section className="lesson-source-index" aria-labelledby="lesson-source-index-title">
          <header><span>Course bibliography</span><h2 id="lesson-source-index-title">Lesson sources and supplied data</h2></header>
          {courseLessons.map((lesson) => (
            <article key={lesson.id}>
              <header><span>{String(lesson.number).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><code>{lesson.dataset.name} · {lesson.dataset.license}</code></div></header>
              <ul>{lesson.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><em>{source.authors} · {source.year}</em></span><p>{source.relevance}</p><i>↗</i></a></li>)}</ul>
              <footer><span>Dataset source</span><p>{lesson.dataset.source}</p><code>{lesson.dataset.size}</code></footer>
            </article>
          ))}
        </section>
      </article>
    </main>
  );
}
