import {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_PALETTES,
  type LearnerUiPaletteName,
} from "@latent/course-kit/learner-ui";
import type { TrustedInteractiveJson } from "@/app/features/trusted-interactives/contract";

export const TRUSTED_INTERACTIVE_VISUAL_VERSION = 1 as const;

export type TrustedInteractiveLessonTone = "plum" | "rust" | "forest" | "blue" | "slate";

const lessonAccents: Readonly<Record<TrustedInteractiveLessonTone, string>> = Object.freeze({
  plum: "#695a78",
  rust: "#7a513e",
  forest: "#486750",
  blue: "#4c6279",
  slate: "#58636d",
});

export const TRUSTED_INTERACTIVE_VISUAL_ELEMENTS = Object.freeze([
  {
    name: "stage",
    className: "latent-stage",
    purpose: "One border-led plane for the worked mechanism; avoid nested card stacks.",
  },
  {
    name: "control-row",
    className: "latent-control-row",
    purpose: "A wrapping row of native controls with at least 44px targets.",
  },
  {
    name: "segmented-control",
    className: "latent-segments",
    purpose: "A small set of mutually exclusive states using aria-pressed buttons.",
  },
  {
    name: "metric",
    className: "latent-metric",
    purpose: "A label-value pair that exposes exact state or evidence.",
  },
  {
    name: "status",
    className: "latent-status",
    purpose: "A polite, atomic status region for meaningful state changes.",
  },
  {
    name: "code",
    className: "latent-code",
    purpose: "Compact machine-readable evidence using the shared mono face.",
  },
] as const);

export const TRUSTED_INTERACTIVE_AUTHORING_LESSONS = Object.freeze([
  {
    id: "one-worked-mechanism",
    lesson: "Teach one concrete worked mechanism with exact values, not a decorative inventory of nouns.",
  },
  {
    id: "visible-causality",
    lesson: "Make cause, time, identity, before-and-after state, and accepted or rejected data visible.",
  },
  {
    id: "controlled-comparison",
    lesson: "When comparing outcomes, change one meaningful variable and keep the rest fixed.",
  },
  {
    id: "advertised-paths",
    lesson: "Expose every path the copy promises, including cancellation, failure, late events, and manual boundaries when relevant.",
  },
  {
    id: "numerical-consistency",
    lesson: "Keep prose, diagram, fixture, interaction, checks, and saved evidence numerically consistent.",
  },
  {
    id: "quiet-evidence-plane",
    lesson: "Prefer one flat, border-led evidence surface with restrained accents over nested card chrome.",
  },
  {
    id: "mobile-recomposition",
    lesson: "Recompose lanes, equations, and ledgers into one readable mobile column instead of shrinking them.",
  },
  {
    id: "native-semantics",
    lesson: "Use native headings, lists, tables, buttons, output, and status semantics with visible keyboard focus.",
  },
  {
    id: "state-before-controls",
    lesson: "Restore persisted state before enabling controls, snapshot exact state, reject stale results, and make reset explicit.",
  },
  {
    id: "meaningful-completion",
    lesson: "Request completion only after a meaningful observable learner action, never on mount.",
  },
  {
    id: "honest-evidence",
    lesson: "Distinguish automated evidence from keyboard, screen-reader, responsive, and physical-device checks.",
  },
] as const);

export type TrustedInteractiveVisualContext = Readonly<{
  version: typeof TRUSTED_INTERACTIVE_VISUAL_VERSION;
  palette: LearnerUiPaletteName;
  lessonTone: TrustedInteractiveLessonTone;
  colors: Readonly<Record<string, string>>;
  fonts: Readonly<Record<"sans" | "reading" | "mono", string>>;
  spacing: readonly string[];
  radii: Readonly<Record<"small" | "medium" | "large", string>>;
  widths: Readonly<Record<"reading" | "content", string>>;
  breakpoints: typeof LEARNER_UI_BREAKPOINTS;
  constraints: Readonly<{
    minimumLabelPixels: 11;
    minimumControlPixels: 44;
    focusRingPixels: 3;
    minimumTextContrast: 4.5;
  }>;
  preferences: Readonly<{
    reducedMotion: boolean;
    forcedColors: boolean;
  }>;
  elements: typeof TRUSTED_INTERACTIVE_VISUAL_ELEMENTS;
  authoringLessons: typeof TRUSTED_INTERACTIVE_AUTHORING_LESSONS;
}>;

export function createTrustedInteractiveVisualContext(input: {
  palette?: LearnerUiPaletteName;
  lessonTone?: TrustedInteractiveLessonTone;
  reducedMotion?: boolean;
  forcedColors?: boolean;
} = {}): TrustedInteractiveVisualContext {
  const palette = input.palette ?? "paper";
  const lessonTone = input.lessonTone ?? "slate";
  const colors = LEARNER_UI_PALETTES[palette];
  return Object.freeze({
    version: TRUSTED_INTERACTIVE_VISUAL_VERSION,
    palette,
    lessonTone,
    colors: Object.freeze({
      ...colors,
      lessonAccent: lessonAccents[lessonTone],
    }),
    fonts: Object.freeze({
      sans: '"Helvetica Neue", Arial, sans-serif',
      reading: '"Iowan Old Style", "Baskerville", "Times New Roman", serif',
      mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    }),
    spacing: Object.freeze(["0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem", "3rem", "4.5rem"]),
    radii: Object.freeze({ small: "0.3rem", medium: "0.5rem", large: "0.75rem" }),
    widths: Object.freeze({ reading: "45rem", content: "60rem" }),
    breakpoints: LEARNER_UI_BREAKPOINTS,
    constraints: Object.freeze({
      minimumLabelPixels: 11,
      minimumControlPixels: 44,
      focusRingPixels: 3,
      minimumTextContrast: 4.5,
    }),
    preferences: Object.freeze({
      reducedMotion: input.reducedMotion === true,
      forcedColors: input.forcedColors === true,
    }),
    elements: TRUSTED_INTERACTIVE_VISUAL_ELEMENTS,
    authoringLessons: TRUSTED_INTERACTIVE_AUTHORING_LESSONS,
  });
}

function cssVariable(name: string, value: string): string {
  return `  --latent-${name}: ${value};`;
}

export function trustedInteractiveVisualCss(context: TrustedInteractiveVisualContext): string {
  const colors = context.colors;
  return `
:root {
${Object.entries(colors).map(([name, value]) => cssVariable(name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`), value)).join("\n")}
${cssVariable("font-sans", context.fonts.sans)}
${cssVariable("font-reading", context.fonts.reading)}
${cssVariable("font-mono", context.fonts.mono)}
${cssVariable("lesson-accent", colors.lessonAccent)}
${context.spacing.map((value, index) => cssVariable(`space-${index + 1}`, value)).join("\n")}
  color-scheme: light;
}

*, *::before, *::after { box-sizing: border-box; }
html { background: transparent; color: var(--latent-ink); font-family: var(--latent-font-sans); }
body { margin: 0; min-width: 0; overflow-x: hidden; }
button, input, select, textarea { color: inherit; font: inherit; }
button { min-height: 44px; }
button, a, input, select, textarea { -webkit-tap-highlight-color: transparent; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid var(--latent-focus);
  outline-offset: 3px;
}
code, pre { font-family: var(--latent-font-mono); }

.latent-stage {
  border-block: 1px solid var(--latent-border);
  min-width: 0;
  padding-block: var(--latent-space-5);
}
.latent-control-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--latent-space-3);
}
.latent-segments {
  border: 1px solid var(--latent-border);
  display: inline-flex;
  flex-wrap: wrap;
}
.latent-segments button {
  background: transparent;
  border: 0;
  border-inline-start: 1px solid var(--latent-border);
  cursor: pointer;
  padding: 0.65rem 0.9rem;
}
.latent-segments button:first-child { border-inline-start: 0; }
.latent-segments button[aria-pressed="true"] {
  background: var(--latent-accent-strong);
  color: var(--latent-accent-contrast);
}
.latent-metric {
  display: grid;
  gap: var(--latent-space-1);
}
.latent-metric > span,
.latent-metric > small {
  color: var(--latent-muted);
  font-size: max(0.68rem, 11px);
}
.latent-metric > strong {
  font-family: var(--latent-font-reading);
  font-size: 1.1rem;
  font-weight: 400;
}
.latent-status {
  color: var(--latent-muted);
  font-size: max(0.7rem, 11px);
  line-height: 1.55;
}
.latent-code {
  color: var(--latent-accent-strong);
  font-family: var(--latent-font-mono);
  font-size: max(0.68rem, 11px);
}

@media (max-width: ${context.breakpoints.compact}px) {
  .latent-control-row { align-items: stretch; flex-direction: column; }
  .latent-segments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  .latent-segments button { border-block-start: 1px solid var(--latent-border); border-inline-start: 0; }
  .latent-segments button:nth-child(-n + 2) { border-block-start: 0; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}

@media (forced-colors: active) {
  .latent-stage, .latent-segments, .latent-segments button { border-color: CanvasText; }
  .latent-segments button[aria-pressed="true"] { forced-color-adjust: auto; }
}
`.trim();
}

export function trustedInteractiveVisualContextJson(
  context: TrustedInteractiveVisualContext,
): TrustedInteractiveJson {
  return JSON.parse(JSON.stringify(context)) as TrustedInteractiveJson;
}
