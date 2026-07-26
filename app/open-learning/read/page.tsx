import type { Metadata } from "next";
import Link from "next/link";
import { PageAtmosphere } from "../../components/PageAtmosphere";
import { HostedLearningReader } from "../HostedLearningReader";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Hosted feed reader · Latent Open Learning",
  description:
    "Verify a publisher-controlled Learning Feed and read its portable lessons and flash cards.",
};

export default function HostedFeedReaderPage() {
  return (
    <main>
      <PageAtmosphere />
      <header className="site-header course-header">
        <Link className="wordmark" href="/"><i />latent <small>framework</small></Link>
        <nav aria-label="Primary navigation">
          <Link href="/open-learning">Open learning</Link>
          <Link aria-current="page" href="/open-learning/read">Read a feed</Link>
          <Link href="/open-learning/publish">Publish a pack</Link>
          <Link href="/course">Reference courses</Link>
        </nav>
      </header>
      <article className={`${styles.shell} ${styles.toolShell}`}>
        <header className={styles.toolHero}>
          <span className="eyebrow">Learner workflow</span>
          <h1>Verify a publisher’s feed before you read it.</h1>
          <p>
            The reader checks immutable package identity and integrity, renders
            authored strings as text, and keeps saved progress on this device.
          </p>
        </header>
        <div>
          <HostedLearningReader />
        </div>
      </article>
    </main>
  );
}
