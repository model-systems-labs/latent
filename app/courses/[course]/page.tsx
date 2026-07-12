import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { courseTracks, getTrack, getTrackLessons } from "../../lessons/course";
import { CourseCurriculum } from "../../components/CourseCurriculum";

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
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><span>Module {String(track.number).padStart(2, "0")} / 04</span></header>
      <article className="course-page track-page">
        <header className="course-hero track-hero">
          <p className="eyebrow">Module {String(track.number).padStart(2, "0")} · {track.shortTitle}</p>
          <h1>{track.title}</h1>
          <p>{track.thesis}</p>
          <div className="track-outcome"><span>Module artifact</span><strong>{track.outcome}</strong></div>
        </header>
        <CourseCurriculum title={track.title} lessons={lessons} />
        <footer className="track-navigation">
          {previous ? <Link href={`/courses/${previous.id}`}>← {previous.title}</Link> : <Link href="/">← Curriculum</Link>}
          {next ? <Link href={`/courses/${next.id}`}>{next.title} →</Link> : <Link href="/capstone">Build the capstone →</Link>}
        </footer>
      </article>
    </main>
  );
}
