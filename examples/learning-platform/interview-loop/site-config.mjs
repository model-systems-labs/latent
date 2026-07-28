import {
  createLearningSuiteHeaderConfiguration,
} from "../learning-suite.mjs";

export function createInterviewLoopHeader() {
  return createLearningSuiteHeaderConfiguration({
    rootHref: "../",
    currentId: "interview-loop",
  });
}
