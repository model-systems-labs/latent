import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { courseTracks, getTrack, getTrackLessons } from "@/examples/learning-platform/llm-learning/lessons/course";
import { CourseCurriculum } from "@/app/components/CourseCurriculum";
import { moduleCheckpoint } from "@/examples/learning-platform/llm-learning/content/llm-systems/learning";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { LearnerActionLink } from "@/app/components/LearnerActionLink";

export function generateStaticParams() {
  return courseTracks.map((track) => ({ module: track.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const track = getTrack(module);
  if (!track) return {};
  return { title: `${track.title} · Build an LLM System`, description: track.thesis };
}

export default async function LlmSystemsModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const track = getTrack(module);
  if (!track) notFound();
  const lessons = getTrackLessons(track.id);
  const previous = courseTracks[track.number - 2];
  const next = courseTracks[track.number];
  const checkpoint = moduleCheckpoint(track.id);
  return (
    <>
      <LearnerHeader current="courses" experience="llm-systems" />
      <main>
        <PageAtmosphere />
        <article className="course-page track-page" id="main-content" tabIndex={-1}>
          <header className="course-hero track-hero catalog-track-hero">
            <p className="eyebrow">Build an LLM System</p>
            <h1>{track.title}</h1>
            <p className="course-thesis">{track.thesis}</p>
          </header>
          <CourseCurriculum title={track.title} lessons={lessons} />
          {checkpoint ? (
            <Link className="module-checkpoint-card module-checkpoint-card-simple" href={`/checkpoints/${track.id}`}>
              <div><strong>{checkpoint.title}</strong><p>Optional integration check. {checkpoint.objective}</p></div>
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <footer className="track-navigation">
            {previous ? <LearnerActionLink href={`/courses/llm-systems/${previous.id}`}>← {previous.title}</LearnerActionLink> : <LearnerActionLink href="/courses/llm-systems">← Course home</LearnerActionLink>}
            {next ? <LearnerActionLink href={`/courses/llm-systems/${next.id}`}>{next.title} →</LearnerActionLink> : <LearnerActionLink href="/capstone">Build the capstone →</LearnerActionLink>}
          </footer>
        </article>
      </main>
    </>
  );
}
