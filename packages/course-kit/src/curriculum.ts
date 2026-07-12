import type {
  CurriculumManifest,
  CurriculumModuleDefinition,
} from "./manifest.js";

export type CurriculumSourceLesson = {
  id: string;
  implementation: {
    filename: string;
    codeBlocks: readonly unknown[];
  };
};

export type DerivedCurriculumLesson<TLesson extends CurriculumSourceLesson> = {
  id: string;
  moduleId: string;
  projectPath: string;
  position: number;
  testCount: number;
  lesson: TLesson;
};

export type DerivedCurriculumModule<TLesson extends CurriculumSourceLesson> = Omit<
  CurriculumModuleDefinition,
  "lessons"
> & {
  position: number;
  lessonIds: string[];
  lessons: DerivedCurriculumLesson<TLesson>[];
  lessonCount: number;
  testCount: number;
};

export type DerivedCurriculum<TLesson extends CurriculumSourceLesson> = Omit<
  CurriculumManifest,
  "modules"
> & {
  modules: DerivedCurriculumModule<TLesson>[];
  lessons: DerivedCurriculumLesson<TLesson>[];
  lessonCount: number;
  testCount: number;
  lessonById: Readonly<Record<string, DerivedCurriculumLesson<TLesson>>>;
  moduleById: Readonly<Record<string, DerivedCurriculumModule<TLesson>>>;
  moduleByRouteSlug: Readonly<Record<string, DerivedCurriculumModule<TLesson>>>;
};

export type CurriculumManifestIssue = {
  path: string;
  message: string;
};

export class CurriculumManifestError extends Error {
  readonly issues: readonly CurriculumManifestIssue[];

  constructor(issues: readonly CurriculumManifestIssue[]) {
    super(
      `Invalid curriculum manifest:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "CurriculumManifestError";
    this.issues = issues;
  }
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_PATH_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+$/;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function addDuplicateIssues(
  values: readonly string[],
  pathForIndex: (index: number) => string,
  label: string,
  issues: CurriculumManifestIssue[],
) {
  const firstIndex = new Map<string, number>();
  values.forEach((value, index) => {
    const prior = firstIndex.get(value);
    if (prior === undefined) {
      firstIndex.set(value, index);
      return;
    }
    issues.push({
      path: pathForIndex(index),
      message: `${label} duplicates entry ${prior + 1}: ${value}`,
    });
  });
}

export function validateCurriculumManifest(
  manifest: CurriculumManifest,
): CurriculumManifestIssue[] {
  const issues: CurriculumManifestIssue[] = [];
  const requireText = (path: string, value: string) => {
    if (!isNonEmpty(value)) issues.push({ path, message: "must not be empty" });
  };

  requireText("id", manifest.id);
  if (!ID_PATTERN.test(manifest.id)) {
    issues.push({ path: "id", message: "must be a lowercase kebab-case id" });
  }
  requireText("title", manifest.title);
  requireText("shortTitle", manifest.shortTitle);
  requireText("thesis", manifest.thesis);
  requireText("outcome", manifest.outcome);
  requireText("capstone.title", manifest.capstone.title);
  requireText("capstone.description", manifest.capstone.description);
  validateProjectPath("capstone.projectPath", manifest.capstone.projectPath, issues);

  if (manifest.modules.length === 0) {
    issues.push({ path: "modules", message: "must contain at least one module" });
  }

  addDuplicateIssues(
    manifest.modules.map((module) => module.id),
    (index) => `modules[${index}].id`,
    "module id",
    issues,
  );
  addDuplicateIssues(
    manifest.modules.map((module) => module.routeSlug),
    (index) => `modules[${index}].routeSlug`,
    "module routeSlug",
    issues,
  );

  const allLessonIds: string[] = [];
  const allProjectPaths: string[] = [];
  manifest.modules.forEach((module, moduleIndex) => {
    const path = `modules[${moduleIndex}]`;
    requireText(`${path}.id`, module.id);
    if (!ID_PATTERN.test(module.id)) {
      issues.push({ path: `${path}.id`, message: "must be a lowercase kebab-case id" });
    }
    requireText(`${path}.routeSlug`, module.routeSlug);
    if (!ID_PATTERN.test(module.routeSlug)) {
      issues.push({ path: `${path}.routeSlug`, message: "must be a lowercase kebab-case slug" });
    }
    if (module.order !== moduleIndex + 1) {
      issues.push({ path: `${path}.order`, message: `must equal ${moduleIndex + 1}` });
    }
    requireText(`${path}.title`, module.title);
    requireText(`${path}.shortTitle`, module.shortTitle);
    requireText(`${path}.thesis`, module.thesis);
    requireText(`${path}.outcome`, module.outcome);
    if (module.lessons.length === 0) {
      issues.push({ path: `${path}.lessons`, message: "must contain at least one lesson" });
    }

    module.lessons.forEach((reference, lessonIndex) => {
      const lessonPath = `${path}.lessons[${lessonIndex}]`;
      requireText(`${lessonPath}.lessonId`, reference.lessonId);
      if (!ID_PATTERN.test(reference.lessonId)) {
        issues.push({ path: `${lessonPath}.lessonId`, message: "must be a lowercase kebab-case id" });
      }
      validateProjectPath(`${lessonPath}.projectPath`, reference.projectPath, issues);
      allLessonIds.push(reference.lessonId);
      allProjectPaths.push(reference.projectPath);
    });
  });

  addDuplicateIssues(
    allLessonIds,
    (index) => `lessons[${index}].lessonId`,
    "lesson id",
    issues,
  );
  addDuplicateIssues(
    allProjectPaths,
    (index) => `lessons[${index}].projectPath`,
    "projectPath",
    issues,
  );
  return issues;
}

function validateProjectPath(
  path: string,
  value: string,
  issues: CurriculumManifestIssue[],
) {
  if (!PROJECT_PATH_PATTERN.test(value) || value.includes("..") || value.startsWith("/")) {
    issues.push({
      path,
      message: "must be a normalized relative project path with at least one directory",
    });
  }
}

export function assertValidCurriculumManifest(manifest: CurriculumManifest): void {
  const issues = validateCurriculumManifest(manifest);
  if (issues.length > 0) throw new CurriculumManifestError(issues);
}

/**
 * Resolves authored references against canonical lesson content and derives all
 * navigation/test counts. The strict coverage check prevents a new source
 * lesson from becoming unreachable because somebody forgot the manifest.
 */
export function deriveCurriculum<TLesson extends CurriculumSourceLesson>(
  manifest: CurriculumManifest,
  sourceLessons: readonly TLesson[],
): DerivedCurriculum<TLesson> {
  assertValidCurriculumManifest(manifest);

  const issues: CurriculumManifestIssue[] = [];
  const sourceById = new Map<string, TLesson>();
  sourceLessons.forEach((lesson, index) => {
    if (sourceById.has(lesson.id)) {
      issues.push({ path: `sourceLessons[${index}].id`, message: `duplicate source lesson: ${lesson.id}` });
    } else {
      sourceById.set(lesson.id, lesson);
    }
  });

  const referencedIds = new Set<string>();
  manifest.modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((reference, lessonIndex) => {
      referencedIds.add(reference.lessonId);
      if (!sourceById.has(reference.lessonId)) {
        issues.push({
          path: `modules[${moduleIndex}].lessons[${lessonIndex}].lessonId`,
          message: `source lesson does not exist: ${reference.lessonId}`,
        });
      }
    });
  });
  sourceLessons.forEach((lesson, index) => {
    if (!referencedIds.has(lesson.id)) {
      issues.push({
        path: `sourceLessons[${index}].id`,
        message: `source lesson is not assigned to a module: ${lesson.id}`,
      });
    }
  });
  if (issues.length > 0) throw new CurriculumManifestError(issues);

  let globalPosition = 0;
  const modules = manifest.modules.map((module, moduleIndex) => {
    const lessons = module.lessons.map((reference) => {
      const lesson = sourceById.get(reference.lessonId)!;
      globalPosition += 1;
      return {
        id: reference.lessonId,
        moduleId: module.id,
        projectPath: reference.projectPath,
        position: globalPosition,
        testCount: lesson.implementation.codeBlocks.length,
        lesson,
      };
    });
    return {
      ...module,
      position: moduleIndex + 1,
      lessonIds: lessons.map((lesson) => lesson.id),
      lessons,
      lessonCount: lessons.length,
      testCount: lessons.reduce((total, lesson) => total + lesson.testCount, 0),
    };
  });
  const lessons = modules.flatMap((module) => module.lessons);

  return {
    ...manifest,
    modules,
    lessons,
    lessonCount: lessons.length,
    testCount: modules.reduce((total, module) => total + module.testCount, 0),
    lessonById: Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson])),
    moduleById: Object.fromEntries(modules.map((module) => [module.id, module])),
    moduleByRouteSlug: Object.fromEntries(modules.map((module) => [module.routeSlug, module])),
  };
}
