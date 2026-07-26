import { foundationLearningOutcomes } from "@/examples/learning-platform/llm-learning/content/foundations/learning";
import { harnessEngineeringLearningOutcomes } from "@/examples/learning-platform/llm-learning/content/harness-engineering/learning";
import {
  lessonLearningOutcome as llmLessonLearningOutcome,
  moduleCheckpoint,
} from "@/examples/learning-platform/llm-learning/content/llm-systems/learning";

export { moduleCheckpoint };

export function lessonLearningOutcome(lessonId: string) {
  return foundationLearningOutcomes[lessonId as keyof typeof foundationLearningOutcomes]
    ?? harnessEngineeringLearningOutcomes[lessonId as keyof typeof harnessEngineeringLearningOutcomes]
    ?? llmLessonLearningOutcome(lessonId);
}
