// Generated from @latent/course-kit 0.2.0; do not edit.
// packages/course-kit/dist/learner-ui.js
var LEARNER_UI_VERSION = 1;
var LEARNER_UI_BREAKPOINTS = Object.freeze({
  compact: 760,
  stacked: 980,
  wide: 1280
});
var DEFAULT_THEME = Object.freeze({
  canvas: "#f4f7f5",
  surface: "#ffffff",
  surfaceMuted: "#edf2ef",
  ink: "#17211d",
  muted: "#5d6a64",
  border: "#ced8d2",
  accent: "#176b5a",
  accentStrong: "#0f5144",
  accentSoft: "#dff2ec",
  accentContrast: "#ffffff",
  success: "#1d704e",
  successSoft: "#def3e8",
  danger: "#a33d3d",
  dangerSoft: "#fae7e5",
  warning: "#8b5a15",
  focus: "#2259c7"
});
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function boundedText(value, label, maximum = 200) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be a non-empty text value no longer than ${maximum} characters.`);
  }
  return value.trim();
}
function safeRelativeHref(value, label) {
  const href = boundedText(value, label, 500);
  if (/^#[A-Za-z][A-Za-z0-9._-]*$/.test(href))
    return href;
  if (href.startsWith("/") || href.startsWith("//") || href.includes("\\") || href.includes(":") || href.includes("?") || href.includes("#") || href.includes("\0")) {
    throw new Error(`${label} must be a same-origin relative path or fragment.`);
  }
  const segments = href.split("/");
  let contentStarted = false;
  for (const [index, segment] of segments.entries()) {
    if (segment === "" && segments.length === 1) {
      throw new Error(`${label} must not be empty.`);
    }
    if (segment === "" && index !== segments.length - 1) {
      throw new Error(`${label} must not contain an empty path segment.`);
    }
    if (segment === ".") {
      if (contentStarted)
        throw new Error(`${label} may use "." only as a leading segment.`);
      continue;
    }
    if (segment === "..") {
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
function createLearnerUiCss(theme = {}) {
  const unknownKeys = Object.keys(theme).filter((key) => !(key in DEFAULT_THEME));
  if (unknownKeys.length) {
    throw new Error(`Unknown learner UI theme token: ${unknownKeys[0]}`);
  }
  const colors = Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key, fallback]) => [
    key,
    themeValue(theme[key] ?? fallback, `theme.${key}`)
  ]));
  return `:root {
  color-scheme: light;
  --learner-font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --learner-font-reading: Georgia, "Times New Roman", serif;
  --learner-font-mono: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
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
  --learner-space-1: .25rem;
  --learner-space-2: .5rem;
  --learner-space-3: .75rem;
  --learner-space-4: 1rem;
  --learner-space-5: 1.5rem;
  --learner-space-6: 2rem;
  --learner-space-7: 3rem;
  --learner-radius-sm: .4rem;
  --learner-radius-md: .7rem;
  --learner-radius-lg: 1rem;
  --learner-border: 1px solid var(--learner-color-border);
  --learner-shadow-sm: 0 1px 2px rgba(23, 33, 29, .06);
  --learner-shadow-md: 0 10px 30px rgba(23, 33, 29, .08);
  --learner-width-reading: 46rem;
  --learner-width-content: 76rem;
  --learner-width-wide: 90rem;
  --learner-header-height: 4.5rem;
  font-family: var(--learner-font-sans);
  font-synthesis: none;
}
* { box-sizing: border-box; }
html {
  background: var(--learner-color-canvas);
  color: var(--learner-color-ink);
  scroll-behavior: smooth;
}
body.learner-ui {
  background: var(--learner-color-canvas);
  color: var(--learner-color-ink);
  font-family: var(--learner-font-sans);
  line-height: 1.5;
  margin: 0;
  min-height: 100vh;
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
}
.learner-header {
  background: color-mix(in srgb, var(--learner-color-surface) 94%, transparent);
  border-bottom: var(--learner-border);
  position: relative;
  z-index: 20;
}
.learner-header__inner {
  align-items: center;
  display: flex;
  gap: var(--learner-space-5);
  justify-content: space-between;
  margin: 0 auto;
  max-width: var(--learner-width-wide);
  min-height: var(--learner-header-height);
  padding: 0 clamp(1rem, 4vw, 3rem);
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
  border-radius: .25rem;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--learner-color-accent-strong) 30%, transparent);
  display: inline-block;
  height: 1rem;
  transform: rotate(-7deg);
  width: 1rem;
}
.learner-header__meta {
  color: var(--learner-color-muted);
  font-size: .75rem;
  margin-left: auto;
}
.learner-nav-menu { position: relative; }
.learner-nav-menu > summary {
  align-items: center;
  background: var(--learner-color-surface);
  border: var(--learner-border);
  border-radius: var(--learner-radius-sm);
  cursor: pointer;
  display: none;
  font-size: .82rem;
  font-weight: 700;
  min-height: 2.75rem;
  padding: .5rem .8rem;
}
.learner-nav-menu > summary::marker { content: ""; }
.learner-nav-menu > summary::after {
  content: "⌄";
  font-size: 1rem;
  margin-left: .6rem;
}
.learner-nav-menu[open] > summary::after { content: "⌃"; }
.learner-nav-menu__panel,
.learner-global-nav,
.learner-primary-nav {
  align-items: center;
  display: flex;
  gap: var(--learner-space-2);
}
.learner-global-nav {
  border-right: var(--learner-border);
  padding-right: var(--learner-space-3);
}
.learner-global-nav a,
.learner-primary-nav a {
  align-items: center;
  border-radius: var(--learner-radius-sm);
  color: var(--learner-color-muted);
  display: inline-flex;
  font-size: .82rem;
  font-weight: 680;
  min-height: 2.75rem;
  padding: .58rem .8rem;
  text-decoration: none;
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
.learner-main {
  flex: 1 0 auto;
  margin: 0 auto;
  max-width: var(--learner-width-wide);
  width: 100%;
}
.learner-layout {
  display: grid;
  grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
  min-height: calc(100vh - var(--learner-header-height));
}
.learner-sidebar {
  background: var(--learner-color-surface-muted);
  border-right: var(--learner-border);
  min-width: 0;
  padding: clamp(1.25rem, 3vw, 2.25rem);
}
.learner-sidebar__header { margin-bottom: var(--learner-space-5); }
.learner-content {
  background: var(--learner-color-surface);
  min-width: 0;
  padding: clamp(1.5rem, 5vw, 4rem);
}
.learner-reading {
  margin: 0 auto;
  max-width: var(--learner-width-reading);
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
  background: var(--learner-color-surface);
  border: var(--learner-border);
  border-radius: var(--learner-radius-md);
  box-shadow: var(--learner-shadow-sm);
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
  font-weight: 720;
  justify-content: center;
  min-height: 2.75rem;
  padding: .65rem 1rem;
}
.learner-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--learner-color-ink) 45%, var(--learner-color-border));
  box-shadow: var(--learner-shadow-sm);
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
  background: var(--learner-color-surface-muted);
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
  background: #17211d;
  border: 0;
  color: #f4f7f5;
  display: block;
  font: .875rem/1.6 var(--learner-font-mono);
  min-height: 18rem;
  outline: none;
  padding: var(--learner-space-4);
  resize: vertical;
  tab-size: 2;
  width: 100%;
}
.learner-editor:focus-visible {
  box-shadow: inset 0 0 0 3px var(--learner-color-surface);
  outline: 0;
}
.learner-editor-frame:has(.learner-editor:focus-visible) {
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
@media (max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px) {
  .learner-layout { grid-template-columns: 1fr; }
  .learner-sidebar {
    border-bottom: var(--learner-border);
    border-right: 0;
  }
  .learner-mobile-panel[data-learner-collapse-at="stacked"] > summary { display: flex; }
  .learner-mobile-panel[data-learner-collapse-at="stacked"]:not([open]) > .learner-mobile-panel__content { display: none; }
}
@media (max-width: ${LEARNER_UI_BREAKPOINTS.compact}px) {
  :root { --learner-header-height: 4rem; }
  html { scroll-behavior: auto; }
  .learner-header__inner {
    gap: var(--learner-space-3);
    min-height: var(--learner-header-height);
    padding: 0 var(--learner-space-4);
  }
  .learner-header__meta { display: none; }
  .learner-nav-menu > summary { display: flex; }
  .learner-nav-menu__panel {
    background: var(--learner-color-surface);
    border: var(--learner-border);
    border-radius: var(--learner-radius-md);
    box-shadow: var(--learner-shadow-md);
    display: grid;
    gap: var(--learner-space-1);
    min-width: min(18rem, calc(100vw - 2rem));
    padding: var(--learner-space-2);
    position: absolute;
    right: 0;
    top: calc(100% + var(--learner-space-2));
  }
  .learner-nav-menu:not([open]) > .learner-nav-menu__panel { display: none; }
  .learner-global-nav,
  .learner-primary-nav {
    align-items: stretch;
    display: grid;
    gap: var(--learner-space-1);
  }
  .learner-global-nav {
    border-bottom: var(--learner-border);
    border-right: 0;
    padding: 0 0 var(--learner-space-2);
  }
  .learner-nav-menu__panel nav + nav { padding-top: var(--learner-space-1); }
  .learner-global-nav a,
  .learner-primary-nav a { display: flex; }
  .learner-mobile-panel > summary { display: flex; }
  .learner-mobile-panel:not([open]) > .learner-mobile-panel__content { display: none; }
  .learner-content { padding: var(--learner-space-5) var(--learner-space-4); }
  .learner-button { min-height: 2.9rem; }
  .learner-editor { font-size: 1rem; }
  .learner-footer__inner { flex-direction: column; }
}
@media (min-width: ${LEARNER_UI_BREAKPOINTS.compact + 1}px) {
  .learner-nav-menu > .learner-nav-menu__panel { display: flex !important; }
  .learner-mobile-panel > .learner-mobile-panel__content { display: block !important; }
}
@media (min-width: ${LEARNER_UI_BREAKPOINTS.compact + 1}px) and (max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px) {
  .learner-mobile-panel[data-learner-collapse-at="stacked"]:not([open]) > .learner-mobile-panel__content { display: none !important; }
}
@media (min-width: ${LEARNER_UI_BREAKPOINTS.stacked + 1}px) {
  .learner-mobile-panel[data-learner-collapse-at="stacked"] > .learner-mobile-panel__content { display: block !important; }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
@media (forced-colors: active) {
  .learner-status-dot[data-status] { forced-color-adjust: none; }
}
`;
}
function renderLearnerHeader(options) {
  const productName = boundedText(options.productName, "Product name", 160);
  const homeHref = safeRelativeHref(options.homeHref, "Header home path");
  const homeLabel = boundedText(options.homeLabel ?? `${productName} home`, "Header home label", 200);
  const navigationLabel = boundedText(options.navigationLabel, "Navigation label", 160);
  const menuLabel = boundedText(options.menuLabel ?? "Menu", "Menu label", 80);
  if (!Array.isArray(options.navigation) || options.navigation.length === 0) {
    throw new Error("Learner header navigation must include at least one item.");
  }
  const renderNavigation = (items, itemLabel) => items.map((item, index) => {
    const label = boundedText(item.label, `${itemLabel} item ${index + 1} label`, 120);
    const href = safeRelativeHref(item.href, `Navigation item ${index + 1} path`);
    const dataView = item.dataView === void 0 ? "" : ` data-view="${escapeHtml(navigationToken(item.dataView))}"`;
    const current = item.current ? ' aria-current="page"' : "";
    return `<a href="${escapeHtml(href)}"${current}${dataView}>${escapeHtml(label)}</a>`;
  }).join("");
  const navigation = renderNavigation(options.navigation, "Navigation");
  const globalNavigation = options.globalNavigation === void 0 ? "" : (() => {
    if (!Array.isArray(options.globalNavigation) || options.globalNavigation.length === 0) {
      throw new Error("Global learner navigation must include at least one item when configured.");
    }
    const label = boundedText(options.globalNavigationLabel ?? "Learning experiences", "Global navigation label", 160);
    return `<nav class="learner-global-nav" aria-label="${escapeHtml(label)}">${renderNavigation(options.globalNavigation, "Global navigation")}</nav>`;
  })();
  const meta = options.meta === void 0 ? "" : `<span class="learner-header__meta">${escapeHtml(boundedText(options.meta, "Header metadata", 160))}</span>`;
  return `<header class="learner-header">
  <div class="learner-header__inner">
    <a class="learner-wordmark" href="${escapeHtml(homeHref)}" aria-label="${escapeHtml(homeLabel)}"><i class="learner-wordmark__mark" aria-hidden="true"></i><span>${escapeHtml(productName)}</span></a>
    ${meta}
    <details class="learner-nav-menu">
      <summary>${escapeHtml(menuLabel)}</summary>
      <div class="learner-nav-menu__panel">
        ${globalNavigation}
        <nav class="learner-primary-nav" aria-label="${escapeHtml(navigationLabel)}">${navigation}</nav>
      </div>
    </details>
  </div>
</header>`;
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
  const compact = globalThis.matchMedia("(max-width: ${LEARNER_UI_BREAKPOINTS.compact}px)");
  const stacked = globalThis.matchMedia("(max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px)");
  const disclosureSelector = ".learner-nav-menu, .learner-mobile-panel";
  const prepared = new WeakSet();
  const preparedSkipLinks = new WeakSet();
  const synchronize = (disclosure) => {
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
        link.addEventListener("click", () => {
          if (compact.matches) disclosure.removeAttribute("open");
        });
      });
    }
    disclosure.addEventListener("keydown", (event) => {
      const breakpoint = disclosure.dataset.learnerCollapseAt === "stacked"
        ? stacked
        : compact;
      if (event.key !== "Escape" || !disclosure.open || !breakpoint.matches) return;
      disclosure.removeAttribute("open");
      summary?.focus();
    });
    synchronize(disclosure);
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
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) prepareWithin(node);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  compact.addEventListener("change", () => {
    document.querySelectorAll(disclosureSelector).forEach(synchronize);
  });
  stacked.addEventListener("change", () => {
    document.querySelectorAll('[data-learner-collapse-at="stacked"]').forEach(synchronize);
  });
  document.addEventListener("click", (event) => {
    if (!compact.matches) return;
    for (const menu of document.querySelectorAll(".learner-nav-menu[open]")) {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    }
  });
})();
`;
export {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader
};
