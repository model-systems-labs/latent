import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperLab } from "../../components/PaperLab";
import { allRoutedLessons, getLesson } from "../course";
import { lessonLearningOutcome } from "../learning";

export function generateStaticParams() {
  return allRoutedLessons.map((lesson) => ({ slug: lesson.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) return {};
  return { title: `${lesson.title} · Latent`, description: lesson.thesis };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  return <PaperLab lesson={lesson} outcome={lessonLearningOutcome(lesson.id)} />;
}
