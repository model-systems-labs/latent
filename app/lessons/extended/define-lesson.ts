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
You're helping with "${input.title}" in the ${input.courseTitle} module of Build an LLM System in Your Browser.
The main reference is "${input.paperTitle}" by ${input.authors} (${input.year}).
${compactContext}
- The browser experiment is a limited example of the lesson's main idea.
- Be clear about what applies to production distributed systems and what only applies to the controlled single-browser simulation.
Be accurate and technically clear. Keep the main source separate from conventions that came later. Don't make up benchmark results, quotes, or production guarantees. Stay under 240 words unless they ask for more detail.
`.trim(),
  };
}
