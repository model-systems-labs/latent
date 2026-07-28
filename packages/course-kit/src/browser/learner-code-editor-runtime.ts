/// <reference lib="dom" />

import {
  LEARNER_CODE_EDITOR_CSP_NONCE,
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  LEARNER_CODE_EDITOR_VERSION,
  enhanceLearnerCodeEditorTextarea,
  type LearnerCodeEditorController,
  type LearnerCodeEditorOptions,
} from "../learner-code-editor.js";

export type LearnerCodeEditorRuntime = {
  readonly version: typeof LEARNER_CODE_EDITOR_VERSION;
  readonly cspNonce: typeof LEARNER_CODE_EDITOR_CSP_NONCE;
  readonly cspSource: typeof LEARNER_CODE_EDITOR_CSP_SOURCE;
  enhanceTextarea(
    textarea: HTMLTextAreaElement,
    options: LearnerCodeEditorOptions,
  ): LearnerCodeEditorController;
};

declare global {
  var LatentLearnerCodeEditorRuntime:
    | LearnerCodeEditorRuntime
    | undefined;
}

const runtime: LearnerCodeEditorRuntime = Object.freeze({
  version: LEARNER_CODE_EDITOR_VERSION,
  cspNonce: LEARNER_CODE_EDITOR_CSP_NONCE,
  cspSource: LEARNER_CODE_EDITOR_CSP_SOURCE,
  enhanceTextarea: enhanceLearnerCodeEditorTextarea,
});

if (
  globalThis.LatentLearnerCodeEditorRuntime
  && globalThis.LatentLearnerCodeEditorRuntime.version
    !== LEARNER_CODE_EDITOR_VERSION
) {
  throw new Error(
    "A different Latent learner code editor runtime is already installed.",
  );
}

if (!globalThis.LatentLearnerCodeEditorRuntime) {
  Object.defineProperty(globalThis, "LatentLearnerCodeEditorRuntime", {
    configurable: false,
    enumerable: true,
    value: runtime,
    writable: false,
  });
}
