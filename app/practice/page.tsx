import type { Metadata } from "next";
import Link from "next/link";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { PracticeWorkbench } from "@/app/practice/PracticeWorkbench";
import { methodQuestionGroups, methodQuestions } from "@/examples/learning-platform/llm-learning/content/practice/question-library";
import styles from "@/app/practice/page.module.css";

export const metadata: Metadata = {
  title: "Method practice · Latent Courses",
  description: "Solve original interview-style coding questions locally in your browser.",
};

export default function PracticePage() {
  return (
    <main className={styles.shell}>
      <PageAtmosphere />
      <LearnerHeader className={styles.topbar} current="practice" />

      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Method practice · runs on this device</span>
          <h1>Read it. Write it. Check it.</h1>
          <p>
            Work through {methodQuestions.length} original coding questions in {methodQuestionGroups.length} groups.
            Your drafts and solved status stay in this browser.
          </p>
          <p>
            <Link href="/practice/ide/unique-values">
              Try “Keep unique values” in the focused browser IDE
            </Link>
            {" · "}
            <Link href="/practice/leeches">Review questions you keep missing</Link>
          </p>
        </header>
        <PracticeWorkbench />
      </article>
    </main>
  );
}
