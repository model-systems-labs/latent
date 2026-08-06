import { z } from "zod";

export const CURRICULUM_MANIFEST_VERSION = 1 as const;

const curriculumLessonReferenceSchema = z.object({
  lessonId: z.string().min(1),
  projectPath: z.string().min(3),
}).strict();

const curriculumModuleOverviewSchema = z.object({
  title: z.string().min(1),
  introduction: z.string().min(1),
  objectives: z.array(z.string().min(1)).min(1).max(5),
}).strict();

const curriculumModuleSchema = z.object({
  id: z.string().min(1),
  routeSlug: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  thesis: z.string().min(1),
  outcome: z.string().min(1),
  overview: curriculumModuleOverviewSchema.optional(),
  lessons: z.array(curriculumLessonReferenceSchema).min(1),
}).strict();

export const curriculumManifestSchema = z.object({
  schemaVersion: z.literal(CURRICULUM_MANIFEST_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  thesis: z.string().min(1),
  outcome: z.string().min(1),
  capstone: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    projectPath: z.string().min(3),
  }).strict().optional(),
  modules: z.array(curriculumModuleSchema).min(1),
}).strict();

export type CurriculumLessonReference = {
  /** Stable content identity used by routes and learner progress. */
  lessonId: string;
  /** Stable virtual-repository location. It is intentionally independent of moduleId. */
  projectPath: string;
};

export type CurriculumModuleOverview = {
  /** Learner-facing orientation heading, distinct from the module name. */
  title: string;
  /** Explains how the lessons connect before the learner opens one. */
  introduction: string;
  /** A short, ordered set of capabilities the module develops. */
  objectives: readonly string[];
};

export type CurriculumModuleDefinition = {
  id: string;
  /** Route compatibility is explicit instead of being inferred from projectPath. */
  routeSlug: string;
  order: number;
  title: string;
  shortTitle: string;
  thesis: string;
  outcome: string;
  /** Optional richer orientation for module landing pages. */
  overview?: CurriculumModuleOverview;
  lessons: readonly CurriculumLessonReference[];
};

export type CurriculumManifest = {
  schemaVersion: typeof CURRICULUM_MANIFEST_VERSION;
  id: string;
  title: string;
  shortTitle: string;
  thesis: string;
  outcome: string;
  capstone?: {
    title: string;
    description: string;
    projectPath: string;
  };
  modules: readonly CurriculumModuleDefinition[];
};

/**
 * Keeps literal module and lesson ids while checking the authoring shape.
 * Runtime validation happens in the LMS compiler where source lessons exist.
 */
export function defineCurriculumManifest<const TManifest extends CurriculumManifest>(
  manifest: TManifest,
): TManifest {
  curriculumManifestSchema.parse(manifest);
  return manifest;
}
