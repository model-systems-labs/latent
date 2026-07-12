import Dexie, { type Table } from "dexie";
import { assertArtifactEnvelope } from "./core.js";
import { createArtifactBundle, parseArtifactBundle } from "./portable.js";
import type { ArtifactEnvelope, ArtifactHeadRecord, PortableArtifactBundle } from "./types.js";

export const DEFAULT_ARTIFACT_DATABASE_NAME = "latent-artifact-runtime";

export class ArtifactRuntimeDatabase extends Dexie {
  artifacts!: Table<ArtifactEnvelope, string>;
  heads!: Table<ArtifactHeadRecord, string>;

  constructor(name = DEFAULT_ARTIFACT_DATABASE_NAME) {
    super(name);
    this.version(1).stores({
      artifacts: "&id, contentHash, projectId, moduleId, lessonId, kind, mode, createdAt",
      heads: "&id, projectId, channel, scopeId, artifactId, updatedAt",
    });
  }
}

export class ArtifactStore {
  constructor(readonly database: ArtifactRuntimeDatabase) {}

  async put(value: ArtifactEnvelope) {
    const artifact = await assertArtifactEnvelope(value);
    const existing = await this.database.artifacts.get(artifact.id);
    if (existing) {
      if (existing.contentHash !== artifact.contentHash) throw new Error(`Artifact ${artifact.id} conflicts with immutable local state.`);
      return existing;
    }
    await this.database.artifacts.add(artifact);
    return artifact;
  }

  get(id: string) { return this.database.artifacts.get(id); }

  async list(options: { projectId?: string; lessonId?: string; kind?: string } = {}) {
    const all = await this.database.artifacts.orderBy("createdAt").toArray();
    return all.filter((artifact) => (
      (!options.projectId || artifact.projectId === options.projectId)
      && (!options.lessonId || artifact.lessonId === options.lessonId)
      && (!options.kind || artifact.kind === options.kind)
    ));
  }

  async latestForLesson(lessonId: string, projectId = "browser-chat") {
    const head = await this.database.heads.get(`${projectId}:lesson-output:${lessonId}`);
    return head ? this.database.artifacts.get(head.artifactId) : undefined;
  }

  async activate(artifact: ArtifactEnvelope, channel: ArtifactHeadRecord["channel"], scopeId: string) {
    const stored = await this.database.artifacts.get(artifact.id);
    if (!stored || stored.contentHash !== artifact.contentHash) throw new Error("Only a stored immutable artifact can become active.");
    const id = `${artifact.projectId}:${channel}:${scopeId}`;
    await this.database.heads.put({ id, projectId: artifact.projectId, channel, scopeId, artifactId: artifact.id, updatedAt: Date.now() });
    return stored;
  }

  async active(projectId: string, channel: ArtifactHeadRecord["channel"], scopeId: string) {
    const head = await this.database.heads.get(`${projectId}:${channel}:${scopeId}`);
    return head ? this.database.artifacts.get(head.artifactId) : undefined;
  }

  async lineage(rootArtifactId: string) {
    const found = new Map<string, ArtifactEnvelope>();
    const pending = [rootArtifactId];
    while (pending.length) {
      const id = pending.pop()!;
      if (found.has(id)) continue;
      const artifact = await this.database.artifacts.get(id);
      if (!artifact) continue;
      found.set(id, artifact);
      pending.push(...artifact.links.map((link) => link.artifactId));
    }
    return [...found.values()];
  }

  async bundle(rootArtifactId: string) {
    return createArtifactBundle(rootArtifactId, await this.lineage(rootArtifactId));
  }

  async import(bundle: string | PortableArtifactBundle) {
    const parsed = await parseArtifactBundle(bundle);
    const existing = await this.database.artifacts.bulkGet(parsed.artifacts.map((artifact) => artifact.id));
    parsed.artifacts.forEach((artifact, index) => {
      if (existing[index] && existing[index]?.contentHash !== artifact.contentHash) {
        throw new Error(`Artifact ${artifact.id} conflicts with immutable local state.`);
      }
    });
    const missing = parsed.artifacts.filter((_, index) => !existing[index]);
    if (missing.length) await this.database.artifacts.bulkAdd(missing);
    return parsed;
  }
}

export async function openArtifactRuntime(name = DEFAULT_ARTIFACT_DATABASE_NAME) {
  if (typeof indexedDB === "undefined") throw new Error("Artifact persistence requires IndexedDB.");
  const database = new ArtifactRuntimeDatabase(name);
  await database.open();
  return { database, store: new ArtifactStore(database), close: () => database.close() };
}
