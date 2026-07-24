import type { Metadata } from "next";
import Link from "next/link";
import { PageAtmosphere } from "../components/PageAtmosphere";
import { PracticeWorkbench } from "./PracticeWorkbench";
import { methodQuestionGroups, methodQuestions } from "../content/practice/question-library";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Method practice · Latent",
  description: "Solve original interview-style coding questions locally in your browser.",
};

export default function PracticePage() {
  return (
    <main className={styles.shell}>
      <PageAtmosphere />
      <header className={`site-header course-header ${styles.topbar}`}>
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav aria-label="Practice navigation">
          <Link href="/course">Courses</Link>
          <Link aria-current="page" href="/practice">Practice</Link>
          <Link href="/flashcards">Cards</Link>
          <Link href="/workspace" aria-label="Open coding workspace">Code</Link>
        </nav>
      </header>

      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Method practice · runs on this device</span>
          <h1>Read it. Write it. Check it.</h1>
          <p>
            Work through {methodQuestions.length} original coding questions in {methodQuestionGroups.length} groups.
            Your drafts and solved status stay in this browser.
          </p>
        </header>
        <PracticeWorkbench />
      </article>
    </main>
  );
}
