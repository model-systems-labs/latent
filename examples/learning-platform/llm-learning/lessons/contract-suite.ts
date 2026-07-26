import type { ContractSuite } from "@latent/browser-lab/types";
import { foundationContractSuite } from "@/examples/learning-platform/llm-learning/content/foundations/contracts";
import { harnessEngineeringContractSuite } from "@/examples/learning-platform/llm-learning/content/harness-engineering/contracts";
import { llmSystemsContractSuite } from "@/examples/learning-platform/llm-learning/content/llm-systems/contracts";

const foundationLessonIds = new Set(
  foundationContractSuite.contracts.map((contract) => contract.id.split("/")[0]),
);
const harnessEngineeringLessonIds = new Set(
  harnessEngineeringContractSuite.contracts.map((contract) => contract.id.split("/")[0]),
);

export function contractSuiteForLesson(lessonId: string): ContractSuite {
  if (foundationLessonIds.has(lessonId)) return foundationContractSuite;
  if (harnessEngineeringLessonIds.has(lessonId)) return harnessEngineeringContractSuite;
  return llmSystemsContractSuite;
}
