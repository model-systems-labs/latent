import { hashText, isSourceHash, type SourceHash } from "@latent/browser-lab";
import type { LearnerUiPaletteName } from "@latent/course-kit/learner-ui";

export const TRUSTED_INTERACTIVE_SCHEMA_VERSION = 1 as const;
export const TRUSTED_INTERACTIVE_RUNTIME_VERSION = 1 as const;

export type TrustedInteractiveJson =
  | null
  | boolean
  | number
  | string
  | TrustedInteractiveJson[]
  | { [key: string]: TrustedInteractiveJson };

export type TrustedInteractiveReference = Readonly<{
  id: string;
  definitionVersion: number;
}>;

export type TrustedInteractiveDefinition = Readonly<{
  schemaVersion: typeof TRUSTED_INTERACTIVE_SCHEMA_VERSION;
  id: string;
  definitionVersion: number;
  stateSchemaVersion: number;
  title: string;
  description: string;
  source: Readonly<{
    html: string;
    css: string;
    javascript: string;
  }>;
  initialState: TrustedInteractiveJson;
  input: TrustedInteractiveJson;
  frame: Readonly<{
    title: string;
    minimumHeight: number;
    maximumHeight: number;
  }>;
  appearance?: Readonly<{
    palette?: LearnerUiPaletteName;
  }>;
  capabilities: readonly (
    | "context.get"
    | "state.save"
    | "events.record"
    | "progress.request"
  )[];
  events: readonly string[];
  completionCheckpoints: readonly string[];
  authoring: Readonly<{
    learningObjective: string;
    learnerAction: string;
    evidence: string;
    requestedVisualElements: readonly string[];
  }>;
}>;

export type TrustedInteractiveBundleInput = Readonly<{
  schemaVersion: typeof TRUSTED_INTERACTIVE_SCHEMA_VERSION;
  runtimeVersion: typeof TRUSTED_INTERACTIVE_RUNTIME_VERSION;
  id: string;
  definitionVersion: number;
  stateSchemaVersion: number;
  html: string;
  css: string;
  javascript: string;
  visualCss: string;
  sourceHash: SourceHash;
  bundleHash: SourceHash;
}>;

declare const validatedTrustedInteractiveBundleBrand: unique symbol;

export type ValidatedTrustedInteractiveBundle = TrustedInteractiveBundleInput & {
  readonly [validatedTrustedInteractiveBundleBrand]: true;
};

export const TRUSTED_INTERACTIVE_LIMITS = Object.freeze({
  maxHtmlBytes: 180_000,
  maxCssBytes: 180_000,
  maxJavaScriptBytes: 320_000,
  maxVisualCssBytes: 80_000,
  maxTotalBundleBytes: 700_000,
  maxStateBytes: 32_000,
  maxMessageBytes: 64_000,
  maxHostResponseBytes: 160_000,
  maxJsonDepth: 16,
  maxJsonNodes: 4_000,
  maxActiveRequests: 12,
  minFrameHeight: 240,
  maxFrameHeight: 2_000,
} as const);

const SAFE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SAFE_CAPABILITIES = new Set<TrustedInteractiveDefinition["capabilities"][number]>([
  "context.get",
  "state.save",
  "events.record",
  "progress.request",
]);
const DISALLOWED_HTML = /<\s*(?:script|style|base|meta|link|iframe|object|embed|a|form)\b/i;
const ACTIVE_HTML_ATTRIBUTE = /\s(?:on[a-z][a-z0-9_-]*|srcdoc)\s*=/i;
const HTML_URL_ATTRIBUTE = /\b(src|srcset|href|action|formaction|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const CSS_IMPORT = /@import\b/i;
const CSS_URL = /url\s*\(\s*([^)]*?)\s*\)/gi;
const DISALLOWED_JAVASCRIPT: readonly Readonly<{
  pattern: RegExp;
  label: string;
}>[] = Object.freeze([
  {
    pattern: /(?:^|[^\w$])(?:(?:globalThis|window|self|document|parent|top)\s*\.\s*)?location(?:\s*(?:=|\.|\[))/m,
    label: "location navigation",
  },
  {
    pattern: /(?:^|[^\w$])(?:(?:globalThis|window|self|parent|top)\s*\.\s*)?open\s*\(/m,
    label: "window opening",
  },
  { pattern: /(?:^|[^\w$])fetch\s*\(/m, label: "fetch" },
  { pattern: /\bXMLHttpRequest\b/, label: "XMLHttpRequest" },
  { pattern: /\bWebSocket\b/, label: "WebSocket" },
  { pattern: /\bEventSource\b/, label: "EventSource" },
  { pattern: /\bsendBeacon\s*\(/, label: "sendBeacon" },
  { pattern: /\bimportScripts\s*\(/, label: "importScripts" },
  { pattern: /\bimport\s*\(/, label: "dynamic import" },
  { pattern: /\b(?:Worker|SharedWorker)\s*\(/, label: "worker construction" },
  {
    pattern: /\.(?:src|srcset|href|action|formAction|poster|data)\s*=/,
    label: "element URL assignment",
  },
  {
    pattern: /\[\s*["'](?:src|srcset|href|action|formAction|poster|data)["']\s*\]\s*=/,
    label: "element URL assignment",
  },
  {
    pattern: /\.setAttribute(?:NS)?\s*\([^)]*["'](?:src|srcset|href|action|formaction|poster|data)["']/,
    label: "element URL attribute assignment",
  },
  {
    pattern: /\bnew\s+(?:Image|Audio)\s*\(/,
    label: "media loading",
  },
  {
    pattern: /\bdocument\s*\.\s*(?:write|writeln)\s*\(/,
    label: "document replacement",
  },
  {
    pattern: /\bdocument\s*\.\s*createElement\s*\(\s*["'](?:script|link|iframe|object|embed|a|form|img|audio|video|source|track)["']/,
    label: "external-load element construction",
  },
]);
const validatedBundles = new WeakSet<object>();

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isBoundedTrustedInteractiveJson(
  value: unknown,
  options: Partial<{
    maxBytes: number;
    maxDepth: number;
    maxNodes: number;
  }> = {},
): value is TrustedInteractiveJson {
  const maxBytes = options.maxBytes ?? TRUSTED_INTERACTIVE_LIMITS.maxMessageBytes;
  const maxDepth = options.maxDepth ?? TRUSTED_INTERACTIVE_LIMITS.maxJsonDepth;
  const maxNodes = options.maxNodes ?? TRUSTED_INTERACTIVE_LIMITS.maxJsonNodes;
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    nodes += 1;
    if (nodes > maxNodes || item.depth > maxDepth) return false;
    if (
      item.value === null
      || typeof item.value === "string"
      || typeof item.value === "boolean"
    ) continue;
    if (typeof item.value === "number") {
      if (!Number.isFinite(item.value)) return false;
      continue;
    }
    if (Array.isArray(item.value)) {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      for (const child of item.value) stack.push({ value: child, depth: item.depth + 1 });
      continue;
    }
    if (isPlainRecord(item.value)) {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      for (const child of Object.values(item.value)) {
        stack.push({ value: child, depth: item.depth + 1 });
      }
      continue;
    }
    return false;
  }
  try {
    return utf8Bytes(JSON.stringify(value)) <= maxBytes;
  } catch {
    return false;
  }
}

function assertShortText(value: string, label: string, maximum: number): void {
  if (!value.trim() || value.length > maximum) {
    throw new Error(`${label} must be non-empty and no longer than ${maximum} characters.`);
  }
}

function uniqueStrings(values: readonly string[], label: string): readonly string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(`${label} must contain non-empty strings.`);
  }
  if (new Set(values).size !== values.length) throw new Error(`${label} cannot contain duplicates.`);
  return Object.freeze([...values]);
}

function cloneJson<T extends TrustedInteractiveJson>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreezeJson<T extends TrustedInteractiveJson>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) deepFreezeJson(child);
    return Object.freeze(value) as T;
  }
  if (isPlainRecord(value)) {
    for (const child of Object.values(value)) {
      deepFreezeJson(child as TrustedInteractiveJson);
    }
    return Object.freeze(value) as T;
  }
  return value;
}

function cloneAndDeepFreezeJson<T extends TrustedInteractiveJson>(value: T): T {
  return deepFreezeJson(cloneJson(value));
}

function hasExternalCssReference(css: string): boolean {
  if (CSS_IMPORT.test(css)) return true;
  CSS_URL.lastIndex = 0;
  for (let match = CSS_URL.exec(css); match; match = CSS_URL.exec(css)) {
    const value = match[1].trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (!value.startsWith("#")) return true;
  }
  return false;
}

function assertSafeHtml(html: string): void {
  if (DISALLOWED_HTML.test(html) || ACTIVE_HTML_ATTRIBUTE.test(html)) {
    throw new Error(
      "Trusted interactive HTML must be a body fragment without scripts, active navigation, frames, embeds, links, forms, or document metadata.",
    );
  }
  HTML_URL_ATTRIBUTE.lastIndex = 0;
  for (
    let match = HTML_URL_ATTRIBUTE.exec(html);
    match;
    match = HTML_URL_ATTRIBUTE.exec(html)
  ) {
    const attribute = match[1].toLowerCase();
    const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (attribute !== "href" || !value.startsWith("#")) {
      throw new Error(
        "Trusted interactive HTML cannot contain navigation or external-load URL attributes.",
      );
    }
  }
}

function assertSafeJavascript(javascript: string): void {
  const violation = DISALLOWED_JAVASCRIPT.find(({ pattern }) => pattern.test(javascript));
  if (violation) {
    throw new Error(
      `Trusted interactive JavaScript cannot use ${violation.label}; reviewed source must use host capabilities instead.`,
    );
  }
}

function assertTrustedInteractiveSourcePolicy(
  source: Readonly<{ html: string; css: string; javascript: string }>,
): void {
  if (
    typeof source.html !== "string"
    || !source.html.trim()
    || utf8Bytes(source.html) > TRUSTED_INTERACTIVE_LIMITS.maxHtmlBytes
  ) {
    throw new Error("Trusted interactive HTML is empty or exceeds its byte limit.");
  }
  assertSafeHtml(source.html);
  if (
    typeof source.css !== "string"
    || !source.css.trim()
    || utf8Bytes(source.css) > TRUSTED_INTERACTIVE_LIMITS.maxCssBytes
  ) {
    throw new Error("Trusted interactive CSS is empty or exceeds its byte limit.");
  }
  if (hasExternalCssReference(source.css)) {
    throw new Error("Trusted interactive CSS cannot import or reference remote resources.");
  }
  if (
    typeof source.javascript !== "string"
    || !source.javascript.trim()
    || utf8Bytes(source.javascript) > TRUSTED_INTERACTIVE_LIMITS.maxJavaScriptBytes
  ) {
    throw new Error("Trusted interactive JavaScript is empty or exceeds its byte limit.");
  }
  assertSafeJavascript(source.javascript);
}

export function defineTrustedInteractive(
  input: TrustedInteractiveDefinition,
): TrustedInteractiveDefinition {
  if (input.schemaVersion !== TRUSTED_INTERACTIVE_SCHEMA_VERSION) {
    throw new Error("The trusted interactive schema version is not supported.");
  }
  if (!SAFE_ID.test(input.id) || input.id.length > 96) {
    throw new Error("A trusted interactive id must be a short lowercase hyphenated identifier.");
  }
  if (!Number.isSafeInteger(input.definitionVersion) || input.definitionVersion < 1) {
    throw new Error("A trusted interactive definition version must be a positive integer.");
  }
  if (!Number.isSafeInteger(input.stateSchemaVersion) || input.stateSchemaVersion < 1) {
    throw new Error("A trusted interactive state schema version must be a positive integer.");
  }
  assertShortText(input.title, "Trusted interactive title", 160);
  assertShortText(input.description, "Trusted interactive description", 600);
  assertShortText(input.frame.title, "Trusted interactive frame title", 160);
  assertShortText(input.authoring.learningObjective, "Learning objective", 600);
  assertShortText(input.authoring.learnerAction, "Learner action", 600);
  assertShortText(input.authoring.evidence, "Learning evidence", 600);
  const requestedVisualElements = uniqueStrings(
    input.authoring.requestedVisualElements,
    "Requested visual elements",
  );
  assertTrustedInteractiveSourcePolicy(input.source);
  if (!isBoundedTrustedInteractiveJson(input.initialState, {
    maxBytes: TRUSTED_INTERACTIVE_LIMITS.maxStateBytes,
  })) {
    throw new Error("Trusted interactive initial state is not bounded JSON.");
  }
  if (!isBoundedTrustedInteractiveJson(input.input)) {
    throw new Error("Trusted interactive host input is not bounded JSON.");
  }
  if (
    !Number.isSafeInteger(input.frame.minimumHeight)
    || !Number.isSafeInteger(input.frame.maximumHeight)
    || input.frame.minimumHeight < TRUSTED_INTERACTIVE_LIMITS.minFrameHeight
    || input.frame.maximumHeight > TRUSTED_INTERACTIVE_LIMITS.maxFrameHeight
    || input.frame.minimumHeight > input.frame.maximumHeight
  ) {
    throw new Error("Trusted interactive frame heights are outside the supported range.");
  }
  const capabilities = uniqueStrings(input.capabilities, "Trusted interactive capabilities");
  if (capabilities.some((capability) => !SAFE_CAPABILITIES.has(
    capability as TrustedInteractiveDefinition["capabilities"][number],
  ))) {
    throw new Error("A trusted interactive requested an unknown host capability.");
  }
  if (!capabilities.includes("context.get")) {
    throw new Error("A trusted interactive must request context.get before its authored controls can hydrate.");
  }
  const events = uniqueStrings(input.events, "Trusted interactive events");
  const completionCheckpoints = uniqueStrings(
    input.completionCheckpoints,
    "Trusted interactive completion checkpoints",
  );
  for (const value of [...events, ...completionCheckpoints]) {
    if (!SAFE_ID.test(value) || value.length > 96) {
      throw new Error("Event and checkpoint ids must be short lowercase hyphenated identifiers.");
    }
  }
  return Object.freeze({
    ...input,
    source: Object.freeze({ ...input.source }),
    initialState: cloneAndDeepFreezeJson(input.initialState),
    input: cloneAndDeepFreezeJson(input.input),
    frame: Object.freeze({ ...input.frame }),
    appearance: input.appearance ? Object.freeze({ ...input.appearance }) : undefined,
    capabilities: capabilities as TrustedInteractiveDefinition["capabilities"],
    events,
    completionCheckpoints,
    authoring: Object.freeze({
      ...input.authoring,
      requestedVisualElements,
    }),
  });
}

export function trustedInteractiveSourceBytes(
  input: Pick<
    TrustedInteractiveBundleInput,
    "schemaVersion" | "id" | "definitionVersion" | "stateSchemaVersion" | "html" | "css" | "javascript"
  >,
): string {
  // Preserve the authored HTML/CSS/JavaScript byte-for-byte in the source
  // identity. Host input is deliberately excluded and must be revised by
  // incrementing definitionVersion when its behavior changes.
  return JSON.stringify({
    schemaVersion: input.schemaVersion,
    id: input.id,
    definitionVersion: input.definitionVersion,
    stateSchemaVersion: input.stateSchemaVersion,
    html: input.html,
    css: input.css,
    javascript: input.javascript,
  });
}

export function trustedInteractiveBundleBytes(
  input: Pick<
    TrustedInteractiveBundleInput,
    | "schemaVersion"
    | "runtimeVersion"
    | "id"
    | "definitionVersion"
    | "stateSchemaVersion"
    | "html"
    | "css"
    | "javascript"
    | "visualCss"
    | "sourceHash"
  >,
): string {
  return JSON.stringify({
    schemaVersion: input.schemaVersion,
    runtimeVersion: input.runtimeVersion,
    id: input.id,
    definitionVersion: input.definitionVersion,
    stateSchemaVersion: input.stateSchemaVersion,
    html: input.html,
    css: input.css,
    javascript: input.javascript,
    visualCss: input.visualCss,
    sourceHash: input.sourceHash,
  });
}

function assertTrustedInteractiveBundlePolicy(
  input: TrustedInteractiveBundleInput,
): void {
  assertTrustedInteractiveSourcePolicy({
    html: input.html,
    css: input.css,
    javascript: input.javascript,
  });
  if (
    typeof input.visualCss !== "string"
    || !input.visualCss.trim()
    || utf8Bytes(input.visualCss) > TRUSTED_INTERACTIVE_LIMITS.maxVisualCssBytes
  ) {
    throw new Error("The trusted interactive visual foundation is empty or too large.");
  }
  if (hasExternalCssReference(input.visualCss)) {
    throw new Error(
      "The trusted interactive visual foundation cannot import or reference remote resources.",
    );
  }
  if (
    utf8Bytes(trustedInteractiveBundleBytes(input))
    > TRUSTED_INTERACTIVE_LIMITS.maxTotalBundleBytes
  ) {
    throw new Error("The trusted interactive bundle exceeds its total byte limit.");
  }
}

export async function prepareTrustedInteractiveBundle(
  definition: TrustedInteractiveDefinition,
  visualCss: string,
): Promise<ValidatedTrustedInteractiveBundle> {
  const safe = defineTrustedInteractive(definition);
  const base = {
    schemaVersion: safe.schemaVersion,
    runtimeVersion: TRUSTED_INTERACTIVE_RUNTIME_VERSION,
    id: safe.id,
    definitionVersion: safe.definitionVersion,
    stateSchemaVersion: safe.stateSchemaVersion,
    html: safe.source.html,
    css: safe.source.css,
    javascript: safe.source.javascript,
    visualCss,
  } as const;
  const sourceHash = await hashText(trustedInteractiveSourceBytes(base));
  const bundleHash = await hashText(trustedInteractiveBundleBytes({ ...base, sourceHash }));
  const bundle = Object.freeze({ ...base, sourceHash, bundleHash });
  assertTrustedInteractiveBundlePolicy(bundle);
  validatedBundles.add(bundle);
  return bundle as ValidatedTrustedInteractiveBundle;
}

export async function verifyTrustedInteractiveBundle(
  input: TrustedInteractiveBundleInput,
): Promise<ValidatedTrustedInteractiveBundle> {
  if (!input || typeof input !== "object") {
    throw new Error("The trusted interactive bundle metadata is invalid.");
  }
  const candidate: TrustedInteractiveBundleInput = {
    schemaVersion: input.schemaVersion,
    runtimeVersion: input.runtimeVersion,
    id: input.id,
    definitionVersion: input.definitionVersion,
    stateSchemaVersion: input.stateSchemaVersion,
    html: input.html,
    css: input.css,
    javascript: input.javascript,
    visualCss: input.visualCss,
    sourceHash: input.sourceHash,
    bundleHash: input.bundleHash,
  };
  if (
    candidate.schemaVersion !== TRUSTED_INTERACTIVE_SCHEMA_VERSION
    || candidate.runtimeVersion !== TRUSTED_INTERACTIVE_RUNTIME_VERSION
    || typeof candidate.id !== "string"
    || !SAFE_ID.test(candidate.id)
    || candidate.id.length > 96
    || !Number.isSafeInteger(candidate.definitionVersion)
    || candidate.definitionVersion < 1
    || !Number.isSafeInteger(candidate.stateSchemaVersion)
    || candidate.stateSchemaVersion < 1
    || !isSourceHash(candidate.sourceHash)
    || !isSourceHash(candidate.bundleHash)
  ) {
    throw new Error("The trusted interactive bundle metadata is invalid.");
  }
  assertTrustedInteractiveBundlePolicy(candidate);
  const sourceHash = await hashText(trustedInteractiveSourceBytes(candidate));
  const bundleHash = await hashText(trustedInteractiveBundleBytes(candidate));
  if (sourceHash !== candidate.sourceHash || bundleHash !== candidate.bundleHash) {
    throw new Error("The trusted interactive bundle does not match its source hashes.");
  }
  const bundle = Object.freeze(candidate);
  validatedBundles.add(bundle);
  return bundle as ValidatedTrustedInteractiveBundle;
}

export function isValidatedTrustedInteractiveBundle(
  value: unknown,
): value is ValidatedTrustedInteractiveBundle {
  return Boolean(value) && typeof value === "object" && validatedBundles.has(value as object);
}
