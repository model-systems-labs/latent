"use client";

import type { CourseLesson } from "@latent/course-kit";
import {
  applyLessonCopy,
  lessonCopyDefaults,
  lessonCopyFields,
  normalizeLessonCopyValue,
  type EditableLessonDocument,
  type LessonCopyValues,
} from "../content/lesson-copy";
import type { LessonLearningOutcome } from "../content/llm-systems/learning";
import { PaperLab } from "./PaperLab";
import styles from "./LessonCopyEditor.module.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type LessonCopyResponse = {
  copy?: Record<string, string>;
  error?: string;
};

function dirtyPaths(values: LessonCopyValues, savedValues: LessonCopyValues) {
  return Object.keys(values).filter((path) => values[path] !== savedValues[path]);
}

function copyFromResponse(data: LessonCopyResponse, defaults: LessonCopyValues) {
  const copy: LessonCopyValues = {};
  for (const path of Object.keys(defaults)) {
    const value = data.copy?.[path];
    if (typeof value === "string") copy[path] = value;
  }
  return copy;
}

export function LessonCopyEditor({
  lesson,
  outcome,
}: {
  lesson: CourseLesson;
  outcome: LessonLearningOutcome;
}) {
  const document = useMemo<EditableLessonDocument>(() => ({ lesson, outcome }), [lesson, outcome]);
  const fields = useMemo(() => lessonCopyFields(document), [document]);
  const defaults = useMemo(() => lessonCopyDefaults(document), [document]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<LessonCopyValues>(defaults);
  const [savedValues, setSavedValues] = useState<LessonCopyValues>(defaults);
  const [status, setStatus] = useState("Loading saved text");
  const [codingVisible, setCodingVisible] = useState(false);
  const touchedPathsRef = useRef(new Set<string>());
  const valuesRef = useRef(values);
  const savedValuesRef = useRef(savedValues);
  const saveRunningRef = useRef(false);
  const saveQueuedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/lesson-copy?lessonId=${encodeURIComponent(lesson.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as LessonCopyResponse;
        if (!response.ok) throw new Error(data.error ?? "Saved lesson text could not be loaded.");
        const stored = copyFromResponse(data, defaults);
        const nextSaved = { ...defaults, ...stored };
        savedValuesRef.current = nextSaved;
        setSavedValues(nextSaved);
        setValues((current) => {
          const next = { ...nextSaved };
          for (const path of touchedPathsRef.current) next[path] = current[path];
          valuesRef.current = next;
          return next;
        });
        setStatus("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("Saved lesson text is unavailable");
      });

    return () => controller.abort();
  }, [defaults, lesson.id]);

  useEffect(() => {
    const codingSection = globalThis.document.getElementById("implementation");
    if (!codingSection || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCodingVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(codingSection);
    return () => observer.disconnect();
  }, [lesson.id]);

  const persistLatest = useCallback(async () => {
    if (saveRunningRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveRunningRef.current = true;
    try {
      do {
        saveQueuedRef.current = false;
        const snapshot = valuesRef.current;
        const paths = dirtyPaths(snapshot, savedValuesRef.current);
        if (!paths.length) break;
        const edits = Object.fromEntries(paths.map((path) => [path, snapshot[path]]));
        setStatus("Saving");

        const response = await fetch("/api/lesson-copy", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, edits }),
        });
        const data = (await response.json()) as LessonCopyResponse;
        if (!response.ok) throw new Error(data.error ?? "The lesson text could not be saved.");

        const nextSaved = { ...savedValuesRef.current, ...edits };
        savedValuesRef.current = nextSaved;
        setSavedValues(nextSaved);
        setStatus("Saved");
      } while (saveQueuedRef.current || dirtyPaths(valuesRef.current, savedValuesRef.current).length);
    } catch {
      setStatus("Save failed");
    } finally {
      saveRunningRef.current = false;
    }
  }, [lesson.id]);

  const dirty = useMemo(() => dirtyPaths(values, savedValues), [savedValues, values]);
  useEffect(() => {
    if (!dirty.length) return;
    const timer = window.setTimeout(() => void persistLatest(), 800);
    return () => window.clearTimeout(timer);
  }, [dirty, persistLatest, values]);

  const editedDocument = useMemo(() => applyLessonCopy(document, values), [document, values]);
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof fields>();
    for (const field of fields) {
      const existing = grouped.get(field.group) ?? [];
      existing.push(field);
      grouped.set(field.group, existing);
    }
    return [...grouped.entries()];
  }, [fields]);
  const visibleStatus = dirty.length && status !== "Saving" && status !== "Save failed"
    ? "Unsaved changes"
    : status || "Saved";
  const showToolbarStatus = dirty.length > 0 || [
    "Loading saved text",
    "Saved lesson text is unavailable",
    "Saving",
    "Save failed",
  ].includes(status);

  const closeEditor = () => {
    void persistLatest();
    setOpen(false);
  };

  return (
    <>
      <PaperLab lesson={editedDocument.lesson} outcome={editedDocument.outcome} />
      {!open && !codingVisible ? (
        <div className={styles.toolbar}>
          <button type="button" aria-expanded="false" aria-controls="lesson-copy-panel" onClick={() => setOpen(true)}>
            Edit lesson
          </button>
          {showToolbarStatus ? <span role="status" aria-live="polite">{visibleStatus}</span> : null}
        </div>
      ) : null}
      {open ? (
        <aside className={styles.panel} id="lesson-copy-panel" aria-label={`Edit ${editedDocument.lesson.title}`}>
          <header>
            <div>
              <span>Lesson editor</span>
              <h2>{editedDocument.lesson.title}</h2>
            </div>
            <button type="button" onClick={closeEditor}>Done</button>
          </header>
          <p className={styles.saveStatus} role="status" aria-live="polite">{visibleStatus}</p>
          <div className={styles.fields}>
            {groups.map(([group, groupFields]) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {groupFields.map((field) => (
                  <label key={field.path}>
                    <span>{field.label}</span>
                    <textarea
                      maxLength={field.maxLength}
                      rows={field.multiline ? 4 : 1}
                      value={values[field.path] ?? field.value}
                      onBlur={() => void persistLatest()}
                      onChange={(event) => {
                        const nextValue = normalizeLessonCopyValue(field, event.target.value);
                        touchedPathsRef.current.add(field.path);
                        setValues((current) => {
                          const next = { ...current, [field.path]: nextValue };
                          valuesRef.current = next;
                          return next;
                        });
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </aside>
      ) : null}
    </>
  );
}
