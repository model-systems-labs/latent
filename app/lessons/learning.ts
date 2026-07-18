import { foundationLearningOutcomes } from "../content/foundations/learning";
import { harnessEngineeringLearningOutcomes } from "../content/harness-engineering/learning";
import {
  lessonLearningOutcome as llmLessonLearningOutcome,
  moduleCheckpoint,
} from "../content/llm-systems/learning";

export { moduleCheckpoint };

export function lessonLearningOutcome(lessonId: string) {
  return foundationLearningOutcomes[lessonId as keyof typeof foundationLearningOutcomes]
    ?? harnessEngineeringLearningOutcomes[lessonId as keyof typeof harnessEngineeringLearningOutcomes]
    ?? llmLessonLearningOutcome(lessonId);
}
