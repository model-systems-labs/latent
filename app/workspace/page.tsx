import type { Metadata } from "next";
import Link from "next/link";
import { ProjectWorkbench } from "../components/ProjectWorkbench";

export const metadata: Metadata = {
  title: "Project IDE · Latent",
  description: "Edit, test, and build the browser chatbot you put together in the Latent LLM Systems course.",
};

export default function WorkspacePage() {
  return (
    <main className="ide-shell">
      <header className="ide-topbar">
        <Link className="wordmark" href="/"><i />latent</Link>
        <div><strong>browser-chat/</strong></div>
        <nav><Link href="/courses/llm-systems">LLM Systems</Link><Link href="/project">Project</Link><Link href="/capstone">Open chatbot →</Link></nav>
      </header>
      <ProjectWorkbench />
    </main>
  );
}
