import type { CourseTrack } from "@latent/course-kit";
import styles from "@/app/components/ModuleOverview.module.css";

export function ModuleOverview({
  overview,
  outcome,
}: {
  overview: CourseTrack["overview"];
  outcome: string;
}) {
  if (!overview) return null;

  return (
    <section className={styles.overview} aria-labelledby="module-overview-title">
      <div className={styles.introduction}>
        <span className="eyebrow">Module overview</span>
        <h2 id="module-overview-title">{overview.title}</h2>
        <p>{overview.introduction}</p>
      </div>
      <div className={styles.path}>
        <h3>What you will be able to do</h3>
        <ol>
          {overview.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ol>
        <div className={styles.outcome}>
          <span>Module outcome</span>
          <p>{outcome}</p>
        </div>
      </div>
    </section>
  );
}
