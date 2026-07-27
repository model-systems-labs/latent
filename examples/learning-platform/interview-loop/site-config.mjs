import {
  createLearningSuiteHeaderNavigation,
  learningSuite,
} from "../learning-suite.mjs";

export function createInterviewLoopHeader(header) {
  if (!header || typeof header !== "object" || Array.isArray(header)) {
    throw new Error("Interview Loop requires learner header configuration.");
  }
  return Object.freeze({
    ...header,
    globalNavigationLabel: learningSuite.navigationLabel,
    globalNavigation: createLearningSuiteHeaderNavigation({
      rootHref: "../",
      currentId: "interview-loop",
    }),
  });
}
