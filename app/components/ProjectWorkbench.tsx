"use client";

import { useEffect, useMemo, useState } from "react";
import { courseLessons } from "../lessons/course";
import { sampleCharacterRnn } from "../lib/lab-engines";
import { loadLearnerState, type SavedRnnArtifact } from "../lib/learner-state";
import {
  compileProject,
  ensureProjectWorkspace,
  saveProjectFile,
  saveProjectRuntime,
  selectProjectFile,
  useProjectState,
  type LessonProjectSeed,
  type ProjectCourse,
} from "../lib/project-workspace";

function lessonSeed(lesson: (typeof courseLessons)[number]): LessonProjectSeed {
  const local = loadLearnerState().lessons[lesson.id];
  const hidden = local?.hiddenBlocks ?? [];
  const answers = local?.answers ?? {};
  const contentFor = (usePractice: boolean) => lesson.implementation.codeBlocks
    .map((block, index) => `// ${String(index + 1).padStart(2, "0")} · ${block.label}\n${usePractice && hidden.includes(block.id) ? answers[block.id] ?? "" : block.code}`)
    .join("\n\n");
  return {
    path: `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`,
    courseId: lesson.courseId ?? "models",
    lessonId: lesson.id,
    title: lesson.title,
    content: contentFor(true),
    referenceContent: contentFor(false),
    verifiedCells: local?.verifiedCells.length ?? 0,
    totalCells: lesson.implementation.codeBlocks.length,
  };
}

const groups: Array<{ id: ProjectCourse; label: string }> = [
  { id: "runtime", label: "Runtime adapters" },
  { id: "models", label: "01 · Model" },
  { id: "systems", label: "02 · Platform" },
  { id: "product", label: "03 · React" },
];

export function ProjectWorkbench({ student }: { student: SavedRnnArtifact | null }) {
  const project = useProjectState();
  const selected = project.files[project.selectedPath];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("Edit a file, save it locally, then build the project.");

  useEffect(() => {
    ensureProjectWorkspace(courseLessons.map(lessonSeed));
  }, []);

  const filesByGroup = useMemo(() => groups.map((group) => ({
    ...group,
    files: Object.values(project.files).filter((file) => file.courseId === group.id).sort((left, right) => left.path.localeCompare(right.path)),
  })), [project.files]);
  const verifiedFiles = Object.values(project.files).filter((file) => file.lessonId && file.verifiedCells >= file.totalCells).length;
  const draft = selected ? drafts[selected.path] ?? selected.content : "";
  const dirty = Boolean(selected && draft !== selected.content);

  const save = () => {
    if (!selected) return project;
    const next = saveProjectFile(selected.path, draft);
    setDrafts((current) => ({ ...current, [selected.path]: draft }));
    setMessage(`${selected.path} saved on this device. Build to apply runtime changes.`);
    return next;
  };

  const build = () => {
    const saved = save();
    const result = compileProject(saved.files, saved.runtime);
    if (!result.ok) {
      setErrors(result.errors);
      setMessage("Build stopped. Fix the highlighted runtime contract and run again.");
      return;
    }
    setErrors([]);
    let nextPreview: string;
    if (student) {
      const generated = sampleCharacterRnn(
        student.checkpoint,
        "the signal crossed",
        result.runtime.model.maxTokens,
        result.runtime.model.temperature,
        result.runtime.model.seed,
        result.runtime.model.topK,
      );
      nextPreview = `${result.runtime.interface.responsePrefix}…the signal crossed${generated}`;
    } else {
      nextPreview = `${result.runtime.interface.responsePrefix}Build ready. Train the Course 01 model to generate a checkpoint-backed preview.`;
    }
    saveProjectRuntime(result.runtime, nextPreview);
    setMessage(`Build ${result.runtime.buildNumber} is active. New chat requests now use these files.`);
  };

  return (
    <section className="project-workbench" aria-label="Editable capstone project">
      <header>
        <div><span>Your project</span><strong>browser-chat/</strong></div>
        <p>Every lesson writes a source file here. The three runtime adapters compile into the live chatbot.</p>
        <div className="project-progress"><strong>{verifiedFiles}/14</strong><span>lesson files verified</span></div>
      </header>
      <div className="project-workbench-grid">
        <nav className="project-tree" aria-label="Project files">
          {filesByGroup.map((group) => (
            <section key={group.id}>
              <span>{group.label}</span>
              {group.files.map((file) => (
                <button className={file.path === project.selectedPath ? "active" : ""} type="button" onClick={() => { setErrors([]); selectProjectFile(file.path); }} key={file.path}>
                  <i className={file.lessonId && file.verifiedCells >= file.totalCells ? "verified" : file.lessonId ? "draft" : "runtime"} />
                  <span>{file.path.split("/").at(-1)}</span>
                  {file.lessonId ? <em>{file.verifiedCells}/{file.totalCells}</em> : <em>live</em>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="project-editor-panel">
          <header><div><span>{selected?.path ?? "No file selected"}</span><strong>{selected?.title}</strong></div><div><i className={dirty ? "dirty" : "saved"} />{dirty ? "Unsaved changes" : "Saved locally"}</div></header>
          <textarea aria-label="Project file editor" value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [project.selectedPath]: event.target.value }))} spellCheck="false" />
          <footer><p>{message}</p><div><button type="button" onClick={save} disabled={!dirty}>Save file</button><button className="build" type="button" onClick={build}>Build &amp; run</button></div></footer>
        </div>
        <aside className="project-output" aria-live="polite">
          <header><span>Build output</span><strong>#{project.runtime.buildNumber}</strong></header>
          {errors.length ? <div className="project-errors">{errors.map((error) => <p key={error}>{error}</p>)}</div> : (
            <>
              <dl>
                <div><dt>temperature</dt><dd>{project.runtime.model.temperature}</dd></div>
                <div><dt>top-k</dt><dd>{project.runtime.model.topK || "off"}</dd></div>
                <div><dt>event batch</dt><dd>{project.runtime.transport.wordsPerEvent} words</dd></div>
                <div><dt>assistant</dt><dd>{project.runtime.interface.assistantName}</dd></div>
              </dl>
              {project.output.previous ? <article><span>Previous build</span><p>{project.output.previous}</p></article> : null}
              <article className="active"><span>Active build</span><p>{project.output.current || "Run the project to create a checkpoint-backed preview."}</p></article>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
