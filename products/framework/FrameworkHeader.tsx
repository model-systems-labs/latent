import Link from "next/link";

type FrameworkDestination = "open-learning" | "read" | "publish";

const destinations = [
  { id: "open-learning", href: "/open-learning", label: "Open learning" },
  { id: "read", href: "/open-learning/read", label: "Read a feed" },
  { id: "publish", href: "/open-learning/publish", label: "Publish a pack" },
] as const;

export function FrameworkHeader({
  current,
}: {
  current?: FrameworkDestination;
}) {
  return (
    <header className="site-header course-header">
      <Link className="wordmark" href="/framework" aria-label="Latent framework home">
        <i />
        latent <small>framework</small>
      </Link>
      <nav aria-label="Framework navigation">
        {destinations.map((destination) => (
          <Link
            aria-current={current === destination.id ? "page" : undefined}
            href={destination.href}
            key={destination.id}
          >
            {destination.label}
          </Link>
        ))}
        <Link href="/course">Reference courses</Link>
      </nav>
    </header>
  );
}
