import {
  LEARNER_CODE_EDITOR_CSP_SOURCE,
} from "@latent/course-kit/learner-code-editor";

const tenProblemsDocumentContentSecurityPolicyDirectives = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  `style-src 'self' ${LEARNER_CODE_EDITOR_CSP_SOURCE}`,
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
];

export const tenProblemsMetaContentSecurityPolicy =
  tenProblemsDocumentContentSecurityPolicyDirectives.join("; ");

export const tenProblemsPageContentSecurityPolicy = [
  ...tenProblemsDocumentContentSecurityPolicyDirectives,
  "frame-ancestors 'none'",
].join("; ");

export const tenProblemsWorkerContentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "object-src 'none'",
].join("; ");

function normalizePrefix(prefix) {
  if (prefix === "") return "";
  if (!/^\/[a-z0-9][a-z0-9._-]*$/.test(prefix)) {
    throw new Error("A Ten Problems header prefix must be empty or one safe path segment.");
  }
  return prefix;
}

export function renderTenProblemsHeaders({
  pagePattern = "/*",
  sitePrefixes = ["", "/practice"],
} = {}) {
  if (
    typeof pagePattern !== "string"
    || !/^\/(?:[a-z0-9][a-z0-9._-]*\/)?\*$/.test(pagePattern)
  ) {
    throw new Error("The Ten Problems page header pattern must be a safe wildcard route.");
  }
  const prefixes = [...new Set(sitePrefixes.map(normalizePrefix))];
  if (!prefixes.length) {
    throw new Error("Ten Problems headers require at least one site prefix.");
  }
  const workerRules = prefixes.map((prefix) => (
    `${prefix}/assets/python-question.worker.js
  Content-Security-Policy: ${tenProblemsWorkerContentSecurityPolicy}`
  )).join("\n\n");
  const libraryRules = prefixes.map((prefix) => (
    `${prefix}/question-group-library.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache`
  )).join("\n\n");
  return `${pagePattern}
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()
  Content-Security-Policy: ${tenProblemsPageContentSecurityPolicy}

${workerRules}

${libraryRules}
`;
}
