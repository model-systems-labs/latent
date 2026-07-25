import { z } from "zod";

export const QUESTION_GROUP_LIBRARY_FORMAT = "latent-question-group-library" as const;
export const QUESTION_GROUP_LIBRARY_SCHEMA_VERSION = 1 as const;
export const MAX_QUESTION_GROUP_LIBRARY_BYTES = 2_000_000;

const libraryIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,63}$/;
const contentIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const sourcePathPattern = /^(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))(?!.*\\)(?!.*%2e)(?!.*%5c)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/i;
const extensionKeyPattern = /^[a-z0-9][a-z0-9.-]{1,127}\/[a-z0-9][a-z0-9._-]{0,63}$/;
const spdxExpressionPattern = /^[A-Za-z0-9.+-]+(?: (?:AND|OR|WITH) [A-Za-z0-9.+-]+)*$/;
const javascriptIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const pythonIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const javascriptReservedWords = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);
const pythonReservedWords = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const MAX_JSON_DEPTH = 12;
const MAX_JSON_NODES = 2_000;
const MAX_JSON_ENTRIES = 200;
const MAX_JSON_STRING_LENGTH = 20_000;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function jsonValueProblem(input: unknown) {
  const stack: Array<{ depth: number; value: unknown }> = [{ depth: 0, value: input }];
  const seen = new Set<object>();
  let nodes = 0;

  while (stack.length) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_JSON_NODES) {
      return `JSON values may not contain more than ${MAX_JSON_NODES} nodes.`;
    }
    if (current.depth > MAX_JSON_DEPTH) {
      return `JSON values may not be nested more than ${MAX_JSON_DEPTH} levels.`;
    }
    if (
      current.value === null
      || typeof current.value === "boolean"
      || (typeof current.value === "number" && Number.isFinite(current.value))
    ) continue;
    if (typeof current.value === "string") {
      if (current.value.length > MAX_JSON_STRING_LENGTH) {
        return `JSON strings may not exceed ${MAX_JSON_STRING_LENGTH} characters.`;
      }
      continue;
    }
    if (!current.value || typeof current.value !== "object") {
      return "Values must contain JSON data only.";
    }
    if (seen.has(current.value)) {
      return "JSON values may not contain cycles or shared object references.";
    }
    seen.add(current.value);
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_JSON_ENTRIES) {
        return `JSON arrays may not contain more than ${MAX_JSON_ENTRIES} entries.`;
      }
      current.value.forEach((value) => stack.push({ depth: current.depth + 1, value }));
      continue;
    }
    const prototype = Object.getPrototypeOf(current.value);
    if (prototype !== Object.prototype && prototype !== null) {
      return "JSON values must use plain objects.";
    }
    const entries = Object.entries(current.value);
    if (entries.length > MAX_JSON_ENTRIES) {
      return `JSON objects may not contain more than ${MAX_JSON_ENTRIES} fields.`;
    }
    for (const [key, value] of entries) {
      if (key.length > 200) return "JSON object keys may not exceed 200 characters.";
      stack.push({ depth: current.depth + 1, value });
    }
  }
  return null;
}

const boundedJsonValueSchema = z.unknown().superRefine((value, context) => {
  const problem = jsonValueProblem(value);
  if (problem) context.addIssue({ code: "custom", message: problem });
}) as z.ZodType<JsonValue>;

const libraryIdSchema = z.string()
  .min(3)
  .max(129)
  .regex(libraryIdPattern, "Use a namespaced id such as publisher/topic.")
  .refine(
    (value) => value.split("/", 1)[0]!.length <= 64,
    "The publisher namespace may not exceed 64 characters.",
  );

const contentIdSchema = z.string()
  .min(1)
  .max(80)
  .regex(contentIdPattern, "Use lowercase letters, numbers, dots, underscores, or hyphens.");

const webUrlSchema = z.url().max(2_000).superRefine((value, context) => {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) {
    context.addIssue({ code: "custom", message: "Use an HTTP or HTTPS URL." });
  }
  if (url.username || url.password) {
    context.addIssue({ code: "custom", message: "URLs may not contain credentials." });
  }
});

const extensionKeySchema = z.string().min(3).max(193).regex(
  extensionKeyPattern,
  "Use a namespaced extension key such as example.org/hint-style.",
);

const extensionsSchema = z.record(extensionKeySchema, boundedJsonValueSchema);

export const questionGroupAuthorSchema = z.object({
  name: z.string().trim().min(2).max(160),
  url: webUrlSchema.optional(),
}).strict();

export const questionGroupLicenseSchema = z.object({
  expression: z.string().min(2).max(200).regex(
    spdxExpressionPattern,
    "Use an SPDX license expression such as Apache-2.0 or CC-BY-4.0.",
  ),
  url: webUrlSchema.optional(),
}).strict();

export const questionGroupSourceSchema = z.object({
  id: contentIdSchema,
  title: z.string().trim().min(3).max(300),
  url: webUrlSchema,
  note: z.string().trim().min(10).max(1_000),
  license: questionGroupLicenseSchema.optional(),
}).strict();

export const questionGroupObjectiveSchema = z.object({
  id: contentIdSchema,
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(20).max(1_000),
}).strict();

export const questionGroupRuntimeRequirementSchema = z.object({
  id: contentIdSchema,
  language: z.enum(["javascript", "typescript", "python"]),
  environment: z.enum(["browser-worker", "host-managed"]),
  engine: z.string().trim().min(2).max(100),
  engineVersion: z.string().trim().min(1).max(100),
  capabilities: z.array(z.enum(["function", "class-method", "exceptions"]))
    .min(1)
    .max(3),
  limits: z.object({
    timeoutMs: z.number().int().min(100).max(10_000),
    maxOutputBytes: z.number().int().min(1_024).max(1_000_000),
  }).strict(),
}).strict();

const assertionPathSchema = z.array(z.union([
  z.string().min(1).max(200),
  z.number().int().nonnegative().max(1_000_000),
])).min(1).max(32);
const assertionBase = {
  id: contentIdSchema,
  label: z.string().trim().min(3).max(160),
};
const assertionResultPath = {
  path: assertionPathSchema.optional(),
};

const deepEqualAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("deep-equal"),
  expected: boundedJsonValueSchema,
}).strict();

const typeAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("type"),
  expected: z.enum(["null", "array", "object", "string", "number", "boolean"]),
}).strict();

const truthyAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("truthy"),
}).strict();

const finiteAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("finite"),
}).strict();

const rangeAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("range"),
  minimum: z.number().finite(),
  maximum: z.number().finite(),
}).strict().superRefine((assertion, context) => {
  if (assertion.minimum > assertion.maximum) {
    context.addIssue({
      code: "custom",
      path: ["minimum"],
      message: "The minimum may not exceed the maximum.",
    });
  }
});

const lengthAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("length"),
  expected: z.number().int().min(0).max(1_000_000),
}).strict();

const includesAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("includes"),
  expected: boundedJsonValueSchema,
}).strict();

const regexFlagsSchema = z.enum(["", "i", "m", "s", "im", "is", "ms", "ims"]);

const matchesAssertionSchema = z.object({
  ...assertionBase,
  ...assertionResultPath,
  kind: z.literal("matches"),
  pattern: z.string().max(500),
  flags: regexFlagsSchema.optional(),
}).strict();

const throwsAssertionSchema = z.object({
  ...assertionBase,
  kind: z.literal("throws"),
  errorName: z.string().trim().min(1).max(160).optional(),
  messagePattern: z.string().max(500).optional(),
}).strict();

export const portableAssertionSchema = z.discriminatedUnion("kind", [
  deepEqualAssertionSchema,
  typeAssertionSchema,
  truthyAssertionSchema,
  finiteAssertionSchema,
  rangeAssertionSchema,
  lengthAssertionSchema,
  includesAssertionSchema,
  matchesAssertionSchema,
  throwsAssertionSchema,
]);

const functionEntrypointSchema = z.object({
  kind: z.literal("function"),
  functionName: z.string().min(1).max(120).regex(
    javascriptIdentifierPattern,
    "Use a valid JavaScript, TypeScript, or Python identifier.",
  ),
}).strict();

const classMethodEntrypointSchema = z.object({
  kind: z.literal("class-method"),
  className: z.string().min(1).max(120).regex(
    javascriptIdentifierPattern,
    "Use a valid JavaScript, TypeScript, or Python identifier.",
  ),
  methodName: z.string().min(1).max(120).regex(
    javascriptIdentifierPattern,
    "Use a valid JavaScript, TypeScript, or Python identifier.",
  ),
}).strict();

export const questionEntrypointSchema = z.discriminatedUnion("kind", [
  functionEntrypointSchema,
  classMethodEntrypointSchema,
]);

export const practiceCaseSchema = z.object({
  id: contentIdSchema,
  label: z.string().trim().min(3).max(160),
  visibility: z.enum(["example", "check"]),
  args: z.array(boundedJsonValueSchema).max(20),
  constructorArgs: z.array(boundedJsonValueSchema).max(20).optional(),
  assertions: z.array(portableAssertionSchema).min(1).max(20),
}).strict();

export const practiceQuestionSchema = z.object({
  id: contentIdSchema,
  order: z.number().int().positive().max(10_000),
  title: z.string().trim().min(3).max(160),
  prompt: z.string().trim().min(20).max(20_000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  language: z.enum(["javascript", "typescript", "python"]),
  path: z.string().min(1).max(500).regex(
    sourcePathPattern,
    "Use a safe relative source path without parent-directory segments.",
  ),
  starterCode: z.string().min(1).max(50_000),
  entrypoint: questionEntrypointSchema,
  objectiveIds: z.array(contentIdSchema).min(1).max(30),
  sourceIds: z.array(contentIdSchema).min(1).max(30),
  runtimeId: contentIdSchema,
  constraints: z.array(z.string().trim().min(3).max(500)).min(1).max(30),
  cases: z.array(practiceCaseSchema).min(2).max(50),
  tags: z.array(contentIdSchema).max(30).optional(),
  extensions: extensionsSchema.optional(),
}).strict();

export const questionGroupSchema = z.object({
  id: contentIdSchema,
  order: z.number().int().positive().max(10_000),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(1_000),
  objectiveIds: z.array(contentIdSchema).min(1).max(30),
  questions: z.array(practiceQuestionSchema).min(1).max(200),
  tags: z.array(contentIdSchema).max(30).optional(),
  extensions: extensionsSchema.optional(),
}).strict();

export const questionGroupLibrarySchema = z.object({
  format: z.literal(QUESTION_GROUP_LIBRARY_FORMAT),
  schemaVersion: z.literal(QUESTION_GROUP_LIBRARY_SCHEMA_VERSION),
  library: z.object({
    id: libraryIdSchema,
    version: z.string().regex(semverPattern, "Use a semantic version such as 1.0.0."),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(30).max(500),
    authors: z.array(questionGroupAuthorSchema).min(1).max(20),
    license: questionGroupLicenseSchema,
    provenance: z.object({
      sourceUrl: webUrlSchema,
      revision: z.string().trim().min(1).max(200),
    }).strict(),
  }).strict(),
  objectives: z.array(questionGroupObjectiveSchema).min(1).max(200),
  sources: z.array(questionGroupSourceSchema).min(1).max(500),
  runtimes: z.array(questionGroupRuntimeRequirementSchema).min(1).max(30),
  groups: z.array(questionGroupSchema).min(1).max(100),
  extensions: extensionsSchema.optional(),
}).strict();

export type PortableAssertion = z.infer<typeof portableAssertionSchema>;
export type PracticeCase = z.infer<typeof practiceCaseSchema>;
export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;
export type QuestionGroup = z.infer<typeof questionGroupSchema>;
export type QuestionGroupLibrary = z.infer<typeof questionGroupLibrarySchema>;
export type QuestionGroupAuthor = z.infer<typeof questionGroupAuthorSchema>;
export type QuestionGroupLicense = z.infer<typeof questionGroupLicenseSchema>;
export type QuestionGroupObjective = z.infer<typeof questionGroupObjectiveSchema>;
export type QuestionGroupSource = z.infer<typeof questionGroupSourceSchema>;
export type QuestionGroupRuntimeRequirement = z.infer<
  typeof questionGroupRuntimeRequirementSchema
>;

export type QuestionGroupLibraryIssue = {
  path: string;
  code: string;
  message: string;
};

export type QuestionGroupLibrarySummary = {
  groups: number;
  questions: number;
  cases: number;
  exampleCases: number;
  checkCases: number;
};

export type QuestionGroupLibraryValidation =
  | {
      valid: true;
      library: QuestionGroupLibrary;
      errors: [];
      warnings: QuestionGroupLibraryIssue[];
      summary: QuestionGroupLibrarySummary;
    }
  | {
      valid: false;
      errors: QuestionGroupLibraryIssue[];
      warnings: QuestionGroupLibraryIssue[];
      summary: null;
    };

function issue(
  path: Array<string | number | symbol>,
  code: string,
  message: string,
): QuestionGroupLibraryIssue {
  return {
    path: path.length ? path.map(String).join(".") : "$",
    code,
    message,
  };
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function semanticValidation(library: QuestionGroupLibrary) {
  const errors: QuestionGroupLibraryIssue[] = [];
  const groupIds = library.groups.map((group) => group.id);
  const questionIds: string[] = [];
  const objectiveIds = new Set(library.objectives.map((objective) => objective.id));
  const sourceIds = new Set(library.sources.map((source) => source.id));
  const runtimeById = new Map(library.runtimes.map((runtime) => [runtime.id, runtime]));

  const reportDuplicateIds = (
    values: readonly string[],
    path: Array<string | number>,
    label: string,
  ) => {
    for (const duplicate of duplicateValues(values)) {
      errors.push(issue(path, "duplicate-id", `The ${label} id "${duplicate}" is used more than once.`));
    }
  };
  const reportUnknownReferences = (
    values: readonly string[],
    known: ReadonlySet<string>,
    path: Array<string | number>,
    label: string,
  ) => {
    for (const [index, value] of values.entries()) {
      if (!known.has(value)) {
        errors.push(issue(
          [...path, index],
          `unknown-${label}`,
          `The ${label} "${value}" is not declared by this library.`,
        ));
      }
    }
  };
  const validateExtensions = (
    extensions: Record<string, JsonValue> | undefined,
    path: Array<string | number>,
  ) => {
    if (extensions && Object.keys(extensions).length > 50) {
      errors.push(issue(path, "too-many-extensions", "At most 50 namespaced extensions are allowed."));
    }
  };

  reportDuplicateIds(library.objectives.map((objective) => objective.id), ["objectives"], "objective");
  reportDuplicateIds(library.sources.map((source) => source.id), ["sources"], "source");
  reportDuplicateIds(library.runtimes.map((runtime) => runtime.id), ["runtimes"], "runtime");
  validateExtensions(library.extensions, ["extensions"]);
  if (/^(?:head|latest|main|master)$/i.test(library.library.provenance.revision)) {
    errors.push(issue(
      ["library", "provenance", "revision"],
      "mutable-provenance-revision",
      "Provenance must name an immutable revision, version, or digest rather than a moving branch.",
    ));
  }

  library.runtimes.forEach((runtime, runtimeIndex) => {
    for (const duplicate of duplicateValues(runtime.capabilities)) {
      errors.push(issue(
        ["runtimes", runtimeIndex, "capabilities"],
        "duplicate-capability",
        `The runtime capability "${duplicate}" is repeated.`,
      ));
    }
    if (runtime.environment === "browser-worker" && runtime.language === "python") {
      errors.push(issue(
        ["runtimes", runtimeIndex, "environment"],
        "unsupported-portable-python-runtime",
        "Portable Python execution must be host-managed; the self-hosted player runs JavaScript and TypeScript only.",
      ));
    }
  });

  for (const duplicate of duplicateValues(groupIds)) {
    errors.push(issue(["groups"], "duplicate-id", `The group id "${duplicate}" is used more than once.`));
  }
  for (const duplicate of duplicateValues(library.groups.map((group) => String(group.order)))) {
    errors.push(issue(["groups"], "duplicate-order", `Group order ${duplicate} is used more than once.`));
  }

  library.groups.forEach((group, groupIndex) => {
    reportUnknownReferences(
      group.objectiveIds,
      objectiveIds,
      ["groups", groupIndex, "objectiveIds"],
      "objective",
    );
    for (const duplicate of duplicateValues(group.objectiveIds)) {
      errors.push(issue(
        ["groups", groupIndex, "objectiveIds"],
        "duplicate-objective-reference",
        `The objective "${duplicate}" is referenced more than once.`,
      ));
    }
    validateExtensions(group.extensions, ["groups", groupIndex, "extensions"]);
    for (const duplicate of duplicateValues(group.tags ?? [])) {
      errors.push(issue(
        ["groups", groupIndex, "tags"],
        "duplicate-tag",
        `The tag "${duplicate}" is repeated.`,
      ));
    }
    for (const duplicate of duplicateValues(group.questions.map((question) => String(question.order)))) {
      errors.push(issue(
        ["groups", groupIndex, "questions"],
        "duplicate-order",
        `Question order ${duplicate} is used more than once in group "${group.id}".`,
      ));
    }

    group.questions.forEach((question, questionIndex) => {
      const questionPath = ["groups", groupIndex, "questions", questionIndex] as const;
      questionIds.push(question.id);

      reportUnknownReferences(
        question.objectiveIds,
        objectiveIds,
        [...questionPath, "objectiveIds"],
        "objective",
      );
      for (const [objectiveIndex, objectiveId] of question.objectiveIds.entries()) {
        if (!group.objectiveIds.includes(objectiveId)) {
          errors.push(issue(
            [...questionPath, "objectiveIds", objectiveIndex],
            "objective-outside-group",
            `Question objective "${objectiveId}" must also be declared by group "${group.id}".`,
          ));
        }
      }
      reportUnknownReferences(
        question.sourceIds,
        sourceIds,
        [...questionPath, "sourceIds"],
        "source",
      );
      for (const [field, values] of [
        ["objectiveIds", question.objectiveIds],
        ["sourceIds", question.sourceIds],
      ] as const) {
        for (const duplicate of duplicateValues(values)) {
          errors.push(issue(
            [...questionPath, field],
            `duplicate-${field === "objectiveIds" ? "objective" : "source"}-reference`,
            `The ${field === "objectiveIds" ? "objective" : "source"} "${duplicate}" is referenced more than once.`,
          ));
        }
      }
      validateExtensions(question.extensions, [...questionPath, "extensions"]);

      const runtime = runtimeById.get(question.runtimeId);
      if (!runtime) {
        errors.push(issue(
          [...questionPath, "runtimeId"],
          "unknown-runtime",
          `The runtime "${question.runtimeId}" is not declared by this library.`,
        ));
      } else {
        if (runtime.language !== question.language) {
          errors.push(issue(
            [...questionPath, "runtimeId"],
            "runtime-language-mismatch",
            `Runtime "${runtime.id}" provides ${runtime.language}, not ${question.language}.`,
          ));
        }
        if (!runtime.capabilities.includes(question.entrypoint.kind)) {
          errors.push(issue(
            [...questionPath, "runtimeId"],
            "missing-runtime-capability",
            `Runtime "${runtime.id}" does not declare the ${question.entrypoint.kind} capability.`,
          ));
        }
        const usesThrows = question.cases.some((practiceCase) => (
          practiceCase.assertions.some((assertion) => assertion.kind === "throws")
        ));
        if (usesThrows && !runtime.capabilities.includes("exceptions")) {
          errors.push(issue(
            [...questionPath, "runtimeId"],
            "missing-runtime-capability",
            `Runtime "${runtime.id}" must declare the exceptions capability for throws assertions.`,
          ));
        }
      }

      for (const duplicate of duplicateValues(question.tags ?? [])) {
        errors.push(issue(
          [...questionPath, "tags"],
          "duplicate-tag",
          `The tag "${duplicate}" is repeated.`,
        ));
      }

      const requiredExtension = {
        javascript: [".js", ".mjs", ".cjs"],
        typescript: [".ts"],
        python: [".py"],
      }[question.language];
      if (!requiredExtension.some((extension) => question.path.endsWith(extension))) {
        errors.push(issue(
          [...questionPath, "path"],
          "language-path-mismatch",
          `A ${question.language} question must use ${requiredExtension.join(" or ")} source path.`,
        ));
      }

      const entrypointNames = question.entrypoint.kind === "function"
        ? [["functionName", question.entrypoint.functionName] as const]
        : [
            ["className", question.entrypoint.className] as const,
            ["methodName", question.entrypoint.methodName] as const,
          ];
      if (
        question.language === "python"
        && entrypointNames.some(([, name]) => !pythonIdentifierPattern.test(name))
      ) {
        errors.push(issue(
          [...questionPath, "entrypoint"],
          "invalid-python-identifier",
          "Python entrypoint names must use valid Python identifiers.",
        ));
      }
      const reservedWords = question.language === "python"
        ? pythonReservedWords
        : javascriptReservedWords;
      entrypointNames.forEach(([field, name]) => {
        if (reservedWords.has(name)) {
          errors.push(issue(
            [...questionPath, "entrypoint", field],
            "reserved-entrypoint-identifier",
            `"${name}" is a reserved ${question.language} word and cannot be used as an entrypoint name.`,
          ));
        }
      });

      const exampleCases = question.cases.filter((practiceCase) => practiceCase.visibility === "example");
      const checkCases = question.cases.filter((practiceCase) => practiceCase.visibility === "check");
      if (exampleCases.length === 0) {
        errors.push(issue(
          [...questionPath, "cases"],
          "missing-example-case",
          "Each question must include at least one example case.",
        ));
      }
      if (checkCases.length === 0) {
        errors.push(issue(
          [...questionPath, "cases"],
          "missing-check-case",
          "Each question must include at least one check case.",
        ));
      }
      for (const duplicate of duplicateValues(question.cases.map((practiceCase) => practiceCase.id))) {
        errors.push(issue(
          [...questionPath, "cases"],
          "duplicate-case-id",
          `The case id "${duplicate}" is repeated.`,
        ));
      }

      question.cases.forEach((practiceCase, caseIndex) => {
        const casePath = [...questionPath, "cases", caseIndex];
        if (question.entrypoint.kind === "function" && practiceCase.constructorArgs !== undefined) {
          errors.push(issue(
            [...casePath, "constructorArgs"],
            "unexpected-constructor-args",
            "Function entrypoints may not declare constructor arguments.",
          ));
        }
        for (const duplicate of duplicateValues(
          practiceCase.assertions.map((assertion) => assertion.id),
        )) {
          errors.push(issue(
            [...casePath, "assertions"],
            "duplicate-assertion-id",
            `The assertion id "${duplicate}" is repeated.`,
          ));
        }
        practiceCase.assertions.forEach((assertion, assertionIndex) => {
          const regex = assertion.kind === "matches"
            ? { field: "pattern", pattern: assertion.pattern, flags: assertion.flags }
            : assertion.kind === "throws" && assertion.messagePattern !== undefined
              ? { field: "messagePattern", pattern: assertion.messagePattern, flags: undefined }
              : null;
          if (!regex) return;
          try {
            new RegExp(regex.pattern, regex.flags);
          } catch {
            errors.push(issue(
              [...casePath, "assertions", assertionIndex, regex.field],
              "invalid-regex",
              "Assertion patterns must be valid ECMAScript regular expressions.",
            ));
          }
        });
        const throwsAssertions = practiceCase.assertions.filter(
          (assertion) => assertion.kind === "throws",
        );
        if (throwsAssertions.length > 0 && practiceCase.assertions.length > 1) {
          errors.push(issue(
            [...casePath, "assertions"],
            "mixed-throws-assertion",
            "A throws assertion must be the only assertion in its case.",
          ));
        }
      });
    });
  });

  for (const duplicate of duplicateValues(questionIds)) {
    errors.push(issue(
      ["groups"],
      "duplicate-question-id",
      `The question id "${duplicate}" is used more than once.`,
    ));
  }
  return { errors, warnings: [] as QuestionGroupLibraryIssue[] };
}

export function validateQuestionGroupLibrary(input: unknown): QuestionGroupLibraryValidation {
  const parsed = questionGroupLibrarySchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((entry) => issue(entry.path, entry.code, entry.message)),
      warnings: [],
      summary: null,
    };
  }
  const { errors, warnings } = semanticValidation(parsed.data);
  if (errors.length) return { valid: false, errors, warnings, summary: null };

  const questions = parsed.data.groups.flatMap((group) => group.questions);
  const cases = questions.flatMap((question) => question.cases);
  return {
    valid: true,
    library: parsed.data,
    errors: [],
    warnings,
    summary: {
      groups: parsed.data.groups.length,
      questions: questions.length,
      cases: cases.length,
      exampleCases: cases.filter((practiceCase) => practiceCase.visibility === "example").length,
      checkCases: cases.filter((practiceCase) => practiceCase.visibility === "check").length,
    },
  };
}

export function parseQuestionGroupLibraryJson(source: string): QuestionGroupLibraryValidation {
  if (new TextEncoder().encode(source).byteLength > MAX_QUESTION_GROUP_LIBRARY_BYTES) {
    return {
      valid: false,
      errors: [issue([], "file-too-large", "Question-group libraries may not exceed 2 MB.")],
      warnings: [],
      summary: null,
    };
  }
  try {
    return validateQuestionGroupLibrary(JSON.parse(source) as unknown);
  } catch (error) {
    return {
      valid: false,
      errors: [issue(
        [],
        "invalid-json",
        error instanceof Error ? error.message : "The file is not valid JSON.",
      )],
      warnings: [],
      summary: null,
    };
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}

export function canonicalQuestionGroupLibraryJson(library: QuestionGroupLibrary) {
  return `${JSON.stringify(sortJson(library), null, 2)}\n`;
}

const jsonValueJsonSchema = {
  anyOf: [
    { type: "null" },
    { type: "boolean" },
    { type: "number" },
    { type: "string", maxLength: MAX_JSON_STRING_LENGTH },
    {
      type: "array",
      maxItems: MAX_JSON_ENTRIES,
      items: { $ref: "#/definitions/JsonValue" },
    },
    {
      type: "object",
      maxProperties: MAX_JSON_ENTRIES,
      propertyNames: { maxLength: 200 },
      additionalProperties: { $ref: "#/definitions/JsonValue" },
    },
  ],
};

const generatedQuestionGroupLibraryJsonSchema = z.toJSONSchema(questionGroupLibrarySchema, {
  target: "draft-07",
  unrepresentable: "any",
  override(context) {
    if ((context.zodSchema as unknown) === boundedJsonValueSchema) {
      Object.assign(context.jsonSchema, { $ref: "#/definitions/JsonValue" });
    }
  },
});

export const questionGroupLibraryJsonSchema = {
  ...generatedQuestionGroupLibraryJsonSchema,
  definitions: {
    JsonValue: jsonValueJsonSchema,
  },
  $id: "https://model-systems-labs.github.io/latent/question-groups/v1/question-group-library.schema.json",
  title: "Latent Question Group Library v1",
  description: "Portable, declarative programming-practice question groups with bounded cases and assertions for JavaScript, TypeScript, and Python.",
};
