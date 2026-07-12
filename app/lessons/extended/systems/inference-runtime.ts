import { defineExtendedLesson } from "../define-lesson";

export const inferenceRuntimeLesson = defineExtendedLesson({
    id: "inference-runtime",
    number: 7,
    courseId: "systems",
    courseTitle: "Inference Runtime",
    courseNumber: 2,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Runtime simulation",
    eyebrow: "Inference · Prefill and decode",
    title: "Inference Runtime",
    thesis: "LLM inference separates a parallel prompt-prefill phase from an iterative decode phase whose state and memory grow with every generated token.",
    paperUrl: "https://arxiv.org/abs/2309.06180",
    paperTitle: "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    authors: "Woosuk Kwon et al.",
    year: "2023",
    summary: [
      { label: "Two phases.", body: "Prefill processes the prompt in parallel and populates attention state. Decode then advances one token per active request, repeatedly reading model weights and the accumulated key-value cache." },
      { label: "Memory growth.", body: "Every generated token adds keys and values for every layer. The resulting cache often dominates per-request memory and directly constrains concurrency." },
      { label: "Isolation.", body: "Browser inference belongs in a Web Worker so model execution cannot block React rendering. Messages form an explicit boundary between product state and model state." },
      { label: "Measurement.", body: "Time to first token reflects queueing and prefill; inter-token latency reflects decode. Combining them into one duration hides the user-visible shape of latency." },
    ],
    claims: {
      paper: "Paged allocation reduces KV-cache waste and enables higher serving throughput under dynamic request lengths.",
      lab: "The browser simulates prefill, iterative decode, worker isolation, and cache growth with explicit phase timing.",
      limit: "No GPU kernel, multi-host network, or production memory allocator is reproduced.",
    },
    diagram: {
      title: "Request lifecycle",
      caption: "The first visible token and later tokens are produced by different computational phases.",
      nodes: [
        { label: "Queue", value: "request admitted" },
        { label: "Prefill", value: "prompt → KV state" },
        { label: "Decode", value: "one token / iteration" },
        { label: "Complete", value: "release cache pages" },
      ],
    },
    questions: {
      intro: "Ask about prefill, decode, KV-cache growth, worker isolation, or latency measurement.",
      suggestions: ["Why is decode memory-bandwidth bound?", "What determines time to first token?", "Why isolate inference in a Worker?"],
    },
    dataset: {
      name: "Inference Trace",
      source: "Deterministic synthetic requests",
      license: "CC0",
      size: "6 requests · fixed prompt and output lengths",
      preview: "prompt 96 → output 32 · prompt 24 → output 80",
    },
    implementation: {
      filename: "inference-runtime.js",
      intro: "Implement phase accounting and KV-cache sizing before running the request lifecycle simulator.",
      tensorOps: ["numel"],
      codeBlocks: [
        {
          id: "inference-phases",
          label: "Phase accounting",
          purpose: "Separate prefill work from iterative decode work.",
          concepts: [
            { name: "promptTokens", detail: "Tokens processed together during prefill." },
            { name: "maxNewTokens", detail: "Maximum number of serial decode iterations." },
            { name: "decodeIterations", detail: "One scheduling opportunity per generated token." },
          ],
          code: `function inferencePhases(promptTokens, maxNewTokens) {
  return {
    prefillTokens: promptTokens,
    decodeIterations: maxNewTokens,
    totalTokenPositions: promptTokens + maxNewTokens,
  };
}`,
          checkCode: `const phases = inferencePhases(96, 32);
return { passed: phases.prefillTokens === 96 && phases.decodeIterations === 32 && phases.totalTokenPositions === 128, detail: phases.prefillTokens + " prefill · " + phases.decodeIterations + " decode" };`,
        },
        {
          id: "kv-bytes",
          label: "KV-cache bytes",
          purpose: "Calculate request memory from model shape and sequence length.",
          concepts: [
            { name: "2", detail: "Separate key and value tensors." },
            { name: "layers", detail: "Every Transformer layer owns cached states." },
            { name: "bytesPerValue", detail: "Storage width of each cached scalar." },
          ],
          code: `function kvCacheBytes({ layers, heads, headDimension, tokens, bytesPerValue = 2 }) {
  return numel([2, layers, heads, tokens, headDimension]) * bytesPerValue;
}`,
          checkCode: `const bytes = kvCacheBytes({ layers: 4, heads: 8, headDimension: 16, tokens: 100, bytesPerValue: 2 });
return { passed: bytes === 204800, detail: (bytes / 1024).toFixed(0) + " KiB" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "runtime", title: "Run the inference lifecycle", intro: "Advance deterministic requests through queue, prefill, decode, and cache release while measuring phase latency." },
  });
