import { deriveCurriculum, type CourseLesson, type CourseTrack } from "@latent/course-kit";
import { llmSystemsManifest } from "@/examples/learning-platform/llm-learning/content/llm-systems/manifest";
import { productLessons, systemsLessons } from "@/examples/learning-platform/llm-learning/lessons/extended-course";
import { getLessonSources } from "@/examples/learning-platform/llm-learning/lessons/sources";
import { characterRnnsLesson } from "@/examples/learning-platform/llm-learning/lessons/model/character-rnns";
import { neuralLanguageModelsLesson } from "@/examples/learning-platform/llm-learning/lessons/model/neural-language-models";
import { subwordTokenizationLesson } from "@/examples/learning-platform/llm-learning/lessons/model/subword-tokenization";
import { additiveAttentionLesson } from "@/examples/learning-platform/llm-learning/lessons/model/additive-attention";
import { transformersLesson } from "@/examples/learning-platform/llm-learning/lessons/model/transformers";
import { inContextLearningLesson } from "@/examples/learning-platform/llm-learning/lessons/model/in-context-learning";
import { linearAlgebraManifest, machineLearningBasicsManifest } from "@/examples/learning-platform/llm-learning/content/foundations/manifests";
import { linearAlgebraLessons } from "@/examples/learning-platform/llm-learning/lessons/foundations/linear-algebra";
import { machineLearningBasicsLessons } from "@/examples/learning-platform/llm-learning/lessons/foundations/machine-learning-basics";
import { harnessEngineeringManifest } from "@/examples/learning-platform/llm-learning/content/harness-engineering/manifest";
import { harnessEngineeringLessons } from "@/examples/learning-platform/llm-learning/lessons/harness-engineering";

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

export type CourseAudience = {
  level: "beginner" | "intermediate" | "advanced";
  description: string;
};

export type CoursePrerequisite = {
  required: boolean;
  description: string;
};

export type CourseRuntime = {
  language: string;
  environment: "Runs locally in your browser";
  persistence: string;
  boundary: string;
};

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
  audience: CourseAudience;
  prerequisite: CoursePrerequisite;
  runtime: CourseRuntime;
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
    audience: {
      level: "beginner",
      description: "People who want the array math behind neural networks to stop feeling abstract.",
    },
    prerequisite: {
      required: false,
      description: "Basic Python helps. You do not need prior linear algebra.",
    },
    runtime: {
      language: "Python + NumPy",
      environment: "Runs locally in your browser",
      persistence: "Exercises and progress stay in this course.",
      boundary: "A browser-hosted Python runtime checks small course-authored examples. No install or API key is required.",
    },
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
    audience: {
      level: "beginner",
      description: "New ML learners and developers who want a clean training-loop refresher.",
    },
    prerequisite: {
      required: false,
      description: "Basic Python helps. NumPy experience is not required.",
    },
    runtime: {
      language: "Python + NumPy",
      environment: "Runs locally in your browser",
      persistence: "Exercises and progress stay in this course.",
      boundary: "A browser-hosted Python runtime checks small course-authored examples. No install or API key is required.",
    },
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
    audience: {
      level: "advanced",
      description: "Engineers building reliable agents around an existing language model.",
    },
    prerequisite: {
      required: true,
      description: "You should be comfortable reading Python and thinking in tests and state machines.",
    },
    runtime: {
      language: "Python",
      environment: "Runs locally in your browser",
      persistence: "Lessons build a separate saved harness project.",
      boundary: "Your Python runs against fixed model replies and tool results. It does not call a hosted LLM, local files, a shell, or the network.",
    },
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
    audience: {
      level: "intermediate",
      description: "Python developers who know NumPy, loss, and gradients and want to see the whole LLM path.",
    },
    prerequisite: {
      required: true,
      description: "Know basic linear algebra and ML, or use the two foundation courses as refreshers.",
    },
    runtime: {
      language: "Python + NumPy + React",
      environment: "Runs locally in your browser",
      persistence: "Lesson files accumulate in the saved Browser Chat project.",
      boundary: "Python lessons are checked separately; the capstone runs tested browser adapters and an optional local model download. No API key is required.",
    },
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
  overview: module.overview,
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
  return lesson.projectScope !== "browser-chat"
    ? `/courses/${lesson.programId ?? lesson.courseId}`
    : `/courses/llm-systems/${lesson.courseId ?? "models"}`;
}

/** Manifest-owned path used by lesson practice and its matching workspace. */
export function getLessonProjectPath(lesson: CourseLesson) {
  if (lesson.projectScope === "harness-engineering") {
    return harnessEngineeringCurriculum.lessonById[lesson.id]?.projectPath
      ?? `harness/${lesson.implementation.filename}`;
  }
  return llmSystemsCurriculum.lessonById[lesson.id]?.projectPath
    ?? `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
}
