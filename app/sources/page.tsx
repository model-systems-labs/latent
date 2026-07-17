import type { Metadata } from "next";
import Link from "next/link";
import { courseLessons } from "../lessons/course";

export const metadata: Metadata = {
  title: "Sources and licenses · Latent",
  description: "Paper links, where the data came from, model licenses, and open-source notices for the Latent LLM Systems course.",
};

const runtimeNotices = [
  { name: "SmolLM2-135M-Instruct", version: "upstream model", license: "Apache-2.0", url: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct", use: "The optional pretrained Transformer that runs locally in your browser." },
  { name: "SmolLM2-135M-Instruct-ONNX", version: "ONNX conversion", license: "upstream Apache-2.0 model", url: "https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX", use: "Smaller browser-ready weights that download only when you choose to load them." },
  { name: "Transformers.js", version: "3.8.1", license: "Apache-2.0", url: "https://github.com/huggingface/transformers.js", use: "Loads and runs the model with WebGPU or WASM." },
  { name: "React + React DOM", version: "19.2.6", license: "MIT", url: "https://github.com/facebook/react", use: "Runs the course and capstone interface." },
  { name: "Dexie", version: "4.4.4", license: "Apache-2.0", url: "https://github.com/dexie/Dexie.js", use: "Saves your work in IndexedDB on this device." },
  { name: "CodeMirror", version: "6.0.2", license: "MIT", url: "https://github.com/codemirror/dev", use: "Browser project editor." },
  { name: "CodeMirror Python language", version: "6.2.1", license: "MIT", url: "https://github.com/codemirror/lang-python", use: "Python syntax parsing and highlighting in the browser IDE." },
  { name: "Pyodide", version: "314.0.2", license: "MPL-2.0", url: "https://github.com/pyodide/pyodide", use: "Lets you run CPython and its standard library in the browser through WebAssembly when you choose to start it." },
  { name: "NumPy", version: "2.4.3", license: "BSD-3-Clause", url: "https://github.com/numpy/numpy", use: "Provides the array tools used in the browser Python model labs." },
  { name: "esbuild-wasm", version: "0.28.1", license: "MIT", url: "https://github.com/evanw/esbuild", use: "Virtual TypeScript and JavaScript compilation." },
  { name: "QuickJS Emscripten", version: "0.32.0", license: "MIT", url: "https://github.com/justjake/quickjs-emscripten", use: "Runs your code with strict limits outside the main app." },
  { name: "Mock Service Worker", version: "2.15.0", license: "MIT", url: "https://github.com/mswjs/msw", use: "Provides predictable mock services and requests." },
] as const;

export default function SourcesPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/course">Course</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav></header>
      <article className="sources-page">
        <header className="sources-hero"><h1>Sources</h1><p>Research, datasets, models, and software used by the course.</p></header>

        <p className="source-policy-note">Papers and specifications remain the work of their authors. Latent links to them and provides original explanations, diagrams, exercises, and small practice datasets.</p>

        <details className="runtime-notices">
          <summary id="runtime-notices-title">Models and open-source software</summary>
          <div>
            {runtimeNotices.map((notice) => <a href={notice.url} target="_blank" rel="noreferrer" aria-label={`${notice.name}, ${notice.version}, ${notice.license}; opens in a new tab`} key={notice.name}><span><strong>{notice.name}</strong><em>{notice.version}</em></span><code>{notice.license} ↗</code></a>)}
          </div>
        </details>

        <section className="lesson-source-index" aria-labelledby="lesson-source-index-title">
          <header><h2 id="lesson-source-index-title">Lesson sources</h2></header>
          {courseLessons.map((lesson) => (
            <article key={lesson.id}>
              <header><strong>{lesson.title}</strong><code>{lesson.dataset.name} · {lesson.dataset.source} · {lesson.dataset.license} · {lesson.dataset.size}</code></header>
              <ul>{lesson.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.title}, ${source.authors}, ${source.year}; opens in a new tab`}><span><strong>{source.title}</strong><em>{source.authors} · {source.year}</em></span><i aria-hidden="true">↗</i></a></li>)}</ul>
            </article>
          ))}
        </section>
      </article>
    </main>
  );
}
