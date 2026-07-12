export const ARTIFACT_SCHEMA_VERSION = 1 as const;
export const ARTIFACT_BUNDLE_VERSION = 1 as const;

export type ArtifactJsonPrimitive = string | number | boolean | null;
export type ArtifactJson = ArtifactJsonPrimitive | ArtifactJson[] | { [key: string]: ArtifactJson };

export type ArtifactMode = "recorded" | "learner-validated" | "build";
export type ArtifactLinkRelation = "input" | "derived-from" | "checkpoint" | "assembled-from";

export type ArtifactLink = {
  artifactId: string;
  contentHash: string;
  kind: string;
  relation: ArtifactLinkRelation;
};

export type ArtifactProducer = {
  runtime: string;
  version: string;
  operation: string;
  sourceHash?: string;
};

export type ArtifactValidation = {
  status: "recorded" | "passed";
  contractVersion?: string;
  receiptId?: string;
  passedCount?: number;
  totalCount?: number;
};

export type ArtifactReplayFrame = {
  index: number;
  at: number;
  label: string;
  payload: ArtifactJson;
  metrics: Record<string, number>;
};

export type ArtifactReplay = {
  clock: "step" | "token" | "event" | "request" | "state";
  unit: string;
  frames: ArtifactReplayFrame[];
};

export type ArtifactEnvelope = {
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  id: string;
  contentHash: string;
  kind: string;
  mode: ArtifactMode;
  title: string;
  description: string;
  projectId: string;
  moduleId: string | null;
  lessonId: string | null;
  createdAt: number;
  producer: ArtifactProducer;
  validation: ArtifactValidation;
  labels: string[];
  links: ArtifactLink[];
  metrics: Record<string, number>;
  payload: ArtifactJson;
  replay: ArtifactReplay | null;
};

export type ArtifactHeadRecord = {
  id: string;
  projectId: string;
  channel: "lesson-output" | "project-build";
  scopeId: string;
  artifactId: string;
  updatedAt: number;
};

export type CreateArtifactInput = Omit<ArtifactEnvelope, "schemaVersion" | "id" | "contentHash" | "createdAt"> & {
  createdAt?: number;
};

export type ArtifactMetricDifference = {
  key: string;
  before: number | null;
  after: number | null;
  delta: number | null;
};

export type ArtifactComparison = {
  beforeId: string;
  afterId: string;
  sameKind: boolean;
  metrics: ArtifactMetricDifference[];
  changedPayloadPaths: string[];
};

export type PortableArtifactBundle = {
  format: "latent-artifact";
  bundleVersion: typeof ARTIFACT_BUNDLE_VERSION;
  exportedAt: number;
  rootArtifactId: string;
  artifacts: ArtifactEnvelope[];
};
