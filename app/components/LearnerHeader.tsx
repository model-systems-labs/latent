import Link from "next/link";

type LearnerDestination = "courses" | "practice" | "cards" | "reading";

const destinations = [
  { id: "courses", href: "/course", label: "Courses" },
  { id: "practice", href: "/practice", label: "Practice" },
  { id: "cards", href: "/flashcards", label: "Cards" },
  { id: "reading", href: "/sources", label: "Reading" },
] as const;

export function LearnerHeader({
  className,
  current,
}: {
  className?: string;
  current?: LearnerDestination;
}) {
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
