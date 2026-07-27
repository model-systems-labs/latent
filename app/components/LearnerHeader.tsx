"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "@/app/components/LearnerHeader.module.css";

type LearnerDestination = "courses" | "practice" | "cards" | "reading";

const destinations = [
  { id: "courses", href: "/course", label: "Courses" },
  { id: "practice", href: "/practice", label: "Practice" },
  { id: "cards", href: "/flashcards", label: "Cards" },
  { id: "reading", href: "/sources", label: "Reading" },
] as const;

const learningSuiteBasePath = process.env.LATENT_LEARNING_SUITE_BASE_PATH ?? "";
const suiteDestinations = [
  { id: "llm-systems", href: `${learningSuiteBasePath}/llm-systems/`, label: "LLM Systems" },
  { id: "interview-loop", href: `${learningSuiteBasePath}/interview-loop/`, label: "Interview Loop" },
  { id: "ten-problems", href: `${learningSuiteBasePath}/practice/`, label: "Ten Problems" },
] as const;

export function LearnerHeader({
  className,
  current,
}: {
  className?: string;
  current?: LearnerDestination;
}) {
  const suiteMode = process.env.LATENT_COURSE_HOME === "llm-systems";
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || !suiteMode) return;
    const compact = globalThis.matchMedia("(max-width: 760px)");
    const synchronize = () => {
      if (compact.matches) menu.removeAttribute("open");
      else menu.setAttribute("open", "");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !compact.matches || !menu.open) return;
      menu.removeAttribute("open");
      menu.querySelector("summary")?.focus();
    };
    const onDocumentClick = (event: MouseEvent) => {
      if (
        compact.matches
        && menu.open
        && event.target instanceof Node
        && !menu.contains(event.target)
      ) {
        menu.removeAttribute("open");
      }
    };
    synchronize();
    compact.addEventListener("change", synchronize);
    menu.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onDocumentClick);
    return () => {
      compact.removeEventListener("change", synchronize);
      menu.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocumentClick);
    };
  }, [suiteMode]);
  if (suiteMode) {
    return (
      <header className={`site-header course-header ${styles.familyHeader}${className ? ` ${className}` : ""}`}>
        <Link className="wordmark" href="/" aria-label="LLM Systems home"><i /><span>LLM Systems</span></Link>
        <details className={styles.menu} open ref={menuRef}>
          <summary>Menu</summary>
          <nav aria-label="Learning experiences">
            {suiteDestinations.map((destination) => (
              <a
                aria-current={destination.id === "llm-systems" ? "page" : undefined}
                href={destination.href}
                key={destination.id}
              >
                {destination.label}
              </a>
            ))}
          </nav>
        </details>
      </header>
    );
  }
  return (
    <header className={`site-header course-header${className ? ` ${className}` : ""}`}>
      <Link className="wordmark" href="/" aria-label="Latent Courses home"><i />latent courses</Link>
      <nav aria-label="Primary navigation">
        {destinations.map((destination) => (
          <Link
            aria-current={current === destination.id ? "page" : undefined}
            href={destination.href}
            key={destination.id}
          >
            {destination.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
