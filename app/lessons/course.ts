import { deriveCurriculum, type CourseLesson, type CourseTrack } from "@latent/course-kit";
import { llmSystemsManifest } from "../content/llm-systems/manifest";
import { productLessons, systemsLessons } from "./extended-course";
import { getLessonSources } from "./sources";
import { characterRnnsLesson } from "./model/character-rnns";
import { neuralLanguageModelsLesson } from "./model/neural-language-models";
import { subwordTokenizationLesson } from "./model/subword-tokenization";
import { additiveAttentionLesson } from "./model/additive-attention";
import { transformersLesson } from "./model/transformers";
import { inContextLearningLesson } from "./model/in-context-learning";
import { linearAlgebraManifest, machineLearningBasicsManifest } from "../content/foundations/manifests";
import { linearAlgebraLessons } from "./foundations/linear-algebra";
import { machineLearningBasicsLessons } from "./foundations/machine-learning-basics";
import { harnessEngineeringManifest } from "../content/harness-engineering/manifest";
import { harnessEngineeringLessons } from "./harness-engineering";

const modelLessons: Array<Omit<CourseLesson, "sources">> = [
  characterRnnsLesson,
  neuralLanguageModelsLesson,
  subwordTokenizationLesson,
  additiveAttentionLesson,
  transformersLesson,
  inContextLearningLesson,
];

const sourceLessons: CourseLesson[] = [
  ...modelLessons.map((lesson, index) => ({
    ...lesson,
    sources: getLessonSources(lesson.id),
    courseId: "models" as const,
    courseTitle: "Model Foundations",
    courseNumber: 1,
    lessonNumber: index + 1,
    programId: "llm-systems",
    projectScope: "browser-chat" as const,
  })),
  ...systemsLessons.map((lesson) => ({ ...lesson, programId: "llm-systems", projectScope: "browser-chat" as const })),
  ...productLessons.map((lesson) => ({ ...lesson, programId: "llm-systems", projectScope: "browser-chat" as const })),
];

export const llmSystemsCurriculum = deriveCurriculum(llmSystemsManifest, sourceLessons);

/** Canonical lesson order now follows the program manifest rather than file declaration order. */
export const courseLessons: CourseLesson[] = llmSystemsCurriculum.lessons.map(
  ({ lesson }) => lesson,
);

export const linearAlgebraCurriculum = deriveCurriculum(
  linearAlgebraManifest,
  linearAlgebraLessons,
);

export const machineLearningBasicsCurriculum = deriveCurriculum(
  machineLearningBasicsManifest,
  machineLearningBasicsLessons,
);

export const harnessEngineeringCurriculum = deriveCurriculum(
  harnessEngineeringManifest,
  harnessEngineeringLessons,
);

export const foundationLessons: CourseLesson[] = [
  ...linearAlgebraCurriculum.lessons.map(({ lesson }) => lesson),
  ...machineLearningBasicsCurriculum.lessons.map(({ lesson }) => lesson),
];

export const standaloneLessons: CourseLesson[] = [
  ...foundationLessons,
  ...harnessEngineeringCurriculum.lessons.map(({ lesson }) => lesson),
];

/** Every public lesson route. Browser Chat build code must continue to use courseLessons. */
export const allRoutedLessons: CourseLesson[] = [...standaloneLessons, ...courseLessons];

export type CourseProgram = {
  id: "linear-algebra" | "machine-learning-basics" | "harness-engineering" | "llm-systems";
  order: number;
  title: string;
  shortTitle: string;
  thesis: string;
  outcome: string;
  href: string;
  kind: "foundation" | "applied" | "project";
  lessons: CourseLesson[];
};

export const coursePrograms: CourseProgram[] = [
  {
    id: "linear-algebra",
    order: 1,
    title: linearAlgebraCurriculum.title,
    shortTitle: linearAlgebraCurriculum.shortTitle,
    thesis: linearAlgebraCurriculum.thesis,
    outcome: linearAlgebraCurriculum.outcome,
    href: "/courses/linear-algebra",
    kind: "foundation",
    lessons: linearAlgebraCurriculum.lessons.map(({ lesson }) => lesson),
  },
  {
    id: "machine-learning-basics",
    order: 2,
    title: machineLearningBasicsCurriculum.title,
    shortTitle: machineLearningBasicsCurriculum.shortTitle,
    thesis: machineLearningBasicsCurriculum.thesis,
    outcome: machineLearningBasicsCurriculum.outcome,
    href: "/courses/machine-learning-basics",
    kind: "foundation",
    lessons: machineLearningBasicsCurriculum.lessons.map(({ lesson }) => lesson),
  },
  {
    id: "harness-engineering",
    order: 3,
    title: harnessEngineeringCurriculum.title,
    shortTitle: harnessEngineeringCurriculum.shortTitle,
    thesis: harnessEngineeringCurriculum.thesis,
    outcome: harnessEngineeringCurriculum.outcome,
    href: "/courses/harness-engineering",
    kind: "applied",
    lessons: harnessEngineeringCurriculum.lessons.map(({ lesson }) => lesson),
  },
  {
    id: "llm-systems",
    order: 4,
    title: llmSystemsCurriculum.title,
    shortTitle: "Browser Chat",
    thesis: llmSystemsCurriculum.thesis,
    outcome: llmSystemsCurriculum.outcome,
    href: "/courses/llm-systems",
    kind: "project",
    lessons: courseLessons,
  },
];

const compatibleTrackIds: readonly CourseTrack["id"][] = [
  "models",
  "systems",
  "backend",
  "product",
];

function toCompatibleTrackId(routeSlug: string): CourseTrack["id"] {
  const trackId = compatibleTrackIds.find((candidate) => candidate === routeSlug);
  if (!trackId) throw new Error(`Unsupported curriculum route slug: ${routeSlug}`);
  return trackId;
}

/**
 * Compatibility adapter for the current course routes. Titles and membership
 * are derived from the one-program manifest; the route layer can migrate from
 * "course" to "module" without changing saved project paths.
 */
export const courseTracks: CourseTrack[] = llmSystemsCurriculum.modules.map((module) => ({
  id: toCompatibleTrackId(module.routeSlug),
  number: module.order,
  title: module.title,
  shortTitle: module.shortTitle,
  thesis: module.thesis,
  outcome: module.outcome,
  lessonIds: [...module.lessonIds],
}));

export { modelLessons };

export function getLesson(slug: string) {
  return allRoutedLessons.find((lesson) => lesson.id === slug);
}

export function getAdjacentLesson(lesson: CourseLesson, direction: -1 | 1) {
  const index = courseLessons.findIndex((candidate) => candidate.id === lesson.id);
  return courseLessons[index + direction];
}

export function getTrack(courseId: string) {
  return courseTracks.find((track) => track.id === courseId);
}

export function getTrackLessons(courseId: string) {
  return llmSystemsCurriculum.moduleByRouteSlug[courseId]?.lessons.map(({ lesson }) => lesson) ?? [];
}

export function getCourseProgram(programId: string) {
  return coursePrograms.find((program) => program.id === programId);
}

export function getCourseProgramLessons(programId: string) {
  return getCourseProgram(programId)?.lessons ?? [];
}

export function getLessonCourseHref(lesson: CourseLesson) {
  return lesson.projectScope === "standalone"
    ? `/courses/${lesson.programId ?? lesson.courseId}`
    : `/courses/llm-systems/${lesson.courseId ?? "models"}`;
}
