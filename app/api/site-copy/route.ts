import { NextResponse } from "next/server";
import {
  isSiteCopyKey,
  normalizeSiteCopyValue,
  type SiteCopyKey,
} from "../../content/site-copy";
import { readSiteCopy, saveSiteCopy } from "../../../db/site-copy";

export const revalidate = 0;

type SiteCopyPayload = {
  edits?: Record<string, unknown>;
};

async function database() {
  const { env } = await import("cloudflare:workers");
  const binding = (env as { DB?: D1Database }).DB;
  if (!binding) throw new Error("Site text storage is not configured.");
  return binding;
}

function parseEdits(payload: SiteCopyPayload) {
  if (!payload.edits || typeof payload.edits !== "object" || Array.isArray(payload.edits)) {
    throw new Error("Send edits as an object.");
  }

  const edits: Partial<Record<SiteCopyKey, string>> = {};
  for (const [key, value] of Object.entries(payload.edits)) {
    if (!isSiteCopyKey(key)) throw new Error(`"${key}" is not an editable text field.`);
    if (typeof value !== "string") throw new Error(`"${key}" must be text.`);
    edits[key] = normalizeSiteCopyValue(key, value);
  }

  return edits;
}

function errorResponse(error: unknown, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected site text error." },
    { status },
  );
}

export async function GET() {
  try {
    return NextResponse.json({ copy: await readSiteCopy(await database()) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as SiteCopyPayload;
    const edits = parseEdits(payload);
    return NextResponse.json({ copy: await saveSiteCopy(await database(), edits) });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
