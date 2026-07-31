"use client";

import {
  isSourceHash,
  type SourceHash,
} from "@latent/browser-lab";
import { getPersistenceContext } from "@/app/platform/persistence/client";
import { assertStructuredValueWithinLimits } from "@/app/platform/persistence/pure";
import type {
  JsonValue,
  SettingRecord,
} from "@/app/platform/persistence/types";

export const TRUSTED_INTERACTIVE_STATE_FORMAT = "latent-trusted-interactive-state" as const;
export const TRUSTED_INTERACTIVE_STATE_VERSION = 1 as const;
export const TRUSTED_INTERACTIVE_MAX_STATE_BYTES = 32_000;
export const TRUSTED_INTERACTIVE_MAX_STATE_DEPTH = 16;
export const TRUSTED_INTERACTIVE_MAX_STATE_NODES = 4_000;
export const TRUSTED_INTERACTIVE_MAX_STATE_STRING_CHARACTERS = 32_000;
export const TRUSTED_INTERACTIVE_MAX_STATE_KEY_CHARACTERS = 256;

const STATE_KEY_PREFIX = "trusted-interactive:v1:state:";
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const IDENTITY_KEYS = [
  "courseId",
  "definitionVersion",
  "interactiveId",
  "lessonId",
  "sourceHash",
  "stateSchemaVersion",
] as const;

export type TrustedInteractiveStateIdentity = {
  courseId: string;
  lessonId: string;
  interactiveId: string;
  definitionVersion: number;
  sourceHash: SourceHash;
  stateSchemaVersion: number;
};

export type TrustedInteractiveStateRecord = {
  format: typeof TRUSTED_INTERACTIVE_STATE_FORMAT;
  version: typeof TRUSTED_INTERACTIVE_STATE_VERSION;
  identity: TrustedInteractiveStateIdentity;
  revision: number;
  state: JsonValue;
  updatedAt: number;
};

export type TrustedInteractiveStateLoad = {
  record: TrustedInteractiveStateRecord;
  /**
   * Opaque compare-and-swap token. Callers must return this exact token when
   * replacing or resetting the loaded state.
   */
  token: string;
};

export type TrustedInteractivePersistenceErrorCode =
  | "INVALID_IDENTITY"
  | "INVALID_STATE"
  | "INVALID_STORED_STATE"
  | "WRITE_CONFLICT";

export class TrustedInteractivePersistenceError extends Error {
  constructor(
    readonly code: TrustedInteractivePersistenceErrorCode,
    message: string,
    /** Present when invalid durable bytes can be removed with a CAS reset. */
    readonly token?: string,
  ) {
    super(message);
    this.name = "TrustedInteractivePersistenceError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function identityIssue(value: unknown): string | null {
  if (!isRecord(value)) return "Interactive state identity must be a plain object.";
  const keys = Object.keys(value).sort();
  if (
    keys.length !== IDENTITY_KEYS.length
    || keys.some((key, index) => key !== IDENTITY_KEYS[index])
  ) {
    return "Interactive state identity must contain exactly the reviewed identity fields.";
  }
  if (
    typeof value.courseId !== "string"
    || !SAFE_ID.test(value.courseId)
    || typeof value.lessonId !== "string"
    || !SAFE_ID.test(value.lessonId)
    || typeof value.interactiveId !== "string"
    || !SAFE_ID.test(value.interactiveId)
  ) {
    return "Course, lesson, and interactive ids must be lowercase stable ids.";
  }
  if (
    !Number.isSafeInteger(value.definitionVersion)
    || (value.definitionVersion as number) < 1
    || !Number.isSafeInteger(value.stateSchemaVersion)
    || (value.stateSchemaVersion as number) < 1
  ) {
    return "Interactive definition and state schema versions must be positive integers.";
  }
  if (!isSourceHash(value.sourceHash)) {
    return "Interactive state identity requires an exact SHA-256 source hash.";
  }
  return null;
}

export function assertTrustedInteractiveStateIdentity(
  value: unknown,
): asserts value is TrustedInteractiveStateIdentity {
  const issue = identityIssue(value);
  if (issue) throw new TrustedInteractivePersistenceError("INVALID_IDENTITY", issue);
}

function normalizedIdentity(value: TrustedInteractiveStateIdentity): TrustedInteractiveStateIdentity {
  assertTrustedInteractiveStateIdentity(value);
  return Object.freeze({
    courseId: value.courseId,
    lessonId: value.lessonId,
    interactiveId: value.interactiveId,
    definitionVersion: value.definitionVersion,
    sourceHash: value.sourceHash,
    stateSchemaVersion: value.stateSchemaVersion,
  });
}

export function trustedInteractiveStateIdentityEquals(
  left: TrustedInteractiveStateIdentity,
  right: TrustedInteractiveStateIdentity,
) {
  return left.courseId === right.courseId
    && left.lessonId === right.lessonId
    && left.interactiveId === right.interactiveId
    && left.definitionVersion === right.definitionVersion
    && left.sourceHash === right.sourceHash
    && left.stateSchemaVersion === right.stateSchemaVersion;
}

export function trustedInteractiveStateKey(identity: TrustedInteractiveStateIdentity): string {
  const exact = normalizedIdentity(identity);
  return `${STATE_KEY_PREFIX}${[
    exact.courseId,
    exact.lessonId,
    exact.interactiveId,
    String(exact.definitionVersion),
    exact.sourceHash,
    String(exact.stateSchemaVersion),
  ].map(encodeURIComponent).join(":")}`;
}

function validateJsonShape(value: unknown): void {
  let nodes = 0;
  const seen = new WeakSet<object>();

  const visit = (candidate: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > TRUSTED_INTERACTIVE_MAX_STATE_NODES) {
      throw new TrustedInteractivePersistenceError(
        "INVALID_STATE",
        `Interactive state may contain at most ${TRUSTED_INTERACTIVE_MAX_STATE_NODES.toLocaleString()} JSON values.`,
      );
    }
    if (depth > TRUSTED_INTERACTIVE_MAX_STATE_DEPTH) {
      throw new TrustedInteractivePersistenceError(
        "INVALID_STATE",
        `Interactive state may be nested at most ${TRUSTED_INTERACTIVE_MAX_STATE_DEPTH} levels deep.`,
      );
    }
    if (candidate === null || typeof candidate === "boolean") return;
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) {
        throw new TrustedInteractivePersistenceError("INVALID_STATE", "Interactive state numbers must be finite.");
      }
      return;
    }
    if (typeof candidate === "string") {
      if (candidate.length > TRUSTED_INTERACTIVE_MAX_STATE_STRING_CHARACTERS) {
        throw new TrustedInteractivePersistenceError(
          "INVALID_STATE",
          `One interactive state string exceeds ${TRUSTED_INTERACTIVE_MAX_STATE_STRING_CHARACTERS.toLocaleString()} characters.`,
        );
      }
      return;
    }
    if (!candidate || typeof candidate !== "object") {
      throw new TrustedInteractivePersistenceError("INVALID_STATE", "Interactive state must contain JSON values only.");
    }
    if (seen.has(candidate)) {
      throw new TrustedInteractivePersistenceError("INVALID_STATE", "Interactive state cannot contain circular references.");
    }
    if (!Array.isArray(candidate) && !isRecord(candidate)) {
      throw new TrustedInteractivePersistenceError("INVALID_STATE", "Interactive state objects must be plain JSON objects.");
    }
    if (Object.getOwnPropertySymbols(candidate).length) {
      throw new TrustedInteractivePersistenceError("INVALID_STATE", "Interactive state cannot contain symbol properties.");
    }
    seen.add(candidate);
    for (const [key, child] of Object.entries(candidate)) {
      if (key.length > TRUSTED_INTERACTIVE_MAX_STATE_KEY_CHARACTERS) {
        throw new TrustedInteractivePersistenceError(
          "INVALID_STATE",
          `Interactive state keys may contain at most ${TRUSTED_INTERACTIVE_MAX_STATE_KEY_CHARACTERS} characters.`,
        );
      }
      visit(child, depth + 1);
    }
    seen.delete(candidate);
  };

  visit(value, 0);
}

export function cloneBoundedTrustedInteractiveState(value: unknown): JsonValue {
  validateJsonShape(value);
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") {
    throw new TrustedInteractivePersistenceError("INVALID_STATE", "Interactive state must serialize to JSON.");
  }
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > TRUSTED_INTERACTIVE_MAX_STATE_BYTES) {
    throw new TrustedInteractivePersistenceError(
      "INVALID_STATE",
      `Interactive state may contain at most ${TRUSTED_INTERACTIVE_MAX_STATE_BYTES.toLocaleString()} UTF-8 bytes.`,
    );
  }
  const cloned = JSON.parse(serialized) as JsonValue;
  assertStructuredValueWithinLimits(cloned, {
    maxSerializedCharacters: TRUSTED_INTERACTIVE_MAX_STATE_BYTES,
    maxRecordsPerTable: 1,
    maxNodes: TRUSTED_INTERACTIVE_MAX_STATE_NODES,
    maxDepth: TRUSTED_INTERACTIVE_MAX_STATE_DEPTH,
    maxEstimatedBytes: TRUSTED_INTERACTIVE_MAX_STATE_BYTES * 3,
    maxStringCharacters: TRUSTED_INTERACTIVE_MAX_STATE_STRING_CHARACTERS,
  });
  return cloned;
}

function recordToken(record: Pick<SettingRecord, "updatedAt" | "value">): string {
  return JSON.stringify([record.updatedAt, record.value]);
}

function stateRecord(
  value: unknown,
  expectedIdentity: TrustedInteractiveStateIdentity,
): TrustedInteractiveStateRecord | null {
  if (
    !isRecord(value)
    || value.format !== TRUSTED_INTERACTIVE_STATE_FORMAT
    || value.version !== TRUSTED_INTERACTIVE_STATE_VERSION
    || !Number.isSafeInteger(value.revision)
    || (value.revision as number) < 1
    || !Number.isSafeInteger(value.updatedAt)
    || (value.updatedAt as number) < 0
  ) return null;
  try {
    assertTrustedInteractiveStateIdentity(value.identity);
    if (!trustedInteractiveStateIdentityEquals(value.identity, expectedIdentity)) return null;
    return {
      format: TRUSTED_INTERACTIVE_STATE_FORMAT,
      version: TRUSTED_INTERACTIVE_STATE_VERSION,
      identity: normalizedIdentity(value.identity),
      revision: value.revision as number,
      state: cloneBoundedTrustedInteractiveState(value.state),
      updatedAt: value.updatedAt as number,
    };
  } catch {
    return null;
  }
}

function sameState(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function loadResult(
  durable: SettingRecord,
  identity: TrustedInteractiveStateIdentity,
): TrustedInteractiveStateLoad {
  const parsed = stateRecord(durable.value, identity);
  if (!parsed) {
    throw new TrustedInteractivePersistenceError(
      "INVALID_STORED_STATE",
      "Saved interactive state does not match its exact trusted definition.",
      recordToken(durable),
    );
  }
  return { record: parsed, token: recordToken(durable) };
}

export type TrustedInteractiveStatePersistence = {
  adapterId: "latent-trusted-interactive-indexeddb-v1";
  load(identity: TrustedInteractiveStateIdentity): Promise<TrustedInteractiveStateLoad | null>;
  save(
    identity: TrustedInteractiveStateIdentity,
    state: unknown,
    expectedToken: string | null,
  ): Promise<TrustedInteractiveStateLoad>;
  reset(identity: TrustedInteractiveStateIdentity, expectedToken: string): Promise<boolean>;
};

/**
 * App-owned persistence for trusted interactive frames. Only bounded JSON
 * crosses this adapter, the exact source digest owns the namespace, and this
 * module never reads or writes course-progress tables.
 */
export function createTrustedInteractiveStatePersistence(): TrustedInteractiveStatePersistence {
  return {
    adapterId: "latent-trusted-interactive-indexeddb-v1",

    async load(identity) {
      const exact = normalizedIdentity(identity);
      const { database } = await getPersistenceContext();
      const durable = await database.settings.get(trustedInteractiveStateKey(exact));
      return durable ? loadResult(durable, exact) : null;
    },

    async save(identity, state, expectedToken) {
      const exact = normalizedIdentity(identity);
      const safeState = cloneBoundedTrustedInteractiveState(state);
      const key = trustedInteractiveStateKey(exact);
      const { database, repositories } = await getPersistenceContext();

      return database.transaction("rw", database.settings, async () => {
        const current = await database.settings.get(key);
        const currentParsed = current ? stateRecord(current.value, exact) : null;
        if (current && currentParsed && sameState(currentParsed.state, safeState)) {
          return loadResult(current, exact);
        }
        const currentToken = current ? recordToken(current) : null;
        if (currentToken !== expectedToken) {
          throw new TrustedInteractivePersistenceError(
            "WRITE_CONFLICT",
            "Interactive state changed in another tab before this save completed.",
          );
        }
        const updatedAt = Date.now();
        const next: TrustedInteractiveStateRecord = {
          format: TRUSTED_INTERACTIVE_STATE_FORMAT,
          version: TRUSTED_INTERACTIVE_STATE_VERSION,
          identity: exact,
          revision: (currentParsed?.revision ?? 0) + 1,
          state: safeState,
          updatedAt,
        };
        const durable = await repositories.settings.put(key, next as unknown as JsonValue);
        return loadResult(durable, exact);
      });
    },

    async reset(identity, expectedToken) {
      const exact = normalizedIdentity(identity);
      if (!expectedToken) {
        throw new TrustedInteractivePersistenceError(
          "WRITE_CONFLICT",
          "Reset requires the opaque token returned by the state load.",
        );
      }
      const { database } = await getPersistenceContext();
      return database.transaction("rw", database.settings, async () => {
        const key = trustedInteractiveStateKey(exact);
        const current = await database.settings.get(key);
        if (!current || recordToken(current) !== expectedToken) return false;
        await database.settings.delete(key);
        return true;
      });
    },
  };
}
