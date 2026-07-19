import type { Metadata } from "next";
import Link from "next/link";
import { FlashcardDeck } from "../components/FlashcardDeck";
import { compactFlashcardDeck } from "../content/flashcard-transport";
import { flashcards, flashcardSubjects } from "../content/flashcards";
import styles from "./page.module.css";

const deck = compactFlashcardDeck(flashcards);

export const metadata: Metadata = {
  title: "Flash cards · Latent",
  description:
    "Review linear algebra, machine learning, model foundations, inference, serving, chat product, and harness engineering concepts.",
};

export default function FlashcardsPage() {
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="node node-one" />
        <span className="warm-star" />
      </div>

      <header className={`site-header course-header ${styles.header}`}>
        <Link className="wordmark" href="/"><i />latent</Link>
        <Link href="/course">Course home</Link>
      </header>

      <article className="course-page">
        <header className={`course-hero ${styles.hero}`}>
          <p className="eyebrow">Review library · {flashcards.length} cards</p>
          <h1>Make the ideas stick.</h1>
          <p className="course-thesis">
            Pick a subject, search, or mix the deck. Mark what sticks; progress stays on this device.
          </p>
        </header>

        <FlashcardDeck deck={deck} subjects={flashcardSubjects} />
      </article>
    </main>
  );
}
