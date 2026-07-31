(() => {
  "use strict";

  const root = document.querySelector(".attention-lab");
  const runButton = document.querySelector("#run-attention");
  const runButtonLabel = runButton?.querySelector("span:last-child");
  const status = document.querySelector("#lab-status");
  const errorPanel = document.querySelector("#lab-error");
  const errorDetail = document.querySelector("#lab-error-detail");
  const tabs = document.querySelector("#query-tabs");
  const matrixHead = document.querySelector("#matrix-head");
  const matrixBody = document.querySelector("#matrix-body");
  const detailPanel = document.querySelector("#query-detail");
  const queryPosition = document.querySelector("#query-position");
  const queryToken = document.querySelector("#query-token");
  const readableKeys = document.querySelector("#readable-keys");
  const maskedKeys = document.querySelector("#masked-keys");
  const rowTotal = document.querySelector("#row-total");
  const contextNorm = document.querySelector("#context-norm");
  const normTrack = document.querySelector("#norm-track");
  const normFill = document.querySelector("#norm-fill");
  const queryExplanation = document.querySelector("#query-explanation");

  let host = null;
  let input = null;
  let state = {
    hasRevealed: false,
    selectedQuery: 0,
    inspectedQueries: [],
    traceRuns: 0,
  };
  let saveSequence = 0;
  let replayTimer = 0;
  let completionRequestPending = false;
  let completionAccepted = false;

  function announce(message, tone = "neutral") {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function fail(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (errorDetail) errorDetail.textContent = message || "Reload the lesson and try again.";
    if (errorPanel) errorPanel.hidden = false;
    if (runButton) runButton.disabled = true;
    if (tabs) tabs.setAttribute("aria-busy", "false");
    announce("The interactive could not start.", "error");
  }

  function clampInteger(value, minimum, maximum, fallback = minimum) {
    if (!Number.isInteger(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeInput(candidate) {
    if (!candidate || typeof candidate !== "object") {
      throw new Error("The causal-attention input is missing.");
    }

    const tokens = Array.isArray(candidate.tokens)
      ? candidate.tokens.map((token) => typeof token === "string" ? token.trim() : "")
      : [];
    if (
      tokens.length < 2
      || tokens.length > 12
      || tokens.some((token) => token.length === 0 || token.length > 40)
    ) {
      throw new Error("The causal-attention token sequence is invalid.");
    }

    const size = tokens.length;
    if (
      !Array.isArray(candidate.attention)
      || candidate.attention.length !== size
      || candidate.attention.some((row) => !Array.isArray(row) || row.length !== size)
    ) {
      throw new Error("The attention matrix does not match the token sequence.");
    }

    const attention = candidate.attention.map((row, rowIndex) => row.map((raw, columnIndex) => {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 1.000001) {
        throw new Error("The attention matrix contains an invalid probability.");
      }
      if (columnIndex > rowIndex && Math.abs(value) > 1e-9) {
        throw new Error("A future position has a non-zero causal-attention weight.");
      }
      return Math.min(1, Math.max(0, value));
    }));
    if (attention.some((row) => Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) > 1e-4)) {
      throw new Error("An attention row does not normalize to one.");
    }

    if (
      !Array.isArray(candidate.contextNorms)
      || candidate.contextNorms.length !== size
      || candidate.contextNorms.some((raw) => !Number.isFinite(Number(raw)) || Number(raw) < 0)
    ) {
      throw new Error("The context magnitudes do not match the token sequence.");
    }

    return {
      tokens,
      attention,
      contextNorms: candidate.contextNorms.map(Number),
    };
  }

  function normalizeState(candidate, tokenCount) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const selectedQuery = clampInteger(source.selectedQuery, 0, tokenCount - 1, 0);
    const inspectedQueries = Array.isArray(source.inspectedQueries)
      ? [...new Set(source.inspectedQueries
        .filter((value) => Number.isInteger(value) && value >= 0 && value < tokenCount))]
      : [];
    const hasRevealed = source.hasRevealed === true;
    const traceRuns = clampInteger(
      source.traceRuns,
      0,
      Number.MAX_SAFE_INTEGER - 1,
      0,
    );
    if (hasRevealed && !inspectedQueries.includes(selectedQuery)) inspectedQueries.push(selectedQuery);
    return { hasRevealed, selectedQuery, inspectedQueries, traceRuns };
  }

  function snapshotState() {
    return {
      hasRevealed: state.hasRevealed,
      selectedQuery: state.selectedQuery,
      inspectedQueries: [...state.inspectedQueries],
      traceRuns: state.traceRuns,
    };
  }

  async function saveCurrentState() {
    if (!host) return false;
    const sequence = ++saveSequence;
    try {
      await host.saveState(snapshotState());
      return true;
    } catch {
      if (sequence === saveSequence) {
        announce("Your selection changed, but it could not be saved.", "error");
      }
      return false;
    }
  }

  async function record(event, payload) {
    try {
      await host?.record(event, payload);
    } catch {
      // Diagnostics must never interrupt the lesson.
    }
  }

  function createElement(name, options = {}) {
    const element = document.createElement(name);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = String(options.text);
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      if (value !== undefined && value !== null) element.setAttribute(name, String(value));
    }
    return element;
  }

  function weightClass(value) {
    return `heat-${Math.min(9, Math.max(0, Math.floor(value * 10)))}`;
  }

  function normClass(value) {
    const maximum = Math.max(...input.contextNorms, 1e-9);
    return `norm-${Math.min(10, Math.max(0, Math.round((value / maximum) * 10)))}`;
  }

  function tokenName(index) {
    return `“${input.tokens[index]}”`;
  }

  function buildTabs() {
    tabs.replaceChildren();

    input.tokens.forEach((token, index) => {
      const button = createElement("button", {
        className: "query-tab",
        attributes: {
          type: "button",
          role: "tab",
          id: `query-tab-${index}`,
          "aria-controls": "query-detail",
          "aria-selected": index === state.selectedQuery ? "true" : "false",
          tabindex: index === state.selectedQuery ? "0" : "-1",
        },
      });
      button.disabled = !state.hasRevealed;
      button.append(
        createElement("span", { text: `q${index + 1}` }),
        createElement("strong", { text: token }),
      );
      button.addEventListener("click", () => selectQuery(index, { focusTab: false }));
      button.addEventListener("keydown", (event) => onTabKeydown(event, index));
      tabs.append(button);
    });

    tabs.setAttribute("aria-busy", "false");
  }

  function onTabKeydown(event, index) {
    if (!state.hasRevealed) return;
    let next = index;
    if (event.key === "ArrowRight") {
      next = (index + 1) % input.tokens.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + input.tokens.length) % input.tokens.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = input.tokens.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectQuery(next, { focusTab: true });
  }

  function buildMatrix() {
    matrixHead.replaceChildren();
    matrixBody.replaceChildren();

    const headerRow = createElement("tr");
    headerRow.append(createElement("th", {
      text: "query ↓ / key →",
      attributes: { scope: "col" },
    }));
    input.tokens.forEach((token, index) => {
      const heading = createElement("th", { attributes: { scope: "col" } });
      heading.append(
        createElement("span", { text: `k${index + 1}` }),
        document.createTextNode(token),
      );
      headerRow.append(heading);
    });
    matrixHead.append(headerRow);

    input.attention.forEach((row, rowIndex) => {
      const tableRow = createElement("tr", {
        className: rowIndex === state.selectedQuery && state.hasRevealed ? "is-selected" : "",
        attributes: { "data-query-index": rowIndex },
      });
      const rowHeading = createElement("th", { attributes: { scope: "row" } });
      const selector = createElement("button", {
        className: "row-selector",
        attributes: {
          type: "button",
          "aria-label": `Inspect query ${tokenName(rowIndex)} at position ${rowIndex + 1}`,
          "aria-pressed": rowIndex === state.selectedQuery && state.hasRevealed ? "true" : "false",
        },
      });
      selector.disabled = !state.hasRevealed;
      selector.append(
        createElement("span", { text: `q${rowIndex + 1}` }),
        createElement("strong", { text: input.tokens[rowIndex] }),
      );
      selector.addEventListener("click", () => selectQuery(rowIndex, { focusTab: false }));
      rowHeading.append(selector);
      tableRow.append(rowHeading);

      row.forEach((value, columnIndex) => {
        const future = columnIndex > rowIndex;
        const pending = !state.hasRevealed;
        const cell = createElement("td", {
          className: pending
            ? "is-pending"
            : future
              ? "is-masked"
              : weightClass(value),
          text: pending ? "·" : future ? "—" : value.toFixed(2),
          attributes: {
            "aria-label": pending
              ? `Query ${tokenName(rowIndex)} to key ${tokenName(columnIndex)}: reveal the attention trace to inspect this value`
              : future
                ? `Query ${tokenName(rowIndex)} to key ${tokenName(columnIndex)}: masked future position`
                : `Query ${tokenName(rowIndex)} to key ${tokenName(columnIndex)}: attention weight ${value.toFixed(3)}`,
          },
        });
        tableRow.append(cell);
      });

      matrixBody.append(tableRow);
    });
  }

  function updateSelection() {
    const index = state.selectedQuery;
    const tabsList = [...tabs.querySelectorAll(".query-tab")];
    tabsList.forEach((tab, tabIndex) => {
      tab.setAttribute("aria-selected", tabIndex === index ? "true" : "false");
      tab.setAttribute("tabindex", tabIndex === index ? "0" : "-1");
      tab.disabled = !state.hasRevealed;
    });

    [...matrixBody.querySelectorAll("tr")].forEach((row, rowIndex) => {
      row.classList.toggle("is-selected", state.hasRevealed && rowIndex === index);
      const selector = row.querySelector(".row-selector");
      if (selector) {
        selector.disabled = !state.hasRevealed;
        selector.setAttribute(
          "aria-pressed",
          state.hasRevealed && rowIndex === index ? "true" : "false",
        );
      }
    });

    detailPanel.setAttribute("aria-labelledby", `query-tab-${index}`);
    queryPosition.textContent = `Position ${index + 1} of ${input.tokens.length}`;
    queryToken.textContent = input.tokens[index];

    if (!state.hasRevealed) {
      readableKeys.textContent = "—";
      maskedKeys.textContent = "—";
      rowTotal.textContent = "—";
      contextNorm.textContent = "—";
      normFill.className = "norm-0";
      normTrack.setAttribute("aria-label", "Context magnitude is not available until the attention trace is revealed");
      queryExplanation.textContent = "Reveal the attention trace to inspect the causal mask and probability rows.";
      return;
    }

    const readable = index + 1;
    const masked = input.tokens.length - readable;
    const total = input.attention[index].reduce((sum, value) => sum + value, 0);
    const norm = input.contextNorms[index];
    readableKeys.textContent = `${readable} of ${input.tokens.length}`;
    maskedKeys.textContent = String(masked);
    rowTotal.textContent = total.toFixed(3);
    contextNorm.textContent = norm.toFixed(3);
    normFill.className = normClass(norm);
    normTrack.setAttribute("aria-label", `Context magnitude ${norm.toFixed(3)}`);
    queryExplanation.textContent = masked
      ? `${tokenName(index)} can read ${readable === 1 ? "only itself" : `itself and ${readable - 1} earlier ${readable - 1 === 1 ? "token" : "tokens"}`}. The ${masked} later ${masked === 1 ? "position is" : "positions are"} zeroed before softmax.`
      : `${tokenName(index)} is the final query, so every position is available. Its visible probability weights still normalize to one.`;
  }

  function render() {
    buildTabs();
    buildMatrix();
    updateSelection();
    root.dataset.ready = "true";
    runButton.disabled = false;
    runButtonLabel.textContent = state.hasRevealed ? "Replay attention trace" : "Reveal attention trace";
  }

  function selectQuery(index, { focusTab }) {
    if (!state.hasRevealed || completionRequestPending) return;
    state.selectedQuery = clampInteger(index, 0, input.tokens.length - 1, 0);
    if (!state.inspectedQueries.includes(state.selectedQuery)) {
      state.inspectedQueries.push(state.selectedQuery);
    }
    const shouldRequestCompletion = (
      !completionAccepted
      && state.inspectedQueries.length >= 2
    );
    if (shouldRequestCompletion) completionRequestPending = true;
    updateSelection();

    if (focusTab) {
      tabs.querySelector(`#query-tab-${state.selectedQuery}`)?.focus();
    }

    const readable = state.selectedQuery + 1;
    announce(
      state.inspectedQueries.length >= 2
        ? `Compared query ${tokenName(state.selectedQuery)}: it can read ${readable} of ${input.tokens.length} positions.`
        : `Query ${tokenName(state.selectedQuery)} can read ${readable} of ${input.tokens.length} positions. Inspect one different query to compare the mask.`,
      "complete",
    );
    void persistSelection(readable, shouldRequestCompletion);
  }

  async function persistSelection(readable, shouldRequestCompletion) {
    const selectedQuery = state.selectedQuery;
    const inspectedQueries = [...state.inspectedQueries];
    const saved = await saveCurrentState();
    await record("causal-attention-query-selected", {
      queryIndex: selectedQuery,
      token: input.tokens[selectedQuery],
      readablePositions: readable,
    });

    if (
      !saved
      || !shouldRequestCompletion
    ) {
      completionRequestPending = false;
      return;
    }

    try {
      await host.requestCompletion("causal-attention-comparison", {
        tokenCount: input.tokens.length,
        selectedQuery,
        inspectedQueries,
      });
      completionAccepted = true;
      announce("Two query rows compared. The lesson accepted the experiment evidence.", "complete");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("valid completion evidence")) {
        announce(
          "Replay the attention trace, then compare one other query to record completion.",
          "neutral",
        );
      } else {
        announce(
          "The comparison is visible, but progress could not be saved. Choose another query to retry.",
          "error",
        );
      }
    } finally {
      completionRequestPending = false;
    }
  }

  function playReveal() {
    window.clearTimeout(replayTimer);
    root.classList.remove("is-replaying");
    window.requestAnimationFrame(() => {
      root.classList.add("is-replaying");
      replayTimer = window.setTimeout(() => root.classList.remove("is-replaying"), 900);
    });
  }

  async function revealAttentionTrace() {
    if (!host || !input || runButton.disabled) return;
    const firstReveal = !state.hasRevealed;
    runButton.disabled = true;

    state.hasRevealed = true;
    state.traceRuns += 1;
    state.inspectedQueries = [state.selectedQuery];
    render();
    runButton.disabled = true;
    playReveal();

    const saved = await saveCurrentState();
    await record(firstReveal ? "causal-attention-trace-revealed" : "causal-attention-replay", {
      tokenCount: input.tokens.length,
      selectedQuery: state.selectedQuery,
    });
    if (saved) {
      announce(
        firstReveal
          ? "Attention trace revealed. Inspect one different query to compare how the readable prefix changes."
          : "Attention trace replayed. Inspect one different query to make a fresh comparison.",
        "complete",
      );
    }

    runButton.disabled = false;
  }

  async function initialize() {
    if (!root || !runButton || !tabs || !matrixHead || !matrixBody) {
      throw new Error("The causal-attention interface markup is incomplete.");
    }
    if (!window.Latent || typeof window.Latent.connect !== "function") {
      throw new Error("The Latent lesson connection is unavailable.");
    }

    host = await window.Latent.connect();
    for (const method of ["saveState", "record", "requestCompletion"]) {
      if (!host || typeof host[method] !== "function") {
        throw new Error(`The Latent ${method} capability is unavailable.`);
      }
    }

    input = normalizeInput(host.input);
    state = normalizeState(host.state, input.tokens.length);
    render();
    announce(
      state.hasRevealed
        ? `Restored query ${tokenName(state.selectedQuery)} from your saved lesson state.`
        : "Ready. Reveal the fixed attention trace to inspect the matrix.",
      state.hasRevealed ? "complete" : "neutral",
    );
  }

  runButton?.addEventListener("click", () => {
    void revealAttentionTrace().catch(fail);
  });

  void initialize().catch(fail);
})();
