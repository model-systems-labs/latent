import type { Metadata } from "next";
import { FrameworkHeader } from "../../../products/framework/FrameworkHeader";
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
      <FrameworkHeader current="publish" />
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
