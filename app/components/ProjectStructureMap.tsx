"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { courseTracks, getTrackLessons } from "../lessons/course";
import { CAPSTONE_ENTRY_PATH, CANONICAL_BROWSER_CHAT_FILES } from "../content/browser-chat/project-template";
import { useLearnerState } from "../lib/learner-state";
import { RUNTIME_PATHS, useProjectState } from "../lib/project-workspace";
import { expectedProjectContractIdsForPath, projectFileStatus, projectLessonBuildStatus, projectResultsForFile, projectSourceProgress, projectUsesIntegratedEntryReceipt, trustedProjectResults, type ProjectFileStatus } from "../lib/project-file-status";
import { canonicalLessonSeeds, reconcileCanonicalProject } from "../lib/canonical-project";

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

function ProjectGroup({ label, rows, mobileDefaultOpen }: { label: string; rows: ProjectRow[]; mobileDefaultOpen: boolean }) {
  // Keep the server-rendered tree compact on phones; the viewport effect opens
  // every group on desktop and only the current group on mobile.
  const [open, setOpen] = useState(false);
  const complete = rows.filter((row) => row.status.complete).length;

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 650px), (max-width: 940px) and (max-height: 500px)");
    const syncForViewport = () => setOpen(mobile.matches ? mobileDefaultOpen : true);
    syncForViewport();
    mobile.addEventListener("change", syncForViewport);
    return () => mobile.removeEventListener("change", syncForViewport);
  }, [mobileDefaultOpen]);

  return (
    <details className="project-structure-group" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary><span>{label}/</span><em>{complete}/{rows.length} ready</em></summary>
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
    </details>
  );
}

export function ProjectStructureMap() {
  const learner = useLearnerState();
  const project = useProjectState();
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void reconcileCanonicalProject().then(() => {
      if (active) setReconciliationError(null);
    }).catch((error) => {
      if (active) setReconciliationError(error instanceof Error ? error.message : "The project couldn’t finish syncing.");
    });
    return () => { active = false; };
  }, []);
  const trustedResults = trustedProjectResults(project.tests);
  const expectedLessonEvidence = new Map(canonicalLessonSeeds(learner).map((seed) => [seed.path, seed]));
  const groups = courseTracks.map((track) => ({
    track,
    rows: getTrackLessons(track.id).map((lesson): ProjectRow => {
      const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
      const file = project.files[path];
      const expected = expectedLessonEvidence.get(path);
      return {
        path,
        filename: lesson.implementation.filename,
        status: projectLessonBuildStatus({
          projectSource: file?.content,
          verifiedSource: expected?.content,
          verifiedCells: expected?.verifiedCells ?? 0,
          totalCells: lesson.implementation.codeBlocks.length,
          trustedResults: trustedResults[path] ?? [],
          expectedContractIds: expectedProjectContractIdsForPath(path),
        }),
      };
    }),
  }));
  const sourceRows = groups.flatMap((group) => group.rows);
  const sourceProgress = projectSourceProgress(sourceRows.map((row) => row.status));
  const progressDetails = [
    sourceProgress.partial ? `${sourceProgress.partial} partially verified` : null,
    sourceProgress.needsWork ? `${sourceProgress.needsWork} ${sourceProgress.needsWork === 1 ? "needs" : "need"} work` : null,
    sourceProgress.notStarted ? `${sourceProgress.notStarted} not started` : null,
  ].filter(Boolean).join(" · ") || "Every lesson file is ready to build";
  const providedRows = runtimeRows.map(({ path, readOnly = false }): ProjectRow => ({
    path,
    filename: path.split("/").at(-1) ?? path,
    status: projectFileStatus({
      isLessonFile: false,
      readOnly,
      results: trustedResults[path] ?? [],
    }),
  }));
  const canonicalRows = CANONICAL_BROWSER_CHAT_FILES.map((definition): ProjectRow => {
    const results = projectResultsForFile(
      trustedResults,
      definition.path,
      definition.editable ? CAPSTONE_ENTRY_PATH : undefined,
    );
    const integratedEntryReceipt = projectUsesIntegratedEntryReceipt(
      trustedResults,
      definition.path,
      definition.editable ? CAPSTONE_ENTRY_PATH : undefined,
    );
    return {
      path: definition.path,
      filename: definition.path.split("/").at(-1) ?? definition.path,
      status: projectFileStatus({
        isLessonFile: false,
        readOnly: !definition.editable,
        requiresPassingTests: definition.editable,
        integratedEntryReceipt,
        results,
      }),
    };
  });
  const rowsForFolder = (folder: string) => canonicalRows.filter((row) => row.path.startsWith(`${folder}/`));
  const projectGroups = [
    { label: "runtime", rows: [...providedRows, ...rowsForFolder("runtime")] },
    ...groups.map(({ track, rows }) => ({ label: track.id, rows })),
    { label: "vendor", rows: rowsForFolder("vendor") },
    { label: "capstone", rows: rowsForFolder("capstone") },
  ];
  const firstIncompleteGroup = projectGroups.findIndex((group) => group.rows.some((row) => !row.status.complete));
  const mobileOpenGroup = firstIncompleteGroup >= 0 ? firstIncompleteGroup : 0;

  return (
    <section className="project-structure-map" aria-label="browser-chat project file structure">
      {reconciliationError ? (
        <p className="persistence-warning" role="alert">
          Project sync paused: {reconciliationError} <Link href="/workspace">Choose which recovery copy to use in the IDE.</Link>
        </p>
      ) : null}
      <header className="project-structure-root">
        <div><span>Project root</span><strong>browser-chat/</strong></div>
        <p><span>Current lesson files</span><strong>{sourceProgress.verified} / {sourceProgress.total} ready</strong></p>
      </header>
      <div className="project-structure-progress">
        <i
          aria-label="Current workspace build-ready lesson source"
          aria-valuemax={sourceProgress.total}
          aria-valuemin={0}
          aria-valuenow={sourceProgress.verified}
          aria-valuetext={`${sourceProgress.verified} of ${sourceProgress.total} lesson source files are build-ready; ${sourceProgress.partial} partially verified; ${sourceProgress.needsWork} ${sourceProgress.needsWork === 1 ? "needs" : "need"} work; ${sourceProgress.notStarted} not started`}
          role="progressbar"
        ><b style={{ width: `${sourceProgress.percentage}%` }} /></i>
        <p><strong>{sourceProgress.verified} build-ready</strong><span> · {progressDetails}</span></p>
      </div>
      <div className="project-structure-groups">
        {projectGroups.map((group, index) => (
          <ProjectGroup
            label={group.label}
            rows={group.rows}
            mobileDefaultOpen={index === mobileOpenGroup}
            key={group.label}
          />
        ))}
      </div>
      <footer className="project-structure-footer">
        <p>A lesson file is ready to build when its saved lesson result still matches the file, or when a current IDE run passes every expected check. A trusted failure overrides either one. You also need to finish the lab to complete the lesson.</p>
        <Link href="/workspace">Open project IDE →</Link>
      </footer>
    </section>
  );
}
