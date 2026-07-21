"use client";

import Link from "next/link";
import {
  SITE_COPY_FIELD_BY_KEY,
  SITE_COPY_KEYS,
  type SiteCopyKey,
  type SiteCopyValues,
} from "../content/site-copy";
import styles from "../page.module.css";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type StoredCopyResponse = {
  copy?: Partial<Record<SiteCopyKey, string>>;
  error?: string;
};

type EditableCopyContextValue = {
  editing: boolean;
  values: SiteCopyValues;
  setEditing: (editing: boolean) => void;
  setValue: (key: SiteCopyKey, value: string) => void;
  saveNow: () => void;
  status: string;
};

const EditableCopyContext = createContext<EditableCopyContextValue | null>(null);

function useEditableCopy() {
  const context = useContext(EditableCopyContext);
  if (!context) throw new Error("Editable homepage text must be rendered inside HomepageCopyProvider.");
  return context;
}

function dirtyKeys(values: SiteCopyValues, savedValues: SiteCopyValues) {
  return SITE_COPY_KEYS.filter((key) => values[key] !== savedValues[key]);
}

function storedCopyFromResponse(data: StoredCopyResponse) {
  const stored: Partial<SiteCopyValues> = {};
  for (const key of SITE_COPY_KEYS) {
    const value = data.copy?.[key];
    if (typeof value === "string") stored[key] = value;
  }
  return stored;
}

export function HomepageCopyProvider({
  defaults,
  children,
}: {
  defaults: SiteCopyValues;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<SiteCopyValues>(defaults);
  const [savedValues, setSavedValues] = useState<SiteCopyValues>(defaults);
  const [status, setStatus] = useState("Loading saved text");
  const touchedKeysRef = useRef(new Set<SiteCopyKey>());
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/site-copy", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as StoredCopyResponse;
        if (!response.ok) throw new Error(data.error ?? "Saved text could not be loaded.");
        const stored = storedCopyFromResponse(data);
        const nextSaved = { ...defaults, ...stored };
        setSavedValues(nextSaved);
        setValues((current) => {
          const next = { ...nextSaved };
          for (const key of touchedKeysRef.current) next[key] = current[key];
          return next;
        });
        setStatus("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("Saved text is unavailable");
      });

    return () => controller.abort();
  }, [defaults]);

  const saveEdits = useCallback(
    async (keys: SiteCopyKey[], snapshot: SiteCopyValues) => {
      if (!keys.length || saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setStatus("Saving");

      const edits = Object.fromEntries(keys.map((key) => [key, snapshot[key]])) as Partial<SiteCopyValues>;

      try {
        const response = await fetch("/api/site-copy", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ edits }),
        });
        const data = (await response.json()) as StoredCopyResponse;
        if (!response.ok) throw new Error(data.error ?? "The text could not be saved.");
        setSavedValues((current) => ({ ...current, ...edits }));
        setStatus("Saved");
      } catch {
        setStatus("Save failed");
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [],
  );

  const dirty = useMemo(() => dirtyKeys(values, savedValues), [values, savedValues]);
  const visibleStatus =
    dirty.length && status !== "Saving" && status !== "Save failed"
      ? "Unsaved changes"
      : status;

  useEffect(() => {
    if (!dirty.length) return;
    const timer = window.setTimeout(() => {
      void saveEdits(dirty, values);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, saveEdits, values]);

  const saveNow = useCallback(() => {
    const keys = dirtyKeys(values, savedValues);
    if (keys.length) void saveEdits(keys, values);
  }, [saveEdits, savedValues, values]);

  const context = useMemo<EditableCopyContextValue>(
    () => ({
      editing,
      values,
      setEditing,
      setValue(key, value) {
        touchedKeysRef.current.add(key);
        setValues((current) => ({ ...current, [key]: value }));
      },
      saveNow,
      status: visibleStatus,
    }),
    [editing, saveNow, values, visibleStatus],
  );

  return (
    <EditableCopyContext.Provider value={context}>
      {children}
      <div className={styles.copyToolbar}>
        <button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Edit text"}
        </button>
        <span role="status" aria-live="polite">{status || (editing ? "Autosaves" : "Saved")}</span>
      </div>
    </EditableCopyContext.Provider>
  );
}

export function EditableText({
  as: Component = "span",
  copyKey,
  fallback,
  id,
  className,
  describedBy,
}: {
  as?: "h1" | "h2" | "p" | "span" | "strong";
  copyKey: SiteCopyKey;
  fallback: string;
  id?: string;
  className?: string;
  describedBy?: string;
}) {
  const { editing, values, setValue, saveNow } = useEditableCopy();
  const field = SITE_COPY_FIELD_BY_KEY[copyKey];
  const value = values[copyKey] ?? fallback;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [editing, value]);

  if (!editing) {
    return (
      <Component id={id} className={className} data-site-copy-key={copyKey}>
        {value}
      </Component>
    );
  }

  return (
    <Component
      id={id}
      className={className}
      data-site-copy-editing="true"
      data-site-copy-inline={Component === "span" || Component === "strong" ? "true" : undefined}
      data-site-copy-key={copyKey}
    >
      <textarea
        ref={inputRef}
        aria-describedby={describedBy}
        aria-label={`Edit ${field.label}`}
        className={styles.copyInput}
        maxLength={field.maxLength}
        rows={field.multiline ? 2 : 1}
        value={value}
        onBlur={saveNow}
        onChange={(event) => setValue(copyKey, event.target.value)}
      />
    </Component>
  );
}

export function EditableHomepageLink({
  href,
  className,
  copyKey,
  fallback,
  arrow = false,
}: {
  href: string;
  className: string;
  copyKey: SiteCopyKey;
  fallback: string;
  arrow?: boolean;
}) {
  const { editing } = useEditableCopy();
  const content = (
    <>
      <EditableText as="span" copyKey={copyKey} fallback={fallback} />
      {arrow ? <span aria-hidden="true">→</span> : null}
    </>
  );

  if (editing) {
    return (
      <span className={className} role="group" aria-label="Editable link label">
        {content}
      </span>
    );
  }

  return <Link className={className} href={href}>{content}</Link>;
}
