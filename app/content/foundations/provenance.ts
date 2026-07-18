export type FoundationLessonContentProvenance = {
  readonly prose: "course-authored";
  readonly diagrams: "course-authored";
  readonly exercises: "course-authored";
  readonly implementation: "independent-course-implementation";
  readonly dataset: "course-authored-synthetic";
  readonly reviewedAt: "2026-07-18";
  readonly note: string;
};

function authored(note: string): FoundationLessonContentProvenance {
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
 * Origin record for the two stand-alone prerequisite courses. Their linked
 * guides and specifications support mathematical facts and API behavior; no
 * source prose, figures, datasets, or implementation code is incorporated.
 */
export const foundationLessonContentProvenance = Object.freeze({
  "arrays-and-shapes": authored("Original small-array examples, shape diagram, and NumPy implementation with independently written validation for reshape requests."),
  "vector-operations": authored("Original coordinate examples and diagrams with independently written NumPy implementations of vector addition and the L2 norm."),
  "dot-products": authored("Original alignment examples and visual explanation with independently written dot-product and cosine-similarity implementations."),
  "matrix-multiplication": authored("Original matrix fixtures and layer example with independently written matrix-vector and dense-layer shape validation."),
  "batches-and-broadcasting": authored("Original batched-array fixtures and diagrams with independently written bias-broadcasting and batched-linear implementations."),
  "ml-training-data": authored("Original labeled-table fixture and split diagram with independently written feature extraction and disjoint holdout logic."),
  "ml-linear-regression": authored("Original regression examples and prediction diagram with independently written linear-prediction and mean-squared-error implementations."),
  "ml-gradient-descent": authored("Original regression fixture and update trace with independently derived gradient and parameter-update implementations."),
  "ml-binary-classification": authored("Original binary examples and probability diagram with independently written numerically stable sigmoid and cross-entropy implementations."),
  "ml-neural-networks": authored("Original small-network parameters and forward-pass diagram with independently written ReLU and dense-ReLU-dense implementations."),
} satisfies Record<string, FoundationLessonContentProvenance>);

export function getFoundationLessonContentProvenance(lessonId: string): FoundationLessonContentProvenance {
  const provenance = foundationLessonContentProvenance[
    lessonId as keyof typeof foundationLessonContentProvenance
  ];
  if (!provenance) throw new Error(`Foundation lesson ${lessonId} requires a content-provenance record.`);
  return provenance;
}
