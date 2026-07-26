import type { Metadata } from "next";
import { LearnerHeader } from "../components/LearnerHeader";
import { FlashcardDeck } from "../components/FlashcardDeck";
import { flashcards } from "../../examples/learning-platform/llm-learning/content/flashcards";
import { PageAtmosphere } from "../components/PageAtmosphere";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Flash cards · Latent Courses",
  description:
    "Review linear algebra, machine learning, model foundations, inference, serving, chat product, and harness engineering concepts.",
};

export default function FlashcardsPage() {
  return (
    <main>
      <PageAtmosphere />

      <LearnerHeader className={styles.header} current="cards" />

      <article className="course-page">
        <header className={`course-hero ${styles.hero}`}>
          <p className="eyebrow">Review library · {flashcards.length} cards</p>
          <h1>Make the ideas stick.</h1>
          <p className="course-thesis">
            Pick a subject, search, or mix the deck. Mark what sticks; progress stays on this device.
          </p>
        </header>

        <FlashcardDeck />
      </article>
    </main>
  );
}
