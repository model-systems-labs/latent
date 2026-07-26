import type { Metadata } from "next";
import { FrameworkHeader } from "../../../products/framework/FrameworkHeader";
import { PageAtmosphere } from "../../components/PageAtmosphere";
import { HostedLearningReader } from "../HostedLearningReader";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Hosted feed reader · Latent Framework",
  description:
    "Verify a publisher-controlled Learning Feed and read its portable lessons and flash cards.",
};

export default function HostedFeedReaderPage() {
  return (
    <main>
      <PageAtmosphere />
      <FrameworkHeader current="read" />
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
