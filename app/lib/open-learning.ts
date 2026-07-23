import {
  canonicalLearningPackJson,
  learningFeedSchema,
  parseLearningPackJson,
  type LearningFeed,
  type LearningPack,
} from "@latent/course-kit";

export const MAX_HOSTED_LEARNING_BYTES = 2_000_000;
export const LAST_INSTALLED_PACK_KEY = "latent.open-learning.last-install.v1";

export type InstalledLearningPack = {
  feedUrl: string;
  installedAt: string;
  pack: LearningPack;
  sha256: string;
  siteUrl: string;
};

function hostedPublisherScope(feedUrl: string) {
  return new URL(feedUrl).origin;
}

export function installedLearningPackKey(feedUrl: string, packageId: string, version: string) {
  return `latent.open-learning.install.v1:${hostedPublisherScope(feedUrl)}:${packageId}@${version}`;
}

export function learningProgressKey(
  feedUrl: string,
  packageId: string,
  version: string,
  sha256: string,
) {
  return `latent.open-learning.progress.v1:${hostedPublisherScope(feedUrl)}:${packageId}@${version}:${sha256}`;
}

export function allowedHostedFeedUrl(input: string, baseUrl: string) {
  const url = new URL(input, baseUrl);
  if (url.username || url.password) {
    throw new Error("Feed URLs must not contain credentials.");
  }
  if (url.protocol === "https:") return url;
  if (
    url.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    return url;
  }
  throw new Error("Use an HTTPS feed URL. Plain HTTP is allowed only on this device for local preview.");
}

export function resolveSameOriginPackageUrl(feedUrl: URL, relativeUrl: string) {
  const packageUrl = new URL(relativeUrl, feedUrl);
  if (packageUrl.origin !== feedUrl.origin) {
    throw new Error("The package URL must stay on the feed's origin.");
  }
  return packageUrl;
}

export function parseLearningFeedJson(source: string): LearningFeed {
  if (new TextEncoder().encode(source).byteLength > MAX_HOSTED_LEARNING_BYTES) {
    throw new Error("The feed exceeds the 2 MB limit.");
  }
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new Error("The feed is not valid JSON.");
  }
  const parsed = learningFeedSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.length ? `${first.path.map(String).join(".")}: ` : "";
    throw new Error(`${path}${first?.message ?? "The feed does not match the public format."}`);
  }
  return parsed.data;
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function verifyHostedPackage(
  bytes: Uint8Array,
  entry: LearningFeed["packages"][number],
  digest: string,
) {
  if (bytes.byteLength !== entry.bytes) {
    throw new Error(`Package byte count mismatch: expected ${entry.bytes}, received ${bytes.byteLength}.`);
  }
  if (digest !== entry.sha256) throw new Error("Package integrity check failed. Its SHA-256 digest does not match the feed.");
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The hosted package is not valid UTF-8.");
  }
  const validation = parseLearningPackJson(source);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(`${first.path}: ${first.message}`);
  }
  if (
    validation.pack.package.id !== entry.packageId
    || validation.pack.package.version !== entry.version
    || validation.pack.package.title !== entry.title
    || validation.pack.package.description !== entry.description
    || validation.pack.package.publishedAt !== entry.publishedAt
  ) {
    throw new Error("The package metadata does not match the feed entry.");
  }
  const canonicalBytes = new TextEncoder().encode(canonicalLearningPackJson(validation.pack));
  if (
    canonicalBytes.byteLength !== bytes.byteLength
    || !canonicalBytes.every((value, index) => value === bytes[index])
  ) {
    throw new Error("Hosted learning-pack.json must use the canonical JSON representation.");
  }
  return validation.pack;
}

export function parseInstalledLearningPack(source: string): InstalledLearningPack | null {
  try {
    const installed = JSON.parse(source) as Partial<InstalledLearningPack>;
    if (
      typeof installed.feedUrl !== "string"
      || typeof installed.installedAt !== "string"
      || typeof installed.sha256 !== "string"
      || typeof installed.siteUrl !== "string"
    ) return null;
    const feedUrl = new URL(installed.feedUrl);
    const siteUrl = new URL(installed.siteUrl);
    if (
      !/^[a-f0-9]{64}$/.test(installed.sha256)
      || Number.isNaN(Date.parse(installed.installedAt))
      || Boolean(feedUrl.username)
      || Boolean(feedUrl.password)
      || Boolean(siteUrl.username)
      || Boolean(siteUrl.password)
      || !["https:", "http:"].includes(feedUrl.protocol)
      || (feedUrl.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(feedUrl.hostname))
      || siteUrl.origin !== feedUrl.origin
    ) return null;
    const validation = parseLearningPackJson(JSON.stringify(installed.pack));
    if (!validation.valid) return null;
    return {
      feedUrl: installed.feedUrl,
      installedAt: installed.installedAt,
      sha256: installed.sha256,
      siteUrl: installed.siteUrl,
      pack: validation.pack,
    };
  } catch {
    return null;
  }
}
