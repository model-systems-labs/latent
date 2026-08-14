"use strict";
(() => {
  // browser-runtime/standalone-player.js
  (() => {
    "use strict";
    const storageKey = document.body.dataset.storageKey;
    const blankState = { completedLessons: [], cards: {} };
    const elements = (selector) => (
      /** @type {NodeListOf<HTMLElement>} */
      document.querySelectorAll(selector)
    );
    const elementsWithin = (root, selector) => (
      /** @type {NodeListOf<HTMLElement>} */
      root.querySelectorAll(selector)
    );
    const elementWithin = (root, selector) => (
      /** @type {HTMLElement | null} */
      root.querySelector(selector)
    );
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
    const viewFamily = (view) => view.startsWith("lesson-") ? "lesson" : view.startsWith("deck-") ? "deck" : view;
    const save = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
      }
    };
    const updateCompleteButtons = () => {
      elements("[data-complete]").forEach((button) => {
        const complete = state.completedLessons.includes(button.dataset.complete);
        button.textContent = complete ? "Lesson complete" : "Mark lesson complete";
        button.setAttribute("aria-pressed", String(complete));
      });
    };
    const updateDeckStatus = () => {
      elements("[data-view^='deck-']").forEach((deck) => {
        const cards = Array.from(elementsWithin(deck, "[data-card]"));
        const known = cards.filter((card) => state.cards[card.dataset.card] === "know").length;
        const status = elementWithin(deck, ".deck-status");
        if (status) status.textContent = known + " of " + cards.length + " marked as known on this device.";
        elementsWithin(deck, "[data-rating]").forEach((button) => {
          const card = (
            /** @type {HTMLElement | null} */
            button.closest("[data-card]")
          );
          button.setAttribute("aria-pressed", String(state.cards[card.dataset.card] === button.dataset.rating));
        });
      });
    };
    const openView = (view, moveFocus = true) => {
      elements(".learning-view[data-view]").forEach((section) => {
        section.hidden = section.dataset.view !== view;
      });
      elements("[data-open-view]").forEach((entry) => entry.setAttribute("aria-current", entry.dataset.openView === view ? "page" : "false"));
      elements(".learner-primary-nav [data-view]").forEach((entry) => {
        entry.setAttribute("aria-current", viewFamily(entry.dataset.view) === viewFamily(view) ? "page" : "false");
      });
      const target = document.getElementById(view);
      if (target) {
        history.replaceState(null, "", "#" + view);
        if (moveFocus) elementWithin(target, "h1")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    elements("[data-open-view]").forEach((button) => {
      button.addEventListener("click", () => openView(button.dataset.openView));
    });
    elements(".learner-primary-nav [data-view]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openView(link.dataset.view);
      });
    });
    elements(".quiz").forEach((quiz) => {
      quiz.addEventListener("submit", (event) => {
        event.preventDefault();
        const selected = (
          /** @type {HTMLInputElement | null} */
          quiz.querySelector("input:checked")
        );
        const result = elementWithin(quiz, ".quiz-result");
        const explanation = elementWithin(quiz, ".quiz-explanation");
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
      elementsWithin(quiz, "input[type='radio']").forEach((input) => {
        input.addEventListener("change", () => {
          const result = elementWithin(quiz, ".quiz-result");
          result.textContent = "";
          delete result.dataset.tone;
          elementWithin(quiz, ".quiz-explanation").hidden = true;
        });
      });
    });
    elements(".card-face").forEach((button) => {
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        const answer = elementWithin(button, ".card-answer");
        const label = elementWithin(button, "em");
        const actions = elementWithin(button.parentElement, ".card-actions");
        button.setAttribute("aria-expanded", String(!expanded));
        answer.hidden = expanded;
        actions.hidden = expanded;
        label.textContent = expanded ? "Reveal answer" : "Hide answer";
      });
    });
    elements("[data-rating]").forEach((button) => {
      button.addEventListener("click", () => {
        const card = (
          /** @type {HTMLElement | null} */
          button.closest("[data-card]")
        );
        state.cards[card.dataset.card] = button.dataset.rating;
        save();
        updateDeckStatus();
      });
    });
    elements("[data-complete]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.complete;
        state.completedLessons = state.completedLessons.includes(id) ? state.completedLessons.filter((entry) => entry !== id) : [...state.completedLessons, id];
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
})();
