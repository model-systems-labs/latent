import type { Metadata } from "next";
import Link from "next/link";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { ProjectWorkbench } from "@/app/components/ProjectWorkbench";

export const metadata: Metadata = {
  title: "Project IDE · Build an LLM System",
  description: "Edit, test, and build the browser chatbot you put together in the Latent LLM Systems course.",
};

export default function WorkspacePage() {
  return (
    <>
      <LearnerHeader current="courses" />
      <main className="ide-shell">
        <header className="ide-topbar">
          <Link href="/courses/llm-systems">LLM Systems</Link>
          <div><strong>browser-chat/</strong></div>
          <nav><Link href="/project">Project</Link><Link href="/capstone">Open chatbot →</Link></nav>
        </header>
        <ProjectWorkbench />
      </main>
    </>
  );
}
