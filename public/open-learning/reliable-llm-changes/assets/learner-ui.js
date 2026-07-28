(() => {
  "use strict";
  const solutionNote = "Compare the control flow and boundary cases with your draft. Opening this reference does not replace your work or update progress.";
  const preparedCodeEditors = new WeakMap();
  let editorInstructionSequence = 0;
  const componentText = (value, label, maximum) => {
    if (
      typeof value !== "string"
      || value.trim().length === 0
      || value.length > maximum
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
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
      : value.lastIndexOf("\n", selectionStart - 1) + 1;
    const effectiveEnd = (
      selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
        ? selectionEnd - 1
        : selectionEnd
    );
    const lineStarts = [firstLineStart];
    let scanFrom = firstLineStart;
    while (scanFrom < effectiveEnd) {
      const newline = value.indexOf("\n", scanFrom);
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
        } else if (value[indentEnd] === "\t") {
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
      value: Object.freeze({ createSolutionDisclosure, prepareCodeEditor }),
      writable: false,
    });
  }
  const compact = globalThis.matchMedia("(max-width: 760px), (max-height: 500px)");
  const stacked = globalThis.matchMedia("(max-width: 980px)");
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
