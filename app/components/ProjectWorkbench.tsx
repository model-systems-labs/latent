"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CodeEditor } from "../features/ide/CodeEditor";
import { courseLessons } from "../lessons/course";
import { llmSystemsCurriculum } from "../lessons/course";
import { sampleCharacterRnn } from "../lib/lab-engines";
import { loadLearnerState, useLearnerState } from "../lib/learner-state";
import { runProjectUnitTests } from "../lib/project-tests";
import { gateBrowserLabBuild } from "../lib/browser-lab";
import { createBuildArtifact } from "@latent/browser-lab";
import { getPersistenceContext } from "../platform/persistence/client";
import { exportPersistenceSnapshot, importPersistenceSnapshot, persistenceSnapshotBlob } from "../platform/persistence/portable";
import type { JsonValue } from "../platform/persistence/types";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { createCapstoneRuntimeDescriptor, llmRuntimeBindingManifest } from "../runtime/bindings";
import { downloadArtifact, latestProjectBuildArtifact, recordProjectBuildArtifact, recordValidatedProjectLessonArtifacts } from "../features/artifacts/lesson-artifacts";
import type { ArtifactEnvelope } from "@latent/artifact-runtime";
import { lessonImplementationSource } from "../lessons/implementation-source";
import { projectFileStatus, projectResultsForFile } from "../lib/project-file-status";
import { canonicalProjectSeeds } from "../lib/canonical-project";
import { CAPSTONE_ENTRY_PATH } from "../content/browser-chat/project-template";
import {
  compileProject,
  ensureProjectWorkspace,
  initializeProjectPersistence,
  saveProjectFile,
  saveProjectRuntime,
  saveProjectTestResults,
  selectProjectFile,
  useProjectState,
  type LessonProjectSeed,
  type ProjectCourse,
} from "../lib/project-workspace";

function lessonSeed(lesson: (typeof courseLessons)[number]): LessonProjectSeed {
  const local = loadLearnerState().lessons[lesson.id];
  const hidden = local?.hiddenBlocks ?? [];
  const answers = local?.answers ?? {};
  const contentFor = (usePractice: boolean) => lessonImplementationSource(lesson, lesson.implementation.codeBlocks
    .map((block, index) => `// ${String(index + 1).padStart(2, "0")} · ${block.label}\n${usePractice && hidden.includes(block.id) ? answers[block.id] ?? "" : block.code}`));
  return {
    path: `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`,
    courseId: lesson.courseId ?? "models",
    lessonId: lesson.id,
    title: lesson.title,
    content: contentFor(true),
    referenceContent: contentFor(false),
    verifiedCells: local?.verifiedCells.length ?? 0,
    totalCells: lesson.implementation.codeBlocks.length,
  };
}

const groups: Array<{ id: ProjectCourse; label: string }> = [
  { id: "runtime", label: "Runtime configuration" },
  { id: "models", label: "01 · Model foundations" },
  { id: "systems", label: "02 · Inference runtime" },
  { id: "backend", label: "03 · LLM serving" },
  { id: "product", label: "04 · Chat integration" },
  { id: "app", label: "05 · Capstone application" },
];

type ProjectTreeEntry = {
  path: string;
  courseId: ProjectCourse;
  title: string;
  lessonId?: string;
  verifiedCells: number;
  totalCells: number;
  readOnly?: boolean;
};

export function ProjectWorkbench() {
  const learner = useLearnerState();
  const student = learner.artifacts.characterRnn ?? null;
  const project = useProjectState();
  const selected = project.files[project.selectedPath];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("Edit a file, save it locally, then build the project.");
  const [working, setWorking] = useState(false);
  const [buildArtifact, setBuildArtifact] = useState<ArtifactEnvelope | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    void initializeProjectPersistence().then(() => {
      if (!active) return;
      ensureProjectWorkspace([...courseLessons.map(lessonSeed), ...canonicalProjectSeeds()]);
      const path = new URL(window.location.href).searchParams.get("file");
      if (path) selectProjectFile(path);
      void latestProjectBuildArtifact().then((artifact) => setBuildArtifact(artifact ?? null)).catch(() => setBuildArtifact(null));
    });
    return () => { active = false; };
  }, []);

  const filesByGroup = useMemo(() => groups.map((group) => ({
    ...group,
    files: group.id === "runtime" || group.id === "app"
      ? Object.values(project.files).filter((file) => file.courseId === group.id).sort((left, right) => left.path.localeCompare(right.path))
      : courseLessons.filter((lesson) => lesson.courseId === group.id).map((lesson): ProjectTreeEntry => {
          const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
          return project.files[path] ?? {
            path,
            courseId: group.id,
            title: lesson.title,
            lessonId: lesson.id,
            verifiedCells: 0,
            totalCells: lesson.implementation.codeBlocks.length,
          };
        }),
  })), [project.files]);
  const draft = selected ? drafts[selected.path] ?? selected.content : "";
  const dirty = Boolean(selected && draft !== selected.content);
  const trustedResults = project.tests.runner === "browser-lab-v1" ? project.tests.results : {};
  const statusForFile = (file: ProjectTreeEntry) => {
    const results = projectResultsForFile(
      trustedResults,
      file.path,
      file.courseId === "app" && !file.readOnly ? CAPSTONE_ENTRY_PATH : undefined,
    );
    return projectFileStatus({
      isLessonFile: Boolean(file.lessonId),
      readOnly: file.readOnly,
      requiresPassingTests: file.courseId === "app" && !file.readOnly,
      verifiedCells: file.verifiedCells,
      totalCells: file.totalCells,
      results,
    });
  };
  const verifiedFiles = filesByGroup.flatMap((group) => group.files).filter((file) => file.lessonId && statusForFile(file).complete).length;
  const selectedTests = selected
    ? projectResultsForFile(
        trustedResults,
        selected.path,
        selected.courseId === "app" && !selected.readOnly ? CAPSTONE_ENTRY_PATH : undefined,
      )
    : [];
  const allTests = Object.values(trustedResults).flat();
  const passingTests = allTests.filter((test) => test.passed).length;

  useEffect(() => {
    if (!selected || selected.readOnly || !dirty) return;
    const timer = window.setTimeout(() => {
      saveProjectFile(selected.path, draft);
      setMessage(`${selected.path} autosaved. Run its tests when you are ready.`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, selected]);

  const openFile = (path: string) => {
    setErrors([]);
    selectProjectFile(path);
    const url = new URL(window.location.href);
    url.searchParams.set("file", path);
    window.history.replaceState({}, "", url);
  };

  const save = () => {
    if (!selected || selected.readOnly) return project;
    const next = saveProjectFile(selected.path, draft);
    setDrafts((current) => ({ ...current, [selected.path]: draft }));
    setMessage(`${selected.path} saved on this device. Build to apply runtime changes.`);
    return next;
  };

  const build = async () => {
    if (working) return;
    setWorking(true);
    const saved = save();
    setMessage("Compiling the virtual project in an isolated worker…");
    try {
      const run = await runProjectUnitTests(saved.files, saved.runtime);
      saveProjectTestResults(run.results, true, run.sourceHash, run.projectRevision);
      const gate = gateBrowserLabBuild(run.results);
      if (!gate.canPromote) {
        setErrors([]);
        setMessage(`Build blocked: ${gate.failures.length} of ${gate.total} unit tests failed. The last passing build remains active.`);
        return;
      }
      const result = compileProject(saved.files, saved.runtime);
      if (!result.ok || !run.program || !run.receipt || !run.persistenceReceipt) {
        setErrors(result.ok ? ["The isolated build did not produce a promotable receipt."] : result.errors);
        setMessage("Build stopped. Fix the failing compiler or runtime contract and run again.");
        return;
      }
      const { repositories } = await getPersistenceContext();
      const [existingBuilds, fileRecords] = await Promise.all([
        repositories.builds.list("browser-chat"),
        repositories.projects.listFiles("browser-chat"),
      ]);
      await createBuildArtifact({
        artifactId: `artifact-${crypto.randomUUID()}`,
        buildNumber: (existingBuilds.at(-1)?.buildNumber ?? 0) + 1,
        program: run.program,
        receipt: run.receipt,
        bindingManifest: llmRuntimeBindingManifest,
        expectedCases: llmSystemsContractSuite.contracts.flatMap((contract) => contract.cases.map((exerciseCase) => ({ contractId: contract.id, caseId: exerciseCase.id }))),
      });
      const promoted = await repositories.builds.promotePassing({
        projectId: "browser-chat",
        projectRevision: run.projectRevision,
        sourceTreeHash: run.sourceHash,
        contractVersion: llmSystemsContractSuite.contractVersion,
        testReceiptId: run.persistenceReceipt.id,
        fileHashes: Object.fromEntries(fileRecords.map((file) => [file.path, file.sourceHash])),
        bundles: Object.fromEntries(run.program.modules.map((compiledModule) => [compiledModule.modulePath, compiledModule.code])),
        bundleHashes: Object.fromEntries(run.program.modules.map((compiledModule) => [compiledModule.modulePath, compiledModule.codeHash])),
        runtimeConfig: result.runtime as unknown as JsonValue,
        bindings: Object.fromEntries(llmRuntimeBindingManifest.bindings.map((binding) => [binding.capability, { modulePath: binding.modulePath, exportName: binding.exportName }])),
      });
      const descriptor = await createCapstoneRuntimeDescriptor(promoted);
      const activeRuntime = { ...result.runtime, buildNumber: promoted.buildNumber, builtAt: promoted.createdAt };
      setErrors([]);
      let nextPreview: string;
      if (student) {
        const generated = sampleCharacterRnn(
          student.checkpoint,
          "the signal crossed",
          activeRuntime.model.maxTokens,
          activeRuntime.model.temperature,
          activeRuntime.model.seed,
          activeRuntime.model.topK,
        );
        nextPreview = `${activeRuntime.interface.responsePrefix}…the signal crossed${generated}`;
      } else {
        nextPreview = `${activeRuntime.interface.responsePrefix}Build ready. Train the Module 01 model to generate a checkpoint-backed preview.`;
      }
      saveProjectRuntime(activeRuntime, nextPreview);
      try {
        await recordValidatedProjectLessonArtifacts(saved.files, run.results);
        const artifact = await recordProjectBuildArtifact({
          buildId: promoted.id,
          buildNumber: promoted.buildNumber,
          sourceTreeHash: promoted.sourceTreeHash,
          testedModules: descriptor.contributions.length,
          totalTests: run.results.length,
        });
        setBuildArtifact(artifact);
        setMessage(`Build ${promoted.buildNumber} is active. Artifact ${artifact.contentHash.slice(7, 19)} assembles ${descriptor.contributions.length} tested lesson modules.`);
      } catch (artifactError) {
        setMessage(`Build ${promoted.buildNumber} is active, but its portable artifact could not be stored: ${artifactError instanceof Error ? artifactError.message : "local storage is unavailable"}`);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The isolated build failed."]);
      setMessage("Build stopped safely. The last passing build remains active.");
    } finally {
      setWorking(false);
    }
  };

  const runTests = async (onlyPath?: string) => {
    if (working) return;
    setWorking(true);
    const saved = save();
    setMessage(onlyPath ? "Running this file in the isolated test worker…" : "Compiling and running the complete isolated test suite…");
    try {
      const run = await runProjectUnitTests(saved.files, saved.runtime, onlyPath);
      saveProjectTestResults(run.results, !onlyPath, run.sourceHash, run.projectRevision);
      const failed = run.results.filter((test) => !test.passed).length;
      setErrors([]);
      setMessage(failed ? `${failed} of ${run.results.length} unit tests failed. The active build was not changed.` : `${run.results.length} unit tests pass in the sandbox. No build was created.`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The isolated test run failed."]);
      setMessage("Tests stopped safely. The active build was not changed.");
    } finally {
      setWorking(false);
    }
  };

  const exportProgress = async () => {
    const { database } = await getPersistenceContext();
    const snapshot = await exportPersistenceSnapshot(database);
    const url = URL.createObjectURL(persistenceSnapshotBlob(snapshot));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `latent-browser-chat-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Project, progress, builds, checkpoints, and conversations exported.");
  };

  const importProgress = async (file: File) => {
    const { database } = await getPersistenceContext();
    await importPersistenceSnapshot(database, await file.text(), { mode: "merge" });
    setMessage("Progress imported. Reloading the project database…");
    window.location.reload();
  };

  return (
    <section className="project-workbench" aria-label="Editable capstone project">
      <header>
        <div className="project-header-actions"><div className="project-progress"><strong>{verifiedFiles}/{llmSystemsCurriculum.lessonCount}</strong><span>lesson files verified</span></div><div><button type="button" onClick={() => void exportProgress()}>Export</button><button type="button" onClick={() => importRef.current?.click()}>Import</button><input ref={importRef} type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProgress(file); event.currentTarget.value = ""; }} aria-label="Import saved Latent progress" /></div></div>
      </header>
      <div className="project-workbench-grid">
        <nav className="project-tree" aria-label="Project files">
          {filesByGroup.map((group) => (
            <section key={group.id}>
              <span>{group.label}</span>
              {group.files.map((file) => {
                const status = statusForFile(file);
                const verifiedCells = file.verifiedCells;
                return (
                  <button
                    aria-label={`${file.path}, ${status.label}${file.lessonId ? `, ${verifiedCells} of ${file.totalCells} checks verified` : ""}`}
                    className={`${file.path === project.selectedPath ? "active " : ""}status-${status.tone}`}
                    type="button"
                    onClick={() => openFile(file.path)}
                    key={file.path}
                  >
                    <i />
                    <span>{file.path.split("/").at(-1)}</span>
                    <em>{status.label}</em>
                  </button>
                );
              })}
            </section>
          ))}
          <Link className="project-run-capstone" href="/capstone">Run active capstone →</Link>
        </nav>
        <div className="project-editor-panel">
          <header><div><span>{selected?.path ?? "No file selected"}</span><strong>{selected?.title}</strong></div><div><i className={dirty ? "dirty" : "saved"} />{selected?.readOnly ? "Course library · read only" : dirty ? "Unsaved changes" : "Saved locally"}</div></header>
          {selected ? <CodeEditor path={selected.path} value={draft} readOnly={selected.readOnly} onChange={(value) => setDrafts((current) => ({ ...current, [selected.path]: value }))} onSave={save} /> : null}
          <footer><p>{selected?.readOnly ? "This is the numerical runtime imported by model lessons. Its source is visible, versioned, and protected from accidental edits." : message}</p><div><button type="button" onClick={() => selected && setDrafts((current) => ({ ...current, [selected.path]: selected.referenceContent }))} disabled={working || !selected || selected.readOnly || draft === selected?.referenceContent}>Restore reference</button><button type="button" onClick={save} disabled={working || selected?.readOnly || !dirty}>Save now</button><button className="build" type="button" onClick={() => void build()} disabled={working}>{working ? "Running…" : "Test, build & run"}</button></div></footer>
        </div>
        <aside className="project-inspector" aria-live="polite">
          <section className="unit-test-panel">
            <header><div><span>Unit tests</span><strong>{allTests.length ? `${passingTests}/${allTests.length} passing` : "Not run"}</strong></div><button type="button" onClick={() => void runTests()} disabled={working}>Run all {llmSystemsCurriculum.testCount + 5}</button></header>
            <div className="selected-test-heading"><span>{selected?.path}</span><button type="button" onClick={() => selected && void runTests(selected.path)} disabled={working || !selected || selected.readOnly}>Run file tests</button></div>
            <div className="unit-test-list">
              {selectedTests.length ? selectedTests.map((test) => <article className={test.passed ? "passed" : "failed"} key={test.id}><i>{test.passed ? "✓" : "×"}</i><div><strong>{test.label}</strong><p>{test.detail}</p></div></article>) : <p>Select “Run file tests” to verify this module independently of the build.</p>}
            </div>
          </section>
          <section className="project-output">
            <header><span>Last passing build</span><strong>#{project.runtime.buildNumber}</strong></header>
            {errors.length ? <div className="project-errors">{errors.map((error) => <p key={error}>{error}</p>)}</div> : (
              <>
                <dl>
                  <div><dt>temperature</dt><dd>{project.runtime.model.temperature}</dd></div>
                  <div><dt>top-k</dt><dd>{project.runtime.model.topK || "off"}</dd></div>
                  <div><dt>event batch</dt><dd>{project.runtime.transport.wordsPerEvent} words</dd></div>
                  <div><dt>assistant</dt><dd>{project.runtime.interface.assistantName}</dd></div>
                </dl>
                {buildArtifact ? <article className="project-build-artifact"><span>Portable build artifact</span><p>{buildArtifact.links.length} lesson artifacts · {buildArtifact.contentHash.slice(7, 19)}</p><button type="button" onClick={() => void downloadArtifact(buildArtifact)}>Download build + lineage</button></article> : null}
                {project.output.previous ? <article><span>Previous build</span><p>{project.output.previous}</p></article> : null}
                <article className="active"><span>Active build</span><p>{project.output.current || "Pass the suite and build to create a checkpoint-backed preview."}</p></article>
              </>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
