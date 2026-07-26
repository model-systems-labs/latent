import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperLab } from "@/app/components/PaperLab";
import { allRoutedLessons, getLesson } from "@/examples/learning-platform/llm-learning/lessons/course";
import { lessonLearningOutcome } from "@/examples/learning-platform/llm-learning/lessons/learning";

export function generateStaticParams() {
  return allRoutedLessons.map((lesson) => ({ slug: lesson.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) return {};
  return { title: `${lesson.title} · Latent Courses`, description: lesson.thesis };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  return <PaperLab lesson={lesson} outcome={lessonLearningOutcome(lesson.id)} />;
}
