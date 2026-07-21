import { NextResponse } from "next/server";
import {
  lessonCopyFields,
  normalizeLessonCopyValue,
} from "../../content/lesson-copy";
import { getLesson } from "../../lessons/course";
import { lessonLearningOutcome } from "../../lessons/learning";
import { readLessonCopy, saveLessonCopy } from "../../../db/lesson-copy";

export const revalidate = 0;

type LessonCopyPayload = {
  lessonId?: unknown;
  edits?: unknown;
};

async function database() {
  const { env } = await import("cloudflare:workers");
  const binding = (env as { DB?: D1Database }).DB;
  if (!binding) throw new Error("Lesson text storage is not configured.");
  return binding;
}

function editableDocument(lessonId: string) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error("That lesson does not exist.");
  return { lesson, outcome: lessonLearningOutcome(lessonId) };
}

function validStoredCopy(lessonId: string, stored: Record<string, string>) {
  const allowedPaths = new Set(lessonCopyFields(editableDocument(lessonId)).map(({ path }) => path));
  return Object.fromEntries(
    Object.entries(stored).filter(([path, value]) => allowedPaths.has(path) && typeof value === "string"),
  );
}

function parseEdits(lessonId: string, editsValue: unknown) {
  if (!editsValue || typeof editsValue !== "object" || Array.isArray(editsValue)) {
    throw new Error("Send edits as an object.");
  }

  const fieldByPath = new Map(
    lessonCopyFields(editableDocument(lessonId)).map((field) => [field.path, field]),
  );
  const edits: Record<string, string> = {};

  for (const [path, value] of Object.entries(editsValue)) {
    const field = fieldByPath.get(path);
    if (!field) throw new Error(`"${path}" is not an editable field in this lesson.`);
    if (typeof value !== "string") throw new Error(`"${path}" must be text.`);
    edits[path] = normalizeLessonCopyValue(field, value);
  }

  return edits;
}

function lessonIdFromUrl(request: Request) {
  const lessonId = new URL(request.url).searchParams.get("lessonId")?.trim();
  if (!lessonId) throw new Error("Choose a lesson.");
  editableDocument(lessonId);
  return lessonId;
}

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected lesson text error." },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const lessonId = lessonIdFromUrl(request);
    const copy = await readLessonCopy(await database(), lessonId);
    return NextResponse.json({ copy: validStoredCopy(lessonId, copy) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as LessonCopyPayload;
    if (typeof payload.lessonId !== "string" || !payload.lessonId.trim()) {
      throw new Error("Choose a lesson.");
    }
    const lessonId = payload.lessonId.trim();
    const edits = parseEdits(lessonId, payload.edits);
    const copy = await saveLessonCopy(await database(), lessonId, edits);
    return NextResponse.json({ copy: validStoredCopy(lessonId, copy) });
  } catch (error) {
    return errorResponse(error);
  }
}
