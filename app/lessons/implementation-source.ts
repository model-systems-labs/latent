import type { CourseLesson } from "@latent/course-kit";
import { latentTensorImport } from "@latent/tensor";

export function lessonImplementationPrelude(lesson: Pick<CourseLesson, "implementation">) {
  if (lesson.implementation.filename.endsWith(".py")) return "";
  return latentTensorImport(lesson.implementation.tensorOps ?? []);
}

export function lessonImplementationSource(lesson: Pick<CourseLesson, "implementation">, blockSources: string[]) {
  const prelude = lessonImplementationPrelude(lesson);
  return [prelude, ...blockSources, lesson.implementation.postlude].filter(Boolean).join("\n\n");
}

export function lessonBlockComment(lesson: Pick<CourseLesson, "implementation">, index: number, label: string) {
  const marker = lesson.implementation.filename.endsWith(".py") ? "#" : "//";
  return `${marker} ${String(index + 1).padStart(2, "0")} · ${label}`;
}

type LessonImplementation = Pick<CourseLesson, "implementation">;

type MarkerLine = {
  start: number;
  sourceStart: number;
};

function exactMarkerLines(source: string, marker: string): MarkerLine[] {
  const matches: MarkerLine[] = [];
  let lineStart = 0;

  while (lineStart <= source.length) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    const contentEnd = source.charCodeAt(lineEnd - 1) === 13 ? lineEnd - 1 : lineEnd;

    if (source.slice(lineStart, contentEnd) === marker) {
      matches.push({
        start: lineStart,
        sourceStart: newline === -1 ? source.length : newline + 1,
      });
    }

    if (newline === -1) break;
    lineStart = newline + 1;
  }

  return matches;
}

/**
 * Removes only the two line breaks inserted by lessonImplementationSource
 * between canonical file sections. Any learner-owned trailing newlines before
 * those separators remain part of the extracted exercise source.
 */
function canonicalSeparatorStart(source: string, boundary: number): number | null {
  let cursor = boundary;
  for (let index = 0; index < 2; index += 1) {
    if (cursor === 0 || source.charCodeAt(cursor - 1) !== 10) return null;
    cursor -= 1;
    if (cursor > 0 && source.charCodeAt(cursor - 1) === 13) cursor -= 1;
  }
  return cursor;
}

/**
 * Extracts learner-owned exercise bodies from a materialized lesson file.
 *
 * Markers are matched as complete lines so marker-like text inside an
 * expression cannot divide a cell. Every authored marker must appear exactly
 * once and in curriculum order. A supplied postlude is a fixed suffix and is
 * never returned as learner code.
 */
export function lessonImplementationBlockSources(
  lesson: LessonImplementation,
  source: string,
): Record<string, string> | null {
  const blocks = lesson.implementation.codeBlocks;
  const markerLines = blocks.map((block, index) => {
    const matches = exactMarkerLines(source, lessonBlockComment(lesson, index, block.label));
    return matches.length === 1 ? matches[0] : null;
  });

  if (markerLines.some((line) => line === null)) return null;

  const orderedLines = markerLines as MarkerLine[];
  if (orderedLines.length > 0) {
    const prelude = lessonImplementationPrelude(lesson);
    const expectedFirstMarkerStart = prelude ? prelude.length + 2 : 0;
    if (
      orderedLines[0].start !== expectedFirstMarkerStart
      || (prelude && source.slice(0, expectedFirstMarkerStart) !== `${prelude}\n\n`)
    ) return null;
  }
  for (let index = 1; index < orderedLines.length; index += 1) {
    if (orderedLines[index - 1].start >= orderedLines[index].start) return null;
  }

  let finalBoundary = source.length;
  const postlude = lesson.implementation.postlude;
  if (postlude) {
    const postludeStart = source.length - postlude.length;
    if (postludeStart < 0 || source.slice(postludeStart) !== postlude) return null;
    const separatorStart = canonicalSeparatorStart(source, postludeStart);
    if (separatorStart === null) return null;
    finalBoundary = separatorStart;
  }

  const extracted: Record<string, string> = {};
  for (let index = 0; index < blocks.length; index += 1) {
    const line = orderedLines[index];
    const nextBoundary = index + 1 < blocks.length
      ? canonicalSeparatorStart(source, orderedLines[index + 1].start)
      : finalBoundary;

    if (nextBoundary === null || nextBoundary < line.sourceStart) return null;
    extracted[blocks[index].id] = source.slice(line.sourceStart, nextBoundary);
  }

  return extracted;
}
