import { BrowserLabError } from "./errors";
import type { ProjectSnapshot, SourceHash, VirtualSourceFile } from "./types";

const SAFE_PATH_SEGMENT = /^[^\0-\x1f\\]+$/;

export function assertVirtualPath(path: string): void {
  if (!path || path.startsWith("/") || path.endsWith("/") || !SAFE_PATH_SEGMENT.test(path)) {
    throw new BrowserLabError("INVALID_PATH", `Invalid virtual file path: ${JSON.stringify(path)}.`);
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new BrowserLabError("INVALID_PATH", `Virtual file paths may not contain empty, dot, or parent segments: ${path}.`);
  }
}

export function canonicalizeSourceFiles(files: readonly VirtualSourceFile[]): readonly VirtualSourceFile[] {
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const seen = new Set<string>();
  for (const file of sorted) {
    assertVirtualPath(file.path);
    if (seen.has(file.path)) throw new BrowserLabError("DUPLICATE_PATH", `Duplicate virtual file path: ${file.path}.`);
    seen.add(file.path);
  }
  return sorted;
}

export function canonicalSourcePayload(files: readonly VirtualSourceFile[]): string {
  return JSON.stringify(canonicalizeSourceFiles(files).map(({ path, loader, contents }) => [path, loader, contents]));
}

export async function hashText(value: string): Promise<SourceHash> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new BrowserLabError("CRYPTO_UNAVAILABLE", "SHA-256 is unavailable; Browser Lab refuses to create an unverifiable result.");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

export function isSourceHash(value: unknown): value is SourceHash {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

export function hashProjectSource(files: readonly VirtualSourceFile[]): Promise<SourceHash> {
  return hashText(canonicalSourcePayload(files));
}

export async function hashSnapshot(snapshot: ProjectSnapshot): Promise<SourceHash> {
  if (!snapshot.projectId.trim()) throw new BrowserLabError("INVALID_PROJECT", "A project id is required.");
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new BrowserLabError("INVALID_REVISION", "Project revision must be a non-negative safe integer.");
  return hashProjectSource(snapshot.files);
}
