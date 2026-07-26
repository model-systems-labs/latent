import type { ContractSuite } from "@latent/browser-lab/types";
import { foundationContractSuite } from "../content/foundations/contracts";
import { harnessEngineeringContractSuite } from "../content/harness-engineering/contracts";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";

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
