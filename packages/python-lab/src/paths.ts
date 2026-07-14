import { PythonLabError } from "./errors";

export const MAX_WORKSPACE_FILES = 128;
export const MAX_WORKSPACE_FILE_BYTES = 512 * 1024;
export const MAX_WORKSPACE_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_ARTIFACT_FILES = 32;
export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ARTIFACT_BYTES = 25 * 1024 * 1024;

const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_. -]{0,79}$/;

export function assertWorkspacePath(path: string): string {
  if (typeof path !== "string" || !path || path.length > 240 || path.includes("\0") || path.includes("\\") || path.startsWith("/")) {
    throw new PythonLabError("INVALID_PATH", `Python workspace paths must be relative POSIX paths: ${JSON.stringify(path)}.`);
  }
  const segments = path.split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || !SAFE_SEGMENT.test(segment))) {
    throw new PythonLabError("INVALID_PATH", `Unsafe Python workspace path: ${JSON.stringify(path)}.`);
  }
  return segments.join("/");
}

export function absoluteWorkspacePath(path: string): string {
  return `/workspace/${assertWorkspacePath(path)}`;
}

export function assertUniqueWorkspacePaths(paths: readonly string[], label: string): string[] {
  const canonical = paths.map(assertWorkspacePath);
  if (new Set(canonical).size !== canonical.length) {
    throw new PythonLabError("DUPLICATE_PATH", `${label} contains a duplicate workspace path.`);
  }
  return canonical;
}
