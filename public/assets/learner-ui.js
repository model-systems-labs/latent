(() => {
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
    staleMessage = "Source changed. Run this input again.",
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
      staleMessage: componentText(staleMessage, "Example stale message", 160).trim(),
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
      invalidate(message = labels.staleMessage) {
        const trustedMessage = componentText(
          message,
          "Example stale message",
          160,
        ).trim();
        revision += 1;
        activeRun?.controller.abort();
        for (const record of records) {
          if (!record.status.textContent) continue;
          record.status.dataset.tone = "warning";
          record.status.textContent = trustedMessage;
        }
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
  const normalizedRunModes = (onRun, value) => {
    if (!onRun) return [];
    const modes = value === undefined ? ["examples", "check"] : value;
    if (
      !Array.isArray(modes)
      || modes.length === 0
      || modes.length > 2
      || modes.some((mode) => mode !== "examples" && mode !== "check")
      || new Set(modes).size !== modes.length
    ) {
      throw new Error(
        "Shared code editor runModes must contain unique examples and/or check modes.",
      );
    }
    return [...modes];
  };
  const editorInstruction = (tabSize, language, runModes) => (
    (language === "python"
      ? "Python code editor. "
      : "Code editor. ")
    + "Tab indents " + tabSize
    + " spaces; Shift+Tab outdents. Press Escape, then Tab, to leave the editor."
    + (runModes.includes("check") && runModes.includes("examples")
      ? " Press Command or Control plus Enter to check; add Shift to run examples."
      : runModes.includes("check")
        ? " Press Command or Control plus Enter to run the current check."
        : runModes.includes("examples")
          ? " Press Command or Control plus Shift plus Enter to run examples."
          : "")
  );
  const editorShortcuts = ({ onSave, runModes }) => [
    "Tab",
    "Shift+Tab",
    "Escape",
    ...(onSave ? ["Control+S", "Meta+S"] : []),
    ...(runModes.includes("check")
      ? [
          "Control+Enter",
          "Meta+Enter",
        ]
      : []),
    ...(runModes.includes("examples")
      ? [
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
      runModes: requestedRunModes,
      tabSize: requestedTabSize = 2,
    } = {},
  ) => {
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error("The shared code editor adapter requires a textarea.");
    }
    const tabSize = normalizedTabSize(requestedTabSize);
    const language = normalizedEditorLanguage(requestedLanguage);
    const runHandler = typeof onRun === "function" ? onRun : null;
    const configuration = {
      language,
      onRun: runHandler,
      onSave: typeof onSave === "function" ? onSave : null,
      runModes: normalizedRunModes(runHandler, requestedRunModes),
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
        configuration.runModes,
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
      configuration.runModes,
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
        const mode = event.shiftKey ? "examples" : "check";
        if (current.runModes.includes(mode)) current.onRun(mode);
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
