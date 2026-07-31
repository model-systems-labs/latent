import { runCausalAttention } from "@latent/model-lab";
import {
  TRUSTED_INTERACTIVE_SCHEMA_VERSION,
  defineTrustedInteractive,
  type TrustedInteractiveJson,
} from "@/app/features/trusted-interactives/contract";
import html from "@/app/features/trusted-interactives/definitions/causal-attention/index.html?raw";
import css from "@/app/features/trusted-interactives/definitions/causal-attention/styles.css?raw";
import javascript from "@/app/features/trusted-interactives/definitions/causal-attention/main.js?raw";

function causalAttentionInput(): TrustedInteractiveJson {
  return JSON.parse(JSON.stringify(runCausalAttention())) as TrustedInteractiveJson;
}

export const causalAttentionInteractive = defineTrustedInteractive({
  schemaVersion: TRUSTED_INTERACTIVE_SCHEMA_VERSION,
  id: "causal-attention",
  definitionVersion: 2,
  stateSchemaVersion: 2,
  title: "Causal attention explorer",
  description:
    "Reveal one fixed causal-attention trace, inspect query rows, and see which key positions the mask permits each query to read.",
  source: {
    html,
    css,
    javascript,
  },
  initialState: {
    hasRevealed: false,
    selectedQuery: 0,
    inspectedQueries: [],
    traceRuns: 0,
  },
  input: causalAttentionInput(),
  frame: {
    title: "Interactive causal self-attention matrix",
    minimumHeight: 620,
    maximumHeight: 1_800,
  },
  appearance: {
    palette: "paper",
  },
  capabilities: [
    "context.get",
    "state.save",
    "events.record",
    "progress.request",
  ],
  events: [
    "causal-attention-query-selected",
    "causal-attention-trace-revealed",
    "causal-attention-replay",
  ],
  completionCheckpoints: ["causal-attention-comparison"],
  authoring: {
    learningObjective:
      "Explain how a causal mask changes with the query position and why every visible probability row still sums to one.",
    learnerAction:
      "Reveal the fixed forward-pass trace, then compare at least two query positions against the same token sequence and attention head.",
    evidence:
      "Saved state shows the learner inspected at least two distinct rows and observed how the readable prefix changes while each row remains normalized.",
    requestedVisualElements: [
      "A query-by-key probability matrix with an explicit masked-future state",
      "Keyboard-operable query tabs and row selectors",
      "Exact readable-key, row-total, and context-magnitude evidence",
      "A compact guide that explains how to read the worked trace",
    ],
  },
});
