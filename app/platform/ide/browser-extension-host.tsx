"use client";

import type { ReactElement } from "react";
import {
  BrowserLabError,
  type JsonValue as BrowserLabJsonValue,
  type TestReceipt,
} from "@latent/browser-lab";
import {
  createBrowserIdeSession,
  createBrowserLabIdeRuntime,
  type BrowserIdeEditorAdapter,
  type BrowserIdeExtensionDefinition,
  type BrowserIdeHostBindings,
  type BrowserIdePersistenceIdentity,
  type BrowserIdePersistenceAdapter,
  type BrowserIdeReceiptArtifact,
  type BrowserIdeSession,
  type BrowserLabIdeRuntimeOptions,
} from "@latent/browser-lab/ide";
import { CodeEditor } from "@/app/features/ide/CodeEditor";
import { getPersistenceContext } from "@/app/platform/persistence/client";
import type { JsonValue } from "@/app/platform/persistence/types";

const STATE_KEY_PREFIX = "browser-ide-extension:v1:state:";
const RECEIPT_KEY_PREFIX = "browser-ide-extension:v1:receipt-artifact:";
export const BROWSER_IDE_MAX_RECEIPT_ARTIFACTS_PER_EXTENSION = 8;

type BrowserIdeStateEnvelope = {
  format: "latent-browser-ide-state";
  version: 1;
  state: Parameters<BrowserIdePersistenceAdapter["save"]>[0];
  identity: BrowserIdePersistenceIdentity;
  currentReceiptArtifactKey: string | null;
};

type BrowserIdeReceiptEnvelope = {
  format: "latent-browser-ide-receipt";
  version: 1;
  artifact: BrowserIdeReceiptArtifact;
  receipt: TestReceipt;
};

export type LatentBrowserIdeHostEvents = {
  readonly onStateChange?: () => void;
  readonly onReceipt?: (receipt: TestReceipt) => void;
  readonly onError?: (error: unknown) => void;
};

function persistenceJson(value: BrowserLabJsonValue | object): JsonValue {
  // Browser IDE state and receipts are bounded JSON records. Clone through the
  // platform's storage representation so no mutable runtime object crosses the
  // persistence boundary.
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export function browserIdeStateKey(extensionId: string): string {
  return `${STATE_KEY_PREFIX}${extensionId}`;
}

export function browserIdeReceiptArtifactKey(
  extensionId: string,
  receipt: Pick<TestReceipt, "sourceHash" | "contractVersion" | "receiptId">,
): string {
  return [
    RECEIPT_KEY_PREFIX,
    encodeURIComponent(extensionId),
    ":",
    encodeURIComponent(receipt.sourceHash),
    ":",
    encodeURIComponent(receipt.contractVersion),
    ":",
    encodeURIComponent(receipt.receiptId),
  ].join("");
}

export function browserIdeReceiptArtifactPrefix(extensionId: string): string {
  return `${RECEIPT_KEY_PREFIX}${encodeURIComponent(extensionId)}:`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stateEnvelope(value: unknown): BrowserIdeStateEnvelope | null {
  if (
    !isRecord(value)
    || value.format !== "latent-browser-ide-state"
    || value.version !== 1
    || !isRecord(value.state)
    || !isRecord(value.identity)
    || typeof value.identity.revision !== "number"
    || typeof value.identity.sourceHash !== "string"
    || (value.currentReceiptArtifactKey !== null && typeof value.currentReceiptArtifactKey !== "string")
  ) return null;
  return value as BrowserIdeStateEnvelope;
}

function receiptEnvelope(value: unknown): BrowserIdeReceiptEnvelope | null {
  if (
    !isRecord(value)
    || value.format !== "latent-browser-ide-receipt"
    || value.version !== 1
    || !isRecord(value.artifact)
    || typeof value.artifact.artifactKey !== "string"
    || typeof value.artifact.extensionId !== "string"
    || typeof value.artifact.sourceHash !== "string"
    || typeof value.artifact.contractVersion !== "string"
    || typeof value.artifact.receiptId !== "string"
    || !isRecord(value.receipt)
  ) return null;
  return value as BrowserIdeReceiptEnvelope;
}

function sameIdentity(
  left: BrowserIdePersistenceIdentity | null,
  right: BrowserIdePersistenceIdentity | null,
) {
  return left === null
    ? right === null
    : right !== null
      && left.revision === right.revision
      && left.sourceHash === right.sourceHash;
}

function persistenceRecordToken(record: {
  readonly updatedAt: number;
  readonly value: JsonValue;
}): string {
  return JSON.stringify([record.updatedAt, record.value]);
}

/**
 * App-owned IndexedDB adapter. Browser Lab knows only the persistence port;
 * it never imports Dexie or the application's repository layer.
 */
export function createLatentBrowserIdePersistence(): BrowserIdePersistenceAdapter {
  return {
    adapterId: "latent-indexeddb-v1",
    async load(extensionId) {
      const { database } = await getPersistenceContext();
      const record = await database.settings.get(browserIdeStateKey(extensionId));
      if (!record) return null;
      return {
        value: stateEnvelope(record.value)?.state ?? record.value,
        token: persistenceRecordToken(record),
      };
    },
    async save(state, identity, expected) {
      const { database, repositories } = await getPersistenceContext();
      return database.transaction("rw", database.settings, async () => {
        const key = browserIdeStateKey(state.extensionId);
        const current = stateEnvelope(await repositories.settings.get(key));
        const currentIdentity = current?.identity ?? null;
        const idempotent = sameIdentity(currentIdentity, identity);
        if (!idempotent && !sameIdentity(currentIdentity, expected)) {
          throw new BrowserLabError("IDE_WRITE_CONFLICT", "Saved IDE source changed in another session before this write.");
        }
        if (
          currentIdentity
          && (
            identity.revision < currentIdentity.revision
            || (identity.revision === currentIdentity.revision
              && identity.sourceHash !== currentIdentity.sourceHash)
          )
        ) {
          throw new BrowserLabError("IDE_WRITE_CONFLICT", "A stale IDE write cannot replace newer saved source.");
        }
        const envelope: BrowserIdeStateEnvelope = {
          format: "latent-browser-ide-state",
          version: 1,
          state,
          identity,
          currentReceiptArtifactKey: sameIdentity(currentIdentity, identity)
            ? current?.currentReceiptArtifactKey ?? null
            : null,
        };
        await repositories.settings.put(key, persistenceJson(envelope));
        return identity;
      });
    },
    async stageReceipt(extensionId, receipt) {
      const { database, repositories } = await getPersistenceContext();
      const artifact: BrowserIdeReceiptArtifact = {
        artifactKey: browserIdeReceiptArtifactKey(extensionId, receipt),
        extensionId,
        sourceHash: receipt.sourceHash,
        contractVersion: receipt.contractVersion,
        receiptId: receipt.receiptId,
      };
      const envelope: BrowserIdeReceiptEnvelope = {
        format: "latent-browser-ide-receipt",
        version: 1,
        artifact,
        receipt,
      };
      return database.transaction("rw", database.settings, async () => {
        await repositories.settings.put(artifact.artifactKey, persistenceJson(envelope));
        const state = stateEnvelope(
          await repositories.settings.get(browserIdeStateKey(extensionId)),
        );
        const rows = await database.settings
          .where("key")
          .startsWith(browserIdeReceiptArtifactPrefix(extensionId))
          .toArray();
        const keep = new Set<string>([artifact.artifactKey]);
        if (state?.currentReceiptArtifactKey) keep.add(state.currentReceiptArtifactKey);
        for (const row of rows.sort((left, right) => (
          right.updatedAt - left.updatedAt || right.key.localeCompare(left.key)
        ))) {
          if (keep.size >= BROWSER_IDE_MAX_RECEIPT_ARTIFACTS_PER_EXTENSION) break;
          keep.add(row.key);
        }
        const staleKeys = rows
          .map((row) => row.key)
          .filter((key) => !keep.has(key));
        if (staleKeys.length) await database.settings.bulkDelete(staleKeys);
        return artifact;
      });
    },
    async admitReceipt(extensionId, artifact, expected) {
      const { database, repositories } = await getPersistenceContext();
      return database.transaction("rw", database.settings, async () => {
        const stateKey = browserIdeStateKey(extensionId);
        const current = stateEnvelope(await repositories.settings.get(stateKey));
        if (
          !current
          || !sameIdentity(current.identity, expected)
          || artifact.extensionId !== extensionId
          || artifact.sourceHash !== expected.sourceHash
        ) return false;
        const receipt = receiptEnvelope(await repositories.settings.get(artifact.artifactKey));
        if (
          !receipt
          || receipt.artifact.artifactKey !== artifact.artifactKey
          || receipt.artifact.extensionId !== extensionId
          || receipt.artifact.sourceHash !== expected.sourceHash
          || receipt.artifact.contractVersion !== artifact.contractVersion
          || receipt.artifact.receiptId !== artifact.receiptId
          || receipt.receipt.projectId !== extensionId
          || receipt.receipt.projectRevision !== expected.revision
          || receipt.receipt.sourceHash !== expected.sourceHash
          || receipt.receipt.contractVersion !== artifact.contractVersion
          || receipt.receipt.receiptId !== artifact.receiptId
        ) return false;
        await repositories.settings.put(stateKey, persistenceJson({
          ...current,
          currentReceiptArtifactKey: artifact.artifactKey,
        }));
        const staleArtifactKeys = (await database.settings
          .where("key")
          .startsWith(browserIdeReceiptArtifactPrefix(extensionId))
          .primaryKeys())
          .filter((key) => key !== artifact.artifactKey);
        if (staleArtifactKeys.length) {
          await database.settings.bulkDelete(staleArtifactKeys);
        }
        return true;
      });
    },
    async reset(extensionId, rejectedToken) {
      const { database } = await getPersistenceContext();
      return database.transaction("rw", database.settings, async () => {
        const stateKey = browserIdeStateKey(extensionId);
        const current = await database.settings.get(stateKey);
        if (!current || persistenceRecordToken(current) !== rejectedToken) return false;
        await database.settings.delete(stateKey);
        const artifactKeys = await database.settings
          .where("key")
          .startsWith(browserIdeReceiptArtifactPrefix(extensionId))
          .primaryKeys();
        if (artifactKeys.length) await database.settings.bulkDelete(artifactKeys);
        return true;
      });
    },
  };
}

/**
 * App-owned React adapter for the framework-neutral editor port.
 */
export function createLatentCodeMirrorIdeEditor(
  events: LatentBrowserIdeHostEvents = {},
): BrowserIdeEditorAdapter<ReactElement> {
  return {
    adapterId: "latent-codemirror-v1",
    supports(file) {
      return file.loader === "js"
        || file.loader === "jsx"
        || file.loader === "ts"
        || file.loader === "tsx"
        || file.loader === "json";
    },
    render(model, actions) {
      return (
        <CodeEditor
          ariaLabel={`${model.file.title} editor`}
          onChange={(contents) => {
            actions.change(contents);
            events.onStateChange?.();
          }}
          onRun={() => {
            events.onStateChange?.();
            void actions.run().then((receipt) => {
              events.onReceipt?.(receipt);
            }).catch((error) => {
              events.onError?.(error);
            }).finally(() => {
              events.onStateChange?.();
            });
          }}
          onSave={() => {
            void actions.save().catch((error) => {
              events.onError?.(error);
            }).finally(() => {
              events.onStateChange?.();
            });
          }}
          path={model.file.path}
          readOnly={!model.file.editable || model.running}
          value={model.value}
        />
      );
    },
  };
}

export function createLatentBrowserIdeBindings(
  events: LatentBrowserIdeHostEvents = {},
  options: { runtime?: BrowserLabIdeRuntimeOptions } = {},
): BrowserIdeHostBindings<ReactElement> {
  return {
    editor: createLatentCodeMirrorIdeEditor(events),
    runtime: createBrowserLabIdeRuntime(options.runtime),
    persistence: createLatentBrowserIdePersistence(),
  };
}

/**
 * The supported application composition point for trusted Browser IDE
 * exercises. Extension source injects files and host-owned checks; platform
 * code injects CodeMirror, the hardened Browser Lab runtime, and persistence.
 */
export function createLatentBrowserIdeSession(
  definition: BrowserIdeExtensionDefinition,
  events: LatentBrowserIdeHostEvents = {},
  options: { runtime?: BrowserLabIdeRuntimeOptions } = {},
): BrowserIdeSession<ReactElement> {
  return createBrowserIdeSession(definition, createLatentBrowserIdeBindings(events, options));
}
