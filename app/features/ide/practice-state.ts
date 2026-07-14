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

const JAVASCRIPT_DRAFT_MARKERS = [
  /\bfunction\s+[A-Za-z_$]/,
  /\b(?:const|let|var)\s+[A-Za-z_$]/,
  /=>/,
  /\bMath\.[A-Za-z]+/,
  /(?:===|!==)/,
];

export function practiceDraftIsCompatible(filename: string, source: string): boolean {
  return !filename.endsWith(".py") || !JAVASCRIPT_DRAFT_MARKERS.some((marker) => marker.test(source));
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
  if (!filename.endsWith(".py")) {
    return { hiddenBlocks: hidden, answers: preservedAnswers, ignoredLegacyLanguage: false };
  }
  const ignoredLegacyLanguage = hidden.some((id) => !practiceDraftIsCompatible(filename, preservedAnswers[id] ?? ""));
  return {
    hiddenBlocks: ignoredLegacyLanguage ? [] : hidden,
    answers: preservedAnswers,
    ignoredLegacyLanguage,
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
 * Turn a reference cell into a learner draft without throwing away the text
 * that was visible when the learner started typing.
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

export function creditablePracticeBlockIds(
  blockIds: readonly string[],
  hiddenBlocks: readonly string[],
  passingBlockIds: readonly string[],
) {
  const hidden = new Set(hiddenBlocks);
  const passing = new Set(passingBlockIds);
  return blockIds.filter((id) => hidden.has(id) && passing.has(id));
}
