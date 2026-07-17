import type { CourseLesson } from "@latent/course-kit";
import type { LessonLocalState } from "../lib/learner-state";

export type LessonGate = {
  label: "Code" | "Experiment" | "Check";
  complete: boolean;
};

export function lessonGateProgress(
  lesson: CourseLesson,
  state: LessonLocalState | undefined,
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
