import Link from "next/link";
import { ProjectWorkbench } from "@/app/components/ProjectWorkbench";
import styles from "@/app/components/WorkspaceShell.module.css";

export function WorkspaceShell() {
  return (
    <main className={`ide-shell ${styles.shell}`} id="main-content" tabIndex={-1}>
      <header className={`ide-topbar ${styles.topbar}`}>
        <Link href="/courses/llm-systems">LLM Systems</Link>
        <div><strong>browser-chat/</strong></div>
        <nav><Link href="/project">Project</Link><Link href="/capstone">Open chatbot →</Link></nav>
      </header>
      <ProjectWorkbench />
    </main>
  );
}
