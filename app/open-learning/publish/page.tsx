import type { Metadata } from "next";
import { FrameworkHeader } from "@/products/framework/FrameworkHeader";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { LearningPackPublisher } from "@/app/open-learning/LearningPackPublisher";
import styles from "@/app/open-learning/page.module.css";

export const metadata: Metadata = {
  title: "Learning Pack publisher · Latent Framework",
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
          <h1>Build a portable Learning Pack you host.</h1>
          <p>
            Course Kit turns your declarative course into a static site. You
            publish that output on an HTTPS host you control; Latent does not
            add it to the bundled courses.
          </p>
        </header>
        <div>
          <LearningPackPublisher />
        </div>
      </article>
    </main>
  );
}
