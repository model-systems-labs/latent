export type HarnessLessonContentProvenance = {
  readonly prose: "course-authored";
  readonly diagrams: "course-authored";
  readonly exercises: "course-authored";
  readonly implementation: "independent-course-implementation";
  readonly dataset: "course-authored-synthetic";
  readonly reviewedAt: "2026-07-18";
  readonly note: string;
};

function authored(note: string): HarnessLessonContentProvenance {
  return Object.freeze({
    prose: "course-authored",
    diagrams: "course-authored",
    exercises: "course-authored",
    implementation: "independent-course-implementation",
    dataset: "course-authored-synthetic",
    reviewedAt: "2026-07-18",
    note,
  });
}

/**
 * The linked sources support terminology and design claims. Lesson prose,
 * diagrams, traces, fixtures, and Python implementations were written for this
 * course and do not incorporate source code or figures from those sources.
 */
export const harnessLessonContentProvenance = Object.freeze({
  "agent-loop": authored("Original response fixtures and state-machine diagram with an independently written parser and tool-result protocol."),
  "tool-contracts": authored("Original schemas and result-page fixtures with independently written argument validation and pagination logic."),
  "context-selection": authored("Original context-budget fixtures and diagrams with independently written priority selection and deterministic output compaction."),
  "permissions-and-sandboxes": authored("Original permission matrix and path fixtures with independently written lexical path containment and policy evaluation."),
  "state-and-recovery": authored("Original event-log fixtures and recovery trace with independently written idempotent replay and resume-state derivation."),
  "agent-evaluations": authored("Original outcome fixtures and trial simulation with independently written deterministic graders and probability metrics."),
  "task-orchestration": authored("Original dependency graph and worker fixtures with independently written topological batching and result collection."),
  "integrated-harness": authored("Original recorded adapter traces with an independently written composed host loop and protocol-state auditor."),
} satisfies Record<string, HarnessLessonContentProvenance>);

export function getHarnessLessonContentProvenance(lessonId: string): HarnessLessonContentProvenance {
  const provenance = harnessLessonContentProvenance[
    lessonId as keyof typeof harnessLessonContentProvenance
  ];
  if (!provenance) throw new Error(`Harness lesson ${lessonId} requires a content-provenance record.`);
  return provenance;
}
