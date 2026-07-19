import type { CourseLesson } from "@latent/course-kit";
import { harnessEngineeringManifest } from "./manifest";
import { harnessEngineeringLessons } from "../../lessons/harness-engineering";
import { lessonBlockComment, lessonImplementationSource } from "../../lessons/implementation-source";
import { starterPracticeSource, workingPracticeBlockSource } from "../../features/ide/practice-state";

export const HARNESS_PROJECT_ID = "harness-engineering";
export const HARNESS_PROJECT_TITLE = "Harness Engineering";
export const HARNESS_PROJECT_CONTRACT_VERSION = "harness-engineering-contracts-v2-cpython";
export const HARNESS_PROJECT_RUNNER_VERSION = "pyodide-harness-project-v1";

export type HarnessProjectSeed = {
  path: string;
  track: "harness";
  title: string;
  content: string;
  referenceContent: string;
  lessonId: string;
  verifiedCells: number;
  totalCells: number;
};

const projectPathByLessonId = new Map<string, string>(
  harnessEngineeringManifest.modules.flatMap((module) => (
    module.lessons.map((lesson) => [lesson.lessonId, lesson.projectPath] as const)
  )),
);

export function harnessProjectPathForLesson(lesson: Pick<CourseLesson, "id" | "implementation">) {
  return projectPathByLessonId.get(lesson.id) ?? `harness/${lesson.implementation.filename}`;
}

function materializeLesson(
  lesson: CourseLesson,
  sourceForBlock: (block: CourseLesson["implementation"]["codeBlocks"][number]) => string,
) {
  return lessonImplementationSource(lesson, lesson.implementation.codeBlocks.map((block, index) => (
    `${lessonBlockComment(lesson, index, block.label)}\n${sourceForBlock(block)}`
  )));
}

export function harnessLessonProjectSeed(
  lesson: CourseLesson,
  answers: Readonly<Record<string, string>> = {},
  verified: readonly string[] = [],
): HarnessProjectSeed {
  return {
    path: harnessProjectPathForLesson(lesson),
    track: "harness",
    title: lesson.title,
    content: materializeLesson(
      lesson,
      (block) => workingPracticeBlockSource(lesson.implementation.filename, block, answers),
    ),
    referenceContent: materializeLesson(lesson, (block) => block.code),
    lessonId: lesson.id,
    verifiedCells: verified.length,
    totalCells: lesson.implementation.codeBlocks.length,
  };
}

/** The complete workbook is visible immediately; lessons replace these TODO scaffolds. */
export const HARNESS_PROJECT_STARTER_FILES: readonly HarnessProjectSeed[] = harnessEngineeringLessons.map((lesson) => ({
  path: harnessProjectPathForLesson(lesson),
  track: "harness" as const,
  title: lesson.title,
  content: materializeLesson(
    lesson,
    (block) => starterPracticeSource(lesson.implementation.filename, block),
  ),
  referenceContent: materializeLesson(lesson, (block) => block.code),
  lessonId: lesson.id,
  verifiedCells: 0,
  totalCells: lesson.implementation.codeBlocks.length,
}));

export const HARNESS_PROJECT_PATHS = HARNESS_PROJECT_STARTER_FILES.map((file) => file.path);
