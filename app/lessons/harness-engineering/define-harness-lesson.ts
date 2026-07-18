import type { CourseLesson, LessonSource } from "@latent/course-kit";
import type { HarnessExperimentVariant } from "../../content/harness-engineering/experiments";

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
 * Harness lessons use the shared reader and Python runner, but remain separate
 * from the Browser Chat workspace and its cumulative capstone.
 */
export function defineHarnessLesson(input: HarnessLessonInput): CourseLesson {
  const primary = input.sources[0];
  const context = input.summary
    .map((paragraph) => `- ${paragraph.label} ${paragraph.body}`)
    .join("\n");

  return {
    ...input,
    projectScope: "standalone",
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
      paper: "The listed sources describe established agent-loop, tool, context, security, evaluation, or orchestration patterns.",
      lab: "The browser runs a deterministic course-authored simulation of the harness mechanism.",
      limit: "The lesson does not call a hosted model or grant access to the learner's computer.",
    },
    questions: {
      intro: `Ask a question about ${input.title.toLowerCase()}.`,
      suggestions: [],
    },
    experiment: {
      kind: "harness",
      ...input.experiment,
    },
  };
}
