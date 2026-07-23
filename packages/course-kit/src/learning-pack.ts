import { z } from "zod";

export const LEARNING_PACK_FORMAT = "latent-learning-pack" as const;
export const LEARNING_PACK_SCHEMA_VERSION = 1 as const;
export const LEARNING_FEED_FORMAT = "latent-learning-feed" as const;
export const LEARNING_FEED_SCHEMA_VERSION = 1 as const;
export const MAX_LEARNING_PACK_BYTES = 2_000_000;

const packageIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,63}$/;
const contentIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const extensionKeyPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)+\/[a-z0-9][a-z0-9._-]*$/;
const safeRelativeUrlPattern = /^(?:\.\/)?(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*%2e)(?!.*%5c)[A-Za-z0-9._~!$&'()*+,;=:@/-]+(?:#[A-Za-z0-9._~!$&'()*+,;=:@/?-]*)?$/i;
const safeRelativeUrlSchema = z.string().min(1).max(2_000)
  .regex(safeRelativeUrlPattern, "Use a safe same-origin relative URL.")
  .refine(
    (value) => !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("//"),
    "Absolute and protocol-relative URLs are not allowed.",
  );

const packageIdSchema = z.string()
  .min(3)
  .max(129)
  .regex(packageIdPattern, "Use a namespaced id such as publisher/topic.")
  .refine(
    (value) => value.split("/", 1)[0]!.length <= 64,
    "The publisher namespace may not exceed 64 characters.",
  );

const contentIdSchema = z.string()
  .min(1)
  .max(80)
  .regex(contentIdPattern, "Use lowercase letters, numbers, dots, underscores, or hyphens.");

const proseSchema = z.string().trim().min(1).max(4_000);
const shortProseSchema = z.string().trim().min(1).max(500);
const safeSourceUrlSchema = z.string().url().max(2_000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Published URLs must use HTTPS without embedded credentials.");

const MAX_EXTENSION_DEPTH = 8;
const MAX_EXTENSION_NODES = 2_000;
const MAX_EXTENSION_ENTRIES = 200;
const MAX_EXTENSION_STRING_LENGTH = 20_000;

function extensionValueProblem(input: unknown) {
  const stack: Array<{ depth: number; value: unknown }> = [{ depth: 0, value: input }];
  const seen = new Set<object>();
  let nodes = 0;

  while (stack.length) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_EXTENSION_NODES) {
      return `Extension values may not contain more than ${MAX_EXTENSION_NODES} JSON nodes.`;
    }
    if (current.depth > MAX_EXTENSION_DEPTH) {
      return `Extension values may not be nested more than ${MAX_EXTENSION_DEPTH} levels.`;
    }
    if (
      current.value === null
      || typeof current.value === "boolean"
      || (typeof current.value === "number" && Number.isFinite(current.value))
    ) continue;
    if (typeof current.value === "string") {
      if (current.value.length > MAX_EXTENSION_STRING_LENGTH) {
        return `Extension strings may not exceed ${MAX_EXTENSION_STRING_LENGTH} characters.`;
      }
      continue;
    }
    if (!current.value || typeof current.value !== "object") {
      return "Extension values must contain JSON data only.";
    }
    if (seen.has(current.value)) return "Extension values may not contain cycles or shared object references.";
    seen.add(current.value);
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_EXTENSION_ENTRIES) {
        return `Extension arrays may not contain more than ${MAX_EXTENSION_ENTRIES} entries.`;
      }
      current.value.forEach((value) => stack.push({ depth: current.depth + 1, value }));
      continue;
    }
    const prototype = Object.getPrototypeOf(current.value);
    if (prototype !== Object.prototype && prototype !== null) {
      return "Extension values must use plain JSON objects.";
    }
    const entries = Object.entries(current.value);
    if (entries.length > MAX_EXTENSION_ENTRIES) {
      return `Extension objects may not contain more than ${MAX_EXTENSION_ENTRIES} fields.`;
    }
    for (const [key, value] of entries) {
      if (key.length > 200) return "Extension object keys may not exceed 200 characters.";
      stack.push({ depth: current.depth + 1, value });
    }
  }
  return null;
}

const extensionsSchema = z.record(z.string(), z.unknown()).superRefine((extensions, context) => {
  if (Object.keys(extensions).length > 100) {
    context.addIssue({
      code: "custom",
      message: "An extensions object may not contain more than 100 namespaced entries.",
    });
  }
  for (const key of Object.keys(extensions)) {
    if (!extensionKeyPattern.test(key)) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: "Extension keys must be namespaced, for example org.example/reading-level.",
      });
    }
    const problem = extensionValueProblem(extensions[key]);
    if (problem) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: problem,
      });
    }
  }
});

const authorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: safeSourceUrlSchema.optional(),
}).strict();

const objectiveSchema = z.object({
  id: contentIdSchema,
  description: z.string().trim().min(20).max(500),
}).strict();

const sourceSchema = z.object({
  id: contentIdSchema,
  kind: z.enum(["primary", "research", "specification", "implementation", "guide", "reference"]),
  title: z.string().trim().min(3).max(300),
  url: safeSourceUrlSchema,
  authors: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  publishedYear: z.number().int().min(1000).max(3000).optional(),
  license: z.string().trim().min(2).max(120).optional(),
  note: z.string().trim().min(10).max(500),
}).strict();

const paragraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: proseSchema,
}).strict();

const headingBlockSchema = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().trim().min(2).max(160),
}).strict();

const listBlockSchema = z.object({
  type: z.literal("list"),
  style: z.enum(["ordered", "unordered"]),
  items: z.array(shortProseSchema).min(2).max(20),
}).strict();

const calloutBlockSchema = z.object({
  type: z.literal("callout"),
  tone: z.enum(["note", "tip", "warning"]),
  title: z.string().trim().min(2).max(120),
  text: proseSchema,
}).strict();

const codeBlockSchema = z.object({
  type: z.literal("code"),
  language: z.string().trim().min(1).max(40),
  code: z.string().min(1).max(30_000),
  caption: z.string().trim().min(3).max(300).optional(),
}).strict();

const quizChoiceSchema = z.object({
  id: contentIdSchema,
  text: z.string().trim().min(1).max(500),
}).strict();

const quizBlockSchema = z.object({
  type: z.literal("quiz"),
  id: contentIdSchema,
  prompt: z.string().trim().min(10).max(1_000),
  choices: z.array(quizChoiceSchema).min(2).max(8),
  correctChoiceId: contentIdSchema,
  explanation: z.string().trim().min(20).max(2_000),
  objectiveIds: z.array(contentIdSchema).min(1).max(20),
  sourceIds: z.array(contentIdSchema).min(1).max(20),
}).strict();

export const learningBlockSchema = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  calloutBlockSchema,
  codeBlockSchema,
  quizBlockSchema,
]);

const lessonSchema = z.object({
  id: contentIdSchema,
  order: z.number().int().positive().max(1_000),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(20).max(500),
  durationMinutes: z.number().int().min(1).max(240),
  objectiveIds: z.array(contentIdSchema).min(1).max(20),
  sourceIds: z.array(contentIdSchema).min(1).max(30),
  prerequisiteLessonIds: z.array(contentIdSchema).max(20).optional(),
  blocks: z.array(learningBlockSchema).min(1).max(100),
  extensions: extensionsSchema.optional(),
}).strict();

const flashcardSchema = z.object({
  id: contentIdSchema,
  front: z.string().trim().min(3).max(1_000),
  back: z.string().trim().min(3).max(2_000),
  explanation: z.string().trim().min(20).max(2_000),
  objectiveIds: z.array(contentIdSchema).min(1).max(20),
  sourceIds: z.array(contentIdSchema).min(1).max(20),
  tags: z.array(contentIdSchema).max(20).optional(),
  extensions: extensionsSchema.optional(),
}).strict();

const flashcardDeckSchema = z.object({
  id: contentIdSchema,
  order: z.number().int().positive().max(1_000),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(500),
  objectiveIds: z.array(contentIdSchema).min(1).max(30),
  sourceIds: z.array(contentIdSchema).min(1).max(30),
  cards: z.array(flashcardSchema).min(2).max(500),
  extensions: extensionsSchema.optional(),
}).strict();

export const learningPackSchema = z.object({
  format: z.literal(LEARNING_PACK_FORMAT),
  schemaVersion: z.literal(LEARNING_PACK_SCHEMA_VERSION),
  package: z.object({
    id: packageIdSchema,
    version: z.string().regex(semverPattern, "Use a semantic version such as 1.0.0."),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(30).max(500),
    language: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Use a BCP 47 language tag such as en or en-US."),
    license: z.string().trim().min(2).max(120),
    authors: z.array(authorSchema).min(1).max(20),
    homepage: safeSourceUrlSchema.optional(),
    publishedAt: z.string().datetime({ offset: true }),
  }).strict(),
  objectives: z.array(objectiveSchema).min(1).max(100),
  sources: z.array(sourceSchema).min(1).max(200),
  lessons: z.array(lessonSchema).max(100).default([]),
  flashcardDecks: z.array(flashcardDeckSchema).max(100).default([]),
  extensions: extensionsSchema.optional(),
}).strict().superRefine((pack, context) => {
  if (pack.lessons.length === 0 && pack.flashcardDecks.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["lessons"],
      message: "A learning pack must contain at least one lesson or one flash-card deck.",
    });
  }
});

export type LearningPack = z.infer<typeof learningPackSchema>;
export type LearningBlock = z.infer<typeof learningBlockSchema>;

const feedPackageSchema = z.object({
  packageId: packageIdSchema,
  version: z.string().regex(semverPattern),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(30).max(500),
  packageUrl: safeRelativeUrlSchema,
  siteUrl: safeRelativeUrlSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "Use a lowercase SHA-256 digest."),
  bytes: z.number().int().positive().max(2_000_000),
  publishedAt: z.string().datetime({ offset: true }),
}).strict();

export const learningFeedSchema = z.object({
  format: z.literal(LEARNING_FEED_FORMAT),
  schemaVersion: z.literal(LEARNING_FEED_SCHEMA_VERSION),
  publisher: z.object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/),
    name: z.string().trim().min(1).max(160),
    url: safeSourceUrlSchema.optional(),
  }).strict(),
  packages: z.array(feedPackageSchema).min(1).max(1_000),
  extensions: extensionsSchema.optional(),
}).strict().superRefine((feed, context) => {
  const identities = new Set<string>();
  feed.packages.forEach((entry, index) => {
    if (!entry.packageId.startsWith(`${feed.publisher.id}/`)) {
      context.addIssue({
        code: "custom",
        path: ["packages", index, "packageId"],
        message: "Package ids must use the feed publisher id as their namespace.",
      });
    }
    const identity = `${entry.packageId}@${entry.version}`;
    if (identities.has(identity)) {
      context.addIssue({
        code: "custom",
        path: ["packages", index],
        message: `The immutable package identity "${identity}" is repeated.`,
      });
    }
    identities.add(identity);
  });
});

export type LearningFeed = z.infer<typeof learningFeedSchema>;

export const learningFeedJsonSchema = {
  ...z.toJSONSchema(learningFeedSchema, {
    target: "draft-07",
    unrepresentable: "any",
  }),
  $id: "https://latent-llm-learning.cswansondeveloper.chatgpt.site/open-learning/learning-feed.schema.json",
  title: "Latent Learning Feed v1",
  description: "A publisher-controlled list of immutable Latent learning-pack versions with same-origin paths and SHA-256 integrity.",
};

export type LearningPackIssue = {
  path: string;
  code: string;
  message: string;
};

export type LearningPackSummary = {
  lessons: number;
  quizzes: number;
  flashcardDecks: number;
  flashcards: number;
  objectives: number;
  sources: number;
};

export type LearningPackValidation =
  | {
      valid: true;
      pack: LearningPack;
      errors: [];
      warnings: LearningPackIssue[];
      summary: LearningPackSummary;
    }
  | {
      valid: false;
      errors: LearningPackIssue[];
      warnings: LearningPackIssue[];
      summary: null;
    };

function issue(path: Array<string | number | symbol>, code: string, message: string): LearningPackIssue {
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

function inspectAuthoredText(value: unknown, path: Array<string | number>, errors: LearningPackIssue[]) {
  if (typeof value === "string") {
    if (/(?:\bTODO\b|\bTBD\b|\[insert\b|\blorem ipsum\b|\byour[- ]name\b)/i.test(value)) {
      errors.push(issue(path, "unfinished-content", "Replace placeholder text before publishing."));
    }
    if (/<\s*script\b|javascript\s*:/i.test(value)) {
      errors.push(issue(path, "unsafe-content", "Executable HTML and javascript: URLs are not allowed."));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectAuthoredText(entry, [...path, index], errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "extensions") continue;
      inspectAuthoredText(entry, [...path, key], errors);
    }
  }
}

function semanticValidation(pack: LearningPack) {
  const errors: LearningPackIssue[] = [];
  const warnings: LearningPackIssue[] = [];
  const objectiveIds = new Set(pack.objectives.map((objective) => objective.id));
  const sourceIds = new Set(pack.sources.map((source) => source.id));
  const lessonIds = new Set(pack.lessons.map((lesson) => lesson.id));
  const usedObjectives = new Set<string>();
  const assessedObjectives = new Set<string>();
  const usedSources = new Set<string>();

  const uniqueCollections: Array<[string, readonly string[]]> = [
    ["objectives", pack.objectives.map((entry) => entry.id)],
    ["sources", pack.sources.map((entry) => entry.id)],
    ["lessons", pack.lessons.map((entry) => entry.id)],
    ["flashcardDecks", pack.flashcardDecks.map((entry) => entry.id)],
  ];
  for (const [path, values] of uniqueCollections) {
    for (const duplicate of duplicateValues(values)) {
      errors.push(issue([path], "duplicate-id", `The id "${duplicate}" is used more than once.`));
    }
  }
  for (const duplicate of duplicateValues(pack.lessons.map((lesson) => String(lesson.order)))) {
    errors.push(issue(["lessons"], "duplicate-order", `Lesson order ${duplicate} is used more than once.`));
  }
  for (const duplicate of duplicateValues(pack.flashcardDecks.map((deck) => String(deck.order)))) {
    errors.push(issue(["flashcardDecks"], "duplicate-order", `Deck order ${duplicate} is used more than once.`));
  }

  const checkReferences = (
    ids: readonly string[],
    validIds: Set<string>,
    basePath: Array<string | number>,
    kind: "objective" | "source" | "lesson",
    used?: Set<string>,
  ) => {
    for (const [index, id] of ids.entries()) {
      if (!validIds.has(id)) {
        errors.push(issue([...basePath, index], `unknown-${kind}`, `Unknown ${kind} id "${id}".`));
      } else {
        used?.add(id);
      }
    }
    for (const duplicate of duplicateValues(ids)) {
      errors.push(issue(basePath, `duplicate-${kind}`, `The ${kind} id "${duplicate}" is repeated.`));
    }
  };

  const lessonById = new Map(pack.lessons.map((lesson) => [lesson.id, lesson]));
  pack.lessons.forEach((lesson, lessonIndex) => {
    checkReferences(lesson.objectiveIds, objectiveIds, ["lessons", lessonIndex, "objectiveIds"], "objective", usedObjectives);
    checkReferences(lesson.sourceIds, sourceIds, ["lessons", lessonIndex, "sourceIds"], "source", usedSources);
    checkReferences(
      lesson.prerequisiteLessonIds ?? [],
      lessonIds,
      ["lessons", lessonIndex, "prerequisiteLessonIds"],
      "lesson",
    );
    if (lesson.prerequisiteLessonIds?.includes(lesson.id)) {
      errors.push(issue(["lessons", lessonIndex, "prerequisiteLessonIds"], "self-prerequisite", "A lesson cannot require itself."));
    }
    for (const [prerequisiteIndex, prerequisiteId] of (lesson.prerequisiteLessonIds ?? []).entries()) {
      const prerequisite = lessonById.get(prerequisiteId);
      if (
        prerequisite
        && prerequisite.id !== lesson.id
        && prerequisite.order >= lesson.order
      ) {
        errors.push(issue(
          ["lessons", lessonIndex, "prerequisiteLessonIds", prerequisiteIndex],
          "out-of-order-prerequisite",
          `Prerequisite "${prerequisiteId}" must have a lower lesson order than "${lesson.id}".`,
        ));
      }
    }
    if (lesson.blocks.length < 3) {
      warnings.push(issue(["lessons", lessonIndex, "blocks"], "thin-lesson", "Consider at least three teaching blocks."));
    }
    const quizIds = lesson.blocks.filter((block) => block.type === "quiz").map((block) => block.id);
    for (const duplicate of duplicateValues(quizIds)) {
      errors.push(issue(["lessons", lessonIndex, "blocks"], "duplicate-quiz-id", `The quiz id "${duplicate}" is repeated.`));
    }
    lesson.blocks.forEach((block, blockIndex) => {
      if (block.type !== "quiz") return;
      const choiceIds = block.choices.map((choice) => choice.id);
      for (const duplicate of duplicateValues(choiceIds)) {
        errors.push(issue(
          ["lessons", lessonIndex, "blocks", blockIndex, "choices"],
          "duplicate-choice-id",
          `The choice id "${duplicate}" is repeated.`,
        ));
      }
      if (!choiceIds.includes(block.correctChoiceId)) {
        errors.push(issue(
          ["lessons", lessonIndex, "blocks", blockIndex, "correctChoiceId"],
          "unknown-correct-choice",
          `Correct choice "${block.correctChoiceId}" is not present.`,
        ));
      }
      checkReferences(
        block.objectiveIds,
        objectiveIds,
        ["lessons", lessonIndex, "blocks", blockIndex, "objectiveIds"],
        "objective",
        assessedObjectives,
      );
      checkReferences(
        block.sourceIds,
        sourceIds,
        ["lessons", lessonIndex, "blocks", blockIndex, "sourceIds"],
        "source",
        usedSources,
      );
    });
  });

  const lessonState = new Map<string, "visiting" | "visited">();
  const prerequisiteStack: string[] = [];
  const visitPrerequisites = (lessonId: string) => {
    lessonState.set(lessonId, "visiting");
    prerequisiteStack.push(lessonId);
    for (const prerequisiteId of lessonById.get(lessonId)?.prerequisiteLessonIds ?? []) {
      if (!lessonById.has(prerequisiteId)) continue;
      if (lessonState.get(prerequisiteId) === "visiting") {
        const cycleStart = prerequisiteStack.indexOf(prerequisiteId);
        const cycle = [...prerequisiteStack.slice(cycleStart), prerequisiteId];
        errors.push(issue(
          ["lessons"],
          "cyclic-prerequisite",
          `Lesson prerequisites form a cycle: ${cycle.join(" -> ")}.`,
        ));
        continue;
      }
      if (!lessonState.has(prerequisiteId)) visitPrerequisites(prerequisiteId);
    }
    prerequisiteStack.pop();
    lessonState.set(lessonId, "visited");
  };
  for (const lesson of pack.lessons) {
    if (!lessonState.has(lesson.id)) visitPrerequisites(lesson.id);
  }

  const globalCardIds: string[] = [];
  pack.flashcardDecks.forEach((deck, deckIndex) => {
    checkReferences(deck.objectiveIds, objectiveIds, ["flashcardDecks", deckIndex, "objectiveIds"], "objective", usedObjectives);
    checkReferences(deck.sourceIds, sourceIds, ["flashcardDecks", deckIndex, "sourceIds"], "source", usedSources);
    if (deck.cards.length < 6) {
      warnings.push(issue(["flashcardDecks", deckIndex, "cards"], "thin-deck", "Six or more cards usually make a useful review session."));
    }
    deck.cards.forEach((card, cardIndex) => {
      globalCardIds.push(card.id);
      checkReferences(
        card.objectiveIds,
        objectiveIds,
        ["flashcardDecks", deckIndex, "cards", cardIndex, "objectiveIds"],
        "objective",
        assessedObjectives,
      );
      checkReferences(
        card.sourceIds,
        sourceIds,
        ["flashcardDecks", deckIndex, "cards", cardIndex, "sourceIds"],
        "source",
        usedSources,
      );
    });
  });
  for (const duplicate of duplicateValues(globalCardIds)) {
    errors.push(issue(["flashcardDecks"], "duplicate-card-id", `The card id "${duplicate}" is used more than once.`));
  }

  for (const objective of pack.objectives) {
    if (!usedObjectives.has(objective.id)) {
      errors.push(issue(["objectives"], "unused-objective", `Objective "${objective.id}" is not taught by a lesson or deck.`));
    }
    if (!assessedObjectives.has(objective.id)) {
      warnings.push(issue(["objectives"], "unassessed-objective", `Objective "${objective.id}" is not checked by a quiz or flash card.`));
    }
  }
  for (const source of pack.sources) {
    if (!usedSources.has(source.id)) {
      warnings.push(issue(["sources"], "unused-source", `Source "${source.id}" is not cited by learning content.`));
    }
  }
  if (!pack.sources.some((source) => ["primary", "research", "specification", "implementation"].includes(source.kind))) {
    warnings.push(issue(["sources"], "no-firsthand-source", "Add at least one primary, research, specification, or implementation source."));
  }
  inspectAuthoredText(pack, [], errors);
  return { errors, warnings };
}

export function validateLearningPack(input: unknown): LearningPackValidation {
  const parsed = learningPackSchema.safeParse(input);
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
  const summary: LearningPackSummary = {
    lessons: parsed.data.lessons.length,
    quizzes: parsed.data.lessons.reduce(
      (count, lesson) => count + lesson.blocks.filter((block) => block.type === "quiz").length,
      0,
    ),
    flashcardDecks: parsed.data.flashcardDecks.length,
    flashcards: parsed.data.flashcardDecks.reduce((count, deck) => count + deck.cards.length, 0),
    objectives: parsed.data.objectives.length,
    sources: parsed.data.sources.length,
  };
  return { valid: true, pack: parsed.data, errors: [], warnings, summary };
}

export function parseLearningPackJson(source: string): LearningPackValidation {
  if (new TextEncoder().encode(source).byteLength > MAX_LEARNING_PACK_BYTES) {
    return {
      valid: false,
      errors: [issue([], "file-too-large", "Learning packs may not exceed 2 MB.")],
      warnings: [],
      summary: null,
    };
  }
  try {
    return validateLearningPack(JSON.parse(source) as unknown);
  } catch (error) {
    return {
      valid: false,
      errors: [issue([], "invalid-json", error instanceof Error ? error.message : "The file is not valid JSON.")],
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

export function canonicalLearningPackJson(pack: LearningPack) {
  return `${JSON.stringify(sortJson(pack), null, 2)}\n`;
}

export function createLearningFeed(
  pack: LearningPack,
  sha256: string,
  options: { bytes: number; packageUrl?: string; siteUrl?: string },
): LearningFeed {
  const author = pack.package.authors[0];
  const publisherId = pack.package.id.split("/")[0]!;
  return learningFeedSchema.parse({
    format: LEARNING_FEED_FORMAT,
    schemaVersion: LEARNING_FEED_SCHEMA_VERSION,
    publisher: {
      id: publisherId,
      name: author.name,
      ...(author.url ? { url: author.url } : {}),
    },
    packages: [{
      packageId: pack.package.id,
      version: pack.package.version,
      title: pack.package.title,
      description: pack.package.description,
      packageUrl: options.packageUrl ?? "./learning-pack.json",
      siteUrl: options.siteUrl ?? "./",
      sha256,
      bytes: options.bytes,
      publishedAt: pack.package.publishedAt,
    }],
  });
}

export const learningPackJsonSchema = {
  ...z.toJSONSchema(learningPackSchema, {
    target: "draft-07",
    unrepresentable: "any",
  }),
  $id: "https://latent-llm-learning.cswansondeveloper.chatgpt.site/open-learning/learning-pack.schema.json",
  title: "Latent Learning Pack v1",
  description: "Portable, declarative lessons and flash cards that can be authored by people or arbitrary LLMs and hosted on any static site.",
};

export function createStarterLearningPack(): LearningPack {
  return learningPackSchema.parse({
    format: LEARNING_PACK_FORMAT,
    schemaVersion: LEARNING_PACK_SCHEMA_VERSION,
    package: {
      id: "todo-publisher/topic",
      version: "0.1.0",
      title: "A focused learning pack",
      description: "A short, source-grounded lesson and review deck that teaches one useful idea.",
      language: "en",
      license: "CC-BY-4.0",
      authors: [{ name: "TODO: publisher name" }],
      publishedAt: "2026-01-01T00:00:00Z",
    },
    objectives: [{
      id: "explain-core-idea",
      description: "Explain the core idea accurately and identify when it is useful.",
    }],
    sources: [{
      id: "primary-source",
      kind: "primary",
      title: "TODO: add a firsthand source",
      url: "https://example.com/source",
      note: "TODO: explain exactly how this source supports the learning material.",
    }],
    lessons: [{
      id: "core-idea",
      order: 1,
      title: "The core idea",
      summary: "Build an accurate mental model, then check it with one concrete question.",
      durationMinutes: 10,
      objectiveIds: ["explain-core-idea"],
      sourceIds: ["primary-source"],
      blocks: [
        { type: "paragraph", text: "TODO: write a clear explanation grounded in the cited source." },
        {
          type: "callout",
          tone: "tip",
          title: "Make it concrete",
          text: "TODO: add a small example that lets the learner predict an outcome before revealing the answer.",
        },
        {
          type: "quiz",
          id: "check-core-idea",
          prompt: "Which answer best demonstrates the core idea in the situation you taught?",
          choices: [
            { id: "correct", text: "TODO: write the correct application." },
            { id: "distractor", text: "TODO: write a plausible misconception." },
          ],
          correctChoiceId: "correct",
          explanation: "TODO: explain why the correct choice follows from the source and why the distractor does not.",
          objectiveIds: ["explain-core-idea"],
          sourceIds: ["primary-source"],
        },
      ],
    }],
    flashcardDecks: [{
      id: "core-review",
      order: 1,
      title: "Core idea review",
      description: "Recall the definition, boundary, and a practical application of the core idea.",
      objectiveIds: ["explain-core-idea"],
      sourceIds: ["primary-source"],
      cards: [
        {
          id: "core-definition",
          front: "What is the core idea?",
          back: "TODO: write a concise, accurate definition.",
          explanation: "TODO: connect the definition directly to the cited firsthand source.",
          objectiveIds: ["explain-core-idea"],
          sourceIds: ["primary-source"],
        },
        {
          id: "core-boundary",
          front: "When does the core idea not apply?",
          back: "TODO: write one important boundary or failure case.",
          explanation: "TODO: explain how this boundary prevents overgeneralization.",
          objectiveIds: ["explain-core-idea"],
          sourceIds: ["primary-source"],
        },
      ],
    }],
  });
}
