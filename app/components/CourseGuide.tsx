import Link from "next/link";
import type { CourseProgram } from "@/examples/learning-platform/llm-learning/lessons/course";
import styles from "@/app/components/CourseGuide.module.css";

export type CourseGuideLink = {
  href: string;
  label: string;
};

type CourseGuideProps = {
  program: CourseProgram;
  title?: string;
  primaryLink?: CourseGuideLink;
  secondaryLink?: CourseGuideLink;
  quickLinks?: {
    id?: string;
    label: string;
    description: string;
    links: readonly CourseGuideLink[];
  };
};

export function CourseGuide({
  program,
  title = "Know what you are getting into",
  primaryLink,
  secondaryLink,
  quickLinks,
}: CourseGuideProps) {
  const headingId = `${program.id}-guide-title`;
  return (
    <section aria-labelledby={headingId} className={styles.guide}>
      <header><span className="eyebrow">Course guide</span><h2 id={headingId}>{title}</h2></header>
      {primaryLink || secondaryLink ? (
        <div className={styles.actions}>
          {primaryLink ? <Link href={primaryLink.href}><strong>{primaryLink.label} <span aria-hidden="true">→</span></strong></Link> : null}
          {secondaryLink ? <Link href={secondaryLink.href}><strong>{secondaryLink.label} <span aria-hidden="true">↗</span></strong></Link> : null}
        </div>
      ) : null}
      <details className={`${styles.details} calm-disclosure`}>
        <summary><span>Fit, prerequisites, outcome, and runtime</span><small>Course details</small></summary>
        <dl>
          <div><dt className="eyebrow">Best for</dt><dd>{program.audience.description}</dd></div>
          <div><dt className="eyebrow">Before you start</dt><dd>{program.prerequisite.description}</dd></div>
          <div><dt className="eyebrow">Outcome</dt><dd>{program.outcome}</dd></div>
          <div>
            <dt className="eyebrow">Runtime</dt>
            <dd><strong>{program.runtime.language}</strong><span>{program.runtime.environment}. {program.runtime.persistence}</span><span>{program.runtime.boundary}</span></dd>
          </div>
        </dl>
      </details>
      {quickLinks ? (
        <details className={`${styles.quickLinks} calm-disclosure`} id={quickLinks.id}>
          <summary>{quickLinks.label}</summary>
          <p>{quickLinks.description}</p>
          <nav aria-label={quickLinks.label}>
            <ul>{quickLinks.links.map((link) => <li key={link.href}><Link href={link.href}><strong>{link.label} <span aria-hidden="true">→</span></strong></Link></li>)}</ul>
          </nav>
        </details>
      ) : null}
    </section>
  );
}
