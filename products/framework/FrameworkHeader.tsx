import Link from "next/link";
import styles from "@/products/framework/FrameworkHeader.module.css";

type FrameworkDestination = "overview" | "open-learning" | "read" | "publish";
const frameworkHomeHref = process.env.LATENT_PRODUCT_HOME === "framework" ? "/" : "/framework";

const destinations = [
  { id: "overview", href: frameworkHomeHref, label: "Overview" },
  { id: "open-learning", href: "/open-learning", label: "Open learning" },
] as const;

function isCurrent(
  destination: (typeof destinations)[number]["id"],
  current: FrameworkDestination,
) {
  return destination === "overview" ? current === "overview" : current !== "overview";
}

export function FrameworkHeader({
  current,
}: {
  current: FrameworkDestination;
}) {
  return (
    <header className={`site-header course-header ${styles.header}`}>
      <Link className="wordmark" href={frameworkHomeHref} aria-label="Latent framework home">
        <i />
        latent <small>framework</small>
      </Link>
      <nav aria-label="Framework navigation">
        {destinations.map((destination) => (
          <Link
            aria-current={isCurrent(destination.id, current) ? "page" : undefined}
            className={styles.headerLink}
            href={destination.href}
            key={destination.id}
          >
            {destination.label}
          </Link>
        ))}
        <Link className={styles.headerLink} href="/course">Bundled courses</Link>
        <a
          className={styles.headerLink}
          href="https://github.com/model-systems-labs/latent"
          rel="noreferrer"
        >
          GitHub
        </a>
      </nav>
    </header>
  );
}
