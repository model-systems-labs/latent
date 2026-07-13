import type { CodeBlock } from "@latent/course-kit";

export type SourceBoundVerification = {
  ids: string[];
  sources: Record<string, string>;
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
): SourceBoundVerification {
  const ids = verifiedIds.filter((id) => {
    const block = blocks.find((candidate) => candidate.id === id);
    return Boolean(block && verifiedSources[id] === practiceBlockSource(block, hiddenBlocks, answers));
  });
  return { ids, sources: Object.fromEntries(ids.map((id) => [id, verifiedSources[id]])) };
}

export function invalidateBlockVerification(
  verification: SourceBoundVerification,
  blockId: string,
): SourceBoundVerification {
  return {
    ids: verification.ids.filter((id) => id !== blockId),
    sources: Object.fromEntries(Object.entries(verification.sources).filter(([id]) => id !== blockId)),
  };
}

export function bindBlockVerification(
  verification: SourceBoundVerification,
  blockId: string,
  source: string,
): SourceBoundVerification {
  return {
    ids: [...new Set([...verification.ids, blockId])],
    sources: { ...verification.sources, [blockId]: source },
  };
}
