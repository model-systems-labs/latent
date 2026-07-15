import type { CodeBlock } from "@latent/course-kit";

export type SourceBoundVerification = {
  ids: string[];
  sources: Record<string, string>;
  contractVersion: string | null;
};

export type PracticeDraftState = {
  hiddenBlocks: string[];
  answers: Record<string, string>;
  verification: SourceBoundVerification;
};

export type CompatiblePracticeDrafts = {
  hiddenBlocks: string[];
  answers: Record<string, string>;
  ignoredLegacyLanguage: boolean;
};

type PracticeSourceBlock = Pick<CodeBlock, "id" | "code" | "label">;

const JAVASCRIPT_DRAFT_MARKERS = [
  /\bfunction\s+[A-Za-z_$]/,
  /\b(?:const|let|var)\s+[A-Za-z_$]/,
  /=>/,
  /\bMath\.[A-Za-z]+/,
  /(?:===|!==)/,
];

export function practiceDraftIsCompatible(filename: string, source: string): boolean {
  return !filename.toLowerCase().endsWith(".py") || !JAVASCRIPT_DRAFT_MARKERS.some((marker) => marker.test(source));
}

/**
 * Produce the incomplete source a learner should encounter before they have a
 * saved draft. This is shared state policy, not presentation: lesson pages and
 * the canonical project must resolve an untouched cell to the same bytes.
 */
export function starterPracticeSource(filename: string, block: Pick<CodeBlock, "code" | "label">): string {
  if (filename.toLowerCase().endsWith(".py")) {
    const lines = block.code.split("\n");
    const definition = lines.findIndex((line) => line.startsWith("def "));
    if (definition < 0) {
      return `# TODO: implement ${block.label.toLowerCase()}.\nraise NotImplementedError(${JSON.stringify(`Implement ${block.label}.`)})`;
    }
    const prefix = lines.slice(0, definition).join("\n").trimEnd();
    const signature = lines[definition];
    return [prefix, `${signature}\n    raise NotImplementedError(${JSON.stringify(`Implement ${block.label}.`)})`]
      .filter(Boolean)
      .join("\n\n");
  }
  const signature = block.code.split("\n")[0];
  return `${signature}\n  // TODO: implement ${block.label.toLowerCase()}.\n}`;
}

/** Compatibility-shaped entrypoint for lesson components. */
export function starterCodeFor(
  block: Pick<CodeBlock, "code" | "label">,
  lesson: { implementation: { filename: string } },
) {
  return starterPracticeSource(lesson.implementation.filename, block);
}

/**
 * Resolve the stable working document for one cell. `answers` is deliberately
 * sparse and independent of the old hidden/reference UI state: both an active
 * legacy draft and a draft archived by "Restore reference" reopen as the exact
 * learner bytes. An incompatible pre-CPython save remains in `answers` for
 * recovery but is never injected into a Python editor.
 */
export function workingPracticeBlockSource(
  filename: string,
  block: PracticeSourceBlock,
  answers: Readonly<Record<string, string>>,
): string {
  const saved = Object.prototype.hasOwnProperty.call(answers, block.id)
    ? answers[block.id]
    : undefined;
  return saved !== undefined && practiceDraftIsCompatible(filename, saved)
    ? saved
    : starterPracticeSource(filename, block);
}

export function workingPracticeSources(
  filename: string,
  blocks: readonly PracticeSourceBlock[],
  answers: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(blocks.map((block) => [
    block.id,
    workingPracticeBlockSource(filename, block, answers),
  ]));
}

/**
 * A pre-CPython save may use the same lesson and block ids as the Python
 * curriculum. Keep those bytes in `answers` for recovery, but never inject
 * obvious JavaScript into a `.py` module during hydration.
 */
export function compatiblePracticeDrafts(
  filename: string,
  blocks: readonly Pick<CodeBlock, "id">[],
  hiddenBlocks: readonly string[],
  answers: Readonly<Record<string, string>>,
): CompatiblePracticeDrafts {
  const knownIds = new Set(blocks.map((block) => block.id));
  const hidden = hiddenBlocks.filter((id) => knownIds.has(id));
  const preservedAnswers = { ...answers };
  if (!filename.toLowerCase().endsWith(".py")) {
    return { hiddenBlocks: hidden, answers: preservedAnswers, ignoredLegacyLanguage: false };
  }
  const incompatible = new Set(blocks.flatMap((block) => (
    Object.prototype.hasOwnProperty.call(preservedAnswers, block.id)
      && !practiceDraftIsCompatible(filename, preservedAnswers[block.id])
      ? [block.id]
      : []
  )));
  return {
    hiddenBlocks: hidden.filter((id) => !incompatible.has(id)),
    answers: preservedAnswers,
    ignoredLegacyLanguage: incompatible.size > 0,
  };
}

export async function waitForPracticeHydration(
  projectHydration: Promise<unknown>,
  learnerHydration: Promise<unknown>,
) {
  await Promise.all([projectHydration, learnerHydration]);
}

export function practiceBlockSource(
  block: Pick<CodeBlock, "id" | "code">,
  hiddenBlocks: readonly string[],
  answers: Readonly<Record<string, string>>,
) {
  return hiddenBlocks.includes(block.id) ? answers[block.id] ?? "" : block.code;
}

export function restoreSourceBoundVerification(
  blocks: readonly Pick<CodeBlock, "id" | "code">[],
  hiddenBlocks: readonly string[],
  answers: Readonly<Record<string, string>>,
  verifiedIds: readonly string[],
  verifiedSources: Readonly<Record<string, string>>,
  verifiedContractVersion: string | null | undefined,
  currentContractVersion: string,
): SourceBoundVerification {
  if (verifiedContractVersion !== currentContractVersion) {
    return { ids: [], sources: {}, contractVersion: null };
  }
  const ids = verifiedIds.filter((id) => {
    const block = blocks.find((candidate) => candidate.id === id);
    return Boolean(
      block
      && hiddenBlocks.includes(id)
      && verifiedSources[id] === practiceBlockSource(block, hiddenBlocks, answers),
    );
  });
  return {
    ids,
    sources: Object.fromEntries(ids.map((id) => [id, verifiedSources[id]])),
    contractVersion: ids.length ? currentContractVersion : null,
  };
}

/** Restore receipts against the documents the learner is actually editing. */
export function restoreWorkingSourceVerification(
  blockIds: readonly string[],
  workingSources: Readonly<Record<string, string>>,
  verifiedIds: readonly string[],
  verifiedSources: Readonly<Record<string, string>>,
  verifiedContractVersion: string | null | undefined,
  currentContractVersion: string,
): SourceBoundVerification {
  if (verifiedContractVersion !== currentContractVersion) {
    return { ids: [], sources: {}, contractVersion: null };
  }
  const knownIds = new Set(blockIds);
  const ids = [...new Set(verifiedIds)].filter((id) => (
    knownIds.has(id)
    && Object.prototype.hasOwnProperty.call(workingSources, id)
    && verifiedSources[id] === workingSources[id]
  ));
  return {
    ids,
    sources: Object.fromEntries(ids.map((id) => [id, verifiedSources[id]])),
    contractVersion: ids.length ? currentContractVersion : null,
  };
}

export function invalidateBlockVerification(
  verification: SourceBoundVerification,
  blockId: string,
): SourceBoundVerification {
  return {
    ids: verification.ids.filter((id) => id !== blockId),
    sources: Object.fromEntries(Object.entries(verification.sources).filter(([id]) => id !== blockId)),
    contractVersion: verification.ids.some((id) => id !== blockId) ? verification.contractVersion : null,
  };
}

/**
 * Persist the learner's working document and invalidate only its old receipt.
 * `hiddenBlocks` is still populated for older consumers, but working-source
 * resolution no longer reads it.
 */
export function editPracticeBlock(
  state: PracticeDraftState,
  blockId: string,
  source: string,
): PracticeDraftState {
  return {
    hiddenBlocks: state.hiddenBlocks.includes(blockId)
      ? [...state.hiddenBlocks]
      : [...state.hiddenBlocks, blockId],
    answers: { ...state.answers, [blockId]: source },
    verification: invalidateBlockVerification(state.verification, blockId),
  };
}

export function resetPracticeBlock(
  state: PracticeDraftState,
  blockId: string,
  starterSource: string,
): PracticeDraftState {
  return editPracticeBlock(state, blockId, starterSource);
}

/** Restore the authored source while retaining the learner draft for recovery. */
export function restoreReferenceBlock(
  state: PracticeDraftState,
  blockId: string,
): PracticeDraftState {
  return {
    hiddenBlocks: state.hiddenBlocks.filter((id) => id !== blockId),
    answers: { ...state.answers },
    verification: invalidateBlockVerification(state.verification, blockId),
  };
}

export function bindBlockVerification(
  verification: SourceBoundVerification,
  blockId: string,
  source: string,
  currentContractVersion: string,
): SourceBoundVerification {
  const current = verification.contractVersion === currentContractVersion
    ? verification
    : { ids: [], sources: {}, contractVersion: null };
  return {
    ids: [...new Set([...current.ids, blockId])],
    sources: { ...current.sources, [blockId]: source },
    contractVersion: currentContractVersion,
  };
}

/**
 * Reference implementations remain runnable examples, but only source run from
 * an active practice cell can become learner verification.
 */
export function verificationAfterBlockRun(
  verification: SourceBoundVerification,
  blockId: string,
  source: string,
  hiddenBlocks: readonly string[],
  passed: boolean,
  currentContractVersion: string,
): SourceBoundVerification {
  if (!hiddenBlocks.includes(blockId)) return verification;
  return passed
    ? bindBlockVerification(verification, blockId, source, currentContractVersion)
    : invalidateBlockVerification(verification, blockId);
}

/** A working cell earns source-bound credit without any reveal/hide mode. */
export function verificationAfterWorkingSourceRun(
  verification: SourceBoundVerification,
  blockId: string,
  source: string,
  passed: boolean,
  currentContractVersion: string,
): SourceBoundVerification {
  return passed
    ? bindBlockVerification(verification, blockId, source, currentContractVersion)
    : invalidateBlockVerification(verification, blockId);
}

export function creditablePracticeBlockIds(
  blockIds: readonly string[],
  hiddenBlocks: readonly string[],
  passingBlockIds: readonly string[],
) {
  const hidden = new Set(hiddenBlocks);
  const passing = new Set(passingBlockIds);
  return blockIds.filter((id) => hidden.has(id) && passing.has(id));
}

export function creditableWorkingBlockIds(
  blockIds: readonly string[],
  passingBlockIds: readonly string[],
) {
  const passing = new Set(passingBlockIds);
  return blockIds.filter((id) => passing.has(id));
}
