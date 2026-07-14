import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const inContextLearningLesson = {
    id: "in-context-learning",
    number: 6,
    mode: "local-inference",
    modeLabel: "Real local inference",
    eyebrow: "Prompting · Brown et al. · 2020",
    title: "In-Context Learning",
    thesis:
      "A frozen autoregressive model can condition its behavior on task demonstrations placed in the prompt without updating its parameters.",
    paperUrl: "https://arxiv.org/abs/2005.14165",
    paperTitle: "Language Models are Few-Shot Learners",
    authors: "Tom B. Brown et al.",
    year: "2020",
    paperContext: `
This lesson concerns "Language Models are Few-Shot Learners" by Brown and colleagues.
- GPT-3 is an autoregressive language model evaluated on tasks specified through natural-language prompts.
- Zero-shot evaluation provides an instruction, one-shot adds one demonstration, and few-shot supplies several demonstrations in context.
- The model parameters remain frozen during these evaluations; the task is represented in the token sequence.
- Performance generally improves with scale and with useful demonstrations, but results vary substantially by task and prompt format.
- The paper discusses contamination, bias, compute, and tasks on which few-shot performance remains weak.
- The browser lab uses a 135M-parameter local instruct model, so it tests the interface and sensitivity rather than reproducing GPT-3's results.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Frozen parameters.",
        body:
          "In-context learning does not perform gradient descent on the examples in the prompt. The model reads instruction, demonstrations, and query as one causal token sequence. Those prefix tokens change the hidden activations and KV cache used to predict the next token, while every learned weight remains fixed.",
      },
      {
        label: "Demonstrations as specification.",
        body:
          "Examples can establish an output schema, label mapping, style, or latent task that the instruction leaves ambiguous. Their ordering and formatting alter the prefix and can therefore alter the resulting distribution.",
      },
      {
        label: "Evaluation design.",
        body:
          "A controlled comparison changes only the number of demonstrations: the instruction, held-out queries, decoding settings, label extractor, and exact-match metric stay fixed. In this browser experiment, a supplied fixed local evaluator owns that complete comparison; it does not import or execute the learner's prompt and scoring functions, which the IDE verifies separately. Selecting prompts after seeing test performance can turn prompt engineering into unreported test-set optimization.",
      },
      {
        label: "Scale dependence.",
        body:
          "The paper's strongest results come from a model vastly larger than the one a browser can run. Two held-out items can reveal whether demonstrations changed this local model's outputs; they cannot establish that few-shot prompting generally improves accuracy or reproduce GPT-3's benchmark results.",
      },
    ],
    claims: {
      paper: "Scaling autoregressive language models substantially improves task performance specified through zero-, one-, and few-shot prompts.",
      lab: "A real quantized 135M model runs locally on the same fixed classification cases under three prompt conditions.",
      limit: "The local model is not GPT-3, and a two-case browser evaluation cannot reproduce the paper's benchmark claims.",
    },
    diagram: {
      title: "Controlled zero-, one-, and few-shot comparison",
      caption: "Only the demonstration tokens differ inside the fixed local evaluator. The displayed rows are observations from two held-out items: they can measure prediction sensitivity in this run, not general few-shot ability or a monotonic benefit from adding examples.",
      nodes: [
        { label: "Instruction", value: "output one label" },
        { label: "Demonstrations", value: "0 · 1 · 4 examples" },
        { label: "Frozen model", value: "no gradient update" },
        { label: "Measurement", value: "exact-match accuracy" },
      ],
    },
    questions: {
      intro: "Ask about frozen weights, demonstration selection, prompt sensitivity, contamination, or what can and cannot be inferred from the local experiment.",
      suggestions: [
        "Is in-context learning the same as fine-tuning?",
        "Why can example order change accuracy?",
        "How should few-shot prompts be evaluated?",
      ],
    },
    dataset: {
      name: "Opaque Review Labels",
      source: "Original fixed evaluation set",
      license: "CC0",
      size: "4 demonstrations · 2 held-out cases",
      preview: "positive → K · negative → M · held-out reviews use the same concealed mapping",
    },
    implementation: {
      filename: "few-shot-evaluation.js",
      intro: "Implement deterministic prompt construction and scoring as independently verified learner functions. The experiment below uses a separate fixed evaluator so editing these practice cells cannot change its reported comparison.",
      codeBlocks: [
        {
          id: "format-demonstrations",
          label: "Demonstration formatter",
          purpose: "Serialize labeled examples without changing their order.",
          concepts: [
            { name: "examples", detail: "Fixed input-label records; preserve their supplied order, including empty inputs." },
            { name: "schema", detail: "Trim field edges and serialize every record as Input then Label." },
            { name: "separator", detail: "Place exactly one blank line between complete records." },
          ],
          code: `function formatDemonstrations(examples) {
  return examples
    .map(({ input, label }) => "Input: " + input.trim() + "\\nLabel: " + label.trim())
    .join("\\n\\n");
}`,
          checkCode: `const text = formatDemonstrations([{ input: "aa", label: "K" }, { input: "bbb", label: "M" }]);
return { passed: text.includes("Input: aa\\nLabel: K") && text.indexOf("aa") < text.indexOf("bbb"), detail: "order preserved" };`,
        },
        {
          id: "build-prompt",
          label: "Evaluation prompt",
          purpose: "Combine the fixed instruction, selected demonstrations, and held-out query.",
          concepts: [
            { name: "instruction", detail: "Required task text held constant across every condition." },
            { name: "demonstrations", detail: "Optional middle section; whitespace-only means zero-shot, not an empty example." },
            { name: "query", detail: "Trimmed held-out input, followed by a terminal Label: for the model to continue." },
          ],
          code: `function buildPrompt({ instruction, demonstrations, query }) {
  const sections = [instruction.trim()];
  if (demonstrations.trim()) sections.push(demonstrations.trim());
  sections.push("Input: " + query.trim() + "\\nLabel:");
  return sections.join("\\n\\n");
}`,
          checkCode: `const prompt = buildPrompt({ instruction: "Return K or M.", demonstrations: "", query: "A sharp story." });
return { passed: prompt === "Return K or M.\\n\\nInput: A sharp story.\\nLabel:", detail: "zero-shot prompt is deterministic" };`,
        },
        {
          id: "exact-match",
          label: "Exact-match scoring",
          purpose: "Extract one allowed label and score it without subjective grading.",
          concepts: [
            { name: "allowedLabels", detail: "Closed set defined before model execution." },
            { name: "match", detail: "First standalone permitted label, with exact casing; labels embedded in words do not count." },
            { name: "expected", detail: "Gold label used only after prediction extraction to compute passed." },
          ],
          code: `function exactMatchLabel(output, expected, allowedLabels = ["K", "M"]) {
  const isWord = (character) => Boolean(character) && /[A-Za-z0-9_]/.test(character);
  let match = null;
  for (const label of allowedLabels) {
    if (!label) continue;
    let start = 0;
    while (start <= output.length - label.length) {
      const index = output.indexOf(label, start);
      if (index < 0) break;
      const before = output[index - 1] || "";
      const after = output[index + label.length] || "";
      if (!isWord(before) && !isWord(after) && (!match || index < match.index)) match = { index, label };
      start = index + Math.max(1, label.length);
    }
  }
  const predicted = match ? match.label : null;
  return { predicted, passed: predicted === expected };
}`,
          checkCode: `const result = exactMatchLabel("The label is K.", "K");
return { passed: result.passed && result.predicted === "K", detail: "predicted " + result.predicted };`,
        },
      ],
    },
    experiment: {
      kind: "icl",
      title: "Evaluate a frozen local model",
      intro: "Download the quantized model once, then run the supplied fixed local evaluator over identical held-out cases. It builds its own prompts, extracts labels, and scores exact match without importing or executing learner code. Its rows describe this two-item run; they do not show that accuracy must improve as demonstrations are added.",
    },
  } satisfies Omit<CourseLesson, "sources">;
