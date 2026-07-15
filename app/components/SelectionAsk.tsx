"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SelectionAsk.module.css";

const MAX_SELECTION_LENGTH = 2_400;

type SelectionAnchor = {
  left: number;
  text: string;
  top: number;
};

type AskProvider = "claude" | "codex";

function elementFor(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
}

function normalizedSelection(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_SELECTION_LENGTH);
}

export function buildSelectionPrompt(lessonTitle: string, selectedText: string): string {
  const passage = normalizedSelection(selectedText);
  return [
    `I am studying the LLM systems lesson "${lessonTitle}".`,
    "",
    "Selected passage:",
    `“${passage}”`,
    "",
    "Explain this passage precisely. Define its notation and assumptions, connect it to the implementation, and distinguish what the passage establishes from broader claims. If context is missing, say what is missing instead of guessing.",
  ].join("\n");
}

export function selectionAskHref(provider: AskProvider, prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return provider === "claude"
    ? `https://claude.ai/new?q=${encoded}`
    : `codex://new?prompt=${encoded}`;
}

async function copyPrompt(prompt: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(prompt);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = prompt;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.appendChild(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("The browser declined clipboard access.");
}

export function SelectionAsk({ lessonTitle }: { lessonTitle: string }) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const [status, setStatus] = useState("");

  const prompt = useMemo(
    () => anchor ? buildSelectionPrompt(lessonTitle, anchor.text) : "",
    [anchor, lessonTitle],
  );

  useEffect(() => {
    const captureSelection = (event: Event) => {
      if (toolbarRef.current?.contains(event.target as Node)) return;

      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          setAnchor(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const start = elementFor(range.startContainer);
        const end = elementFor(range.endContainer);
        const startRoot = start?.closest("[data-selection-ask]");
        const endRoot = end?.closest("[data-selection-ask]");
        if (!startRoot || startRoot !== endRoot) {
          setAnchor(null);
          return;
        }

        const text = normalizedSelection(selection.toString());
        if (text.length < 2) {
          setAnchor(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        const toolbarWidth = 292;
        const left = Math.max(12, Math.min(rect.left + rect.width / 2 - toolbarWidth / 2, window.innerWidth - toolbarWidth - 12));
        const top = rect.bottom + 10 + 60 > window.innerHeight
          ? Math.max(12, rect.top - 58)
          : rect.bottom + 10;
        setStatus("");
        setAnchor({ left, text, top });
      });
    };

    const dismissForViewportChange = () => setAnchor(null);
    const dismissWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.getSelection()?.removeAllRanges();
      setAnchor(null);
      setStatus("");
    };

    document.addEventListener("mouseup", captureSelection);
    document.addEventListener("keyup", captureSelection);
    document.addEventListener("touchend", captureSelection);
    document.addEventListener("keydown", dismissWithKeyboard);
    window.addEventListener("resize", dismissForViewportChange);
    window.addEventListener("scroll", dismissForViewportChange, true);
    return () => {
      document.removeEventListener("mouseup", captureSelection);
      document.removeEventListener("keyup", captureSelection);
      document.removeEventListener("touchend", captureSelection);
      document.removeEventListener("keydown", dismissWithKeyboard);
      window.removeEventListener("resize", dismissForViewportChange);
      window.removeEventListener("scroll", dismissForViewportChange, true);
    };
  }, []);

  const prepareHandoff = (provider: AskProvider) => {
    const providerName = provider === "claude" ? "Claude" : "Codex";
    setStatus(`Opening ${providerName} and copying the prompt…`);
    void copyPrompt(prompt)
      .then(() => setStatus(`Prompt copied. Paste it if ${providerName} did not open.`))
      .catch(() => setStatus(`Opening ${providerName}. Clipboard access was unavailable.`));
  };

  const dismiss = () => {
    window.getSelection()?.removeAllRanges();
    setAnchor(null);
    setStatus("");
  };

  if (!anchor) return <span className={styles.status} role="status" aria-live="polite">{status}</span>;

  return (
    <>
      <div
        className={styles.toolbar}
        ref={toolbarRef}
        role="group"
        aria-label={`Ask about selected text: ${anchor.text.slice(0, 96)}`}
        style={{ left: anchor.left, top: anchor.top }}
      >
        <span className={styles.label}>Ask</span>
        <a aria-label="Open Claude in a browser and copy the prepared prompt" href={selectionAskHref("claude", prompt)} onClick={() => prepareHandoff("claude")} rel="noopener noreferrer" target="_blank">Claude</a>
        <a aria-label="Open in Codex and copy the prepared prompt" href={selectionAskHref("codex", prompt)} onClick={() => prepareHandoff("codex")}>Codex</a>
        <button type="button" aria-label="Close ask controls" onClick={dismiss}>×</button>
        {status ? <span className={styles.notice} role="status" aria-live="polite">{status}</span> : null}
      </div>
      {!status ? <span className={styles.status} role="status" aria-live="polite" /> : null}
    </>
  );
}
