import type { Metadata } from "next";
import Link from "next/link";

import { PageAtmosphere } from "../../components/PageAtmosphere";
import { PracticeWorkbench } from "../PracticeWorkbench";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Leech practice · Latent",
  description: "Retry programming questions that repeated local attempts have marked for review.",
};

export default function LeechPracticePage() {
  return (
    <main className={styles.shell}>
      <PageAtmosphere />
      <header className={`site-header course-header ${styles.topbar}`}>
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav aria-label="Practice navigation">
          <Link href="/course">Courses</Link>
          <Link href="/practice">All practice</Link>
          <Link aria-current="page" href="/practice/leeches">Leeches</Link>
          <Link href="/flashcards">Cards</Link>
          <Link href="/workspace" aria-label="Open coding workspace">Code</Link>
        </nav>
      </header>

      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Progress query · device local</span>
          <h1>Practice the ones that stick.</h1>
          <p>
            This view contains only repeatedly missed Question Group problems.
            Solving one removes it; no separate leech content is created.
          </p>
        </header>
        <PracticeWorkbench initialProgressQuery="leeches" />
      </article>
    </main>
  );
}
