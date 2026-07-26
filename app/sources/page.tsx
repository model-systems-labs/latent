import type { Metadata } from "next";
import { LearnerHeader } from "../components/LearnerHeader";
import { coursePrograms } from "../../examples/learning-platform/llm-learning/lessons/course";
import { PageAtmosphere } from "../components/PageAtmosphere";

export const metadata: Metadata = {
  title: "Further reading and licenses · Latent Courses",
  description: "References, datasets, model licenses, and open-source notices for every Latent course.",
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

const flashcardReferenceShelves = {
  "machine-learning-basics": [
    { title: "Mathematics for Machine Learning", authors: "Marc Peter Deisenroth · A. Aldo Faisal · Cheng Soon Ong", year: "2020", url: "https://mml-book.github.io/" },
    { title: "Elements of Information Theory", authors: "Thomas M. Cover · Joy A. Thomas", year: "2006", url: "https://onlinelibrary.wiley.com/doi/book/10.1002/047174882X" },
    { title: "18.02SC Multivariable Calculus", authors: "MIT OpenCourseWare", year: "2010", url: "https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/" },
    { title: "Convex Optimization", authors: "Stephen Boyd · Lieven Vandenberghe", year: "2004", url: "https://web.stanford.edu/~boyd/cvxbook/" },
    { title: "Deep Learning: Regularization for Deep Learning", authors: "Ian Goodfellow · Yoshua Bengio · Aaron Courville", year: "2016", url: "https://www.deeplearningbook.org/contents/regularization.html" },
    { title: "Dropout: A Simple Way to Prevent Neural Networks from Overfitting", authors: "Nitish Srivastava et al.", year: "2014", url: "https://www.jmlr.org/papers/v15/srivastava14a.html" },
    { title: "Decoupled Weight Decay Regularization", authors: "Ilya Loshchilov · Frank Hutter", year: "2019", url: "https://openreview.net/forum?id=Bkg6RiCqY7" },
    { title: "Model evaluation", authors: "scikit-learn developers", year: "Current", url: "https://scikit-learn.org/stable/modules/model_evaluation.html" },
    { title: "Probability calibration", authors: "scikit-learn developers", year: "Current", url: "https://scikit-learn.org/stable/modules/calibration.html" },
    { title: "NIST/SEMATECH e-Handbook of Statistical Methods", authors: "NIST · SEMATECH", year: "2012", url: "https://www.itl.nist.gov/div898/handbook/" },
    { title: "An Introduction to the Bootstrap", authors: "Bradley Efron · Robert J. Tibshirani", year: "1993", url: "https://doi.org/10.1201/9780429246593" },
  ],
} as const;

export default function SourcesPage() {
  return (
    <main>
      <PageAtmosphere />
      <LearnerHeader current="reading" />
      <article className="sources-page">
        <header className="sources-hero"><h1>Further reading</h1><p>References, datasets, models, and software used across the four courses.</p></header>

        <p className="source-policy-note">Further reading establishes the research, equations, standards, and APIs behind each lesson. Its prose, figures, tutorial code, and datasets are not republished here; Latent&apos;s explanations, diagrams, exercises, implementations, and synthetic fixtures are course-authored.</p>

        <details className="runtime-notices">
          <summary id="runtime-notices-title">Models and open-source software</summary>
          <div>
            {runtimeNotices.map((notice) => <a href={notice.url} target="_blank" rel="noreferrer" aria-label={`${notice.name}, ${notice.version}, ${notice.license}; opens in a new tab`} key={notice.name}><span><strong>{notice.name}</strong><em>{notice.version}</em></span><code>{notice.license} ↗</code></a>)}
          </div>
        </details>

        <section className="lesson-source-index" aria-labelledby="lesson-source-index-title">
          <header><h2 id="lesson-source-index-title">Further reading by lesson</h2></header>
          {coursePrograms.map((program) => (
            <details className="source-program-group calm-disclosure" key={program.id}>
              <summary id={`sources-${program.id}`}><span>{program.title}</span><small>{program.lessons.length} lessons</small></summary>
              {program.lessons.map((lesson) => (
                <article key={lesson.id}>
                  <header><strong>{lesson.title}</strong><code>{lesson.dataset.name} · {lesson.dataset.source} · {lesson.dataset.license} · {lesson.dataset.size}</code></header>
                  <ul>{lesson.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.title}, ${source.authors}, ${source.year}; opens in a new tab`}><span><strong>{source.title}</strong><em>{source.authors} · {source.year}</em></span><i aria-hidden="true">↗</i></a></li>)}</ul>
                </article>
              ))}
              {program.id in flashcardReferenceShelves ? (
                <article>
                  <header><strong>Flash-card reference shelf</strong><code>Probability · calculus · regularization · evaluation</code></header>
                  <ul>{flashcardReferenceShelves[program.id as keyof typeof flashcardReferenceShelves].map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.title}, ${source.authors}, ${source.year}; opens in a new tab`}><span><strong>{source.title}</strong><em>{source.authors} · {source.year}</em></span><i aria-hidden="true">↗</i></a></li>)}</ul>
                </article>
              ) : null}
            </details>
          ))}
        </section>
      </article>
    </main>
  );
}
