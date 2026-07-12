import type { CourseLesson } from "@latent/course-kit";
import { getLessonSources } from "../sources";

export type ExtendedLessonInput = Pick<
  CourseLesson,
  | "id" | "number" | "courseId" | "courseTitle" | "courseNumber" | "lessonNumber"
  | "mode" | "modeLabel" | "eyebrow" | "title" | "thesis" | "paperUrl"
  | "paperTitle" | "authors" | "year" | "summary" | "claims" | "diagram"
  | "questions" | "dataset" | "implementation" | "experiment"
>;

export function defineExtendedLesson(input: ExtendedLessonInput): CourseLesson {
  const compactContext = input.summary.map((paragraph) => `- ${paragraph.label} ${paragraph.body}`).join("\n");
  return {
    ...input,
    sources: getLessonSources(input.id),
    paperContext: `
This lesson is "${input.title}" in the ${input.courseTitle} module of Build an LLM System in Your Browser.
Primary reference: "${input.paperTitle}" by ${input.authors} (${input.year}).
${compactContext}
- The browser experiment is a bounded implementation of the mechanism described in the lesson.
- Distinguish production distributed systems from the controlled single-browser simulation.
Answer precisely and technically. Separate the primary source from later convention. Do not invent benchmark results, quotations, or production guarantees. Keep answers under 240 words unless asked for detail.
`.trim(),
  };
}
