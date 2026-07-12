import { stableFingerprint } from "./pure";

export async function hashText(source: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return stableFingerprint(source);
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function hashSourceTree(files: Array<{ path: string; content: string }>) {
  const canonical = [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path.length}:${file.path}${file.content.length}:${file.content}`)
    .join("");
  return hashText(canonical);
}

export function createPersistenceId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${id}`;
}
