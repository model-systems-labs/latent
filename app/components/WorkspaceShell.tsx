import Link from "next/link";
import { ProjectWorkbench } from "@/app/components/ProjectWorkbench";
import styles from "@/app/components/WorkspaceShell.module.css";

export function WorkspaceShell() {
  return (
    <main className={`ide-shell ${styles.shell}`} id="main-content" tabIndex={-1}>
      <header className={`ide-topbar ${styles.topbar}`}>
        <div role="heading" aria-level={1}><span>Project workspace</span><strong>browser-chat/</strong></div>
        <nav aria-label="Workspace actions"><Link href="/capstone">Run Browser Chat →</Link></nav>
      </header>
      <ProjectWorkbench />
    </main>
  );
}
