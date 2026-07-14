import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let contractRuntime;
let contracts;
let template;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [contractRuntime, contracts, template] = await Promise.all([
    vite.ssrLoadModule("/packages/browser-lab/src/contracts.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

async function importAdapter(source, name) {
  const contents = `${source}\n//# sourceURL=${name}`;
  return import(`data:text/javascript;base64,${Buffer.from(contents).toString("base64")}`);
}

function observationFor(callable, args) {
  try {
    return { status: "returned", value: callable(...structuredClone(args)) };
  } catch (error) {
    return {
      status: "threw",
      errorName: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

test("every browser adapter satisfies every shared Python-authored contract case", async () => {
  const modules = {
    model: await importAdapter(template.MODEL_SOFTMAX_ADAPTER_SOURCE, "model-softmax.js"),
    transport: await importAdapter(template.STREAMING_TRANSPORT_ADAPTER_SOURCE, "streaming-transport.js"),
    reliability: await importAdapter(template.GENERATION_RELIABILITY_ADAPTER_SOURCE, "generation-reliability.js"),
    reducer: await importAdapter(template.CHAT_REDUCER_ADAPTER_SOURCE, "chat-reducer.js"),
    actions: await importAdapter(template.CHAT_ACTIONS_ADAPTER_SOURCE, "chat-actions.js"),
    quality: await importAdapter(template.CHAT_QUALITY_ADAPTER_SOURCE, "chat-quality.js"),
    streaming: await importAdapter(template.STREAMING_REACT_ADAPTER_SOURCE, "streaming-react.js"),
  };
  const bindings = new Map([
    ["neural-language-models/stable-softmax", modules.model.stableSoftmax],
    ["streaming-transport/encode-sse", modules.transport.encodeSse],
    ["streaming-transport/parse-sse", modules.transport.parseSseChunk],
    ["reliability-observability/retry-policy", modules.reliability.shouldRetry],
    ["reliability-observability/terminal-guard", modules.reliability.acceptEvent],
    ["conversation-state/create-message", modules.reducer.createMessage],
    ["conversation-state/append-delta", modules.reducer.appendMessageDelta],
    ["streaming-react/delta-buffer", modules.streaming.flushTokenBuffer],
    ["streaming-react/scroll-policy", modules.streaming.shouldFollowStream],
    ["chat-actions-context/context-budget", modules.actions.selectContext],
    ["chat-actions-context/regenerate-branch", modules.actions.createRegeneration],
    ["chat-product-quality/storage-validation", modules.quality.validConversationRecord],
    ["chat-product-quality/phase-label", modules.quality.generationStatusLabel],
  ]);
  const selected = contracts.llmSystemsExerciseContracts.filter((contract) => bindings.has(contract.id));
  assert.equal(selected.length, bindings.size, "every declared adapter seam must have a shared contract");
  assert.equal(selected.reduce((total, contract) => total + contract.cases.length, 0), 80);

  for (const contract of selected) {
    const callable = bindings.get(contract.id);
    assert.equal(typeof callable, "function", `${contract.id} must expose its browser adapter`);
    for (const exerciseCase of contract.cases) {
      const result = contractRuntime.evaluateExerciseCase(
        contract,
        exerciseCase,
        observationFor(callable, exerciseCase.invoke.args),
      );
      assert.equal(
        result.passed,
        true,
        `${contract.id}/${exerciseCase.id}: ${result.assertions.filter((entry) => !entry.passed).map((entry) => entry.detail).join(" | ")}`,
      );
    }
  }
});
