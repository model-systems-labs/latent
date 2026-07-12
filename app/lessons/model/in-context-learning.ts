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
          "In-context learning does not perform gradient descent on the examples in the prompt. The model processes instruction, demonstrations, and query as one sequence and predicts the continuation under its existing parameters.",
      },
      {
        label: "Demonstrations as specification.",
        body:
          "Examples can establish an output schema, label mapping, style, or latent task that the instruction leaves ambiguous. Their ordering and formatting alter the prefix and can therefore alter the resulting distribution.",
      },
      {
        label: "Evaluation design.",
        body:
          "A persuasive few-shot result requires a fixed dataset, a defined metric, and identical test items across prompting conditions. Selecting prompts after seeing test performance can turn prompt engineering into unreported test-set optimization.",
      },
      {
        label: "Scale dependence.",
        body:
          "The paper's strongest results come from a model vastly larger than the one a browser can run. This lab therefore asks a narrower question: can demonstrations change the behavior of a real frozen local Transformer on a controlled task?",
      },
    ],
    claims: {
      paper: "Scaling autoregressive language models substantially improves task performance specified through zero-, one-, and few-shot prompts.",
      lab: "A real quantized 135M model runs locally on the same fixed classification cases under three prompt conditions.",
      limit: "The local model is not GPT-3, and a two-case browser evaluation cannot reproduce the paper's benchmark claims.",
    },
    diagram: {
      title: "Task specification in the prefix",
      caption: "The weights are unchanged; only the token sequence supplied before the query differs.",
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
      intro: "Implement deterministic prompt construction and scoring before running the same test cases through a real local model.",
      codeBlocks: [
        {
          id: "format-demonstrations",
          label: "Demonstration formatter",
          purpose: "Serialize labeled examples without changing their order.",
          concepts: [
            { name: "examples", detail: "Fixed input-label records selected before evaluation." },
            { name: "map", detail: "Applies one stable textual schema to every record." },
            { name: "join", detail: "Separates demonstrations with an unambiguous blank line." },
          ],
          code: `function formatDemonstrations(examples) {
  return examples
    .map(({ input, label }) => "Input: " + input + "\\nLabel: " + label)
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
            { name: "instruction", detail: "Task text held constant across conditions." },
            { name: "demonstrations", detail: "Only experimental variable: zero, one, or several examples." },
            { name: "query", detail: "Held-out input scored under every condition." },
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
            { name: "match", detail: "First standalone permitted label in the generation." },
            { name: "expected", detail: "Gold label hidden from the prompt." },
          ],
          code: `function exactMatchLabel(output, expected, allowedLabels = ["K", "M"]) {
  const escaped = allowedLabels.join("|");
  const match = output.toUpperCase().match(new RegExp("\\\\b(" + escaped + ")\\\\b"));
  const predicted = match ? match[1] : null;
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
      intro: "Download the quantized model once, then compare zero-, one-, and few-shot exact-match accuracy on identical held-out cases.",
    },
  } satisfies Omit<CourseLesson, "sources">;
