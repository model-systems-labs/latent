import {
  canonicalLearningPackJson,
  createLearningFeed,
  type LearningBlock,
  type LearningPack,
  validateLearningPack,
} from "./learning-pack.js";
import {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
  type LearnerUiAppearance,
  type LearnerUiTheme,
} from "./learner-ui.js";

export const STANDALONE_PLAYER_VERSION = 1 as const;

export type StandaloneLearningSiteUi = Readonly<{
  productName?: string;
  navigationLabel?: string;
  modulesLabel?: string;
  reviewLabel?: string;
  menuLabel?: string;
  footerSummary?: string;
  attribution?: string;
  appearance?: LearnerUiAppearance;
  /** @deprecated Prefer appearance.theme for trusted color overrides. */
  theme?: LearnerUiTheme;
}>;

function resolveStandaloneLearnerUiTheme(
  ui: StandaloneLearningSiteUi = {},
): Required<LearnerUiTheme> {
  if (ui.appearance !== undefined && ui.theme !== undefined) {
    throw new Error(
      "Standalone Learning site ui.appearance and ui.theme cannot be configured together.",
    );
  }
  return resolveLearnerUiTheme(
    ui.appearance
      ?? (ui.theme === undefined ? {} : { theme: ui.theme }),
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBlock(block: LearningBlock, lessonId: string) {
  if (block.type === "paragraph") return `<p>${escapeHtml(block.text)}</p>`;
  if (block.type === "heading") {
    const Tag = block.level === 2 ? "h2" : "h3";
    return `<${Tag}>${escapeHtml(block.text)}</${Tag}>`;
  }
  if (block.type === "list") {
    const Tag = block.style === "ordered" ? "ol" : "ul";
    return `<${Tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${Tag}>`;
  }
  if (block.type === "callout") {
    return `<aside class="callout callout-${block.tone}"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.text)}</p></aside>`;
  }
  if (block.type === "code") {
    return `<figure class="code-block">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}<pre><code data-language="${escapeHtml(block.language)}">${escapeHtml(block.code)}</code></pre></figure>`;
  }
  const fieldName = `${lessonId}-${block.id}`;
  return [
    `<form class="learner-form quiz" data-answer="${escapeHtml(block.correctChoiceId)}">`,
    `<fieldset><legend>${escapeHtml(block.prompt)}</legend>`,
    block.choices.map((choice) => (
      `<label><input type="radio" name="${escapeHtml(fieldName)}" value="${escapeHtml(choice.id)}"> <span>${escapeHtml(choice.text)}</span></label>`
    )).join(""),
    `</fieldset>`,
    `<button class="learner-button" data-variant="primary" type="submit">Check answer</button>`,
    `<p class="learner-status quiz-result" role="status" aria-live="polite"></p>`,
    `<p class="quiz-explanation" hidden>${escapeHtml(block.explanation)}</p>`,
    `</form>`,
  ].join("");
}

function sourceLinks(pack: LearningPack, sourceIds: readonly string[]) {
  const sourceById = new Map(pack.sources.map((source) => [source.id, source]));
  return [...new Set(sourceIds)]
    .map((id) => sourceById.get(id))
    .filter((source) => source !== undefined)
    .map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noreferrer" target="_blank">${escapeHtml(source.title)}</a><span>${escapeHtml(source.note)}</span></li>`)
    .join("");
}

function renderIndex(
  pack: LearningPack,
  sha256: string,
  ui: StandaloneLearningSiteUi,
) {
  const lessons = [...pack.lessons].sort((left, right) => left.order - right.order);
  const decks = [...pack.flashcardDecks].sort((left, right) => left.order - right.order);
  const firstView = lessons[0] ? `lesson-${lessons[0].id}` : `deck-${decks[0]?.id ?? ""}`;
  const storageKey = `latent.learning.v1:${pack.package.id}@${pack.package.version}:${sha256}`;
  const navigation = [
    ...lessons.map((lesson) => ({
      id: `lesson-${lesson.id}`,
      eyebrow: `${lesson.durationMinutes} min lesson`,
      title: lesson.title,
    })),
    ...decks.map((deck) => ({
      id: `deck-${deck.id}`,
      eyebrow: `${deck.cards.length} flash cards`,
      title: deck.title,
    })),
  ];
  const primaryNavigation = [
    ...(lessons[0] ? [{
      label: ui.modulesLabel ?? "Modules",
      href: `#lesson-${lessons[0].id}`,
      current: true,
      dataView: `lesson-${lessons[0].id}`,
    }] : []),
    ...(decks[0] ? [{
      label: ui.reviewLabel ?? "Review",
      href: `#deck-${decks[0].id}`,
      current: lessons.length === 0,
      dataView: `deck-${decks[0].id}`,
    }] : []),
  ];
  const header = renderLearnerHeader({
    productName: ui.productName ?? pack.package.title,
    homeHref: "./",
    navigationLabel: ui.navigationLabel ?? "Learning navigation",
    navigation: primaryNavigation,
    menuLabel: ui.menuLabel,
    meta: `Version ${pack.package.version}`,
  });
  const footer = renderLearnerFooter({
    summary: ui.footerSummary ?? `${pack.package.license} · Progress stays on this device.`,
    attribution: ui.attribution ?? "Built with Latent.",
  });

  const lessonSections = lessons.map((lesson) => `
    <section class="learner-reading learning-view" id="lesson-${escapeHtml(lesson.id)}" data-view="lesson-${escapeHtml(lesson.id)}" ${`lesson-${lesson.id}` === firstView ? "" : "hidden"}>
      <header class="view-header">
        <span class="learner-eyebrow">${lesson.durationMinutes} minute lesson</span>
        <h1 tabindex="-1">${escapeHtml(lesson.title)}</h1>
        <p>${escapeHtml(lesson.summary)}</p>
      </header>
      <div class="lesson-body">
        ${lesson.blocks.map((block) => renderBlock(block, lesson.id)).join("")}
      </div>
      <section class="sources" aria-labelledby="${escapeHtml(lesson.id)}-sources">
        <h2 id="${escapeHtml(lesson.id)}-sources">Sources used here</h2>
        <ul>${sourceLinks(pack, [
          ...lesson.sourceIds,
          ...lesson.blocks.flatMap((block) => block.type === "quiz" ? block.sourceIds : []),
        ])}</ul>
      </section>
      <button class="learner-button complete-button" data-variant="primary" type="button" data-complete="${escapeHtml(lesson.id)}">Mark lesson complete</button>
    </section>
  `).join("");

  const deckSections = decks.map((deck) => `
    <section class="learner-reading learning-view" id="deck-${escapeHtml(deck.id)}" data-view="deck-${escapeHtml(deck.id)}" ${`deck-${deck.id}` === firstView ? "" : "hidden"}>
      <header class="view-header">
        <span class="learner-eyebrow">${deck.cards.length} flash cards</span>
        <h1 tabindex="-1">${escapeHtml(deck.title)}</h1>
        <p>${escapeHtml(deck.description)}</p>
      </header>
      <div class="deck-status" role="status" aria-live="polite"></div>
      <ol class="cards">
        ${deck.cards.map((card, index) => `
          <li class="learner-card card" data-card="${escapeHtml(card.id)}">
            <span class="card-count">Card ${index + 1} of ${deck.cards.length}</span>
            <button class="card-face" type="button" aria-expanded="false">
              <span class="card-prompt">${escapeHtml(card.front)}</span>
              <span class="card-answer" hidden><strong>${escapeHtml(card.back)}</strong><small>${escapeHtml(card.explanation)}</small></span>
              <em>Reveal answer</em>
            </button>
            <div class="card-actions" hidden>
              <button class="learner-button" type="button" data-rating="review">Needs review</button>
              <button class="learner-button" data-variant="primary" type="button" data-rating="know">Know it</button>
            </div>
          </li>
        `).join("")}
      </ol>
      <section class="sources" aria-labelledby="${escapeHtml(deck.id)}-sources">
        <h2 id="${escapeHtml(deck.id)}-sources">Sources used here</h2>
        <ul>${sourceLinks(pack, [
          ...deck.sourceIds,
          ...deck.cards.flatMap((card) => card.sourceIds),
        ])}</ul>
      </section>
    </section>
  `).join("");

  return `<!doctype html>
<html lang="${escapeHtml(pack.package.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(pack.package.description)}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'">
  <title>${escapeHtml(pack.package.title)}</title>
  <link rel="stylesheet" href="./assets/player.css">
</head>
<body class="learner-ui" data-storage-key="${escapeHtml(storageKey)}">
  <a class="learner-skip-link" href="#content">Skip to learning content</a>
  <div class="learner-page">
  ${header}
  <div class="learner-main learner-layout layout">
    <aside class="learner-sidebar sidebar">
      <p class="learner-eyebrow">Published by ${escapeHtml(pack.package.authors[0]?.name ?? "Independent publisher")}</p>
      <h2>${escapeHtml(pack.package.title)}</h2>
      <p>${escapeHtml(pack.package.description)}</p>
      <nav aria-label="Learning pack contents">
        ${navigation.map((entry) => `<button class="learner-nav-item" type="button" data-open-view="${escapeHtml(entry.id)}" aria-current="${entry.id === firstView ? "page" : "false"}"><small>${escapeHtml(entry.eyebrow)}</small><span>${escapeHtml(entry.title)}</span></button>`).join("")}
      </nav>
      <footer>
        <span>${escapeHtml(pack.package.license)}</span>
        <a href="./learning-pack.json">View source JSON</a>
      </footer>
    </aside>
    <main class="learner-content" id="content" tabindex="-1">${lessonSections}${deckSections}</main>
  </div>
  ${footer}
  </div>
  <script src="./assets/learner-ui.js" defer></script>
  <script src="./assets/player.js" defer></script>
</body>
</html>
`;
}

export const standalonePlayerJavaScript = `(() => {
  "use strict";
  const storageKey = document.body.dataset.storageKey;
  const blankState = { completedLessons: [], cards: {} };
  const readState = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!stored || !Array.isArray(stored.completedLessons) || !stored.cards || typeof stored.cards !== "object" || Array.isArray(stored.cards)) return structuredClone(blankState);
      return stored;
    } catch {
      return structuredClone(blankState);
    }
  };
  let state = readState();
  const viewFamily = (view) => (
    view.startsWith("lesson-")
      ? "lesson"
      : view.startsWith("deck-")
        ? "deck"
        : view
  );
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  };
  const updateCompleteButtons = () => {
    document.querySelectorAll("[data-complete]").forEach((button) => {
      const complete = state.completedLessons.includes(button.dataset.complete);
      button.textContent = complete ? "Lesson complete" : "Mark lesson complete";
      button.setAttribute("aria-pressed", String(complete));
    });
  };
  const updateDeckStatus = () => {
    document.querySelectorAll("[data-view^='deck-']").forEach((deck) => {
      const cards = Array.from(deck.querySelectorAll("[data-card]"));
      const known = cards.filter((card) => state.cards[card.dataset.card] === "know").length;
      const status = deck.querySelector(".deck-status");
      if (status) status.textContent = known + " of " + cards.length + " marked as known on this device.";
      deck.querySelectorAll("[data-rating]").forEach((button) => {
        const card = button.closest("[data-card]");
        button.setAttribute("aria-pressed", String(state.cards[card.dataset.card] === button.dataset.rating));
      });
    });
  };
  const openView = (view, moveFocus = true) => {
    document.querySelectorAll(".learning-view[data-view]").forEach((section) => { section.hidden = section.dataset.view !== view; });
    document.querySelectorAll("[data-open-view]").forEach((entry) => entry.setAttribute("aria-current", entry.dataset.openView === view ? "page" : "false"));
    document.querySelectorAll(".learner-primary-nav [data-view]").forEach((entry) => {
      entry.setAttribute("aria-current", viewFamily(entry.dataset.view) === viewFamily(view) ? "page" : "false");
    });
    const target = document.getElementById(view);
    if (target) {
      history.replaceState(null, "", "#" + view);
      if (moveFocus) target.querySelector("h1")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  document.querySelectorAll("[data-open-view]").forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.openView));
  });
  document.querySelectorAll(".learner-primary-nav [data-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openView(link.dataset.view);
    });
  });
  document.querySelectorAll(".quiz").forEach((quiz) => {
    quiz.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = quiz.querySelector("input:checked");
      const result = quiz.querySelector(".quiz-result");
      const explanation = quiz.querySelector(".quiz-explanation");
      if (!selected) {
        result.textContent = "Choose an answer first.";
        return;
      }
      const correct = selected.value === quiz.dataset.answer;
      result.textContent = correct ? "Correct." : "Not yet. Read the explanation and try again.";
      result.className = "learner-status quiz-result " + (correct ? "correct" : "incorrect");
      result.dataset.tone = correct ? "success" : "danger";
      explanation.hidden = false;
    });
    quiz.querySelectorAll("input[type='radio']").forEach((input) => {
      input.addEventListener("change", () => {
        const result = quiz.querySelector(".quiz-result");
        result.textContent = "";
        delete result.dataset.tone;
        quiz.querySelector(".quiz-explanation").hidden = true;
      });
    });
  });
  document.querySelectorAll(".card-face").forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      const answer = button.querySelector(".card-answer");
      const label = button.querySelector("em");
      const actions = button.parentElement.querySelector(".card-actions");
      button.setAttribute("aria-expanded", String(!expanded));
      answer.hidden = expanded;
      actions.hidden = expanded;
      label.textContent = expanded ? "Reveal answer" : "Hide answer";
    });
  });
  document.querySelectorAll("[data-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-card]");
      state.cards[card.dataset.card] = button.dataset.rating;
      save();
      updateDeckStatus();
    });
  });
  document.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.complete;
      state.completedLessons = state.completedLessons.includes(id)
        ? state.completedLessons.filter((entry) => entry !== id)
        : [...state.completedLessons, id];
      save();
      updateCompleteButtons();
    });
  });
  const initial = location.hash.slice(1);
  if (initial && document.querySelector('[data-open-view="' + CSS.escape(initial) + '"]')) {
    openView(initial, false);
  }
  updateCompleteButtons();
  updateDeckStatus();
})();\n`;

const standaloneLearningLayoutCss = `.sidebar h2 {
  font-family: var(--learner-font-reading);
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1.05;
  margin: var(--learner-space-3) 0 var(--learner-space-4);
}
.sidebar > p:not(.learner-eyebrow),
.view-header p { color: var(--learner-color-muted); line-height: 1.65; }
.sidebar nav { border-top: var(--learner-border); margin-top: var(--learner-space-6); }
.sidebar nav button { border-bottom-color: var(--learner-color-border); border-radius: 0; display: grid; gap: var(--learner-space-1); padding: var(--learner-space-4) 0; }
.sidebar nav button[aria-current="page"] span::after { color: var(--learner-color-accent-strong); content: " →"; }
.sidebar nav small { font-size: .68rem; text-transform: uppercase; }
.sidebar footer { color: var(--learner-color-muted); display: flex; flex-wrap: wrap; font-size: .7rem; gap: var(--learner-space-3); justify-content: space-between; margin-top: var(--learner-space-6); }
.view-header { border-bottom: var(--learner-border); padding-bottom: var(--learner-space-6); }
.view-header h1 { font-size: clamp(2.6rem, 6vw, 4.8rem); font-weight: 500; letter-spacing: -.06em; line-height: .98; margin: var(--learner-space-3) 0 var(--learner-space-5); }
.view-header p { font-family: var(--learner-font-reading); font-size: 1.2rem; margin: 0; }
.lesson-body { padding: var(--learner-space-6) 0; }
.lesson-body > p,
.lesson-body li { font-family: var(--learner-font-reading); font-size: 1.08rem; line-height: 1.75; }
.lesson-body h2,
.lesson-body h3,
.sources h2 { font-family: var(--learner-font-reading); font-weight: 500; letter-spacing: -.03em; margin-top: var(--learner-space-7); }
.callout { background: var(--learner-color-accent-soft); border-left: 3px solid var(--learner-color-accent); margin: var(--learner-space-6) 0; padding: var(--learner-space-5); }
.callout p { line-height: 1.6; margin-bottom: 0; }
.code-block { margin: var(--learner-space-6) 0; }
.code-block figcaption { color: var(--learner-color-muted); font-size: .75rem; margin-bottom: var(--learner-space-2); }
pre { background: #211f22; border-radius: var(--learner-radius-sm); color: #f8f3ed; overflow-x: auto; padding: var(--learner-space-5); }
code { font-family: var(--learner-font-mono); font-size: .86rem; line-height: 1.6; }
.quiz { border-bottom: var(--learner-border); border-top: var(--learner-border); margin: var(--learner-space-7) 0; padding: var(--learner-space-5) 0; }
.quiz fieldset { display: grid; gap: var(--learner-space-3); }
.quiz legend { font-family: var(--learner-font-reading); font-size: 1.25rem; margin-bottom: var(--learner-space-4); }
.quiz button,
.complete-button,
.card-actions button { margin-top: var(--learner-space-4); }
.quiz-result { font-weight: 650; }
.quiz-result.correct { color: var(--learner-color-success); }
.quiz-explanation { color: var(--learner-color-muted); line-height: 1.6; }
.sources { border-top: var(--learner-border); margin-top: var(--learner-space-7); padding-top: var(--learner-space-4); }
.sources h2 { font-size: 1.35rem; margin-top: 0; }
.sources ul { list-style: none; padding: 0; }
.sources li { display: grid; gap: var(--learner-space-1); padding: var(--learner-space-3) 0; }
.sources li span { color: var(--learner-color-muted); font-size: .75rem; line-height: 1.5; }
.cards { display: grid; gap: var(--learner-space-4); list-style: none; padding: var(--learner-space-5) 0; }
.card-count,
.deck-status { color: var(--learner-color-muted); font-size: .72rem; }
.deck-status { margin-top: var(--learner-space-5); }
.card-face { background: var(--learner-color-surface); border: 0; border-radius: var(--learner-radius-sm); color: var(--learner-color-ink); cursor: pointer; display: grid; gap: var(--learner-space-4); margin-top: var(--learner-space-3); min-height: 12rem; padding: var(--learner-space-5); text-align: left; width: 100%; }
.card-prompt,
.card-answer strong { font-family: var(--learner-font-reading); font-size: 1.35rem; font-weight: 500; line-height: 1.35; }
.card-answer { display: grid; gap: var(--learner-space-3); }
.card-answer small { color: var(--learner-color-muted); line-height: 1.5; }
.card-face em { align-self: end; color: var(--learner-color-accent-strong); font-size: .72rem; font-style: normal; }
.card-actions { display: flex; gap: var(--learner-space-2); }
@media (max-width: ${LEARNER_UI_BREAKPOINTS.stacked}px) {
  .sidebar { padding-bottom: var(--learner-space-5); }
  .sidebar nav { display: flex; gap: var(--learner-space-2); overflow-x: auto; }
  .sidebar nav button { border: var(--learner-border); border-radius: var(--learner-radius-sm); flex: 0 0 12rem; padding: var(--learner-space-3); }
}\n`;

export const standalonePlayerCss = `${createLearnerUiCss()}\n${standaloneLearningLayoutCss}`;

export type StandaloneSiteFiles = Record<string, string>;

async function sha256Hex(bytes: Uint8Array) {
  const cryptoApi = (globalThis as unknown as {
    crypto?: {
      subtle?: {
        digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
      };
    };
  }).crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("This runtime does not provide Web Crypto SHA-256 support.");
  }
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildStandaloneLearningSite(
  input: LearningPack,
  options: {
    packageUrl?: string;
    siteUrl?: string;
    ui?: StandaloneLearningSiteUi;
  } = {},
): Promise<StandaloneSiteFiles> {
  const validation = validateLearningPack(input);
  if (!validation.valid) {
    throw new Error(`Cannot build an invalid learning pack: ${validation.errors[0]?.message ?? "unknown error"}`);
  }
  const pack = validation.pack;
  const ui = options.ui ?? {};
  const learnerUiTheme = resolveStandaloneLearnerUiTheme(ui);
  const packageJson = canonicalLearningPackJson(pack);
  const packageBytes = new TextEncoder().encode(packageJson);
  const sha256 = await sha256Hex(packageBytes);
  const feed = createLearningFeed(pack, sha256, {
    bytes: packageBytes.byteLength,
    packageUrl: options.packageUrl,
    siteUrl: options.siteUrl,
  });
  const files: StandaloneSiteFiles = {
    ".latent-build": `${LEARNING_BUILD_MARKER}\n`,
    "index.html": renderIndex(pack, sha256, ui).replace(/[ \t]+$/gm, ""),
    "learning-pack.json": packageJson,
    "learning-feed.json": `${JSON.stringify(feed, null, 2)}\n`,
    "assets/player.js": standalonePlayerJavaScript,
    "assets/player.css": `${createLearnerUiCss(learnerUiTheme)}\n${standaloneLearningLayoutCss}`,
    "assets/learner-ui.js": learnerUiJavaScript,
    "_headers": `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'\n\n/learning-feed.json\n  Access-Control-Allow-Origin: *\n  Cache-Control: no-cache\n\n/learning-pack.json\n  Access-Control-Allow-Origin: *\n  Cache-Control: no-cache\n`,
    "README.txt": `This is a Latent Open Learning static site.\n\nPublish this entire directory on any static web host. Share learning-feed.json with learners who want to verify or install the pack. Progress stays in each learner's browser and is namespaced to ${pack.package.id}@${pack.package.version}.\n`,
  };
  files["build-report.json"] = `${JSON.stringify({
    format: "latent-learning-build-report",
    schemaVersion: 1,
    playerVersion: STANDALONE_PLAYER_VERSION,
    learnerUiVersion: LEARNER_UI_VERSION,
    packageId: pack.package.id,
    version: pack.package.version,
    sha256,
    packageBytes: packageBytes.byteLength,
    files: [...Object.keys(files), "build-report.json"].sort(),
  }, null, 2)}\n`;
  return files;
}

export const LEARNING_BUILD_MARKER = "latent-open-learning-static-build-v1";
