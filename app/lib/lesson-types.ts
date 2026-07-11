export type CodeBlock = {
  id: string;
  label: string;
  purpose: string;
  concepts?: Array<{
    name: string;
    detail: string;
  }>;
  code: string;
  checkCode?: string;
};

export type LessonMode = "live-training" | "core-mechanism" | "local-inference";

export type CourseLesson = {
  id: string;
  number: number;
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
    codeBlocks: CodeBlock[];
  };
  experiment: {
    kind: "rnn" | "neural-lm" | "bpe" | "attention" | "transformer" | "icl";
    title: string;
    intro: string;
  };
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
