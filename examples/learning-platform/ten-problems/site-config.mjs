import {
  createLearningSuiteHeaderNavigation,
  learningSuite,
} from "../learning-suite.mjs";

export const tenProblemsSiteUi = Object.freeze({
  productName: "Ten Problems",
  headerMeta: "10 Python problems",
  globalNavigationLabel: learningSuite.navigationLabel,
  globalNavigation: createLearningSuiteHeaderNavigation({
    rootHref: "../",
    currentId: "ten-problems",
  }),
  navigationLabel: "Ten Problems navigation",
  menuLabel: "Learning suite",
  reviewDirectory: "leeches",
  copy: Object.freeze({
    allNavigationLabel: "Practice",
    reviewNavigationLabel: "Review",
    allEyebrow: "Problem set",
    reviewEyebrow: "Repeated misses",
    emptyAll: "This problem set is empty.",
    emptyReview: "No repeated misses yet. A problem appears here after three attempts and two misses, and leaves when solved.",
    loading: "Loading Python practice…",
    runExamples: "Run examples",
    checkSolution: "Check solution",
    viewExampleSolution: "View example solution",
    initialResults: "Run the public example, then check every published case.",
    running: "Running your Python code…",
    passedHeading: "All checks passed",
    failedHeading: "Keep working",
    problemSingular: "problem",
    problemPlural: "problems",
    continueLabel: "Continue",
  }),
  appearance: Object.freeze({ palette: "cobalt" }),
  footerSummary: "Progress is saved on this device for this exact problem set.",
  attribution: "Built with Latent.",
  faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#171a21"/>
  <path d="M25 20 14 32l11 12M39 20l11 12-11 12" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"/>
</svg>`,
});
