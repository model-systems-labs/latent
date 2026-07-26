import { CANONICAL_BROWSER_CHAT_FILES } from "../../examples/learning-platform/llm-learning/content/browser-chat/project-template";
import { initializeLearnerPersistence, loadLearnerState, type LearnerState } from "./learner-state";
import { llmSystemsCurriculum } from "../../examples/learning-platform/llm-learning/lessons/course";
import { lessonBlockComment, lessonImplementationSource } from "../../examples/learning-platform/llm-learning/lessons/implementation-source";
import { llmSystemsContractSuite } from "../../examples/learning-platform/llm-learning/content/llm-systems/contracts";
import { restoreWorkingSourceVerification, workingPracticeSources } from "../features/ide/practice-state";
import {
  ensureProjectWorkspace,
  flushProjectPersistence,
  initializeProjectPersistence,
} from "./project-workspace";
import type { LessonProjectSeed, ProjectCourse } from "./project-workspace";

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
  return application;
}

/**
 * Materializes every curriculum lesson at its manifest-owned project path.
 * Learner practice state supplies a stable working source per exercise, while
 * an existing IDE edit remains authoritative when ensureProjectWorkspace
 * reconciles it. Authored solutions are retained only as reference content.
 */
export function canonicalLessonSeeds(
  learner: LearnerState = loadLearnerState(),
): LessonProjectSeed[] {
  return llmSystemsCurriculum.lessons.map(({ lesson, projectPath }) => {
    const local = learner.lessons[lesson.id];
    const answers = workingPracticeSources(
      lesson.implementation.filename,
      lesson.implementation.codeBlocks,
      local?.answers ?? {},
    );
    const restoredVerification = restoreWorkingSourceVerification(
      lesson.implementation.codeBlocks.map((block) => block.id),
      answers,
      local?.verifiedCells ?? [],
      local?.verifiedSources ?? {},
      local?.verifiedContractVersion,
      llmSystemsContractSuite.contractVersion,
    );
    const source = (practice: boolean) => lessonImplementationSource(
      lesson,
      lesson.implementation.codeBlocks.map((block, index) => (
        `${lessonBlockComment(lesson, index, block.label)}\n${
          practice ? answers[block.id] : block.code
        }`
      )),
    );
    return {
      path: projectPath,
      courseId: (lesson.courseId ?? "models") as ProjectCourse,
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
