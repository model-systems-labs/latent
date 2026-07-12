"use client";

import Link from "next/link";
import { courseLessons, courseTracks, getTrackLessons, llmSystemsCurriculum } from "../lessons/course";
import { useLearnerState } from "../lib/learner-state";
import { RUNTIME_PATHS, useProjectState } from "../lib/project-workspace";
import { projectFileStatus, type ProjectFileStatus } from "../lib/project-file-status";

type ProjectRow = {
  path: string;
  filename: string;
  status: ProjectFileStatus;
  href?: string;
};

const runtimeRows = [
  { path: RUNTIME_PATHS.tensor, readOnly: true },
  { path: RUNTIME_PATHS.model },
  { path: RUNTIME_PATHS.transport },
  { path: RUNTIME_PATHS.interface },
];

function ProjectGroup({ label, rows }: { label: string; rows: ProjectRow[] }) {
  return (
    <section className="project-structure-group">
      <header><span>{label}/</span><em>{rows.length} {rows.length === 1 ? "file" : "files"}</em></header>
      <ul>
        {rows.map((row) => (
          <li className={`status-${row.status.tone}`} key={row.path}>
            <Link href={row.href ?? `/workspace?file=${encodeURIComponent(row.path)}`}>
              <span><i />{row.filename}</span>
              <em>{row.status.label}</em>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProjectStructureMap() {
  const learner = useLearnerState();
  const project = useProjectState();
  const trustedResults = project.tests.runner === "browser-lab-v1" ? project.tests.results : {};
  const groups = courseTracks.map((track) => ({
    track,
    rows: getTrackLessons(track.id).map((lesson): ProjectRow => {
      const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
      const file = project.files[path];
      const verifiedCells = learner.lessons[lesson.id]?.verifiedCells.length ?? file?.verifiedCells ?? 0;
      return {
        path,
        filename: lesson.implementation.filename,
        status: projectFileStatus({
          isLessonFile: true,
          verifiedCells,
          totalCells: lesson.implementation.codeBlocks.length,
          results: trustedResults[path] ?? [],
        }),
      };
    }),
  }));
  const sourceRows = groups.flatMap((group) => group.rows);
  const completed = sourceRows.filter((row) => row.status.complete).length;
  const inProgress = sourceRows.filter((row) => row.status.tone === "in-progress").length;
  const pending = courseLessons.length - completed - inProgress;
  const completion = courseLessons.length ? completed / courseLessons.length * 100 : 0;
  const providedRows = runtimeRows.map(({ path, readOnly = false }): ProjectRow => ({
    path,
    filename: path.split("/").at(-1) ?? path,
    status: projectFileStatus({
      isLessonFile: false,
      readOnly,
      results: trustedResults[path] ?? [],
    }),
  }));
  const capstoneRow: ProjectRow = {
    path: llmSystemsCurriculum.capstone.projectPath,
    filename: llmSystemsCurriculum.capstone.projectPath.split("/").at(-1) ?? "BrowserChat.tsx",
    href: "/capstone",
    status: project.runtime.builtAt > 0
      ? { tone: "assembled", label: "Assembled", complete: true }
      : { tone: "pending", label: "Pending", complete: false },
  };

  return (
    <section className="project-structure-map" aria-label="browser-chat project file structure">
      <header className="project-structure-root">
        <div><span>Project root</span><strong>browser-chat/</strong></div>
        <p><span>Lesson files</span><strong>{completed} / {courseLessons.length} complete</strong></p>
      </header>
      <div className="project-structure-progress" aria-label={`${completed} of ${courseLessons.length} lesson files complete`}>
        <i><b style={{ width: `${completion}%` }} /></i>
        <p><strong>{completed} complete</strong><span>{inProgress ? ` · ${inProgress} in progress` : ""} · {pending} pending</span></p>
      </div>
      <div className="project-structure-groups">
        <ProjectGroup label="runtime" rows={providedRows} />
        {groups.map(({ track, rows }) => <ProjectGroup label={track.id} rows={rows} key={track.id} />)}
        <ProjectGroup label="capstone" rows={[capstoneRow]} />
      </div>
      <footer className="project-structure-footer">
        <p>Open any source file to edit it. A file changes state only when its behavioral checks pass.</p>
        <Link href="/workspace">Open project IDE →</Link>
      </footer>
    </section>
  );
}
