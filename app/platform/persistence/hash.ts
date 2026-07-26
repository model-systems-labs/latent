import { stableFingerprint } from "@/app/platform/persistence/pure";

export class PersistenceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceIntegrityError";
  }
}

export async function hashText(source: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return stableFingerprint(source);
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function hashTextForExpectedAlgorithm(source: string, expected: string) {
  if (expected.startsWith("fnv1a32:")) return stableFingerprint(source);
  if (!expected.startsWith("sha256:")) {
    throw new PersistenceIntegrityError("This saved bundle uses a content-hash algorithm the app doesn't support.");
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new PersistenceIntegrityError("SHA-256 isn't available, so the app can't verify this saved bundle.");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function hashBundleContents(bundles: Readonly<Record<string, string>>) {
  const entries = await Promise.all(
    Object.keys(bundles)
      .sort((left, right) => left.localeCompare(right))
      .map(async (path) => [path, await hashText(bundles[path])] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Older persisted builds do not have bundle hashes and remain readable. Once
 * hashes exist, however, they are a complete manifest: missing, extra, or
 * changed bundle bytes fail closed.
 */
export async function assertBundleIntegrity(
  bundles: Readonly<Record<string, string>>,
  bundleHashes: Readonly<Record<string, string>> | undefined,
) {
  if (bundleHashes === undefined) return;
  const bundlePaths = Object.keys(bundles).sort((left, right) => left.localeCompare(right));
  const hashPaths = Object.keys(bundleHashes).sort((left, right) => left.localeCompare(right));
  if (bundlePaths.length !== hashPaths.length || bundlePaths.some((path, index) => path !== hashPaths[index])) {
    throw new PersistenceIntegrityError("The saved bundle hashes don't cover every file in the bundle manifest.");
  }
  for (const path of bundlePaths) {
    const expected = bundleHashes[path];
    if (typeof expected !== "string" || !expected) {
      throw new PersistenceIntegrityError(`Saved bundle ${path} doesn't have a valid content hash.`);
    }
    const actual = await hashTextForExpectedAlgorithm(bundles[path], expected);
    if (actual !== expected) {
      throw new PersistenceIntegrityError(`Saved bundle ${path} failed its content-hash integrity check.`);
    }
  }
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
