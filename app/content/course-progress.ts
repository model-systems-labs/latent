export type LessonProgressLocation = {
  courseId: "linear-algebra" | "machine-learning-basics" | "harness-engineering" | "llm-systems";
  moduleId: string;
};

const modelLessons = new Set([
  "character-rnns",
  "neural-language-models",
  "subword-tokenization",
  "additive-attention",
  "transformers",
  "in-context-learning",
]);
const runtimeLessons = new Set(["inference-runtime", "scheduling-memory"]);
const servingLessons = new Set(["streaming-transport", "reliability-observability"]);
const linearAlgebraLessons = new Set([
  "arrays-and-shapes",
  "vector-operations",
  "dot-products",
  "matrix-multiplication",
  "batches-and-broadcasting",
]);
const machineLearningLessons = new Set([
  "ml-training-data",
  "ml-linear-regression",
  "ml-gradient-descent",
  "ml-binary-classification",
  "ml-neural-networks",
]);
const harnessEngineeringLessons = new Set([
  "agent-loop",
  "tool-contracts",
  "context-selection",
  "permissions-and-sandboxes",
  "state-and-recovery",
  "agent-evaluations",
  "task-orchestration",
  "integrated-harness",
]);

export const progressCourseIds = [
  "linear-algebra",
  "machine-learning-basics",
  "harness-engineering",
  "llm-systems",
] as const;

export function lessonProgressLocation(lessonId: string): LessonProgressLocation {
  if (linearAlgebraLessons.has(lessonId)) {
    return { courseId: "linear-algebra", moduleId: "linear-algebra-basics" };
  }
  if (machineLearningLessons.has(lessonId)) {
    return { courseId: "machine-learning-basics", moduleId: "machine-learning-basics" };
  }
  if (harnessEngineeringLessons.has(lessonId)) {
    return { courseId: "harness-engineering", moduleId: "harness-engineering" };
  }
  if (modelLessons.has(lessonId)) {
    return { courseId: "llm-systems", moduleId: "model-foundations" };
  }
  if (runtimeLessons.has(lessonId)) {
    return { courseId: "llm-systems", moduleId: "inference-runtime" };
  }
  if (servingLessons.has(lessonId)) {
    return { courseId: "llm-systems", moduleId: "llm-serving" };
  }
  return { courseId: "llm-systems", moduleId: "chat-integration" };
}
