import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "#vite-test-server";

const root = new URL("../", import.meta.url);
let vite;
let contract;
let frame;
let visual;
let registry;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [contract, frame, visual, registry] = await Promise.all([
    vite.ssrLoadModule("/app/features/trusted-interactives/contract.ts"),
    vite.ssrLoadModule("/app/features/trusted-interactives/frame.ts"),
    vite.ssrLoadModule("/app/features/trusted-interactives/visual-contract.ts"),
    vite.ssrLoadModule("/app/features/trusted-interactives/registry.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function definition(overrides = {}) {
  return contract.defineTrustedInteractive({
    schemaVersion: 1,
    id: "worked-example",
    definitionVersion: 1,
    stateSchemaVersion: 1,
    title: "Worked example",
    description: "A deterministic worked example used to validate the trusted interactive runtime.",
    source: {
      html: '<main><button type="button">Run</button><output aria-live="polite"></output></main>',
      css: "main { color: var(--latent-ink); }",
      javascript: "void Latent.connect();",
    },
    initialState: { hasRun: false },
    input: { values: [1, 2, 3] },
    frame: { title: "Worked example", minimumHeight: 320, maximumHeight: 720 },
    appearance: { palette: "paper" },
    capabilities: ["context.get", "state.save", "events.record", "progress.request"],
    events: ["example-ran"],
    completionCheckpoints: ["example-complete"],
    authoring: {
      learningObjective: "Trace one deterministic state transition from input to visible output.",
      learnerAction: "Run the example and inspect its exact output.",
      evidence: "The host records the completion checkpoint after the run.",
      requestedVisualElements: ["stage", "status"],
    },
    ...overrides,
  });
}

test("the frame uses a fixed opaque bootstrap and never interpolates authored source", () => {
  const html = frame.createTrustedInteractiveFrameSrcdoc();
  const actualHash = `sha256-${createHash("sha256").update(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE).digest("base64")}`;

  assert.equal(frame.TRUSTED_INTERACTIVE_FRAME_SANDBOX, "allow-scripts");
  assert.equal(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SHA256, actualHash);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /worker-src 'none'/);
  assert.match(html, /frame-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /navigate-to 'none'/);
  assert.match(html, /script-src 'sha256-[^']+' blob:/);
  assert.doesNotMatch(html, /allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
  assert.doesNotMatch(html, /Worked example|example-ran|LEARNER_SOURCE/);
  assert.match(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE, /root\.innerHTML = bundle\.html/);
  assert.match(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE, /crypto\.subtle\.digest/);
  assert.match(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE, /Object\.defineProperty\(globalThis, "Latent"/);
  assert.match(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE, /event\.isTrusted/);
  assert.match(frame.TRUSTED_INTERACTIVE_BOOTSTRAP_SOURCE, /const captureInteraction/);
  assert.match(frame.TrustedInteractiveFrameSession.toString(), /navigation-blocked/);
});

test("definitions accept arbitrary body markup but reject executable document escapes", () => {
  assert.equal(definition().id, "worked-example");
  assert.throws(
    () => definition({
      source: {
        html: "<script>parent.location='https://example.com'</script>",
        css: "body { color: black; }",
        javascript: "void 0;",
      },
    }),
    /body fragment/,
  );
  assert.throws(
    () => definition({
      source: {
        html: "<main>Remote style</main>",
        css: '@import "https://example.com/theme.css";',
        javascript: "void 0;",
      },
    }),
    /remote resources/,
  );
  assert.throws(
    () => definition({ capabilities: ["context.get", "network.fetch"] }),
    /unknown host capability/,
  );
  assert.throws(
    () => definition({ capabilities: ["state.save"] }),
    /must request context\.get/,
  );
  assert.throws(
    () => definition({
      source: {
        html: "<main>Navigate</main>",
        css: "main { color: black; }",
        javascript: "location.href = 'https://example.com';",
      },
    }),
    /location navigation/,
  );
  const frozen = definition({
    initialState: { nested: { selected: [1, 2] } },
    input: { nested: { values: [1, 2, 3] } },
  });
  assert.equal(Object.isFrozen(frozen.initialState), true);
  assert.equal(Object.isFrozen(frozen.initialState.nested), true);
  assert.equal(Object.isFrozen(frozen.initialState.nested.selected), true);
  assert.equal(Object.isFrozen(frozen.input.nested.values), true);
});

test("a prepared bundle is source-bound and tampering is rejected", async () => {
  const context = visual.createTrustedInteractiveVisualContext({ lessonTone: "plum" });
  const css = visual.trustedInteractiveVisualCss(context);
  const bundle = await contract.prepareTrustedInteractiveBundle(definition(), css);

  assert.equal(contract.isValidatedTrustedInteractiveBundle(bundle), true);
  assert.match(bundle.sourceHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(bundle.bundleHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(bundle), true);
  assert.match(css, /--latent-lesson-accent: #695a78/);
  assert.match(css, /\.latent-stage/);

  await assert.rejects(
    contract.verifyTrustedInteractiveBundle({ ...bundle, javascript: `${bundle.javascript}\nvoid 0;` }),
    /does not match its source hashes/,
  );
  await assert.rejects(
    contract.verifyTrustedInteractiveBundle({ ...bundle, visualCss: `${bundle.visualCss}\nbody{display:block}` }),
    /does not match its source hashes/,
  );

  const policyInvalid = {
    ...bundle,
    javascript: "fetch('https://example.com');",
  };
  policyInvalid.sourceHash = `sha256:${createHash("sha256")
    .update(contract.trustedInteractiveSourceBytes(policyInvalid))
    .digest("hex")}`;
  policyInvalid.bundleHash = `sha256:${createHash("sha256")
    .update(contract.trustedInteractiveBundleBytes(policyInvalid))
    .digest("hex")}`;
  await assert.rejects(
    contract.verifyTrustedInteractiveBundle(policyInvalid),
    /cannot use fetch/,
    "valid hashes cannot brand source that fails reviewed-source admission",
  );
});

test("the protocol accepts only bounded allowlisted requests", () => {
  const request = {
    schemaVersion: 1,
    type: "latent-interactive/request",
    requestId: "interactive:1",
    method: "state.save",
    payload: { state: { selected: 2 }, revision: 1 },
    interaction: null,
  };
  const allowed = new Set(["context.get", "state.save"]);
  assert.equal(frame.isTrustedInteractiveFrameMessage(request, allowed), true);
  assert.equal(
    frame.isTrustedInteractiveFrameMessage({ ...request, method: "network.fetch" }, allowed),
    false,
  );
  assert.equal(
    frame.isTrustedInteractiveFrameMessage({ ...request, interaction: undefined }, allowed),
    false,
  );
  assert.equal(
    frame.isTrustedInteractiveFrameMessage({
      ...request,
      interaction: { sequence: 1, kind: "pointer" },
    }, allowed),
    true,
  );
  assert.equal(
    frame.isTrustedInteractiveFrameMessage({ ...request, requestId: "bad id" }, allowed),
    false,
  );
  assert.equal(
    frame.isTrustedInteractiveHostMessage({
      schemaVersion: 1,
      type: "latent-interactive/response",
      requestId: "interactive:context",
      ok: true,
      value: { input: "x".repeat(96_000) },
    }),
    true,
    "host context may compose state, input, and visuals beyond the smaller request envelope",
  );
  assert.equal(
    frame.isTrustedInteractiveHostMessage({
      schemaVersion: 1,
      type: "latent-interactive/response",
      requestId: "interactive:context",
      ok: true,
      value: { input: "x".repeat(170_000) },
    }),
    false,
  );
  assert.equal(
    frame.isTrustedInteractiveFrameMessage({
      ...request,
      payload: { state: "x".repeat(70_000), revision: 1 },
    }, allowed),
    false,
  );

  const gate = new frame.TrustedInteractiveRequestGate(allowed);
  assert.equal(gate.accept(request), true);
  assert.equal(gate.accept(request), false);
  assert.equal(gate.settle(request.requestId), true);
  assert.equal(gate.accept(request), true);
  gate.clear();
});

test("the visual context passes tokens, elements, and accumulated authoring lessons", () => {
  const context = visual.createTrustedInteractiveVisualContext({
    palette: "paper",
    lessonTone: "forest",
    reducedMotion: true,
  });

  assert.equal(context.palette, "paper");
  assert.equal(context.colors.canvas, "#f4f0e8");
  assert.equal(context.colors.lessonAccent, "#486750");
  assert.equal(context.constraints.minimumControlPixels, 44);
  assert.equal(context.preferences.reducedMotion, true);
  assert.ok(context.elements.some((element) => element.className === "latent-stage"));
  assert.ok(context.authoringLessons.length >= 10);
  assert.ok(context.authoringLessons.some((lesson) => lesson.id === "meaningful-completion"));
});

test("the causal-attention registry preserves raw authored bytes and host-validates saved evidence", async () => {
  const definition = registry.resolveTrustedInteractive({
    id: "causal-attention",
    definitionVersion: 2,
  });
  assert.ok(definition);
  assert.equal(registry.listTrustedInteractives().length, 1);
  assert.equal(
    registry.resolveTrustedInteractive({ id: "causal-attention", definitionVersion: 3 }),
    null,
  );

  const sourceRoot = new URL(
    "app/features/trusted-interactives/definitions/causal-attention/",
    root,
  );
  const [html, css, javascript] = await Promise.all([
    readFile(new URL("index.html", sourceRoot), "utf8"),
    readFile(new URL("styles.css", sourceRoot), "utf8"),
    readFile(new URL("main.js", sourceRoot), "utf8"),
  ]);
  assert.equal(definition.source.html, html);
  assert.equal(definition.source.css, css);
  assert.equal(definition.source.javascript, javascript);
  assert.deepEqual(definition.events, [
    "causal-attention-query-selected",
    "causal-attention-trace-revealed",
    "causal-attention-replay",
  ]);

  const payload = {
    tokenCount: 6,
    selectedQuery: 3,
    inspectedQueries: [0, 3],
  };
  const reveal = {
    interaction: { sequence: 1, kind: "pointer" },
    beforeState: {
      hasRevealed: false,
      selectedQuery: 0,
      inspectedQueries: [],
      traceRuns: 0,
    },
    afterState: {
      hasRevealed: true,
      selectedQuery: 0,
      inspectedQueries: [0],
      traceRuns: 1,
    },
  };
  const comparison = {
    interaction: { sequence: 2, kind: "pointer" },
    beforeState: reveal.afterState,
    afterState: {
      hasRevealed: true,
      selectedQuery: 3,
      inspectedQueries: [0, 3],
      traceRuns: 1,
    },
  };
  assert.equal(
    registry.validateTrustedInteractiveCheckpoint(
      definition,
      "causal-attention-comparison",
      payload,
      comparison.afterState,
      {
        transitions: [],
        completionInteraction: comparison.interaction,
      },
    ),
    false,
    "frame-writable saved state cannot complete without host-observed user transitions",
  );
  assert.equal(
    registry.validateTrustedInteractiveCheckpoint(
      definition,
      "causal-attention-comparison",
      payload,
      comparison.afterState,
      {
        transitions: [reveal],
        completionInteraction: comparison.interaction,
      },
    ),
    false,
    "one genuine action is not enough to prove a comparison",
  );
  assert.equal(
    registry.validateTrustedInteractiveCheckpoint(
      definition,
      "causal-attention-comparison",
      payload,
      comparison.afterState,
      {
        transitions: [reveal, comparison],
        completionInteraction: comparison.interaction,
      },
    ),
    true,
  );
  assert.equal(
    registry.validateTrustedInteractiveCheckpoint(
      definition,
      "causal-attention-comparison",
      payload,
      comparison.afterState,
      {
        transitions: [reveal, comparison],
        completionInteraction: { sequence: 3, kind: "keyboard" },
      },
    ),
    false,
    "the checkpoint must be requested from the same trusted interaction as the comparison save",
  );
});
