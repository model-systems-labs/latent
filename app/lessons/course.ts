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
  })),
  ...systemsLessons,
  ...productLessons,
];

export const llmSystemsCurriculum = deriveCurriculum(llmSystemsManifest, sourceLessons);

/** Canonical lesson order now follows the program manifest rather than file declaration order. */
export const courseLessons: CourseLesson[] = llmSystemsCurriculum.lessons.map(
  ({ lesson }) => lesson,
);

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
  return llmSystemsCurriculum.lessonById[slug]?.lesson;
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
