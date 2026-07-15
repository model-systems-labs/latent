"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  { id: "runtime", label: "Config" },
  { id: "models", label: "Models" },
  { id: "systems", label: "Inference" },
  { id: "backend", label: "Serving" },
  { id: "product", label: "Product" },
  { id: "app", label: "App" },
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
type InspectorPanel = "tests" | "output";

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
  const [message, setMessage] = useState("Loading project…");
  const [projectReady, setProjectReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [buildArtifact, setBuildArtifact] = useState<ArtifactEnvelope | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("code");
  const [inspectorPanel, setInspectorPanel] = useState<InspectorPanel>("tests");
  const [revisions, setRevisions] = useState<FileRevisionRecord[]>([]);
  const [pendingRevision, setPendingRevision] = useState<string | null>(null);
  const [confirmReferenceRestore, setConfirmReferenceRestore] = useState(false);
  const [, setRecoveryRevision] = useState(0);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveNowRef = useRef<HTMLButtonElement | null>(null);
  const toolsRef = useRef<HTMLDetailsElement | null>(null);
  const draftEpochRef = useRef(0);
  const revisionRequestRef = useRef(0);
  const selectedPathRef = useRef<string | null>(selected?.path ?? null);
  const pendingDraftRef = useRef<{ path: string; content: string; dirty: boolean; readOnly: boolean } | null>(null);

  useEffect(() => {
    if (!persistenceError) return;
    const timer = window.setTimeout(() => {
      setInspectorPanel("output");
      setMobilePanel("output");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [persistenceError]);

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
        setMessage("");
        void latestProjectBuildArtifact().then((artifact) => setBuildArtifact(artifact ?? null)).catch(() => setBuildArtifact(null));
      } catch (error) {
        if (!active) return;
        setMessage(`The project couldn’t finish loading: ${error instanceof Error ? error.message : "browser storage is unavailable"}`);
        setInspectorPanel("output");
        setMobilePanel("output");
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
      setMessage("Saving…");
      void flushProjectPersistence().then(() => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage("");
        }
      }).catch((error) => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage(recoveryStored
            ? `File history didn’t sync, but ${selected.path} is still in the browser recovery copy. ${error instanceof Error ? error.message : "Reload before editing in another tab."}`
            : `This browser couldn’t save ${selected.path}. Copy your code before leaving this page.`);
          setInspectorPanel("output");
          setMobilePanel("output");
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
    toolsRef.current?.removeAttribute("open");
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
      setMessage("Saving…");
      void flushProjectPersistence().then(() => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage("");
        }
      }).catch((error) => {
        if (draftSnapshotIsCurrent(pendingDraftRef.current, draftEpochRef.current, scheduled)) {
          setMessage(recoveryStored
            ? `File history didn’t sync, but ${selected.path} is still in the browser recovery copy. ${error instanceof Error ? error.message : "Reload before editing in another tab."}`
            : `This browser couldn’t save ${selected.path}. Copy your code before leaving this page.`);
          setInspectorPanel("output");
          setMobilePanel("output");
        }
      });
    }
    window.setTimeout(() => void refreshRevisions(selected.path), 800);
    return next;
  };

  const showResults = useCallback((panel: InspectorPanel) => {
    setInspectorPanel(panel);
    setMobilePanel(panel);
  }, []);

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
    showPanel: showResults,
  });
  const interfaceWorking = working || pythonExecution.busy;

  const build = async () => {
    if (working) return;
    setWorking(true);
    setBuildFailures([]);
    const saved = save(false);
    const runDraftEpoch = draftEpochRef.current;
    setMessage("Building the virtual project in an isolated worker…");
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
          ? "We ignored this run because the project changed while the tests were running. Run it again with the current saved files."
          : "We ignored this run because its checklist is out of date. Reload the IDE and run it again.");
        showResults("output");
        return;
      }
      const gate = gateBrowserLabBuild(run.results);
      if (!gate.canPromote) {
        setErrors([]);
        setBuildFailures(gate.failures);
        setMessage(`Build blocked: ${gate.failures.length} of ${gate.total} unit tests failed. ${saved.activeBuild ? "The last passing build remains active." : "No active build was created."}`);
        void recordLearningEvent("project_build_completed", { outcome: "failed", count: gate.total - gate.failures.length });
        showResults("output");
        return;
      }
      const result = compileProject(saved.files, saved.runtime);
      if (!result.ok || !run.program || !run.receipt || !run.persistenceReceipt) {
        setErrors(result.ok ? ["The isolated build didn’t produce a result that can become the active build."] : result.errors);
        setMessage("Build stopped. Fix the failing compiler or runtime check and run it again.");
        showResults("output");
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
        setMessage(`Build ${promoted.buildNumber} is active. Artifact ${artifact.contentHash.slice(7, 19)} ties ${descriptor.contributions.length} exact passing Python files to browser adapters that passed the same checks.`);
        showResults("output");
      } catch (artifactError) {
        setMessage(`Build ${promoted.buildNumber} is active, but its portable artifact couldn’t be saved: ${artifactError instanceof Error ? artifactError.message : "local storage is unavailable"}`);
        showResults("output");
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The isolated build failed."]);
      setMessage(saved.activeBuild ? "Build stopped safely. The last passing build remains active." : "Build stopped safely. No active build was created.");
      showResults("output");
    } finally {
      setWorking(false);
    }
  };

  const runTests = async (onlyPath?: string) => {
    if (working) return;
    setWorking(true);
    const saved = save(false);
    const runDraftEpoch = draftEpochRef.current;
    setMessage(onlyPath ? "Running this file in the isolated test worker…" : "Building the project and running every test in isolation…");
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
          ? "We ignored this run because the project changed while the tests were running. Run it again with the current saved files."
          : "We ignored this run because its checklist is out of date. Reload the IDE and run it again.");
        showResults("tests");
        return;
      }
      const failed = run.results.filter((test) => !test.passed).length;
      setErrors([]);
      setMessage(failed ? `${failed} of ${run.results.length} unit tests failed. The active build was not changed.` : `${run.results.length} unit tests pass in the sandbox. No build was created.`);
      void recordLearningEvent("project_tests_completed", { outcome: failed ? "failed" : "passed", count: run.results.length - failed });
      showResults("tests");
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
      setMessage("Backup downloaded.");
    } catch (error) {
      setMessage(`Backup stopped because the latest draft couldn’t sync: ${error instanceof Error ? error.message : "browser storage is unavailable"}`);
    }
  };

  const importProgress = async (file: File) => {
    if (working) return;
    setWorking(true);
    setErrors([]);
    setMessage("Checking the backup before changing the progress on this device…");
    try {
      const serialized = await file.text();
      const { database } = await getPersistenceContext();
      await importPersistenceSnapshot(database, serialized, { mode: "merge" });
      setMessage("Progress imported. Reloading the project…");
      window.location.reload();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The selected file is not a valid Latent backup.";
      setErrors([`Import failed: ${detail}`]);
      setMessage("Nothing was imported. The current project remains open and unchanged.");
      showResults("output");
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
        ? "Every test passes in the current workspace, but those results aren’t part of the matching active build yet. Choose Test, build & run, then export the portfolio."
        : `The portfolio ZIP unlocks after all ${courseLessons.length} lessons are done and all ${portfolioStatus.requiredTests} test results match the active build. Choose Test, build & run, or use Backup if you’re not finished yet.`);
      showResults("output");
      return;
    }
    downloadBrowserBlob(portfolioProjectBlob({ project, learner, lessons: courseLessons }), `browser-chat-portfolio-${new Date().toISOString().slice(0, 10)}.zip`);
    setMessage("Portfolio downloaded.");
  };

  const restoreRevision = (revision: FileRevisionRecord) => {
    if (!selected || selected.readOnly) return;
    if (!revisionCanRestore(selected.path, revision.path)) {
      setPendingRevision(null);
      setMessage(`Revision r${revision.revision} belongs to ${revision.path}, not the file you have open. Nothing was restored.`);
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
    setMessage(`Revision ${revision.revision} restored. Run the tests again because the code changed.`);
    setMobilePanel("code");
    window.setTimeout(() => void refreshRevisions(selected.path), 800);
  };
  const editorStatus = selected?.readOnly
    ? "Course library · read only"
    : dirty
      ? "Unsaved draft · saves after you stop typing for 650 ms"
      : "Saved in device file history";
  const compactEditorStatus = selected?.readOnly ? "Read only" : dirty ? "Unsaved" : "Saved";
  const restoreReference = () => {
    if (!selected) return;
    if (!confirmReferenceRestore) {
      setConfirmReferenceRestore(true);
      setMessage("Restore the reference? Press again to confirm. Saved revisions stay available.");
      return;
    }
    stageProjectDraftRecovery(selected.path, selected.referenceContent);
    draftEpochRef.current += 1;
    setDrafts((current) => ({ ...current, [selected.path]: selected.referenceContent }));
    setConfirmReferenceRestore(false);
    toolsRef.current?.removeAttribute("open");
    setMessage("Reference restored. Save or run the tests.");
    setMobilePanel("code");
    window.setTimeout(() => saveNowRef.current?.focus(), 0);
  };

  return (
    <section className="project-workbench" aria-label="Editable capstone project">
      <header>
        <div className="project-header-actions">
          <div className="project-progress" aria-label={`${verifiedFiles} of ${llmSystemsCurriculum.lessonCount} lesson files verified`}>
            <strong>{verifiedFiles}/{llmSystemsCurriculum.lessonCount} lessons</strong>
          </div>
          <nav className="project-result-tabs" aria-label="Results panel">
            <button type="button" aria-pressed={inspectorPanel === "tests"} onClick={() => showResults("tests")}>Tests</button>
            <button type="button" aria-pressed={inspectorPanel === "output"} onClick={() => showResults("output")}>Output</button>
          </nav>
          <details className="project-tools" ref={toolsRef}>
            <summary>Actions</summary>
            <div>
              <button type="button" onClick={() => { toolsRef.current?.removeAttribute("open"); exportPortfolio(); }} aria-label={portfolioStatus.ready ? "Download verified portfolio ZIP" : "Portfolio ZIP — complete every lesson and create a passing full build to unlock"} title={portfolioStatus.ready ? "Download the verified standalone project" : "Finish every lesson and create a passing full build first"}>Portfolio</button>
              <button type="button" onClick={() => { toolsRef.current?.removeAttribute("open"); void exportProgress(); }} disabled={working}>Backup</button>
              <button type="button" onClick={() => { toolsRef.current?.removeAttribute("open"); importRef.current?.click(); }} disabled={working}>Import</button>
              <button type="button" onClick={restoreReference} disabled={!projectReady || interfaceWorking || !selected || selected.readOnly || draft === selected?.referenceContent}>{confirmReferenceRestore ? "Confirm restore" : "Restore file"}</button>
              <input ref={importRef} type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProgress(file); event.currentTarget.value = ""; }} aria-label="Import saved Latent progress" />
            </div>
          </details>
        </div>
      </header>
      <nav className="mobile-ide-tabs" aria-label="Choose a project workspace view">
        {(["files", "code", "tests", "output"] as const).map((panel) => (
          <button type="button" aria-pressed={mobilePanel === panel} className={mobilePanel === panel ? "active" : ""} onClick={() => panel === "tests" || panel === "output" ? showResults(panel) : setMobilePanel(panel)} key={panel}>
            {panel === "files" ? "Files" : panel === "code" ? "Code" : panel === "tests" ? "Tests" : "Output"}
          </button>
        ))}
      </nav>
      <div className="project-workbench-grid" data-mobile-view={mobilePanel} data-inspector-view={inspectorPanel}>
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
                    <i aria-hidden="true" />
                    <span>{file.path.split("/").at(-1)}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
        <div className={`project-editor-panel${isPythonFile ? " python-mode" : ""}`}>
          <header><code>{selected?.path ?? "No file selected"}</code><div role="status" aria-live="polite" aria-atomic="true"><i className={dirty ? "dirty" : "saved"} /><span aria-hidden="true">{compactEditorStatus}</span><span className="sr-only">{editorStatus}</span></div></header>
          {selected ? <Suspense fallback={<div className="python-editor-loading" role="status">Loading Python syntax support…</div>}><SelectedCodeEditor path={selected.path} value={draft} readOnly={Boolean(selected.readOnly || !projectReady || (isPythonFile && pythonExecution.busy))} onChange={(value) => {
            draftEpochRef.current += 1;
            const recoveryStored = stageProjectDraftRecovery(selected.path, value);
            setDrafts((current) => ({ ...current, [selected.path]: value }));
            setMessage(recoveryStored ? "Saving…" : "Saving… keep this tab open.");
          }} onSave={save} /></Suspense> : null}
          <footer><div>{dirty ? <button ref={saveNowRef} type="button" onClick={() => save()} disabled={!projectReady || interfaceWorking || selected?.readOnly}>Save</button> : null}{isPythonFile ? <PythonRuntimeActions session={pythonExecution} disabled={!projectReady || working} /> : <button className="build" type="button" onClick={() => void build()} disabled={!projectReady || working}>{working ? "Running…" : "Test, build & run"}</button>}</div></footer>
        </div>
        {isPythonFile && selected ? <PythonInspector session={pythonExecution} path={selected.path} persistenceError={persistenceError} /> : <aside className={`project-inspector${persistenceError ? " has-warning" : ""}`} aria-live="polite">
          {persistenceError ? <p className="persistence-warning" role="alert">Storage warning: {persistenceError}</p> : null}
          <section className="unit-test-panel">
            <header><div><span>Unit tests</span><strong>{allTests.length ? `${passingTests}/${allTests.length} passing` : "Not run"}</strong></div><button type="button" onClick={() => void runTests()} disabled={!projectReady || working}>Run all {llmSystemsCurriculum.testCount + 6}</button></header>
            <div className="selected-test-heading"><span>{selected?.path.split("/").at(-1)}</span><button type="button" onClick={() => selected && void runTests(selected.path)} disabled={!projectReady || working || !selected || selected.readOnly}>Run file tests</button></div>
            <div className="unit-test-list">
              {selectedTests.length ? selectedTests.map((test) => <article className={test.passed ? "passed" : "failed"} key={test.id}><i>{test.passed ? "✓" : "×"}</i><div><strong>{test.label}</strong><p>{test.detail}</p></div></article>) : <p>No results for this file.</p>}
            </div>
          </section>
          <section className="project-output">
            <header><span>Build</span><strong>{project.activeBuild ? `#${project.activeBuild.buildNumber}` : "None"}</strong></header>
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
                {project.activeBuild || buildArtifact ? <article className="project-build-artifact">
                  <p>{project.activeBuild
                    ? project.output.current || `Verified build #${project.activeBuild.buildNumber} is ready to run.`
                    : `${buildArtifact?.links.length ?? 0} lesson artifacts · ${buildArtifact?.contentHash.slice(7, 19) ?? ""}`}</p>
                  {buildArtifact ? <button type="button" onClick={() => void downloadArtifact(buildArtifact)}>Download build + history</button> : null}
                </article> : null}
                <details className="project-file-history">
                  <summary><span>History</span><strong>{recoveryCandidates.length ? `${recoveryCandidates.length} recoverable` : `${revisions.length} revisions`}</strong></summary>
                  <div className="project-file-history-list">
                    {recoveryCandidates.map((candidate) => (
                      <div className="project-recovery-candidate" key={`${candidate.sessionId}:${candidate.path}:${candidate.updatedAt}`}>
                        <span><strong>Recovery copy</strong><em>{new Date(candidate.updatedAt).toLocaleString()} · another tab/session</em><code>{draftDifferenceSummary(draft, candidate.content)}</code></span>
                        <span>
                          <button type="button" onClick={() => {
                            if (!selected || selected.readOnly) return;
                            const recoveryRestaged = loadProjectDraftRecoveryCandidate(candidate, selected.updatedAt + 1);
                            if (!recoveryRestaged) {
                              setMessage("The recovery copy couldn’t be loaded. It is still available here.");
                              return;
                            }
                            draftEpochRef.current += 1;
                            setDrafts((current) => ({ ...current, [selected.path]: candidate.content }));
                            setRecoveryRevision((revision) => revision + 1);
                            setMessage("Recovery copy loaded.");
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
                    )) : <p>No saved revisions yet.</p>}
                  </div>
                </details>
              </>
            )}
          </section>
        </aside>}
      </div>
    </section>
  );
}
