import type { CourseLesson, LessonSource } from "@latent/course-kit";

type FoundationLessonInput = Pick<
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
  experiment: Pick<CourseLesson["experiment"], "variant" | "title" | "intro">;
};

/**
 * Beginner courses share the lesson reader and isolated Python runner, but do
 * not contribute files, tests, or completion gates to the Browser Chat project.
 */
export function defineFoundationLesson(input: FoundationLessonInput): CourseLesson {
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
You're answering a beginner's question about "${input.title}" in Latent's ${input.courseTitle} course.
${context}
Use small numerical examples. Define any technical term before using it. Don't assume calculus or prior machine-learning experience, and don't invent quotes or source claims.
`.trim(),
    claims: {
      paper: `The listed sources define the standard terminology and operations used in this lesson.`,
      lab: `The browser checks small course-authored examples of the operation.`,
      limit: `The lesson covers only the beginner case needed for later machine-learning work.`,
    },
    questions: {
      intro: `Ask a question about ${input.title.toLowerCase()}.`,
      suggestions: [],
    },
    experiment: {
      kind: "fundamentals",
      ...input.experiment,
    },
  };
}
