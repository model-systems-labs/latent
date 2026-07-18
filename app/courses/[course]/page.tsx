import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { coursePrograms, courseTracks, getCourseProgram } from "../../lessons/course";
import { CourseCurriculum } from "../../components/CourseCurriculum";

export function generateStaticParams() {
  return [
    ...coursePrograms.filter((program) => program.kind !== "project").map((program) => ({ course: program.id })),
    ...courseTracks.map((track) => ({ course: track.id })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const { course } = await params;
  const program = getCourseProgram(course);
  if (program && program.kind !== "project") {
    return { title: `${program.title} · Latent`, description: program.thesis };
  }
  const track = courseTracks.find((candidate) => candidate.id === course);
  if (track) return { title: `${track.title} · Latent`, description: track.thesis };
  return {};
}

export default async function StandaloneCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const legacyTrack = courseTracks.find((track) => track.id === course);
  if (legacyTrack) redirect(`/courses/llm-systems/${legacyTrack.id}`);
  const program = getCourseProgram(course);
  if (!program || program.kind === "project") notFound();
  const standalonePrograms = coursePrograms.filter((candidate) => candidate.kind !== "project");
  const programIndex = standalonePrograms.findIndex((candidate) => candidate.id === program.id);
  const previous = standalonePrograms[programIndex - 1];
  const next = standalonePrograms[programIndex + 1];
  const courseKind = program.kind === "foundation" ? "Foundation" : "Applied";
  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true"><span className="orbit orbit-one" /><span className="node node-one" /><span className="warm-star" /></div>
      <header className="site-header course-header"><Link className="wordmark" href="/"><i />latent</Link><nav><Link href="/course">All courses</Link><Link href="/sources">Sources</Link></nav></header>
      <article className="course-page track-page standalone-course-page">
        <header className="course-hero track-hero catalog-track-hero">
          <p className="eyebrow">{courseKind} course · {program.lessons.length} lessons</p>
          <h1>{program.title}</h1>
          <p className="course-thesis">{program.thesis}</p>
        </header>
        <p className="standalone-course-boundary">Exercises and progress are saved within this course.</p>
        <CourseCurriculum title={program.title} lessons={program.lessons} completionLabel="Course lessons complete" />
        <footer className="track-navigation">
          {previous ? <Link href={previous.href}>← {previous.title}</Link> : <Link href="/course">← All courses</Link>}
          {next ? <Link href={next.href}>{next.title} →</Link> : <Link href="/course">All courses ↑</Link>}
        </footer>
      </article>
    </main>
  );
}
