import type { ContractSuite } from "@latent/browser-lab/types";
import { foundationContractSuite } from "../content/foundations/contracts";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";

const foundationLessonIds = new Set(
  foundationContractSuite.contracts.map((contract) => contract.id.split("/")[0]),
);

export function contractSuiteForLesson(lessonId: string): ContractSuite {
  return foundationLessonIds.has(lessonId)
    ? foundationContractSuite
    : llmSystemsContractSuite;
}
