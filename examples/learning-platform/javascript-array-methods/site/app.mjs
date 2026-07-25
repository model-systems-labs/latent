import {
  isLeechProgress,
  nextPracticeProgress,
  practiceProgressIdentity,
  progressMatchesIdentity,
  sha256Hex,
} from "./progress.mjs";
import { admitRuntimeLimits } from "./runtime-policy.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("data-")) node.setAttribute(key, value);
    else if (key === "htmlFor") node.htmlFor = value;
    else node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

async function loadJson(path) {
  const response = await fetch(path, { credentials: "omit" });
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.json();
}

async function loadJsonWithDigest(path) {
  const response = await fetch(path, { credentials: "omit" });
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  const source = await response.text();
  return {
    data: JSON.parse(source),
    digest: await sha256Hex(source),
  };
}

function storage(namespace) {
  return {
    read(key, fallback) {
      try {
        const value = localStorage.getItem(`${namespace}:${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
      } catch {
        // The platform remains usable without durable device storage.
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(`${namespace}:${key}`);
      } catch {
        // The platform remains usable without durable device storage.
      }
    },
  };
}

function announce(message) {
  $("#announcement").textContent = message;
}

function setStatus(node, message, tone = "neutral") {
  node.textContent = message;
  node.dataset.tone = tone;
  announce(message);
}

async function runInWorker(source, entrypoint, cases, limits = {}) {
  const admittedLimits = admitRuntimeLimits(limits);
  const worker = new Worker("./runner.worker.mjs", { type: "module" });
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("The bounded browser run exceeded its total time budget and was stopped."));
    }, admittedLimits.timeoutMs * Math.max(cases.length, 1) + 250);
    worker.addEventListener("message", (event) => {
      if (event.data?.id !== id) return;
      clearTimeout(timer);
      worker.terminate();
      if (
        event.data.ok
        && Array.isArray(event.data.results)
        && event.data.results.every((result) => (
          result
          && typeof result.id === "string"
          && typeof result.passed === "boolean"
          && Array.isArray(result.assertions)
          && result.assertions.every((assertion) => (
            assertion
            && typeof assertion.id === "string"
            && typeof assertion.passed === "boolean"
          ))
        ))
      ) resolve(event.data.results);
      else reject(new Error(event.data.error ?? "The browser worker returned an invalid result."));
    });
    worker.addEventListener("error", () => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error("The browser worker could not run this source."));
    });
    worker.postMessage({ id, source, entrypoint, cases, limits: admittedLimits });
  });
}

function renderBlock(block, quizContext) {
  if (block.type === "paragraph") return element("p", { text: block.text });
  if (block.type === "heading") return element(`h${block.level}`, { text: block.text });
  if (block.type === "list") {
    return element(block.style === "ordered" ? "ol" : "ul", {}, block.items.map((item) => (
      element("li", { text: item })
    )));
  }
  if (block.type === "code") {
    const wrapper = element("div");
    wrapper.append(element("pre", {}, element("code", { text: block.code })));
    if (block.caption) wrapper.append(element("p", { className: "caption", text: block.caption }));
    return wrapper;
  }
  if (block.type === "callout") {
    return element("aside", { className: "callout" }, [
      element("strong", { text: block.title }),
      element("p", { text: block.text }),
    ]);
  }
  if (block.type === "quiz") {
    const fieldset = element("fieldset");
    fieldset.append(element("legend", { text: block.prompt }));
    for (const choice of block.choices) {
      const id = `quiz-${block.id}-${choice.id}`;
      const input = element("input", { id, type: "radio", name: `quiz-${block.id}`, value: choice.id });
      if (quizContext.records[block.id]?.selected === choice.id) input.checked = true;
      fieldset.append(element("label", { htmlFor: id }, [input, element("span", { text: choice.text })]));
    }
    const status = element("p", { className: "status", "aria-live": "polite" });
    const restored = quizContext.records[block.id];
    if (restored) {
      setStatus(
        status,
        `${restored.correct ? "Correct." : "Try again."} ${block.explanation}`,
        restored.correct ? "success" : "danger",
      );
    }
    const check = element("button", { className: "primary-button", type: "button", text: "Check answer" });
    check.addEventListener("click", () => {
      const selected = $(`input[name="quiz-${block.id}"]:checked`, fieldset)?.value;
      if (!selected) {
        setStatus(status, "Choose an answer first.", "danger");
        return;
      }
      const correct = selected === block.correctChoiceId;
      quizContext.records[block.id] = { selected, correct };
      quizContext.store.write("quiz-progress", quizContext.records);
      setStatus(status, `${correct ? "Correct." : "Try again."} ${block.explanation}`, correct ? "success" : "danger");
    });
    return element("div", { className: "quiz" }, [fieldset, check, status]);
  }
  return element("p", { text: "Unsupported lesson block." });
}

function renderLesson(pack, state) {
  const root = $("#lesson-root");
  root.className = "view-grid";
  root.replaceChildren();
  const lesson = pack.lessons[0];
  const rail = element("aside", { className: "rail" }, [
    element("p", { className: "kicker", text: "Lesson · 7 minutes" }),
    element("h2", { id: "lesson-heading", text: lesson.title }),
    element("p", { className: "summary", text: lesson.summary }),
    element("ul", { className: "meta-list" }, [
      element("li", {}, [element("span", { text: "Objectives" }), element("strong", { text: String(lesson.objectiveIds.length) })]),
      element("li", {}, [element("span", { text: "Source links" }), element("strong", { text: String(lesson.sourceIds.length) })]),
      element("li", {}, [element("span", { text: "Knowledge check" }), element("strong", { text: "1" })]),
    ]),
  ]);
  const prose = element("article", { className: "work prose" });
  for (const block of lesson.blocks) {
    prose.append(renderBlock(block, { records: state.quiz, store: state.store }));
  }
  root.append(rail, prose);
}

function renderCards(pack, state) {
  const root = $("#cards-root");
  root.className = "view-grid";
  root.replaceChildren();
  const deck = pack.flashcardDecks[0];
  const card = deck.cards[state.card.index];
  const rail = element("aside", { className: "rail" }, [
    element("p", { className: "kicker", text: "Retrieval practice" }),
    element("h2", { id: "cards-heading", text: deck.title }),
    element("p", { className: "summary", text: deck.description }),
    element("ul", { className: "meta-list" }, [
      element("li", {}, [element("span", { text: "Card" }), element("strong", { text: `${state.card.index + 1} / ${deck.cards.length}` })]),
      element("li", {}, [element("span", { text: "Reviewed" }), element("strong", { text: String(Object.keys(state.card.ratings).length) })]),
    ]),
  ]);

  const stage = element("div", { className: "work card-stage" });
  const cardNode = element("article", { className: "flash-card" }, [
    element("p", { className: "kicker", text: state.card.revealed ? "Answer" : "Prompt" }),
    element("h3", { text: card.front }),
  ]);
  const controls = element("div");
  if (!state.card.revealed) {
    const reveal = element("button", { className: "primary-button", type: "button", text: "Reveal answer" });
    reveal.addEventListener("click", () => {
      state.card.revealed = true;
      renderCards(pack, state);
      announce("Answer revealed.");
    });
    controls.append(reveal);
  } else {
    cardNode.append(element("div", { className: "answer" }, [
      element("strong", { text: card.back }),
      element("p", { text: card.explanation }),
    ]));
    for (const [rating, label] of [["again", "Again"], ["good", "Got it"]]) {
      const button = element("button", {
        className: rating === "good" ? "primary-button" : "secondary-button",
        type: "button",
        text: label,
      });
      button.addEventListener("click", () => {
        state.card.ratings[card.id] = rating;
        state.store.write("card-ratings", state.card.ratings);
        state.card.index = (state.card.index + 1) % deck.cards.length;
        state.card.revealed = false;
        renderCards(pack, state);
        announce(`${label} saved. Next card.`);
      });
      controls.append(button);
    }
  }
  controls.className = "button-row";
  cardNode.append(controls);
  stage.append(cardNode);
  root.append(rail, stage);
}

function questionKey(question) {
  return `${question.groupId}/${question.id}`;
}

function questionIdentity(library, state, question) {
  return practiceProgressIdentity(
    library,
    state.practice.libraryDigest,
    question,
  );
}

function currentQuestionProgress(library, state, question) {
  const identity = questionIdentity(library, state, question);
  const progress = state.practice.progress[identity.contractVersion];
  return progressMatchesIdentity(progress, identity) ? progress : null;
}

function renderCaseResults(results) {
  const list = element("ul", { className: "case-list" });
  for (const result of results) {
    const details = result.assertions.map((assertion) => (
      `${assertion.label}: ${assertion.passed ? "passed" : `expected ${JSON.stringify(assertion.expected)}, received ${JSON.stringify(assertion.actual)}`}`
    )).join(" ");
    list.append(element("li", { "data-passed": String(result.passed) }, [
      element("strong", { text: `${result.passed ? "Pass" : "Fail"} · ${result.label}` }),
      element("p", { text: details }),
    ]));
  }
  return list;
}

function renderPractice(library, state) {
  const root = $("#practice-root");
  root.className = "view-grid";
  root.replaceChildren();
  const allQuestions = library.groups.flatMap((group) => group.questions.map((question) => ({
    ...question,
    groupId: group.id,
    groupTitle: group.title,
  })));
  const visibleQuestions = state.practice.leechesOnly
    ? allQuestions.filter((question) => isLeechProgress(
      currentQuestionProgress(library, state, question),
    ))
    : allQuestions;
  if (!visibleQuestions.some((question) => questionKey(question) === state.practice.activeKey)) {
    state.practice.activeKey = visibleQuestions[0]
      ? questionKey(visibleQuestions[0])
      : questionKey(allQuestions[0]);
  }
  const question = allQuestions.find((entry) => (
    questionKey(entry) === state.practice.activeKey
  )) ?? allQuestions[0];
  const identity = questionIdentity(library, state, question);
  const source = state.practice.drafts[identity.contractVersion] ?? question.starterCode;

  const toggleId = "leeches-only";
  const toggle = element("input", { id: toggleId, type: "checkbox" });
  toggle.checked = state.practice.leechesOnly;
  toggle.addEventListener("change", () => {
    state.practice.leechesOnly = toggle.checked;
    renderPractice(library, state);
  });
  const rail = element("aside", { className: "rail" }, [
    element("p", { className: "kicker", text: "Portable Question Groups" }),
    element("h2", { id: "practice-heading", text: "Practice" }),
    element("p", { className: "summary", text: "Run declarative cases in a fresh browser worker. Repeated misses become leeches in your device progress." }),
    element("label", { className: "filter", htmlFor: toggleId }, [toggle, element("span", { text: "Leeches only" })]),
  ]);
  const list = element("ul", { className: "question-list" });
  if (!visibleQuestions.length) {
    list.append(element("li", { className: "empty-state", text: "No leeches. Questions appear here after at least three attempts and two misses." }));
  }
  for (const entry of visibleQuestions) {
    const button = element("button", {
      type: "button",
      "aria-current": String(questionKey(entry) === questionKey(question)),
      text: entry.title,
    });
    button.addEventListener("click", () => {
      state.practice.activeKey = questionKey(entry);
      renderPractice(library, state);
    });
    list.append(element("li", {}, button));
  }
  rail.append(list);
  if (state.practice.leechesOnly && visibleQuestions.length === 0) {
    root.append(
      rail,
      element("div", { className: "work" }, element("p", {
        className: "empty-state",
        text: "Nothing needs leech review yet. Return to all questions to keep practicing.",
      })),
    );
    return;
  }

  const work = element("div", { className: "work" }, [
    element("p", { className: "kicker", text: `${question.groupTitle} · ${question.difficulty}` }),
    element("h3", { text: question.title }),
    element("p", { className: "summary", text: question.prompt }),
  ]);
  const label = element("label", { htmlFor: "practice-editor", className: "kicker", text: question.path });
  const editor = element("textarea", {
    id: "practice-editor",
    className: "editor",
    spellcheck: "false",
    "aria-label": `${question.title} source`,
  });
  editor.value = source;
  editor.addEventListener("input", () => {
    state.practice.drafts[identity.contractVersion] = editor.value;
    state.store.write(`practice-draft:${identity.contractVersion}`, editor.value);
  });
  const status = element("p", { className: "status", "aria-live": "polite" });
  const results = element("div");
  const run = element("button", { className: "primary-button", type: "button", text: "Check solution" });
  run.addEventListener("click", async () => {
    run.disabled = true;
    setStatus(status, "Running bounded browser checks…");
    try {
      const submittedSource = editor.value;
      const runtime = library.runtimes.find((entry) => entry.id === question.runtimeId);
      const runResults = await runInWorker(
        submittedSource,
        question.entrypoint,
        question.cases,
        runtime?.limits,
      );
      if (editor.value !== submittedSource) {
        throw new Error("Source changed while checks ran. Run the current source again.");
      }
      const submittedSourceDigest = await sha256Hex(submittedSource);
      const passed = runResults.every((entry) => entry.passed);
      const currentProgress = currentQuestionProgress(library, state, question);
      const next = nextPracticeProgress(identity, currentProgress, {
        sourceDigest: submittedSourceDigest,
        passed,
        attemptedAt: Date.now(),
      });
      state.practice.progress[identity.contractVersion] = next;
      state.store.write("practice-progress", state.practice.progress);
      results.replaceChildren(renderCaseResults(runResults));
      setStatus(
        status,
        passed
          ? "All checks passed. This question left the leech queue."
          : isLeechProgress(next)
            ? "Some checks failed. Repeated misses put this question in the leech queue."
            : "Some checks failed. Review the cases and try again.",
        passed ? "success" : "danger",
      );
    } catch (error) {
      setStatus(status, error.message, "danger");
    } finally {
      run.disabled = false;
    }
  });
  work.append(label, editor, element("div", { className: "button-row" }, run), status, results);
  root.append(rail, work);
}

function renderIde(exercises, state) {
  const root = $("#ide-root");
  root.className = "view-grid";
  root.replaceChildren();
  const exercise = exercises[0];
  const saved = state.ide.draft ?? exercise.files[0].content;
  const rail = element("aside", { className: "rail" }, [
    element("p", { className: "kicker", text: "Trusted browser exercise" }),
    element("h2", { id: "ide-heading", text: "IDE" }),
    element("p", { className: "summary", text: exercise.summary }),
    element("ul", { className: "meta-list" }, [
      element("li", {}, [element("span", { text: "Runtime" }), element("strong", { text: "Browser worker" })]),
      element("li", {}, [element("span", { text: "Language" }), element("strong", { text: exercise.language })]),
      element("li", {}, [element("span", { text: "Contract" }), element("strong", { text: exercise.contractVersion })]),
    ]),
  ]);
  const work = element("div", { className: "work" }, [
    element("p", { className: "kicker", text: exercise.files[0].path }),
    element("h3", { text: exercise.title }),
  ]);
  const editor = element("textarea", {
    className: "editor",
    spellcheck: "false",
    "aria-label": `${exercise.title} source`,
  });
  editor.value = saved;
  editor.addEventListener("input", () => {
    state.ide.draft = editor.value;
    state.store.write(`ide-draft:${exercise.id}:${exercise.contractVersion}`, editor.value);
  });
  const status = element("p", { className: "status", "aria-live": "polite" });
  const results = element("div");
  if (
    state.ide.result?.exerciseId === exercise.id
    && state.ide.result?.contractVersion === exercise.contractVersion
    && state.ide.result?.source === saved
    && Array.isArray(state.ide.result?.results)
  ) {
    results.replaceChildren(renderCaseResults(state.ide.result.results));
    setStatus(
      status,
      state.ide.result.passed
        ? "Restored a passing result for this exact source and contract."
        : "Restored the latest failing result for this exact source and contract.",
      state.ide.result.passed ? "success" : "danger",
    );
  }
  const run = element("button", { className: "primary-button", type: "button", text: "Run IDE checks" });
  run.addEventListener("click", async () => {
    run.disabled = true;
    setStatus(status, "Running host-owned checks…");
    try {
      const submittedSource = editor.value;
      const cases = exercise.checks.map((check) => ({ ...check, assertions: [{
        id: check.id,
        label: check.label,
        kind: "deep-equal",
        expected: check.expected,
      }] }));
      const runResults = await runInWorker(
        submittedSource,
        exercise.entrypoint,
        cases,
        exercise.limits,
      );
      if (editor.value !== submittedSource) {
        throw new Error("Source changed while checks ran. Run the current source again.");
      }
      const sourceDigest = await sha256Hex(submittedSource);
      const passed = runResults.every((entry) => entry.passed);
      results.replaceChildren(renderCaseResults(runResults));
      state.ide.result = {
        exerciseId: exercise.id,
        contractVersion: exercise.contractVersion,
        source: submittedSource,
        sourceDigest,
        passed,
        results: runResults,
      };
      state.store.write(
        `ide-result:${exercise.id}:${exercise.contractVersion}`,
        state.ide.result,
      );
      setStatus(status, passed ? "Every IDE check passed." : "One or more IDE checks failed.", passed ? "success" : "danger");
    } catch (error) {
      setStatus(status, error.message, "danger");
    } finally {
      run.disabled = false;
    }
  });
  const reset = element("button", { className: "secondary-button", type: "button", text: "Reset starter" });
  reset.addEventListener("click", () => {
    editor.value = exercise.files[0].content;
    state.ide.draft = editor.value;
    state.store.write(`ide-draft:${exercise.id}:${exercise.contractVersion}`, editor.value);
    state.ide.result = null;
    state.store.remove(`ide-result:${exercise.id}:${exercise.contractVersion}`);
    results.replaceChildren();
    setStatus(status, "Starter restored.");
  });
  work.append(editor, element("div", { className: "button-row" }, [run, reset]), status, results);
  root.append(rail, work);
}

function configureNavigation() {
  for (const button of $$(".primitive-nav button")) {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      for (const candidate of $$(".primitive-nav button")) {
        if (candidate === button) candidate.setAttribute("aria-current", "page");
        else candidate.removeAttribute("aria-current");
      }
      for (const panel of $$("[data-panel]")) panel.hidden = panel.dataset.panel !== view;
      $("#learning-surface").focus({ preventScroll: true });
      announce(`${button.textContent.trim()} view opened.`);
    });
  }
}

try {
  const [platform, pack, libraryRecord, hostModule] = await Promise.all([
    loadJson("./platform.json"),
    loadJson("./content/learning-pack.json"),
    loadJsonWithDigest("./content/question-groups.json"),
    import("./trusted/ide-exercises.mjs"),
  ]);
  const library = libraryRecord.data;
  document.documentElement.style.setProperty("--accent", platform.brand.accent);
  document.documentElement.style.setProperty("--ink", platform.brand.ink);
  document.documentElement.style.setProperty("--paper", platform.brand.paper);
  document.title = platform.brand.name;
  $("#brand-name").textContent = platform.brand.name;
  $("#brand-tagline").textContent = platform.brand.tagline;

  const store = storage(`latent-platform:${pack.package.id}@${pack.package.version}`);
  const practiceQuestions = library.groups.flatMap((group) => (
    group.questions.map((question) => ({ ...question, groupId: group.id }))
  ));
  const practiceIdentities = practiceQuestions.map((question) => (
    practiceProgressIdentity(library, libraryRecord.digest, question)
  ));
  const ideExercise = hostModule.ideExercises[0];
  const ideDraftKey = `ide-draft:${ideExercise.id}:${ideExercise.contractVersion}`;
  const ideResultKey = `ide-result:${ideExercise.id}:${ideExercise.contractVersion}`;
  const ideDraft = store.read(ideDraftKey, null);
  const ideSource = ideDraft ?? ideExercise.files[0].content;
  const storedIdeResult = store.read(ideResultKey, null);
  const ideResult = (
    storedIdeResult?.exerciseId === ideExercise.id
    && storedIdeResult?.contractVersion === ideExercise.contractVersion
    && storedIdeResult?.source === ideSource
    && storedIdeResult?.sourceDigest === await sha256Hex(ideSource)
    && Array.isArray(storedIdeResult?.results)
  ) ? storedIdeResult : null;
  const state = {
    store,
    quiz: store.read("quiz-progress", {}),
    card: {
      index: 0,
      revealed: false,
      ratings: store.read("card-ratings", {}),
    },
    practice: {
      activeKey: `${practiceQuestions[0].groupId}/${practiceQuestions[0].id}`,
      libraryDigest: libraryRecord.digest,
      leechesOnly: false,
      progress: store.read("practice-progress", {}),
      drafts: Object.fromEntries(practiceIdentities.map((identity) => [
        identity.contractVersion,
        store.read(`practice-draft:${identity.contractVersion}`, null),
      ])),
    },
    ide: {
      draft: ideDraft,
      result: ideResult,
    },
  };

  configureNavigation();
  renderLesson(pack, state);
  renderCards(pack, state);
  renderPractice(library, state);
  renderIde(hostModule.ideExercises, state);
  announce(`${platform.brand.name} is ready.`);
} catch (error) {
  for (const root of $$(".loading")) {
    root.textContent = error instanceof Error ? error.message : "The platform could not load.";
  }
  announce("The platform could not load.");
}
