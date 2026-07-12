import { assertArtifactEnvelope } from "./core.js";
import {
  ARTIFACT_BUNDLE_VERSION,
  type ArtifactEnvelope,
  type PortableArtifactBundle,
} from "./types.js";

export class ArtifactBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactBundleError";
  }
}

export async function createArtifactBundle(rootArtifactId: string, artifacts: readonly ArtifactEnvelope[]) {
  const unique = new Map<string, ArtifactEnvelope>();
  for (const artifact of artifacts) unique.set(artifact.id, await assertArtifactEnvelope(artifact));
  if (!unique.has(rootArtifactId)) throw new ArtifactBundleError("The root artifact is missing from the bundle.");
  for (const artifact of unique.values()) {
    for (const link of artifact.links) {
      const linked = unique.get(link.artifactId);
      if (!linked) throw new ArtifactBundleError(`Artifact lineage is incomplete at ${link.artifactId}.`);
      if (linked.contentHash !== link.contentHash || linked.kind !== link.kind) {
        throw new ArtifactBundleError(`Artifact lineage metadata does not match ${link.artifactId}.`);
      }
    }
  }
  return {
    format: "latent-artifact" as const,
    bundleVersion: ARTIFACT_BUNDLE_VERSION,
    exportedAt: Date.now(),
    rootArtifactId,
    artifacts: [...unique.values()].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)),
  } satisfies PortableArtifactBundle;
}

export function serializeArtifactBundle(bundle: PortableArtifactBundle) {
  const serialized = JSON.stringify(bundle, null, 2);
  if (serialized.length > 32 * 1024 * 1024) throw new ArtifactBundleError("The artifact bundle exceeds the portable size limit.");
  return serialized;
}

export async function parseArtifactBundle(source: string | PortableArtifactBundle) {
  if (typeof source === "string" && source.length > 32 * 1024 * 1024) throw new ArtifactBundleError("The artifact bundle exceeds the portable size limit.");
  let value: unknown;
  try {
    value = typeof source === "string" ? JSON.parse(source) : source;
  } catch {
    throw new ArtifactBundleError("The artifact bundle is not valid JSON.");
  }
  if (!value || typeof value !== "object") throw new ArtifactBundleError("The artifact bundle is invalid.");
  const bundle = value as PortableArtifactBundle;
  if (bundle.format !== "latent-artifact" || bundle.bundleVersion !== ARTIFACT_BUNDLE_VERSION || !Array.isArray(bundle.artifacts)) {
    throw new ArtifactBundleError("This is not a supported Latent artifact bundle.");
  }
  return createArtifactBundle(bundle.rootArtifactId, bundle.artifacts);
}

export function artifactBundleBlob(bundle: PortableArtifactBundle) {
  return new Blob([serializeArtifactBundle(bundle)], { type: "application/vnd.latent.artifact+json" });
}
