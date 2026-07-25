import type { Metadata } from "next";
import Link from "next/link";
import { PageAtmosphere } from "../../../components/PageAtmosphere";
import { BundledQuestionIdeWorkbench } from "../../../platform/ide/BundledQuestionIdeWorkbench";
import styles from "../../page.module.css";

export const metadata: Metadata = {
  title: "Keep unique values IDE · Latent",
  description: "Solve a reviewed method-practice question in the extensible browser IDE.",
};

export default function UniqueValuesIdePage() {
  return (
    <main className={styles.shell}>
      <PageAtmosphere />
      <header className={`site-header course-header ${styles.topbar}`}>
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav aria-label="Practice navigation">
          <Link href="/course">Courses</Link>
          <Link aria-current="page" href="/practice">Practice</Link>
          <Link href="/practice/leeches">Leeches</Link>
          <Link href="/flashcards">Cards</Link>
          <Link href="/workspace" aria-label="Open coding workspace">Code</Link>
        </nav>
      </header>

      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Method practice · Browser IDE extension</span>
          <h1>One question, through the supported seam.</h1>
          <p>
            This reviewed Question Group exercise injects its files and checks.
            The platform supplies the editor, isolated runtime, and local progress.
          </p>
        </header>
        <BundledQuestionIdeWorkbench questionId="unique-values" />
      </article>
    </main>
  );
}
