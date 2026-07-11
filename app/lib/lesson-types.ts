export type CodeBlock = {
  id: string;
  label: string;
  purpose: string;
  concepts?: Array<{
    name: string;
    detail: string;
  }>;
  code: string;
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
