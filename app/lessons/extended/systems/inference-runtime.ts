import { defineExtendedLesson } from "../define-lesson";

export const inferenceRuntimeLesson = defineExtendedLesson({
    id: "inference-runtime",
    number: 7,
    courseId: "systems",
    courseTitle: "Inference Runtime",
    courseNumber: 2,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Worked runtime trace",
    eyebrow: "Inference · Prefill and decode",
    title: "Inference Runtime",
    thesis: "LLM inference separates parallel prompt prefill from one-position decode forwards while key-value memory grows with cached sequence positions.",
    paperUrl: "https://arxiv.org/abs/2309.06180",
    paperTitle: "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    authors: "Woosuk Kwon et al.",
    year: "2023",
    summary: [
      { label: "Two phases.", body: "Prefill processes all prompt positions in parallel, stores their keys and values, and returns logits used to sample the first output token. To produce N generated tokens, the runtime then performs max(0, N - 1) one-position decode forwards for the remaining tokens." },
      { label: "Memory growth.", body: "Each processed sequence position adds a key and a value at every layer. Per-request bytes are 2 × layers × KV heads × tokens × head dimension × bytes per value; KV heads—not query heads—matter for grouped-query attention." },
      { label: "Isolation.", body: "Browser inference belongs in a Web Worker so model execution cannot block React rendering. Messages form an explicit boundary between product state and model state." },
      { label: "Measurement.", body: "Time to first token (TTFT) measures admission through the first visible token, so it includes queueing and prefill. Inter-token latency (ITL) measures the gap between later visible tokens; tokens per second summarizes the steady decode rate. Combining them into one duration hides the user-visible latency shape." },
    ],
    claims: {
      paper: "Paged allocation reduces KV-cache waste and enables higher serving throughput under dynamic request lengths.",
      lab: "A fixed browser trace makes prefill, iterative decode, worker isolation, cache growth, and authored phase timing inspectable.",
      limit: "No GPU kernel, multi-host network, or production memory allocator is reproduced.",
    },
    diagram: {
      title: "Worked request r-104",
      caption: "A 96-token prompt and 32-token output require one prefill forward and 31 subsequent decode forwards; the final sequence contains 128 tokens.",
      nodes: [
        { label: "Queue", value: "18 ms" },
        { label: "Prefill", value: "74 ms · 96 positions · 6 KV pages" },
        { label: "First token", value: "sampled at TTFT 92 ms" },
        { label: "Decode", value: "31 forwards · tokens 2–32 · 6 → 8 pages" },
        { label: "Release", value: "8 pages returned" },
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
      preview: "r-104 · prompt 96 + output 32 = final length 128 · 1 prefill + 31 decode forwards",
    },
    implementation: {
      filename: "inference-runtime.js",
      intro: "Implement phase accounting and KV-cache sizing before replaying the authored request lifecycle trace.",
      tensorOps: ["numel"],
      codeBlocks: [
        {
          id: "inference-phases",
          label: "Phase accounting",
          purpose: "Distinguish generated tokens, model forwards, processed positions, and final sequence length.",
          concepts: [
            { name: "promptTokens", detail: "Tokens processed together during prefill." },
            { name: "generatedTokens", detail: "Requested output length; the first token is sampled from prefill logits." },
            { name: "decodeForwards", detail: "Subsequent one-position forwards: max(0, generatedTokens - 1)." },
            { name: "processedTokenPositions", detail: "Prompt positions plus positions processed by subsequent decode forwards." },
            { name: "finalSequenceLength", detail: "Prompt tokens plus every generated token, including the final unprocessed sample." },
          ],
          code: `function inferencePhases(promptTokens, maxNewTokens) {
  const generatedTokens = Math.max(0, maxNewTokens);
  const decodeForwards = Math.max(0, generatedTokens - 1);
  return {
    prefillTokens: promptTokens,
    generatedTokens,
    decodeForwards,
    processedTokenPositions: promptTokens + decodeForwards,
    finalSequenceLength: promptTokens + generatedTokens,
  };
}`,
          checkCode: `const phases = inferencePhases(96, 32);
return { passed: phases.prefillTokens === 96 && phases.generatedTokens === 32 && phases.decodeForwards === 31 && phases.processedTokenPositions === 127 && phases.finalSequenceLength === 128, detail: phases.prefillTokens + " prefill · " + phases.decodeForwards + " subsequent decode forwards · " + phases.generatedTokens + " generated" };`,
        },
        {
          id: "kv-bytes",
          label: "KV-cache bytes",
          purpose: "Calculate request memory from model shape and sequence length.",
          concepts: [
            { name: "2", detail: "Separate key and value tensors." },
            { name: "layers", detail: "Every Transformer layer owns cached states." },
            { name: "kvHeads", detail: "Key-value heads; this may be fewer than query heads under grouped-query attention." },
            { name: "tokens × headDimension", detail: "One head vector per cached sequence position." },
            { name: "bytesPerValue", detail: "Storage width of each cached scalar." },
          ],
          code: `function kvCacheBytes({ layers, kvHeads, headDimension, tokens, bytesPerValue = 2 }) {
  return numel([2, layers, kvHeads, tokens, headDimension]) * bytesPerValue;
}`,
          checkCode: `const bytes = kvCacheBytes({ layers: 4, kvHeads: 8, headDimension: 16, tokens: 100, bytesPerValue: 2 });
return { passed: bytes === 204800, detail: (bytes / 1024).toFixed(0) + " KiB" };`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "runtime", title: "Replay the inference lifecycle", intro: "Replay one authored request through queue, prefill, decode, and cache release. Its phase timings are fixed teaching data, not measurements of your device or learner file." },
  });
