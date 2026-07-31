import {
  TRUSTED_INTERACTIVE_LIMITS,
  isBoundedTrustedInteractiveJson,
  isValidatedTrustedInteractiveBundle,
  trustedInteractiveBundleBytes,
  trustedInteractiveSourceBytes,
  type TrustedInteractiveBundleInput,
  type TrustedInteractiveJson,
  type ValidatedTrustedInteractiveBundle,
} from "@/app/features/trusted-interactives/contract";

export const TRUSTED_INTERACTIVE_FRAME_SANDBOX = "allow-scripts" as const;
export const TRUSTED_INTERACTIVE_HOST_GLOBAL = "Latent" as const;

const SAFE_CHANNEL_ID = /^[A-Za-z0-9._:-]{16,160}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_ERROR_CODE = /^[a-z][a-z0-9-]{0,95}$/;
const TRUSTED_INTERACTIVE_METHODS = Object.freeze(new Set([
  "context.get",
  "state.save",
  "events.record",
  "progress.request",
]));

export type TrustedInteractiveFrameInteraction = Readonly<{
  sequence: number;
  kind: "pointer" | "keyboard";
}>;

export type TrustedInteractiveFrameRequest = {
  schemaVersion: 1;
  type: "latent-interactive/request";
  requestId: string;
  method: string;
  payload: TrustedInteractiveJson;
  interaction: TrustedInteractiveFrameInteraction | null;
};

export type TrustedInteractiveFrameMessage =
  | {
      schemaVersion: 1;
      type: "latent-interactive/ready";
      id: string;
      sourceHash: string;
    }
  | {
      schemaVersion: 1;
      type: "latent-interactive/error";
      code: string;
      message: string;
      requestId?: string;
    }
  | TrustedInteractiveFrameRequest
  | {
      schemaVersion: 1;
      type: "latent-interactive/resize";
      height: number;
    }
  | {
      schemaVersion: 1;
      type: "latent-interactive/disposed";
    };

export type TrustedInteractiveHostMessage =
  | {
      schemaVersion: 1;
      type: "latent-interactive/load";
      channelId: string;
      bundle: TrustedInteractiveBundleInput;
    }
  | {
      schemaVersion: 1;
      type: "latent-interactive/response";
      requestId: string;
      ok: true;
      value: TrustedInteractiveJson;
    }
  | {
      schemaVersion: 1;
      type: "latent-interactive/response";
      requestId: string;
      ok: false;
      error: { code: string; message: string };
    }
  | {
      schemaVersion: 1;
      type: "latent-interactive/dispose";
    };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && SAFE_REQUEST_ID.test(value);
}

function isFrameInteraction(value: unknown): value is TrustedInteractiveFrameInteraction {
  return isPlainRecord(value)
    && Number.isSafeInteger(value.sequence)
    && (value.sequence as number) > 0
    && (value.kind === "pointer" || value.kind === "keyboard");
}

export function isTrustedInteractiveFrameMessage(
  value: unknown,
  allowedMethods: ReadonlySet<string> = TRUSTED_INTERACTIVE_METHODS,
): value is TrustedInteractiveFrameMessage {
  if (
    !isPlainRecord(value)
    || value.schemaVersion !== 1
    || typeof value.type !== "string"
    || !isBoundedTrustedInteractiveJson(value)
  ) return false;
  switch (value.type) {
    case "latent-interactive/ready":
      return typeof value.id === "string"
        && value.id.length <= 96
        && typeof value.sourceHash === "string"
        && /^sha256:[a-f0-9]{64}$/.test(value.sourceHash);
    case "latent-interactive/error":
      return typeof value.code === "string"
        && SAFE_ERROR_CODE.test(value.code)
        && typeof value.message === "string"
        && value.message.length <= 1_000
        && (value.requestId === undefined || isRequestId(value.requestId));
    case "latent-interactive/request":
      return isRequestId(value.requestId)
        && typeof value.method === "string"
        && allowedMethods.has(value.method)
        && isBoundedTrustedInteractiveJson(value.payload)
        && (value.interaction === null || isFrameInteraction(value.interaction));
    case "latent-interactive/resize":
      return typeof value.height === "number"
        && Number.isFinite(value.height)
        && value.height >= 0
        && value.height <= TRUSTED_INTERACTIVE_LIMITS.maxFrameHeight * 4;
    case "latent-interactive/disposed":
      return true;
    default:
      return false;
  }
}

export function isTrustedInteractiveHostMessage(
  value: unknown,
): value is TrustedInteractiveHostMessage {
  if (!isPlainRecord(value) || value.schemaVersion !== 1 || typeof value.type !== "string") return false;
  if (value.type === "latent-interactive/dispose") return true;
  if (value.type === "latent-interactive/load") {
    return typeof value.channelId === "string"
      && SAFE_CHANNEL_ID.test(value.channelId)
      && isPlainRecord(value.bundle)
      && isBoundedTrustedInteractiveJson(value, {
        maxBytes: TRUSTED_INTERACTIVE_LIMITS.maxTotalBundleBytes + 16_000,
        maxNodes: 8_000,
      });
  }
  if (value.type !== "latent-interactive/response" || !isRequestId(value.requestId)) return false;
  if (value.ok === true) {
    return isBoundedTrustedInteractiveJson(value.value, {
      maxBytes: TRUSTED_INTERACTIVE_LIMITS.maxHostResponseBytes,
      maxNodes: TRUSTED_INTERACTIVE_LIMITS.maxJsonNodes * 3,
    });
  }
  return value.ok === false
    && isPlainRecord(value.error)
    && typeof value.error.code === "string"
    && SAFE_ERROR_CODE.test(value.error.code)
    && typeof value.error.message === "string"
    && value.error.message.length <= 1_000;
}

export class TrustedInteractiveRequestGate {
  readonly #active = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
  readonly #allowedMethods: ReadonlySet<string>;
  readonly #timeoutMilliseconds: number;
  readonly #onExpire?: (requestId: string) => void;

  constructor(
    allowedMethods: ReadonlySet<string>,
    options: Readonly<{
      timeoutMilliseconds?: number;
      onExpire?: (requestId: string) => void;
    }> = {},
  ) {
    this.#allowedMethods = allowedMethods;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? 12_000;
    this.#onExpire = options.onExpire;
  }

  accept(message: TrustedInteractiveFrameRequest): boolean {
    if (
      !isTrustedInteractiveFrameMessage(message, this.#allowedMethods)
      || message.type !== "latent-interactive/request"
      || this.#active.has(message.requestId)
      || this.#active.size >= TRUSTED_INTERACTIVE_LIMITS.maxActiveRequests
    ) return false;
    const timer = globalThis.setTimeout(() => {
      if (!this.#active.delete(message.requestId)) return;
      this.#onExpire?.(message.requestId);
    }, this.#timeoutMilliseconds);
    this.#active.set(message.requestId, timer);
    return true;
  }

  settle(requestId: string): boolean {
    const timer = this.#active.get(requestId);
    if (!timer) return false;
    globalThis.clearTimeout(timer);
    return this.#active.delete(requestId);
  }

  has(requestId: string): boolean {
    return this.#active.has(requestId);
  }

  clear(): void {
    for (const timer of this.#active.values()) globalThis.clearTimeout(timer);
    this.#active.clear();
  }
}

/**
 * Fixed bootstrap only. Authored HTML, CSS, JavaScript, host input, and saved
 * state are transferred later through a private MessagePort.
 */
export const TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE = String.raw`(() => {
  "use strict";
  const LIMITS = {
    maxMessageBytes: 64000,
    maxHostResponseBytes: 160000,
    maxBundleBytes: 716800,
    maxActiveRequests: 12,
    maxHeight: 8000,
  };
  const encoder = new TextEncoder();
  const createObjectURL = URL.createObjectURL.bind(URL);
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  const activeUrls = new Set();
  const pending = new Map();
  let port = null;
  let connected = false;
  let loaded = false;
  let disposed = false;
  let channelId = "";
  let sequence = 0;
  let interactionSequence = 0;
  let latestInteraction = null;
  let sessionPromise = null;
  let resizeObserver = null;
  let mutationObserver = null;
  const byteLength = (value) => encoder.encode(value).byteLength;
  const bounded = (value, maximum = LIMITS.maxMessageBytes) => {
    try { return byteLength(JSON.stringify(value)) <= maximum; } catch { return false; }
  };
  const requestIdOk = (value) => typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
  const send = (message) => { if (port && bounded(message)) port.postMessage(message); };
  const report = (code, error, requestId) => send({
    schemaVersion: 1,
    type: "latent-interactive/error",
    code,
    message: String(error && error.message ? error.message : error).slice(0, 1000),
    ...(requestIdOk(requestId) ? { requestId } : {}),
  });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  };
  const hash = async (text) => {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
    return "sha256:" + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const sourceBytes = (bundle) => JSON.stringify({
    schemaVersion: bundle.schemaVersion,
    id: bundle.id,
    definitionVersion: bundle.definitionVersion,
    stateSchemaVersion: bundle.stateSchemaVersion,
    html: bundle.html,
    css: bundle.css,
    javascript: bundle.javascript,
  });
  const bundleBytes = (bundle) => JSON.stringify({
    schemaVersion: bundle.schemaVersion,
    runtimeVersion: bundle.runtimeVersion,
    id: bundle.id,
    definitionVersion: bundle.definitionVersion,
    stateSchemaVersion: bundle.stateSchemaVersion,
    html: bundle.html,
    css: bundle.css,
    javascript: bundle.javascript,
    visualCss: bundle.visualCss,
    sourceHash: bundle.sourceHash,
  });
  const bundleOk = (bundle) => Boolean(
    bundle
    && bundle.schemaVersion === 1
    && bundle.runtimeVersion === 1
    && typeof bundle.id === "string"
    && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(bundle.id)
    && Number.isSafeInteger(bundle.definitionVersion)
    && bundle.definitionVersion > 0
    && Number.isSafeInteger(bundle.stateSchemaVersion)
    && bundle.stateSchemaVersion > 0
    && typeof bundle.html === "string"
    && typeof bundle.css === "string"
    && typeof bundle.javascript === "string"
    && typeof bundle.visualCss === "string"
    && /^sha256:[a-f0-9]{64}$/.test(bundle.sourceHash)
    && /^sha256:[a-f0-9]{64}$/.test(bundle.bundleHash)
    && bounded(bundle, LIMITS.maxBundleBytes)
  );
  const rememberInteraction = (kind, event) => {
    if (!event.isTrusted || disposed) return;
    interactionSequence += 1;
    latestInteraction = Object.freeze({ sequence: interactionSequence, kind });
  };
  addEventListener("pointerup", (event) => rememberInteraction("pointer", event), true);
  addEventListener("keydown", (event) => rememberInteraction("keyboard", event), true);
  const captureInteraction = () => latestInteraction ? { ...latestInteraction } : null;
  const request = (method, payload = null, interaction = captureInteraction()) => {
    if (!port || !loaded || disposed) return Promise.reject(new Error("The interactive is not ready."));
    if (!/^(?:context\.get|state\.save|events\.record|progress\.request)$/.test(method) || !bounded(payload) || pending.size >= LIMITS.maxActiveRequests) {
      return Promise.reject(new Error("The interactive request is not allowed."));
    }
    const requestId = "interactive:" + (++sequence).toString(36) + ":" + Date.now().toString(36);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("The interactive host request timed out."));
      }, 10000);
      pending.set(requestId, { resolve, reject, timeout });
      port.postMessage({
        schemaVersion: 1,
        type: "latent-interactive/request",
        requestId,
        method,
        payload,
        interaction,
      });
    });
  };
  const connectApi = () => {
    if (sessionPromise) return sessionPromise;
    sessionPromise = request("context.get", null).then((context) => {
      if (!context || !bounded(context, LIMITS.maxHostResponseBytes) || !Number.isSafeInteger(context.revision) || context.revision < 0) {
        throw new Error("The interactive host returned invalid context.");
      }
      let state = clone(context.state);
      let revision = context.revision;
      let saveQueue = Promise.resolve();
      const session = {
        get state() { return clone(state); },
        input: freeze(clone(context.input)),
        visual: freeze(clone(context.visual)),
        identity: freeze(clone(context.identity)),
        storage: context.storage,
        saveState(nextState) {
          const candidate = clone(nextState);
          const interaction = captureInteraction();
          if (!bounded(candidate, 32000)) return Promise.reject(new Error("Interactive state is too large."));
          const operation = saveQueue.catch(() => undefined).then(() =>
            request("state.save", { state: candidate, revision }, interaction)
          ).then((result) => {
            if (!result || !Number.isSafeInteger(result.revision) || result.revision < revision) {
              throw new Error("The interactive host returned an invalid state revision.");
            }
            revision = result.revision;
            state = candidate;
            return clone(state);
          });
          saveQueue = operation;
          return operation;
        },
        record(event, payload = null) {
          return request("events.record", { event, payload });
        },
        requestCompletion(checkpointId, payload = null) {
          const interaction = captureInteraction();
          return saveQueue.catch(() => undefined).then(() =>
            request("progress.request", { checkpointId, payload }, interaction)
          );
        },
      };
      return Object.freeze(session);
    });
    return sessionPromise;
  };
  Object.defineProperty(globalThis, "Latent", {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ connect: connectApi }),
    writable: false,
  });
  const resize = () => {
    const height = Math.min(LIMITS.maxHeight, Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0,
    ));
    send({ schemaVersion: 1, type: "latent-interactive/resize", height });
  };
  const observeSize = () => {
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(document.documentElement);
      if (document.body) resizeObserver.observe(document.body);
    } else {
      mutationObserver = new MutationObserver(resize);
      mutationObserver.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
      addEventListener("resize", resize, { passive: true });
    }
    requestAnimationFrame(resize);
  };
  const loadScript = (code) => new Promise((resolve, reject) => {
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
      reject(new Error("The trusted interactive JavaScript could not run."));
    };
    document.head.append(script);
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (resizeObserver) resizeObserver.disconnect();
    if (mutationObserver) mutationObserver.disconnect();
    for (const url of activeUrls) revokeObjectURL(url);
    activeUrls.clear();
    for (const item of pending.values()) {
      clearTimeout(item.timeout);
      item.reject(new Error("The interactive was closed."));
    }
    pending.clear();
    if (port) {
      port.postMessage({ schemaVersion: 1, type: "latent-interactive/disposed" });
      port.close();
    }
    port = null;
  };
  const receive = async ({ data }) => {
    if (disposed) return;
    if (!data || data.schemaVersion !== 1 || typeof data.type !== "string") return;
    if (data.type === "latent-interactive/dispose") return dispose();
    if (data.type === "latent-interactive/response" && requestIdOk(data.requestId)) {
      const item = pending.get(data.requestId);
      if (!item || !bounded(data, LIMITS.maxHostResponseBytes)) return;
      pending.delete(data.requestId);
      clearTimeout(item.timeout);
      if (data.ok === true) item.resolve(data.value);
      else item.reject(new Error(String(data.error && data.error.message || "The host request failed.").slice(0, 1000)));
      return;
    }
    if (data.type !== "latent-interactive/load" || loaded || data.channelId !== channelId || !bundleOk(data.bundle)) return;
    const bundle = data.bundle;
    try {
      if (await hash(sourceBytes(bundle)) !== bundle.sourceHash) throw new Error("The interactive source hash does not match.");
      if (await hash(bundleBytes(bundle)) !== bundle.bundleHash) throw new Error("The interactive bundle hash does not match.");
      const visualStyle = document.createElement("style");
      visualStyle.dataset.latentVisualContract = "1";
      visualStyle.textContent = bundle.visualCss;
      document.head.append(visualStyle);
      const authoredStyle = document.createElement("style");
      authoredStyle.dataset.latentInteractiveStyle = bundle.id;
      authoredStyle.textContent = bundle.css;
      document.head.append(authoredStyle);
      const root = document.getElementById("root");
      if (!root) throw new Error("The interactive root is missing.");
      root.innerHTML = bundle.html;
      loaded = true;
      observeSize();
      await loadScript(bundle.javascript);
      send({ schemaVersion: 1, type: "latent-interactive/ready", id: bundle.id, sourceHash: bundle.sourceHash });
      requestAnimationFrame(resize);
    } catch (error) {
      report("bundle-load", error);
    }
  };
  const connect = (event) => {
    const data = event.data;
    if (
      connected
      || event.source !== parent
      || !data
      || data.schemaVersion !== 1
      || data.type !== "latent-interactive/connect"
      || typeof data.channelId !== "string"
      || !/^[A-Za-z0-9._:-]{16,160}$/.test(data.channelId)
      || event.ports.length !== 1
    ) return;
    connected = true;
    channelId = data.channelId;
    port = event.ports[0];
    removeEventListener("message", connect);
    port.addEventListener("message", receive);
    port.start();
  };
  addEventListener("message", connect);
  addEventListener("pagehide", dispose, { once: true });
  addEventListener("error", (event) => report("runtime-error", event.error || event.message));
  addEventListener("unhandledrejection", (event) => report("unhandled-rejection", event.reason));
})();`;

/** Updated whenever TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE changes. */
export const TRUSTED_INTERACTIVE_BOOTSTRAP_SHA256 = "sha256-N+0dTnOYRGRy82rN3cwQLZGd/xT89k5QXWEQwDVlj0I=";

export function createTrustedInteractiveFrameSrcdoc(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${TRUSTED_INTERACTIVE_BOOTSTRAP_SHA256}' blob:; style-src 'unsafe-inline'; connect-src 'none'; img-src data: blob:; font-src 'none'; media-src data: blob:; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none'">
<title>Trusted lesson interactive</title>
</head>
<body>
<div id="root"></div>
<script>${TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE}</script>
</body>
</html>`;
}

export type TrustedInteractiveFrameSessionHandlers = {
  onReady?: (message: Extract<TrustedInteractiveFrameMessage, { type: "latent-interactive/ready" }>) => void;
  onError?: (message: Extract<TrustedInteractiveFrameMessage, { type: "latent-interactive/error" }>) => void;
  onResize?: (height: number) => void;
  onRequest?: (message: TrustedInteractiveFrameRequest) => void;
  onProtocolViolation?: (value: unknown) => void;
};

const trustedInteractiveFrameOwners = new WeakMap<
  HTMLIFrameElement,
  TrustedInteractiveFrameSession
>();

export class TrustedInteractiveFrameSession {
  readonly #iframe: HTMLIFrameElement;
  readonly #bundle: ValidatedTrustedInteractiveBundle;
  readonly #allowedMethods: ReadonlySet<string>;
  readonly #handlers: TrustedInteractiveFrameSessionHandlers;
  readonly #channelId: string;
  readonly #requests: TrustedInteractiveRequestGate;
  #port: MessagePort | null = null;
  #readyTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  #started = false;
  #disposed = false;

  constructor(input: {
    iframe: HTMLIFrameElement;
    bundle: ValidatedTrustedInteractiveBundle;
    allowedMethods: ReadonlySet<string>;
    handlers?: TrustedInteractiveFrameSessionHandlers;
    channelId?: string;
  }) {
    if (!isValidatedTrustedInteractiveBundle(input.bundle)) {
      throw new Error("Verify the trusted interactive bundle before mounting it.");
    }
    if (!input.allowedMethods.size || [...input.allowedMethods].some((method) => !TRUSTED_INTERACTIVE_METHODS.has(method))) {
      throw new Error("A trusted interactive frame needs an explicit supported method allowlist.");
    }
    this.#iframe = input.iframe;
    this.#bundle = input.bundle;
    this.#allowedMethods = input.allowedMethods;
    this.#handlers = input.handlers ?? {};
    this.#channelId = input.channelId ?? `interactive:${crypto.randomUUID()}`;
    if (!SAFE_CHANNEL_ID.test(this.#channelId)) throw new Error("The trusted interactive channel id is invalid.");
    this.#requests = new TrustedInteractiveRequestGate(this.#allowedMethods);
  }

  readonly #connect = () => {
    if (this.#disposed || this.#port) return;
    const target = this.#iframe.contentWindow;
    if (!target) {
      this.#handlers.onError?.({
        schemaVersion: 1,
        type: "latent-interactive/error",
        code: "missing-frame",
        message: "The trusted interactive frame is unavailable.",
      });
      return;
    }
    const channel = new MessageChannel();
    this.#port = channel.port1;
    channel.port1.addEventListener("message", this.#receive);
    channel.port1.start();
    target.postMessage({
      schemaVersion: 1,
      type: "latent-interactive/connect",
      channelId: this.#channelId,
    }, "*", [channel.port2]);
    this.#post({
      schemaVersion: 1,
      type: "latent-interactive/load",
      channelId: this.#channelId,
      bundle: this.#bundle,
    });
    queueMicrotask(() => {
      if (!this.#disposed) this.#iframe.addEventListener("load", this.#detectNavigation);
    });
  };

  readonly #detectNavigation = () => {
    if (this.#disposed) return;
    this.#handlers.onError?.({
      schemaVersion: 1,
      type: "latent-interactive/error",
      code: "navigation-blocked",
      message: "The trusted interactive tried to navigate away from its reviewed source.",
    });
    this.dispose();
  };

  readonly #receive = ({ data }: MessageEvent<unknown>) => {
    if (this.#disposed) return;
    if (!isTrustedInteractiveFrameMessage(data, this.#allowedMethods)) {
      this.#handlers.onProtocolViolation?.(data);
      return;
    }
    if (data.type === "latent-interactive/request") {
      if (this.#requests.accept(data)) this.#handlers.onRequest?.(data);
      else this.#handlers.onProtocolViolation?.(data);
      return;
    }
    if (data.type === "latent-interactive/ready") {
      if (this.#readyTimer) globalThis.clearTimeout(this.#readyTimer);
      this.#readyTimer = null;
      this.#handlers.onReady?.(data);
    } else if (data.type === "latent-interactive/error") {
      this.#handlers.onError?.(data);
    } else if (data.type === "latent-interactive/resize") {
      this.#handlers.onResize?.(data.height);
    } else if (data.type === "latent-interactive/disposed") {
      this.#handlers.onError?.({
        schemaVersion: 1,
        type: "latent-interactive/error",
        code: "navigation-blocked",
        message: "The trusted interactive tried to navigate away from its reviewed source.",
      });
      this.dispose();
    }
  };

  #post(message: TrustedInteractiveHostMessage): void {
    if (!this.#port || !isTrustedInteractiveHostMessage(message)) {
      throw new Error("The trusted interactive host tried to send an invalid message.");
    }
    this.#port.postMessage(message);
  }

  start(): this {
    if (this.#started) throw new Error("The trusted interactive frame has already started.");
    if (this.#disposed) throw new Error("A disposed trusted interactive frame cannot start.");
    this.#started = true;
    const previousOwner = trustedInteractiveFrameOwners.get(this.#iframe);
    if (previousOwner && previousOwner !== this) previousOwner.dispose();
    trustedInteractiveFrameOwners.set(this.#iframe, this);
    this.#iframe.setAttribute("sandbox", TRUSTED_INTERACTIVE_FRAME_SANDBOX);
    this.#iframe.setAttribute("referrerpolicy", "no-referrer");
    this.#iframe.addEventListener("load", this.#connect, { once: true });
    this.#readyTimer = globalThis.setTimeout(() => {
      if (this.#disposed) return;
      this.#handlers.onError?.({
        schemaVersion: 1,
        type: "latent-interactive/error",
        code: "ready-timeout",
        message: "The trusted interactive did not become ready in time.",
      });
    }, 10_000);
    this.#iframe.srcdoc = createTrustedInteractiveFrameSrcdoc();
    return this;
  }

  respond(requestId: string, value: TrustedInteractiveJson): void {
    if (
      this.#disposed
      || !this.#requests.has(requestId)
      || !isBoundedTrustedInteractiveJson(value, {
        maxBytes: TRUSTED_INTERACTIVE_LIMITS.maxHostResponseBytes,
        maxNodes: TRUSTED_INTERACTIVE_LIMITS.maxJsonNodes * 3,
      })
    ) {
      throw new Error("The trusted interactive response is invalid or no longer active.");
    }
    this.#post({
      schemaVersion: 1,
      type: "latent-interactive/response",
      requestId,
      ok: true,
      value,
    });
    this.#requests.settle(requestId);
  }

  fail(requestId: string, code: string, message: string): void {
    if (this.#disposed || !this.#requests.has(requestId) || !SAFE_ERROR_CODE.test(code)) {
      throw new Error("The trusted interactive failure is invalid or no longer active.");
    }
    this.#post({
      schemaVersion: 1,
      type: "latent-interactive/response",
      requestId,
      ok: false,
      error: { code, message: message.slice(0, 1_000) },
    });
    this.#requests.settle(requestId);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#iframe.removeEventListener("load", this.#connect);
    this.#iframe.removeEventListener("load", this.#detectNavigation);
    if (this.#readyTimer) globalThis.clearTimeout(this.#readyTimer);
    this.#readyTimer = null;
    if (this.#port) {
      try {
        this.#post({ schemaVersion: 1, type: "latent-interactive/dispose" });
      } catch {
        // The port may already be gone after a frame-side navigation.
      }
    }
    this.#finishDisposal();
  }

  #finishDisposal(): void {
    this.#disposed = true;
    this.#requests.clear();
    if (this.#port) {
      this.#port.removeEventListener("message", this.#receive);
      this.#port.close();
      this.#port = null;
    }
    this.#iframe.removeEventListener("load", this.#connect);
    this.#iframe.removeEventListener("load", this.#detectNavigation);
    if (trustedInteractiveFrameOwners.get(this.#iframe) === this) {
      trustedInteractiveFrameOwners.delete(this.#iframe);
      this.#iframe.removeAttribute("srcdoc");
      this.#iframe.src = "about:blank";
    }
  }
}

export function mountTrustedInteractiveFrame(
  input: ConstructorParameters<typeof TrustedInteractiveFrameSession>[0],
): TrustedInteractiveFrameSession {
  return new TrustedInteractiveFrameSession(input).start();
}

export const trustedInteractiveCanonicalizers = Object.freeze({
  source: trustedInteractiveSourceBytes,
  bundle: trustedInteractiveBundleBytes,
});
