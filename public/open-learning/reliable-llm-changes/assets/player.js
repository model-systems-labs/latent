(() => {
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
})();
