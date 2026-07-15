import {
  assertVirtualPath,
  hashText,
  isSourceHash,
  type SourceHash,
} from "@latent/browser-lab";

export const PREVIEW_FRAME_SANDBOX = "allow-scripts" as const;
export const PREVIEW_REACT_RUNTIME_PATH = "/capstone-react-runtime.js" as const;
export const PREVIEW_HOST_GLOBAL = "__LATENT_PREVIEW_HOST__" as const;

export type PreviewJson =
  | null
  | boolean
  | number
  | string
  | PreviewJson[]
  | { [key: string]: PreviewJson };

export type PreviewFrameLimits = {
  maxBundleBytes: number;
  maxMessageBytes: number;
  maxRequestIdLength: number;
  maxMethodLength: number;
  maxEventLength: number;
  maxActiveRequests: number;
  maxJsonDepth: number;
  maxJsonNodes: number;
};

export const DEFAULT_PREVIEW_FRAME_LIMITS: Readonly<PreviewFrameLimits> = Object.freeze({
  maxBundleBytes: 2_000_000,
  maxMessageBytes: 64_000,
  maxRequestIdLength: 128,
  maxMethodLength: 96,
  maxEventLength: 96,
  maxActiveRequests: 16,
  maxJsonDepth: 24,
  maxJsonNodes: 10_000,
});

const VALIDATED_PREVIEW_BUNDLE = Symbol("validated-preview-bundle");
const VALIDATED_PREVIEW_RUNTIME = Symbol("validated-preview-runtime");
const SAFE_CHANNEL_ID = /^[A-Za-z0-9._:-]{16,160}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;
const SAFE_METHOD = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const SAFE_EVENT = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const MAX_IDENTITY_LENGTH = 160;
const MAX_ERROR_LENGTH = 1_000;

type ValidatedBundleBrand = {
  readonly [VALIDATED_PREVIEW_BUNDLE]: true;
};

export type PreviewBundleInput = {
  projectId: string;
  buildId: string;
  buildNumber: number;
  projectRevision: number;
  sourceHash: SourceHash;
  entryPath: string;
  code: string;
  codeHash: SourceHash;
};

export type ValidatedPreviewBundle = Readonly<PreviewBundleInput> & ValidatedBundleBrand;

type ValidatedRuntimeBrand = {
  readonly [VALIDATED_PREVIEW_RUNTIME]: true;
};

export type PreviewRuntimeInput = {
  code: string;
  codeHash: SourceHash;
};

export type ValidatedPreviewRuntime = Readonly<PreviewRuntimeInput> & ValidatedRuntimeBrand;

export type PreviewConnectMessage = {
  schemaVersion: 1;
  type: "latent-preview/connect";
  channelId: string;
};

export type PreviewLoadMessage = {
  schemaVersion: 1;
  type: "latent-preview/load";
  channelId: string;
  runtime: PreviewRuntimeInput;
  bundle: PreviewBundleInput;
};

export type PreviewReadyMessage = {
  schemaVersion: 1;
  type: "latent-preview/ready";
  buildId: string;
};

export type PreviewErrorMessage = {
  schemaVersion: 1;
  type: "latent-preview/error";
  code: string;
  message: string;
  requestId?: string;
};

export type PreviewRequestMessage = {
  schemaVersion: 1;
  type: "latent-preview/request";
  requestId: string;
  method: string;
  payload: PreviewJson;
};

export type PreviewResponseMessage =
  | {
      schemaVersion: 1;
      type: "latent-preview/response";
      requestId: string;
      ok: true;
      value: PreviewJson;
    }
  | {
      schemaVersion: 1;
      type: "latent-preview/response";
      requestId: string;
      ok: false;
      error: { code: string; message: string };
    };

export type PreviewEventMessage = {
  schemaVersion: 1;
  type: "latent-preview/event";
  requestId: string;
  event: string;
  payload: PreviewJson;
};

export type PreviewDisposeMessage = {
  schemaVersion: 1;
  type: "latent-preview/dispose";
};

export type PreviewDisposedMessage = {
  schemaVersion: 1;
  type: "latent-preview/disposed";
};

export type PreviewFrameMessage =
  | PreviewReadyMessage
  | PreviewErrorMessage
  | PreviewRequestMessage
  | PreviewDisposedMessage;

export type PreviewHostMessage =
  | PreviewLoadMessage
  | PreviewResponseMessage
  | PreviewEventMessage
  | PreviewDisposeMessage;

export class PreviewFrameError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "PreviewFrameError";
  }
}

function limitsWith(overrides: Partial<PreviewFrameLimits> = {}): PreviewFrameLimits {
  const limits = { ...DEFAULT_PREVIEW_FRAME_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new PreviewFrameError("INVALID_LIMITS", `${name} has to be a positive safe integer.`);
    }
  }
  return limits;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTITY_LENGTH;
}

function safeRequestId(value: unknown, limits: PreviewFrameLimits): value is string {
  return typeof value === "string"
    && value.length <= limits.maxRequestIdLength
    && SAFE_REQUEST_ID.test(value);
}

function safeMethod(value: unknown, limits: PreviewFrameLimits): value is string {
  return typeof value === "string"
    && value.length <= limits.maxMethodLength
    && SAFE_METHOD.test(value);
}

function safeEvent(value: unknown, limits: PreviewFrameLimits): value is string {
  return typeof value === "string"
    && value.length <= limits.maxEventLength
    && SAFE_EVENT.test(value);
}

function boundedSerializedBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? utf8Bytes(serialized) : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isBoundedPreviewJson(
  value: unknown,
  overrides: Partial<PreviewFrameLimits> = {},
): value is PreviewJson {
  const limits = limitsWith(overrides);
  let nodes = 0;
  const seen = new Set<object>();

  const visit = (candidate: unknown, depth: number): boolean => {
    nodes += 1;
    if (nodes > limits.maxJsonNodes || depth > limits.maxJsonDepth) return false;
    if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") return true;
    if (typeof candidate === "number") return Number.isFinite(candidate);
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return false;
    if (!Array.isArray(candidate) && !isRecord(candidate)) return false;
    seen.add(candidate);
    const valid = Array.isArray(candidate)
      ? candidate.every((entry) => visit(entry, depth + 1))
      : Object.entries(candidate).every(([key, entry]) => key.length <= 256 && visit(entry, depth + 1));
    seen.delete(candidate);
    return valid;
  };

  return visit(value, 0) && boundedSerializedBytes(value) <= limits.maxMessageBytes;
}

function assertBundleIdentity(input: PreviewBundleInput, limits: PreviewFrameLimits): void {
  if (!safeIdentity(input.projectId) || !safeIdentity(input.buildId)) {
    throw new PreviewFrameError("INVALID_BUNDLE", "The preview bundle needs project and build ids that fit the length limit.");
  }
  if (!Number.isSafeInteger(input.buildNumber) || input.buildNumber < 1
    || !Number.isSafeInteger(input.projectRevision) || input.projectRevision < 0) {
    throw new PreviewFrameError("INVALID_BUNDLE", "The preview bundle's build number or project revision isn't valid.");
  }
  if (!isSourceHash(input.sourceHash) || !isSourceHash(input.codeHash)) {
    throw new PreviewFrameError("INVALID_BUNDLE", "The preview bundle needs valid SHA-256 identities.");
  }
  try {
    assertVirtualPath(input.entryPath);
  } catch {
    throw new PreviewFrameError("INVALID_BUNDLE", "The preview bundle entry path isn't a safe virtual path.");
  }
  if (!input.entryPath.endsWith(".js") && !input.entryPath.endsWith(".jsx")
    && !input.entryPath.endsWith(".ts") && !input.entryPath.endsWith(".tsx")) {
    throw new PreviewFrameError("INVALID_BUNDLE", "The preview bundle entry path doesn't point to runnable source code.");
  }
  if (!input.code.trim() || utf8Bytes(input.code) > limits.maxBundleBytes) {
    throw new PreviewFrameError("BUNDLE_TOO_LARGE", `The preview bundle must contain at most ${limits.maxBundleBytes} UTF-8 bytes.`);
  }
}

export async function verifyPreviewBundle(
  input: PreviewBundleInput,
  overrides: Partial<PreviewFrameLimits> = {},
): Promise<ValidatedPreviewBundle> {
  const limits = limitsWith(overrides);
  assertBundleIdentity(input, limits);
  if (await hashText(input.code) !== input.codeHash) {
    throw new PreviewFrameError("BUNDLE_HASH_MISMATCH", "The preview bundle doesn't match its compiler hash.");
  }
  return Object.freeze({ ...input, [VALIDATED_PREVIEW_BUNDLE]: true as const });
}

export async function verifyPreviewRuntime(
  code: string,
  overrides: Partial<PreviewFrameLimits> = {},
): Promise<ValidatedPreviewRuntime> {
  const limits = limitsWith(overrides);
  if (!code.trim() || utf8Bytes(code) > limits.maxBundleBytes) {
    throw new PreviewFrameError("RUNTIME_TOO_LARGE", `The preview runtime must contain at most ${limits.maxBundleBytes} UTF-8 bytes.`);
  }
  return Object.freeze({
    code,
    codeHash: await hashText(code),
    [VALIDATED_PREVIEW_RUNTIME]: true as const,
  });
}

export function isValidatedPreviewBundle(value: unknown): value is ValidatedPreviewBundle {
  return Boolean(value && typeof value === "object"
    && (value as Partial<ValidatedBundleBrand>)[VALIDATED_PREVIEW_BUNDLE] === true);
}

export function isValidatedPreviewRuntime(value: unknown): value is ValidatedPreviewRuntime {
  return Boolean(value && typeof value === "object"
    && (value as Partial<ValidatedRuntimeBrand>)[VALIDATED_PREVIEW_RUNTIME] === true);
}

function hasMessageBase(value: unknown, type: string): value is Record<string, unknown> {
  return isRecord(value) && value.schemaVersion === 1 && value.type === type;
}

export function isPreviewConnectMessage(value: unknown): value is PreviewConnectMessage {
  return hasMessageBase(value, "latent-preview/connect")
    && typeof value.channelId === "string"
    && SAFE_CHANNEL_ID.test(value.channelId);
}

export function isPreviewFrameMessage(
  value: unknown,
  overrides: Partial<PreviewFrameLimits> = {},
  allowedMethods?: ReadonlySet<string>,
): value is PreviewFrameMessage {
  const limits = limitsWith(overrides);
  if (boundedSerializedBytes(value) > limits.maxMessageBytes || !isRecord(value) || value.schemaVersion !== 1) return false;
  if (value.type === "latent-preview/ready") return safeIdentity(value.buildId);
  if (value.type === "latent-preview/disposed") return true;
  if (value.type === "latent-preview/error") {
    return typeof value.code === "string" && SAFE_EVENT.test(value.code)
      && typeof value.message === "string" && value.message.length <= MAX_ERROR_LENGTH
      && (value.requestId === undefined || safeRequestId(value.requestId, limits));
  }
  if (value.type === "latent-preview/request") {
    return safeRequestId(value.requestId, limits)
      && safeMethod(value.method, limits)
      && (!allowedMethods || allowedMethods.has(value.method))
      && isBoundedPreviewJson(value.payload, limits);
  }
  return false;
}

function isPreviewBundleInput(value: unknown, limits: PreviewFrameLimits): value is PreviewBundleInput {
  if (!isRecord(value)) return false;
  try {
    assertBundleIdentity(value as PreviewBundleInput, limits);
    return true;
  } catch {
    return false;
  }
}

function isPreviewRuntimeInput(value: unknown, limits: PreviewFrameLimits): value is PreviewRuntimeInput {
  return isRecord(value)
    && typeof value.code === "string"
    && value.code.trim().length > 0
    && utf8Bytes(value.code) <= limits.maxBundleBytes
    && isSourceHash(value.codeHash);
}

export function isPreviewHostMessage(
  value: unknown,
  overrides: Partial<PreviewFrameLimits> = {},
): value is PreviewHostMessage {
  const limits = limitsWith(overrides);
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (value.type === "latent-preview/load") {
    return typeof value.channelId === "string" && SAFE_CHANNEL_ID.test(value.channelId)
      && isPreviewRuntimeInput(value.runtime, limits)
      && isPreviewBundleInput(value.bundle, limits);
  }
  if (boundedSerializedBytes(value) > limits.maxMessageBytes) return false;
  if (value.type === "latent-preview/dispose") return true;
  if (value.type === "latent-preview/event") {
    return safeRequestId(value.requestId, limits)
      && safeEvent(value.event, limits)
      && isBoundedPreviewJson(value.payload, limits);
  }
  if (value.type === "latent-preview/response" && safeRequestId(value.requestId, limits)) {
    if (value.ok === true) return isBoundedPreviewJson(value.value, limits);
    return value.ok === false && isRecord(value.error)
      && typeof value.error.code === "string" && SAFE_EVENT.test(value.error.code)
      && typeof value.error.message === "string" && value.error.message.length <= MAX_ERROR_LENGTH;
  }
  return false;
}

export class PreviewRequestGate {
  readonly #active = new Set<string>();
  readonly #limits: PreviewFrameLimits;
  readonly #allowedMethods?: ReadonlySet<string>;

  constructor(options: {
    limits?: Partial<PreviewFrameLimits>;
    allowedMethods?: ReadonlySet<string>;
  } = {}) {
    this.#limits = limitsWith(options.limits);
    this.#allowedMethods = options.allowedMethods;
  }

  accept(value: unknown): value is PreviewRequestMessage {
    if (!isPreviewFrameMessage(value, this.#limits, this.#allowedMethods)
      || value.type !== "latent-preview/request"
      || this.#active.has(value.requestId)
      || this.#active.size >= this.#limits.maxActiveRequests) return false;
    this.#active.add(value.requestId);
    return true;
  }

  settle(requestId: string): boolean {
    return this.#active.delete(requestId);
  }

  has(requestId: string): boolean {
    return this.#active.has(requestId);
  }

  clear(): void {
    this.#active.clear();
  }

  get size(): number {
    return this.#active.size;
  }
}

/** Fixed, hash-authorized bootstrap. No learner or runtime bytes are interpolated. */
export const PREVIEW_BOOTSTRAP_SOURCE = String.raw`(() => {
  "use strict";
  const LIMITS = { maxBundleBytes: 2000000, maxMessageBytes: 64000, maxRequestIdLength: 128, maxMethodLength: 96, maxEventLength: 96, maxActiveRequests: 16 };
  const encoder = new TextEncoder();
  const createObjectURL = URL.createObjectURL.bind(URL);
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  const activeUrls = new Set();
  let connected = false;
  let loading = false;
  let loaded = false;
  let disposed = false;
  let port = null;
  let channelId = "";
  let sequence = 0;
  const pending = new Map();
  const byteLength = (value) => encoder.encode(value).byteLength;
  const bounded = (value, maximum = LIMITS.maxMessageBytes) => {
    try { return byteLength(JSON.stringify(value)) <= maximum; } catch { return false; }
  };
  const requestIdOk = (value) => typeof value === "string" && value.length > 0 && value.length <= LIMITS.maxRequestIdLength && /^[A-Za-z0-9._:-]+$/.test(value);
  const methodOk = (value) => typeof value === "string" && value.length <= LIMITS.maxMethodLength && /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(value);
  const eventOk = (value) => typeof value === "string" && value.length <= LIMITS.maxEventLength && /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(value);
  const send = (message) => { if (port && bounded(message)) port.postMessage(message); };
  const report = (code, error, requestId) => send({
    schemaVersion: 1,
    type: "latent-preview/error",
    code,
    message: String(error && error.message ? error.message : error).slice(0, 1000),
    ...(requestIdOk(requestId) ? { requestId } : {}),
  });
  const revokeAll = () => {
    for (const url of activeUrls) revokeObjectURL(url);
    activeUrls.clear();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    revokeAll();
    for (const item of pending.values()) item.reject(new Error("The preview was closed."));
    pending.clear();
    if (port) {
      port.postMessage({ schemaVersion: 1, type: "latent-preview/disposed" });
      port.close();
    }
    port = null;
  };
  const host = Object.freeze({
    request(method, payload = null, onEvent) {
      if (!port || !loaded || disposed) return Promise.reject(new Error("The preview isn't ready yet."));
      if (!methodOk(method) || !bounded(payload) || pending.size >= LIMITS.maxActiveRequests) {
        return Promise.reject(new Error("This preview request is too large or isn't allowed."));
      }
      const requestId = "frame:" + (++sequence).toString(36) + ":" + Date.now().toString(36);
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject, onEvent: typeof onEvent === "function" ? onEvent : null });
        port.postMessage({ schemaVersion: 1, type: "latent-preview/request", requestId, method, payload });
      });
    },
  });
  Object.defineProperty(globalThis, "__LATENT_PREVIEW_HOST__", { value: host, writable: false, configurable: false });

  const hash = async (code) => {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(code));
    return "sha256:" + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const validCode = (input) => Boolean(input && typeof input.code === "string" && input.code.trim() && byteLength(input.code) <= LIMITS.maxBundleBytes && /^sha256:[a-f0-9]{64}$/.test(input.codeHash));
  const loadScript = (code, label) => new Promise((resolve, reject) => {
    if (disposed) return reject(new Error("The preview was closed."));
    const url = createObjectURL(new Blob([code], { type: "text/javascript" }));
    activeUrls.add(url);
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => {
      revokeObjectURL(url);
      activeUrls.delete(url);
      resolve();
    };
    script.onerror = () => {
      revokeObjectURL(url);
      activeUrls.delete(url);
      reject(new Error(label + " couldn't run."));
    };
    document.head.append(script);
  });

  const receivePortMessage = async ({ data }) => {
    if (!data || data.schemaVersion !== 1 || typeof data.type !== "string") return;
    if (data.type === "latent-preview/dispose") return dispose();
    if (data.type === "latent-preview/response" && requestIdOk(data.requestId)) {
      const item = pending.get(data.requestId);
      if (!item || !bounded(data)) return;
      pending.delete(data.requestId);
      if (data.ok === true) item.resolve(data.value);
      else item.reject(new Error(String(data.error && data.error.message || "The preview request failed.").slice(0, 1000)));
      return;
    }
    if (data.type === "latent-preview/event" && requestIdOk(data.requestId) && eventOk(data.event) && bounded(data)) {
      const item = pending.get(data.requestId);
      if (item && item.onEvent) {
        try { item.onEvent(data.payload, data.event); } catch (error) { report("event-handler", error, data.requestId); }
      }
      return;
    }
    if (data.type !== "latent-preview/load" || loading || loaded || data.channelId !== channelId || !data.runtime || !data.bundle) return;
    loading = true;
    const runtime = data.runtime;
    const bundle = data.bundle;
    try {
      if (!validCode(runtime) || !validCode(bundle) || !bundle.buildId || !bundle.entryPath) {
        throw new Error("The preview received invalid files from the host.");
      }
      if (await hash(runtime.code) !== runtime.codeHash) throw new Error("The preview runtime hash doesn't match.");
      if (await hash(bundle.code) !== bundle.codeHash) throw new Error("The preview bundle hash doesn't match.");
      await loadScript(runtime.code, "The trusted React runtime");
      if (!globalThis.__LATENT_REACT__) throw new Error("The trusted React runtime didn't load its global adapter.");
      await loadScript(bundle.code, "The validated preview bundle");
      if (disposed) return;
      loaded = true;
      send({ schemaVersion: 1, type: "latent-preview/ready", buildId: bundle.buildId });
    } catch (error) {
      revokeAll();
      report("bundle-validation", error);
    } finally {
      loading = false;
    }
  };

  const connect = (event) => {
    const data = event.data;
    if (connected || event.source !== parent || !data || data.schemaVersion !== 1 || data.type !== "latent-preview/connect" || typeof data.channelId !== "string" || !/^[A-Za-z0-9._:-]{16,160}$/.test(data.channelId) || event.ports.length !== 1) return;
    connected = true;
    channelId = data.channelId;
    port = event.ports[0];
    window.removeEventListener("message", connect);
    port.addEventListener("message", receivePortMessage);
    port.start();
  };
  window.addEventListener("message", connect);
  window.addEventListener("pagehide", dispose, { once: true });
  window.addEventListener("error", (event) => report("runtime-error", event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => report("unhandled-rejection", event.reason));
})();`;

/** Updated only when the fixed bootstrap source changes. */
export const PREVIEW_BOOTSTRAP_SHA256 = "sha256-a9GHuFV/ttLSyIX5Il4XPn11l5DK3D4Xgq4MAESKgHU=";

/** Learner and React runtime bytes enter only through the transferred port. */
export function createPreviewFrameSrcdoc(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${PREVIEW_BOOTSTRAP_SHA256}' blob:; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'">
<title>Browser Chat preview</title>
</head>
<body>
<div id="root"></div>
<script>${PREVIEW_BOOTSTRAP_SOURCE}</script>
</body>
</html>`;
}

export type PreviewFrameSessionHandlers = {
  onPort?: (port: MessagePort) => void;
  onReady?: (message: PreviewReadyMessage) => void;
  onError?: (message: PreviewErrorMessage) => void;
  onRequest?: (message: PreviewRequestMessage) => void;
  onProtocolViolation?: (value: unknown) => void;
};

export class PreviewFrameSession {
  readonly #iframe: HTMLIFrameElement;
  readonly #bundle: ValidatedPreviewBundle;
  readonly #runtime: ValidatedPreviewRuntime;
  readonly #limits: PreviewFrameLimits;
  readonly #allowedMethods?: ReadonlySet<string>;
  readonly #handlers: PreviewFrameSessionHandlers;
  readonly #channelId: string;
  readonly #requests: PreviewRequestGate;
  #port: MessagePort | null = null;
  #started = false;
  #disposed = false;

  constructor(input: {
    iframe: HTMLIFrameElement;
    bundle: ValidatedPreviewBundle;
    runtime: ValidatedPreviewRuntime;
    allowedMethods?: ReadonlySet<string>;
    handlers?: PreviewFrameSessionHandlers;
    limits?: Partial<PreviewFrameLimits>;
    channelId?: string;
  }) {
    if (!isValidatedPreviewBundle(input.bundle)) {
      throw new PreviewFrameError("UNVALIDATED_BUNDLE", "Verify the preview bundle before you load it.");
    }
    if (!isValidatedPreviewRuntime(input.runtime)) {
      throw new PreviewFrameError("UNVALIDATED_RUNTIME", "Verify the React runtime before you load it.");
    }
    this.#iframe = input.iframe;
    this.#bundle = input.bundle;
    this.#runtime = input.runtime;
    this.#limits = limitsWith(input.limits);
    this.#allowedMethods = input.allowedMethods;
    this.#handlers = input.handlers ?? {};
    this.#channelId = input.channelId ?? `preview:${crypto.randomUUID()}`;
    if (!SAFE_CHANNEL_ID.test(this.#channelId)) throw new PreviewFrameError("INVALID_CHANNEL", "The preview channel id isn't valid.");
    this.#requests = new PreviewRequestGate({ limits: this.#limits, allowedMethods: this.#allowedMethods });
  }

  readonly #connect = () => {
    if (this.#disposed || this.#port) return;
    const target = this.#iframe.contentWindow;
    if (!target) {
      this.#handlers.onError?.({ schemaVersion: 1, type: "latent-preview/error", code: "missing-frame", message: "The preview window isn't available." });
      return;
    }
    const channel = new MessageChannel();
    this.#port = channel.port1;
    channel.port1.addEventListener("message", this.#receive);
    channel.port1.start();
    this.#handlers.onPort?.(channel.port1);
    const connect: PreviewConnectMessage = { schemaVersion: 1, type: "latent-preview/connect", channelId: this.#channelId };
    target.postMessage(connect, "*", [channel.port2]);
    this.#post({
      schemaVersion: 1,
      type: "latent-preview/load",
      channelId: this.#channelId,
      runtime: this.#runtime,
      bundle: this.#bundle,
    });
  };

  readonly #receive = ({ data }: MessageEvent<unknown>) => {
    if (!isPreviewFrameMessage(data, this.#limits, this.#allowedMethods)) {
      this.#handlers.onProtocolViolation?.(data);
      return;
    }
    if (data.type === "latent-preview/request") {
      if (this.#requests.accept(data)) this.#handlers.onRequest?.(data);
      else this.#handlers.onProtocolViolation?.(data);
      return;
    }
    if (data.type === "latent-preview/ready") this.#handlers.onReady?.(data);
    else if (data.type === "latent-preview/error") this.#handlers.onError?.(data);
    else if (data.type === "latent-preview/disposed") this.#finishDisposal();
  };

  #post(message: PreviewHostMessage): void {
    if (!this.#port || !isPreviewHostMessage(message, this.#limits)) {
      throw new PreviewFrameError("INVALID_HOST_MESSAGE", "This host message is too large or doesn't match the preview protocol.");
    }
    this.#port.postMessage(message);
  }

  start(): this {
    if (this.#started) throw new PreviewFrameError("SESSION_ALREADY_STARTED", "The preview session is already running.");
    if (this.#disposed) throw new PreviewFrameError("SESSION_DISPOSED", "A closed preview session can't start.");
    this.#started = true;
    this.#iframe.setAttribute("sandbox", PREVIEW_FRAME_SANDBOX);
    this.#iframe.setAttribute("referrerpolicy", "no-referrer");
    if (!this.#iframe.title) this.#iframe.title = "Browser Chat preview";
    this.#iframe.addEventListener("load", this.#connect, { once: true });
    this.#iframe.srcdoc = createPreviewFrameSrcdoc();
    return this;
  }

  respond(requestId: string, value: PreviewJson): void {
    if (!this.#requests.has(requestId)) throw new PreviewFrameError("UNKNOWN_REQUEST", "This response isn't tied to an active preview request.");
    const message: PreviewResponseMessage = { schemaVersion: 1, type: "latent-preview/response", requestId, ok: true, value };
    this.#post(message);
    this.#requests.settle(requestId);
  }

  fail(requestId: string, code: string, message: string): void {
    if (!this.#requests.has(requestId)) throw new PreviewFrameError("UNKNOWN_REQUEST", "This error isn't tied to an active preview request.");
    const response: PreviewResponseMessage = {
      schemaVersion: 1,
      type: "latent-preview/response",
      requestId,
      ok: false,
      error: { code, message: message.slice(0, MAX_ERROR_LENGTH) },
    };
    this.#post(response);
    this.#requests.settle(requestId);
  }

  emit(requestId: string, event: string, payload: PreviewJson): void {
    if (!this.#requests.has(requestId)) throw new PreviewFrameError("UNKNOWN_REQUEST", "This event isn't tied to an active preview request.");
    this.#post({ schemaVersion: 1, type: "latent-preview/event", requestId, event, payload });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#iframe.removeEventListener("load", this.#connect);
    if (this.#port) {
      try { this.#post({ schemaVersion: 1, type: "latent-preview/dispose" }); } catch { this.#finishDisposal(); }
      globalThis.setTimeout(() => this.#finishDisposal(), 100);
    } else {
      this.#finishDisposal();
    }
  }

  #finishDisposal(): void {
    this.#requests.clear();
    if (this.#port) {
      this.#port.removeEventListener("message", this.#receive);
      this.#port.close();
      this.#port = null;
    }
    this.#iframe.removeAttribute("srcdoc");
    this.#iframe.src = "about:blank";
  }
}

export function mountPreviewFrame(input: ConstructorParameters<typeof PreviewFrameSession>[0]): PreviewFrameSession {
  return new PreviewFrameSession(input).start();
}
