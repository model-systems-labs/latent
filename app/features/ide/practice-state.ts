import type { CodeBlock } from "@latent/course-kit";

export type SourceBoundVerification = {
  ids: string[];
  sources: Record<string, string>;
  contractVersion: string | null;
};

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
    return Boolean(block && verifiedSources[id] === practiceBlockSource(block, hiddenBlocks, answers));
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
