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
  const updateDeckStatus = (announcedDeck = null) => {
    const decks = announcedDeck ? [announcedDeck] : document.querySelectorAll("[data-deck]");
    decks.forEach((deck) => {
      const cards = Array.from(deck.querySelectorAll("[data-card]"));
      const known = cards.filter((card) => state.cards[card.dataset.card] === "know").length;
      const status = deck.querySelector(".deck-status");
      if (status) {
        if (deck === announcedDeck) {
          status.setAttribute("role", "status");
          status.setAttribute("aria-live", "polite");
        }
        status.textContent = known + " of " + cards.length + " marked as known on this device.";
      }
      deck.querySelectorAll("[data-rating]").forEach((button) => {
        const card = button.closest("[data-card]");
        button.setAttribute("aria-pressed", String(state.cards[card.dataset.card] === button.dataset.rating));
      });
    });
  };
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
      updateDeckStatus(card.closest("[data-deck]"));
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
  updateCompleteButtons();
  updateDeckStatus();
})();
