import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { courseTracks, getTrack, getTrackLessons } from "../../lessons/course";
import { CourseCurriculum } from "../../components/CourseCurriculum";
import { moduleCheckpoint } from "../../content/llm-systems/learning";

export function generateStaticParams() {
  return courseTracks.map((track) => ({ course: track.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const { course } = await params;
  const track = getTrack(course);
  if (!track) return {};
  return { title: `${track.title} module · Latent`, description: track.thesis };
}

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const track = getTrack(course);
  if (!track) notFound();
  const lessons = getTrackLessons(track.id);
  const previous = courseTracks[track.number - 2];
  const next = courseTracks[track.number];
  const checkpoint = moduleCheckpoint(track.id);
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><Link href="/">Course home</Link></header>
      <article className="course-page track-page">
        <header className="course-hero track-hero catalog-track-hero">
          <h1>{track.title}</h1>
          <p className="course-thesis">{track.thesis}</p>
        </header>
        <CourseCurriculum title={track.title} lessons={lessons} />
        {checkpoint ? (
          <Link className="module-checkpoint-card module-checkpoint-card-simple" href={`/checkpoints/${track.id}`}>
            <div><strong>{checkpoint.title}</strong><p>{checkpoint.objective}</p></div>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
        <footer className="track-navigation">
          {previous ? <Link href={`/courses/${previous.id}`}>← {previous.title}</Link> : <Link href="/">← Course home</Link>}
          {next ? <Link href={`/courses/${next.id}`}>{next.title} →</Link> : <Link href="/capstone">Build the capstone →</Link>}
        </footer>
      </article>
    </main>
  );
}
