import type { CourseLesson } from "@latent/course-kit";
import { inferenceRuntimeLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/systems/inference-runtime";
import { streamingTransportLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/systems/streaming-transport";
import { schedulingMemoryLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/systems/scheduling-memory";
import { reliabilityObservabilityLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/systems/reliability-observability";
import { conversationStateLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/product/conversation-state";
import { streamingReactLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/product/streaming-react";
import { chatActionsContextLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/product/chat-actions-context";
import { chatProductQualityLesson } from "@/examples/learning-platform/llm-learning/lessons/extended/product/chat-product-quality";

export const systemsLessons: CourseLesson[] = [
  inferenceRuntimeLesson,
  streamingTransportLesson,
  schedulingMemoryLesson,
  reliabilityObservabilityLesson,
];

export const productLessons: CourseLesson[] = [
  conversationStateLesson,
  streamingReactLesson,
  chatActionsContextLesson,
  chatProductQualityLesson,
];
