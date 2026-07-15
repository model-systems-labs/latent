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
  { name: "NumPy", version: "2.4.3", license: "BSD-3-Clause", url: "https://github.com/numpy/numpy", use: "Provides the array tools used in the local Python model labs." },
  { name: "PyTorch", version: "2.9.0 native track", license: "BSD-3-Clause", url: "https://github.com/pytorch/pytorch", use: "Powers the real nn.Module, autograd, optimizer, and export code in the downloadable notebooks and completed portfolio. It isn’t bundled with Pyodide." },
  { name: "esbuild-wasm", version: "0.28.1", license: "MIT", url: "https://github.com/evanw/esbuild", use: "Virtual TypeScript and JavaScript compilation." },
  { name: "QuickJS Emscripten", version: "0.32.0", license: "MIT", url: "https://github.com/justjake/quickjs-emscripten", use: "Runs your code with strict limits outside the main app." },
  { name: "Mock Service Worker", version: "2.15.0", license: "MIT", url: "https://github.com/mswjs/msw", use: "Provides predictable mock services and requests." },
] as const;

export default function SourcesPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/">Course</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav></header>
      <article className="sources-page">
        <header className="sources-hero"><p className="eyebrow">Where everything came from</p><h1>Sources and licenses</h1><p>Latent links to the original research and specs, includes a few small datasets made for the course, and clearly lists the open-source software and model weights it uses.</p></header>

        <section className="source-policy">
          <span>What’s included</span>
          <div><strong>The research belongs to its authors.</strong><p>The course links to papers and docs but doesn’t republish their full text. Latent created the lesson explanations, diagrams, exercises, fixed scenarios, and small CC0 practice datasets.</p></div>
          <div><strong>The code is for learning.</strong><p>The browser experiments show a limited version of each idea and call out what they leave out. They aren’t official implementations from the paper authors or copies of production benchmarks.</p></div>
        </section>

        <section className="runtime-notices" aria-labelledby="runtime-notices-title">
          <header><span>Runtime notices</span><h2 id="runtime-notices-title">Models and open-source software</h2></header>
          <div>
            {runtimeNotices.map((notice) => <a href={notice.url} target="_blank" rel="noreferrer" key={notice.name}><span><strong>{notice.name}</strong><em>{notice.version}</em></span><p>{notice.use}</p><code>{notice.license} ↗</code></a>)}
          </div>
          <p className="license-note">This list is a handy attribution record, not legal advice. If anything here differs from a linked license or model card, the linked text is the one that counts.</p>
        </section>

        <section className="lesson-source-index" aria-labelledby="lesson-source-index-title">
          <header><span>Course source list</span><h2 id="lesson-source-index-title">Lesson sources and provided data</h2></header>
          {courseLessons.map((lesson) => (
            <article key={lesson.id}>
              <header><span>{String(lesson.number).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><code>{lesson.dataset.name} · {lesson.dataset.license}</code></div></header>
              <ul>{lesson.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><em>{source.authors} · {source.year}</em></span><p>{source.relevance}</p><i>↗</i></a></li>)}</ul>
              <footer><span>Where the dataset came from</span><p>{lesson.dataset.source}</p><code>{lesson.dataset.size}</code></footer>
            </article>
          ))}
        </section>
      </article>
    </main>
  );
}
