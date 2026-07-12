import {
  ARTIFACT_SCHEMA_VERSION,
  type ArtifactComparison,
  type ArtifactEnvelope,
  type ArtifactJson,
  type ArtifactReplay,
  type CreateArtifactInput,
} from "./types";

export class ArtifactInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactInvariantError";
  }
}

function assertText(value: unknown, label: string, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new ArtifactInvariantError(`${label} must be a non-empty string under ${max} characters.`);
  }
}

function assertJson(value: unknown, label = "artifact payload") {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let characters = 0;
  while (stack.length) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > 250_000 || current.depth > 48) throw new ArtifactInvariantError(`${label} exceeds the structural limit.`);
    if (typeof current.value === "string") {
      characters += current.value.length;
    } else if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) throw new ArtifactInvariantError(`${label} contains a non-finite number.`);
    } else if (typeof current.value === "boolean" || current.value === null) {
      // JSON primitives are safe.
    } else if (typeof current.value === "object" && current.value) {
      if (seen.has(current.value)) throw new ArtifactInvariantError(`${label} contains a circular reference.`);
      seen.add(current.value);
      for (const [key, child] of Object.entries(current.value)) {
        characters += key.length;
        stack.push({ value: child, depth: current.depth + 1 });
      }
    } else {
      throw new ArtifactInvariantError(`${label} contains an unsupported value.`);
    }
    if (characters > 16 * 1024 * 1024) throw new ArtifactInvariantError(`${label} exceeds the text limit.`);
  }
}

export function canonicalArtifactJson(value: ArtifactJson): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ArtifactInvariantError("Artifacts cannot contain non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalArtifactJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalArtifactJson(value[key])}`).join(",")}}`;
}

export async function hashArtifactValue(value: ArtifactJson) {
  const bytes = new TextEncoder().encode(canonicalArtifactJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function artifactMaterial(input: CreateArtifactInput | ArtifactEnvelope): ArtifactJson {
  const record = input as Partial<ArtifactEnvelope> & CreateArtifactInput;
  const { schemaVersion: _schemaVersion, id: _id, contentHash: _contentHash, createdAt: _createdAt, ...material } = record;
  void _schemaVersion;
  void _id;
  void _contentHash;
  void _createdAt;
  return material as unknown as ArtifactJson;
}

function validateReplay(replay: ArtifactReplay | null) {
  if (!replay) return;
  assertText(replay.unit, "Replay unit", 80);
  let previousAt = Number.NEGATIVE_INFINITY;
  replay.frames.forEach((frame, index) => {
    if (frame.index !== index) throw new ArtifactInvariantError("Replay frame indexes must be contiguous and zero-based.");
    if (!Number.isFinite(frame.at) || frame.at < previousAt) throw new ArtifactInvariantError("Replay time must be finite and monotonic.");
    previousAt = frame.at;
    assertText(frame.label, "Replay frame label", 160);
    assertJson(frame.payload, "Replay frame payload");
    assertJson(frame.metrics, "Replay frame metrics");
  });
}

function validateArtifactShape(artifact: ArtifactEnvelope) {
  if (artifact.schemaVersion !== ARTIFACT_SCHEMA_VERSION) throw new ArtifactInvariantError("Unsupported artifact schema version.");
  assertText(artifact.id, "Artifact id", 160);
  assertText(artifact.kind, "Artifact kind", 100);
  assertText(artifact.title, "Artifact title", 240);
  assertText(artifact.description, "Artifact description", 1_200);
  assertText(artifact.projectId, "Artifact project id", 160);
  assertText(artifact.producer.runtime, "Producer runtime", 160);
  assertText(artifact.producer.version, "Producer version", 80);
  assertText(artifact.producer.operation, "Producer operation", 160);
  if (!Number.isFinite(artifact.createdAt) || artifact.createdAt < 0) throw new ArtifactInvariantError("Artifact creation time is invalid.");
  if (!/^sha256:[a-f0-9]{64}$/.test(artifact.contentHash)) throw new ArtifactInvariantError("Artifact content hash is invalid.");
  if (artifact.links.some((link) => link.artifactId === artifact.id)) throw new ArtifactInvariantError("An artifact cannot link to itself.");
  if (new Set(artifact.links.map((link) => `${link.relation}:${link.artifactId}`)).size !== artifact.links.length) {
    throw new ArtifactInvariantError("Artifact links must be unique.");
  }
  assertJson(artifact.payload);
  assertJson(artifact.metrics, "Artifact metrics");
  validateReplay(artifact.replay);
}

export async function createArtifact(input: CreateArtifactInput): Promise<ArtifactEnvelope> {
  const normalized: CreateArtifactInput = {
    ...input,
    labels: [...new Set(input.labels)].sort(),
    links: [...input.links],
    metrics: { ...input.metrics },
  };
  const material = artifactMaterial(normalized);
  assertJson(material, "Artifact body");
  const contentHash = await hashArtifactValue(material);
  const artifact: ArtifactEnvelope = {
    ...normalized,
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    id: `artifact:${contentHash.slice("sha256:".length, "sha256:".length + 24)}`,
    contentHash,
    createdAt: normalized.createdAt ?? Date.now(),
  };
  validateArtifactShape(artifact);
  return artifact;
}

export async function assertArtifactEnvelope(value: unknown): Promise<ArtifactEnvelope> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArtifactInvariantError("Artifact envelope is invalid.");
  const artifact = value as ArtifactEnvelope;
  validateArtifactShape(artifact);
  const expected = await hashArtifactValue(artifactMaterial(artifact));
  if (expected !== artifact.contentHash || artifact.id !== `artifact:${expected.slice("sha256:".length, "sha256:".length + 24)}`) {
    throw new ArtifactInvariantError("Artifact content or identity has been tampered with.");
  }
  return artifact;
}

function changedPaths(before: ArtifactJson, after: ArtifactJson, limit = 80) {
  const changed: string[] = [];
  const work: Array<{ before: ArtifactJson | undefined; after: ArtifactJson | undefined; path: string }> = [{ before, after, path: "$" }];
  while (work.length && changed.length < limit) {
    const current = work.pop()!;
    if (Object.is(current.before, current.after)) continue;
    const beforeObject = current.before && typeof current.before === "object";
    const afterObject = current.after && typeof current.after === "object";
    if (!beforeObject || !afterObject || Array.isArray(current.before) !== Array.isArray(current.after)) {
      changed.push(current.path);
      continue;
    }
    const beforeRecord = current.before as Record<string, ArtifactJson>;
    const afterRecord = current.after as Record<string, ArtifactJson>;
    const keys = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort().reverse();
    for (const key of keys) work.push({ before: beforeRecord[key], after: afterRecord[key], path: `${current.path}.${key}` });
  }
  return changed;
}

export function compareArtifacts(before: ArtifactEnvelope, after: ArtifactEnvelope): ArtifactComparison {
  const metricKeys = [...new Set([...Object.keys(before.metrics), ...Object.keys(after.metrics)])].sort();
  return {
    beforeId: before.id,
    afterId: after.id,
    sameKind: before.kind === after.kind,
    metrics: metricKeys.map((key) => {
      const left = before.metrics[key] ?? null;
      const right = after.metrics[key] ?? null;
      return { key, before: left, after: right, delta: left === null || right === null ? null : right - left };
    }),
    changedPayloadPaths: changedPaths(before.payload, after.payload),
  };
}

export class ArtifactReplayCursor {
  private position = 0;

  constructor(readonly replay: ArtifactReplay) {
    validateReplay(replay);
  }

  get index() { return this.position; }
  get frame() { return this.replay.frames[this.position] ?? null; }
  get progress() { return this.replay.frames.length < 2 ? 1 : this.position / (this.replay.frames.length - 1); }
  seek(index: number) {
    this.position = Math.max(0, Math.min(this.replay.frames.length - 1, Math.round(index)));
    return this.frame;
  }
  next() { return this.seek(this.position + 1); }
  previous() { return this.seek(this.position - 1); }
}
