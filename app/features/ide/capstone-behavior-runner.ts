"use client";

import {
  CAPSTONE_BEHAVIOR_COMPONENT_PATH,
  CAPSTONE_BEHAVIOR_CONTRACT_ID,
  CAPSTONE_BEHAVIOR_CONTRACT_LABEL,
} from "../../lib/capstone-behavior-contract";
import {
  BrowserLabWorkerClient,
  DEFAULT_SANDBOX_LIMITS,
  type BrowserLabWorkerPort,
  type CompiledProgram,
  type ExerciseContract,
} from "@latent/browser-lab";
import type { ProjectUnitResult } from "../../lib/project-workspace";

const CAPSTONE_BEHAVIOR_FRAME_TIMEOUT_MS = 12_000;
const MAX_BEHAVIOR_ASSET_BYTES = 2_000_000;
const CAPSTONE_PREFLIGHT_MODULE_PATH = "capstone/behavior-preflight.js";
const CAPSTONE_PREFLIGHT_GLOBAL_NAME = "__latentCapstoneBehaviorPreflight";
const CAPSTONE_PREFLIGHT_CONTRACT_VERSION = "capstone-behavior-preflight-v1";

/**
 * A deliberately small React/DOM probe used only inside the capability-free
 * QuickJS worker. It renders the compiled entry, runs initial effects, and
 * samples rendered event handlers so obvious synchronous loops or recursion
 * are rejected before any learner JavaScript reaches the browser renderer.
 * The real iframe remains the source of DOM and accessibility evidence.
 */
export const CAPSTONE_PREFLIGHT_SOURCE = String.raw`(() => {
  "use strict";
  const effects = [];
  const handlers = [];
  let visited = 0;
  const node = () => ({
    dataset: {},
    appendChild() {},
    querySelector() { return null; },
  });
  const document = {
    head: node(),
    querySelector() { return null; },
    createElement() { return node(); },
    getElementById(id) { return id === "root" ? node() : null; },
  };
  const event = {
    key: "Enter",
    shiftKey: false,
    currentTarget: { value: "preflight", scrollHeight: 1, scrollTop: 0, clientHeight: 1 },
    preventDefault() {},
  };
  const walk = (element) => {
    visited += 1;
    if (visited > 5000) throw new Error("The render tree exceeded the bounded preflight node budget.");
    if (element === null || element === undefined || typeof element === "boolean" || typeof element === "string" || typeof element === "number") return;
    if (Array.isArray(element)) {
      for (const child of element) walk(child);
      return;
    }
    if (!element || typeof element !== "object") return;
    if (typeof element.type === "function") {
      walk(element.type(element.props || {}));
      return;
    }
    const props = element.props || {};
    for (const [name, value] of Object.entries(props)) {
      if (/^on[A-Z]/.test(name) && typeof value === "function" && handlers.length < 100) handlers.push(value);
    }
    walk(props.children);
  };
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...(props || {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) },
  });
  const React = {
    createElement,
    Fragment: ({ children }) => children,
    StrictMode: ({ children }) => children,
    useEffect(effect) { effects.push(effect); },
    useMemo(factory) { return factory(); },
    useReducer(_reducer, initial, initialize) { return [initialize ? initialize(initial) : initial, () => {}]; },
    useRef(initial) { return { current: initial }; },
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => {}]; },
  };
  const createRoot = () => ({
    render(element) {
      walk(element);
      for (const effect of effects.slice(0, 100)) {
        try { effect(); } catch {}
      }
      for (const handler of handlers) {
        try { handler(event); } catch {}
      }
    },
    unmount() {},
  });
  const initialization = {
    buildId: "preflight",
    buildNumber: 1,
    selectedBackend: "local",
    studentReady: true,
    localReady: true,
    runtime: {
      model: { temperature: 0.72, topK: 24, maxTokens: 160 },
      transport: { wordsPerEvent: 1, delayMs: 0 },
      interface: { assistantName: "Preflight", responsePrefix: "", showMetrics: true },
    },
    conversation: null,
  };
  const host = { request(method) {
    if (method === "initialize") return Promise.resolve(initialization);
    if (method === "train-student" || method === "load-local") return Promise.resolve({ ready: true });
    return Promise.resolve(null);
  } };
  Object.defineProperties(globalThis, {
    document: { value: document, writable: false, configurable: false },
    window: { value: globalThis, writable: false, configurable: false },
    __LATENT_REACT__: { value: Object.freeze({ React, createRoot }), writable: false, configurable: false },
    __LATENT_PREVIEW_HOST__: { value: Object.freeze(host), writable: false, configurable: false },
  });
})();`;

export function createCapstoneBehaviorPreflightCode(bundleCode: string): string {
  return `${CAPSTONE_PREFLIGHT_SOURCE}\n${bundleCode}\nglobalThis.${CAPSTONE_PREFLIGHT_GLOBAL_NAME} = Object.freeze({ done: () => true });`;
}

export const CAPSTONE_BEHAVIOR_BOOTSTRAP_SOURCE = String.raw`(() => {
  "use strict";
  const MAX_BYTES = 2000000;
  const encoder = new TextEncoder();
  const nativeQuery = Document.prototype.querySelector;
  const nativeQueryAll = Document.prototype.querySelectorAll;
  const nativeText = Object.getOwnPropertyDescriptor(Node.prototype, "textContent").get;
  const nativeClick = HTMLElement.prototype.click;
  const nativeFocus = HTMLElement.prototype.focus;
  const nativeGetClientRects = Element.prototype.getClientRects;
  const nativeOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent").get;
  const nativeGetComputedStyle = globalThis.getComputedStyle.bind(globalThis);
  const nativeTextareaValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  const nativeDispatch = EventTarget.prototype.dispatchEvent;
  const NativeEvent = Event;
  const NativeSubmitEvent = SubmitEvent;
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
  const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const activeUrls = new Set();
  let started = false;
  let channelId = "";
  let generationCount = 0;
  const generations = [];
  const cancellations = [];
  const requestMethods = [];
  const renderFrames = { requested: 0, completed: 0, cancelled: 0 };
  const frameTimers = new Map();
  let nextFrameId = 1;
  let fixture = {
    selectedBackend: "student",
    assistantName: "Configured Tutor",
    responsePrefix: "[configured] ",
    showMetrics: true,
    persistFailures: 0,
    requirePreparation: false,
    preparationDelayMs: 0,
    transientRetry: false,
    invalidConversation: false,
  };
  let persistAttempts = 0;
  let prepared = true;

  // A deterministic frame clock makes render batching and cancellation
  // observable without granting the compiled project any extra capability.
  globalThis.requestAnimationFrame = (callback) => {
    const frameId = nextFrameId++;
    renderFrames.requested += 1;
    frameTimers.set(frameId, nativeSetTimeout(() => {
      frameTimers.delete(frameId);
      renderFrames.completed += 1;
      callback(performance.now());
    }, 32));
    return frameId;
  };
  globalThis.cancelAnimationFrame = (frameId) => {
    const timer = frameTimers.get(frameId);
    if (timer === undefined) return;
    nativeClearTimeout(timer);
    frameTimers.delete(frameId);
    renderFrames.cancelled += 1;
  };

  const query = (selector) => nativeQuery.call(document, selector);
  const queryAll = (selector) => Array.from(nativeQueryAll.call(document, selector));
  const text = (node) => node ? String(nativeText.call(node) || "").replace(/\s+/g, " ").trim() : "";
  const visible = (node) => {
    if (!(node instanceof Element)) return false;
    const style = nativeGetComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse"
      && Number(style.opacity || 1) > 0 && nativeGetClientRects.call(node).length > 0;
  };
  const focusable = (node) => Boolean(node instanceof HTMLElement && visible(node)
    && nativeOffsetParent.call(node) !== null && !node.hasAttribute("disabled") && node.tabIndex >= 0);
  const bytes = (value) => encoder.encode(value).byteLength;
  const delay = (milliseconds) => new Promise((resolve) => nativeSetTimeout(resolve, milliseconds));
  const waitFor = async (read, label, timeout = 2600) => {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      const value = read();
      if (value) return value;
      await delay(20);
    }
    throw new Error(label);
  };
  const digest = async (source) => {
    const value = await crypto.subtle.digest("SHA-256", encoder.encode(source));
    return "sha256:" + Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const validAsset = (asset) => Boolean(asset && typeof asset.code === "string" && asset.code.trim()
    && bytes(asset.code) <= MAX_BYTES && /^sha256:[a-f0-9]{64}$/.test(asset.codeHash));
  const loadScript = (source, label) => new Promise((resolve, reject) => {
    const url = nativeCreateObjectURL(new Blob([source], { type: "text/javascript" }));
    activeUrls.add(url);
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => {
      nativeRevokeObjectURL(url);
      activeUrls.delete(url);
      resolve();
    };
    script.onerror = () => {
      nativeRevokeObjectURL(url);
      activeUrls.delete(url);
      reject(new Error(label + " did not execute."));
    };
    document.head.append(script);
  });
  const generationEvent = (handler, value, milliseconds) => nativeSetTimeout(() => handler?.(value), milliseconds);
  const sse = (event, data) => "event: " + event + "\n" + "data: " + JSON.stringify(data) + "\n\n";

  const host = Object.freeze({
    request(method, payload, onEvent) {
      requestMethods.push(method);
      if (method === "initialize") {
        return Promise.resolve({
          buildId: "host-behavior-contract",
          buildNumber: 1,
          selectedBackend: fixture.selectedBackend,
          studentReady: fixture.selectedBackend === "student" ? prepared : true,
          localReady: fixture.selectedBackend === "local" ? prepared : true,
          runtime: {
            model: { temperature: 0.72, topK: 24, maxTokens: 160 },
            transport: { wordsPerEvent: 1, delayMs: 0 },
            interface: { assistantName: fixture.assistantName, responsePrefix: fixture.responsePrefix, showMetrics: fixture.showMetrics },
          },
          conversation: fixture.invalidConversation ? {
            version: 1,
            id: "active",
            messages: [{ id: "corrupt", role: "assistant", backend: fixture.selectedBackend, content: "partial", status: "streaming" }],
          } : null,
        });
      }
      if (method === "persist") {
        persistAttempts += 1;
        return persistAttempts <= fixture.persistFailures
          ? Promise.reject(new Error("Controlled persistence failure"))
          : Promise.resolve(null);
      }
      if (method === "train-student" || method === "load-local") {
        generationEvent(onEvent, { type: "progress", progress: 100, detail: "Behavior fixture ready" }, 0);
        return new Promise((resolve) => nativeSetTimeout(() => {
          prepared = true;
          resolve({ ready: true });
        }, fixture.preparationDelayMs));
      }
      if (method === "cancel") {
        cancellations.push(payload);
        return Promise.resolve(null);
      }
      if (method !== "generate") return Promise.reject(new Error("Unsupported behavior fixture method: " + method));
      generationCount += 1;
      generations.push(payload);
      if (fixture.transientRetry && generationCount === 1) {
        generationEvent(onEvent, { type: "phase", phase: "queued" }, 5);
        generationEvent(onEvent, { type: "error", message: "Controlled transient failure", transient: true }, 20);
        return Promise.resolve(null);
      }
      const interaction = generationCount - (fixture.transientRetry ? 1 : 0);
      if (interaction === 1) {
        generationEvent(onEvent, { type: "phase", phase: "queued" }, 5);
        generationEvent(onEvent, { type: "phase", phase: "prefill" }, 10);
        generationEvent(onEvent, { type: "phase", phase: "streaming" }, 15);
        generationEvent(onEvent, {
          type: "chunk",
          chunk: sse("token", { delta: fixture.responsePrefix + "original " })
            + sse("token", { delta: "answer" })
            + sse("token", { delta: " with" })
            + sse("token", { delta: " batched" })
            + sse("token", { delta: " tokens" }),
        }, 25);
        generationEvent(onEvent, { type: "chunk", chunk: sse("token", { delta: "." }) }, 120);
        generationEvent(onEvent, { type: "metrics", metrics: { queueMs: 5, modelMs: 610, ttftMs: 25, generatedUnits: 6, generatedUnitLabel: "Fixture tokens", durationMs: 650 } }, 620);
        generationEvent(onEvent, { type: "chunk", chunk: sse("done", { requestId: payload.requestId }) }, 650);
        generationEvent(onEvent, { type: "phase", phase: "complete" }, 660);
      } else if (interaction === 2) {
        generationEvent(onEvent, { type: "phase", phase: "streaming" }, 5);
        generationEvent(onEvent, { type: "chunk", chunk: sse("token", { delta: fixture.responsePrefix + "regenerated answer" }) }, 15);
        generationEvent(onEvent, { type: "chunk", chunk: sse("done", { requestId: payload.requestId }) }, 70);
        generationEvent(onEvent, { type: "phase", phase: "complete" }, 80);
      } else if (interaction === 3) {
        generationEvent(onEvent, { type: "phase", phase: "streaming" }, 5);
        generationEvent(onEvent, { type: "chunk", chunk: sse("token", { delta: "follow-up answer" }) }, 15);
        generationEvent(onEvent, { type: "chunk", chunk: sse("done", { requestId: payload.requestId }) }, 70);
        generationEvent(onEvent, { type: "phase", phase: "complete" }, 80);
      } else if (interaction === 4) {
        generationEvent(onEvent, { type: "phase", phase: "streaming" }, 1);
        generationEvent(onEvent, { type: "chunk", chunk: sse("token", { delta: "partial before cancellation" }) }, 5);
        generationEvent(onEvent, { type: "chunk", chunk: sse("token", { delta: " LATE-IGNORED" }) }, 180);
      } else {
        generationEvent(onEvent, { type: "phase", phase: "queued" }, 5);
        generationEvent(onEvent, { type: "error", message: "Controlled generation failure", transient: false }, 20);
      }
      return Promise.resolve(null);
    },
  });
  Object.defineProperty(globalThis, "__LATENT_PREVIEW_HOST__", { value: host, writable: false, configurable: false });

  const button = (label) => queryAll("button").find((candidate) => text(candidate) === label && visible(candidate));
  const setComposer = async (value) => {
    const composer = await waitFor(() => {
      const candidate = query('textarea[aria-label="Chat message"]');
      return candidate && visible(candidate) && !candidate.disabled ? candidate : null;
    }, "The enabled chat composer was not rendered.");
    nativeTextareaValue.call(composer, value);
    nativeDispatch.call(composer, new NativeEvent("input", { bubbles: true }));
    nativeDispatch.call(composer, new NativeEvent("change", { bubbles: true }));
    const send = await waitFor(() => {
      const send = button("Send");
      return send && !send.disabled ? send : null;
    }, "Typing did not enable the Send action.");
    const form = query("form");
    if (!form) throw new Error("The chat composer is not contained in a form.");
    nativeDispatch.call(form, new NativeSubmitEvent("submit", { bubbles: true, cancelable: true, submitter: send }));
  };
  const runBehavior = async () => {
    const checks = [];
    const check = (condition, label) => {
      if (!condition) throw new Error(label);
      checks.push(label);
    };

    const log = await waitFor(() => {
      const candidate = query('[role="log"][aria-live="off"]');
      return candidate && visible(candidate) ? candidate : null;
    }, "An accessible visible conversation log outside the polite live region was not rendered.");
    const streamAnnouncement = await waitFor(
      () => query('[data-stream-announcement][role="status"][aria-live="polite"][aria-atomic="true"]'),
      "A separate bounded stream announcement channel was not rendered.",
    );
    const announcementUpdates = [];
    let previousAnnouncement = text(streamAnnouncement);
    const announcementObserver = new MutationObserver(() => {
      const value = text(streamAnnouncement);
      if (!value || value === previousAnnouncement) return;
      previousAnnouncement = value;
      announcementUpdates.push({ value, at: performance.now() });
    });
    announcementObserver.observe(streamAnnouncement, { attributes: true, childList: true, characterData: true, subtree: true });
    const mobileControlsToggle = query(".mobile-control-toggle");
    check(
      visible(mobileControlsToggle)
        && focusable(mobileControlsToggle)
        && mobileControlsToggle?.getAttribute("aria-expanded") === "false",
      "mobile model controls begin as a compact, focusable disclosure",
    );
    nativeClick.call(mobileControlsToggle);
    const controlsSummary = await waitFor(
      () => {
        const candidate = query(".inference-panel summary");
        return candidate && visible(candidate) ? candidate : null;
      },
      "Opening the mobile model controls did not expose inference controls.",
    );
    check(
      mobileControlsToggle?.getAttribute("aria-expanded") === "true" && visible(controlsSummary),
      "mobile inference controls remain available as a compact disclosure",
    );
    if (fixture.requirePreparation) {
      const prepare = await waitFor(() => {
        const candidate = query("button.prepare-model");
        return candidate && focusable(candidate) && !candidate.disabled ? candidate : null;
      }, "An unprepared backend did not expose its preparation action.");
      nativeClick.call(prepare);
      await waitFor(() => query('[data-phase="loading"]'), "Backend preparation did not expose its loading state.");
      await delay(Math.max(20, Math.min(80, fixture.preparationDelayMs / 2)));
      check(!button("Stop") && Boolean(button("Send")?.disabled), "backend preparation never exposes a false Stop action");
      await waitFor(() => text(query("button.prepare-model")) === "Model ready", "Backend preparation did not resolve to the ready state.");
    }
    if (fixture.persistFailures > 0) {
      const retry = await waitFor(() => {
        const candidate = button("Retry save");
        return candidate && focusable(candidate) ? candidate : null;
      }, "A rejected persistence acknowledgement did not expose a visible, focusable Retry save action.");
      nativeFocus.call(retry);
      check(document.activeElement === retry, "mobile persistence recovery is keyboard-focusable");
      nativeClick.call(retry);
    }
    if (fixture.invalidConversation) {
      const discard = await waitFor(() => {
        const candidate = button("Discard saved conversation");
        return candidate && focusable(candidate) ? candidate : null;
      }, "An invalid restored conversation did not expose explicit recovery.");
      await delay(60);
      check(!requestMethods.includes("persist")
        && text(query(".restore-error")).includes("has not been changed"), "invalid restored conversation suspends persistence until explicit discard");
      nativeClick.call(discard);
    }
    const savedStatus = await waitFor(() => {
      const candidate = query(".control-panel footer [role=status]");
      return candidate && visible(candidate) && text(candidate).includes("Saved on this device") ? candidate : null;
    }, "The visible persistence acknowledgement did not reach the saved state.");
    check(Boolean(savedStatus && button("Clear conversation")), "mobile persistence status and Clear action remain visible");
    const status = query('.phase-status[role="status"][aria-live="polite"][aria-atomic="true"]');
    const composer = query('textarea[aria-label="Chat message"]');
    check(Boolean(query("main") && query("h1") && log && visible(status) && visible(composer) && button("Send")), "accessible chat surface");
    const selectedLabel = fixture.selectedBackend === "student" ? "Student RNN" : "Local Transformer";
    const metricsVisible = visible(query(".metrics-panel"));
    check(Boolean(button(selectedLabel)?.classList.contains("active") && metricsVisible === fixture.showMetrics), "restored backend and metrics visibility configuration");

    const initialGenerationCount = fixture.transientRetry ? 2 : 1;
    await setComposer("u1");
    try {
      await waitFor(() => generations.length === initialGenerationCount, "Submitting the composer did not invoke the generation bridge.");
    } catch {
      throw new Error("Submitting the composer did not invoke the generation bridge. Host methods: " + requestMethods.join(",") + ". Surface: " + text(query("main")));
    }
    const first = generations[0];
    check(Boolean(first && typeof first.requestId === "string" && first.requestId
      && first.backend === fixture.selectedBackend
      && Array.isArray(first.messages)
      && first.messages.at(-1)?.role === "user"
      && first.messages.at(-1)?.content === "u1"), "submit forwards the active user request");
    if (fixture.transientRetry) {
      const retried = generations[1];
      check(Boolean(retried
        && first.logicalRequestId === retried.logicalRequestId
        && first.attemptId !== retried.attemptId
        && first.requestId !== retried.requestId), "transient retry preserves logical request identity while rotating attempt and transport ids");
    }
    await waitFor(() => text(log).includes(fixture.responsePrefix + "original answer with batched tokens."), "Streamed generation chunks did not render in the transcript.");
    await waitFor(() => text(status).includes("Complete"), "The completed stream did not reach a terminal status.");
    check(text(log).includes("u1") && text(log).includes(fixture.responsePrefix + "original answer with batched tokens.") && text(log).includes(fixture.assistantName), "runtime name and response prefix affect visible streamed output");
    check(Number(log.getAttribute("data-render-commits")) === 2
      && renderFrames.completed >= 2
      && renderFrames.requested < 6, "stream deltas batch behind animation-frame commits");
    const streamingAnnouncements = announcementUpdates.filter((entry) => entry.value.startsWith("Assistant update:") && !entry.value.includes("Response complete."));
    const announcementIntervalsAreBounded = streamingAnnouncements.every((entry, index) => index === 0 || entry.at - streamingAnnouncements[index - 1].at >= 450);
    check(announcementUpdates.length >= 2
      && announcementUpdates.every((entry) => entry.value.length <= 160)
      && announcementIntervalsAreBounded
      && announcementUpdates.some((entry) => entry.value.includes("Response complete.")), "live output announcements are bounded and rate-limited with immediate terminal state");

    const regenerate = await waitFor(() => {
      const candidate = button("Regenerate");
      return candidate && !candidate.disabled ? candidate : null;
    }, "A completed assistant response did not expose regeneration.");
    nativeClick.call(regenerate);
    await waitFor(() => generations.length === initialGenerationCount + 1, "Regeneration did not invoke the generation bridge.");
    await waitFor(() => text(query('article.message.assistant[data-active-attempt="true"] p')).includes(fixture.responsePrefix + "regenerated answer"), "The regenerated response did not become the active attempt.");
    await waitFor(() => text(status).includes("Complete"), "Regeneration did not reach a terminal status.");
    check(Boolean(query('article.message.assistant[data-active-attempt="false"]')
      && query('article.message.assistant[data-active-attempt="true"]')), "regeneration exposes active and superseded attempts");

    await setComposer("u2");
    await waitFor(() => generations.length === initialGenerationCount + 2, "The follow-up after regeneration did not invoke the generation bridge.");
    const followUpContext = generations[initialGenerationCount + 1]?.messages || [];
    const followUpContents = followUpContext.map((message) => message.content);
    check(followUpContents.includes("u1")
      && followUpContents.includes(fixture.responsePrefix + "regenerated answer")
      && !followUpContents.includes(fixture.responsePrefix + "original answer with batched tokens.")
      && followUpContents.at(-1) === "u2", "regeneration makes the newest sibling active for subsequent context");
    await waitFor(() => text(log).includes("follow-up answer") && text(status).includes("Complete"), "The branch-aware follow-up did not complete.");

    await setComposer("Cancel this generation");
    await waitFor(() => generations.length === initialGenerationCount + 3 && button("Stop"), "An active generation did not expose the Stop action.");
    const cancellationRequestId = generations[initialGenerationCount + 2]?.requestId;
    const cancelledFramesBeforeStop = renderFrames.cancelled;
    await waitFor(() => renderFrames.requested > renderFrames.completed + renderFrames.cancelled, "The cancellation fixture did not leave an animation-frame commit pending.");
    nativeClick.call(button("Stop"));
    await waitFor(() => query("article.message.assistant.cancelled"), "Stopping did not mark the active assistant message as cancelled.");
    await waitFor(() => cancellations.some((entry) => entry?.requestId === cancellationRequestId), "Stopping did not cancel the matching bridge request.");
    await waitFor(() => renderFrames.requested === renderFrames.completed + renderFrames.cancelled, "Stopping left animation-frame work pending.");
    check(renderFrames.cancelled > cancelledFramesBeforeStop
      && text(log).includes("partial before cancellation"), "cancellation flushes accepted deltas and clears pending render work");
    await delay(240);
    check(!text(log).includes("LATE-IGNORED"), "cancellation rejects late stream output");

    await setComposer("Trigger controlled failure");
    await waitFor(() => generations.length === initialGenerationCount + 4, "The post-cancellation composer could not submit another request.");
    const alert = await waitFor(() => {
      const candidate = query('[role="alert"]');
      return candidate && visible(candidate) && text(candidate).includes("Controlled generation failure") ? candidate : null;
    }, "A bridge failure did not render a meaningful alert.");
    await waitFor(() => text(status).includes("Generation failed"), "A bridge failure did not reach the error phase.");
    check(Boolean(alert && query("article.message.assistant.error")), "error is visible and terminal");
    announcementObserver.disconnect();
    return checks;
  };

  const report = (passed, detail, checks = []) => {
    parent.postMessage({
      schemaVersion: 1,
      type: "latent-capstone-behavior/result",
      channelId,
      passed,
      detail: String(detail).slice(0, 1200),
      checks,
    }, "*");
  };

  addEventListener("message", async (event) => {
    const data = event.data;
    if (started || event.source !== parent || !data || data.schemaVersion !== 1
      || data.type !== "latent-capstone-behavior/run" || typeof data.channelId !== "string"
      || !validAsset(data.runtime) || !validAsset(data.bundle)) return;
    started = true;
    channelId = data.channelId;
    try {
      if (data.fixture && typeof data.fixture === "object"
        && (data.fixture.selectedBackend === "student" || data.fixture.selectedBackend === "local")
        && typeof data.fixture.assistantName === "string" && data.fixture.assistantName.length > 0 && data.fixture.assistantName.length <= 24
        && typeof data.fixture.responsePrefix === "string" && data.fixture.responsePrefix.length <= 60
        && typeof data.fixture.showMetrics === "boolean"
        && (data.fixture.persistFailures === undefined || (Number.isSafeInteger(data.fixture.persistFailures) && data.fixture.persistFailures >= 0 && data.fixture.persistFailures <= 2))
        && (data.fixture.requirePreparation === undefined || typeof data.fixture.requirePreparation === "boolean")
        && (data.fixture.preparationDelayMs === undefined || (Number.isSafeInteger(data.fixture.preparationDelayMs) && data.fixture.preparationDelayMs >= 0 && data.fixture.preparationDelayMs <= 1000))
        && (data.fixture.transientRetry === undefined || typeof data.fixture.transientRetry === "boolean")
        && (data.fixture.invalidConversation === undefined || typeof data.fixture.invalidConversation === "boolean")) {
        fixture = {
          ...data.fixture,
          persistFailures: data.fixture.persistFailures ?? 0,
          requirePreparation: data.fixture.requirePreparation ?? false,
          preparationDelayMs: data.fixture.preparationDelayMs ?? 0,
          transientRetry: data.fixture.transientRetry ?? false,
          invalidConversation: data.fixture.invalidConversation ?? false,
        };
        prepared = !fixture.requirePreparation;
      }
      if (await digest(data.runtime.code) !== data.runtime.codeHash) throw new Error("The trusted React runtime hash does not match.");
      if (await digest(data.bundle.code) !== data.bundle.codeHash) throw new Error("The compiled capstone hash does not match.");
      await loadScript(data.runtime.code, "The trusted React runtime");
      if (!globalThis.__LATENT_REACT__) throw new Error("The trusted React runtime did not install.");
      await loadScript(data.bundle.code, "The compiled capstone entry");
      const checks = await runBehavior();
      report(true, checks.length + " host-owned browser checks passed.", checks);
    } catch (error) {
      report(false, error && error.message ? error.message : error);
    } finally {
      for (const url of activeUrls) nativeRevokeObjectURL(url);
      activeUrls.clear();
    }
  }, { once: true });
})();`;

/** Updated whenever the fixed host-owned bootstrap changes. */
export const CAPSTONE_BEHAVIOR_BOOTSTRAP_SHA256 = "sha256-1AFANo5bjziRcd9BDZIucC7Lp2afj49pUVPYs63cbXA=" as const;

export function createCapstoneBehaviorFrameSrcdoc(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${CAPSTONE_BEHAVIOR_BOOTSTRAP_SHA256}' blob:; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'">
<title>Browser Chat behavior contract</title>
</head>
<body><div id="root"></div><script>${CAPSTONE_BEHAVIOR_BOOTSTRAP_SOURCE}</script></body>
</html>`;
}

type BehaviorBundle = {
  modulePath: string;
  code: string;
  codeHash: string;
};

type BehaviorFrameResult = {
  schemaVersion: 1;
  type: "latent-capstone-behavior/result";
  channelId: string;
  passed: boolean;
  detail: string;
  checks?: string[];
};

async function sha256(source: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function createCapstonePreflightWorker(): BrowserLabWorkerPort {
  if (typeof Worker === "undefined") throw new Error("The isolated capstone preflight requires a Web Worker.");
  return new Worker("/capstone-sandbox-worker.js", { type: "module", name: "capstone-behavior-preflight" });
}

async function runCapstoneBehaviorPreflight(bundle: BehaviorBundle, signal?: AbortSignal): Promise<ProjectUnitResult | null> {
  const verifiedBundleHash = await sha256(bundle.code);
  if (verifiedBundleHash !== bundle.codeHash) {
    return failure("The compiled capstone hash changed before the isolated behavior preflight.");
  }
  const preflightCode = createCapstoneBehaviorPreflightCode(bundle.code);
  const preflightCodeHash = await sha256(preflightCode);
  const preflightProgram: CompiledProgram = {
    schemaVersion: 1,
    format: "browser-lab-iife-v1",
    compileJobId: `capstone-preflight:${bundle.codeHash}`,
    projectId: "browser-chat",
    projectRevision: 0,
    sourceHash: bundle.codeHash as `sha256:${string}`,
    compilerVersion: "host-capstone-preflight-v1",
    modules: [{
      modulePath: CAPSTONE_PREFLIGHT_MODULE_PATH,
      globalName: CAPSTONE_PREFLIGHT_GLOBAL_NAME,
      code: preflightCode,
      codeHash: preflightCodeHash as `sha256:${string}`,
    }],
    diagnostics: [],
  };
  const preflightContract: ExerciseContract = {
    id: CAPSTONE_PREFLIGHT_CONTRACT_VERSION,
    label: "Bounded synchronous capstone render",
    cases: [{
      id: "initial-render",
      label: "Initial render and visible handlers finish within the isolated CPU budget",
      invoke: { modulePath: CAPSTONE_PREFLIGHT_MODULE_PATH, exportName: "done", args: [] },
      assertions: [{ id: "completed", label: "The isolated probe completed", kind: "truthy" }],
    }],
  };
  try {
    const receipt = await new BrowserLabWorkerClient(createCapstonePreflightWorker).runSuite({
      schemaVersion: 1,
      jobId: `capstone-preflight:${crypto.randomUUID()}`,
      projectId: preflightProgram.projectId,
      projectRevision: preflightProgram.projectRevision,
      sourceHash: preflightProgram.sourceHash,
      contractVersion: CAPSTONE_PREFLIGHT_CONTRACT_VERSION,
      requestedAt: Date.now(),
      deterministicSeed: 71,
      deterministicNowMs: 1_700_000_000_000,
      program: preflightProgram,
      suite: { contractVersion: CAPSTONE_PREFLIGHT_CONTRACT_VERSION, contracts: [preflightContract] },
      limits: {
        ...DEFAULT_SANDBOX_LIMITS,
        cpuTimeoutMs: 500,
        wallTimeoutMs: 2_000,
        maxLogEntries: 0,
        maxLogCharacters: 0,
      },
    }, { signal });
    const result = receipt.results[0];
    const observation = result?.observationStatus;
    if (receipt.status !== "passed" || !result?.passed) {
      const reason = observation === "timed-out"
        ? "its initial render or a visible handler exceeded the CPU limit"
        : observation === "resource-error"
          ? "its initial render or a visible handler exceeded the memory or stack limit"
          : `the bounded probe ${observation ?? "returned no observation"}`;
      return failure(`The isolated QuickJS preflight rejected the compiled capstone because ${reason}. The browser mount was not started.`);
    }
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The isolated QuickJS preflight failed.";
    return failure(`The isolated QuickJS preflight could not establish bounded synchronous execution: ${detail} The browser mount was not started.`);
  }
}

function failure(detail: string): ProjectUnitResult {
  return {
    id: CAPSTONE_BEHAVIOR_CONTRACT_ID,
    path: CAPSTONE_BEHAVIOR_COMPONENT_PATH,
    label: CAPSTONE_BEHAVIOR_CONTRACT_LABEL,
    passed: false,
    detail,
  };
}

function isBehaviorFrameResult(value: unknown, channelId: string): value is BehaviorFrameResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<BehaviorFrameResult>;
  return result.schemaVersion === 1
    && result.type === "latent-capstone-behavior/result"
    && result.channelId === channelId
    && typeof result.passed === "boolean"
    && typeof result.detail === "string"
    && result.detail.length <= 1200
    && (result.checks === undefined || (Array.isArray(result.checks)
      && result.checks.length <= 20
      && result.checks.every((entry) => typeof entry === "string" && entry.length <= 200)));
}

let cachedRuntimeSource: Promise<string> | null = null;

async function trustedRuntimeSource(signal?: AbortSignal): Promise<string> {
  cachedRuntimeSource ??= fetch("/capstone-react-runtime.js", {
    cache: "force-cache",
    credentials: "same-origin",
  }).then(async (response) => {
    if (!response.ok) throw new Error("The trusted React behavior runtime is unavailable.");
    return response.text();
  }).catch((error) => {
    cachedRuntimeSource = null;
    throw error;
  });
  if (signal?.aborted) throw signal.reason ?? new DOMException("The behavior check was aborted.", "AbortError");
  return cachedRuntimeSource;
}

export async function runCapstoneBehaviorContract(
  bundle: BehaviorBundle | null,
  options: {
    signal?: AbortSignal;
    runtimeSource?: string;
    timeoutMs?: number;
    fixture?: {
      selectedBackend: "student" | "local";
      assistantName: string;
      responsePrefix: string;
      showMetrics: boolean;
      persistFailures?: number;
      requirePreparation?: boolean;
      preparationDelayMs?: number;
      transientRetry?: boolean;
      invalidConversation?: boolean;
    };
  } = {},
): Promise<ProjectUnitResult> {
  if (!bundle || bundle.modulePath !== "capstone/main.tsx" || !bundle.code.trim()) {
    return failure("The compiled capstone entry is unavailable, so the editable BrowserChat component could not be mounted.");
  }
  if (typeof document === "undefined" || !document.body) {
    return failure("The host-owned browser behavior runner is unavailable outside a document.");
  }
  if (new TextEncoder().encode(bundle.code).byteLength > MAX_BEHAVIOR_ASSET_BYTES) {
    return failure("The compiled capstone exceeds the behavior runner's 2 MB limit.");
  }
  const preflightFailure = await runCapstoneBehaviorPreflight(bundle, options.signal);
  if (preflightFailure) return preflightFailure;

  let runtimeSource: string;
  try {
    runtimeSource = options.runtimeSource ?? await trustedRuntimeSource(options.signal);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "The trusted React behavior runtime is unavailable.");
  }
  if (!runtimeSource.trim() || new TextEncoder().encode(runtimeSource).byteLength > MAX_BEHAVIOR_ASSET_BYTES) {
    return failure("The trusted React behavior runtime is empty or exceeds the 2 MB limit.");
  }

  const channelId = `behavior:${crypto.randomUUID()}`;
  const iframe = document.createElement("iframe");
  iframe.title = "Browser Chat behavior contract";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = "position:fixed;inset:auto auto 0 0;width:390px;height:844px;opacity:0;pointer-events:none;border:0;z-index:-1";

  return new Promise<ProjectUnitResult>((resolve) => {
    let settled = false;
    const finish = (result: ProjectUnitResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      options.signal?.removeEventListener("abort", onAbort);
      iframe.remove();
      resolve(result);
    };
    const onAbort = () => finish(failure("The host-owned browser behavior check was aborted."));
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframe.contentWindow || !isBehaviorFrameResult(event.data, channelId)) return;
      const result = event.data;
      const checks = result.checks?.length ? ` ${result.checks.join(" · ")}.` : "";
      finish({
        id: CAPSTONE_BEHAVIOR_CONTRACT_ID,
        path: CAPSTONE_BEHAVIOR_COMPONENT_PATH,
        label: CAPSTONE_BEHAVIOR_CONTRACT_LABEL,
        passed: result.passed,
        detail: result.passed
          ? `${result.detail}${checks}`
          : `The mounted BrowserChat failed its host-owned behavior contract: ${result.detail}`,
      });
    };
    const timer = window.setTimeout(() => {
      finish(failure("The mounted BrowserChat did not report within the asynchronous observation limit. The frame timer does not interrupt synchronous learner code; bounded initial render and visible-handler execution were checked separately in the isolated QuickJS worker."));
    }, Math.max(1000, Math.min(options.timeoutMs ?? CAPSTONE_BEHAVIOR_FRAME_TIMEOUT_MS, 30_000)));
    window.addEventListener("message", onMessage);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    iframe.addEventListener("load", () => {
      if (settled || options.signal?.aborted) return;
      void Promise.all([sha256(runtimeSource), Promise.resolve(bundle.codeHash)]).then(([runtimeHash, codeHash]) => {
        if (settled) return;
        iframe.contentWindow?.postMessage({
          schemaVersion: 1,
          type: "latent-capstone-behavior/run",
          channelId,
          fixture: options.fixture,
          runtime: { code: runtimeSource, codeHash: runtimeHash },
          bundle: { code: bundle.code, codeHash },
        }, "*");
      }).catch((error) => finish(failure(error instanceof Error ? error.message : "The behavior assets could not be hashed.")));
    }, { once: true });
    iframe.srcdoc = createCapstoneBehaviorFrameSrcdoc();
    document.body.appendChild(iframe);
  });
}
