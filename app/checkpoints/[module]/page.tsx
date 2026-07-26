import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleCheckpoint } from "../../components/ModuleCheckpoint";
import { courseTracks, getTrack } from "../../../examples/learning-platform/llm-learning/lessons/course";
import { moduleCheckpoint } from "../../../examples/learning-platform/llm-learning/content/llm-systems/learning";
import { PageAtmosphere } from "../../components/PageAtmosphere";

export function generateStaticParams() {
  return courseTracks.map((track) => ({ module: track.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const definition = moduleCheckpoint(module);
  return definition ? { title: `${definition.title} · Latent Courses`, description: definition.objective } : {};
}

export default async function CheckpointPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const track = getTrack(module);
  if (!track) notFound();
  return (
    <main>
      <PageAtmosphere />
      <header className="site-header course-header"><Link className="wordmark" href="/" aria-label="Latent Courses home"><i />latent courses</Link><nav><Link href={`/courses/llm-systems/${track.id}`}>Module</Link><Link href="/project">Project</Link><Link href="/workspace">IDE</Link></nav></header>
      <ModuleCheckpoint courseId={track.id} />
    </main>
  );
}
