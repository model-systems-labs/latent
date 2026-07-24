import type { CodeBlock } from "@latent/course-kit";
import { pythonLanguage } from "@codemirror/lang-python";

export type PracticeRound = 1 | 2 | 3;

export type PracticeRoundMetadata = {
  id: PracticeRound;
  label: string;
  description: string;
  required: boolean;
};

export const PRACTICE_ROUNDS = [
  {
    id: 1,
    label: "Guided",
    description: "Fill a few focused gaps while most of the implementation stays visible.",
    required: true,
  },
  {
    id: 2,
    label: "Less help",
    description: "Rebuild more of the implementation with fewer cues.",
    required: false,
  },
  {
    id: 3,
    label: "From scratch",
    description: "Start from the imports and callable contract.",
    required: false,
  },
] as const satisfies readonly PracticeRoundMetadata[];

export type PracticeRepetitionState = {
  answers: Record<string, string>;
  verifiedSources: Record<string, string>;
  verifiedContractVersion: string | null;
};

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

type PracticeSourceBlock = Pick<CodeBlock, "id" | "code" | "label" | "starterCode">;

type PythonSyntaxNode = {
  name: string;
  from: number;
  to: number;
  firstChild: PythonSyntaxNode | null;
  nextSibling: PythonSyntaxNode | null;
};

type SourceReplacement = {
  from: number;
  to: number;
  value: string;
};

type PracticeStatement = {
  node: PythonSyntaxNode;
  expression: { from: number; to: number } | null;
};

const JAVASCRIPT_DRAFT_MARKERS = [
  /\bfunction\s+[A-Za-z_$]/,
  /\b(?:const|let|var)\s+[A-Za-z_$]/,
  /=>/,
  /\bMath\.[A-Za-z]+/,
  /(?:===|!==)/,
];

const PROVIDED_PYTHON_STARTER_POSTLUDE = "# Provided browser adapter.";

const SIMPLE_PYTHON_STATEMENTS = new Set([
  "AssertStatement",
  "AssignStatement",
  "BreakStatement",
  "ContinueStatement",
  "DeleteStatement",
  "ExpressionStatement",
  "GlobalStatement",
  "NonlocalStatement",
  "RaiseStatement",
  "ReturnStatement",
  "UpdateStatement",
]);

function children(node: PythonSyntaxNode): PythonSyntaxNode[] {
  const result: PythonSyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function expressionWithinStatement(node: PythonSyntaxNode): { from: number; to: number } | null {
  const parts = children(node);
  if (node.name === "ExpressionStatement") return { from: node.from, to: node.to };
  if (node.name === "AssignStatement" || node.name === "UpdateStatement") {
    const operator = parts.find((part) => part.name === "AssignOp" || part.name === "UpdateOp");
    const expression = operator?.nextSibling;
    return expression ? { from: expression.from, to: node.to } : null;
  }
  if (node.name === "ReturnStatement" || node.name === "AssertStatement") {
    const expression = parts[1];
    return expression ? { from: expression.from, to: node.to } : null;
  }
  return null;
}

function implementationEnd(source: string): number {
  const marker = source.indexOf(PROVIDED_PYTHON_STARTER_POSTLUDE);
  return marker < 0 ? source.length : marker;
}

function practiceStatements(source: string): PracticeStatement[] {
  const limit = implementationEnd(source);
  const tree = pythonLanguage.parser.parse(source);
  const statements: PracticeStatement[] = [];
  const visit = (node: PythonSyntaxNode) => {
    if (node.from >= limit) return;
    if (SIMPLE_PYTHON_STATEMENTS.has(node.name)) {
      statements.push({ node, expression: expressionWithinStatement(node) });
      return;
    }
    for (const child of children(node)) visit(child);
  };
  visit(tree.topNode);
  return statements;
}

function evenlySpaced<T>(items: readonly T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  if (count >= items.length) return [...items];
  return Array.from({ length: count }, (_, index) => (
    items[Math.ceil(((index + 1) * items.length) / count) - 1]
  ));
}

function applySourceReplacements(source: string, replacements: readonly SourceReplacement[]): string {
  return [...replacements]
    .sort((left, right) => right.from - left.from)
    .reduce((result, replacement) => (
      `${result.slice(0, replacement.from)}${replacement.value}${result.slice(replacement.to)}`
    ), source);
}

function guidedPythonSource(source: string): string {
  const candidates = practiceStatements(source).filter((statement) => statement.expression !== null);
  const selected = evenlySpaced(candidates, Math.max(1, Math.ceil(candidates.length / 4)));
  return applySourceReplacements(source, selected.flatMap((statement) => (
    statement.expression ? [{ ...statement.expression, value: "..." }] : []
  )));
}

function lessHelpPythonSource(source: string): string {
  const statements = practiceStatements(source);
  const guidedStatements = evenlySpaced(
    statements.filter((statement) => statement.expression !== null),
    Math.max(1, Math.ceil(statements.filter((statement) => statement.expression !== null).length / 4)),
  );
  const targetCount = Math.max(guidedStatements.length, Math.ceil(statements.length * 0.6));
  const selected = new Set(evenlySpaced(statements, targetCount));
  for (const statement of guidedStatements) selected.add(statement);
  for (const statement of statements) {
    if (selected.size >= targetCount) break;
    selected.add(statement);
  }
  return applySourceReplacements(source, [...selected].map(({ node }) => ({
    from: node.from,
    to: node.to,
    value: "pass",
  })));
}

function fromScratchPythonSource(block: Pick<CodeBlock, "code" | "label">): string {
  const source = block.code;
  const postludeStart = source.indexOf(PROVIDED_PYTHON_STARTER_POSTLUDE);
  const limit = postludeStart < 0 ? source.length : postludeStart;
  const topLevel = children(pythonLanguage.parser.parse(source).topNode)
    .filter((node) => node.from < limit);
  const imports = topLevel
    .filter((node) => node.name === "ImportStatement")
    .map((node) => source.slice(node.from, node.to))
    .join("\n");
  const definition = topLevel.find((node) => node.name === "FunctionDefinition");
  const body = definition && children(definition).find((node) => node.name === "Body");
  const signature = definition && body
    ? source.slice(definition.from, body.from + 1).trimEnd()
    : null;
  const todo = `# TODO: implement ${block.label.toLowerCase()}.`;
  const scaffold = signature
    ? `${signature}\n    ${todo}\n    raise NotImplementedError(${JSON.stringify(`Implement ${block.label}.`)})`
    : `${todo}\nraise NotImplementedError(${JSON.stringify(`Implement ${block.label}.`)})`;
  const postlude = postludeStart < 0 ? "" : source.slice(postludeStart);
  return [imports, scaffold, postlude].filter(Boolean).join("\n\n");
}

function javascriptStarterSource(block: Pick<CodeBlock, "code" | "label">): string {
  const signature = block.code.split("\n")[0];
  return `${signature}\n  // TODO: implement ${block.label.toLowerCase()}.\n}`;
}

export function practiceRepetitionKey(blockId: string, round: PracticeRound): string {
  return round === 1 ? blockId : `${blockId}::round-${round}`;
}

export function practiceRepetitionSource(
  filename: string,
  block: Pick<CodeBlock, "code" | "label" | "starterCode">,
  round: PracticeRound,
): string {
  if (round === 1 && block.starterCode) return block.starterCode;
  if (!filename.toLowerCase().endsWith(".py")) return javascriptStarterSource(block);
  if (round === 1) return guidedPythonSource(block.code);
  if (round === 2) return lessHelpPythonSource(block.code);
  return fromScratchPythonSource(block);
}

export function practiceDraftIsCompatible(filename: string, source: string): boolean {
  return !filename.toLowerCase().endsWith(".py") || !JAVASCRIPT_DRAFT_MARKERS.some((marker) => marker.test(source));
}

/**
 * Produce the incomplete source a learner should encounter before they have a
 * saved draft. This is shared state policy, not presentation: lesson pages and
 * the canonical project must resolve an untouched cell to the same bytes.
 */
export function starterPracticeSource(filename: string, block: Pick<CodeBlock, "code" | "label" | "starterCode">): string {
  return practiceRepetitionSource(filename, block, 1);
}

/** Compatibility-shaped entrypoint for lesson components. */
export function starterCodeFor(
  block: Pick<CodeBlock, "code" | "label" | "starterCode">,
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

export function workingPracticeRepetitionSource(
  filename: string,
  block: PracticeSourceBlock,
  round: PracticeRound,
  answers: Readonly<Record<string, string>>,
): string {
  const key = practiceRepetitionKey(block.id, round);
  const saved = Object.prototype.hasOwnProperty.call(answers, key) ? answers[key] : undefined;
  return saved !== undefined && practiceDraftIsCompatible(filename, saved)
    ? saved
    : practiceRepetitionSource(filename, block, round);
}

export function restorePracticeRepetitionVerification(
  state: PracticeRepetitionState,
  currentContractVersion: string,
): PracticeRepetitionState {
  if (state.verifiedContractVersion !== currentContractVersion) {
    return { answers: { ...state.answers }, verifiedSources: {}, verifiedContractVersion: null };
  }
  const verifiedSources = Object.fromEntries(Object.entries(state.verifiedSources).filter(([key, source]) => (
    state.answers[key] === source
  )));
  return {
    answers: { ...state.answers },
    verifiedSources,
    verifiedContractVersion: Object.keys(verifiedSources).length ? currentContractVersion : null,
  };
}

export function editPracticeRepetition(
  state: PracticeRepetitionState,
  key: string,
  source: string,
): PracticeRepetitionState {
  const verifiedSources = Object.fromEntries(Object.entries(state.verifiedSources).filter(([id]) => id !== key));
  return {
    answers: { ...state.answers, [key]: source },
    verifiedSources,
    verifiedContractVersion: Object.keys(verifiedSources).length ? state.verifiedContractVersion : null,
  };
}

export function verificationAfterPracticeRepetitionRun(
  state: PracticeRepetitionState,
  key: string,
  source: string,
  passed: boolean,
  currentContractVersion: string,
): PracticeRepetitionState {
  const currentSources = state.verifiedContractVersion === currentContractVersion
    ? state.verifiedSources
    : {};
  const verifiedSources = passed
    ? { ...currentSources, [key]: source }
    : Object.fromEntries(Object.entries(currentSources).filter(([id]) => id !== key));
  return {
    answers: { ...state.answers, [key]: source },
    verifiedSources,
    verifiedContractVersion: Object.keys(verifiedSources).length ? currentContractVersion : null,
  };
}

export function practiceRepetitionIsVerified(
  state: PracticeRepetitionState,
  key: string,
  source: string,
  currentContractVersion: string,
): boolean {
  return state.verifiedContractVersion === currentContractVersion
    && state.verifiedSources[key] === source;
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
 * Keep learner bytes that cannot participate in the current working document.
 * This includes incompatible pre-CPython source and answers for exercise ids
 * removed or renamed by a later curriculum version.
 */
export function preservedPracticeAnswers(
  filename: string,
  blocks: readonly Pick<CodeBlock, "id">[],
  answers: Readonly<Record<string, string>>,
): Record<string, string> {
  const knownIds = new Set(blocks.map((block) => block.id));
  return Object.fromEntries(Object.entries(answers).filter(([id, source]) => (
    !knownIds.has(id) || !practiceDraftIsCompatible(filename, source)
  )));
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
