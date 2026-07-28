"use client";

import { CodeEditor } from "@/app/features/ide/CodeEditor";

type PythonCodeEditorProps = {
  value: string;
  path: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
};

/**
 * Python files use the same reviewed editor primitive and React lifecycle as
 * every other project file. This wrapper remains as the existing lazy-loading
 * seam for the Python workspace.
 */
export function PythonCodeEditor({
  value,
  path,
  onChange,
  onSave,
  readOnly = false,
}: PythonCodeEditorProps) {
  return (
    <CodeEditor
      ariaLabel={`Python project file editor: ${path}`}
      onChange={onChange}
      onSave={onSave}
      path={path}
      readOnly={readOnly}
      value={value}
      variant="project"
    />
  );
}
