import type { Metadata } from "next";

import { LearnerHeader } from "@/app/components/LearnerHeader";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { PracticeWorkbench } from "@/app/practice/PracticeWorkbench";
import styles from "@/app/practice/page.module.css";

export const metadata: Metadata = {
  title: "Leech practice · Latent Courses",
  description: "Retry programming questions that repeated local attempts have marked for review.",
};

export default function LeechPracticePage() {
  return (
    <main className={styles.shell}>
      <PageAtmosphere />
      <LearnerHeader className={styles.topbar} current="practice" />

      <article className={styles.page} id="main-content" tabIndex={-1}>
        <header className={styles.hero}>
          <span className="eyebrow">Focused review · saved on this device</span>
          <h1>Retry the problems you keep missing.</h1>
          <p>
            This page collects questions you have missed repeatedly.
            Solve one to remove it from the review list; no separate leech content is created,
            and your progress stays in this browser.
          </p>
        </header>
        <PracticeWorkbench initialProgressQuery="leeches" />
      </article>
    </main>
  );
}
