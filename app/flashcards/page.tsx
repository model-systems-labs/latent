import type { Metadata } from "next";
import Link from "next/link";
import { FlashcardDeck } from "../components/FlashcardDeck";
import { flashcards } from "../content/flashcards";
import { PageAtmosphere } from "../components/PageAtmosphere";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Flash cards · Latent",
  description:
    "Review linear algebra, machine learning, model foundations, inference, serving, chat product, and harness engineering concepts.",
};

export default function FlashcardsPage() {
  return (
    <main>
      <PageAtmosphere />

      <header className={`site-header course-header ${styles.header}`}>
        <Link className="wordmark" href="/"><i />latent</Link>
        <nav aria-label="Study navigation">
          <Link href="/course">Course home</Link>
          <Link href="/practice">Practice</Link>
        </nav>
      </header>

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
