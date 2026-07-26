import type { CourseLesson } from "@latent/course-kit";

export type LessonProgressSnapshot = {
  verifiedCells: readonly string[];
  verifiedSources: Readonly<Record<string, string>>;
  verifiedContractVersion: string | null;
  experimentComplete: boolean;
  answers: Readonly<Record<string, string>>;
  knowledgeVerified: readonly string[];
};

export type LessonGate = {
  label: "Code" | "Experiment" | "Check";
  complete: boolean;
};

export function lessonGateProgress(
  lesson: CourseLesson,
  state: LessonProgressSnapshot | undefined,
  expectedContractVersion: string,
  knowledgeCheckId: string,
) {
  const codeComplete = Boolean(
    state?.verifiedContractVersion === expectedContractVersion
    && lesson.implementation.codeBlocks.every((block) => (
      state.verifiedCells.includes(block.id)
      && typeof state.answers[block.id] === "string"
      && state.verifiedSources[block.id] === state.answers[block.id]
    )),
  );
  const gates: LessonGate[] = [
    { label: "Code", complete: codeComplete },
    { label: "Experiment", complete: Boolean(state?.experimentComplete) },
    { label: "Check", complete: Boolean(state?.knowledgeVerified.includes(knowledgeCheckId)) },
  ];
  const completed = gates.filter((gate) => gate.complete).length;
  return { gates, completed, complete: completed === gates.length };
}
