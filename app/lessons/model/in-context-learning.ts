import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const inContextLearningLesson = {
    id: "in-context-learning",
    number: 6,
    mode: "local-inference",
    modeLabel: "Real local inference",
    eyebrow: "Prompting · Few-shot inference",
    title: "In-Context Learning",
    thesis:
      "A frozen autoregressive model can use task demonstrations—examples in the prompt—to figure out what to do without changing any of its parameters.",
    paperUrl: "https://arxiv.org/abs/2005.14165",
    paperTitle: "Language Models are Few-Shot Learners",
    authors: "Tom B. Brown et al.",
    year: "2020",
    paperContext: `
This lesson walks through "Language Models are Few-Shot Learners" by Brown and colleagues.
- GPT-3 is an autoregressive language model that the paper tests on tasks described with plain-language prompts.
- Zero-shot gives the model an instruction. One-shot adds one example, and few-shot includes several examples in the prompt.
- The model's parameters stay frozen during these tests; the token sequence itself describes the task.
- Bigger models and useful examples generally help, but the results can change a lot by task and prompt format.
- The paper also covers contamination, bias, compute costs, and tasks where few-shot performance is still weak.
- The browser lab uses a local 135M-parameter instruct model. It lets you test the setup and see how sensitive the model is, but it doesn't recreate GPT-3's results.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "The weights stay frozen.",
        body:
          "In-context learning doesn't run gradient descent on the examples in the prompt. The model reads the instruction, examples, and query as one causal token sequence. Those earlier tokens change the hidden activations and KV cache used to predict the next token, but every learned weight stays fixed.",
      },
      {
        label: "Examples show the model what you mean.",
        body:
          "Demonstrations can spell out an output format, label mapping, style, or latent task that the instruction leaves unclear. Their order and formatting change the prompt prefix, so they can also change the model's output probabilities.",
      },
      {
        label: "Keep the comparison fair.",
        body:
          "For a fair comparison, change only the number of examples. Keep the instruction, held-out queries, decoding settings, label extractor, and exact-match metric the same. In this browser experiment, a provided local evaluator runs that whole comparison. It doesn't import or run your prompt and scoring functions; the IDE checks those separately. If you pick prompts after seeing the test results, you're quietly tuning on the test set.",
      },
      {
        label: "Model size matters.",
        body:
          "The paper's best results come from a model far larger than anything this browser can run. Two held-out items can show whether examples changed this local model's answers. They can't prove that few-shot prompting usually improves accuracy or recreate GPT-3's benchmark results.",
      },
    ],
    claims: {
      paper: "Larger autoregressive language models do much better on tasks given through zero-, one-, and few-shot prompts.",
      lab: "You'll run a real quantized 135M model locally on the same fixed classification cases with three different prompt setups.",
      limit: "The local model isn't GPT-3, and a two-case browser test can't recreate the paper's benchmark claims.",
    },
    diagram: {
      title: "Controlled zero-, one-, and few-shot comparison",
      caption: "Only the example tokens change inside the fixed local evaluator. The rows show what happened on two held-out items. They can tell you whether this run was sensitive to the examples, but not whether few-shot prompting works in general or always gets better as you add examples.",
      nodes: [
        { label: "Instruction", value: "output one label" },
        { label: "Demonstrations", value: "0 · 1 · 4 examples" },
        { label: "Frozen model", value: "no gradient update" },
        { label: "Measurement", value: "exact-match accuracy" },
      ],
    },
    questions: {
      intro: "Ask about frozen weights, choosing examples, prompt sensitivity, contamination, or what this small local experiment can and can't tell you.",
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
      filename: "few-shot-evaluation.py",
      intro: "Build predictable prompt formatting and scoring functions in Python. The IDE checks your functions on their own. The experiment below uses a separate fixed evaluator, so changing these practice cells can't change the comparison it reports.",
      codeBlocks: [
        {
          id: "format-demonstrations",
          label: "Demonstration formatter",
          purpose: "Format labeled examples without changing their order.",
          concepts: [
            { name: "examples", detail: "Fixed input-label dictionaries. Keep the given order, even when an input is empty." },
            { name: "schema", detail: "Trim the edges of each field and format every record as Input followed by Label." },
            { name: "separator", detail: "Put exactly one blank line between complete records." },
          ],
          code: `def format_demonstrations(examples):
    records = [
        f"Input: {example['input'].strip()}\\nLabel: {example['label'].strip()}"
        for example in examples
    ]
    return "\\n\\n".join(records)`,
          checkCode: `text = format_demonstrations([
    {"input": "aa", "label": "K"},
    {"input": "bbb", "label": "M"},
])
RESULT = {
    "passed": "Input: aa\\nLabel: K" in text and text.index("aa") < text.index("bbb"),
    "detail": "order preserved",
}`,
        },
        {
          id: "build-prompt",
          label: "Evaluation prompt",
          purpose: "Combine the fixed instruction, chosen examples, and held-out query.",
          concepts: [
            { name: "instruction", detail: "The required task text, kept the same in every setup." },
            { name: "demonstrations", detail: "An optional middle section. Whitespace alone means zero-shot, not an empty example." },
            { name: "query", detail: "The trimmed held-out input, followed by a final Label: for the model to complete." },
          ],
          code: `def build_prompt(config):
    instruction = config["instruction"].strip()
    demonstrations = config["demonstrations"].strip()
    query = config["query"].strip()

    sections = [instruction]
    if demonstrations:
        sections.append(demonstrations)
    sections.append(f"Input: {query}\\nLabel:")
    return "\\n\\n".join(sections)`,
          checkCode: `prompt = build_prompt({
    "instruction": "Return K or M.",
    "demonstrations": "",
    "query": "A sharp story.",
})
RESULT = {
    "passed": prompt == "Return K or M.\\n\\nInput: A sharp story.\\nLabel:",
    "detail": "zero-shot prompt gives the same result each time",
}`,
        },
        {
          id: "exact-match",
          label: "Exact-match scoring",
          purpose: "Pull out one allowed label and score it with no judgment call.",
          concepts: [
            { name: "allowed_labels", detail: "The closed set of labels chosen before the model runs." },
            { name: "match", detail: "The first allowed label that stands on its own and uses the exact casing. Labels inside words don't count." },
            { name: "expected", detail: "The correct label, used only after extraction to decide whether the prediction passed." },
          ],
          code: `def exact_match_label(output, expected, allowed_labels=("K", "M")):
    def is_word(character):
        return bool(character) and character.isascii() and (
            character.isalnum() or character == "_"
        )

    match = None
    for label in allowed_labels:
        if not label:
            continue
        start = 0
        while start <= len(output) - len(label):
            index = output.find(label, start)
            if index < 0:
                break
            before = output[index - 1] if index > 0 else ""
            after_index = index + len(label)
            after = output[after_index] if after_index < len(output) else ""
            if (
                not is_word(before)
                and not is_word(after)
                and (match is None or index < match["index"])
            ):
                match = {"index": index, "label": label}
            start = index + max(1, len(label))

    predicted = match["label"] if match else None
    return {"predicted": predicted, "passed": predicted == expected}`,
          checkCode: `result = exact_match_label("The label is K.", "K")
RESULT = {
    "passed": result["passed"] and result["predicted"] == "K",
    "detail": "predicted " + str(result["predicted"]),
}`,
        },
      ],
    },
    experiment: {
      kind: "icl",
      title: "Evaluate a frozen local model",
      intro: "Download the quantized model once, then compare zero-, one-, and four-example prompts on the same two held-out items.",
    },
  } satisfies Omit<CourseLesson, "sources">;
