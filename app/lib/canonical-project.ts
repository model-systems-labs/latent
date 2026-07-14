import { CANONICAL_BROWSER_CHAT_FILES } from "../content/browser-chat/project-template";
import { initializeLearnerPersistence, loadLearnerState, type LearnerState } from "./learner-state";
import { llmSystemsCurriculum } from "../lessons/course";
import { lessonImplementationSource } from "../lessons/implementation-source";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { restoreSourceBoundVerification } from "../features/ide/practice-state";
import {
  ensureProjectWorkspace,
  flushProjectPersistence,
  initializeProjectPersistence,
} from "./project-workspace";
import type { LessonProjectSeed } from "./project-workspace";
import {
  PYTHON_CHARACTER_RNN_PATH,
  PYTHON_CHARACTER_RNN_SOURCE,
} from "../features/python/character-rnn-source";

export function canonicalProjectSeeds(): LessonProjectSeed[] {
  const application: LessonProjectSeed[] = CANONICAL_BROWSER_CHAT_FILES.map((file) => ({
    path: file.path,
    courseId: "app",
    title: file.title,
    content: file.source,
    referenceContent: file.source,
    verifiedCells: file.editable ? 0 : 1,
    totalCells: 1,
    readOnly: !file.editable,
  }));
  return [
    {
      path: PYTHON_CHARACTER_RNN_PATH,
      courseId: "models",
      title: "Character RNN · Python",
      content: PYTHON_CHARACTER_RNN_SOURCE,
      referenceContent: PYTHON_CHARACTER_RNN_SOURCE,
      verifiedCells: 0,
      totalCells: 1,
      readOnly: false,
    },
    ...application,
  ];
}

/**
 * Materializes every curriculum lesson at its manifest-owned project path.
 * Learner practice state supplies hidden blocks and answers, while an existing
 * IDE edit remains authoritative when ensureProjectWorkspace reconciles it.
 */
export function canonicalLessonSeeds(
  learner: LearnerState = loadLearnerState(),
): LessonProjectSeed[] {
  return llmSystemsCurriculum.lessons.map(({ lesson, projectPath }) => {
    const local = learner.lessons[lesson.id];
    const hidden = local?.hiddenBlocks ?? [];
    const answers = local?.answers ?? {};
    const restoredVerification = restoreSourceBoundVerification(
      lesson.implementation.codeBlocks,
      hidden,
      answers,
      local?.verifiedCells ?? [],
      local?.verifiedSources ?? {},
      local?.verifiedContractVersion,
      llmSystemsContractSuite.contractVersion,
    );
    const source = (practice: boolean) => lessonImplementationSource(
      lesson,
      lesson.implementation.codeBlocks.map((block, index) => (
        `// ${String(index + 1).padStart(2, "0")} · ${block.label}\n${
          practice && hidden.includes(block.id) ? answers[block.id] ?? "" : block.code
        }`
      )),
    );
    return {
      path: projectPath,
      courseId: lesson.courseId ?? "models",
      lessonId: lesson.id,
      title: lesson.title,
      content: source(true),
      referenceContent: source(false),
      verifiedCells: restoredVerification.ids.length,
      totalCells: lesson.implementation.codeBlocks.length,
    };
  });
}

export function completeCanonicalProjectSeeds(
  learner: LearnerState = loadLearnerState(),
): LessonProjectSeed[] {
  return [...canonicalLessonSeeds(learner), ...canonicalProjectSeeds()];
}

/**
 * The one route-independent ownership boundary for browser-chat/. It waits for
 * durable project and learner state before adding missing canonical files, then
 * flushes the reconciled tree so later routes observe the same repository.
 */
export async function reconcileCanonicalProject(): Promise<void> {
  await initializeProjectPersistence();
  await flushProjectPersistence();
  await initializeLearnerPersistence();
  ensureProjectWorkspace(completeCanonicalProjectSeeds(loadLearnerState()));
  await flushProjectPersistence();
}
