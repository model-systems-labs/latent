import type { CourseLesson } from "@latent/course-kit";
import {
  createHarnessLessonProjectSeed,
  createHarnessProjectStarterFiles,
  HARNESS_PROJECT_CONTRACT_VERSION,
  HARNESS_PROJECT_ID,
  HARNESS_PROJECT_PATHS,
  HARNESS_PROJECT_RUNNER_VERSION,
  HARNESS_PROJECT_TITLE,
  type HarnessPracticeSourcePolicy,
  type HarnessProjectSeed,
} from "@/examples/learning-platform/llm-learning/content/harness-engineering/project-template";
import {
  starterPracticeSource,
  workingPracticeBlockSource,
} from "@/app/features/ide/practice-state";

const sourcePolicy: HarnessPracticeSourcePolicy = {
  starterSource: starterPracticeSource,
  workingSource: workingPracticeBlockSource,
};

export {
  HARNESS_PROJECT_CONTRACT_VERSION,
  HARNESS_PROJECT_ID,
  HARNESS_PROJECT_PATHS,
  HARNESS_PROJECT_RUNNER_VERSION,
  HARNESS_PROJECT_TITLE,
};
export type { HarnessProjectSeed };

export const HARNESS_PROJECT_STARTER_FILES = createHarnessProjectStarterFiles(sourcePolicy);

export function harnessLessonProjectSeed(
  lesson: CourseLesson,
  answers: Readonly<Record<string, string>> = {},
  verified: readonly string[] = [],
) {
  return createHarnessLessonProjectSeed(sourcePolicy, lesson, answers, verified);
}
