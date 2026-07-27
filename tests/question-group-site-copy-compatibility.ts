import type { QuestionGroupSiteCopy } from "@latent/course-kit/question-group-site";

// This is the complete copy contract released before trusted reference
// solutions were added. It must continue to compile without the newer,
// defaulted solution-disclosure label.
export const legacyQuestionGroupSiteCopy = {
  allNavigationLabel: "Practice",
  reviewNavigationLabel: "Review",
  allEyebrow: "Practice",
  reviewEyebrow: "Review",
  emptyAll: "No problems.",
  emptyReview: "Nothing to review.",
  loading: "Loading…",
  runExamples: "Run examples",
  checkSolution: "Check solution",
  cancelRun: "Cancel",
  runCanceled: "Canceled.",
  publicExamplesHeading: "Public example",
  inputLabel: "Input",
  expectedLabel: "Expected",
  initialResults: "Run the examples.",
  running: "Running…",
  passedHeading: "Passed",
  failedHeading: "Keep working",
  problemSingular: "problem",
  problemPlural: "problems",
  continueLabel: "Continue",
  editorLabel: "Solution editor",
  draftSaved: "Draft saved",
  draftRestored: "Draft restored",
  draftSessionOnly: "Draft kept for this visit",
  runtimeUnavailable: "Runtime unavailable.",
} satisfies QuestionGroupSiteCopy;
