"use client";

import Link from "next/link";
import type { CourseTrack } from "@latent/course-kit";
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

function ProjectGroup({ label, rows, active = false }: { label: string; rows: ProjectRow[]; active?: boolean }) {
  return (
    <section className={`project-structure-group ${active ? "active" : ""}`}>
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

export function ProjectStructureMap({ activeCourseId }: { activeCourseId?: CourseTrack["id"] }) {
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
    <details className="course-project-structure">
      <summary>
        <div><span>Project structure</span><strong>browser-chat/</strong></div>
        <p><strong>{completed} complete</strong><span>{inProgress ? ` · ${inProgress} in progress` : ""} · {pending} pending</span></p>
        <em>View files</em>
      </summary>
      <div className="project-structure-groups">
        <ProjectGroup label="runtime" rows={providedRows} />
        {groups.map(({ track, rows }) => <ProjectGroup active={track.id === activeCourseId} label={track.id} rows={rows} key={track.id} />)}
        <ProjectGroup label="capstone" rows={[capstoneRow]} />
      </div>
    </details>
  );
}
