"use client";

import Link from "next/link";
import { PageAtmosphere } from "../../app/components/PageAtmosphere";
import { FrameworkHeader } from "./FrameworkHeader";
import styles from "./framework.module.css";

const browserCapabilities = [
  {
    label: "Course Kit + starter",
    title: "Publish static sites",
    detail:
      "Build deterministic Learning Packs or a dependency-free starter for ordinary static hosting—or keep them on your own machine.",
  },
  {
    label: "JavaScript + TypeScript",
    title: "A real browser runtime",
    detail: "Compile with esbuild-wasm and run learner code in a bounded QuickJS worker.",
  },
  {
    label: "Python + NumPy",
    title: "CPython through WebAssembly",
    detail: "Run Python in a dedicated Pyodide worker instead of sending every exercise to a backend.",
  },
  {
    label: "Learner state",
    title: "Progress is browser-local",
    detail:
      "Code, checkpoints, flash-card ratings, and practice history are saved only in the learner's browser.",
  },
] as const;

const learningExperiences = [
  {
    number: "01",
    title: "Coding practice",
    detail:
      "Build focused programming problems with starter projects, cases, feedback, and device-local progress.",
  },
  {
    number: "02",
    title: "Executable courses",
    detail:
      "Connect lessons to reviewed JavaScript, TypeScript, or Python exercises and carry a project across the curriculum.",
  },
  {
    number: "03",
    title: "Portable learning",
    detail:
      "Package lessons, quizzes, and flash cards as validated static sites that do not depend on a Latent account.",
  },
] as const;

const agentFlow = [
  {
    number: "01",
    title: "Describe",
    detail: "Give a person or coding agent a concrete learning outcome.",
  },
  {
    number: "02",
    title: "Author",
    detail: "Edit portable content or propose a change to trusted platform source.",
  },
  {
    number: "03",
    title: "Review",
    detail: "Review runtime, UI, persistence, and behavioral changes as normal application source.",
  },
  {
    number: "04",
    title: "Validate",
    detail: "Run schemas, source checks, behavioral tests, and deterministic builds.",
  },
  {
    number: "05",
    title: "Publish",
    detail: "Ship the exact static artifact on infrastructure you choose.",
  },
] as const;

const repositoryFiles = [
  "packages/course-kit/        # released formats + static builds",
  "packages/browser-lab/       # JavaScript and TypeScript runtime",
  "packages/python-lab/        # CPython and NumPy through WASM",
  "courses/authored/           # your portable Learning Packs",
  "products/courses/reference-curriculum/ # bundled courses",
  "skills/                     # agent author, review, publish flows",
  "examples/learning-platform/ # complete static starter",
  "products/framework/         # this product surface",
] as const;

export function FrameworkLanding() {
  return (
    <main className={styles.page}>
      <PageAtmosphere />
      <FrameworkHeader current="overview" />

      <article className={styles.shell}>
        <section className={styles.hero}>
          <span className="eyebrow">Open source · local-first · built for agents</span>
          <h1>Build learning software that runs in the browser.</h1>
          <p>
            Turn difficult ideas into courses, coding practice, flash cards, and
            browser IDE lessons. JavaScript, TypeScript, Python, and learner
            progress can run on the learner&apos;s device—without making an
            account, paywall, application server, or model provider the center
            of the experience.
          </p>
          <div className={styles.actions}>
            <a
              className={styles.primaryAction}
              href="https://github.com/model-systems-labs/latent/blob/main/docs/getting-started.md"
              rel="noreferrer"
            >
              Build the five-minute starter <span aria-hidden="true">↗</span>
            </a>
            <a
              className={styles.secondaryAction}
              href="https://github.com/model-systems-labs/latent"
              rel="noreferrer"
            >
              Explore the source
            </a>
          </div>
          <p className={styles.productNote}>
            <Link href="/course">Latent Courses</Link> is the bundled
            reference-course product. Courses you publish through Open Learning
            are portable Learning Packs that you host at a URL you control;
            they are not added to Latent Courses.
          </p>
        </section>

        <section className={styles.browserProof} aria-label="Browser-native framework capabilities">
          {browserCapabilities.map((capability) => (
            <article key={capability.label}>
              <span>{capability.label}</span>
              <h2>{capability.title}</h2>
              <p>{capability.detail}</p>
            </article>
          ))}
        </section>

        <section className={styles.argument} aria-labelledby="storage-title">
          <span className="eyebrow">Where your course lives</span>
          <h2 id="storage-title">There is no hidden Latent course cloud.</h2>
          <p>
            Your source, published files, and learner progress have different
            homes. Latent does not require an upload account or silently place
            your work in the bundled course library.
          </p>
          <ol className={styles.experienceGrid}>
            <li>
              <span>01 · Source</span>
              <h3>Your working folder</h3>
              <p>
                Keep <code>learning-pack.json</code> under{" "}
                <code>courses/authored/&lt;course&gt;/</code> in this
                repository—or in any directory you own.
              </p>
            </li>
            <li>
              <span>02 · Published</span>
              <h3>Your static URL</h3>
              <p>
                Course Kit generates a complete static site. Publish that output
                on an HTTPS host and URL you control.
              </p>
            </li>
            <li>
              <span>03 · Progress</span>
              <h3>The learner&apos;s browser</h3>
              <p>
                Learners open your URL. Saved content and progress remain local
                to their browser instead of syncing to Latent.
              </p>
            </li>
          </ol>
          <div className={styles.closingActions}>
            <Link href="/open-learning/publish">Build a portable Learning Pack →</Link>
          </div>
        </section>

        <section className={styles.argument} aria-labelledby="practice-title">
          <span className="eyebrow">Why Latent exists</span>
          <h2 id="practice-title">Understanding comes from changing the code.</h2>
          <p>
            Latent began with a frustration: reading papers and explanations was
            not closing the gaps in working understanding. The missing piece was
            a tighter loop—read the source, change real code, run it immediately,
            and retrieve the idea later. Modern browsers are capable enough to
            hold that entire loop.
          </p>
          <ol className={styles.experienceGrid}>
            {learningExperiences.map((experience) => (
              <li key={experience.title}>
                <span>{experience.number}</span>
                <h3>{experience.title}</h3>
                <p>{experience.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.argument} aria-labelledby="agent-title">
          <span className="eyebrow">An authoring system for people and agents</span>
          <h2 id="agent-title">Give coding agents a framework they can actually work in.</h2>
          <p>
            Latent keeps instructions, schemas, examples, review criteria, and
            validation beside the source. Any capable coding agent can author a
            lesson, expand a practice set, or propose a platform-source change.
            Changes that add runtime behavior still go through normal source
            review and validation. The learner never needs that agent—or a hidden
            model call—to use what was built.
          </p>
          <ol className={styles.agentFlow} aria-label="Agent-assisted publishing workflow">
            {agentFlow.map((stage) => (
              <li key={stage.title}>
                <span>{stage.number}</span>
                <strong>{stage.title}</strong>
                <p>{stage.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.argument} aria-labelledby="community-title">
          <span className="eyebrow">Open by design</span>
          <h2 id="community-title">Let a course become a shared public project.</h2>
          <p>
            A teacher, team, or community can inspect the source, improve an
            explanation, add practice, review citations, and publish a version
            they own. No central marketplace has to approve the work.
          </p>
          <div className={styles.pathGrid}>
            <article>
              <span>Portable content</span>
              <h3>Publish lessons without adopting the whole platform.</h3>
              <p>
                Course Kit turns declarative lessons, quizzes, cards, and
                programming-practice data into validated, independently hosted
                artifacts.
              </p>
              <Link href="/open-learning">Explore Open Learning →</Link>
            </article>
            <article>
              <span>Custom experiences</span>
              <h3>Use reviewed source when the learning tool needs code.</h3>
              <p>
                Fork the repository to add a runtime adapter, interface, or
                behavioral check. Validate it like any other application change,
                then compile it into the site you ship.
              </p>
              <a
                href="https://github.com/model-systems-labs/latent"
                rel="noreferrer"
              >
                Fork the framework →
              </a>
            </article>
          </div>
        </section>

        <section className={styles.argument} aria-labelledby="repository-title">
          <span className="eyebrow">Built to be understood and changed</span>
          <h2 id="repository-title">The repository is the authoring surface.</h2>
          <p>
            Course Kit is the released portable toolchain. The browser runtimes
            remain reviewed, source-first packages inside the application. The
            separation makes it clear which files are safe content and which
            changes add trusted behavior.
          </p>
          <div className={styles.projectTree} role="group" aria-label="Framework repository structure">
            <span>latent/</span>
            {repositoryFiles.map((file, index) => (
              <code key={file}>
                <i aria-hidden="true">{index === repositoryFiles.length - 1 ? "└──" : "├──"}</i>
                {file}
              </code>
            ))}
          </div>
          <div className={styles.closingActions}>
            <a
              href="https://github.com/model-systems-labs/latent#five-minute-golden-path"
              rel="noreferrer"
            >
              Read the technical README <span aria-hidden="true">↗</span>
            </a>
            <Link href="/course">See the reference courses →</Link>
          </div>
        </section>
      </article>

      <footer className={styles.footer}>
        <span>Latent framework</span>
        <nav aria-label="Footer navigation">
          <Link href="/open-learning">Open learning</Link>
          <Link href="/open-learning/guide.md">Format guide</Link>
          <Link href="/course">Reference courses</Link>
          <a href="https://github.com/model-systems-labs/latent" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </footer>
    </main>
  );
}
