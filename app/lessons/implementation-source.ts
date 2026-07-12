import type { CourseLesson } from "@latent/course-kit";
import { latentTensorImport } from "@latent/tensor";

export function lessonImplementationPrelude(lesson: Pick<CourseLesson, "implementation">) {
  return latentTensorImport(lesson.implementation.tensorOps ?? []);
}

export function lessonImplementationSource(lesson: Pick<CourseLesson, "implementation">, blockSources: string[]) {
  const prelude = lessonImplementationPrelude(lesson);
  return [prelude, ...blockSources].filter(Boolean).join("\n\n");
}
