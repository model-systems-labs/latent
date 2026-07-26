import type { Metadata } from "next";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { BundledQuestionIdeWorkbench } from "@/app/platform/ide/BundledQuestionIdeWorkbench";
import styles from "@/app/practice/page.module.css";

export const metadata: Metadata = {
  title: "Keep unique values IDE · Latent Courses",
  description: "Solve a focused TypeScript practice question in the browser.",
};

export default function UniqueValuesIdePage() {
  return (
    <main className={styles.shell}>
      <PageAtmosphere />
      <LearnerHeader className={styles.topbar} current="practice" />

      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Method practice · TypeScript</span>
          <h1>Keep unique values.</h1>
          <p>
            Edit the solution, run the checks, and keep your progress in this browser.
            The exercise includes everything you need.
          </p>
        </header>
        <BundledQuestionIdeWorkbench questionId="unique-values" />
      </article>
    </main>
  );
}
