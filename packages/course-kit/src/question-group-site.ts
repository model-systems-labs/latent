import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import {
  canonicalQuestionGroupLibraryJson,
  type QuestionGroupLibrary,
  validateQuestionGroupLibrary,
} from "./question-group.js";

export const QUESTION_GROUP_BUILD_MARKER = "latent-question-groups-static-build-v1";
export const QUESTION_GROUP_PLAYER_VERSION = 1 as const;
export const QUESTION_GROUP_LEARNER_TRANSFORM_OPTIONS = Object.freeze({
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: false,
  supported: Object.freeze({
    "dynamic-import": false,
  }),
} as const);

export type QuestionGroupSiteFile = string | Uint8Array;
export type QuestionGroupSiteFiles = Record<string, QuestionGroupSiteFile>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderIndex(
  library: QuestionGroupLibrary,
  digest: string,
  initialQuery: "all" | "leeches",
) {
  const description = initialQuery === "leeches"
    ? `Review repeatedly missed questions from ${library.library.title}.`
    : library.library.description;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'">
  <title>${escapeHtml(initialQuery === "leeches" ? `Leech review · ${library.library.title}` : library.library.title)}</title>
  <link rel="icon" href="${initialQuery === "leeches" ? "../" : "./"}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${initialQuery === "leeches" ? "../" : "./"}assets/player.css">
</head>
<body
  data-library-url="${initialQuery === "leeches" ? "../" : "./"}question-group-library.json"
  data-library-digest="${escapeHtml(digest)}"
  data-initial-query="${initialQuery}"
  data-asset-root="${initialQuery === "leeches" ? "../" : "./"}assets/"
>
  <a class="skip-link" href="#question">Skip to the active question</a>
  <header class="site-header">
    <a class="wordmark" href="${initialQuery === "leeches" ? "../" : "./"}">latent practice</a>
    <nav aria-label="Practice views">
      <a ${initialQuery === "all" ? 'aria-current="page"' : ""} href="${initialQuery === "leeches" ? "../" : "./"}">All questions</a>
      <a ${initialQuery === "leeches" ? 'aria-current="page"' : ""} href="${initialQuery === "leeches" ? "./" : "./leeches/"}">Leech review</a>
    </nav>
  </header>
  <main id="app" aria-busy="true">
    <p class="loading">Loading validated practice content…</p>
  </main>
  <script src="${initialQuery === "leeches" ? "../" : "./"}assets/esbuild.js" defer></script>
  <script src="${initialQuery === "leeches" ? "../" : "./"}assets/runtime-adapter.js" defer></script>
  <script src="${initialQuery === "leeches" ? "../" : "./"}assets/player.js" defer></script>
</body>
</html>
`;
}

export const questionGroupPlayerCss = `:root {
  color-scheme: light;
  --paper: #f5f1e9;
  --panel: #fffdf8;
  --ink: #282322;
  --muted: #6c635e;
  --line: rgba(70,54,63,.18);
  --violet: #675674;
  --green: #41664c;
  font-family: Inter,ui-sans-serif,system-ui,sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); }
body { margin: 0; min-height: 100vh; }
button,textarea { font: inherit; }
a { color: inherit; }
.skip-link { background: var(--ink); color: white; left: 1rem; padding: .7rem 1rem; position: fixed; top: -5rem; z-index: 5; }
.skip-link:focus { top: 1rem; }
.site-header { align-items: center; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; min-height: 4.25rem; padding: 0 clamp(1rem,4vw,3.5rem); }
.wordmark { font-size: .75rem; font-weight: 700; letter-spacing: .1em; text-decoration: none; text-transform: uppercase; }
.site-header nav { display: flex; gap: 1rem; }
.site-header nav a { color: var(--muted); font-size: .75rem; text-underline-offset: .25rem; }
.site-header nav a[aria-current="page"] { color: var(--ink); font-weight: 650; }
.loading,.empty { color: var(--muted); margin: 4rem auto; max-width: 40rem; padding: 1rem; text-align: center; }
.layout { display: grid; grid-template-columns: minmax(14rem,20rem) minmax(20rem,.8fr) minmax(26rem,1.2fr); height: calc(100vh - 4.25rem); min-height: 42rem; }
.library { border-right: 1px solid var(--line); overflow: auto; padding: 1.2rem; }
.library header { margin-bottom: 1.5rem; }
.library h1 { font-family: Georgia,serif; font-size: 1.9rem; font-weight: 400; letter-spacing: -.04em; line-height: 1.05; margin: .4rem 0; }
.library p,.question-copy p { color: var(--muted); line-height: 1.55; }
.eyebrow { color: var(--violet); font-size: .66rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.group + .group { border-top: 1px solid var(--line); margin-top: 1rem; padding-top: 1rem; }
.group h2 { font-size: .75rem; margin: 0 0 .5rem; }
.group ol { display: grid; gap: .3rem; list-style: none; margin: 0; padding: 0; }
.question-link { align-items: center; background: transparent; border: 0; border-radius: .3rem; color: var(--muted); cursor: pointer; display: flex; gap: .5rem; min-height: 2.8rem; padding: .5rem; text-align: left; width: 100%; }
.question-link[aria-current="true"] { background: rgba(105,86,116,.13); color: var(--ink); }
.status-dot { border: 1px solid #948b86; border-radius: 50%; flex: 0 0 auto; height: .5rem; width: .5rem; }
.status-dot[data-status="attempted"] { background: #b77851; border-color: #b77851; }
.status-dot[data-status="solved"] { background: var(--green); border-color: var(--green); }
.question-copy { background: var(--panel); border-right: 1px solid var(--line); overflow: auto; padding: clamp(1.2rem,3vw,2.4rem); }
.question-copy h2 { font-family: Georgia,serif; font-size: clamp(2rem,4vw,3.4rem); font-weight: 400; letter-spacing: -.05em; line-height: 1; margin: .7rem 0 1rem; }
.question-copy li { color: var(--muted); font-size: .82rem; line-height: 1.5; margin-bottom: .4rem; }
.workspace { display: grid; grid-template-rows: auto minmax(18rem,1fr) auto minmax(9rem,.55fr); min-width: 0; }
.workspace header,.actions { align-items: center; background: var(--panel); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; min-height: 3.5rem; padding: .65rem .85rem; }
.workspace code { font-size: .75rem; }
textarea { background: #fcfaf5; border: 0; color: #2e2928; font: 14px/1.55 ui-monospace,SFMono-Regular,monospace; min-height: 100%; outline: none; padding: 1rem; resize: none; tab-size: 2; width: 100%; }
textarea:focus { box-shadow: inset 0 0 0 3px rgba(103,86,116,.35); }
.actions { border-top: 1px solid var(--line); gap: .5rem; justify-content: flex-end; }
.actions button { background: transparent; border: 1px solid #aaa09a; border-radius: .35rem; cursor: pointer; min-height: 2.6rem; padding: .5rem .8rem; }
.actions button.primary { background: var(--violet); border-color: var(--violet); color: white; }
.actions button:disabled { cursor: wait; opacity: .5; }
.results { background: #f8f4ed; overflow: auto; padding: 1rem; }
.results h3 { font-size: .75rem; letter-spacing: .07em; text-transform: uppercase; }
.results ol { display: grid; gap: .45rem; list-style: none; padding: 0; }
.results li { background: rgba(255,255,255,.55); border-left: 3px solid #a35c50; font-size: .78rem; line-height: 1.45; padding: .65rem; }
.results li[data-passed="true"] { border-color: var(--green); }
.error { color: #8b403b; }
:focus-visible { outline: 3px solid var(--violet); outline-offset: 2px; }
@media (max-width: 900px) {
  .layout { display: block; height: auto; }
  .library,.question-copy { border-bottom: 1px solid var(--line); border-right: 0; }
  .workspace { min-height: 46rem; }
}
`;

export const questionGroupSandboxWorkerJavaScript = `(() => {
  "use strict";
  const workerGlobal = self;
  const send = workerGlobal.postMessage.bind(workerGlobal);
  const evaluate = Function;
  const SafeArray = Array;
  const SafeBoolean = Boolean;
  const SafeError = Error;
  const SafeObject = Object;
  const SafePromise = Promise;
  const SafeRegExp = RegExp;
  const SafeString = String;
  const SafeTextEncoder = TextEncoder;
  const SafeUint8Array = Uint8Array;
  const safeArrayIsArray = Array.isArray;
  const safeArraySort = Array.prototype.sort;
  const safeJsonStringify = JSON.stringify;
  const safeNumberIsFinite = Number.isFinite;
  const safeObjectCreate = Object.create;
  const safeObjectDefineProperty = Object.defineProperty;
  const safeObjectFreeze = Object.freeze;
  const safeObjectGetPrototypeOf = Object.getPrototypeOf;
  const safeObjectHasOwnProperty = Object.prototype.hasOwnProperty;
  const safeObjectIs = Object.is;
  const safeObjectKeys = Object.keys;
  const safeObjectSetPrototypeOf = Object.setPrototypeOf;
  const safeRegExpTest = RegExp.prototype.test;
  const safeReflectApply = Reflect.apply;
  const safeStringIncludes = String.prototype.includes;
  const safeStructuredClone = workerGlobal.structuredClone;
  const safeTextEncode = TextEncoder.prototype.encode;
  const constructorPrototypes = [
    Function.prototype,
    safeObjectGetPrototypeOf(async function () {}),
    safeObjectGetPrototypeOf(function* () {}),
    safeObjectGetPrototypeOf(async function* () {}),
  ];
  for (const prototype of constructorPrototypes) {
    try { safeObjectDefineProperty(prototype, "constructor", { configurable: false, value: undefined, writable: false }); } catch {}
  }
  const deniedCapabilities = [
    "fetch",
    "WebSocket",
    "WebSocketStream",
    "WebTransport",
    "EventSource",
    "XMLHttpRequest",
    "RTCPeerConnection",
    "RTCDataChannel",
    "RTCIceTransport",
    "BroadcastChannel",
    "FontFace",
    "fonts",
    "Notification",
    "navigator",
    "WorkerNavigator",
    "indexedDB",
    "caches",
    "importScripts",
    "Worker",
    "SharedWorker",
    "webkitRequestFileSystem",
    "webkitRequestFileSystemSync",
    "webkitResolveLocalFileSystemURL",
    "webkitResolveLocalFileSystemSyncURL",
    "setTimeout",
    "setInterval",
    "require",
    "Function",
    "eval",
  ];
  for (const name of deniedCapabilities) {
    try { safeObjectDefineProperty(workerGlobal, name, { configurable: false, value: undefined, writable: false }); } catch {}
  }
  try { safeObjectDefineProperty(workerGlobal, "postMessage", { configurable: false, value: undefined, writable: false }); } catch {}
  const checkerIntrinsics = [
    SafeArray,
    SafeArray.prototype,
    SafeBoolean,
    SafeBoolean.prototype,
    SafeError,
    SafeError.prototype,
    SafeObject,
    SafeObject.prototype,
    SafePromise,
    SafePromise.prototype,
    SafeRegExp,
    SafeRegExp.prototype,
    SafeString,
    SafeString.prototype,
    SafeTextEncoder,
    SafeTextEncoder.prototype,
    SafeUint8Array,
    SafeUint8Array.prototype,
    safeObjectGetPrototypeOf(SafeUint8Array.prototype),
    JSON,
    Reflect,
    TypeError,
    TypeError.prototype,
    RangeError,
    RangeError.prototype,
    SyntaxError,
    SyntaxError.prototype,
    ...constructorPrototypes,
  ];
  for (const intrinsic of checkerIntrinsics) {
    try { safeReflectApply(safeObjectFreeze, SafeObject, [intrinsic]); } catch {}
  }
  let capabilityProblem = typeof safeStructuredClone === "function"
    ? null
    : "structuredClone";
  for (let index = 0; !capabilityProblem && index < deniedCapabilities.length; index += 1) {
    const name = deniedCapabilities[index];
    if (workerGlobal[name] !== undefined) capabilityProblem = name;
  }
  const hasOwn = (value, key) => value != null && safeReflectApply(
    safeObjectHasOwnProperty,
    value,
    [key],
  );
  const ownValue = (value, key) => hasOwn(value, key) ? value[key] : undefined;
  const atPath = (value, path) => {
    let current = value;
    const parts = path || [];
    for (let index = 0; index < parts.length; index += 1) {
      if (!hasOwn(current, parts[index])) return undefined;
      current = current[parts[index]];
    }
    return current;
  };
  const printable = (value) => {
    try {
      const encoded = safeJsonStringify(value);
      return encoded === undefined ? SafeString(value) : encoded;
    } catch {
      return SafeString(value);
    }
  };
  const assertPortablePrototypeGraph = (value, ancestors) => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "boolean"
      || (typeof value === "number" && safeNumberIsFinite(value))
    ) {
      return;
    }
    if (!value || typeof value !== "object") {
      throw new SafeError("Returned values must be finite JSON data.");
    }
    for (let index = 0; index < ancestors.length; index += 1) {
      if (safeObjectIs(ancestors[index], value)) {
        throw new SafeError("Returned values may not contain cycles.");
      }
    }
    const prototype = safeObjectGetPrototypeOf(value);
    if (safeArrayIsArray(value)) {
      if (prototype !== SafeArray.prototype && prototype !== null) {
        throw new SafeError("Returned arrays may not use a custom prototype.");
      }
      if (value.length > 1_000_000) {
        throw new SafeError("Returned arrays exceed the portable result limit.");
      }
    } else if (prototype !== SafeObject.prototype && prototype !== null) {
      throw new SafeError("Returned objects must use a plain prototype.");
    }
    ancestors[ancestors.length] = value;
    if (safeArrayIsArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (hasOwn(value, index)) assertPortablePrototypeGraph(value[index], ancestors);
      }
    } else {
      const keys = safeObjectKeys(value);
      for (let index = 0; index < keys.length; index += 1) {
        assertPortablePrototypeGraph(value[keys[index]], ancestors);
      }
    }
    ancestors.length -= 1;
  };
  const normalizePortableResult = (value) => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "boolean"
      || typeof value === "number"
    ) {
      return value;
    }
    if (safeArrayIsArray(value)) {
      const output = new SafeArray(value.length);
      safeObjectSetPrototypeOf(output, null);
      for (let index = 0; index < value.length; index += 1) {
        if (hasOwn(value, index)) output[index] = normalizePortableResult(value[index]);
      }
      return output;
    }
    const output = safeObjectCreate(null);
    const keys = safeObjectKeys(value);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      output[key] = normalizePortableResult(value[key]);
    }
    return output;
  };
  const snapshotPortableResult = (value) => {
    const ancestors = new SafeArray();
    assertPortablePrototypeGraph(value, ancestors);
    const cloned = safeReflectApply(safeStructuredClone, workerGlobal, [value]);
    const clonedAncestors = new SafeArray();
    assertPortablePrototypeGraph(cloned, clonedAncestors);
    return normalizePortableResult(cloned);
  };
  const isPlainRecord = (value) => {
    if (!value || typeof value !== "object" || safeArrayIsArray(value)) return false;
    const prototype = safeObjectGetPrototypeOf(value);
    return prototype === SafeObject.prototype || prototype === null;
  };
  const deepEqual = (left, right) => {
    if (safeObjectIs(left, right)) return true;
    if (safeArrayIsArray(left) && safeArrayIsArray(right)) {
      if (left.length !== right.length) return false;
      for (let index = 0; index < left.length; index += 1) {
        if (hasOwn(left, index) !== hasOwn(right, index)) return false;
        if (!hasOwn(left, index)) continue;
        if (!deepEqual(left[index], right[index])) return false;
      }
      return true;
    }
    if (isPlainRecord(left) && isPlainRecord(right)) {
      const leftKeys = safeObjectKeys(left);
      const rightKeys = safeObjectKeys(right);
      safeReflectApply(safeArraySort, leftKeys, []);
      safeReflectApply(safeArraySort, rightKeys, []);
      if (!deepEqual(leftKeys, rightKeys)) return false;
      for (let index = 0; index < leftKeys.length; index += 1) {
        const key = leftKeys[index];
        if (!deepEqual(left[key], right[key])) return false;
      }
      return true;
    }
    return false;
  };
  const assertionResult = (assertion, result, thrown, resultProblem) => {
    const kind = ownValue(assertion, "kind");
    if (kind === "throws") {
      const errorName = ownValue(assertion, "errorName");
      const messagePattern = ownValue(assertion, "messagePattern");
      const nameMatches = !errorName || thrown?.name === errorName;
      let messageMatches = true;
      try {
        messageMatches = !messagePattern || safeReflectApply(
          safeRegExpTest,
          new SafeRegExp(messagePattern),
          [SafeString(thrown?.message || "")],
        );
      }
      catch { messageMatches = false; }
      return {
        passed: !resultProblem && SafeBoolean(thrown) && nameMatches && messageMatches,
        detail: resultProblem || (thrown ? SafeString(thrown.name || "Error") + ": " + SafeString(thrown.message || "") : "Expected the call to throw."),
      };
    }
    if (thrown) return { passed: false, detail: SafeString(thrown.name || "Error") + ": " + SafeString(thrown.message || thrown) };
    if (resultProblem) return { passed: false, detail: resultProblem };
    const actual = atPath(result, ownValue(assertion, "path"));
    const expected = ownValue(assertion, "expected");
    if (kind === "deep-equal") return { passed: deepEqual(actual, expected), detail: "Received " + printable(actual) };
    if (kind === "type") {
      const actualType = actual === null ? "null" : safeArrayIsArray(actual) ? "array" : typeof actual;
      return { passed: actualType === expected, detail: "Received type " + actualType };
    }
    if (kind === "truthy") return { passed: SafeBoolean(actual), detail: "Received " + printable(actual) };
    if (kind === "finite") return { passed: typeof actual === "number" && safeNumberIsFinite(actual), detail: "Received " + printable(actual) };
    if (kind === "range") return { passed: typeof actual === "number" && actual >= ownValue(assertion, "minimum") && actual <= ownValue(assertion, "maximum"), detail: "Received " + printable(actual) };
    if (kind === "length") {
      const actualLength = typeof actual === "string"
        ? actual.length
        : safeArrayIsArray(actual) && hasOwn(actual, "length")
          ? actual.length
          : undefined;
      return { passed: actualLength === expected, detail: "Received length " + printable(actualLength) };
    }
    if (kind === "includes") {
      const passed = typeof actual === "string"
        ? safeReflectApply(safeStringIncludes, actual, [SafeString(expected)])
        : safeArrayIsArray(actual) && (() => {
            for (let index = 0; index < actual.length; index += 1) {
              if (hasOwn(actual, index) && deepEqual(actual[index], expected)) return true;
            }
            return false;
          })();
      return { passed, detail: "Received " + printable(actual) };
    }
    if (kind === "matches") {
      let passed = false;
      try {
        passed = safeReflectApply(
          safeRegExpTest,
          new SafeRegExp(ownValue(assertion, "pattern"), ownValue(assertion, "flags") || ""),
          [SafeString(actual)],
        );
      } catch {}
      return { passed, detail: "Received " + printable(actual) };
    }
    return { passed: false, detail: "Unsupported assertion." };
  };
  workerGlobal.addEventListener("message", async (event) => {
    const payload = event.data;
    try {
      if (capabilityProblem) {
        throw new SafeError("The browser could not disable the " + capabilityProblem + " capability.");
      }
      delete workerGlobal.__latentEntrypoint;
      evaluate('"use strict";\\n' + payload.code)();
      const entrypoint = workerGlobal.__latentEntrypoint;
      if (typeof entrypoint !== "function") throw new SafeError("The requested entrypoint was not defined.");
      const caseResults = new SafeArray(payload.cases.length);
      for (let caseIndex = 0; caseIndex < payload.cases.length; caseIndex += 1) {
        const exerciseCase = payload.cases[caseIndex];
        let result;
        let resultProblem = null;
        let thrown = null;
        try {
          result = await entrypoint(
            ownValue(exerciseCase, "constructorArgs") || [],
            ownValue(exerciseCase, "args"),
          );
        } catch (error) {
          thrown = { name: error?.name || "Error", message: error?.message || SafeString(error) };
        }
        if (!thrown) {
          try {
            result = snapshotPortableResult(result);
          } catch (error) {
            result = undefined;
            resultProblem = error?.message || "Returned value is not portable JSON data.";
          }
        }
        const assertions = new SafeArray(exerciseCase.assertions.length);
        let casePassed = true;
        for (let assertionIndex = 0; assertionIndex < exerciseCase.assertions.length; assertionIndex += 1) {
          const assertion = exerciseCase.assertions[assertionIndex];
          const outcome = assertionResult(assertion, result, thrown, resultProblem);
          const assertionEntry = { id: assertion.id, label: assertion.label, ...outcome };
          assertions[assertionIndex] = assertionEntry;
          if (!assertionEntry.passed) casePassed = false;
        }
        caseResults[caseIndex] = {
          id: exerciseCase.id,
          label: exerciseCase.label,
          passed: casePassed,
          assertions,
        };
      }
      const output = printable(caseResults);
      if (safeReflectApply(safeTextEncode, new SafeTextEncoder(), [output]).byteLength > payload.maxOutputBytes) {
        throw new SafeError("The runtime result exceeded the declared output limit.");
      }
      send({ id: payload.id, ok: true, cases: caseResults });
    } catch (error) {
      send({ id: payload.id, ok: false, error: error?.message || SafeString(error) });
    } finally {
      try { delete workerGlobal.__latentEntrypoint; } catch {}
    }
  });
})();\n`;

export type QuestionGroupRunToken = Readonly<{
  generation: number;
  questionKey: string;
  source: string;
}>;

export function createQuestionGroupRunGuard() {
  let generation = 0;
  return Object.freeze({
    begin(questionKey: string, source: string): QuestionGroupRunToken {
      generation += 1;
      return Object.freeze({ generation, questionKey, source });
    },
    invalidate() {
      generation += 1;
    },
    isCurrent(
      token: QuestionGroupRunToken,
      questionKey: string,
      source: string,
    ) {
      return token.generation === generation
        && token.questionKey === questionKey
        && token.source === source;
    },
  });
}

export const questionGroupPlayerJavaScript = `(() => {
  "use strict";
  const app = document.getElementById("app");
  const assetRoot = document.body.dataset.assetRoot;
  const libraryDigest = document.body.dataset.libraryDigest;
  const initialQuery = document.body.dataset.initialQuery;
  const learnerTransformOptions = ${JSON.stringify(QUESTION_GROUP_LEARNER_TRANSFORM_OPTIONS)};
  const runGuard = (${createQuestionGroupRunGuard.toString()})();
  const leechPolicy = { minimumAttempts: 3, minimumFailures: 2 };
  const escapeSelector = (value) => CSS.escape(value);
  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const browserRuntime = {
    supports(runtime) {
      if (runtime.environment !== "browser-worker") return false;
      if (runtime.engine === "esbuild-wasm" && runtime.engineVersion === "0.28.1") {
        return runtime.language === "javascript" || runtime.language === "typescript";
      }
      return runtime.language === "javascript"
        && runtime.engine === "native-javascript"
        && /^ES20\\d{2}$/.test(runtime.engineVersion);
    },
    async run(request) {
      if (!globalThis.esbuild) throw new Error("The TypeScript compiler did not load.");
      if (request.source.length > 200000) {
        throw new Error("Question source may not exceed 200,000 characters.");
      }
      const startedAt = performance.now();
      if (!browserRuntime.initialized) {
        browserRuntime.initialized = globalThis.esbuild.initialize({
          wasmURL: assetRoot + "esbuild.wasm",
          worker: true,
        });
      }
      await browserRuntime.initialized;
      const question = request.question;
      const invoke = question.entrypoint.kind === "function"
        ? "(...__latent_args) => " + question.entrypoint.functionName + "(...__latent_args)"
        : "(__latent_constructor_args, __latent_method_args) => { const __latent_instance = new "
          + question.entrypoint.className + "(...__latent_constructor_args); return __latent_instance."
          + question.entrypoint.methodName + "(...__latent_method_args); }";
      let compilationTimer;
      const compiled = await Promise.race([
        globalThis.esbuild.transform(
          request.source + "\\n;globalThis.__latentEntrypoint = " + invoke + ";\\n",
          {
            ...learnerTransformOptions,
            loader: question.language === "typescript" ? "ts" : "js",
          },
        ),
        new Promise((_, reject) => {
          compilationTimer = setTimeout(() => {
            reject(new Error("The browser runtime exceeded its " + request.runtime.limits.timeoutMs + " ms limit."));
          }, request.runtime.limits.timeoutMs);
        }),
      ]).finally(() => clearTimeout(compilationTimer));
      const worker = new Worker(assetRoot + "sandbox.worker.js");
      const id = crypto.randomUUID();
      const cases = request.mode === "examples"
        ? question.cases.filter((entry) => entry.visibility === "example")
        : question.cases;
      return new Promise((resolve, reject) => {
        const remainingTime = Math.max(
          1,
          request.runtime.limits.timeoutMs - (performance.now() - startedAt),
        );
        const timer = setTimeout(() => {
          worker.terminate();
          reject(new Error("The browser runtime exceeded its " + request.runtime.limits.timeoutMs + " ms limit."));
        }, remainingTime);
        worker.addEventListener("message", (event) => {
          if (event.data?.id !== id) return;
          clearTimeout(timer);
          worker.terminate();
          if (!event.data.ok) {
            reject(new Error(event.data.error || "The browser runtime failed."));
            return;
          }
          const returnedCases = event.data.cases;
          if (
            !Array.isArray(returnedCases)
            || returnedCases.length !== cases.length
            || new Set(returnedCases.map((entry) => entry?.id)).size !== returnedCases.length
          ) {
            reject(new Error("The isolated browser runtime returned an invalid case set."));
            return;
          }
          const normalizedCases = [];
          for (const expectedCase of cases) {
            const returnedCase = returnedCases.find((entry) => entry?.id === expectedCase.id);
            const expectedAssertionIds = expectedCase.assertions.map((assertion) => assertion.id);
            if (
              !returnedCase
              || !Array.isArray(returnedCase.assertions)
              || returnedCase.assertions.length !== expectedAssertionIds.length
              || new Set(returnedCase.assertions.map((entry) => entry?.id)).size
                !== returnedCase.assertions.length
              || expectedAssertionIds.some((assertionId) => (
                !returnedCase.assertions.some((entry) => (
                  entry?.id === assertionId
                  && typeof entry.passed === "boolean"
                  && typeof entry.label === "string"
                  && typeof entry.detail === "string"
                ))
              ))
            ) {
              reject(new Error("The isolated browser runtime returned invalid assertion results."));
              return;
            }
            const passed = returnedCase.assertions.every((entry) => entry.passed);
            if (typeof returnedCase.passed !== "boolean" || returnedCase.passed !== passed) {
              reject(new Error("The isolated browser runtime returned an inconsistent case result."));
              return;
            }
            normalizedCases.push({ ...returnedCase, passed });
          }
          resolve({
            passed: normalizedCases.every((entry) => entry.passed),
            cases: normalizedCases,
          });
        });
        worker.addEventListener("error", () => {
          clearTimeout(timer);
          worker.terminate();
          reject(new Error("The isolated browser runtime failed."));
        }, { once: true });
        worker.postMessage({
          id,
          code: compiled.code,
          cases,
          maxOutputBytes: request.runtime.limits.maxOutputBytes,
        });
      });
    },
  };
  const injected = globalThis.LatentQuestionPlayerRuntime;
  const runtimeAdapter = injected && typeof injected.supports === "function" && typeof injected.run === "function"
    ? injected
    : browserRuntime;
  let progressDatabase;
  const openProgressDatabase = () => {
    if (progressDatabase) return progressDatabase;
    progressDatabase = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB is unavailable."));
        return;
      }
      const request = indexedDB.open("latent-question-groups", 1);
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains("progress")) {
          request.result.createObjectStore("progress");
        }
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("Could not open practice progress.")));
      request.addEventListener("blocked", () => reject(new Error("Practice progress upgrade is blocked.")));
    });
    return progressDatabase;
  };
  const progressPrefix = (library) => "latent.question-groups.progress.v1:" + library.library.id + "@" + library.library.version + ":" + libraryDigest + ":";
  const progressStorageKey = (library, group, question) => progressPrefix(library) + group.id + "/" + question.id;
  const validStoredProgress = (entry, library, group, question) => entry
    && entry.format === "latent-question-group-progress"
    && entry.schemaVersion === 1
    && entry.libraryId === library.library.id
    && entry.libraryVersion === library.library.version
    && entry.libraryDigest === libraryDigest
    && entry.groupId === group.id
    && entry.questionId === question.id
    && entry.contractVersion === contractVersion(library, group, question)
    && (entry.status === "attempted" || entry.status === "solved")
    && Number.isSafeInteger(entry.attemptCount)
    && entry.attemptCount > 0
    && Number.isSafeInteger(entry.failureCount)
    && entry.failureCount >= 0
    && entry.failureCount <= entry.attemptCount;
  const transactionDone = (transaction) => new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("Practice progress transaction was aborted.")));
    transaction.addEventListener("error", () => reject(transaction.error || new Error("Practice progress transaction failed.")));
  });
  const requestValue = (request) => new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("Practice progress request failed.")));
  });
  const readProgress = async (library) => {
    try {
      const database = await openProgressDatabase();
      const transaction = database.transaction("progress", "readonly");
      const values = await requestValue(transaction.objectStore("progress").getAll());
      await transactionDone(transaction);
      const progress = {};
      for (const entry of values) {
        const group = library.groups.find((candidate) => candidate.id === entry?.groupId);
        const question = group?.questions.find((candidate) => candidate.id === entry?.questionId);
        if (group && question && validStoredProgress(entry, library, group, question)) {
          progress[questionKey(group, question)] = entry;
        }
      }
      return progress;
    } catch {
      return {};
    }
  };
  const writeProgress = async (library, group, question, passed, fallback) => {
    const key = questionKey(group, question);
    const createNext = (stored) => {
      const previous = validStoredProgress(stored, library, group, question)
        ? stored
        : { attemptCount: 0, failureCount: 0 };
      const attemptedAt = Date.now();
      return {
        format: "latent-question-group-progress",
        schemaVersion: 1,
        libraryId: library.library.id,
        libraryVersion: library.library.version,
        libraryDigest,
        groupId: group.id,
        questionId: question.id,
        contractVersion: contractVersion(library, group, question),
        status: passed ? "solved" : "attempted",
        attemptCount: previous.attemptCount + 1,
        failureCount: previous.failureCount + (passed ? 0 : 1),
        lastAttemptAt: attemptedAt,
        solvedAt: passed ? attemptedAt : null,
        updatedAt: attemptedAt,
      };
    };
    try {
      const database = await openProgressDatabase();
      const transaction = database.transaction("progress", "readwrite");
      const store = transaction.objectStore("progress");
      const storageKey = progressStorageKey(library, group, question);
      const previous = await requestValue(store.get(storageKey));
      const next = createNext(previous);
      store.put(next, storageKey);
      await transactionDone(transaction);
      return next;
    } catch {
      return createNext(fallback[key]);
    }
  };
  const isLeech = (entry) => entry
    && entry.status !== "solved"
    && entry.attemptCount >= leechPolicy.minimumAttempts
    && entry.failureCount >= leechPolicy.minimumFailures;
  const questionKey = (group, question) => group.id + "/" + question.id;
  const statusFor = (progress, key) => progress[key]?.status || "new";
  const contractVersion = (library, group, question) => "question-groups-v" + library.schemaVersion + ":" + library.library.id + "@" + library.library.version + ":sha256:" + libraryDigest + ":" + group.id + "/" + question.id;
  const sha256 = async (bytes) => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  };
  const load = async () => {
    const response = await fetch(document.body.dataset.libraryUrl, { credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error("Could not load the Question Group library.");
    const bytes = await response.arrayBuffer();
    if (await sha256(bytes) !== libraryDigest) {
      throw new Error("Question Group library bytes do not match this built player.");
    }
    const library = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const progress = await readProgress(library);
    const all = library.groups.flatMap((group) => group.questions.map((question) => ({ group, question })));
    const visibleEntries = () => initialQuery === "leeches"
      ? all.filter(({ group, question }) => isLeech(progress[questionKey(group, question)]))
      : all;
    const emptyView = () => text("section", initialQuery === "leeches"
      ? "No leeches yet. A question appears here after at least three attempts and two misses, and leaves when solved."
      : "This library has no questions.", "empty");
    const initialVisible = visibleEntries();
    app.replaceChildren();
    app.removeAttribute("aria-busy");
    if (!initialVisible.length) {
      app.append(emptyView());
      return;
    }
    let active = initialVisible[0];
    let source = active.question.starterCode;
    let running = false;
    const layout = document.createElement("div");
    layout.className = "layout";
    const sidebar = document.createElement("aside");
    sidebar.className = "library";
    const libraryHeader = document.createElement("header");
    libraryHeader.append(text("span", initialQuery === "leeches" ? "Progress query · leeches" : "Question Group library", "eyebrow"));
    libraryHeader.append(text("h1", library.library.title));
    libraryHeader.append(text("p", library.library.description));
    sidebar.append(libraryHeader);
    const questionCopy = document.createElement("section");
    questionCopy.className = "question-copy";
    questionCopy.id = "question";
    const workspace = document.createElement("section");
    workspace.className = "workspace";
    const workspaceHeader = document.createElement("header");
    const sourcePath = text("code", active.question.path);
    workspaceHeader.append(sourcePath);
    const editor = document.createElement("textarea");
    editor.setAttribute("aria-label", "Learner source");
    editor.spellcheck = false;
    const actions = document.createElement("div");
    actions.className = "actions";
    const examplesButton = text("button", "Run examples");
    examplesButton.type = "button";
    const checkButton = text("button", "Check solution", "primary");
    checkButton.type = "button";
    actions.append(examplesButton, checkButton);
    const results = document.createElement("section");
    results.className = "results";
    results.setAttribute("aria-live", "polite");
    workspace.append(workspaceHeader, editor, actions, results);
    layout.append(sidebar, questionCopy, workspace);
    app.append(layout);
    const renderNavigation = () => {
      sidebar.querySelectorAll(".group").forEach((node) => node.remove());
      const visible = visibleEntries();
      for (const group of library.groups) {
        const groupQuestions = visible.filter((entry) => entry.group.id === group.id);
        if (!groupQuestions.length) continue;
        const section = document.createElement("section");
        section.className = "group";
        section.append(text("h2", group.title));
        const list = document.createElement("ol");
        for (const entry of groupQuestions) {
          const item = document.createElement("li");
          const button = text("button", entry.question.title, "question-link");
          button.type = "button";
          button.disabled = running;
          button.setAttribute("aria-current", String(entry === active));
          const dot = document.createElement("i");
          dot.className = "status-dot";
          dot.dataset.status = statusFor(progress, questionKey(entry.group, entry.question));
          button.prepend(dot);
          button.addEventListener("click", () => {
            runGuard.invalidate();
            running = false;
            active = entry;
            source = entry.question.starterCode;
            renderActive();
            renderNavigation();
          });
          item.append(button);
          list.append(item);
        }
        section.append(list);
        sidebar.append(section);
      }
    };
    const updateActionAvailability = () => {
      const runtime = library.runtimes.find((entry) => entry.id === active.question.runtimeId);
      const supported = Boolean(runtime && runtimeAdapter.supports(runtime));
      editor.disabled = running || !supported;
      examplesButton.disabled = running || !supported;
      checkButton.disabled = running || !supported;
      return supported;
    };
    const renderActive = () => {
      const { group, question } = active;
      questionCopy.replaceChildren(
        text("span", group.title + " · " + question.difficulty, "eyebrow"),
        text("h2", question.title),
        text("p", question.prompt),
      );
      const constraintsTitle = text("h3", "Constraints");
      const constraints = document.createElement("ul");
      question.constraints.forEach((entry) => constraints.append(text("li", entry)));
      questionCopy.append(constraintsTitle, constraints);
      sourcePath.textContent = question.path;
      editor.value = source;
      results.replaceChildren(text("p", "Run the examples, then check all visible cases."));
      const supported = updateActionAvailability();
      if (!supported) {
        results.replaceChildren(text("p", "This trusted host did not inject a compatible runtime. Portable data cannot load one.", "error"));
      }
    };
    const run = async (mode) => {
      const { group, question } = active;
      const runtime = library.runtimes.find((entry) => entry.id === question.runtimeId);
      if (!runtime || !runtimeAdapter.supports(runtime)) return;
      source = editor.value;
      const runSource = source;
      const runQuestionKey = questionKey(group, question);
      const runToken = runGuard.begin(runQuestionKey, runSource);
      running = true;
      updateActionAvailability();
      renderNavigation();
      const isCurrentRun = () => (
        runGuard.isCurrent(
          runToken,
          questionKey(active.group, active.question),
          source,
        )
        && editor.value === runSource
      );
      results.replaceChildren(text("p", "Running in an isolated browser worker…"));
      try {
        const outcome = await runtimeAdapter.run({
          library,
          group,
          question,
          runtime,
          contractVersion: contractVersion(library, group, question),
          source,
          mode,
        });
        if (!isCurrentRun()) return;
        const heading = text("h3", outcome.passed ? "All checks passed" : "Keep working");
        const list = document.createElement("ol");
        for (const exerciseCase of outcome.cases) {
          const detail = exerciseCase.assertions
            ? exerciseCase.assertions.map((entry) => entry.label + ": " + entry.detail).join(" ")
            : exerciseCase.detail || exerciseCase.id;
          const item = text("li", detail);
          item.dataset.passed = String(exerciseCase.passed);
          list.append(item);
        }
        results.replaceChildren(heading, list);
        if (mode === "check") {
          const key = questionKey(group, question);
          const nextProgress = await writeProgress(
            library,
            group,
            question,
            outcome.passed,
            progress,
          );
          if (!isCurrentRun()) return;
          progress[key] = nextProgress;
          if (initialQuery === "leeches" && !isLeech(progress[key])) {
            const remaining = visibleEntries();
            runGuard.invalidate();
            running = false;
            if (!remaining.length) {
              app.replaceChildren(emptyView());
              return;
            }
            active = remaining[0];
            source = active.question.starterCode;
            renderActive();
          }
          renderNavigation();
        }
      } catch (error) {
        if (!isCurrentRun()) return;
        results.replaceChildren(text("p", error?.message || String(error), "error"));
      } finally {
        if (isCurrentRun()) {
          running = false;
          updateActionAvailability();
          renderNavigation();
        }
      }
    };
    editor.addEventListener("input", () => {
      source = editor.value;
      if (running) {
        runGuard.invalidate();
        running = false;
        updateActionAvailability();
        renderNavigation();
      }
    });
    examplesButton.addEventListener("click", () => run("examples"));
    checkButton.addEventListener("click", () => run("check"));
    renderNavigation();
    renderActive();
  };
  load().catch((error) => {
    app.removeAttribute("aria-busy");
    app.replaceChildren(text("p", error?.message || String(error), "empty error"));
  });
})();\n`;

async function sha256Hex(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function compilerAssets() {
  const require = createRequire(import.meta.url);
  const [javascript, wasm] = await Promise.all([
    readFile(require.resolve("esbuild-wasm/lib/browser.min.js"), "utf8"),
    readFile(require.resolve("esbuild-wasm/esbuild.wasm")),
  ]);
  return { javascript, wasm: new Uint8Array(wasm) };
}

function bundledRuntimeSupported(
  runtime: QuestionGroupLibrary["runtimes"][number],
) {
  if (runtime.environment !== "browser-worker") return false;
  if (runtime.engine === "esbuild-wasm" && runtime.engineVersion === "0.28.1") {
    return runtime.language === "javascript" || runtime.language === "typescript";
  }
  return runtime.language === "javascript"
    && runtime.engine === "native-javascript"
    && /^ES20\d{2}$/.test(runtime.engineVersion);
}

export async function buildStandaloneQuestionGroupSite(
  input: QuestionGroupLibrary,
  options: {
    runtimeAdapterJavaScript?: string;
  } = {},
): Promise<QuestionGroupSiteFiles> {
  const validation = validateQuestionGroupLibrary(input);
  if (!validation.valid) {
    throw new Error(
      `Cannot build an invalid Question Group library: ${validation.errors[0]?.message ?? "unknown error"}`,
    );
  }
  const library = validation.library;
  const libraryJson = canonicalQuestionGroupLibraryJson(library);
  const libraryBytes = new TextEncoder().encode(libraryJson);
  const sha256 = await sha256Hex(libraryBytes);
  const compiler = await compilerAssets();
  const runtimeAdapter = options.runtimeAdapterJavaScript
    ?? "/* Build-time injection seam. Leave undefined to use the bundled JavaScript/TypeScript browser worker. */\n";
  const files: QuestionGroupSiteFiles = {
    ".latent-build": `${QUESTION_GROUP_BUILD_MARKER}\n`,
    "index.html": renderIndex(library, sha256, "all").replace(/[ \t]+$/gm, ""),
    "leeches/index.html": renderIndex(library, sha256, "leeches").replace(/[ \t]+$/gm, ""),
    "question-group-library.json": libraryJson,
    "assets/player.css": questionGroupPlayerCss,
    "assets/player.js": questionGroupPlayerJavaScript,
    "assets/runtime-adapter.js": runtimeAdapter,
    "assets/sandbox.worker.js": questionGroupSandboxWorkerJavaScript,
    "assets/esbuild.js": compiler.javascript,
    "assets/esbuild.wasm": compiler.wasm,
    "assets/favicon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#f5f1e9"/><circle cx="32" cy="32" r="15" fill="#675674"/></svg>\n`,
    "_headers": `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'

/assets/sandbox.worker.js
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; object-src 'none'

/question-group-library.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
`,
    "README.txt": `This is a self-hosted Latent Question Group practice site.

Publish this entire directory on a static host. The bundled adapter runs only
declared JavaScript and TypeScript browser-worker requirements. Learner code
runs in a disposable worker with time and output limits. The checker captures
and freezes its grading intrinsics before learner evaluation, accepts only
structured-cloneable finite JSON results with plain prototypes, follows only
own result properties, and revalidates worker messages. It lowers native
dynamic-import syntax before worker evaluation, removes known browser network
capabilities, and fails closed if one cannot be disabled. The worker provides
no module loader or string-evaluating timer APIs. Apply the included _headers
policy as defense in depth when your static host supports it. Python and
host-managed requirements remain disabled unless trusted platform code is
injected at build time.

The leech-only view is /leeches/. It queries device-local progress and does not
introduce another content format. Checks update progress in an atomic IndexedDB
transaction, so concurrent tabs do not discard attempts.
`,
  };
  files["build-report.json"] = `${JSON.stringify({
    format: "latent-question-group-build-report",
    schemaVersion: 1,
    playerVersion: QUESTION_GROUP_PLAYER_VERSION,
    libraryId: library.library.id,
    version: library.library.version,
    sha256,
    libraryBytes: libraryBytes.byteLength,
    browserRuntimes: library.runtimes
      .filter(bundledRuntimeSupported)
      .map((runtime) => runtime.id),
    files: [...Object.keys(files), "build-report.json"].sort(),
  }, null, 2)}\n`;
  return files;
}
