import type {
  TrustedInteractiveDefinition,
  TrustedInteractiveJson,
  TrustedInteractiveReference,
} from "@/app/features/trusted-interactives/contract";
import type { TrustedInteractiveFrameInteraction } from "@/app/features/trusted-interactives/frame";
import { causalAttentionInteractive } from "@/app/features/trusted-interactives/definitions/causal-attention/definition";

export type TrustedInteractiveStateTransitionEvidence = Readonly<{
  interaction: TrustedInteractiveFrameInteraction;
  beforeState: TrustedInteractiveJson;
  afterState: TrustedInteractiveJson;
}>;

export type TrustedInteractiveCheckpointEvidence = Readonly<{
  transitions: readonly TrustedInteractiveStateTransitionEvidence[];
  completionInteraction: TrustedInteractiveFrameInteraction | null;
}>;

export type TrustedInteractiveRegistration = Readonly<{
  definition: TrustedInteractiveDefinition;
  validateCheckpoint(input: Readonly<{
    checkpointId: string;
    payload: TrustedInteractiveJson;
    savedState: TrustedInteractiveJson;
    evidence: TrustedInteractiveCheckpointEvidence;
  }>): boolean;
}>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validQueryIndices(
  value: unknown,
  tokenCount: number,
  minimum = 2,
): value is number[] {
  return Array.isArray(value)
    && value.length >= minimum
    && value.length <= tokenCount
    && new Set(value).size === value.length
    && value.every((index) => Number.isSafeInteger(index) && index >= 0 && index < tokenCount);
}

function sameIndices(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length
    && left.every((index) => right.includes(index));
}

function validTraceRun(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

const registrations = Object.freeze([
  {
    definition: causalAttentionInteractive,
    validateCheckpoint: ({ checkpointId, payload, savedState, evidence }) => {
      if (
        checkpointId !== "causal-attention-comparison"
        || !isPlainRecord(payload)
        || !isPlainRecord(savedState)
        || !evidence.completionInteraction
      ) return false;
      const input = causalAttentionInteractive.input;
      if (!isPlainRecord(input) || !Array.isArray(input.tokens)) return false;
      const tokenCount = input.tokens.length;
      if (
        payload.tokenCount !== tokenCount
        || !Number.isSafeInteger(payload.selectedQuery)
        || !validQueryIndices(payload.inspectedQueries, tokenCount)
        || savedState.hasRevealed !== true
        || savedState.selectedQuery !== payload.selectedQuery
        || !validQueryIndices(savedState.inspectedQueries, tokenCount)
        || !validTraceRun(savedState.traceRuns)
      ) return false;
      if (!sameIndices(
        payload.inspectedQueries,
        savedState.inspectedQueries,
      )) return false;

      const traceRun = evidence.transitions.find((transition) => {
        if (
          !isPlainRecord(transition.beforeState)
          || !isPlainRecord(transition.afterState)
        ) return false;
        const before = transition.beforeState;
        const after = transition.afterState;
        return after.hasRevealed === true
          && validTraceRun(before.traceRuns)
          && validTraceRun(after.traceRuns)
          && after.traceRuns === before.traceRuns + 1
          && validQueryIndices(before.inspectedQueries, tokenCount, 0)
          && validQueryIndices(after.inspectedQueries, tokenCount, 1)
          && after.inspectedQueries.length === 1
          && Number.isSafeInteger(after.selectedQuery)
          && after.inspectedQueries[0] === after.selectedQuery;
      });
      if (!traceRun) return false;
      const traceRunAfter = traceRun.afterState as Record<string, unknown>;

      const comparison = evidence.transitions.find((transition) => {
        if (
          transition.interaction.sequence <= traceRun.interaction.sequence
          || !isPlainRecord(transition.beforeState)
          || !isPlainRecord(transition.afterState)
        ) return false;
        const before = transition.beforeState;
        const after = transition.afterState;
        const beforeIndices = before.inspectedQueries;
        const afterIndices = after.inspectedQueries;
        const selectedQuery = after.selectedQuery;
        if (
          before.hasRevealed !== true
          || after.hasRevealed !== true
          || !validTraceRun(before.traceRuns)
          || after.traceRuns !== before.traceRuns
          || before.traceRuns !== traceRunAfter.traceRuns
          || !validQueryIndices(beforeIndices, tokenCount, 1)
          || beforeIndices.length !== 1
          || !validQueryIndices(afterIndices, tokenCount)
          || afterIndices.length !== 2
          || typeof selectedQuery !== "number"
          || !Number.isSafeInteger(selectedQuery)
          || beforeIndices.includes(selectedQuery)
          || !sameIndices(
            beforeIndices,
            traceRunAfter.inspectedQueries as number[],
          )
          || !beforeIndices.every(
            (index) => afterIndices.includes(index),
          )
        ) return false;
        return transition.interaction.sequence === evidence.completionInteraction?.sequence
          && transition.interaction.kind === evidence.completionInteraction.kind;
      });
      if (!comparison || !isPlainRecord(comparison.afterState)) return false;
      return comparison.afterState.selectedQuery === payload.selectedQuery
        && comparison.afterState.traceRuns === savedState.traceRuns
        && sameIndices(
          comparison.afterState.inspectedQueries as number[],
          payload.inspectedQueries,
        );
    },
  },
] satisfies readonly TrustedInteractiveRegistration[]);

const registry = new Map(
  registrations.map((registration) => [
    `${registration.definition.id}@${registration.definition.definitionVersion}`,
    registration,
  ]),
);

if (registry.size !== registrations.length) {
  throw new Error("Trusted interactive ids and definition versions must be unique.");
}

export function resolveTrustedInteractive(
  reference: TrustedInteractiveReference,
): TrustedInteractiveDefinition | null {
  if (
    !reference
    || typeof reference.id !== "string"
    || !Number.isSafeInteger(reference.definitionVersion)
  ) return null;
  return registry.get(`${reference.id}@${reference.definitionVersion}`)?.definition ?? null;
}

export function listTrustedInteractives(): readonly TrustedInteractiveDefinition[] {
  return registrations.map(({ definition }) => definition);
}

/**
 * Executable completion checks stay in reviewed host source. A frame may ask
 * for a named checkpoint, but it cannot decide that its own claim is valid.
 */
export function validateTrustedInteractiveCheckpoint(
  definition: TrustedInteractiveDefinition,
  checkpointId: string,
  payload: TrustedInteractiveJson,
  savedState: TrustedInteractiveJson,
  evidence: TrustedInteractiveCheckpointEvidence,
): boolean {
  const registration = registry.get(`${definition.id}@${definition.definitionVersion}`);
  if (!registration || registration.definition !== definition) return false;
  return registration.validateCheckpoint({
    checkpointId,
    payload,
    savedState,
    evidence,
  });
}
