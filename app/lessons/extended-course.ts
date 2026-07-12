import type { CourseLesson } from "@latent/course-kit";
import { inferenceRuntimeLesson } from "./extended/systems/inference-runtime";
import { streamingTransportLesson } from "./extended/systems/streaming-transport";
import { schedulingMemoryLesson } from "./extended/systems/scheduling-memory";
import { reliabilityObservabilityLesson } from "./extended/systems/reliability-observability";
import { conversationStateLesson } from "./extended/product/conversation-state";
import { streamingReactLesson } from "./extended/product/streaming-react";
import { chatActionsContextLesson } from "./extended/product/chat-actions-context";
import { chatProductQualityLesson } from "./extended/product/chat-product-quality";

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
