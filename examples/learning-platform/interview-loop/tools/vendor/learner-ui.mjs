// Generated from @latent/course-kit 0.2.0; do not edit.
// packages/course-kit/dist/learner-ui.js
var LEARNER_UI_VERSION = 2;
var LEARNER_UI_FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#f4f0e8"/><rect x="20" y="20" width="24" height="24" rx="5" fill="#78667d" transform="rotate(-7 32 32)"/></svg>';
var LEARNER_UI_BREAKPOINTS = Object.freeze({
  compact: 760,
  stacked: 980,
  wide: 1280
});
var LEARNER_UI_PALETTE_NAMES = Object.freeze([
  "paper",
  "sage",
  "cobalt",
  "plum",
  "graphite"
]);
var LEARNER_UI_PALETTES = Object.freeze({
  paper: Object.freeze({
    canvas: "#f4f0e8",
    surface: "#fffdf8",
    surfaceMuted: "#eee9df",
    ink: "#282322",
    muted: "#665e59",
    border: "#d8d0c7",
    accent: "#78667d",
    accentStrong: "#554653",
    accentSoft: "#eee8ef",
    accentContrast: "#fffdf8",
    success: "#54735d",
    successSoft: "#e2ebe4",
    danger: "#8d5a54",
    dangerSoft: "#f3e5e2",
    warning: "#9a6342",
    focus: "#3159b7"
  }),
  sage: Object.freeze({
    canvas: "#eaf1e8",
    surface: "#fffef9",
    surfaceMuted: "#dfe9dd",
    ink: "#252a25",
    muted: "#61685f",
    border: "#c4d1c2",
    accent: "#47705d",
    accentStrong: "#315342",
    accentSoft: "#dfebe4",
    accentContrast: "#fffdf8",
    success: "#47705d",
    successSoft: "#dfebe4",
    danger: "#8d5a54",
    dangerSoft: "#f3e5e2",
    warning: "#92613f",
    focus: "#3159b7"
  }),
  cobalt: Object.freeze({
    canvas: "#eaf0fa",
    surface: "#fbfdff",
    surfaceMuted: "#dfe7f5",
    ink: "#24272e",
    muted: "#606773",
    border: "#c2cee0",
    accent: "#42629b",
    accentStrong: "#2d4979",
    accentSoft: "#e1e8f4",
    accentContrast: "#fffdf8",
    success: "#4c705c",
    successSoft: "#e0ebe4",
    danger: "#935853",
    dangerSoft: "#f4e4e2",
    warning: "#93613c",
    focus: "#3159b7"
  }),
  plum: Object.freeze({
    canvas: "#f2eaf4",
    surface: "#fffaff",
    surfaceMuted: "#e9deeb",
    ink: "#292329",
    muted: "#6a5e68",
    border: "#d7c8da",
    accent: "#765b75",
    accentStrong: "#563f56",
    accentSoft: "#eee4ed",
    accentContrast: "#fffdf8",
    success: "#55715f",
    successSoft: "#e2ebe5",
    danger: "#915955",
    dangerSoft: "#f4e4e2",
    warning: "#97603f",
    focus: "#3159b7"
  }),
  graphite: Object.freeze({
    canvas: "#eceeec",
    surface: "#fcfcf8",
    surfaceMuted: "#dfe3e1",
    ink: "#242525",
    muted: "#626665",
    border: "#c7cdca",
    accent: "#59666b",
    accentStrong: "#3f4b50",
    accentSoft: "#e2e7e8",
    accentContrast: "#fffdf8",
    success: "#52705d",
    successSoft: "#e0ebe4",
    danger: "#915955",
    dangerSoft: "#f4e4e2",
    warning: "#916240",
    focus: "#3159b7"
  })
});
var DEFAULT_THEME = LEARNER_UI_PALETTES.paper;
var LEARNER_UI_ATMOSPHERE_TRACE_COUNT = 3;
var LEARNER_UI_BACKGROUND_IMAGE = "linear-gradient(156deg, color-mix(in srgb, var(--learner-color-accent-soft) 58%, transparent) 0, transparent 46%), linear-gradient(24deg, transparent 54%, color-mix(in srgb, var(--learner-color-warning) 7%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, var(--learner-color-surface) 52%, transparent) 0, transparent 42rem)";
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function boundedText(value, label, maximum = 200) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be a non-empty text value no longer than ${maximum} characters.`);
  }
  return value.trim();
}
function safeLocalHref(value, label) {
  const href = boundedText(value, label, 500);
  if (/^#[A-Za-z][A-Za-z0-9._-]*$/.test(href))
    return href;
  const rootAbsolute = href.startsWith("/") && !href.startsWith("//");
  if (href.startsWith("//") || href.includes("\\") || href.includes(":") || href.includes("?") || href.includes("#") || href.includes("\0")) {
    throw new Error(`${label} must be a same-origin local path or fragment.`);
  }
  const path = rootAbsolute ? href.slice(1) : href;
  if (rootAbsolute && path === "")
    return href;
  const segments = path.split("/");
  let contentStarted = false;
  for (const [index, segment] of segments.entries()) {
    if (segment === "" && segments.length === 1) {
      throw new Error(`${label} must not be empty.`);
    }
    if (segment === "" && index !== segments.length - 1) {
      throw new Error(`${label} must not contain an empty path segment.`);
    }
    if (segment === ".") {
      if (rootAbsolute) {
        throw new Error(`${label} must not traverse from a root-absolute path.`);
      }
      if (contentStarted)
        throw new Error(`${label} may use "." only as a leading segment.`);
      continue;
    }
    if (segment === "..") {
      if (rootAbsolute) {
        throw new Error(`${label} must not traverse from a root-absolute path.`);
      }
      if (contentStarted)
        throw new Error(`${label} may use ".." only as a leading segment.`);
      continue;
    }
    if (segment === "")
      continue;
    contentStarted = true;
    if (!/^[A-Za-z0-9._~-]+$/.test(segment)) {
      throw new Error(`${label} contains an unsupported path segment.`);
    }
  }
  return href;
}
function navigationToken(value) {
  const token = boundedText(value, "Navigation data view", 80);
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(token)) {
    throw new Error("Navigation data view must be a simple identifier.");
  }
  return token;
}
function themeValue(value, label) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${label} must be a six-digit hexadecimal color.`);
  }
  return value.toLowerCase();
}
function resolveLearnerUiTheme(appearance = {}) {
  const unknownKeys = Object.keys(appearance).filter((key) => key !== "palette" && key !== "theme");
  if (unknownKeys.length) {
    throw new Error(`Unknown learner UI appearance field: ${unknownKeys[0]}`);
  }
  const palette = appearance.palette ?? "paper";
  if (!LEARNER_UI_PALETTE_NAMES.includes(palette)) {
    throw new Error(`Unknown learner UI palette: ${String(palette)}`);
  }
  const theme = appearance.theme ?? {};
  const unknownThemeKeys = Object.keys(theme).filter((key) => !(key in DEFAULT_THEME));
  if (unknownThemeKeys.length) {
    throw new Error(`Unknown learner UI theme token: ${unknownThemeKeys[0]}`);
  }
  const base = LEARNER_UI_PALETTES[palette];
  return Object.freeze(Object.fromEntries(Object.entries(base).map(([key, fallback]) => [
    key,
    themeValue(theme[key] ?? fallback, `appearance.theme.${key}`)
  ])));
}
function createLearnerUiCss(theme = {}, options = {}) {
  const unknownKeys = Object.keys(theme).filter((key) => !(key in DEFAULT_THEME));
  if (unknownKeys.length) {
    throw new Error(`Unknown learner UI theme token: ${unknownKeys[0]}`);
  }
  const unknownOptionKeys = Object.keys(options).filter((key) => key !== "palette");
  if (unknownOptionKeys.length) {
    throw new Error(`Unknown learner UI CSS option: ${unknownOptionKeys[0]}`);
  }
  const palette = options.palette ?? "paper";
  if (!LEARNER_UI_PALETTE_NAMES.includes(palette)) {
    throw new Error(`Unknown learner UI palette: ${String(palette)}`);
  }
  const colors = Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key, fallback]) => [
    key,
    themeValue(theme[key] ?? fallback, `theme.${key}`)
  ]));
  return `:root {
  color-scheme: light;
  --learner-font-sans: var(--font-geist-sans, "Helvetica Neue"), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --learner-font-reading: "Iowan Old Style", Baskerville, "Times New Roman", serif;
  --learner-font-mono: var(--font-geist-mono, "SFMono-Regular"), ui-monospace, Consolas, "Liberation Mono", monospace;
  --learner-color-canvas: ${colors.canvas};
  --learner-color-surface: ${colors.surface};
  --learner-color-surface-muted: ${colors.surfaceMuted};
  --learner-color-ink: ${colors.ink};
  --learner-color-muted: ${colors.muted};
  --learner-color-border: ${colors.border};
  --learner-color-accent: ${colors.accent};
  --learner-color-accent-strong: ${colors.accentStrong};
  --learner-color-accent-soft: ${colors.accentSoft};
  --learner-color-accent-contrast: ${colors.accentContrast};
  --learner-color-success: ${colors.success};
  --learner-color-success-soft: ${colors.successSoft};
  --learner-color-danger: ${colors.danger};
  --learner-color-danger-soft: ${colors.dangerSoft};
  --learner-color-warning: ${colors.warning};
  --learner-color-focus: ${colors.focus};
  --learner-code-surface: color-mix(in srgb, var(--learner-color-surface) 82%, var(--learner-color-surface-muted));
  --learner-code-gutter-surface: color-mix(in srgb, var(--learner-color-surface) 64%, var(--learner-color-surface-muted));
  --learner-code-text: var(--learner-color-ink);
  --learner-code-muted: var(--learner-color-muted);
  --learner-code-keyword: var(--learner-color-accent-strong);
  --learner-code-string: var(--learner-color-warning);
  --learner-code-number: var(--learner-color-success);
  --learner-code-function: var(--learner-color-accent);
  --learner-code-type: var(--learner-color-accent-strong);
  --learner-code-property: var(--learner-color-accent);
  --learner-code-operator: var(--learner-color-accent-strong);
  --learner-code-invalid: var(--learner-color-danger);
  --learner-code-selection: color-mix(in srgb, var(--learner-color-surface) 60%, var(--learner-color-accent-soft));
  --learner-code-active-line: color-mix(in srgb, var(--learner-color-surface) 72%, var(--learner-color-accent-soft));
  --learner-code-caret: var(--learner-color-accent-strong);
  --learner-background-recipe: ${palette};
  --learner-background-image: ${LEARNER_UI_BACKGROUND_IMAGE};
  --learner-background-position: center top;
  --learner-background-repeat: no-repeat;
  --learner-background-size: 100% 42rem;
  --learner-atmosphere-line: color-mix(in srgb, var(--learner-color-accent) 25%, transparent);
  --learner-atmosphere-line-warm: color-mix(in srgb, var(--learner-color-warning) 20%, transparent);
  --learner-atmosphere-glow: color-mix(in srgb, var(--learner-color-accent) 13%, transparent);
  --learner-atmosphere-glint: color-mix(in srgb, var(--learner-color-accent-strong) 64%, var(--learner-color-surface));
  --learner-atmosphere-glint-warm: color-mix(in srgb, var(--learner-color-warning) 58%, var(--learner-color-surface));
  --learner-atmosphere-glint-strength: ${palette === "paper" ? "0" : ".38"};
  --learner-space-1: .25rem;
  --learner-space-2: .5rem;
  --learner-space-3: .75rem;
  --learner-space-4: 1rem;
  --learner-space-5: 1.5rem;
  --learner-space-6: 2rem;
  --learner-space-7: 3rem;
  --learner-space-8: 4.5rem;
  --learner-radius-sm: .3rem;
  --learner-radius-md: .5rem;
  --learner-radius-lg: .75rem;
  --learner-border: 1px solid var(--learner-color-border);
  --learner-shadow-sm: 0 1px 1px color-mix(in srgb, var(--learner-color-ink) 6%, transparent);
  --learner-shadow-md: 0 18px 50px color-mix(in srgb, var(--learner-color-ink) 11%, transparent);
  --learner-width-reading: 45rem;
  --learner-width-content: 78rem;
  --learner-width-wide: 92rem;
  --learner-header-height: 4.9rem;
  --learner-context-nav-height: 0rem;
  --learner-rhythm-section: clamp(2.1rem, 4.2vw, 3.5rem);
  --learner-rhythm-major: clamp(3.15rem, 5.6vw, 4.9rem);
  font-family: var(--learner-font-sans);
  font-synthesis: none;
}
* { box-sizing: border-box; }
html {
  background-color: var(--learner-color-canvas);
  color: var(--learner-color-ink);
  scroll-behavior: smooth;
}
body.learner-ui {
  background-color: var(--learner-color-canvas);
  background-image: var(--learner-background-image);
  background-position: var(--learner-background-position);
  background-repeat: var(--learner-background-repeat);
  background-size: var(--learner-background-size);
  color: var(--learner-color-ink);
  font-family: var(--learner-font-sans);
  line-height: 1.5;
  margin: 0;
  min-height: 100vh;
}
body.learner-ui:has(.learner-context-nav) {
  --learner-context-nav-height: 3.35rem;
}
.learner-atmosphere {
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  position: fixed;
  z-index: 0;
}
.learner-atmosphere__line {
  border: 0;
  border-radius: 50%;
  filter: drop-shadow(0 0 16px var(--learner-atmosphere-glow));
  opacity: 0;
  position: absolute;
  will-change: opacity;
}
.learner-atmosphere__line::after {
  background: linear-gradient(90deg, transparent, var(--learner-atmosphere-glint), transparent);
  content: "";
  height: 1px;
  opacity: var(--learner-atmosphere-glint-strength);
  position: absolute;
  width: clamp(3.75rem, 6vw, 6.5rem);
}
.learner-atmosphere__line--intro {
  border-bottom: 1px solid var(--learner-atmosphere-line);
  height: 30rem;
  right: -13rem;
  top: -10rem;
  transform: rotate(-18deg);
  width: 57rem;
}
.learner-atmosphere__line--intro::after {
  bottom: -1px;
  right: 30%;
}
.learner-atmosphere__line--1 {
  border-top: 1px solid var(--learner-atmosphere-line);
  height: 13rem;
  left: -14rem;
  top: 34vh;
  transform: rotate(7deg);
  width: 48rem;
}
.learner-atmosphere__line--1::after {
  left: 43%;
  top: -1px;
}
.learner-atmosphere__line--2 {
  border-left: 1px solid var(--learner-atmosphere-line);
  height: 42rem;
  right: -19rem;
  top: 20vh;
  transform: rotate(12deg);
  width: 30rem;
}
.learner-atmosphere__line--2::after {
  background: linear-gradient(180deg, transparent, var(--learner-atmosphere-glint), transparent);
  height: clamp(3.75rem, 6vw, 6.5rem);
  left: -1px;
  top: 38%;
  width: 1px;
}
.learner-atmosphere__line--3 {
  border-top: 1px solid var(--learner-atmosphere-line-warm);
  bottom: 7vh;
  height: 11rem;
  left: 18vw;
  transform: rotate(-5deg);
  width: 64vw;
}
.learner-atmosphere__line--3::after {
  background: linear-gradient(90deg, transparent, var(--learner-atmosphere-glint-warm), transparent);
  right: 24%;
  top: -1px;
}
.learner-ui button,
.learner-ui input,
.learner-ui select,
.learner-ui textarea { font: inherit; }
.learner-ui button,
.learner-ui a,
.learner-ui summary { -webkit-tap-highlight-color: transparent; }
.learner-ui a { color: inherit; }
.learner-ui [hidden] { display: none !important; }
.learner-ui :focus-visible {
  outline: 3px solid var(--learner-color-focus);
  outline-offset: 3px;
}
.learner-skip-link {
  background: var(--learner-color-ink);
  border-radius: var(--learner-radius-sm);
  color: var(--learner-color-surface);
  left: var(--learner-space-4);
  padding: .7rem 1rem;
  position: fixed;
  text-decoration: none;
  top: -6rem;
  z-index: 100;
}
.learner-skip-link:focus { top: var(--learner-space-4); }
.learner-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 1;
}
.learner-header {
  background: color-mix(in srgb, var(--learner-color-canvas) 86%, transparent);
  border-bottom: var(--learner-border);
  position: relative;
  z-index: 20;
}
.learner-header__inner {
  align-items: center;
  display: flex;
  gap: clamp(var(--learner-space-4), 2.5vw, var(--learner-space-6));
  margin: 0 auto;
  max-width: var(--learner-width-wide);
  min-height: var(--learner-header-height);
  padding: 0 clamp(1rem, 4vw, 3rem);
}
.learner-header__identity {
  align-items: center;
  display: flex;
  flex: 0 1 auto;
  gap: var(--learner-space-3);
  min-width: 0;
}
.learner-wordmark {
  align-items: center;
  display: inline-flex;
  font-size: .94rem;
  font-weight: 760;
  gap: .65rem;
  letter-spacing: -.015em;
  line-height: 1.1;
  min-height: 2.75rem;
  text-decoration: none;
}
.learner-wordmark__mark {
  background: var(--learner-color-accent);
  border-radius: .2rem;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--learner-color-accent-strong) 30%, transparent);
  display: inline-block;
  height: 1rem;
  transform: rotate(-7deg);
  width: 1rem;
}
.learner-header__meta {
  color: var(--learner-color-muted);
  font-size: .7rem;
  letter-spacing: .015em;
  white-space: nowrap;
}
.learner-primary-nav--desktop {
  justify-content: center;
  margin-left: auto;
}
.learner-nav-menu {
  flex: 0 0 auto;
  position: relative;
}
.learner-nav-menu > summary {
  align-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--learner-radius-sm);
  cursor: pointer;
  display: flex;
  font-size: .76rem;
  font-weight: 720;
  letter-spacing: .025em;
  min-height: 2.75rem;
  padding: .5rem .8rem;
}
.learner-nav-menu > summary::marker { content: ""; }
.learner-nav-menu > summary::after {
  content: "↓";
  font-size: .8rem;
  margin-left: .55rem;
}
.learner-nav-menu[open] > summary {
  background: var(--learner-color-surface-muted);
  border-color: var(--learner-color-border);
}
.learner-nav-menu[open] > summary::after { content: "↑"; }
.learner-nav-menu__panel {
  background: var(--learner-color-surface);
  border: var(--learner-border);
  border-radius: var(--learner-radius-md);
  box-shadow: var(--learner-shadow-md);
  display: grid;
  gap: var(--learner-space-1);
  min-width: min(19rem, calc(100vw - 2rem));
  padding: var(--learner-space-2);
  position: absolute;
  right: 0;
  top: calc(100% + var(--learner-space-2));
}
.learner-nav-menu:not([open]) > .learner-nav-menu__panel { display: none; }
.learner-global-nav,
.learner-primary-nav {
  align-items: center;
  display: flex;
  gap: var(--learner-space-2);
}
.learner-global-nav {
  align-items: stretch;
  display: grid;
  gap: var(--learner-space-1);
}
.learner-global-nav a,
.learner-primary-nav a {
  align-items: center;
  border-radius: var(--learner-radius-sm);
  color: var(--learner-color-muted);
  display: inline-flex;
  font-size: .78rem;
  font-weight: 680;
  min-height: 2.75rem;
  padding: .58rem .8rem;
  text-decoration: none;
}
.learner-global-nav a { display: flex; }
.learner-primary-nav--mobile {
  border-top: var(--learner-border);
  display: none;
  padding-top: var(--learner-space-2);
}
.learner-global-nav a:hover,
.learner-primary-nav a:hover {
  background: var(--learner-color-surface-muted);
  color: var(--learner-color-ink);
}
.learner-global-nav a[aria-current="page"],
.learner-primary-nav a[aria-current="page"] {
  background: var(--learner-color-accent-soft);
  color: var(--learner-color-accent-strong);
}
.learner-context-nav {
  border-bottom: var(--learner-border);
  min-height: var(--learner-context-nav-height);
  position: relative;
  z-index: 10;
}
.learner-context-nav__inner {
  align-items: stretch;
  display: flex;
  gap: var(--learner-space-5);
  margin: 0 auto;
  max-width: var(--learner-width-wide);
  min-height: var(--learner-context-nav-height);
  overflow-x: auto;
  padding: 0 clamp(1rem, 4vw, 3rem);
  scrollbar-width: thin;
}
.learner-context-nav a {
  align-items: center;
  border-bottom: 2px solid transparent;
  color: var(--learner-color-muted);
  display: inline-flex;
  flex: 0 0 auto;
  font-size: .75rem;
  font-weight: 690;
  letter-spacing: .015em;
  min-height: var(--learner-context-nav-height);
  padding: .3rem 0;
  text-decoration: none;
}
.learner-context-nav a:hover {
  color: var(--learner-color-ink);
}
.learner-context-nav a[aria-current="page"] {
  border-bottom-color: var(--learner-color-accent);
  color: var(--learner-color-accent-strong);
}
.learner-context-nav a:focus-visible {
  outline-offset: -3px;
}
.learner-main {
  flex: 1 0 auto;
  margin: 0 auto;
  max-width: var(--learner-width-wide);
  width: 100%;
}
.learner-layout {
  display: grid;
  grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
  min-height: calc(
    100vh
    - var(--learner-header-height)
    - var(--learner-context-nav-height)
  );
}
.learner-sidebar {
  background: color-mix(in srgb, var(--learner-color-surface-muted) 86%, transparent);
  border-right: var(--learner-border);
  min-width: 0;
  padding: clamp(1.25rem, 3vw, 2.25rem);
}
.learner-sidebar__header { margin-bottom: var(--learner-space-5); }
.learner-content {
  background: color-mix(in srgb, var(--learner-color-surface) 91%, transparent);
  min-width: 0;
  padding: clamp(1.5rem, 5vw, 4rem);
}
.learner-reading {
  margin: 0 auto;
  max-width: var(--learner-width-reading);
}
.learner-reading h1,
.learner-reading h2,
.learner-reading h3,
.learner-content > h1,
.learner-content > h2 {
  font-family: var(--learner-font-reading);
  font-weight: 500;
  letter-spacing: -.035em;
}
.learner-eyebrow {
  color: var(--learner-color-accent-strong);
  font-size: .7rem;
  font-weight: 760;
  letter-spacing: .09em;
  margin: 0 0 var(--learner-space-2);
  text-transform: uppercase;
}
.learner-summary {
  color: var(--learner-color-muted);
  line-height: 1.65;
}
.learner-card {
  background: color-mix(in srgb, var(--learner-color-surface) 78%, transparent);
  border: var(--learner-border);
  border-radius: var(--learner-radius-md);
  box-shadow: none;
  padding: var(--learner-space-5);
}
.learner-button {
  align-items: center;
  background: var(--learner-color-surface);
  border: 1px solid var(--learner-color-border);
  border-radius: var(--learner-radius-sm);
  color: var(--learner-color-ink);
  cursor: pointer;
  display: inline-flex;
  font-size: .84rem;
  font-weight: 720;
  justify-content: center;
  min-height: 2.75rem;
  padding: .65rem 1rem;
}
.learner-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--learner-color-ink) 45%, var(--learner-color-border));
  transform: translateY(-1px);
}
.learner-button[data-variant="primary"] {
  background: var(--learner-color-accent);
  border-color: var(--learner-color-accent);
  color: var(--learner-color-accent-contrast);
}
.learner-button[data-variant="quiet"] {
  background: transparent;
  border-color: transparent;
  color: var(--learner-color-muted);
}
.learner-button:disabled {
  cursor: not-allowed;
  opacity: .56;
}
.learner-button-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--learner-space-3);
}
.learner-form fieldset {
  border: 0;
  margin: 0;
  padding: 0;
}
.learner-form label {
  align-items: flex-start;
  border: var(--learner-border);
  border-radius: var(--learner-radius-sm);
  cursor: pointer;
  display: flex;
  gap: var(--learner-space-3);
  padding: .8rem;
}
.learner-form label:has(input:checked) {
  background: var(--learner-color-accent-soft);
  border-color: var(--learner-color-accent);
}
.learner-examples {
  border-bottom: var(--learner-border);
  border-top: var(--learner-border);
  display: grid;
  list-style: none;
  margin: var(--learner-space-3) 0 0;
  padding: 0;
}
.learner-example {
  border: 0;
  display: grid;
  gap: var(--learner-space-3);
  margin: 0;
  min-width: 0;
  padding: var(--learner-space-4) 0;
}
.learner-example + .learner-example {
  border-top: var(--learner-border);
}
.learner-example legend {
  color: var(--learner-color-ink);
  font-size: .84rem;
  font-weight: 720;
  padding: 0;
}
.learner-field {
  display: grid;
  gap: var(--learner-space-1);
  min-width: 0;
}
.learner-field__label {
  color: var(--learner-color-ink);
  font-size: .76rem;
  font-weight: 720;
}
.learner-field__hint,
.learner-field__error {
  font-size: .73rem;
  line-height: 1.45;
  margin: 0;
}
.learner-field__hint {
  color: var(--learner-color-muted);
}
.learner-field__error {
  color: var(--learner-color-danger);
  min-height: 1.05rem;
}
.learner-textarea {
  background: color-mix(in srgb, var(--learner-color-surface) 86%, transparent);
  border: 1px solid var(--learner-color-border);
  border-radius: var(--learner-radius-sm);
  color: var(--learner-color-ink);
  font: .82rem/1.5 var(--learner-font-mono);
  max-width: 100%;
  min-height: 4.4rem;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: .7rem .8rem;
  resize: vertical;
  width: 100%;
}
.learner-textarea[aria-invalid="true"] {
  border-color: var(--learner-color-danger);
}
.learner-example__reference {
  color: var(--learner-color-muted);
  display: grid;
  font-size: .76rem;
  gap: var(--learner-space-1);
  line-height: 1.5;
  margin: 0;
}
.learner-example__reference code {
  color: var(--learner-color-ink);
  font: .78rem/1.5 var(--learner-font-mono);
  overflow-wrap: anywhere;
}
.learner-example__modified {
  color: var(--learner-color-accent-strong);
  font-size: .7rem;
  font-weight: 760;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.learner-example__actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--learner-space-2);
}
.learner-status.learner-example__status {
  margin-top: 0;
  min-height: 2rem;
}
.learner-status {
  border-left: 3px solid var(--learner-color-border);
  color: var(--learner-color-muted);
  line-height: 1.55;
  margin: var(--learner-space-4) 0 0;
  padding: .25rem 0 .25rem var(--learner-space-3);
}
.learner-status[data-tone="success"] {
  border-color: var(--learner-color-success);
  color: var(--learner-color-success);
}
.learner-status[data-tone="danger"] {
  border-color: var(--learner-color-danger);
  color: var(--learner-color-danger);
}
.learner-status[data-tone="warning"] {
  border-color: var(--learner-color-warning);
  color: var(--learner-color-warning);
}
.learner-results {
  background: color-mix(in srgb, var(--learner-color-surface-muted) 72%, transparent);
  border: var(--learner-border);
  border-radius: var(--learner-radius-md);
  margin-top: var(--learner-space-4);
  min-height: 5rem;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: var(--learner-space-4);
}
.learner-results h3 {
  font-size: .78rem;
  letter-spacing: .07em;
  margin: 0 0 var(--learner-space-3);
  text-transform: uppercase;
}
.learner-results ol,
.learner-results ul {
  display: grid;
  gap: var(--learner-space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.learner-results li {
  background: var(--learner-color-surface);
  border-left: 3px solid var(--learner-color-danger);
  border-radius: var(--learner-radius-sm);
  font-size: .82rem;
  line-height: 1.5;
  padding: var(--learner-space-3);
}
.learner-results li[data-passed="true"] {
  border-left-color: var(--learner-color-success);
}
.learner-solution {
  border-top: var(--learner-border);
  margin-top: var(--learner-space-5);
  padding-top: var(--learner-space-2);
}
.learner-solution-host { display: contents; }
.learner-solution > summary {
  align-items: center;
  background: transparent;
  color: var(--learner-color-accent-strong);
  cursor: pointer;
  display: flex;
  font-size: .82rem;
  font-weight: 720;
  min-height: 2.75rem;
  padding: .45rem 0;
}
.learner-solution > summary::marker { content: ""; }
.learner-solution > summary::-webkit-details-marker { display: none; }
.learner-solution > summary::after {
  content: "+";
  margin-left: auto;
}
.learner-solution[open] > summary::after { content: "−"; }
.learner-solution pre {
  background: transparent;
  border-left: 2px solid var(--learner-color-border);
  border-radius: 0;
  color: var(--learner-color-ink);
  font: .82rem/1.6 var(--learner-font-mono);
  margin: var(--learner-space-2) 0 0;
  max-width: 100%;
  overflow: auto;
  overscroll-behavior-x: contain;
  padding: var(--learner-space-3) 0 var(--learner-space-3) var(--learner-space-4);
  white-space: pre;
}
.learner-empty {
  background: var(--learner-color-surface-muted);
  border: 1px dashed var(--learner-color-border);
  border-radius: var(--learner-radius-md);
  color: var(--learner-color-muted);
  margin: clamp(2rem, 8vw, 5rem) auto;
  max-width: 42rem;
  padding: var(--learner-space-6);
  text-align: center;
}
.learner-editor-frame {
  background: var(--learner-color-surface);
  border: var(--learner-border);
  border-radius: var(--learner-radius-md);
  min-width: 0;
  overflow: hidden;
}
.learner-editor-frame .learner-solution {
  border-top: 0;
  margin-top: 0;
  padding: 0 var(--learner-space-4);
}
.learner-editor-toolbar {
  align-items: center;
  background: var(--learner-color-surface-muted);
  border-bottom: var(--learner-border);
  display: flex;
  justify-content: space-between;
  min-height: 3.25rem;
  padding: .6rem .85rem;
}
.learner-editor {
  background: var(--learner-code-surface);
  border: 0;
  color: var(--learner-code-text);
  display: block;
  font: .875rem/1.6 var(--learner-font-mono);
  min-height: 18rem;
  outline: none;
  padding: var(--learner-space-4);
  resize: vertical;
  tab-size: 2;
  width: 100%;
}
.learner-code-editor {
  background: var(--learner-code-surface);
  color: var(--learner-code-text);
  display: block;
  font-family: var(--learner-font-mono);
  min-height: 18rem;
  overflow: auto;
  resize: vertical;
  width: 100%;
}
.learner-code-editor .cm-editor {
  background: var(--learner-code-surface);
  height: 100%;
  min-height: inherit;
}
.learner-code-editor .cm-scroller {
  min-height: inherit;
  overscroll-behavior: contain;
}
.learner-code-editor .cm-content { min-height: inherit; }
.learner-code-editor .cm-gutters {
  background: var(--learner-code-gutter-surface);
}
.learner-code-editor .cm-editor.cm-focused { outline: 0; }
.learner-editor:focus-visible {
  box-shadow: inset 0 0 0 3px var(--learner-color-surface);
  outline: 0;
}
.learner-editor-frame:has(.learner-editor:focus-visible),
.learner-editor-frame:has(.learner-code-editor .cm-editor.cm-focused) {
  outline: 3px solid var(--learner-color-focus);
  outline-offset: 3px;
}
.learner-progress-summary {
  background: var(--learner-color-surface);
  border: var(--learner-border);
  border-radius: var(--learner-radius-md);
  display: grid;
  gap: var(--learner-space-2);
  margin: var(--learner-space-5) 0;
  padding: var(--learner-space-4);
}
.learner-progress {
  accent-color: var(--learner-color-accent);
  height: .65rem;
  width: 100%;
}
.learner-progress-summary small { color: var(--learner-color-muted); }
.learner-resume {
  align-items: flex-start;
  color: var(--learner-color-muted);
  display: flex;
  font-size: .78rem;
  gap: var(--learner-space-2);
  line-height: 1.45;
  margin: 0;
}
.learner-resume strong { color: var(--learner-color-accent-strong); }
.learner-nav-list {
  display: grid;
  gap: var(--learner-space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.learner-nav-item {
  align-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--learner-radius-sm);
  color: var(--learner-color-muted);
  cursor: pointer;
  display: flex;
  gap: var(--learner-space-3);
  min-height: 2.75rem;
  padding: .6rem .7rem;
  text-align: left;
  width: 100%;
}
.learner-nav-item:hover {
  background: var(--learner-color-surface);
  color: var(--learner-color-ink);
}
.learner-nav-item[aria-current="true"],
.learner-nav-item[aria-current="page"] {
  background: var(--learner-color-accent-soft);
  border-color: color-mix(in srgb, var(--learner-color-accent) 35%, var(--learner-color-border));
  color: var(--learner-color-accent-strong);
}
.learner-status-dot {
  border: 1px solid var(--learner-color-muted);
  border-radius: 50%;
  flex: 0 0 auto;
  height: .55rem;
  width: .55rem;
}
.learner-status-dot[data-status="attempted"] {
  background: var(--learner-color-warning);
  border-color: var(--learner-color-warning);
}
.learner-status-dot[data-status="solved"] {
  background: var(--learner-color-success);
  border-color: var(--learner-color-success);
}
.learner-mobile-panel > summary {
  align-items: center;
  background: var(--learner-color-surface);
  border: var(--learner-border);
  border-radius: var(--learner-radius-sm);
  cursor: pointer;
  display: none;
  font-size: .82rem;
  font-weight: 720;
  justify-content: space-between;
  margin-bottom: var(--learner-space-3);
  min-height: 2.75rem;
  padding: .6rem .8rem;
}
.learner-mobile-panel > summary::marker { content: ""; }
.learner-mobile-panel > summary::after { content: "Show"; color: var(--learner-color-muted); }
.learner-mobile-panel[open] > summary::after { content: "Hide"; }
.learner-footer {
  border-top: var(--learner-border);
  color: var(--learner-color-muted);
  font-size: .75rem;
  margin-top: auto;
}
.learner-footer__inner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--learner-space-3) var(--learner-space-5);
  justify-content: space-between;
  margin: 0 auto;
  max-width: var(--learner-width-wide);
  padding: var(--learner-space-4) clamp(1rem, 4vw, 3rem);
}
.learner-sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
.learner-nav-menu--local-only > summary { display: none; }
@media (max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px) {
  .learner-layout { grid-template-columns: 1fr; }
  .learner-sidebar {
    border-bottom: var(--learner-border);
    border-right: 0;
  }
  .learner-mobile-panel[data-learner-collapse-at="stacked"] > summary { display: flex; }
  .learner-mobile-panel[data-learner-collapse-at="stacked"]:not([open]) > .learner-mobile-panel__content { display: none; }
}
@media (max-width: ${LEARNER_UI_BREAKPOINTS.compact}px), (max-height: 500px) {
  :root { --learner-header-height: 4rem; }
  html { scroll-behavior: auto; }
  .learner-header__inner {
    gap: var(--learner-space-3);
    min-height: var(--learner-header-height);
    padding: 0 var(--learner-space-4);
  }
  .learner-header__meta { display: none; }
  .learner-primary-nav--desktop { display: none; }
  .learner-nav-menu { margin-left: auto; }
  .learner-nav-menu > summary { display: flex; }
  .learner-nav-menu--local-only > summary { display: flex; }
  .learner-primary-nav--mobile {
    align-items: stretch;
    display: grid;
    gap: var(--learner-space-1);
  }
  .learner-global-nav {
    border-bottom: var(--learner-border);
    padding: 0 0 var(--learner-space-2);
  }
  .learner-global-nav a,
  .learner-primary-nav--mobile a { display: flex; }
  .learner-mobile-panel > summary { display: flex; }
  .learner-mobile-panel:not([open]) > .learner-mobile-panel__content { display: none; }
  .learner-content { padding: var(--learner-space-5) var(--learner-space-4); }
  .learner-button { min-height: 2.9rem; }
  .learner-example__actions .learner-button { flex: 1 1 9rem; }
  .learner-editor { font-size: 1rem; }
  .learner-code-editor .cm-editor { font-size: 1rem; }
  .learner-footer__inner { flex-direction: column; }
}
@media (min-width: ${LEARNER_UI_BREAKPOINTS.compact + 1}px) and (min-height: 501px) {
  .learner-mobile-panel > .learner-mobile-panel__content { display: block !important; }
}
@media (min-width: ${LEARNER_UI_BREAKPOINTS.compact + 1}px) and (min-height: 501px) and (max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px) {
  .learner-mobile-panel[data-learner-collapse-at="stacked"]:not([open]) > .learner-mobile-panel__content { display: none !important; }
}
@media (min-width: ${LEARNER_UI_BREAKPOINTS.stacked + 1}px) and (min-height: 501px) {
  .learner-mobile-panel[data-learner-collapse-at="stacked"] > .learner-mobile-panel__content { display: block !important; }
}
.learner-mobile-panel[data-learner-collapse-at="always"] > summary { display: flex; }
.learner-mobile-panel[data-learner-collapse-at="always"]:not([open]) > .learner-mobile-panel__content {
  display: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .learner-atmosphere__line {
    opacity: 0 !important;
    will-change: auto;
  }
  .learner-atmosphere__line::after { opacity: 0 !important; }
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
@media (forced-colors: active) {
  body.learner-ui { background-image: none; }
  .learner-atmosphere { display: none; }
  .learner-status-dot[data-status] { forced-color-adjust: none; }
}
@media print {
  body.learner-ui { background-image: none; }
  .learner-atmosphere { display: none; }
}
`;
}
function renderLearnerAtmosphere() {
  const traces = Array.from({ length: LEARNER_UI_ATMOSPHERE_TRACE_COUNT }, (_, index) => `<span class="learner-atmosphere__line learner-atmosphere__line--${index + 1}" data-learner-atmosphere-trace></span>`).join("");
  return `<div class="learner-atmosphere" data-learner-atmosphere aria-hidden="true"><span class="learner-atmosphere__line learner-atmosphere__line--intro" data-learner-atmosphere-intro></span>${traces}</div>`;
}
function renderLearnerNavigationItems(items, itemLabel) {
  return items.map((item, index) => {
    const label = boundedText(item.label, `${itemLabel} item ${index + 1} label`, 120);
    const href = safeLocalHref(item.href, `${itemLabel} item ${index + 1} path`);
    const dataView = item.dataView === void 0 ? "" : ` data-view="${escapeHtml(navigationToken(item.dataView))}"`;
    const current = item.current ? ' aria-current="page"' : "";
    return `<a href="${escapeHtml(href)}"${current}${dataView}>${escapeHtml(label)}</a>`;
  }).join("");
}
function renderLearnerHeader(options) {
  const productName = boundedText(options.productName, "Product name", 160);
  const homeHref = safeLocalHref(options.homeHref, "Header home path");
  const homeLabel = boundedText(options.homeLabel ?? `${productName} home`, "Header home label", 200);
  const navigationLabel = boundedText(options.navigationLabel, "Navigation label", 160);
  const menuLabel = boundedText(options.menuLabel ?? (options.globalNavigation ? "Learning suite" : "Menu"), "Menu label", 80);
  if (!Array.isArray(options.navigation) || options.navigation.length === 0) {
    throw new Error("Learner header navigation must include at least one item.");
  }
  const navigation = renderLearnerNavigationItems(options.navigation, "Navigation");
  const globalNavigation = options.globalNavigation === void 0 ? "" : (() => {
    if (!Array.isArray(options.globalNavigation) || options.globalNavigation.length === 0) {
      throw new Error("Global learner navigation must include at least one item when configured.");
    }
    const label = boundedText(options.globalNavigationLabel ?? "Learning experiences", "Global navigation label", 160);
    return `<nav class="learner-global-nav" aria-label="${escapeHtml(label)}">${renderLearnerNavigationItems(options.globalNavigation, "Global navigation")}</nav>`;
  })();
  const meta = options.meta === void 0 ? "" : `<span class="learner-header__meta">${escapeHtml(boundedText(options.meta, "Header metadata", 160))}</span>`;
  const menuClass = globalNavigation ? "learner-nav-menu" : "learner-nav-menu learner-nav-menu--local-only";
  return `<header class="learner-header">
  <div class="learner-header__inner">
    <div class="learner-header__identity">
      <a class="learner-wordmark" href="${escapeHtml(homeHref)}" aria-label="${escapeHtml(homeLabel)}"><i class="learner-wordmark__mark" aria-hidden="true"></i><span>${escapeHtml(productName)}</span></a>
      ${meta}
    </div>
    <nav class="learner-primary-nav learner-primary-nav--desktop" aria-label="${escapeHtml(navigationLabel)}">${navigation}</nav>
    <details class="${menuClass}">
      <summary>${escapeHtml(menuLabel)}</summary>
      <div class="learner-nav-menu__panel">
        ${globalNavigation}
        <nav class="learner-primary-nav learner-primary-nav--mobile" aria-label="${escapeHtml(navigationLabel)}">${navigation}</nav>
      </div>
    </details>
  </div>
</header>`;
}
function renderLearnerContextNavigation(options) {
  const navigationLabel = boundedText(options.navigationLabel, "Context navigation label", 160);
  if (!Array.isArray(options.navigation) || options.navigation.length === 0) {
    throw new Error("Learner context navigation must include at least one item.");
  }
  const navigation = renderLearnerNavigationItems(options.navigation, "Context navigation");
  return `<nav class="learner-context-nav" aria-label="${escapeHtml(navigationLabel)}"><div class="learner-context-nav__inner">${navigation}</div></nav>`;
}
function renderLearnerFooter(options = {}) {
  const summary = options.summary === void 0 ? "" : `<span>${escapeHtml(boundedText(options.summary, "Footer summary", 240))}</span>`;
  const attribution = options.attribution === void 0 ? "" : `<span>${escapeHtml(boundedText(options.attribution, "Footer attribution", 160))}</span>`;
  if (!summary && !attribution)
    return "";
  return `<footer class="learner-footer"><div class="learner-footer__inner">${summary}${attribution}</div></footer>`;
}
var learnerUiJavaScript = `(() => {
  "use strict";
  const solutionNote = "Compare the control flow and boundary cases with your draft. Opening this reference does not replace your work or update progress.";
  const preparedCodeEditors = new WeakMap();
  let editorInstructionSequence = 0;
  let exampleEditorSequence = 0;
  const componentText = (value, label, maximum) => {
    if (
      typeof value !== "string"
      || value.trim().length === 0
      || value.length > maximum
      || /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(value)
    ) {
      throw new Error(label + " must be non-empty trusted text no longer than " + maximum + " characters.");
    }
    return value;
  };
  const createSolutionDisclosure = ({ source, title, label = "View example solution" }) => {
    const trustedSource = componentText(source, "Example solution source", 50000);
    const trustedTitle = componentText(title, "Example solution title", 200).trim();
    const trustedLabel = componentText(label, "Example solution label", 80).trim();
    const details = document.createElement("details");
    details.className = "learner-solution";
    const summary = document.createElement("summary");
    summary.textContent = trustedLabel;
    summary.setAttribute("aria-label", trustedLabel + " for " + trustedTitle);
    const note = document.createElement("p");
    note.className = "learner-summary";
    note.textContent = solutionNote;
    const sourceFrame = document.createElement("pre");
    sourceFrame.className = "learner-solution__code";
    sourceFrame.tabIndex = 0;
    sourceFrame.setAttribute("aria-label", trustedTitle + " example solution");
    const code = document.createElement("code");
    code.textContent = trustedSource;
    sourceFrame.append(code);
    details.append(summary, note, sourceFrame);
    return details;
  };
  const boundedJsonProblem = (input) => {
    const stack = [{ depth: 0, value: input }];
    const seen = new Set();
    let nodes = 0;
    while (stack.length) {
      const current = stack.pop();
      nodes += 1;
      if (nodes > 2000) return "JSON values may not contain more than 2,000 values.";
      if (current.depth > 12) return "JSON values may not be nested more than 12 levels.";
      if (
        current.value === null
        || typeof current.value === "boolean"
        || (typeof current.value === "number" && Number.isFinite(current.value))
      ) continue;
      if (typeof current.value === "string") {
        if (current.value.length > 20000) {
          return "JSON strings may not exceed 20,000 characters.";
        }
        continue;
      }
      if (!current.value || typeof current.value !== "object") {
        return "Use JSON values only.";
      }
      if (seen.has(current.value)) {
        return "JSON values may not contain shared or circular objects.";
      }
      seen.add(current.value);
      if (Array.isArray(current.value)) {
        if (current.value.length > 200) {
          return "JSON arrays may not contain more than 200 entries.";
        }
        current.value.forEach((value) => {
          stack.push({ depth: current.depth + 1, value });
        });
        continue;
      }
      if (Object.getPrototypeOf(current.value) !== Object.prototype) {
        return "JSON objects must use a plain object shape.";
      }
      const entries = Object.entries(current.value);
      if (entries.length > 200) {
        return "JSON objects may not contain more than 200 fields.";
      }
      for (const [key, value] of entries) {
        if (key.length > 200) {
          return "JSON object keys may not exceed 200 characters.";
        }
        stack.push({ depth: current.depth + 1, value });
      }
    }
    return null;
  };
  const cloneJson = (value) => JSON.parse(JSON.stringify(value));
  const argumentArrayProblem = (values) => {
    for (let index = 0; index < values.length; index += 1) {
      const problem = boundedJsonProblem(values[index]);
      if (problem) return "Argument " + (index + 1) + ": " + problem;
    }
    return null;
  };
  const createEditableExamples = ({
    examples,
    inputLabel = "Arguments (JSON)",
    constructorInputLabel = "Constructor arguments (JSON)",
    expectedLabel = "Published expected (for the original input)",
    runLabel = "Run this input",
    resetLabel = "Reset input",
    cancelLabel = "Cancel",
    helperText = "Enter one JSON array containing the function arguments. This run does not affect progress.",
    runningLabel = "Running this input…",
    receivedLabel = "Received",
    modifiedLabel = "Modified input",
    resetMessage = "Published input restored.",
    onRun,
    onBusyChange,
    onChange,
  }) => {
    if (!Array.isArray(examples) || examples.length === 0) {
      throw new Error("The shared example editor requires at least one example.");
    }
    if (typeof onRun !== "function") {
      throw new Error("The shared example editor requires a trusted run handler.");
    }
    const labels = {
      input: componentText(inputLabel, "Example input label", 120).trim(),
      constructor: componentText(
        constructorInputLabel,
        "Example constructor input label",
        120,
      ).trim(),
      expected: componentText(expectedLabel, "Example expected label", 160).trim(),
      run: componentText(runLabel, "Example run label", 80).trim(),
      reset: componentText(resetLabel, "Example reset label", 80).trim(),
      cancel: componentText(cancelLabel, "Example cancel label", 80).trim(),
      helper: componentText(helperText, "Example helper text", 300).trim(),
      running: componentText(runningLabel, "Example running label", 120).trim(),
      received: componentText(receivedLabel, "Example received label", 80).trim(),
      modified: componentText(modifiedLabel, "Example modified label", 80).trim(),
      resetMessage: componentText(resetMessage, "Example reset message", 120).trim(),
    };
    const list = document.createElement("div");
    list.className = "learner-examples";
    const records = [];
    const identities = new Set();
    let activeRun = null;
    let destroyed = false;
    let disabled = false;
    let revision = 0;
    const notifyBusy = (busy) => {
      if (typeof onBusyChange === "function") onBusyChange(busy);
    };
    const notifyChange = () => {
      revision += 1;
      if (typeof onChange === "function") onChange();
    };
    const clearFieldError = (field) => {
      field.input.removeAttribute("aria-invalid");
      field.error.textContent = "";
    };
    const markFieldError = (field, message) => {
      field.input.setAttribute("aria-invalid", "true");
      field.error.textContent = message;
    };
    const parseField = (field) => {
      clearFieldError(field);
      if (field.input.value.length > 2000000) {
        throw new Error("Example input may not exceed 2,000,000 characters.");
      }
      let parsed;
      try {
        parsed = JSON.parse(field.input.value);
      } catch {
        throw new Error("Enter valid JSON.");
      }
      if (!Array.isArray(parsed)) {
        throw new Error("Use an array of function arguments.");
      }
      if (parsed.length > 20) {
        throw new Error("Use no more than 20 function arguments.");
      }
      const problem = argumentArrayProblem(parsed);
      if (problem) throw new Error(problem);
      return parsed;
    };
    const updateModified = (record) => {
      record.modified.hidden = record.fields.every((field) => (
        field.input.value === field.original
      ));
    };
    const updateDisabled = () => {
      for (const record of records) {
        const busy = Boolean(activeRun);
        for (const field of record.fields) {
          field.input.disabled = disabled || busy;
        }
        record.run.disabled = disabled || busy;
        record.reset.disabled = disabled || busy;
        const ownsRun = activeRun?.record === record;
        record.cancel.hidden = !ownsRun;
        record.cancel.disabled = !ownsRun;
      }
    };
    const resetRecord = (record, announceReset = true) => {
      if (activeRun?.record === record) activeRun.controller.abort();
      for (const field of record.fields) {
        field.input.value = field.original;
        clearFieldError(field);
      }
      updateModified(record);
      record.status.removeAttribute("data-tone");
      record.status.textContent = announceReset ? labels.resetMessage : "";
      notifyChange();
    };
    const observationProblem = (observation) => {
      if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
        return "The practice runtime returned an unreadable example result.";
      }
      if (observation.status === "returned" && Object.hasOwn(observation, "value")) {
        const problem = boundedJsonProblem(observation.value);
        return problem
          ? "The practice runtime returned an invalid value. " + problem
          : null;
      }
      if (
        observation.status === "threw"
        && typeof observation.errorName === "string"
        && observation.errorName.length <= 160
        && typeof observation.message === "string"
        && observation.message.length <= 8192
      ) {
        return null;
      }
      return "The practice runtime returned an unreadable example result.";
    };
    const runRecord = async (record) => {
      if (destroyed || disabled || activeRun) return;
      const values = {};
      let firstInvalid = null;
      for (const field of record.fields) {
        try {
          values[field.kind] = parseField(field);
        } catch (error) {
          markFieldError(field, error?.message || "Enter valid JSON.");
          if (!firstInvalid) firstInvalid = field.input;
        }
      }
      if (firstInvalid) {
        record.status.dataset.tone = "danger";
        record.status.textContent = "Fix the highlighted input before running.";
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      const controller = new AbortController();
      const runRevision = revision;
      activeRun = { controller, record, restoreFocus: false };
      record.status.removeAttribute("data-tone");
      record.status.textContent = labels.running;
      updateDisabled();
      notifyBusy(true);
      try {
        const observation = await onRun({
          id: record.id,
          args: cloneJson(values.args),
          constructorArgs: values.constructorArgs === undefined
            ? undefined
            : cloneJson(values.constructorArgs),
          signal: controller.signal,
        });
        if (
          destroyed
          || controller.signal.aborted
          || activeRun?.controller !== controller
          || revision !== runRevision
        ) return;
        const problem = observationProblem(observation);
        if (problem) throw new Error(problem);
        if (observation.status === "returned") {
          record.status.removeAttribute("data-tone");
          record.status.textContent = labels.received + ": " + JSON.stringify(
            observation.value,
          );
        } else {
          record.status.dataset.tone = "danger";
          record.status.textContent = "Raised " + observation.errorName + ": "
            + observation.message;
        }
      } catch (error) {
        if (
          !destroyed
          && activeRun?.controller === controller
          && revision === runRevision
        ) {
          record.status.dataset.tone = controller.signal.aborted ? "neutral" : "danger";
          record.status.textContent = controller.signal.aborted
            ? "Run canceled. Your input is unchanged."
            : error?.message || String(error);
        }
      } finally {
        if (activeRun?.controller === controller) {
          const restoreFocus = activeRun.restoreFocus;
          activeRun = null;
          notifyBusy(false);
          updateDisabled();
          if (restoreFocus && !destroyed) record.fields[0].input.focus();
        }
      }
    };
    for (const example of examples) {
      if (!example || typeof example !== "object" || Array.isArray(example)) {
        throw new Error("Every shared editable example must be an object.");
      }
      const id = componentText(example.id, "Example id", 160).trim();
      const label = componentText(example.label, "Example label", 200).trim();
      if (identities.has(id)) {
        throw new Error("Shared editable example ids must be unique.");
      }
      identities.add(id);
      if (!Array.isArray(example.args) || example.args.length > 20) {
        throw new Error("Shared editable example arguments must be an array of at most 20 values.");
      }
      if (argumentArrayProblem(example.args)) {
        throw new Error("Shared editable example arguments must contain bounded JSON.");
      }
      if (
        example.constructorArgs !== undefined
        && (
          !Array.isArray(example.constructorArgs)
          || example.constructorArgs.length > 20
          || argumentArrayProblem(example.constructorArgs)
        )
      ) {
        throw new Error("Shared editable constructor arguments must contain bounded JSON.");
      }
      const sequence = ++exampleEditorSequence;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "learner-example";
      const legend = document.createElement("legend");
      legend.textContent = label;
      const modified = document.createElement("span");
      modified.className = "learner-example__modified";
      modified.textContent = labels.modified;
      modified.hidden = true;
      fieldset.append(legend, modified);
      const fields = [];
      const addField = (kind, value, fieldLabel) => {
        const field = document.createElement("div");
        field.className = "learner-field";
        const inputId = "learner-example-input-" + sequence + "-" + kind;
        const hintId = inputId + "-hint";
        const errorId = inputId + "-error";
        const inputLabelNode = document.createElement("label");
        inputLabelNode.className = "learner-field__label";
        inputLabelNode.htmlFor = inputId;
        inputLabelNode.textContent = fieldLabel;
        const input = document.createElement("textarea");
        input.className = "learner-textarea";
        input.id = inputId;
        input.rows = 3;
        input.maxLength = 2000000;
        input.spellcheck = false;
        input.value = JSON.stringify(value);
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "none");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("wrap", "soft");
        input.setAttribute("aria-describedby", hintId + " " + errorId);
        input.setAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
        const hint = document.createElement("p");
        hint.className = "learner-field__hint";
        hint.id = hintId;
        hint.textContent = labels.helper;
        const error = document.createElement("p");
        error.className = "learner-field__error";
        error.id = errorId;
        error.setAttribute("role", "alert");
        field.append(inputLabelNode, input, hint, error);
        fieldset.append(field);
        const record = {
          error,
          input,
          kind,
          original: input.value,
        };
        fields.push(record);
        input.addEventListener("input", () => {
          clearFieldError(record);
          updateModified(exampleRecord);
          exampleRecord.status.removeAttribute("data-tone");
          exampleRecord.status.textContent = "";
          notifyChange();
        });
        input.addEventListener("keydown", (event) => {
          if (
            (event.ctrlKey || event.metaKey)
            && !event.altKey
            && !event.shiftKey
            && !event.isComposing
            && event.key === "Enter"
          ) {
            event.preventDefault();
            void runRecord(exampleRecord);
          }
        });
      };
      let exampleRecord;
      if (example.constructorArgs !== undefined) {
        addField("constructorArgs", example.constructorArgs, labels.constructor);
      }
      addField("args", example.args, labels.input);
      const reference = document.createElement("p");
      reference.className = "learner-example__reference";
      const referenceLabel = document.createElement("strong");
      referenceLabel.textContent = labels.expected;
      const referenceValue = document.createElement("code");
      const expectedJson = JSON.stringify(example.expected);
      referenceValue.textContent = expectedJson === undefined
        ? String(example.expected)
        : expectedJson;
      reference.append(referenceLabel, referenceValue);
      const actions = document.createElement("div");
      actions.className = "learner-example__actions";
      const run = document.createElement("button");
      run.className = "learner-button";
      run.type = "button";
      run.textContent = labels.run;
      const reset = document.createElement("button");
      reset.className = "learner-button";
      reset.dataset.variant = "quiet";
      reset.type = "button";
      reset.textContent = labels.reset;
      const cancel = document.createElement("button");
      cancel.className = "learner-button";
      cancel.dataset.variant = "secondary";
      cancel.type = "button";
      cancel.textContent = labels.cancel;
      cancel.hidden = true;
      actions.append(run, reset, cancel);
      const status = document.createElement("p");
      status.className = "learner-status learner-example__status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      exampleRecord = {
        cancel,
        fields,
        id,
        modified,
        reset,
        run,
        status,
      };
      run.addEventListener("click", () => {
        void runRecord(exampleRecord);
      });
      reset.addEventListener("click", () => {
        resetRecord(exampleRecord);
      });
      cancel.addEventListener("click", () => {
        if (activeRun?.record !== exampleRecord) return;
        activeRun.restoreFocus = true;
        activeRun.controller.abort();
      });
      fieldset.append(reference, actions, status);
      list.append(fieldset);
      records.push(exampleRecord);
    }
    updateDisabled();
    return Object.freeze({
      element: list,
      destroy() {
        destroyed = true;
        const wasBusy = Boolean(activeRun);
        activeRun?.controller.abort();
        activeRun = null;
        if (wasBusy) notifyBusy(false);
      },
      reset() {
        records.forEach((record) => resetRecord(record, false));
      },
      revision() {
        return revision;
      },
      setDisabled(nextDisabled) {
        disabled = Boolean(nextDisabled);
        updateDisabled();
      },
    });
  };
  const normalizedTabSize = (value) => (
    Number.isInteger(value) && value >= 1 && value <= 8 ? value : 2
  );
  const normalizedEditorLanguage = (value) => (
    ["python", "javascript", "typescript", "jsx", "tsx"].includes(value)
      ? value
      : "text"
  );
  const editorInstruction = (tabSize, language, hasRunHandler) => (
    (language === "python"
      ? "Python code editor. "
      : "Code editor. ")
    + "Tab indents " + tabSize
    + " spaces; Shift+Tab outdents. Press Escape, then Tab, to leave the editor."
    + (hasRunHandler
      ? " Press Command or Control plus Enter to check; add Shift to run examples."
      : "")
  );
  const editorShortcuts = ({ onRun, onSave }) => [
    "Tab",
    "Shift+Tab",
    "Escape",
    ...(onSave ? ["Control+S", "Meta+S"] : []),
    ...(onRun
      ? [
          "Control+Enter",
          "Meta+Enter",
          "Control+Shift+Enter",
          "Meta+Shift+Enter",
        ]
      : []),
  ].join(" ");
  const editCodeSelection = (editor, tabSize, outdent) => {
    const value = editor.value;
    const selectionStart = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    const selectionDirection = editor.selectionDirection;
    const firstLineStart = selectionStart === 0
      ? 0
      : value.lastIndexOf("\\n", selectionStart - 1) + 1;
    const effectiveEnd = (
      selectionEnd > selectionStart && value[selectionEnd - 1] === "\\n"
        ? selectionEnd - 1
        : selectionEnd
    );
    const lineStarts = [firstLineStart];
    let scanFrom = firstLineStart;
    while (scanFrom < effectiveEnd) {
      const newline = value.indexOf("\\n", scanFrom);
      if (newline === -1 || newline >= effectiveEnd) break;
      lineStarts.push(newline + 1);
      scanFrom = newline + 1;
    }
    const indentation = " ".repeat(tabSize);
    const edits = lineStarts.flatMap((lineStart) => {
      if (!outdent) {
        return [{ from: lineStart, to: lineStart, insert: indentation }];
      }
      let indentEnd = lineStart;
      let visualIndent = 0;
      while (indentEnd < value.length) {
        if (value[indentEnd] === " ") {
          visualIndent += 1;
        } else if (value[indentEnd] === "\\t") {
          visualIndent += tabSize - (visualIndent % tabSize);
        } else {
          break;
        }
        indentEnd += 1;
      }
      return visualIndent
        ? [{
            from: lineStart,
            to: indentEnd,
            insert: " ".repeat(Math.max(0, visualIndent - tabSize)),
          }]
        : [];
    });
    if (!edits.length) return false;
    const mapPosition = (position) => {
      let mapped = position;
      for (const edit of edits) {
        const removedLength = edit.to - edit.from;
        const insertedLength = edit.insert.length;
        if (removedLength === 0) {
          if (position >= edit.from) mapped += insertedLength;
        } else if (position > edit.to) {
          mapped += insertedLength - removedLength;
        } else if (position > edit.from) {
          mapped += insertedLength - (position - edit.from);
        }
      }
      return mapped;
    };
    const nextSelectionStart = mapPosition(selectionStart);
    const nextSelectionEnd = mapPosition(selectionEnd);
    const scrollTop = editor.scrollTop;
    const scrollLeft = editor.scrollLeft;
    [...edits].reverse().forEach((edit) => {
      editor.setRangeText(edit.insert, edit.from, edit.to, "preserve");
    });
    editor.setSelectionRange(
      nextSelectionStart,
      nextSelectionEnd,
      selectionDirection,
    );
    editor.scrollTop = scrollTop;
    editor.scrollLeft = scrollLeft;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
  const prepareCodeEditor = (
    editor,
    {
      language: requestedLanguage = "text",
      onRun,
      onSave,
      tabSize: requestedTabSize = 2,
    } = {},
  ) => {
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error("The shared code editor adapter requires a textarea.");
    }
    const tabSize = normalizedTabSize(requestedTabSize);
    const language = normalizedEditorLanguage(requestedLanguage);
    const configuration = {
      language,
      onRun: typeof onRun === "function" ? onRun : null,
      onSave: typeof onSave === "function" ? onSave : null,
      tabSize,
    };
    editor.dataset.learnerTabSize = String(tabSize);
    editor.dataset.learnerEditorLanguage = language;
    editor.style.tabSize = String(tabSize);
    const prepared = preparedCodeEditors.get(editor);
    if (prepared) {
      prepared.configuration = configuration;
      editor.setAttribute("aria-keyshortcuts", editorShortcuts(configuration));
      prepared.instruction.textContent = editorInstruction(
        tabSize,
        language,
        Boolean(configuration.onRun),
      );
      const enhanceTextarea =
        globalThis.LatentLearnerCodeEditorRuntime?.enhanceTextarea;
      if (typeof enhanceTextarea === "function") {
        prepared.controller = enhanceTextarea(editor, {
          ...configuration,
          ariaDescribedBy: editor.getAttribute("aria-describedby") || undefined,
          ariaLabel: editor.getAttribute("aria-label") || "Solution editor",
          variant: "integrated",
        });
        return prepared.controller;
      }
      return prepared.controller || editor;
    }
    if (!editor.parentNode) {
      throw new Error("The shared code editor adapter requires a mounted editor frame.");
    }
    const instruction = document.createElement("span");
    instruction.className = "learner-sr-only";
    instruction.id = "learner-editor-instructions-" + (++editorInstructionSequence);
    instruction.textContent = editorInstruction(
      tabSize,
      language,
      Boolean(configuration.onRun),
    );
    editor.after(instruction);
    const describedBy = editor.getAttribute("aria-describedby");
    editor.setAttribute(
      "aria-describedby",
      describedBy ? describedBy + " " + instruction.id : instruction.id,
    );
    editor.setAttribute("aria-keyshortcuts", editorShortcuts(configuration));
    const record = { configuration, controller: null, instruction };
    preparedCodeEditors.set(editor, record);
    const enhanceTextarea =
      globalThis.LatentLearnerCodeEditorRuntime?.enhanceTextarea;
    if (typeof enhanceTextarea === "function") {
      record.controller = enhanceTextarea(editor, {
        ...configuration,
        ariaDescribedBy: editor.getAttribute("aria-describedby") || undefined,
        ariaLabel: editor.getAttribute("aria-label") || "Solution editor",
        variant: "integrated",
      });
      return record.controller;
    }
    let tabFocusUntil = 0;
    editor.addEventListener("keydown", (event) => {
      const current = record.configuration;
      if (
        (event.ctrlKey || event.metaKey)
        && !event.altKey
        && !event.isComposing
        && event.key.toLowerCase() === "s"
        && current.onSave
      ) {
        event.preventDefault();
        current.onSave();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey)
        && !event.altKey
        && !event.isComposing
        && event.key === "Enter"
        && current.onRun
      ) {
        event.preventDefault();
        current.onRun(event.shiftKey ? "examples" : "check");
        return;
      }
      if (
        event.key === "Escape"
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.isComposing
      ) {
        tabFocusUntil = Date.now() + 2000;
        return;
      }
      if (event.key === "Tab") {
        if (
          event.altKey
          || event.ctrlKey
          || event.metaKey
          || event.isComposing
          || editor.disabled
          || editor.readOnly
        ) return;
        if (Date.now() <= tabFocusUntil) {
          tabFocusUntil = 0;
          return;
        }
        event.preventDefault();
        editCodeSelection(
          editor,
          current.tabSize,
          event.shiftKey,
        );
        return;
      }
      if (!["Alt", "Control", "Meta", "Shift"].includes(event.key)) {
        tabFocusUntil = 0;
      }
    });
    return editor;
  };
  if (globalThis.LearnerUiComponents === undefined) {
    Object.defineProperty(globalThis, "LearnerUiComponents", {
      configurable: false,
      enumerable: false,
      value: Object.freeze({
        createEditableExamples,
        createSolutionDisclosure,
        prepareCodeEditor,
      }),
      writable: false,
    });
  }
  const compact = globalThis.matchMedia("(max-width: ${LEARNER_UI_BREAKPOINTS.compact}px), (max-height: 500px)");
  const stacked = globalThis.matchMedia("(max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px)");
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const traceInterval = 1.45;
  const traceFadeWidth = 0.92;
  const disclosureSelector = ".learner-nav-menu, .learner-mobile-panel";
  const prepared = new WeakSet();
  const preparedSkipLinks = new WeakSet();
  let atmosphereFrame = null;
  const traceOpacity = (phase, index, count) => {
    const directDistance = Math.abs(phase - index);
    const wrappedDistance = Math.min(directDistance, count - directDistance);
    if (wrappedDistance >= traceFadeWidth) return 0;
    return (Math.cos((wrappedDistance / traceFadeWidth) * Math.PI) + 1) / 2;
  };
  const updateAtmospheres = () => {
    atmosphereFrame = null;
    const viewportHeight = Math.max(globalThis.innerHeight, 1);
    const scrollY = Math.max(globalThis.scrollY, 0);
    const fadeDistance = viewportHeight * 0.7;
    const traceStart = viewportHeight * 0.55;
    const traceScroll = Math.max(scrollY - traceStart, 0);
    const traceIntroduction = Math.min(1, traceScroll / (viewportHeight * 0.45));
    document.querySelectorAll("[data-learner-atmosphere]").forEach((atmosphere) => {
      const intro = atmosphere.querySelector("[data-learner-atmosphere-intro]");
      const traces = Array.from(atmosphere.querySelectorAll("[data-learner-atmosphere-trace]"));
      if (!intro || traces.length === 0) return;
      const introOpacity = reducedMotion.matches
        ? 0
        : Math.max(0, 1 - (scrollY / fadeDistance));
      const tracePhase = (traceScroll / (viewportHeight * traceInterval)) % traces.length;
      intro.style.opacity = String(introOpacity);
      traces.forEach((trace, index) => {
        const opacity = reducedMotion.matches
          ? 0
          : traceOpacity(tracePhase, index, traces.length) * traceIntroduction;
        trace.style.opacity = String(opacity);
      });
    });
  };
  const scheduleAtmospheres = () => {
    if (atmosphereFrame === null) {
      atmosphereFrame = globalThis.requestAnimationFrame(updateAtmospheres);
    }
  };
  const synchronize = (disclosure) => {
    if (disclosure.dataset.learnerCollapseAt === "always") return;
    const breakpoint = disclosure.dataset.learnerCollapseAt === "stacked"
      ? stacked
      : compact;
    const viewport = breakpoint.matches ? "compact" : "wide";
    if (disclosure.dataset.learnerViewport === viewport) return;
    disclosure.dataset.learnerViewport = viewport;
    if (breakpoint.matches) disclosure.removeAttribute("open");
    else disclosure.setAttribute("open", "");
  };
  const prepare = (disclosure) => {
    if (prepared.has(disclosure)) return;
    prepared.add(disclosure);
    const summary = disclosure.querySelector(":scope > summary");
    if (disclosure.matches(".learner-nav-menu")) {
      disclosure.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => disclosure.removeAttribute("open"));
      });
    }
    disclosure.addEventListener("keydown", (event) => {
      const isNavigationMenu = disclosure.matches(".learner-nav-menu");
      const isAlwaysCollapsible = disclosure.dataset.learnerCollapseAt === "always";
      const breakpoint = disclosure.dataset.learnerCollapseAt === "stacked"
        ? stacked
        : compact;
      if (
        event.key !== "Escape"
        || !disclosure.open
        || (!isNavigationMenu && !isAlwaysCollapsible && !breakpoint.matches)
      ) return;
      disclosure.removeAttribute("open");
      summary?.focus();
    });
    if (disclosure.matches(".learner-mobile-panel")) synchronize(disclosure);
  };
  const prepareWithin = (root) => {
    if (root instanceof Element && root.matches(disclosureSelector)) prepare(root);
    root.querySelectorAll?.(disclosureSelector).forEach(prepare);
    const prepareSkipLink = (link) => {
      if (preparedSkipLinks.has(link)) return;
      preparedSkipLinks.add(link);
      link.addEventListener("click", () => {
        const target = document.getElementById(link.hash.slice(1));
        target?.focus();
      });
    };
    if (root instanceof Element && root.matches(".learner-skip-link")) prepareSkipLink(root);
    root.querySelectorAll?.(".learner-skip-link").forEach(prepareSkipLink);
  };
  prepareWithin(document);
  scheduleAtmospheres();
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) prepareWithin(node);
      });
    }
    scheduleAtmospheres();
  }).observe(document.documentElement, { childList: true, subtree: true });
  globalThis.addEventListener("scroll", scheduleAtmospheres, { passive: true });
  globalThis.addEventListener("resize", scheduleAtmospheres);
  reducedMotion.addEventListener("change", scheduleAtmospheres);
  compact.addEventListener("change", () => {
    document.querySelectorAll(".learner-nav-menu").forEach((menu) => menu.removeAttribute("open"));
    document.querySelectorAll(".learner-mobile-panel:not([data-learner-collapse-at='stacked'])").forEach(synchronize);
  });
  stacked.addEventListener("change", () => {
    document.querySelectorAll('[data-learner-collapse-at="stacked"]').forEach(synchronize);
  });
  document.addEventListener("click", (event) => {
    for (const menu of document.querySelectorAll(".learner-nav-menu[open]")) {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    }
  });
})();
`;
export {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_FAVICON_SVG,
  LEARNER_UI_PALETTES,
  LEARNER_UI_PALETTE_NAMES,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerAtmosphere,
  renderLearnerContextNavigation,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme
};

export const LEARNER_CODE_EDITOR_CSP_SOURCE = "'nonce-latent-learner-code-editor-v1'";
export const LEARNER_CODE_EDITOR_VERSION = 1;
