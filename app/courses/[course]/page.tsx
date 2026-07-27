import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { coursePrograms, courseTracks, getCourseProgram } from "@/examples/learning-platform/llm-learning/lessons/course";
import { CourseGuide } from "@/app/components/CourseGuide";
import { CourseCurriculum } from "@/app/components/CourseCurriculum";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { LearnerActionLink } from "@/app/components/LearnerActionLink";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";

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
    return { title: `${program.title} · Latent Courses`, description: program.thesis };
  }
  const track = courseTracks.find((candidate) => candidate.id === course);
  if (track) return { title: `${track.title} · Latent Courses`, description: track.thesis };
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
      <PageAtmosphere />
      <LearnerHeader current="courses" />
      <article className="course-page track-page standalone-course-page" id="main-content" tabIndex={-1}>
        <header className="course-hero track-hero catalog-track-hero">
          <p className="eyebrow">{courseKind} course · {program.lessons.length} lessons</p>
          <h1>{program.title}</h1>
          <p className="course-thesis">{program.thesis}</p>
        </header>
        <CourseGuide
          program={program}
          title={program.kind === "foundation" ? "Take the refresher you need" : "Build the software around the model"}
          secondaryLink={program.id === "harness-engineering"
            ? { href: "/courses/harness-engineering/workspace", label: "Open the harness project" }
            : undefined}
        />
        <CourseCurriculum title={program.title} lessons={program.lessons} completionLabel="Course lessons complete" />
        <footer className="track-navigation">
          {previous ? <LearnerActionLink href={previous.href}>← {previous.title}</LearnerActionLink> : <LearnerActionLink href="/course">← All courses</LearnerActionLink>}
          {next ? <LearnerActionLink href={next.href}>{next.title} →</LearnerActionLink> : <LearnerActionLink href="/course">All courses ↑</LearnerActionLink>}
        </footer>
      </article>
    </main>
  );
}
