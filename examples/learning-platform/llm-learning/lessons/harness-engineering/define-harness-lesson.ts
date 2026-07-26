import type { CourseLesson, LessonSource } from "@latent/course-kit";
import type { HarnessExperimentVariant } from "@/examples/learning-platform/llm-learning/content/harness-engineering/experiments";
import { withGuidedExercises } from "@/examples/learning-platform/llm-learning/lessons/guided-exercises";

type HarnessLessonInput = Pick<
  CourseLesson,
  | "id"
  | "number"
  | "courseId"
  | "courseTitle"
  | "courseNumber"
  | "lessonNumber"
  | "programId"
  | "eyebrow"
  | "title"
  | "thesis"
  | "summary"
  | "diagram"
  | "dataset"
  | "implementation"
> & {
  sources: LessonSource[];
  experiment: Pick<CourseLesson["experiment"], "title" | "intro"> & {
    variant: HarnessExperimentVariant;
  };
};

/**
 * Harness lessons use the shared reader and Python runner while saving into a
 * course-owned workbook that is independent from Browser Chat.
 */
export function defineHarnessLesson(input: HarnessLessonInput): CourseLesson {
  const primary = input.sources[0];
  const context = input.summary
    .map((paragraph) => `- ${paragraph.label} ${paragraph.body}`)
    .join("\n");

  return withGuidedExercises({
    ...input,
    projectScope: "harness-engineering",
    mode: "core-mechanism",
    modeLabel: "Runnable Python",
    paperUrl: primary.url,
    paperTitle: primary.title,
    authors: primary.authors,
    year: primary.year,
    paperContext: `
You're answering a technical question about "${input.title}" in Latent's Harness Engineering course.
${context}
Define harness-specific terms before using them. Distinguish probabilistic model behavior from deterministic host behavior. Use small concrete traces, and do not invent source claims.
`.trim(),
    claims: {
      paper: "The listed further reading describes established agent-loop, tool, context, security, evaluation, or orchestration patterns.",
      lab: "The browser runs your Python exercises against fixed test cases.",
      limit: "It does not call a hosted LLM, read local files, run shell commands, or use the network.",
    },
    questions: {
      intro: `Ask a question about ${input.title.toLowerCase()}.`,
      suggestions: [],
    },
    experiment: {
      kind: "harness",
      ...input.experiment,
    },
  });
}
