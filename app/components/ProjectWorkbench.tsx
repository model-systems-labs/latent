"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CodeEditor } from "../features/ide/CodeEditor";
import { PythonInspector, PythonRuntimeActions, usePythonExecution } from "../features/ide/PythonExecution";
import { courseLessons } from "../lessons/course";
import { llmSystemsCurriculum } from "../lessons/course";
import { sampleCharacterRnn } from "@latent/model-lab/character-rnn";
import { flushLearnerPersistence, sourceBoundPythonRnnArtifactFromCheckpoint, useLearnerState } from "../lib/learner-state";
import { runProjectUnitTests } from "../lib/project-tests";
import { gateBrowserLabBuild, type BrowserLabTestResult } from "../lib/browser-lab";
import { createBuildArtifact } from "@latent/browser-lab";
import { getPersistenceContext } from "../platform/persistence/client";
import { exportPersistenceSnapshot, importPersistenceSnapshot, persistenceSnapshotBlob } from "../platform/persistence/portable";
import type { JsonValue } from "../platform/persistence/types";
import type { FileRevisionRecord } from "../platform/persistence/types";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { createCapstoneRuntimeDescriptor, llmRuntimeBindingManifest } from "../runtime/bindings";
import { downloadArtifact, latestProjectBuildArtifact, recordProjectBuildArtifact, recordValidatedProjectLessonArtifacts } from "../features/artifacts/lesson-artifacts";
import type { ArtifactEnvelope } from "@latent/artifact-runtime";
import { expectedProjectContractIdsForPath, projectFileStatus, projectLessonBuildStatus, projectResultsForFile, projectUsesIntegratedEntryReceipt, trustedProjectResults } from "../lib/project-file-status";
import { canonicalLessonSeeds, reconcileCanonicalProject } from "../lib/canonical-project";
import { PYTHON_CHARACTER_RNN_PATH } from "../features/python/character-rnn-source";
import { CAPSTONE_COMPONENT_PATH, CAPSTONE_ENTRY_PATH } from "../content/browser-chat/project-template";
import { portfolioProjectBlob, portfolioReadiness } from "../lib/portfolio-export";
import { downloadBrowserBlob } from "../lib/browser-download";
import { recordLearningEvent } from "../lib/learning-analytics";
import { actionableBuildFailurePath, draftSnapshotIsCurrent, revisionCanRestore, revisionResponseIsCurrent } from "../lib/ide-async-guards";
import {
  compileProject,
  discardProjectDraftRecoveryCandidate,
  flushProjectPersistence,
  listProjectDraftRecoveryCandidates,
  loadProjectDraftRecoveryCandidate,
  PROJECT_DRAFT_RECOVERY_KEY,
  saveProjectFile,
  saveProjectRuntime,
  saveProjectTestResults,
  selectProjectFile,
  useProjectState,
  useProjectPersistenceError,
  projectActiveBuildIdentity,
  stageProjectDraftRecovery,
  type ProjectCourse,
} from "../lib/project-workspace";

const PythonCodeEditor = lazy(() => import("../features/ide/PythonCodeEditor").then((module) => ({
  default: module.PythonCodeEditor,
})));

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
  content?: string;
  lessonId?: string;
  verifiedCells: number;
  totalCells: number;
  readOnly?: boolean;
};

type MobilePanel = "files" | "code" | "tests" | "output";

function draftDifferenceSummary(current: string, candidate: string) {
  const currentLines = current.split("\n");
  const candidateLines = candidate.split("\n");
  let prefix = 0;
  while (prefix < currentLines.length && prefix < candidateLines.length && currentLines[prefix] === candidateLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < currentLines.length - prefix
    && suffix < candidateLines.length - prefix
    && currentLines[currentLines.length - 1 - suffix] === candidateLines[candidateLines.length - 1 - suffix]
  ) suffix += 1;
  const removed = currentLines.length - prefix - suffix;
  const added = candidateLines.length - prefix - suffix;
  const preview = candidateLines.slice(prefix, candidateLines.length - suffix || undefined)
    .find((line) => line.trim())
    ?.trim()
    .replace(/\s+/g, " ")
    .slice(0, 52);
  return `+${added} / −${removed} lines${preview ? ` · ${preview}${preview.length === 52 ? "…" : ""}` : ""}`;
}

export function ProjectWorkbench() {
  const learner = useLearnerState();
  const student = learner.artifacts.characterRnn ?? null;
  const persistedPythonArtifact = useMemo(() => student?.origin === "python" ? {
    finalLoss: student.finalLoss,
    parameters: student.parameters,
    vocabularySize: student.vocabularySize,
    trainedAt: student.trainedAt,
    origin: "python" as const,
  } : null, [student]);
  const project = useProjectState();
  const persistenceError = useProjectPersistenceError();
  const selected = project.files[project.selectedPath];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [buildFailures, setBuildFailures] = useState<BrowserLabTestResult[]>([]);
  const [message, setMessage] = useState("Restoring the device-local project before editing…");
  const [projectReady, setProjectReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [buildArtifact, setBuildArtifact] = useState<ArtifactEnvelope | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("code");
  const [revisions, setRevisions] = useState<FileRevisionRecord[]>([]);
  const [pendingRevision, setPendingRevision] = useState<string | null>(null);
  const [confirmReferenceRestore, setConfirmReferenceRestore] = useState(false);
  const [, setRecoveryRevision] = useState(0);
  const importRef = useRef<HTMLInputElement | null>(null);
  const draftEpochRef = useRef(0);
  const revisionRequestRef = useRef(0);
  const selectedPathRef = useRef<string | null>(selected?.path ?? null);
  const pendingDraftRef = useRef<{ path: string; content: string; dirty: boolean; readOnly: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await reconcileCanonicalProject();
        if (!active) return;
        const path = new URL(window.location.href).searchParams.get("file");
        if (path) {
          selectedPathRef.current = path;
          revisionRequestRef.current += 1;
          setRevisions([]);
          selectProjectFile(path);
        }
        setProjectReady(true);
        setMessage("Edit a file, save it locally, then build the project.");
        void latestProjectBuildArtifact().then((artifact) => setBuildArtifact(artifact ?? null)).catch(() => setBuildArtifact(null));
      } catch (error) {
        if (!active) return;
        setMessage(`The project could not finish restoring: ${error instanceof Error ? error.message : "browser storage is unavailable"}`);
      }
    })();
    return () => { active = false; };
  }, []);

  const filesByGroup = useMemo(() => groups.map((group) => {
    const lessonEntries = courseLessons.filter((lesson) => lesson.courseId === group.id).map((lesson): ProjectTreeEntry => {
      const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
      return project.files[path] ?? {
        path,
        courseId: group.id,
        title: lesson.title,
        lessonId: lesson.id,
        verifiedCells: 0,
        totalCells: lesson.implementation.codeBlocks.length,
      };
    });
    const lessonPaths = new Set(lessonEntries.map((file) => file.path));
    const projectEntries = Object.values(project.files)
      .filter((file) => file.courseId === group.id && !lessonPaths.has(file.path))
      .sort((left, right) => left.path.localeCompare(right.path));
    return {
      ...group,
      files: group.id === "runtime" || group.id === "app"
        ? Object.values(project.files).filter((file) => file.courseId === group.id).sort((left, right) => left.path.localeCompare(right.path))
        : [...lessonEntries, ...projectEntries],
    };
  }), [project.files]);
  const draft = selected ? drafts[selected.path] ?? selected.content : "";
  const dirty = Boolean(selected && draft !== selected.content);
  const isPythonFile = Boolean(selected?.path.endsWith(".py"));
  const SelectedCodeEditor = isPythonFile ? PythonCodeEditor : CodeEditor;
  const recoveryCandidates = selected
    ? listProjectDraftRecoveryCandidates(selected.path).filter((candidate) => candidate.content !== draft)
    : [];
  useEffect(() => {
    pendingDraftRef.current = selected ? {
      path: selected.path,
      content: draft,
      dirty,
      readOnly: Boolean(selected.readOnly),
    } : null;
  }, [dirty, draft, selected]);
  useEffect(() => {
    selectedPathRef.current = selected?.path ?? null;
  }, [selected?.path]);
  const flushPendingDraft = useCallback(() => {
    const pending = pendingDraftRef.current;
    if (pending?.dirty && !pending.readOnly) saveProjectFile(pending.path, pending.content);
  }, []);
  const flushCurrentDraft = useCallback(() => {
    if (selected && dirty && !selected.readOnly) saveProjectFile(selected.path, draft);
  }, [dirty, draft, selected]);
  const trustedResults = trustedProjectResults(project.tests);
  const expectedLessonEvidence = new Map(canonicalLessonSeeds(learner).map((seed) => [seed.path, seed]));
  const statusForFile = (file: ProjectTreeEntry) => {
    const sharedCompilePath = file.courseId === "app" && !file.readOnly ? CAPSTONE_ENTRY_PATH : undefined;
    const results = projectResultsForFile(
      trustedResults,
      file.path,
      sharedCompilePath,
    );
    if (file.lessonId) {
      const expected = expectedLessonEvidence.get(file.path);
      return projectLessonBuildStatus({
        projectSource: file.content,
        verifiedSource: expected?.content,
        verifiedCells: expected?.verifiedCells ?? 0,
        totalCells: file.totalCells,
        trustedResults: results,
        expectedContractIds: expectedProjectContractIdsForPath(file.path),
      });
    }
    return projectFileStatus({
      isLessonFile: false,
      readOnly: file.readOnly,
      requiresPassingTests: file.courseId === "app" && !file.readOnly,
      integratedEntryReceipt: projectUsesIntegratedEntryReceipt(trustedResults, file.path, sharedCompilePath),
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
  const portfolioStatus = portfolioReadiness({ project, learner, lessons: courseLessons });

  const refreshRevisions = useCallback(async (path?: string) => {
    if (!path) {
      revisionRequestRef.current += 1;
      setRevisions([]);
      return;
    }
    if (selectedPathRef.current !== path) return;
    const requestId = ++revisionRequestRef.current;
    try {
      const { repositories } = await getPersistenceContext();
      const nextRevisions = await repositories.projects.listFileRevisions("browser-chat", path);
      if (revisionResponseIsCurrent({
        requestedPath: path,
        requestId,
        selectedPath: selectedPathRef.current,
        currentRequestId: revisionRequestRef.current,
      })) setRevisions(nextRevisions);
    } catch {
      if (revisionResponseIsCurrent({
        requestedPath: path,
        requestId,
        selectedPath: selectedPathRef.current,
        currentRequestId: revisionRequestRef.current,
      })) setRevisions([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshRevisions(selected?.path), 0);
    return () => window.clearTimeout(timer);
  }, [refreshRevisions, selected?.path]);

  useEffect(() => {
    if (!selected || selected.readOnly || !dirty) return;
    const scheduled = { path: selected.path, content: draft, epoch: draftEpochRef.current };
    const timer = window.setTimeout(() => {
      const recoveryStored = stageProjectDraftRecovery(selected.path, draft);
      saveProjectFile(selected.path, draft);
      setMessage(recoveryStored
        ? `${selected.path} recovery copy saved; syncing file history…`
        : `${selected.path} is syncing. Keep this tab open until storage confirms.`);
      void flushProjectPersistence().then(() => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage(`${selected.path} autosaved. Run its tests when you are ready.`);
        }
      }).catch((error) => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage(recoveryStored
            ? `File-history sync failed, but ${selected.path} remains in the browser recovery copy. ${error instanceof Error ? error.message : "Reload before editing in another tab."}`
            : `This browser could not save ${selected.path}. Copy your code before leaving this page.`);
        }
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, selected]);

  useEffect(() => {
    const flushBeforePageExit = () => flushPendingDraft();
    const refreshRecoveryCandidates = (event: StorageEvent) => {
      if (event.key?.startsWith(PROJECT_DRAFT_RECOVERY_KEY) || event.key === "latent-project-draft-recovery-v1") {
        setRecoveryRevision((revision) => revision + 1);
      }
    };
    window.addEventListener("pagehide", flushBeforePageExit);
    window.addEventListener("storage", refreshRecoveryCandidates);
    return () => {
      window.removeEventListener("pagehide", flushBeforePageExit);
      window.removeEventListener("storage", refreshRecoveryCandidates);
      flushPendingDraft();
    };
  }, [flushPendingDraft]);

  const openFile = (path: string) => {
    flushCurrentDraft();
    selectedPathRef.current = path;
    revisionRequestRef.current += 1;
    setRevisions([]);
    setErrors([]);
    setPendingRevision(null);
    setConfirmReferenceRestore(false);
    selectProjectFile(path);
    const url = new URL(window.location.href);
    url.searchParams.set("file", path);
    window.history.replaceState({}, "", url);
    setMobilePanel("code");
  };

  const save = (announce = true) => {
    if (!selected || selected.readOnly) return project;
    const scheduled = { path: selected.path, content: draft, epoch: draftEpochRef.current };
    const recoveryStored = stageProjectDraftRecovery(selected.path, draft);
    const next = saveProjectFile(selected.path, draft);
    setDrafts((current) => ({ ...current, [selected.path]: draft }));
    if (announce) {
      setMessage(recoveryStored
        ? `${selected.path} recovery copy saved; syncing file history…`
        : `${selected.path} is syncing. Keep this tab open until storage confirms.`);
      void flushProjectPersistence().then(() => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage(`${selected.path} saved on this device. Build to apply runtime changes.`);
        }
      }).catch((error) => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage(recoveryStored
            ? `File-history sync failed, but ${selected.path} remains in the browser recovery copy. ${error instanceof Error ? error.message : "Reload before editing in another tab."}`
            : `This browser could not save ${selected.path}. Copy your code before leaving this page.`);
        }
      });
    }
    window.setTimeout(() => void refreshRevisions(selected.path), 800);
    return next;
  };

  const pythonExecution = usePythonExecution({
    enabled: isPythonFile,
    canTestAndTrain: selected?.path === PYTHON_CHARACTER_RNN_PATH,
    path: selected?.path ?? "",
    source: draft,
    persistedArtifact: persistedPythonArtifact,
    saveBeforeRun: async () => {
      if (!selected || selected.readOnly || !selected.path.endsWith(".py")) {
        throw new Error("Select an editable Python file before running the interpreter.");
      }
      save(false);
      await flushProjectPersistence();
    },
    showPanel: setMobilePanel,
  });
  const interfaceWorking = working || pythonExecution.busy;

  const build = async () => {
    if (working) return;
    setWorking(true);
    setBuildFailures([]);
    const saved = save(false);
    const runDraftEpoch = draftEpochRef.current;
    setMessage("Compiling the virtual project in an isolated worker…");
    try {
      const run = await runProjectUnitTests(saved.files, saved.runtime);
      const committed = await saveProjectTestResults({
        results: run.results,
        expectedIdsByPath: run.expectedIdsByPath,
        replaceAll: true,
        sourceTreeHash: run.sourceHash,
        projectRevision: run.projectRevision,
        contractVersion: run.contractVersion,
        isClientSnapshotCurrent: () => draftEpochRef.current === runDraftEpoch,
      });
      if (!committed.accepted) {
        setErrors([]);
        setMessage(committed.reason === "client-draft" || committed.reason === "stale-source"
          ? "This run’s evidence was discarded because the project changed while tests were running. Run again against the current saved files."
          : "This run’s evidence was discarded because its contract scope is no longer current. Reload the IDE and run again.");
        setMobilePanel("output");
        return;
      }
      const gate = gateBrowserLabBuild(run.results);
      if (!gate.canPromote) {
        setErrors([]);
        setBuildFailures(gate.failures);
        setMessage(`Build blocked: ${gate.failures.length} of ${gate.total} unit tests failed. ${saved.activeBuild ? "The last passing build remains active." : "No active build was created."}`);
        void recordLearningEvent("project_build_completed", { outcome: "failed", count: gate.total - gate.failures.length });
        setMobilePanel("output");
        return;
      }
      const result = compileProject(saved.files, saved.runtime);
      if (!result.ok || !run.program || !run.receipt || !run.persistenceReceipt) {
        setErrors(result.ok ? ["The isolated build did not produce a promotable receipt."] : result.errors);
        setMessage("Build stopped. Fix the failing compiler or runtime contract and run again.");
        setMobilePanel("output");
        return;
      }
      // A passing source run is not enough to promote the model: wait until
      // the trainer's exact checkpoint has reached durable storage first.
      await flushLearnerPersistence();
      const { database, repositories } = await getPersistenceContext();
      const fileRecords = await repositories.projects.listFiles("browser-chat");
      const characterRnnFile = fileRecords.find((file) => file.path === PYTHON_CHARACTER_RNN_PATH);
      if (!characterRnnFile) {
        throw new Error(`Build blocked: ${PYTHON_CHARACTER_RNN_PATH} is not saved. Save it, test and train it, then build again.`);
      }
      const characterRnnCheckpoints = await database.checkpoints
        .where("projectId")
        .equals("browser-chat")
        .filter((record) => record.kind === "character-rnn")
        .sortBy("createdAt");
      const buildStudent = [...characterRnnCheckpoints]
        .reverse()
        .map((record) => sourceBoundPythonRnnArtifactFromCheckpoint(
          record,
          PYTHON_CHARACTER_RNN_PATH,
          characterRnnFile.sourceHash,
        ))
        .find((artifact) => artifact !== null) ?? null;
      if (!buildStudent?.checkpointId) {
        throw new Error(`Build blocked: test and train the current ${PYTHON_CHARACTER_RNN_PATH} file after its latest edit, then run Test, build & run again.`);
      }
      // This in-memory artifact is a pre-promotion integrity gate. Its number
      // is non-authoritative; the repository assigns the actual immutable
      // build number during promotion. Avoid certifying unrelated historical
      // builds here so a stale pre-upgrade build cannot block a fresh rebuild.
      await createBuildArtifact({
        artifactId: `artifact-${crypto.randomUUID()}`,
        buildNumber: Math.max(1, saved.runtime.buildNumber),
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
        checkpointId: buildStudent.checkpointId,
      });
      const descriptor = await createCapstoneRuntimeDescriptor(promoted);
      const activeRuntime = { ...result.runtime, buildNumber: promoted.buildNumber, builtAt: promoted.createdAt };
      setErrors([]);
      const generated = sampleCharacterRnn(
        buildStudent.checkpoint,
        "the signal crossed",
        activeRuntime.model.maxTokens,
        activeRuntime.model.temperature,
        activeRuntime.model.seed,
        activeRuntime.model.topK,
      );
      const nextPreview = `${activeRuntime.interface.responsePrefix}…the signal crossed${generated}`;
      saveProjectRuntime(activeRuntime, nextPreview, projectActiveBuildIdentity(promoted));
      void recordLearningEvent("project_build_completed", { outcome: "passed", count: run.results.length });
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
        setMessage(`Build ${promoted.buildNumber} is active. Artifact ${artifact.contentHash.slice(7, 19)} binds ${descriptor.contributions.length} exact passing Python files to browser adapters checked against the same contracts.`);
        setMobilePanel("output");
      } catch (artifactError) {
        setMessage(`Build ${promoted.buildNumber} is active, but its portable artifact could not be stored: ${artifactError instanceof Error ? artifactError.message : "local storage is unavailable"}`);
        setMobilePanel("output");
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The isolated build failed."]);
      setMessage(saved.activeBuild ? "Build stopped safely. The last passing build remains active." : "Build stopped safely. No active build was created.");
      setMobilePanel("output");
    } finally {
      setWorking(false);
    }
  };

  const runTests = async (onlyPath?: string) => {
    if (working) return;
    setWorking(true);
    const saved = save(false);
    const runDraftEpoch = draftEpochRef.current;
    setMessage(onlyPath ? "Running this file in the isolated test worker…" : "Compiling and running the complete isolated test suite…");
    try {
      const run = await runProjectUnitTests(saved.files, saved.runtime, onlyPath);
      const committed = await saveProjectTestResults({
        results: run.results,
        expectedIdsByPath: run.expectedIdsByPath,
        replaceAll: !onlyPath,
        sourceTreeHash: run.sourceHash,
        projectRevision: run.projectRevision,
        contractVersion: run.contractVersion,
        isClientSnapshotCurrent: () => draftEpochRef.current === runDraftEpoch,
      });
      if (!committed.accepted) {
        setErrors([]);
        setMessage(committed.reason === "client-draft" || committed.reason === "stale-source"
          ? "This run’s evidence was discarded because the project changed while tests were running. Run again against the current saved files."
          : "This run’s evidence was discarded because its contract scope is no longer current. Reload the IDE and run again.");
        setMobilePanel("tests");
        return;
      }
      const failed = run.results.filter((test) => !test.passed).length;
      setErrors([]);
      setMessage(failed ? `${failed} of ${run.results.length} unit tests failed. The active build was not changed.` : `${run.results.length} unit tests pass in the sandbox. No build was created.`);
      void recordLearningEvent("project_tests_completed", { outcome: failed ? "failed" : "passed", count: run.results.length - failed });
      setMobilePanel("tests");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The isolated test run failed."]);
      setMessage("Tests stopped safely. The active build was not changed.");
    } finally {
      setWorking(false);
    }
  };

  const exportProgress = async () => {
    try {
      flushCurrentDraft();
      await flushProjectPersistence();
      const { database } = await getPersistenceContext();
      const snapshot = await exportPersistenceSnapshot(database);
      downloadBrowserBlob(persistenceSnapshotBlob(snapshot), `latent-browser-chat-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage("Project, progress, builds, checkpoints, and conversations exported.");
    } catch (error) {
      setMessage(`Backup stopped because the latest draft could not be synchronized: ${error instanceof Error ? error.message : "browser storage is unavailable"}`);
    }
  };

  const importProgress = async (file: File) => {
    if (working) return;
    setWorking(true);
    setErrors([]);
    setMessage("Validating the backup before changing device-local progress…");
    try {
      const serialized = await file.text();
      const { database } = await getPersistenceContext();
      await importPersistenceSnapshot(database, serialized, { mode: "merge" });
      setMessage("Progress imported. Reloading the project database…");
      window.location.reload();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The selected file is not a valid Latent backup.";
      setErrors([`Import failed: ${detail}`]);
      setMessage("Nothing was imported. The current project remains open and unchanged.");
      setMobilePanel("output");
    } finally {
      setWorking(false);
    }
  };

  const exportPortfolio = () => {
    if (!portfolioStatus.ready) {
      const awaitingMatchingBuild = portfolioStatus.completedLessons.length === courseLessons.length
        && portfolioStatus.fullSuitePasses
        && !portfolioStatus.activeBuildMatchesTests;
      setMessage(awaitingMatchingBuild
        ? "The current workspace’s full suite passes, but those receipts have not been promoted into the matching active build snapshot. Use Test, build & run, then export the portfolio."
        : `Portfolio ZIP unlocks after ${courseLessons.length}/${courseLessons.length} lessons are complete and the current workspace’s ${portfolioStatus.requiredTests}/${portfolioStatus.requiredTests} full-suite receipt matches the active build snapshot. Use Test, build & run; use Backup for unfinished work.`);
      setMobilePanel("output");
      return;
    }
    downloadBrowserBlob(portfolioProjectBlob({ project, learner, lessons: courseLessons }), `browser-chat-portfolio-${new Date().toISOString().slice(0, 10)}.zip`);
    setMessage("Portfolio source archive exported with a README, test report, architecture, and backend replacement guide.");
  };

  const restoreRevision = (revision: FileRevisionRecord) => {
    if (!selected || selected.readOnly) return;
    if (!revisionCanRestore(selected.path, revision.path)) {
      setPendingRevision(null);
      setMessage(`Revision r${revision.revision} belongs to ${revision.path}, not the currently open file. Its contents were not restored.`);
      return;
    }
    if (pendingRevision !== revision.id) {
      setPendingRevision(revision.id);
      setMessage(`Revision ${revision.revision} will replace the current draft. Press restore again to confirm.`);
      return;
    }
    draftEpochRef.current += 1;
    setDrafts((current) => ({ ...current, [selected.path]: revision.content }));
    saveProjectFile(selected.path, revision.content);
    setPendingRevision(null);
    setMessage(`Revision ${revision.revision} restored. Tests were invalidated because the source changed.`);
    setMobilePanel("code");
    window.setTimeout(() => void refreshRevisions(selected.path), 800);
  };

  return (
    <section className="project-workbench" aria-label="Editable capstone project">
      <header>
        <div className="project-header-actions"><div className="project-progress"><strong>{verifiedFiles}/{llmSystemsCurriculum.lessonCount}</strong><span>lesson files verified</span></div><div><button type="button" onClick={exportPortfolio} aria-label={portfolioStatus.ready ? "Download verified portfolio ZIP" : "Portfolio ZIP — complete every lesson and create a passing full build to unlock"} title={portfolioStatus.ready ? "Download the verified standalone project" : "Finish every lesson and create a passing full build first"}>Portfolio ZIP</button><button type="button" onClick={() => void exportProgress()} disabled={working}>Backup</button><button type="button" onClick={() => importRef.current?.click()} disabled={working}>Import</button><input ref={importRef} type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProgress(file); event.currentTarget.value = ""; }} aria-label="Import saved Latent progress" /></div></div>
      </header>
      <nav className="mobile-ide-tabs" aria-label="Choose a project workspace view">
        {(["files", "code", "tests", "output"] as const).map((panel) => (
          <button type="button" aria-pressed={mobilePanel === panel} className={mobilePanel === panel ? "active" : ""} onClick={() => setMobilePanel(panel)} key={panel}>
            {panel === "files" ? "Files" : panel === "code" ? "Code" : panel === "tests" ? `Tests${isPythonFile && pythonExecution.tests.length ? ` ${pythonExecution.tests.filter((test) => test.passed).length}/${pythonExecution.tests.length}` : allTests.length ? ` ${passingTests}/${allTests.length}` : ""}` : "Output"}
          </button>
        ))}
      </nav>
      <div className="project-workbench-grid" data-mobile-view={mobilePanel}>
        <nav className="project-tree" aria-label="Project files">
          {filesByGroup.map((group) => (
            <section key={group.id}>
              <span>{group.label}</span>
              {group.files.map((file) => {
                const status = statusForFile(file);
                return (
                  <button
                    aria-label={`${file.path}, ${status.label}`}
                    className={`${file.path === project.selectedPath ? "active " : ""}status-${status.tone}`}
                    type="button"
                    disabled={!projectReady}
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
          <Link className="project-run-capstone" href="/capstone" onClick={flushCurrentDraft}>Run active capstone →</Link>
        </nav>
        <div className={`project-editor-panel${isPythonFile ? " python-mode" : ""}`}>
          <header><div><span>{selected?.path ?? "No file selected"}</span><strong>{selected?.title}</strong></div><div><i className={dirty ? "dirty" : "saved"} /><span>{selected?.readOnly ? "Course library · read only" : dirty ? "Unsaved draft · autosaves after 650 ms idle" : "Saved in device file history"}</span></div></header>
          {selected ? <Suspense fallback={<div className="python-editor-loading" role="status">Loading Python syntax support…</div>}><SelectedCodeEditor path={selected.path} value={draft} readOnly={Boolean(selected.readOnly || !projectReady || (isPythonFile && pythonExecution.busy))} onChange={(value) => {
            draftEpochRef.current += 1;
            const recoveryStored = stageProjectDraftRecovery(selected.path, value);
            setDrafts((current) => ({ ...current, [selected.path]: value }));
            setMessage(recoveryStored
              ? `${selected.path} has an immediate recovery copy. File history autosaves after 650 ms without typing.`
              : `${selected.path} changed. File history autosaves after 650 ms without typing; keep this tab open.`);
          }} onSave={save} /></Suspense> : null}
          <footer><p>{selected?.readOnly ? "This is the numerical runtime imported by model lessons. Its source is visible, versioned, and protected from accidental edits." : isPythonFile ? pythonExecution.status : message}</p><div><button type="button" onClick={() => {
            if (!selected) return;
            if (!confirmReferenceRestore) {
              setConfirmReferenceRestore(true);
              setMessage("Restoring the reference will replace your current draft. Press again to confirm; saved revisions remain available.");
              return;
            }
            stageProjectDraftRecovery(selected.path, selected.referenceContent);
            draftEpochRef.current += 1;
            setDrafts((current) => ({ ...current, [selected.path]: selected.referenceContent }));
            setConfirmReferenceRestore(false);
            setMessage("Reference loaded as the current draft. File history autosaves after 650 ms without typing; choose Save now to sync immediately.");
          }} disabled={!projectReady || interfaceWorking || !selected || selected.readOnly || draft === selected?.referenceContent}>{confirmReferenceRestore ? "Confirm restore" : "Restore reference"}</button><button type="button" onClick={() => save()} disabled={!projectReady || interfaceWorking || selected?.readOnly || !dirty}>Save now</button>{isPythonFile ? <PythonRuntimeActions session={pythonExecution} disabled={!projectReady || working} /> : <button className="build" type="button" onClick={() => void build()} disabled={!projectReady || working}>{working ? "Running…" : "Test, build & run"}</button>}</div></footer>
        </div>
        {isPythonFile && selected ? <PythonInspector session={pythonExecution} path={selected.path} persistenceError={persistenceError} /> : <aside className={`project-inspector${persistenceError ? " has-warning" : ""}`} aria-live="polite">
          {persistenceError ? <p className="persistence-warning" role="alert">Storage warning: {persistenceError}</p> : null}
          <section className="unit-test-panel">
            <header><div><span>Unit tests</span><strong>{allTests.length ? `${passingTests}/${allTests.length} passing` : "Not run"}</strong></div><button type="button" onClick={() => void runTests()} disabled={!projectReady || working}>Run all {llmSystemsCurriculum.testCount + 6}</button></header>
            <div className="selected-test-heading"><span>{selected?.path}</span><button type="button" onClick={() => selected && void runTests(selected.path)} disabled={!projectReady || working || !selected || selected.readOnly}>Run file tests</button></div>
            <div className="unit-test-list">
              {selectedTests.length ? selectedTests.map((test) => <article className={test.passed ? "passed" : "failed"} key={test.id}><i>{test.passed ? "✓" : "×"}</i><div><strong>{test.label}</strong><p>{test.detail}</p></div></article>) : <p>Select “Run file tests” to verify this module independently of the build.</p>}
            </div>
          </section>
          <section className="project-output">
            <header><span>Last passing build</span><strong>{project.activeBuild ? `#${project.activeBuild.buildNumber}` : "None yet"}</strong></header>
            <p className="project-output-status" role="status">{message}</p>
            {buildFailures.length ? (
              <section className="project-build-failures" aria-label="Failing build tests">
                <header><strong>Fix these tests</strong><span>{buildFailures.length} blocking</span></header>
                {buildFailures.slice(0, 4).map((failure) => {
                  const actionPath = actionableBuildFailurePath({
                    failurePath: failure.path,
                    readOnly: failure.path === CAPSTONE_ENTRY_PATH || Boolean(project.files[failure.path]?.readOnly),
                    editableFallbackPath: CAPSTONE_COMPONENT_PATH,
                  });
                  return (
                    <button type="button" onClick={() => openFile(actionPath)} key={`${failure.path}:${failure.id}`}>
                      <code>{failure.path}</code><strong>{failure.label}</strong><span>{failure.detail}</span>
                      {actionPath !== failure.path ? <em>Open editable integration · {actionPath}</em> : null}
                    </button>
                  );
                })}
                {buildFailures.length > 4 ? <p>+{buildFailures.length - 4} more failures. Open the file, then run its tests.</p> : null}
              </section>
            ) : null}
            {errors.length ? <div className="project-errors">{errors.map((error) => <p key={error}>{error}</p>)}</div> : (
              <>
                <dl>
                  <div><dt>temperature</dt><dd>{project.runtime.model.temperature}</dd></div>
                  <div><dt>top-k</dt><dd>{project.runtime.model.topK || "off"}</dd></div>
                  <div><dt>event batch</dt><dd>{project.runtime.transport.wordsPerEvent} words</dd></div>
                  <div><dt>assistant</dt><dd>{project.runtime.interface.assistantName}</dd></div>
                </dl>
                {buildArtifact ? <article className="project-build-artifact"><span>Portable build artifact</span><p>{buildArtifact.links.length} lesson artifacts · {buildArtifact.contentHash.slice(7, 19)}</p><button type="button" onClick={() => void downloadArtifact(buildArtifact)}>Download build + lineage</button></article> : null}
                <section className="project-file-history" aria-label="Saved file revisions">
                  <header><span>File history</span><strong>{revisions.length} revisions</strong></header>
                  {recoveryCandidates.map((candidate) => (
                    <div className="project-recovery-candidate" key={`${candidate.sessionId}:${candidate.path}:${candidate.updatedAt}`}>
                      <span><strong>Recovery copy</strong><em>{new Date(candidate.updatedAt).toLocaleString()} · another tab/session</em><code>{draftDifferenceSummary(draft, candidate.content)}</code></span>
                      <span>
                        <button type="button" onClick={() => {
                          if (!selected || selected.readOnly) return;
                          const recoveryRestaged = loadProjectDraftRecoveryCandidate(candidate, selected.updatedAt + 1);
                          if (!recoveryRestaged) {
                            setMessage("The recovery copy could not be moved into this tab. It remains available; copy its preview before discarding it.");
                            return;
                          }
                          draftEpochRef.current += 1;
                          setDrafts((current) => ({ ...current, [selected.path]: candidate.content }));
                          setRecoveryRevision((revision) => revision + 1);
                          setMessage("Recovery copy loaded as the current draft. File history autosaves after 650 ms without typing; choose Save now to sync immediately.");
                          setMobilePanel("code");
                        }} disabled={selected?.readOnly}>Load</button>
                        <button type="button" onClick={() => {
                          discardProjectDraftRecoveryCandidate(candidate.sessionId, candidate.path);
                          setRecoveryRevision((revision) => revision + 1);
                        }}>Discard</button>
                      </span>
                    </div>
                  ))}
                  {revisions.length ? [...revisions].reverse().slice(0, 5).map((revision) => (
                    <div key={revision.id}>
                      <span><strong>r{revision.revision}</strong><em>{new Date(revision.createdAt).toLocaleString()}</em></span>
                      <button type="button" onClick={() => restoreRevision(revision)} disabled={selected?.readOnly}>{pendingRevision === revision.id ? "Confirm restore" : "Restore"}</button>
                    </div>
                  )) : <p>Saved revisions appear after this file changes.</p>}
                </section>
                {project.output.previous ? <article><span>Previous build</span><p>{project.output.previous}</p></article> : null}
                <article className="active"><span>Active build</span><p>{project.activeBuild
                  ? project.output.current || `Verified build #${project.activeBuild.buildNumber} is the current runnable snapshot.`
                  : "No passing build yet. Pass the full suite and build to create a checkpoint-backed preview."}</p></article>
              </>
            )}
          </section>
        </aside>}
      </div>
    </section>
  );
}
