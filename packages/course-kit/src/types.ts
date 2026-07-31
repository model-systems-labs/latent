import type { CurriculumModuleOverview } from "./manifest.js";

export type CodeBlock = {
  id: string;
  label: string;
  purpose: string;
  concepts?: Array<{
    name: string;
    detail: string;
  }>;
  /** Optional guided scaffold shown before the learner writes a solution. */
  starterCode?: string;
  code: string;
  checkCode?: string;
};

export type LessonMode = "live-training" | "core-mechanism" | "local-inference";

export type LessonSource = {
  role: "Primary" | "Paper" | "Specification" | "Implementation" | "Guide";
  title: string;
  authors: string;
  year: string;
  url: string;
  relevance: string;
};

export type CourseLessonExperiment = {
  title: string;
  intro: string;
} & (
  | {
      kind: "rnn" | "neural-lm" | "bpe" | "attention" | "icl" | "systems" | "product" | "fundamentals" | "harness";
      /** Presentation variant interpreted by the matching experiment kind. */
      variant?: string;
      interactive?: never;
    }
  | {
      kind: "trusted-interactive";
      variant?: never;
      /**
       * A reviewed application-owned HTML/CSS/JavaScript experience. This is a
       * compiled trusted-source reference, never a portable Learning Pack field.
       */
      interactive: {
        id: string;
        definitionVersion: number;
      };
    }
);

export type CourseLesson = {
  id: string;
  number: number;
  /** Stable owner used for course navigation and saved lesson progress. */
  courseId?: string;
  /** The top-level course this lesson belongs to. */
  programId?: string;
  /** Identifies the independent saved workspace, when this lesson owns a file. */
  projectScope?: "standalone" | "browser-chat" | "harness-engineering";
  courseTitle?: string;
  courseNumber?: number;
  lessonNumber?: number;
  mode: LessonMode;
  modeLabel: string;
  eyebrow: string;
  title: string;
  thesis: string;
  paperUrl: string;
  paperTitle: string;
  authors: string;
  year: string;
  paperContext: string;
  sources: LessonSource[];
  summary: Array<{
    label: string;
    body: string;
  }>;
  claims: {
    paper: string;
    lab: string;
    limit: string;
  };
  diagram: {
    title: string;
    caption: string;
    nodes: Array<{
      label: string;
      value: string;
    }>;
  };
  questions: {
    intro: string;
    suggestions: string[];
  };
  dataset: {
    name: string;
    source: string;
    license: string;
    size: string;
    preview: string;
  };
  implementation: {
    filename: string;
    intro: string;
    tensorOps?: string[];
    /** Supplied Python infrastructure appended after learner-owned cells. */
    postlude?: string;
    codeBlocks: CodeBlock[];
  };
  experiment: CourseLessonExperiment;
};

export type CourseTrack = {
  id: "models" | "systems" | "backend" | "product";
  number: number;
  title: string;
  shortTitle: string;
  thesis: string;
  outcome: string;
  overview?: CurriculumModuleOverview;
  lessonIds: string[];
};

export type DistributionCandidate = {
  token: string;
  probability: number;
};

export type BrowserModelConfig = {
  modelId: string;
  displayName: string;
  loadLabel: string;
};

export type PaperLesson = {
  id: string;
  labLabel: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  thesis: string;
  paperUrl: string;
  paperTitle: string;
  paperContext: string;
  summary: Array<{
    label: string;
    body: string;
  }>;
  diagram: {
    thresholdLabel: string;
    retainedLabel: string;
    massLabel: string;
    tailLabel: string;
    distribution: DistributionCandidate[];
  };
  questions: {
    intro: string;
    suggestions: string[];
  };
  implementation: {
    filename: string;
    intro: string;
    codeBlocks: CodeBlock[];
  };
  browserModel: BrowserModelConfig;
  footer: {
    label: string;
    next: string;
  };
};
