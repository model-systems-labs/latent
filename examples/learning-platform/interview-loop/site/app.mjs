import {
  createJsonStorage,
  createLearningPackStateStore,
  isLeechProgress,
  nextPracticeProgress,
  practiceProgressIdentity,
  progressMatchesIdentity,
  sha256Hex,
} from "./progress.mjs";
import { interviewPythonRuntime } from "./assets/python-runtime.mjs";

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

async function loadJsonWithDigest(path) {
  const response = await fetch(path, { credentials: "omit" });
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  const source = await response.text();
  return {
    data: JSON.parse(source),
    digest: await sha256Hex(source),
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

function focusRendered(selector) {
  requestAnimationFrame(() => {
    $(selector)?.focus({ preventScroll: true });
  });
}

function mobilePanel(label, children) {
  return element("details", { className: "learner-mobile-panel", open: "" }, [
    element("summary", { text: label }),
    element(
      "div",
      { className: "learner-mobile-panel__content" },
      Array.isArray(children) ? children : [children],
    ),
  ]);
}

async function runPythonChecks(source, path, entrypoint, cases, requirement) {
  if (!interviewPythonRuntime.supports(requirement)) {
    throw new Error("This exercise does not declare the supported Python runtime.");
  }
  const results = await interviewPythonRuntime.run({
    source,
    path,
    entrypoint,
    cases,
    requirement,
  });
  if (
    !Array.isArray(results)
    || !results.every((result) => (
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
  ) {
    throw new Error("The Python worker returned an invalid result.");
  }
  return results;
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
    return element("aside", { className: "learner-card callout" }, [
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
    const status = element("p", { className: "learner-status", "aria-live": "polite" });
    const restored = quizContext.records[block.id];
    if (restored) {
      setStatus(
        status,
        `${restored.correct ? "Correct." : "Try again."} ${block.explanation}`,
        restored.correct ? "success" : "danger",
      );
    }
    const check = element("button", {
      className: "learner-button",
      "data-variant": "primary",
      type: "button",
      text: "Check answer",
    });
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
    return element("div", { className: "learner-card learner-form quiz" }, [
      fieldset,
      check,
      status,
    ]);
  }
  return element("p", { text: "Unsupported lesson block." });
}

function renderLesson(pack, state) {
  const root = $("#lesson-root");
  root.className = "learner-layout view-grid";
  root.replaceChildren();
  const lessons = [...pack.lessons].sort((left, right) => left.order - right.order);
  const activeIndex = Math.max(
    0,
    lessons.findIndex((candidate) => candidate.id === state.module.activeId),
  );
  const lesson = lessons[activeIndex];
  const completed = new Set(state.module.completedIds);
  const quizCount = lesson.blocks.filter((block) => block.type === "quiz").length;
  const progress = element("progress", {
    className: "learner-progress module-progress",
    max: String(lessons.length),
    value: String(completed.size),
    "aria-label": `${completed.size} of ${lessons.length} modules completed`,
  });
  const rail = element("aside", { className: "learner-sidebar rail" }, [
    element("p", { className: "learner-eyebrow", text: `Module ${activeIndex + 1} of ${lessons.length} · ${lesson.durationMinutes} minutes` }),
    element("h2", { id: "lesson-heading", tabindex: "-1", text: lesson.title }),
    element("p", { className: "learner-summary", text: lesson.summary }),
    element("div", { className: "learner-progress-summary" }, [
      element("strong", { text: `${completed.size} / ${lessons.length} modules complete` }),
      progress,
      element("p", { className: "learner-resume" }, [
        element("strong", { text: completed.size === lessons.length ? "Complete:" : "Continue:" }),
        element("span", {
          text: completed.size === lessons.length
            ? "All modules finished. You can revisit any module."
            : `${lesson.title}. Position and completion are saved on this device.`,
        }),
      ]),
    ]),
  ]);
  const moduleList = element("ol", {
    className: "learner-nav-list module-list",
    "aria-label": "Course modules",
  });
  for (const [index, candidate] of lessons.entries()) {
    const isComplete = completed.has(candidate.id);
    const button = element("button", {
      className: "learner-nav-item",
      type: "button",
      "aria-current": String(candidate.id === lesson.id),
      "aria-label": `Module ${index + 1}: ${candidate.title}${isComplete ? ", complete" : ""}`,
    }, [
      element("span", {
        className: "learner-status-dot",
        "data-status": isComplete ? "solved" : "not-started",
        "aria-hidden": "true",
      }),
      element("span", {
        text: `${String(index + 1).padStart(2, "0")} · ${candidate.title}${isComplete ? " · Complete" : ""}`,
      }),
    ]);
    button.addEventListener("click", () => {
      state.module.activeId = candidate.id;
      state.store.write("module-progress", state.module);
      renderLesson(pack, state);
      focusRendered("#lesson-heading");
      announce(`Module ${index + 1} opened: ${candidate.title}.`);
    });
    moduleList.append(element("li", {}, button));
  }
  const moduleDetails = element("ul", { className: "meta-list" }, [
    element("li", {}, [element("span", { text: "Objectives" }), element("strong", { text: String(lesson.objectiveIds.length) })]),
    element("li", {}, [element("span", { text: "Source links" }), element("strong", { text: String(lesson.sourceIds.length) })]),
    element("li", {}, [element("span", { text: "Knowledge checks" }), element("strong", { text: String(quizCount) })]),
  ]);
  rail.append(
    mobilePanel("Choose module", [
      moduleList,
      moduleDetails,
    ]),
  );
  const prose = element("article", { className: "learner-content work prose" });
  for (const block of lesson.blocks) {
    prose.append(renderBlock(block, { records: state.quiz, store: state.store }));
  }
  const sourceById = new Map(pack.sources.map((source) => [source.id, source]));
  prose.append(element("section", { className: "lesson-sources", "aria-labelledby": "lesson-sources-heading" }, [
    element("h2", { id: "lesson-sources-heading", text: "Official and primary sources" }),
    element("p", {
      text: "These public sources ground factual guidance in this module; the framework synthesis and practice prompts are original to this lab.",
    }),
    element("ul", {}, lesson.sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      return element("li", {}, [
        element("a", {
          href: source.url,
          target: "_blank",
          rel: "noreferrer",
          text: source.title,
        }),
      ]);
    })),
  ]));
  const completeButton = element("button", {
    id: "module-complete-action",
    className: "learner-button",
    "data-variant": completed.has(lesson.id) ? "secondary" : "primary",
    type: "button",
    text: completed.has(lesson.id) ? "Mark module incomplete" : "Mark module complete",
  });
  completeButton.addEventListener("click", () => {
    if (completed.has(lesson.id)) completed.delete(lesson.id);
    else {
      completed.add(lesson.id);
      const nextIncomplete = lessons.find((candidate) => !completed.has(candidate.id));
      if (nextIncomplete) state.module.activeId = nextIncomplete.id;
    }
    state.module.completedIds = lessons
      .filter((candidate) => completed.has(candidate.id))
      .map((candidate) => candidate.id);
    state.store.write("module-progress", state.module);
    renderLesson(pack, state);
    focusRendered("#module-complete-action");
    announce(`${lesson.title} marked ${completed.has(lesson.id) ? "complete" : "incomplete"}.`);
  });
  const moduleControls = element(
    "div",
    { className: "learner-button-row module-controls" },
    completeButton,
  );
  if (activeIndex > 0) {
    const previous = element("button", {
      className: "learner-button",
      "data-variant": "quiet",
      type: "button",
      text: "Previous module",
    });
    previous.addEventListener("click", () => {
      state.module.activeId = lessons[activeIndex - 1].id;
      state.store.write("module-progress", state.module);
      renderLesson(pack, state);
      focusRendered("#lesson-heading");
      announce(`Previous module opened: ${lessons[activeIndex - 1].title}.`);
    });
    moduleControls.prepend(previous);
  }
  if (activeIndex < lessons.length - 1) {
    const next = element("button", {
      className: "learner-button",
      type: "button",
      text: "Next module",
    });
    next.addEventListener("click", () => {
      state.module.activeId = lessons[activeIndex + 1].id;
      state.store.write("module-progress", state.module);
      renderLesson(pack, state);
      focusRendered("#lesson-heading");
      announce(`Next module opened: ${lessons[activeIndex + 1].title}.`);
    });
    moduleControls.append(next);
  }
  prose.append(moduleControls);
  root.append(rail, prose);
}

function renderCards(pack, state) {
  const root = $("#cards-root");
  root.className = "learner-layout view-grid";
  root.replaceChildren();
  const deck = pack.flashcardDecks[0];
  const card = deck.cards[state.card.index];
  const rail = element("aside", { className: "learner-sidebar rail" }, [
    element("p", { className: "learner-eyebrow", text: "Review" }),
    element("h2", { id: "cards-heading", tabindex: "-1", text: deck.title }),
    element("p", { className: "learner-summary", text: deck.description }),
    element("ul", { className: "meta-list" }, [
      element("li", {}, [element("span", { text: "Card" }), element("strong", { text: `${state.card.index + 1} / ${deck.cards.length}` })]),
      element("li", {}, [element("span", { text: "Reviewed" }), element("strong", { text: String(Object.keys(state.card.ratings).length) })]),
    ]),
  ]);

  const stage = element("div", { className: "learner-content work card-stage" });
  const cardNode = element("article", { className: "learner-card flash-card" }, [
    element("p", { className: "learner-eyebrow", text: state.card.revealed ? "Answer" : "Prompt" }),
    element("h3", { id: "active-card-heading", tabindex: "-1", text: card.front }),
  ]);
  const controls = element("div");
  if (!state.card.revealed) {
    const reveal = element("button", {
      className: "learner-button",
      "data-variant": "primary",
      type: "button",
      text: "Reveal answer",
    });
    reveal.addEventListener("click", () => {
      state.card.revealed = true;
      renderCards(pack, state);
      focusRendered(".answer");
      announce("Answer revealed.");
    });
    controls.append(reveal);
  } else {
    cardNode.append(element("div", { className: "answer", tabindex: "-1" }, [
      element("strong", { text: card.back }),
      element("p", { text: card.explanation }),
    ]));
    for (const [rating, label] of [["again", "Again"], ["good", "Got it"]]) {
      const button = element("button", {
        className: "learner-button",
        "data-variant": rating === "good" ? "primary" : "secondary",
        type: "button",
        text: label,
      });
      button.addEventListener("click", () => {
        state.card.ratings[card.id] = rating;
        state.store.write("card-ratings", state.card.ratings);
        state.card.index = (state.card.index + 1) % deck.cards.length;
        state.card.revealed = false;
        state.store.write("card-progress", { index: state.card.index });
        renderCards(pack, state);
        focusRendered("#active-card-heading");
        announce(`${label} saved. Next card.`);
      });
      controls.append(button);
    }
  }
  controls.className = "learner-button-row";
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
  const list = element("ul", { className: "case-list", "aria-label": "Check results" });
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
  root.className = "learner-layout view-grid";
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
  const questionIndex = allQuestions.findIndex((entry) => (
    questionKey(entry) === questionKey(question)
  ));
  const identity = questionIdentity(library, state, question);
  const source = state.practice.drafts[identity.contractVersion] ?? question.starterCode;

  const toggleId = "leeches-only";
  const toggle = element("input", { id: toggleId, type: "checkbox" });
  toggle.checked = state.practice.leechesOnly;
  toggle.addEventListener("change", () => {
    state.practice.leechesOnly = toggle.checked;
    renderPractice(library, state);
    focusRendered("#leeches-only");
    announce(toggle.checked ? "Showing repeated misses." : "Showing all practice problems.");
  });
  const rail = element("aside", { className: "learner-sidebar rail" }, [
    element("p", { className: "learner-eyebrow", text: "Practice" }),
    element("h2", { id: "practice-heading", tabindex: "-1", text: "Coding practice" }),
    element("p", {
      className: "learner-summary",
      text: "Work through the public examples and checks. Questions with repeated misses move into Review.",
    }),
  ]);
  const list = element("ul", {
    className: "learner-nav-list question-list",
    "aria-label": "Practice problems",
  });
  if (!visibleQuestions.length) {
    list.append(element("li", {
      className: "learner-empty",
      text: "No repeated misses. Problems appear here after at least three attempts and two misses.",
    }));
  }
  for (const entry of visibleQuestions) {
    const sequence = allQuestions.findIndex((questionEntry) => (
      questionKey(questionEntry) === questionKey(entry)
    )) + 1;
    const entryProgress = currentQuestionProgress(library, state, entry);
    const progressStatus = entryProgress?.status ?? "not-started";
    const progressLabel = progressStatus === "solved"
      ? "solved"
      : progressStatus === "attempted"
        ? "attempted"
        : "not started";
    const button = element("button", {
      className: "learner-nav-item",
      type: "button",
      "aria-current": String(questionKey(entry) === questionKey(question)),
      "aria-label": `Problem ${sequence}: ${entry.title}, ${progressLabel}`,
    }, [
      element("span", {
        className: "learner-status-dot",
        "data-status": progressStatus,
        "aria-hidden": "true",
      }),
      element("span", { text: `${String(sequence).padStart(2, "0")} · ${entry.title}` }),
    ]);
    button.addEventListener("click", () => {
      state.practice.activeKey = questionKey(entry);
      renderPractice(library, state);
      focusRendered("#practice-question-heading");
      announce(`Problem ${sequence} opened: ${entry.title}.`);
    });
    list.append(element("li", {}, button));
  }
  const filter = element("label", { className: "filter", htmlFor: toggleId }, [
    toggle,
    element("span", { text: "Review repeated misses" }),
  ]);
  rail.append(mobilePanel("Choose problem", [filter, list]));
  if (state.practice.leechesOnly && visibleQuestions.length === 0) {
    root.append(
      rail,
      element("div", { className: "learner-content work" }, element("p", {
        className: "learner-empty",
        text: "Nothing needs review yet. Turn off repeated-miss review to keep practicing.",
      })),
    );
    return;
  }

  const work = element("div", { className: "learner-content work" }, [
    element("p", {
      className: "learner-eyebrow",
      text: `Coding ladder step ${questionIndex + 1} of ${allQuestions.length + 1} · ${question.groupTitle} · ${question.difficulty}`,
    }),
    element("h3", { id: "practice-question-heading", tabindex: "-1", text: question.title }),
    element("p", { className: "learner-summary", text: question.prompt }),
    element("p", { className: "learner-eyebrow constraint-heading", text: "Contract and complexity" }),
    element("ul", { className: "constraints-list" }, question.constraints.map((constraint) => (
      element("li", { text: constraint })
    ))),
  ]);
  const label = element("label", {
    htmlFor: "practice-editor",
    className: "learner-eyebrow",
    text: question.path,
  });
  const editor = element("textarea", {
    id: "practice-editor",
    className: "learner-editor",
    spellcheck: "false",
    "aria-label": `${question.title} source`,
  });
  editor.value = source;
  editor.addEventListener("input", () => {
    state.practice.drafts[identity.contractVersion] = editor.value;
    state.runtimeStore.write(`practice-draft:${identity.contractVersion}`, editor.value);
  });
  const editorFrame = element("div", { className: "learner-editor-frame" }, [
    element("div", { className: "learner-editor-toolbar" }, label),
    editor,
  ]);
  const status = element("p", { className: "learner-status", "aria-live": "polite" });
  const results = element("div", { className: "learner-results" });
  const run = element("button", {
    className: "learner-button",
    "data-variant": "primary",
    type: "button",
    text: "Check solution",
  });
  run.addEventListener("click", async () => {
    run.disabled = true;
    setStatus(status, "Checking your solution…");
    try {
      const submittedSource = editor.value;
      const runtime = library.runtimes.find((entry) => entry.id === question.runtimeId);
      const runResults = await runPythonChecks(
        submittedSource,
        question.path,
        question.entrypoint,
        question.cases,
        runtime,
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
      state.runtimeStore.write("practice-progress", state.practice.progress);
      results.replaceChildren(renderCaseResults(runResults));
      setStatus(
        status,
        passed
          ? "All checks passed. This problem no longer needs repeated-miss review."
          : isLeechProgress(next)
            ? "Some checks failed. This problem is now in repeated-miss review."
            : "Some checks failed. Review the cases and try again.",
        passed ? "success" : "danger",
      );
    } catch (error) {
      setStatus(status, error.message, "danger");
    } finally {
      run.disabled = false;
    }
  });
  work.append(
    editorFrame,
    element("div", { className: "learner-button-row practice-actions" }, run),
    status,
    results,
  );
  root.append(rail, work);
}

function renderIde(exercises, state) {
  const root = $("#ide-root");
  root.className = "learner-layout view-grid";
  root.replaceChildren();
  const exercise = exercises[0];
  const saved = state.ide.draft ?? exercise.files[0].content;
  const progressValue = element("strong", {
    text: state.ide.result?.passed ? "Complete" : "In progress",
  });
  const rail = element("aside", { className: "learner-sidebar rail" }, [
    element("p", { className: "learner-eyebrow", text: "Coding lab · Step 4 of 4" }),
    element("h2", { id: "ide-heading", tabindex: "-1", text: "Retry scheduling" }),
    element("p", { className: "learner-summary", text: exercise.summary }),
    element("ul", { className: "meta-list" }, [
      element("li", {}, [element("span", { text: "Runtime" }), element("strong", { text: "Python 3.14 · browser worker" })]),
      element("li", {}, [element("span", { text: "Language" }), element("strong", { text: exercise.language })]),
      element("li", {}, [element("span", { text: "Checks" }), element("strong", { text: String(exercise.checks.length) })]),
      element("li", {}, [element("span", { text: "Progress" }), progressValue]),
    ]),
  ]);
  const work = element("div", { className: "learner-content work" }, [
    element("h3", { text: exercise.title }),
  ]);
  const editorLabel = element("label", {
    className: "learner-eyebrow",
    htmlFor: "ide-editor",
    text: exercise.files[0].path,
  });
  const editor = element("textarea", {
    id: "ide-editor",
    className: "learner-editor",
    spellcheck: "false",
    "aria-label": `${exercise.title} source`,
  });
  editor.value = saved;
  editor.addEventListener("input", () => {
    state.ide.draft = editor.value;
    state.runtimeStore.write(`ide-draft:${exercise.id}:${exercise.contractVersion}`, editor.value);
  });
  const editorFrame = element("div", { className: "learner-editor-frame" }, [
    element("div", { className: "learner-editor-toolbar" }, editorLabel),
    editor,
  ]);
  const status = element("p", { className: "learner-status", "aria-live": "polite" });
  const results = element("div", { className: "learner-results" });
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
        ? "Your latest saved solution passed every check."
        : "Your latest saved solution still has failing checks.",
      state.ide.result.passed ? "success" : "danger",
    );
  }
  const run = element("button", {
    className: "learner-button",
    "data-variant": "primary",
    type: "button",
    text: "Check solution",
  });
  run.addEventListener("click", async () => {
    run.disabled = true;
    setStatus(status, "Checking your solution…");
    try {
      const submittedSource = editor.value;
      const cases = exercise.checks.map((check) => ({ ...check, assertions: [{
        id: check.id,
        label: check.label,
        kind: "deep-equal",
        expected: check.expected,
      }] }));
      const runResults = await runPythonChecks(
        submittedSource,
        exercise.files[0].path,
        exercise.entrypoint,
        cases,
        exercise.runtime,
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
      state.runtimeStore.write(
        `ide-result:${exercise.id}:${exercise.contractVersion}`,
        state.ide.result,
      );
      progressValue.textContent = passed ? "Complete" : "In progress";
      setStatus(status, passed ? "Every IDE check passed." : "One or more IDE checks failed.", passed ? "success" : "danger");
    } catch (error) {
      setStatus(status, error.message, "danger");
    } finally {
      run.disabled = false;
    }
  });
  const reset = element("button", {
    className: "learner-button",
    type: "button",
    text: "Reset starter",
  });
  reset.addEventListener("click", () => {
    editor.value = exercise.files[0].content;
    state.ide.draft = editor.value;
    state.runtimeStore.write(`ide-draft:${exercise.id}:${exercise.contractVersion}`, editor.value);
    state.ide.result = null;
    state.runtimeStore.remove(`ide-result:${exercise.id}:${exercise.contractVersion}`);
    results.replaceChildren();
    progressValue.textContent = "In progress";
    setStatus(status, "Starter restored.");
  });
  work.append(
    editorFrame,
    element("div", { className: "learner-button-row practice-actions" }, [run, reset]),
    status,
    results,
  );
  root.append(rail, work);
}

function configureNavigation() {
  const links = $$(".learner-primary-nav [data-view]");
  const open = (link, { focus = false, announceView = false, updateHistory = false } = {}) => {
    const view = link.dataset.view;
    for (const candidate of links) {
      if (candidate === link) candidate.setAttribute("aria-current", "page");
      else candidate.removeAttribute("aria-current");
    }
    for (const panel of $$("[data-panel]")) panel.hidden = panel.dataset.panel !== view;
    if (updateHistory && location.hash !== link.getAttribute("href")) {
      history.pushState(null, "", link.getAttribute("href"));
    }
    if (focus) $("#learning-surface").focus({ preventScroll: true });
    if (announceView) announce(`${link.textContent.trim()} opened.`);
  };
  for (const link of links) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      open(link, { focus: true, announceView: true, updateHistory: true });
    });
  }
  const openFromLocation = ({ focus = false } = {}) => {
    const requested = links.find((link) => link.getAttribute("href") === location.hash);
    open(requested ?? links[0], { focus });
  };
  globalThis.addEventListener("popstate", () => openFromLocation({ focus: true }));
  openFromLocation();
}

try {
  const [packRecord, libraryRecord, hostModule] = await Promise.all([
    loadJsonWithDigest("./content/learning-pack.json"),
    loadJsonWithDigest("./content/question-groups.json"),
    import("./trusted/ide-exercises.mjs"),
  ]);
  const pack = packRecord.data;
  const library = libraryRecord.data;

  const learningState = createLearningPackStateStore(
    localStorage,
    pack,
    packRecord.digest,
  );
  const store = learningState.store;
  const runtimeStore = createJsonStorage(
    localStorage,
    `latent-platform-runtime:${pack.package.id}@${pack.package.version}`,
  );
  const lessonIds = new Set(pack.lessons.map((lesson) => lesson.id));
  const storedModule = store.read("module-progress", {});
  const completedIds = Array.isArray(storedModule.completedIds)
    ? storedModule.completedIds.filter((id) => lessonIds.has(id))
    : [];
  const storedActiveIsIncomplete = (
    lessonIds.has(storedModule.activeId)
    && !completedIds.includes(storedModule.activeId)
  );
  const activeId = storedActiveIsIncomplete
    ? storedModule.activeId
    : pack.lessons.find((lesson) => !completedIds.includes(lesson.id))?.id ?? pack.lessons[0].id;
  const storedCardProgress = store.read("card-progress", {});
  const cardCount = pack.flashcardDecks[0]?.cards.length ?? 0;
  const cardIndex = (
    Number.isInteger(storedCardProgress.index)
    && storedCardProgress.index >= 0
    && storedCardProgress.index < cardCount
  ) ? storedCardProgress.index : 0;
  const practiceQuestions = library.groups.flatMap((group) => (
    group.questions.map((question) => ({ ...question, groupId: group.id }))
  ));
  const practiceIdentities = practiceQuestions.map((question) => (
    practiceProgressIdentity(library, libraryRecord.digest, question)
  ));
  const ideExercise = hostModule.ideExercises[0];
  const ideDraftKey = `ide-draft:${ideExercise.id}:${ideExercise.contractVersion}`;
  const ideResultKey = `ide-result:${ideExercise.id}:${ideExercise.contractVersion}`;
  const ideDraft = runtimeStore.read(ideDraftKey, null);
  const ideSource = ideDraft ?? ideExercise.files[0].content;
  const storedIdeResult = runtimeStore.read(ideResultKey, null);
  const ideResult = (
    storedIdeResult?.exerciseId === ideExercise.id
    && storedIdeResult?.contractVersion === ideExercise.contractVersion
    && storedIdeResult?.source === ideSource
    && storedIdeResult?.sourceDigest === await sha256Hex(ideSource)
    && Array.isArray(storedIdeResult?.results)
  ) ? storedIdeResult : null;
  const state = {
    store,
    runtimeStore,
    learningPackIdentity: learningState.identity,
    module: {
      activeId,
      completedIds,
    },
    quiz: store.read("quiz-progress", {}),
    card: {
      index: cardIndex,
      revealed: false,
      ratings: store.read("card-ratings", {}),
    },
    practice: {
      activeKey: `${practiceQuestions[0].groupId}/${practiceQuestions[0].id}`,
      libraryDigest: libraryRecord.digest,
      leechesOnly: false,
      progress: runtimeStore.read("practice-progress", {}),
      drafts: Object.fromEntries(practiceIdentities.map((identity) => [
        identity.contractVersion,
        runtimeStore.read(`practice-draft:${identity.contractVersion}`, null),
      ])),
    },
    ide: {
      draft: ideDraft,
      result: ideResult,
    },
  };

  renderLesson(pack, state);
  renderCards(pack, state);
  renderPractice(library, state);
  renderIde(hostModule.ideExercises, state);
  configureNavigation();
  announce("Interview Loop Lab is ready.");
} catch (error) {
  for (const root of $$(".loading")) {
    root.textContent = error instanceof Error ? error.message : "The platform could not load.";
  }
  announce("The platform could not load.");
}
