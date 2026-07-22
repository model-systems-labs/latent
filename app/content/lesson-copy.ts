import type { CourseLesson } from "@latent/course-kit";
import type { LessonLearningOutcome } from "./llm-systems/learning";

export type EditableLessonDocument = {
  lesson: CourseLesson;
  outcome: LessonLearningOutcome;
};

export type LessonCopyField = {
  path: string;
  label: string;
  group: string;
  value: string;
  maxLength: number;
  multiline: boolean;
};

export type LessonCopyValues = Record<string, string>;

function field(
  path: string,
  label: string,
  group: string,
  value: string,
  maxLength: number,
  multiline = false,
): LessonCopyField {
  return { path, label, group, value, maxLength, multiline };
}

export function lessonCopyFields({ lesson, outcome }: EditableLessonDocument) {
  const fields: LessonCopyField[] = [
    field("lesson.courseTitle", "Course name", "Lesson header", lesson.courseTitle ?? "", 180),
    field("lesson.eyebrow", "Eyebrow", "Lesson header", lesson.eyebrow, 180),
    field("lesson.title", "Title", "Lesson header", lesson.title, 240),
    field("lesson.thesis", "Thesis", "Lesson header", lesson.thesis, 1600, true),
  ];

  lesson.summary.forEach((paragraph, index) => {
    fields.push(
      field(`lesson.summary.${index}.label`, `Paragraph ${index + 1} lead`, "Reading", paragraph.label, 300),
      field(`lesson.summary.${index}.body`, `Paragraph ${index + 1} body`, "Reading", paragraph.body, 5000, true),
    );
  });

  fields.push(
    field("lesson.diagram.title", "Diagram title", "Diagram", lesson.diagram.title, 300),
    field("lesson.diagram.caption", "Diagram caption", "Diagram", lesson.diagram.caption, 1600, true),
  );
  lesson.diagram.nodes.forEach((node, index) => {
    fields.push(
      field(`lesson.diagram.nodes.${index}.label`, `Step ${index + 1} label`, "Diagram", node.label, 300),
      field(`lesson.diagram.nodes.${index}.value`, `Step ${index + 1} value`, "Diagram", node.value, 2000, true),
    );
  });

  lesson.sources.forEach((source, index) => {
    fields.push(
      field(`lesson.sources.${index}.title`, `Further reading ${index + 1} title`, "Further reading", source.title, 500, true),
      field(`lesson.sources.${index}.authors`, `Further reading ${index + 1} authors`, "Further reading", source.authors, 500, true),
      field(`lesson.sources.${index}.year`, `Further reading ${index + 1} year`, "Further reading", source.year, 80),
    );
  });

  fields.push(
    field("outcome.check.prompt", "Question", "Knowledge check", outcome.check.prompt, 1600, true),
  );
  outcome.check.choices.forEach((choice, index) => {
    fields.push(field(`outcome.check.choices.${index}.label`, `Answer ${index + 1}`, "Knowledge check", choice.label, 800, true));
  });
  fields.push(
    field("outcome.check.explanation", "Answer explanation", "Knowledge check", outcome.check.explanation, 2400, true),
    field("lesson.implementation.intro", "Practice introduction", "Practice", lesson.implementation.intro, 2400, true),
  );
  lesson.implementation.codeBlocks.forEach((block, index) => {
    fields.push(
      field(`lesson.implementation.codeBlocks.${index}.label`, `Exercise ${index + 1} title`, "Practice", block.label, 300),
      field(`lesson.implementation.codeBlocks.${index}.purpose`, `Exercise ${index + 1} purpose`, "Practice", block.purpose, 1600, true),
    );
  });

  fields.push(
    field("lesson.dataset.name", "Dataset name", "Interactive lab", lesson.dataset.name, 300),
    field("lesson.dataset.preview", "Dataset sample", "Interactive lab", lesson.dataset.preview, 1600, true),
    field("lesson.experiment.title", "Lab name", "Interactive lab", lesson.experiment.title, 300),
  );

  return fields;
}

export function lessonCopyDefaults(document: EditableLessonDocument) {
  return Object.fromEntries(
    lessonCopyFields(document).map(({ path, value }) => [path, value]),
  ) as LessonCopyValues;
}

function copyValue(values: LessonCopyValues, path: string, fallback: string) {
  return Object.prototype.hasOwnProperty.call(values, path) ? values[path] : fallback;
}

export function applyLessonCopy(
  document: EditableLessonDocument,
  values: LessonCopyValues,
): EditableLessonDocument {
  const { lesson, outcome } = document;
  const copiedLesson: CourseLesson = {
    ...lesson,
    courseTitle: copyValue(values, "lesson.courseTitle", lesson.courseTitle ?? ""),
    eyebrow: copyValue(values, "lesson.eyebrow", lesson.eyebrow),
    title: copyValue(values, "lesson.title", lesson.title),
    thesis: copyValue(values, "lesson.thesis", lesson.thesis),
    summary: lesson.summary.map((paragraph, index) => ({
      label: copyValue(values, `lesson.summary.${index}.label`, paragraph.label),
      body: copyValue(values, `lesson.summary.${index}.body`, paragraph.body),
    })),
    diagram: {
      ...lesson.diagram,
      title: copyValue(values, "lesson.diagram.title", lesson.diagram.title),
      caption: copyValue(values, "lesson.diagram.caption", lesson.diagram.caption),
      nodes: lesson.diagram.nodes.map((node, index) => ({
        label: copyValue(values, `lesson.diagram.nodes.${index}.label`, node.label),
        value: copyValue(values, `lesson.diagram.nodes.${index}.value`, node.value),
      })),
    },
    sources: lesson.sources.map((source, index) => ({
      ...source,
      title: copyValue(values, `lesson.sources.${index}.title`, source.title),
      authors: copyValue(values, `lesson.sources.${index}.authors`, source.authors),
      year: copyValue(values, `lesson.sources.${index}.year`, source.year),
    })),
    implementation: {
      ...lesson.implementation,
      intro: copyValue(values, "lesson.implementation.intro", lesson.implementation.intro),
      codeBlocks: lesson.implementation.codeBlocks.map((block, index) => ({
        ...block,
        label: copyValue(values, `lesson.implementation.codeBlocks.${index}.label`, block.label),
        purpose: copyValue(values, `lesson.implementation.codeBlocks.${index}.purpose`, block.purpose),
      })),
    },
    dataset: {
      ...lesson.dataset,
      name: copyValue(values, "lesson.dataset.name", lesson.dataset.name),
      preview: copyValue(values, "lesson.dataset.preview", lesson.dataset.preview),
    },
    experiment: {
      ...lesson.experiment,
      title: copyValue(values, "lesson.experiment.title", lesson.experiment.title),
    },
  };

  return {
    lesson: copiedLesson,
    outcome: {
      ...outcome,
      check: {
        ...outcome.check,
        prompt: copyValue(values, "outcome.check.prompt", outcome.check.prompt),
        choices: outcome.check.choices.map((choice, index) => ({
          ...choice,
          label: copyValue(values, `outcome.check.choices.${index}.label`, choice.label),
        })),
        explanation: copyValue(values, "outcome.check.explanation", outcome.check.explanation),
      },
    },
  };
}

export function normalizeLessonCopyValue(fieldDefinition: LessonCopyField, value: string) {
  const withoutNulls = value.replace(/\u0000/g, "");
  const normalizedLineBreaks = withoutNulls.replace(/\r\n?/g, "\n");
  const normalized = fieldDefinition.multiline
    ? normalizedLineBreaks
    : normalizedLineBreaks.replace(/\s*\n+\s*/g, " ");

  if (normalized.length > fieldDefinition.maxLength) {
    throw new Error(`${fieldDefinition.label} must be ${fieldDefinition.maxLength} characters or fewer.`);
  }

  return normalized;
}
