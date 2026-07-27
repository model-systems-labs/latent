import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import {
  canonicalQuestionGroupLibraryJson,
  type QuestionGroupLibrary,
  validateQuestionGroupLibrary,
} from "./question-group.js";
import {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
  type LearnerUiAppearance,
  type LearnerUiNavigationItem,
  type LearnerUiTheme,
} from "./learner-ui.js";

export const QUESTION_GROUP_BUILD_MARKER = "latent-question-groups-static-build-v1";
export const QUESTION_GROUP_PLAYER_VERSION = 1 as const;
export const QUESTION_GROUP_DEFAULT_META_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");
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

export type QuestionGroupSiteCopy = Readonly<{
  allNavigationLabel: string;
  reviewNavigationLabel: string;
  allEyebrow: string;
  reviewEyebrow: string;
  emptyAll: string;
  emptyReview: string;
  loading: string;
  runExamples: string;
  checkSolution: string;
  cancelRun: string;
  runCanceled: string;
  publicExamplesHeading: string;
  inputLabel: string;
  expectedLabel: string;
  initialResults: string;
  running: string;
  passedHeading: string;
  failedHeading: string;
  problemSingular: string;
  problemPlural: string;
  continueLabel: string;
  editorLabel: string;
  draftSaved: string;
  draftRestored: string;
  draftSessionOnly: string;
  runtimeUnavailable: string;
}>;

export type QuestionGroupSiteUi = Readonly<{
  productName?: string;
  headerMeta?: string;
  globalNavigationLabel?: string;
  globalNavigation?: readonly LearnerUiNavigationItem[];
  navigationLabel?: string;
  menuLabel?: string;
  reviewDirectory?: string;
  copy?: Partial<QuestionGroupSiteCopy>;
  footerSummary?: string;
  attribution?: string;
  appearance?: LearnerUiAppearance;
  /** @deprecated Prefer appearance.theme for trusted color overrides. */
  theme?: LearnerUiTheme;
  faviconSvg?: string;
}>;

export type QuestionGroupSiteOptions = Readonly<{
  runtimeAdapterJavaScript?: string;
  bundledBrowserRuntime?: boolean;
  metaContentSecurityPolicy?: string;
  ui?: QuestionGroupSiteUi;
}>;

const defaultQuestionGroupSiteCopy = Object.freeze({
  allNavigationLabel: "Practice",
  reviewNavigationLabel: "Review",
  allEyebrow: "Practice",
  reviewEyebrow: "Repeated-miss review",
  emptyAll: "No practice problems are available.",
  emptyReview: "No repeated misses yet. A problem appears here after three attempts and two misses, and leaves when solved.",
  loading: "Loading practice…",
  runExamples: "Run examples",
  checkSolution: "Check solution",
  cancelRun: "Cancel",
  runCanceled: "Run canceled. Your draft is unchanged.",
  publicExamplesHeading: "Public example",
  inputLabel: "Input",
  expectedLabel: "Expected",
  initialResults: "Run the examples, then check the full solution.",
  running: "Running your code…",
  passedHeading: "All checks passed",
  failedHeading: "Keep working",
  problemSingular: "problem",
  problemPlural: "problems",
  continueLabel: "Continue",
  editorLabel: "Solution editor",
  draftSaved: "Draft saved",
  draftRestored: "Draft restored",
  draftSessionOnly: "Draft kept for this visit",
  runtimeUnavailable: "This practice environment is unavailable right now. You can keep editing your draft.",
} satisfies QuestionGroupSiteCopy);

type NormalizedQuestionGroupSiteUi = Readonly<{
  productName: string;
  headerMeta: string;
  globalNavigationLabel: string;
  globalNavigation?: readonly LearnerUiNavigationItem[];
  navigationLabel: string;
  menuLabel: string;
  reviewDirectory: string;
  copy: QuestionGroupSiteCopy;
  footerSummary: string;
  attribution: string;
  theme: Required<LearnerUiTheme>;
  faviconSvg?: string;
}>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteText(value: string, label: string, maximum = 300) {
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || value.length > maximum
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`${label} must be non-empty text no longer than ${maximum} characters.`);
  }
  return value.trim();
}

function normalizeMetaContentSecurityPolicy(value?: string) {
  if (value === undefined) return QUESTION_GROUP_DEFAULT_META_CONTENT_SECURITY_POLICY;
  const policy = siteText(value, "metaContentSecurityPolicy", 2_048);
  if (/[\r\n]/.test(policy)) {
    throw new Error("metaContentSecurityPolicy must be a single line.");
  }
  return policy;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeQuestionGroupSiteUi(
  library: QuestionGroupLibrary,
  input: QuestionGroupSiteUi = {},
): NormalizedQuestionGroupSiteUi {
  const supportedUiFields = new Set([
    "productName",
    "headerMeta",
    "globalNavigationLabel",
    "globalNavigation",
    "navigationLabel",
    "menuLabel",
    "reviewDirectory",
    "copy",
    "footerSummary",
    "attribution",
    "appearance",
    "theme",
    "faviconSvg",
  ]);
  const unknownUiFields = Object.keys(input).filter((key) => !supportedUiFields.has(key));
  if (unknownUiFields.length) {
    throw new Error(`Unknown Question Group site field: ${unknownUiFields[0]}`);
  }
  const reviewDirectory = input.reviewDirectory ?? "leeches";
  const reservedDirectories = new Set([
    "assets",
    "index.html",
    "question-group-library.json",
    "build-report.json",
    "_headers",
  ]);
  if (
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(reviewDirectory)
    || reservedDirectories.has(reviewDirectory)
  ) {
    throw new Error("Question Group reviewDirectory must be one safe relative directory name.");
  }
  const unknownCopyKeys = Object.keys(input.copy ?? {}).filter(
    (key) => !(key in defaultQuestionGroupSiteCopy),
  );
  if (unknownCopyKeys.length) {
    throw new Error(`Unknown Question Group site copy field: ${unknownCopyKeys[0]}`);
  }
  const copy = Object.fromEntries(
    Object.entries(defaultQuestionGroupSiteCopy).map(([key, fallback]) => [
      key,
      siteText(
        input.copy?.[key as keyof QuestionGroupSiteCopy] ?? fallback,
        `ui.copy.${key}`,
        key.startsWith("empty") ? 500 : 200,
      ),
    ]),
  ) as unknown as QuestionGroupSiteCopy;
  const faviconSvg = input.faviconSvg;
  if (
    faviconSvg !== undefined
    && (
      typeof faviconSvg !== "string"
      || faviconSvg.length > 10_000
      || !/^\s*<svg\b[\s\S]*<\/svg>\s*$/i.test(faviconSvg)
      || /<script\b|<foreignObject\b|\son[a-z]+\s*=|\bhref\s*=|\burl\s*\(/i.test(faviconSvg)
    )
  ) {
    throw new Error("ui.faviconSvg must be a bounded, inert inline SVG.");
  }
  if (input.appearance !== undefined && input.theme !== undefined) {
    throw new Error(
      "Question Group site ui.appearance and ui.theme cannot be configured together.",
    );
  }
  const theme = resolveLearnerUiTheme(
    input.appearance
      ?? (input.theme === undefined ? {} : { theme: input.theme }),
  );
  const globalNavigation = input.globalNavigation?.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`ui.globalNavigation[${index}] must be a navigation item.`);
    }
    const unknownKeys = Object.keys(item).filter(
      (key) => !new Set(["label", "href", "current", "dataView"]).has(key),
    );
    if (unknownKeys.length) {
      throw new Error(`Unknown ui.globalNavigation[${index}] field: ${unknownKeys[0]}`);
    }
    if (typeof item.current !== "undefined" && typeof item.current !== "boolean") {
      throw new Error(`ui.globalNavigation[${index}].current must be a boolean.`);
    }
    return Object.freeze({
      label: siteText(item.label, `ui.globalNavigation[${index}].label`, 120),
      href: siteText(item.href, `ui.globalNavigation[${index}].href`, 500),
      ...(item.current === undefined ? {} : { current: item.current }),
      ...(item.dataView === undefined
        ? {}
        : { dataView: siteText(item.dataView, `ui.globalNavigation[${index}].dataView`, 80) }),
    });
  });
  if (globalNavigation && globalNavigation.length === 0) {
    throw new Error("ui.globalNavigation must include at least one item when configured.");
  }
  return Object.freeze({
    productName: siteText(input.productName ?? library.library.title, "ui.productName", 160),
    headerMeta: siteText(input.headerMeta ?? library.library.version, "ui.headerMeta", 160),
    globalNavigationLabel: siteText(
      input.globalNavigationLabel ?? "Learning experiences",
      "ui.globalNavigationLabel",
      160,
    ),
    ...(globalNavigation === undefined
      ? {}
      : { globalNavigation: Object.freeze(globalNavigation) }),
    navigationLabel: siteText(input.navigationLabel ?? "Practice navigation", "ui.navigationLabel", 160),
    menuLabel: siteText(input.menuLabel ?? "Menu", "ui.menuLabel", 80),
    reviewDirectory,
    copy: Object.freeze(copy),
    footerSummary: siteText(
      input.footerSummary ?? "Progress is saved on this device for this exact problem set.",
      "ui.footerSummary",
      240,
    ),
    attribution: siteText(input.attribution ?? "Built with Latent.", "ui.attribution", 160),
    theme,
    ...(faviconSvg === undefined ? {} : { faviconSvg }),
  });
}

function renderIndex(
  library: QuestionGroupLibrary,
  digest: string,
  initialQuery: "all" | "leeches",
  ui: NormalizedQuestionGroupSiteUi,
  bundledBrowserRuntime: boolean,
  metaContentSecurityPolicy: string,
) {
  const root = initialQuery === "leeches" ? "../" : "./";
  const description = initialQuery === "leeches"
    ? `Review repeatedly missed questions from ${library.library.title}.`
    : library.library.description;
  const globalNavigation = ui.globalNavigation?.map((item) => ({
    ...item,
    href: root === "./"
      ? item.href
      : root + (item.href.startsWith("./") ? item.href.slice(2) : item.href),
  }));
  const header = renderLearnerHeader({
    productName: ui.productName,
    homeHref: root,
    globalNavigationLabel: ui.globalNavigationLabel,
    ...(globalNavigation === undefined ? {} : { globalNavigation }),
    navigationLabel: ui.navigationLabel,
    menuLabel: ui.menuLabel,
    meta: ui.headerMeta,
    navigation: [
      {
        label: ui.copy.allNavigationLabel,
        href: root,
        current: initialQuery === "all",
      },
      {
        label: ui.copy.reviewNavigationLabel,
        href: initialQuery === "leeches" ? "./" : `./${ui.reviewDirectory}/`,
        current: initialQuery === "leeches",
      },
    ],
  });
  const footer = renderLearnerFooter({
    summary: ui.footerSummary,
    attribution: ui.attribution,
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(metaContentSecurityPolicy)}">
  <title>${escapeHtml(initialQuery === "leeches" ? `${ui.copy.reviewNavigationLabel} · ${library.library.title}` : library.library.title)}</title>
  <link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${root}assets/player.css">
</head>
<body class="learner-ui"
  data-library-url="${root}question-group-library.json"
  data-library-digest="${escapeHtml(digest)}"
  data-initial-query="${initialQuery}"
  data-asset-root="${root}assets/"
>
  <a class="learner-skip-link" href="#app">Skip to practice</a>
  <div class="learner-page">
  ${header}
  <main id="app" class="learner-main" tabindex="-1" aria-busy="true">
    <p class="learner-empty loading">${escapeHtml(ui.copy.loading)}</p>
  </main>
  ${footer}
  </div>
  <script src="${root}assets/learner-ui.js" defer></script>
  ${bundledBrowserRuntime ? `<script src="${root}assets/esbuild.js" defer></script>` : ""}
  <script src="${root}assets/runtime-adapter.js" defer></script>
  <script src="${root}assets/player.js" defer></script>
</body>
</html>
`;
}

const questionGroupLayoutCss = `
#app { max-width: none; }
.practice-layout {
  display: grid;
  grid-template-columns: minmax(15rem, 19rem) minmax(18rem, .78fr) minmax(28rem, 1.22fr);
  min-height: calc(100vh - var(--learner-header-height) - 3.5rem);
}
.library {
  overflow: auto;
  padding: clamp(1rem, 2vw, 1.5rem);
}
.library h1 {
  font-family: var(--learner-font-reading);
  font-size: clamp(1.55rem, 2.4vw, 2.15rem);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1.08;
  margin: .35rem 0 .75rem;
}
.library-header > p,
.question-copy > p {
  color: var(--learner-color-muted);
  line-height: 1.6;
}
.problem-navigation { margin-top: var(--learner-space-4); }
.problem-navigation > summary { margin-bottom: var(--learner-space-3); }
.group + .group {
  border-top: var(--learner-border);
  margin-top: var(--learner-space-4);
  padding-top: var(--learner-space-4);
}
.group h2 {
  font-size: .75rem;
  letter-spacing: .04em;
  margin: 0 0 var(--learner-space-2);
  text-transform: uppercase;
}
.question-link {
  font-size: .84rem;
  line-height: 1.35;
}
.question-copy {
  border-right: var(--learner-border);
  overflow: auto;
  padding: clamp(1.5rem, 3.5vw, 3rem);
}
.question-copy h2 {
  font-family: var(--learner-font-reading);
  font-size: clamp(2rem, 4vw, 3.6rem);
  font-weight: 500;
  letter-spacing: -.055em;
  line-height: 1;
  margin: .65rem 0 1rem;
}
.question-copy h3 {
  font-size: .82rem;
  letter-spacing: .06em;
  margin-top: var(--learner-space-6);
  text-transform: uppercase;
}
.question-copy li {
  color: var(--learner-color-muted);
  font-size: .84rem;
  line-height: 1.55;
  margin-bottom: .45rem;
}
.example-cases {
  display: grid;
  gap: var(--learner-space-3);
  list-style: none;
  padding: 0;
}
.example-cases li {
  background: var(--learner-color-surface-muted);
  border: var(--learner-border);
  border-radius: var(--learner-radius-sm);
  padding: var(--learner-space-3);
}
.example-cases code {
  display: block;
  font: .78rem/1.55 var(--learner-font-mono);
  overflow-wrap: anywhere;
}
.workspace {
  border: 0;
  border-radius: 0;
  display: grid;
  grid-template-rows: auto minmax(19rem, 1fr) auto minmax(10rem, .55fr);
  min-width: 0;
}
.workspace .learner-editor-toolbar { border-radius: 0; }
.draft-status {
  color: var(--learner-color-muted);
  font-size: .75rem;
  margin-left: var(--learner-space-3);
  text-align: right;
}
.workspace code { font: .75rem/1.4 var(--learner-font-mono); }
.workspace .learner-editor {
  min-height: 100%;
  resize: none;
}
.actions {
  background: var(--learner-color-surface);
  border-bottom: var(--learner-border);
  border-top: var(--learner-border);
  justify-content: flex-end;
  margin: 0;
  min-height: 4rem;
  padding: .65rem .85rem;
}
.workspace .learner-results {
  border: 0;
  border-radius: 0;
  margin: 0;
  overflow: auto;
}
.case-evidence {
  display: block;
  font: .76rem/1.5 var(--learner-font-mono);
  margin-top: var(--learner-space-1);
  overflow-wrap: anywhere;
}
.error { color: var(--learner-color-danger); }
@media (max-width: 1120px) {
  .practice-layout {
    grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr);
  }
  .question-copy {
    border-bottom: var(--learner-border);
    border-right: 0;
  }
  .workspace {
    grid-column: 2;
    grid-row: 2;
    min-height: 46rem;
  }
  .library { grid-row: 1 / span 2; }
}
@media (max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px) {
  .practice-layout { display: block; }
  .library,
  .question-copy {
    border-bottom: var(--learner-border);
    border-right: 0;
  }
  .workspace { min-height: 46rem; }
  .problem-navigation .learner-nav-list { columns: 2; column-gap: var(--learner-space-5); }
}
@media (max-width: ${LEARNER_UI_BREAKPOINTS.compact}px) {
  .library { padding: var(--learner-space-4); }
  .library-header > p { display: none; }
  .question-copy { padding: var(--learner-space-5) var(--learner-space-4); }
  .question-copy h2 { font-size: clamp(1.9rem, 10vw, 2.7rem); }
  .workspace {
    grid-template-rows: auto minmax(22rem, 1fr) auto minmax(10rem, .55fr);
  }
  .actions .learner-button { flex: 1 1 9rem; }
  .problem-navigation .learner-nav-list { columns: 1; }
}
`;

export const questionGroupPlayerCss = `${createLearnerUiCss()}\n${questionGroupLayoutCss}`;

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

function renderQuestionGroupPlayerJavaScript(
  copy: QuestionGroupSiteCopy,
  bundledBrowserRuntime: boolean,
) {
  return `(() => {
  "use strict";
  const app = document.getElementById("app");
  const assetRoot = document.body.dataset.assetRoot;
  const libraryDigest = document.body.dataset.libraryDigest;
  const initialQuery = document.body.dataset.initialQuery;
  const copy = ${JSON.stringify(copy)};
  const bundledBrowserRuntime = ${JSON.stringify(bundledBrowserRuntime)};
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
      if (request.signal?.aborted) throw new Error("Run canceled.");
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
        ? "(__latent_constructor_args, __latent_method_args) => "
          + question.entrypoint.functionName + "(...__latent_method_args)"
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
      if (request.signal?.aborted) throw new Error("Run canceled.");
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
        let timer;
        const cleanup = () => {
          clearTimeout(timer);
          request.signal?.removeEventListener("abort", cancel);
          worker.terminate();
        };
        const cancel = () => {
          cleanup();
          reject(new Error("Run canceled."));
        };
        timer = setTimeout(() => {
          cleanup();
          reject(new Error("The browser runtime exceeded its " + request.runtime.limits.timeoutMs + " ms limit."));
        }, remainingTime);
        request.signal?.addEventListener("abort", cancel, { once: true });
        worker.addEventListener("message", (event) => {
          if (event.data?.id !== id) return;
          cleanup();
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
          cleanup();
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
    : bundledBrowserRuntime
      ? browserRuntime
      : {
          supports() { return false; },
          async run() {
            throw new Error("This build requires a trusted host runtime adapter.");
          },
        };
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
  const draftPrefix = (library) => "latent.question-groups.draft.v1:" + library.library.id + "@" + library.library.version + ":" + libraryDigest + ":";
  const draftStorageKey = (library, group, question) => draftPrefix(library) + group.id + "/" + question.id;
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
  const validStoredDraft = (entry, library, group, question) => entry
    && entry.format === "latent-question-group-draft"
    && entry.schemaVersion === 1
    && entry.libraryId === library.library.id
    && entry.libraryVersion === library.library.version
    && entry.libraryDigest === libraryDigest
    && entry.groupId === group.id
    && entry.questionId === question.id
    && entry.contractVersion === contractVersion(library, group, question)
    && typeof entry.source === "string"
    && entry.source.length <= 200000
    && Number.isSafeInteger(entry.updatedAt)
    && entry.updatedAt > 0;
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
  const readDrafts = async (library) => {
    try {
      const database = await openProgressDatabase();
      const transaction = database.transaction("progress", "readonly");
      const values = await requestValue(transaction.objectStore("progress").getAll());
      await transactionDone(transaction);
      const drafts = {};
      for (const entry of values) {
        const group = library.groups.find((candidate) => candidate.id === entry?.groupId);
        const question = group?.questions.find((candidate) => candidate.id === entry?.questionId);
        if (group && question && validStoredDraft(entry, library, group, question)) {
          drafts[questionKey(group, question)] = entry;
        }
      }
      return drafts;
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
  const writeDraft = async (library, group, question, source) => {
    const entry = {
      format: "latent-question-group-draft",
      schemaVersion: 1,
      libraryId: library.library.id,
      libraryVersion: library.library.version,
      libraryDigest,
      groupId: group.id,
      questionId: question.id,
      contractVersion: contractVersion(library, group, question),
      source,
      updatedAt: Date.now(),
    };
    if (source.length > 200000) return { entry, persisted: false };
    try {
      const database = await openProgressDatabase();
      const transaction = database.transaction("progress", "readwrite");
      transaction.objectStore("progress").put(
        entry,
        draftStorageKey(library, group, question),
      );
      await transactionDone(transaction);
      return { entry, persisted: true };
    } catch {
      return { entry, persisted: false };
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
    if (!response.ok) throw new Error("Could not load this practice set.");
    const bytes = await response.arrayBuffer();
    if (await sha256(bytes) !== libraryDigest) {
      throw new Error("This practice set did not pass its integrity check.");
    }
    const library = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const [progress, drafts] = await Promise.all([
      readProgress(library),
      readDrafts(library),
    ]);
    const all = library.groups.flatMap((group) => group.questions.map((question) => ({ group, question })));
    const draftSourceFor = (group, question) => (
      drafts[questionKey(group, question)]?.source ?? question.starterCode
    );
    const visibleEntries = () => initialQuery === "leeches"
      ? all.filter(({ group, question }) => isLeech(progress[questionKey(group, question)]))
      : all;
    const emptyView = () => {
      const empty = text(
        "section",
        initialQuery === "leeches" ? copy.emptyReview : copy.emptyAll,
        "learner-empty",
      );
      empty.tabIndex = -1;
      empty.setAttribute("role", "status");
      empty.setAttribute("aria-live", "polite");
      return empty;
    };
    const initialVisible = visibleEntries();
    app.replaceChildren();
    app.removeAttribute("aria-busy");
    if (!initialVisible.length) {
      app.append(emptyView());
      return;
    }
    let active = initialVisible.find(({ group, question }) => (
      statusFor(progress, questionKey(group, question)) !== "solved"
    )) || initialVisible[0];
    let source = draftSourceFor(active.group, active.question);
    let running = false;
    let activeRunController = null;
    let draftWriteActive = false;
    const pendingDraftWrites = new Map();
    const layout = document.createElement("div");
    layout.className = "practice-layout";
    const sidebar = document.createElement("aside");
    sidebar.className = "learner-sidebar library";
    const libraryHeader = document.createElement("div");
    libraryHeader.className = "library-header";
    libraryHeader.append(text("span", initialQuery === "leeches" ? copy.reviewEyebrow : copy.allEyebrow, "learner-eyebrow"));
    libraryHeader.append(text("h1", library.library.title));
    libraryHeader.append(text("p", library.library.description));
    const progressSummary = document.createElement("div");
    progressSummary.className = "learner-progress-summary";
    const progressText = text("strong", "");
    const progressBar = document.createElement("progress");
    progressBar.className = "learner-progress";
    progressBar.max = all.length;
    const resume = document.createElement("p");
    resume.className = "learner-resume";
    progressSummary.append(progressText, progressBar, resume);
    libraryHeader.append(progressSummary);
    sidebar.append(libraryHeader);
    const questionCopy = document.createElement("section");
    questionCopy.className = "learner-content question-copy";
    questionCopy.id = "question";
    const workspace = document.createElement("section");
    workspace.className = "learner-editor-frame workspace";
    const workspaceHeader = document.createElement("div");
    workspaceHeader.className = "learner-editor-toolbar";
    const sourcePath = text("code", active.question.path);
    const draftStatus = text("span", "", "draft-status");
    draftStatus.setAttribute("role", "status");
    draftStatus.setAttribute("aria-live", "polite");
    draftStatus.setAttribute("aria-atomic", "true");
    workspaceHeader.append(sourcePath, draftStatus);
    const editor = document.createElement("textarea");
    editor.className = "learner-editor";
    editor.setAttribute("aria-label", copy.editorLabel);
    editor.spellcheck = false;
    const persistDraftWrites = async () => {
      if (draftWriteActive) return;
      draftWriteActive = true;
      try {
        while (pendingDraftWrites.size) {
          const pending = Array.from(pendingDraftWrites.values());
          pendingDraftWrites.clear();
          for (const request of pending) {
            const { entry, persisted } = await writeDraft(
              library,
              request.group,
              request.question,
              request.source,
            );
            if (drafts[request.key]?.source === request.source) {
              drafts[request.key] = entry;
            }
            if (
              questionKey(active.group, active.question) === request.key
              && editor.value === request.source
            ) {
              draftStatus.textContent = persisted
                ? copy.draftSaved
                : copy.draftSessionOnly;
            }
          }
        }
      } finally {
        draftWriteActive = false;
      }
    };
    const actions = document.createElement("div");
    actions.className = "learner-button-row actions";
    const examplesButton = text("button", copy.runExamples, "learner-button");
    examplesButton.type = "button";
    const checkButton = text("button", copy.checkSolution, "learner-button");
    checkButton.type = "button";
    checkButton.dataset.variant = "primary";
    checkButton.title = copy.checkSolution + " (Ctrl/Command+Enter)";
    const cancelButton = text("button", copy.cancelRun, "learner-button");
    cancelButton.type = "button";
    cancelButton.dataset.variant = "secondary";
    cancelButton.hidden = true;
    actions.append(examplesButton, checkButton, cancelButton);
    const resultAnnouncement = text(
      "p",
      "",
      "learner-sr-only question-result-announcement",
    );
    resultAnnouncement.setAttribute("role", "status");
    resultAnnouncement.setAttribute("aria-live", "polite");
    resultAnnouncement.setAttribute("aria-atomic", "true");
    const results = document.createElement("section");
    results.className = "learner-results";
    results.setAttribute("aria-label", copy.initialResults);
    results.tabIndex = 0;
    workspace.append(workspaceHeader, editor, actions, resultAnnouncement, results);
    layout.append(sidebar, questionCopy, workspace);
    app.append(layout);
    const navigation = document.createElement("details");
    navigation.className = "learner-mobile-panel problem-navigation";
    navigation.dataset.learnerCollapseAt = "stacked";
    const navigationBreakpoint = globalThis.matchMedia(
      "(max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px)",
    );
    navigation.open = !navigationBreakpoint.matches;
    const navigationSummary = text("summary", "");
    const navigationContent = document.createElement("div");
    navigationContent.className = "learner-mobile-panel__content";
    navigation.append(navigationSummary, navigationContent);
    sidebar.append(navigation);
    const updateProgressSummary = () => {
      const solved = all.filter(({ group, question }) => (
        statusFor(progress, questionKey(group, question)) === "solved"
      )).length;
      const itemLabel = all.length === 1 ? copy.problemSingular : copy.problemPlural;
      progressText.textContent = solved + " of " + all.length + " " + itemLabel + " solved";
      progressBar.value = solved;
      progressBar.setAttribute("aria-label", progressText.textContent);
      const next = all.find(({ group, question }) => (
        statusFor(progress, questionKey(group, question)) !== "solved"
      ));
      resume.replaceChildren();
      if (next) {
        resume.append(
          text("strong", copy.continueLabel + ":"),
          document.createTextNode(" " + next.question.title),
        );
      } else {
        resume.append(text("strong", "Complete"), document.createTextNode(" All " + itemLabel + " solved."));
      }
    };
    const renderNavigation = () => {
      navigationContent.replaceChildren();
      const visible = visibleEntries();
      const visibleIndex = Math.max(0, visible.findIndex((entry) => entry === active));
      navigationSummary.textContent = copy.problemSingular.charAt(0).toUpperCase()
        + copy.problemSingular.slice(1)
        + " " + (visibleIndex + 1) + " of " + visible.length + ": " + active.question.title;
      for (const group of library.groups) {
        const groupQuestions = visible.filter((entry) => entry.group.id === group.id);
        if (!groupQuestions.length) continue;
        const section = document.createElement("section");
        section.className = "group";
        section.append(text("h2", group.title));
        const list = document.createElement("ol");
        list.className = "learner-nav-list";
        for (const entry of groupQuestions) {
          const item = document.createElement("li");
          const button = text("button", entry.question.title, "learner-nav-item question-link");
          button.type = "button";
          button.disabled = running;
          button.setAttribute("aria-current", String(entry === active));
          const dot = document.createElement("i");
          dot.className = "learner-status-dot";
          const status = statusFor(progress, questionKey(entry.group, entry.question));
          dot.dataset.status = status;
          dot.setAttribute("aria-hidden", "true");
          const statusText = text(
            "span",
            status === "solved" ? " · Solved" : status === "attempted" ? " · Attempted" : " · Not attempted",
            "learner-sr-only",
          );
          button.prepend(dot);
          button.append(statusText);
          button.addEventListener("click", () => {
            runGuard.invalidate();
            running = false;
            active = entry;
            source = draftSourceFor(entry.group, entry.question);
            if (navigationBreakpoint.matches) {
              navigation.removeAttribute("open");
            }
            renderActive(true);
            renderNavigation();
          });
          item.append(button);
          list.append(item);
        }
        section.append(list);
        navigationContent.append(section);
      }
      updateProgressSummary();
    };
    const updateActionAvailability = () => {
      const runtime = library.runtimes.find((entry) => entry.id === active.question.runtimeId);
      const supported = Boolean(runtime && runtimeAdapter.supports(runtime));
      editor.disabled = running || !supported;
      examplesButton.disabled = running || !supported;
      checkButton.disabled = running || !supported;
      cancelButton.hidden = !running;
      cancelButton.disabled = !running;
      return supported;
    };
    const announceResult = (message) => {
      resultAnnouncement.textContent = message;
    };
    const focusAndReveal = (target, block = "nearest") => {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block, inline: "nearest" });
    };
    const renderActive = (moveFocus = false) => {
      const { group, question } = active;
      const heading = text("h2", question.title);
      heading.tabIndex = -1;
      questionCopy.replaceChildren(
        text("span", group.title + " · " + question.difficulty, "learner-eyebrow"),
        heading,
        text("p", question.prompt),
      );
      const constraintsTitle = text("h3", "Constraints");
      const constraints = document.createElement("ul");
      question.constraints.forEach((entry) => constraints.append(text("li", entry)));
      questionCopy.append(constraintsTitle, constraints);
      const examples = question.cases.filter((entry) => entry.visibility === "example");
      if (examples.length) {
        questionCopy.append(text("h3", copy.publicExamplesHeading));
        const exampleList = document.createElement("ul");
        exampleList.className = "example-cases";
        for (const example of examples) {
          const expected = example.assertions.map((assertion) => (
            Object.hasOwn(assertion, "expected")
              ? assertion.expected
              : assertion.label
          ));
          const item = document.createElement("li");
          item.append(
            text("strong", example.label),
            text("code", copy.inputLabel + ": " + JSON.stringify(example.args)),
            text(
              "code",
              copy.expectedLabel + ": " + JSON.stringify(
                expected.length === 1 ? expected[0] : expected,
              ),
            ),
          );
          exampleList.append(item);
        }
        questionCopy.append(exampleList);
      }
      sourcePath.textContent = question.path;
      editor.value = source;
      draftStatus.textContent = drafts[questionKey(group, question)]
        ? copy.draftRestored
        : "";
      announceResult("");
      results.replaceChildren(text("p", copy.initialResults));
      const supported = updateActionAvailability();
      if (!supported) {
        results.replaceChildren(text("p", copy.runtimeUnavailable, "error"));
        announceResult(copy.runtimeUnavailable);
      }
      if (moveFocus) focusAndReveal(heading, "center");
    };
    const run = async (mode) => {
      const { group, question } = active;
      const runtime = library.runtimes.find((entry) => entry.id === question.runtimeId);
      if (!runtime || !runtimeAdapter.supports(runtime)) return;
      source = editor.value;
      const runSource = source;
      const runQuestionKey = questionKey(group, question);
      const runToken = runGuard.begin(runQuestionKey, runSource);
      const controller = new AbortController();
      activeRunController = controller;
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
      results.replaceChildren(text("p", copy.running));
      announceResult(copy.running);
      try {
        const outcome = await runtimeAdapter.run({
          library,
          group,
          question,
          runtime,
          contractVersion: contractVersion(library, group, question),
          source,
          mode,
          signal: controller.signal,
        });
        if (!isCurrentRun()) return;
        const heading = text("h3", outcome.passed ? copy.passedHeading : copy.failedHeading);
        const list = document.createElement("ol");
        for (const exerciseCase of outcome.cases) {
          const detail = exerciseCase.assertions
            ? exerciseCase.assertions.map((entry) => entry.label + ": " + entry.detail).join(" ")
            : exerciseCase.detail || exerciseCase.id;
          const item = document.createElement("li");
          item.dataset.passed = String(exerciseCase.passed);
          item.append(
            text("strong", exerciseCase.passed ? "Pass · " : "Fail · "),
            document.createTextNode((exerciseCase.label || exerciseCase.id) + ". " + detail),
          );
          if (Object.hasOwn(exerciseCase, "input")) {
            item.append(text(
              "code",
              copy.inputLabel + ": " + JSON.stringify(exerciseCase.input),
              "case-evidence",
            ));
          }
          if (Object.hasOwn(exerciseCase, "expected")) {
            item.append(text(
              "code",
              copy.expectedLabel + ": " + JSON.stringify(
                exerciseCase.expected.length === 1
                  ? exerciseCase.expected[0]
                  : exerciseCase.expected,
              ),
              "case-evidence",
            ));
          }
          if (Object.hasOwn(exerciseCase, "actual")) {
            item.append(text(
              "code",
              "Received: " + JSON.stringify(exerciseCase.actual),
              "case-evidence",
            ));
          }
          list.append(item);
        }
        results.replaceChildren(heading, list);
        announceResult(outcome.passed ? copy.passedHeading : copy.failedHeading);
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
          updateProgressSummary();
          if (initialQuery === "leeches" && !isLeech(progress[key])) {
            const remaining = visibleEntries();
            runGuard.invalidate();
            running = false;
            if (!remaining.length) {
              const empty = emptyView();
              app.replaceChildren(empty);
              empty.focus({ preventScroll: true });
              return;
            }
            active = remaining[0];
            source = draftSourceFor(active.group, active.question);
            renderActive(true);
          }
          renderNavigation();
        }
      } catch (error) {
        if (!isCurrentRun()) return;
        results.replaceChildren(text("p", error?.message || String(error), "error"));
        announceResult(copy.failedHeading);
      } finally {
        if (activeRunController === controller) activeRunController = null;
        if (isCurrentRun()) {
          running = false;
          updateActionAvailability();
          renderNavigation();
        }
      }
    };
    editor.addEventListener("input", () => {
      source = editor.value;
      const { group, question } = active;
      const key = questionKey(group, question);
      const draftSource = source;
      drafts[key] = { ...(drafts[key] || {}), source: draftSource };
      draftStatus.textContent = "";
      pendingDraftWrites.set(key, { group, question, key, source: draftSource });
      void persistDraftWrites();
      if (running) {
        activeRunController?.abort();
        activeRunController = null;
        runGuard.invalidate();
        running = false;
        results.replaceChildren(text("p", copy.initialResults));
        announceResult(copy.initialResults);
        updateActionAvailability();
        renderNavigation();
      }
    });
    examplesButton.addEventListener("click", () => run("examples"));
    checkButton.addEventListener("click", () => run("check"));
    cancelButton.addEventListener("click", () => {
      if (!running) return;
      activeRunController?.abort();
      activeRunController = null;
      runGuard.invalidate();
      running = false;
      results.replaceChildren(text("p", copy.runCanceled));
      announceResult(copy.runCanceled);
      updateActionAvailability();
      renderNavigation();
      focusAndReveal(editor, "center");
    });
    editor.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
      event.preventDefault();
      if (running) return;
      void run(event.shiftKey ? "examples" : "check");
    });
    renderNavigation();
    renderActive();
  };
  load().catch((error) => {
    app.removeAttribute("aria-busy");
    app.replaceChildren(text("p", error?.message || String(error), "learner-empty error"));
  });
})();\n`;
}

export const questionGroupPlayerJavaScript = renderQuestionGroupPlayerJavaScript(
  defaultQuestionGroupSiteCopy,
  true,
);

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
  options: QuestionGroupSiteOptions = {},
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
  const ui = normalizeQuestionGroupSiteUi(library, options.ui);
  const bundledBrowserRuntime = options.bundledBrowserRuntime !== false;
  const metaContentSecurityPolicy = normalizeMetaContentSecurityPolicy(
    options.metaContentSecurityPolicy,
  );
  const compiler = bundledBrowserRuntime ? await compilerAssets() : undefined;
  const runtimeAdapter = options.runtimeAdapterJavaScript
    ?? "/* Build-time injection seam. Leave undefined to use the bundled JavaScript/TypeScript browser worker. */\n";
  const files: QuestionGroupSiteFiles = {
    ".latent-build": `${QUESTION_GROUP_BUILD_MARKER}\n`,
    "index.html": renderIndex(
      library,
      sha256,
      "all",
      ui,
      bundledBrowserRuntime,
      metaContentSecurityPolicy,
    ).replace(/[ \t]+$/gm, ""),
    [`${ui.reviewDirectory}/index.html`]: renderIndex(
      library,
      sha256,
      "leeches",
      ui,
      bundledBrowserRuntime,
      metaContentSecurityPolicy,
    ).replace(/[ \t]+$/gm, ""),
    "question-group-library.json": libraryJson,
    "assets/learner-ui.js": learnerUiJavaScript,
    "assets/player.css": `${createLearnerUiCss(ui.theme)}\n${questionGroupLayoutCss}`,
    "assets/player.js": renderQuestionGroupPlayerJavaScript(
      ui.copy,
      bundledBrowserRuntime,
    ),
    "assets/runtime-adapter.js": runtimeAdapter,
    ...(bundledBrowserRuntime && compiler ? {
      "assets/sandbox.worker.js": questionGroupSandboxWorkerJavaScript,
      "assets/esbuild.js": compiler.javascript,
      "assets/esbuild.wasm": compiler.wasm,
    } : {}),
    "assets/favicon.svg": ui.faviconSvg
      ? `${ui.faviconSvg.trim()}\n`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#17211d"/><path d="M20 21h24v7H20zm0 15h16v7H20z" fill="#fff"/></svg>\n`,
    "_headers": `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'

${bundledBrowserRuntime ? `/assets/sandbox.worker.js
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; object-src 'none'

` : ""}/question-group-library.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
`,
    "README.txt": `This is a self-hosted Latent Question Group practice site.

Publish this entire directory on a static host.

${bundledBrowserRuntime
    ? `The bundled adapter runs only declared JavaScript and TypeScript
browser-worker requirements. Learner code runs in a disposable worker with
time and output limits. The checker captures and freezes its grading
intrinsics before learner evaluation, accepts only structured-cloneable finite
JSON results with plain prototypes, follows only own result properties, and
revalidates worker messages. It lowers native dynamic-import syntax before
worker evaluation, removes known browser network capabilities, and fails
closed if one cannot be disabled. The worker provides no module loader or
string-evaluating timer APIs. Python and host-managed requirements remain disabled
unless trusted platform code is injected at build time.`
    : `This build intentionally omits the bundled JavaScript and TypeScript
compiler and sandbox assets. Its reviewed, build-time-injected host adapter
owns runtime admission, isolation, timeouts, and bounded result validation.
Portable JSON cannot select, load, or replace that adapter.`}

Apply the included _headers policy as defense in depth when your static host
supports it.

The repeated-miss review is /${ui.reviewDirectory}/. It queries device-local
progress and does not introduce another content format. Checks update progress
in an atomic IndexedDB transaction, so concurrent tabs do not discard attempts.
Editor drafts use separate digest- and contract-bound records in the trusted
browser database. They are not part of portable Question Group JSON or the
portable progress format.
`,
  };
  files["build-report.json"] = `${JSON.stringify({
    format: "latent-question-group-build-report",
    schemaVersion: 1,
    playerVersion: QUESTION_GROUP_PLAYER_VERSION,
    learnerUiVersion: LEARNER_UI_VERSION,
    libraryId: library.library.id,
    version: library.library.version,
    sha256,
    libraryBytes: libraryBytes.byteLength,
    reviewDirectory: ui.reviewDirectory,
    bundledBrowserRuntime,
    metaContentSecurityPolicy: options.metaContentSecurityPolicy === undefined
      ? "default"
      : "custom",
    browserRuntimes: bundledBrowserRuntime
      ? library.runtimes
        .filter(bundledRuntimeSupported)
        .map((runtime) => runtime.id)
      : [],
    files: [...Object.keys(files), "build-report.json"].sort(),
  }, null, 2)}\n`;
  return files;
}
