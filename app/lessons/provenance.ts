export type LessonContentProvenance = {
  readonly prose: "course-authored";
  readonly diagrams: "course-authored";
  readonly exercises: "course-authored";
  readonly implementation: "independent-course-implementation";
  readonly dataset: "course-authored-synthetic";
  readonly reviewedAt: "2026-07-17";
  readonly note: string;
};

function authored(note: string): LessonContentProvenance {
  return Object.freeze({
    prose: "course-authored",
    diagrams: "course-authored",
    exercises: "course-authored",
    implementation: "independent-course-implementation",
    dataset: "course-authored-synthetic",
    reviewedAt: "2026-07-17",
    note,
  });
}

/**
 * Reviewable origin record for every lesson. The linked papers, standards, and
 * repositories establish facts, equations, interfaces, and prior work; they are
 * not copied into the course. Add an explicit adaptation and license notice here
 * before incorporating third-party prose, figures, datasets, or source code.
 */
export const lessonContentProvenance = Object.freeze({
  "character-rnns": authored("Original signal corpus and explanation. The full trainer uses independently structured fixed windows and Adam; checkpoint field names preserve standard RNN notation."),
  "neural-language-models": authored("Original roles-and-actions corpus and a smaller mean-embedding model derived from the standard probability objective, not from tutorial source code."),
  "subword-tokenization": authored("Original morphology corpus and signaling examples. The array-based merge implementation is independently written from the published BPE algorithm."),
  "additive-attention": authored("Original date-reordering fixture and NumPy implementation of the published additive-score equation."),
  transformers: authored("Original causal-sequence fixture and NumPy implementation. No Annotated Transformer code, prose, or figures are incorporated."),
  "in-context-learning": authored("Original opaque-label evaluation prompts and course-authored local-model harness."),
  "inference-runtime": authored("Original request timeline, memory arithmetic exercises, and serving simulation."),
  "streaming-transport": authored("Original typed-event contract and adversarial stream fixture built from the public SSE and Streams specifications."),
  "scheduling-memory": authored("Original request workload and scheduler simulation informed by published serving-system mechanisms."),
  "reliability-observability": authored("Original failure traces and retry policy. Established monitoring terminology is credited in the lesson sources."),
  "conversation-state": authored("Original normalized chat schema, reducer exercises, and event log."),
  "streaming-react": authored("Original render trace and course-specific batching, scrolling, and announcement heuristics."),
  "chat-actions-context": authored("Original branching scenario, token-budget policy, and context-selection implementation."),
  "chat-product-quality": authored("Original product contract, persistence limits, and executable checklist; standards supply only the cited accessibility semantics."),
} satisfies Record<string, LessonContentProvenance>);

export function getLessonContentProvenance(lessonId: string): LessonContentProvenance {
  const provenance = lessonContentProvenance[lessonId as keyof typeof lessonContentProvenance];
  if (!provenance) throw new Error(`Lesson ${lessonId} requires a content-provenance record.`);
  return provenance;
}
