import type { CourseLesson } from "@latent/course-kit";
import { latentTensorImport } from "@latent/tensor";

export function lessonImplementationPrelude(lesson: Pick<CourseLesson, "implementation">) {
  if (lesson.implementation.filename.endsWith(".py")) return "";
  return latentTensorImport(lesson.implementation.tensorOps ?? []);
}

export function lessonImplementationSource(lesson: Pick<CourseLesson, "implementation">, blockSources: string[]) {
  const prelude = lessonImplementationPrelude(lesson);
  return [prelude, ...blockSources, lesson.implementation.postlude].filter(Boolean).join("\n\n");
}

export function lessonBlockComment(lesson: Pick<CourseLesson, "implementation">, index: number, label: string) {
  const marker = lesson.implementation.filename.endsWith(".py") ? "#" : "//";
  return `${marker} ${String(index + 1).padStart(2, "0")} · ${label}`;
}
