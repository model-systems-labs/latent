import { foundationLearningOutcomes } from "../content/foundations/learning";
import {
  lessonLearningOutcome as llmLessonLearningOutcome,
  moduleCheckpoint,
} from "../content/llm-systems/learning";

export { moduleCheckpoint };

export function lessonLearningOutcome(lessonId: string) {
  return foundationLearningOutcomes[lessonId as keyof typeof foundationLearningOutcomes]
    ?? llmLessonLearningOutcome(lessonId);
}
