import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleCheckpoint } from "@/app/components/ModuleCheckpoint";
import { courseTracks, getTrack } from "@/examples/learning-platform/llm-learning/lessons/course";
import { moduleCheckpoint } from "@/examples/learning-platform/llm-learning/content/llm-systems/learning";
import { PageAtmosphere } from "@/app/components/PageAtmosphere";
import { LearnerHeader } from "@/app/components/LearnerHeader";

export function generateStaticParams() {
  return courseTracks.map((track) => ({ module: track.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const definition = moduleCheckpoint(module);
  return definition ? { title: `${definition.title} · Build an LLM System`, description: definition.objective } : {};
}

export default async function CheckpointPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const track = getTrack(module);
  if (!track) notFound();
  return (
    <>
      <LearnerHeader current="courses" experience="llm-systems" />
      <main>
        <PageAtmosphere />
        <ModuleCheckpoint courseId={track.id} />
      </main>
    </>
  );
}
