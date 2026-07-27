const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reportKeyPattern = /^[a-z][A-Za-z0-9]*$/;
const relativeRootPattern = /^(?:\.\.\/)+$/;
const absoluteRootPattern = /^\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/)*$/;

function nonemptyText(value, label, maximum = 300) {
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

function safeIdentifier(value, label) {
  const normalized = nonemptyText(value, label, 80);
  if (!identifierPattern.test(normalized)) {
    throw new Error(`${label} must use lowercase letters, numbers, and single hyphens.`);
  }
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Validate the trusted deployment directory without turning it into a portable
 * Learning Pack or Question Group contract.
 *
 * @param {unknown} input
 */
export function validateLearningSuite(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Learning suite configuration must be an object.");
  }
  if (input.schemaVersion !== 1) {
    throw new Error("Learning suite configuration requires schema version 1.");
  }
  safeIdentifier(input.id, "Learning suite id");
  nonemptyText(input.title, "Learning suite title", 120);
  nonemptyText(input.navigationLabel, "Learning suite navigation label", 120);
  nonemptyText(input.headerMeta, "Learning suite header metadata", 160);
  if (!input.home || typeof input.home !== "object" || Array.isArray(input.home)) {
    throw new Error("Learning suite configuration requires home metadata.");
  }
  const homeId = safeIdentifier(input.home.id, "Learning suite home id");
  nonemptyText(input.home.label, "Learning suite home label", 120);
  if (!input.intro || typeof input.intro !== "object" || Array.isArray(input.intro)) {
    throw new Error("Learning suite configuration requires introductory copy.");
  }
  nonemptyText(input.intro.eyebrow, "Learning suite eyebrow", 120);
  nonemptyText(input.intro.heading, "Learning suite heading", 180);
  nonemptyText(input.intro.description, "Learning suite description", 500);
  nonemptyText(input.footerSummary, "Learning suite footer summary", 300);
  if (!Array.isArray(input.experiences) || input.experiences.length === 0) {
    throw new Error("Learning suite configuration requires at least one experience.");
  }

  const ids = new Set([homeId]);
  const mounts = new Set();
  const reportKeys = new Set(["home"]);
  for (const [index, experience] of input.experiences.entries()) {
    const path = `Learning suite experience ${index + 1}`;
    if (!experience || typeof experience !== "object" || Array.isArray(experience)) {
      throw new Error(`${path} must be an object.`);
    }
    const id = safeIdentifier(experience.id, `${path} id`);
    if (ids.has(id)) throw new Error(`Learning suite experience id is duplicated: ${id}.`);
    ids.add(id);
    const mount = safeIdentifier(experience.mount, `${path} mount`);
    if (mounts.has(mount)) throw new Error(`Learning suite mount is duplicated: ${mount}.`);
    mounts.add(mount);
    const reportKey = nonemptyText(experience.reportKey, `${path} report key`, 80);
    if (!reportKeyPattern.test(reportKey)) {
      throw new Error(`${path} report key must be a safe JavaScript-style key.`);
    }
    if (reportKeys.has(reportKey)) {
      throw new Error(`Learning suite report key is duplicated: ${reportKey}.`);
    }
    reportKeys.add(reportKey);
    if (experience.kind !== "course" && experience.kind !== "practice") {
      throw new Error(`${path} kind must be course or practice.`);
    }
    nonemptyText(experience.navLabel, `${path} navigation label`, 120);
    nonemptyText(experience.eyebrow, `${path} eyebrow`, 160);
    nonemptyText(experience.title, `${path} title`, 160);
    nonemptyText(experience.description, `${path} description`, 500);
    nonemptyText(experience.action, `${path} action`, 120);
    if (
      !Array.isArray(experience.details)
      || experience.details.length === 0
      || experience.details.some((detail) => (
        typeof detail !== "string"
        || detail.trim().length === 0
        || detail.length > 160
      ))
    ) {
      throw new Error(`${path} details must contain concise non-empty text.`);
    }
    if (
      !Array.isArray(experience.additionalRoutes)
      || experience.additionalRoutes.some((route) => !identifierPattern.test(route))
      || new Set(experience.additionalRoutes).size !== experience.additionalRoutes.length
    ) {
      throw new Error(`${path} additional routes must be unique safe path segments.`);
    }
  }
  return deepFreeze(input);
}

const suiteDefinition = {
  schemaVersion: 1,
  id: "latent-learning-examples",
  title: "Learning Studio",
  navigationLabel: "Learning suite",
  headerMeta: "Courses and practice",
  home: {
    id: "learning-studio",
    label: "Learning Studio",
  },
  intro: {
    eyebrow: "Courses and practice",
    heading: "Choose a course or practice set.",
    description: "Build an LLM system, rehearse one engineering interview scenario, or work through ten Python problems. Progress stays on this device.",
  },
  footerSummary: "No account is required. Each experience stores its progress separately on this device.",
  experiences: [
    {
      id: "llm-systems",
      mount: "llm-systems",
      reportKey: "llmSystems",
      kind: "course",
      navLabel: "LLM Systems",
      eyebrow: "Project course · 14 lessons",
      title: "Build an LLM System",
      description: "Build model foundations, an inference runtime, reliable serving, and a streaming React chatbot.",
      details: ["Lessons and checkpoints", "Browser coding workspace", "Cumulative capstone"],
      action: "Open course",
      additionalRoutes: [],
    },
    {
      id: "interview-loop",
      mount: "interview-loop",
      reportKey: "interviewLoop",
      kind: "course",
      navLabel: "Interview Loop",
      eyebrow: "Interview course · 3 modules",
      title: "Interview Loop Lab",
      description: "Practice one webhook-delivery scenario across behavioral, coding, and system-design interview rounds.",
      details: ["Modules and quizzes", "Flash-card review", "Focused coding lab"],
      action: "Open course",
      additionalRoutes: [],
    },
    {
      id: "ten-problems",
      mount: "practice",
      reportKey: "practice",
      kind: "practice",
      navLabel: "Ten Problems",
      eyebrow: "Python practice · 10 problems",
      title: "Ten Problems",
      description: "Solve a focused set of Python problems with public examples, complete checks, and repeated-miss review.",
      details: ["Saved drafts", "Run and check feedback", "Progress and review"],
      action: "Open practice set",
      additionalRoutes: ["leeches"],
    },
  ],
};

export const learningSuite = validateLearningSuite(suiteDefinition);

function rootHref(value) {
  if (
    value === "./"
    || relativeRootPattern.test(value)
    || absoluteRootPattern.test(value)
  ) {
    return value;
  }
  throw new Error("Learning suite root href must be ./, parent-relative, or an absolute local path ending in /.");
}

/**
 * Derive suite links for a product mounted at any supported static subpath.
 *
 * @param {{ rootHref: string, currentId: string, includeHome?: boolean }} options
 */
export function createLearningSuiteNavigation({
  rootHref: requestedRootHref,
  currentId,
  includeHome = true,
}) {
  const base = rootHref(requestedRootHref);
  const knownIds = new Set([
    learningSuite.home.id,
    ...learningSuite.experiences.map((experience) => experience.id),
  ]);
  if (!knownIds.has(currentId)) {
    throw new Error(`Unknown learning suite destination: ${currentId}.`);
  }
  if (typeof includeHome !== "boolean") {
    throw new Error("Learning suite includeHome must be a boolean.");
  }
  const destinations = [
    ...(includeHome ? [{
      id: learningSuite.home.id,
      label: learningSuite.home.label,
      href: base,
    }] : []),
    ...learningSuite.experiences.map((experience) => ({
      id: experience.id,
      label: experience.navLabel,
      href: (
        experience.id === currentId
        && relativeRootPattern.test(base)
      ) ? "./" : `${base}${experience.mount}/`,
    })),
  ];
  return Object.freeze(destinations.map((destination) => Object.freeze({
    ...destination,
    current: destination.id === currentId || undefined,
  })));
}

export function createLearningSuiteHeaderNavigation(options) {
  return Object.freeze(createLearningSuiteNavigation(options).map((destination) => Object.freeze({
    label: destination.label,
    href: destination.href,
    current: destination.current,
  })));
}

export function learningSuiteRouteReport() {
  const routes = {
    home: ["/"],
    ...Object.fromEntries(learningSuite.experiences.map((experience) => {
      const root = `/${experience.mount}/`;
      return [
        experience.reportKey,
        [
          root,
          ...experience.additionalRoutes.map((route) => `${root}${route}/`),
        ],
      ];
    })),
  };
  return deepFreeze(routes);
}
