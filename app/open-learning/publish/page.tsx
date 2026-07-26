import type { Metadata } from "next";
import Link from "next/link";
import { PageAtmosphere } from "../../components/PageAtmosphere";
import { LearningPackPublisher } from "../LearningPackPublisher";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Learning Pack publisher · Latent Open Learning",
  description:
    "Validate declarative lessons and flash cards, then build a host-ready static Learning Pack site.",
};

export default function LearningPackPublisherPage() {
  return (
    <main>
      <PageAtmosphere />
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent <small>framework</small></Link>
        <nav aria-label="Primary navigation">
          <Link href="/open-learning">Open learning</Link>
          <Link href="/open-learning/read">Read a feed</Link>
          <Link aria-current="page" href="/open-learning/publish">Publish a pack</Link>
          <Link href="/course">Reference courses</Link>
        </nav>
      </header>
      <article className={`${styles.shell} ${styles.toolShell}`}>
        <header className={styles.toolHero}>
          <span className="eyebrow">Publisher workflow</span>
          <h1>Build portable course content, not a platform dependency.</h1>
          <p>
            Course Kit validates the public JSON contract and builds an
            independent static site. The result can live on any ordinary HTTPS
            host without Latent.
          </p>
        </header>
        <div>
          <LearningPackPublisher />
        </div>
      </article>
    </main>
  );
}
