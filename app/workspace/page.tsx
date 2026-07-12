import type { Metadata } from "next";
import Link from "next/link";
import { ProjectWorkbench } from "../components/ProjectWorkbench";

export const metadata: Metadata = {
  title: "Project IDE · Latent",
  description: "Edit, test, and build the browser chatbot assembled throughout the Latent LLM Systems course.",
};

export default function WorkspacePage() {
  return (
    <main className="ide-shell">
      <header className="ide-topbar">
        <Link className="wordmark" href="/"><i />latent</Link>
        <div><span>Project IDE</span><strong>browser-chat/</strong></div>
        <nav><Link href="/courses/models">Course</Link><Link href="/capstone">Open chatbot →</Link></nav>
      </header>
      <ProjectWorkbench />
    </main>
  );
}
