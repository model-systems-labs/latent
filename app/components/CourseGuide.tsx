import Link from "next/link";
import type { CSSProperties } from "react";
import type { CourseProgram } from "../lessons/course";

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

const factsStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
  margin: "1.5rem 0 0",
};

const guideStyle: CSSProperties = { borderBlock: "1px solid var(--line-strong)", marginBottom: "clamp(2.75rem, 5vw, 4.25rem)", padding: "clamp(1.5rem, 3vw, 2.2rem) 0" };
const headingStyle: CSSProperties = { fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.45rem)", fontWeight: 400, letterSpacing: "-0.035em", lineHeight: 1.05, margin: 0 };
const factStyle: CSSProperties = { borderTop: "1px solid var(--line)", paddingTop: "0.9rem" };
const detailStyle: CSSProperties = { color: "var(--muted)", fontSize: "max(0.7rem, 12px)", lineHeight: 1.55, margin: "0.55rem 0 0" };
const actionsStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "0.75rem 1.4rem", paddingTop: "1.2rem" };
const actionLinkStyle: CSSProperties = { borderBottom: "1px solid var(--line-strong)", color: "var(--violet-deep)", fontSize: "max(0.7rem, 12px)", paddingBottom: "0.3rem" };
const quickLinksStyle: CSSProperties = { borderTop: "1px solid var(--line)", marginTop: "1.25rem", paddingTop: "1.25rem" };
const linkListStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "0.65rem 1.1rem", listStyle: "none", margin: "1rem 0 0", padding: 0 };

export function CourseGuide({
  program,
  title = "Know what you are getting into",
  primaryLink,
  secondaryLink,
  quickLinks,
}: CourseGuideProps) {
  const headingId = `${program.id}-guide-title`;
  return (
    <section aria-labelledby={headingId} style={guideStyle}>
      <header style={{ display: "grid", gap: "0.45rem" }}><span className="eyebrow">Course guide</span><h2 id={headingId} style={headingStyle}>{title}</h2></header>
      <dl style={factsStyle}>
        <div style={factStyle}>
          <dt className="eyebrow">Best for</dt>
          <dd style={detailStyle}>{program.audience.description}</dd>
        </div>
        <div style={factStyle}>
          <dt className="eyebrow">Before you start</dt>
          <dd style={detailStyle}>{program.prerequisite.description}</dd>
        </div>
        <div style={factStyle}>
          <dt className="eyebrow">Outcome</dt>
          <dd style={detailStyle}>{program.outcome}</dd>
        </div>
        <div style={factStyle}>
          <dt className="eyebrow">Runtime</dt>
          <dd style={detailStyle}>
            <strong style={{ color: "var(--ink)", display: "block" }}>{program.runtime.language}</strong>
            <span style={{ display: "block" }}>{program.runtime.environment}. {program.runtime.persistence}</span>
            <span style={{ display: "block" }}>{program.runtime.boundary}</span>
          </dd>
        </div>
      </dl>
      {primaryLink || secondaryLink ? (
        <div style={actionsStyle}>
          {primaryLink ? <Link href={primaryLink.href} style={actionLinkStyle}><strong>{primaryLink.label} <span aria-hidden="true">→</span></strong></Link> : null}
          {secondaryLink ? <Link href={secondaryLink.href} style={actionLinkStyle}><strong>{secondaryLink.label} <span aria-hidden="true">↗</span></strong></Link> : null}
        </div>
      ) : null}
      {quickLinks ? (
        <nav id={quickLinks.id} aria-label={quickLinks.label} style={quickLinksStyle}>
          <div>
            <strong className="eyebrow">{quickLinks.label}</strong>
            <p style={detailStyle}>{quickLinks.description}</p>
          </div>
          <ul style={linkListStyle}>
            {quickLinks.links.map((link) => (
              <li key={link.href}><Link href={link.href} style={actionLinkStyle}><strong>{link.label} <span aria-hidden="true">→</span></strong></Link></li>
            ))}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
