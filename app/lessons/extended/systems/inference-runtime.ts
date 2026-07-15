import { defineExtendedLesson } from "../define-lesson";

export const inferenceRuntimeLesson = defineExtendedLesson({
    id: "inference-runtime",
    number: 7,
    courseId: "systems",
    courseTitle: "Inference Runtime",
    courseNumber: 2,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Runtime walkthrough",
    eyebrow: "Inference · Prefill and decode",
    title: "Inference Runtime",
    thesis: "LLM inference handles the prompt in a parallel prefill phase, then decodes one position at a time. The key-value cache grows with the cached sequence positions.",
    paperUrl: "https://arxiv.org/abs/2309.06180",
    paperTitle: "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    authors: "Woosuk Kwon et al.",
    year: "2023",
    summary: [
      { label: "Two phases.", body: "Prefill processes every prompt position in parallel, saves the keys and values, and returns the logits used to sample the first output token. To generate N tokens total, the runtime then does max(0, N - 1) one-position decode forwards for the rest." },
      { label: "How memory grows.", body: "Every processed sequence position adds one key and one value at each layer. The bytes for one request are 2 × layers × KV heads × tokens × head dimension × bytes per value. With grouped-query attention, KV heads matter here, not query heads." },
      { label: "Keep it off the UI thread.", body: "Run browser inference in a Web Worker so the model can't freeze React rendering. Messages give you a clear boundary between product state and model state." },
      { label: "Measure what the user feels.", body: "Time to first token (TTFT) runs from admission to the first token on screen, so it includes queueing and prefill. Inter-token latency (ITL) is the gap between later visible tokens. Tokens per second gives the steady decode rate. If you roll all of that into one duration, you lose the shape of the wait the user actually experiences." },
    ],
    claims: {
      paper: "Paged allocation cuts down on wasted KV-cache space and can raise serving throughput when request lengths vary.",
      lab: "A fixed browser trace lets you inspect prefill, repeated decode, worker isolation, cache growth, and the planned timing for each phase.",
      limit: "This doesn't recreate a GPU kernel, a network of multiple hosts, or a production memory allocator.",
    },
    diagram: {
      title: "Worked request r-104",
      caption: "A 96-token prompt and a 32-token output need one prefill forward and 31 later decode forwards. The final sequence has 128 tokens.",
      nodes: [
        { label: "Queue", value: "18 ms" },
        { label: "Prefill", value: "74 ms · 96 positions · 6 KV pages" },
        { label: "First token", value: "sampled at TTFT 92 ms" },
        { label: "Decode", value: "31 forwards · tokens 2–32 · 6 → 8 pages" },
        { label: "Release", value: "8 pages returned" },
      ],
    },
    questions: {
      intro: "Ask about prefill, decode, KV-cache growth, Web Workers, or how to measure latency.",
      suggestions: ["Why is decode memory-bandwidth bound?", "What determines time to first token?", "Why isolate inference in a Worker?"],
    },
    dataset: {
      name: "Inference Trace",
      source: "Fixed synthetic requests",
      license: "CC0",
      size: "6 requests · fixed prompt and output lengths",
      preview: "r-104 · prompt 96 + output 32 = final length 128 · 1 prefill + 31 decode forwards",
    },
    implementation: {
      filename: "inference-runtime.py",
      intro: "Build phase accounting and KV-cache sizing in Python, then replay the planned request timeline.",
      codeBlocks: [
        {
          id: "inference-phases",
          label: "Phase accounting",
          purpose: "Keep generated tokens, model forwards, processed positions, and final sequence length straight.",
          concepts: [
            { name: "prompt_tokens", detail: "The tokens processed together during prefill." },
            { name: "generated_tokens", detail: "The requested output length. The first token is sampled from the prefill logits." },
            { name: "decode_forwards", detail: "The one-position forwards after prefill: max(0, generated_tokens - 1)." },
            { name: "processed_token_positions", detail: "All prompt positions plus the positions handled by later decode forwards." },
            { name: "final_sequence_length", detail: "Prompt tokens plus every generated token, including the last sample that hasn't been processed again." },
          ],
          code: `def inference_phases(prompt_tokens, max_new_tokens):
    generated_tokens = max(0, max_new_tokens)
    decode_forwards = max(0, generated_tokens - 1)
    return {
        "prefillTokens": prompt_tokens,
        "generatedTokens": generated_tokens,
        "decodeForwards": decode_forwards,
        "processedTokenPositions": prompt_tokens + decode_forwards,
        "finalSequenceLength": prompt_tokens + generated_tokens,
    }`,
          checkCode: `phases = inference_phases(96, 32)
RESULT = {
    "passed": (
        phases["prefillTokens"] == 96
        and phases["generatedTokens"] == 32
        and phases["decodeForwards"] == 31
        and phases["processedTokenPositions"] == 127
        and phases["finalSequenceLength"] == 128
    ),
    "detail": (
        f'{phases["prefillTokens"]} prefill · '
        f'{phases["decodeForwards"]} later decode forwards · '
        f'{phases["generatedTokens"]} generated'
    ),
}`,
        },
        {
          id: "kv-bytes",
          label: "KV-cache bytes",
          purpose: "Calculate how much memory a request needs from the model shape and sequence length.",
          concepts: [
            { name: "2", detail: "One tensor for keys and another for values." },
            { name: "layers", detail: "Every Transformer layer has its own cached state." },
            { name: "kv_heads", detail: "The number of key-value heads. Grouped-query attention may use fewer of these than query heads." },
            { name: "tokens × head_dimension", detail: "One head vector for every cached sequence position." },
            { name: "bytes_per_value", detail: "How many bytes each cached number uses." },
          ],
          code: `def kv_cache_bytes(config):
    layers = config["layers"]
    kv_heads = config["kvHeads"]
    head_dimension = config["headDimension"]
    tokens = config["tokens"]
    bytes_per_value = config.get("bytesPerValue", 2)
    return 2 * layers * kv_heads * tokens * head_dimension * bytes_per_value`,
          checkCode: `byte_count = kv_cache_bytes({
    "layers": 4,
    "kvHeads": 8,
    "headDimension": 16,
    "tokens": 100,
    "bytesPerValue": 2,
})
RESULT = {
    "passed": byte_count == 204800,
    "detail": f"{byte_count / 1024:.0f} KiB",
}`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "runtime", title: "Replay the inference timeline", intro: "Follow one planned request through the queue, prefill, decode, and cache release. The phase timings are fixed examples for the lesson, not measurements from your device or your file." },
  });
