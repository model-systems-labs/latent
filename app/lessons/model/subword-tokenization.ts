import type { CourseLesson } from "@latent/course-kit";
import { commonQuestionInstruction } from "./shared";

export const subwordTokenizationLesson = {
    id: "subword-tokenization",
    number: 3,
    mode: "core-mechanism",
    modeLabel: "Core algorithm",
    eyebrow: "Tokenization · Byte-pair encoding",
    title: "Subword Tokenization",
    thesis:
      "A learned subword vocabulary balances sequence length against vocabulary size while still giving the model a way to represent words it hasn't seen.",
    paperUrl: "https://aclanthology.org/P16-1162/",
    paperTitle: "Neural Machine Translation of Rare Words with Subword Units",
    authors: "Rico Sennrich, Barry Haddow, Alexandra Birch",
    year: "2016",
    paperContext: `
This lesson walks through "Neural Machine Translation of Rare Words with Subword Units" by Sennrich, Haddow, and Birch.
- A fixed word vocabulary creates unknown tokens and doesn't handle names, compound words, or morphology—the way words change form—very well.
- The paper uses byte-pair encoding to learn common symbol merges and split words into variable-length subword sequences.
- Common patterns become short, reusable tokens, while rare words can still be built from smaller pieces.
- Vocabulary size and encoded sequence length have to be balanced together.
- The browser lab runs the BPE merge algorithm on a small provided corpus. It doesn't recreate the paper's translation system or BLEU results.
- The paper trains on word-frequency data with clear word boundaries. To keep the merge loop easy to follow, this lab counts repeated words directly and leaves out boundary markers.
${commonQuestionInstruction}`.trim(),
    summary: [
      {
        label: "Pick the right-sized pieces.",
        body:
          "A word vocabulary maps every unseen word to one unknown id. A character vocabulary can spell any word made from known base symbols, but even common words become long sequences. Subword tokenization lands in the middle, so the language model predicts reusable pieces instead of whole words or single characters.",
      },
      {
        label: "How BPE trains.",
        body:
          "BPE starts each training word as a list of symbols: lower becomes [l, o, w, e, r]. It counts every neighboring pair, picks the most common one, replaces every non-overlapping match, and then counts again. You have to recount because each merge creates new possible pairs.",
      },
      {
        label: "Keep pairs distinct.",
        body:
          "A pair is two separate symbols, not just the spelling you get when you join them. If you made keys with plain string concatenation, [a, bc] and [ab, c] would both turn into abc. The code uses JSON array keys like [\"l\",\"o\"] so those pairs stay separate and are easy to see while debugging.",
      },
      {
        label: "Replay merges in order.",
        body:
          "What BPE learns is an ordered list of merges. To encode new text, start with the same base symbols and try each learned merge once in its training order. For abc, applying [a,b] before [ab,c] produces [abc]. Reverse the order, and you're left with [ab,c].",
      },
      {
        label: "The system-wide tradeoff.",
        body:
          "A bigger merge budget usually makes encoded sequences shorter, but it also makes the model's embedding and output matrices larger. Tokenizer design changes context use, parameter count, serving cost, and the exact token ids the trained model expects. It's part of the model contract, not just a harmless preprocessing step.",
      },
    ],
    claims: {
      paper: "Subword representations improve open-vocabulary neural translation, especially for rare words.",
      lab: "You'll run the full BPE training and encoding algorithm on a fixed corpus and see every merge it learns.",
      limit: "The toy trainer leaves out word-boundary markers, and its compression numbers don't measure translation quality.",
    },
    diagram: {
      title: "Two BPE training rounds",
      caption: "Recount the pairs after every corpus-wide merge. When you encode a new word, replay the final merge list once in order.",
      nodes: [
        { label: "Training words", value: "l · o · w   |   l · o · w   |   l · o" },
        { label: "Round 1 counts", value: "[l,o]: 3   [o,w]: 2   → select [l,o]" },
        { label: "Merge 1", value: "[l,o] → lo   then recount the modified words" },
        { label: "Round 2 counts", value: "[lo,w]: 2   → next candidate" },
      ],
    },
    questions: {
      intro: "Ask about merge order, unknown words, vocabulary size, context length, or how BPE differs from today's byte-level tokenizers.",
      suggestions: [
        "Why does merge order matter?",
        "How does vocabulary size affect compute?",
        "Can BPE still produce unknown tokens?",
      ],
    },
    dataset: {
      name: "Morphology Set",
      source: "Original synthetic course corpus",
      license: "CC0",
      size: "6 lines · 24 words · fixed",
      preview: "signal signals signaling signaled · model models modeling modeled",
    },
    implementation: {
      filename: "bpe-tokenizer.py",
      intro: "Build the tokenizer in three separate Python cells. Pair counts use a visible key that can't confuse symbol boundaries: json.dumps([\"l\", \"o\"], separators=(\",\", \":\")) returns the string [\"l\",\"o\"]. The merge and encoder cells get each pair as a two-item list.",
      codeBlocks: [
        {
          id: "pair-counts",
          label: "Adjacent pair counts",
          purpose: "Count the possible merges across the tokenized vocabulary.",
          concepts: [
            { name: "words", detail: "A list of words, with each word stored as a list of symbols." },
            { name: "json.dumps([left, right])", detail: "Turns the two-symbol list into a short, visible key like [\"l\",\"o\"]." },
            { name: "counts", detail: "The frequency table used to pick the next merge." },
          ],
          code: `import json

def count_pairs(words):
    counts = {}
    for symbols in words:
        for index in range(len(symbols) - 1):
            pair = json.dumps(
                [symbols[index], symbols[index + 1]],
                separators=(",", ":"),
            )
            counts[pair] = counts.get(pair, 0) + 1
    return counts`,
          checkCode: `counts = count_pairs([["l", "o", "w"], ["l", "o"]])
RESULT = {
    "passed": counts['["l","o"]'] == 2 and counts['["o","w"]'] == 1,
    "detail": "[l,o] = " + str(counts['["l","o"]']),
}`,
        },
        {
          id: "merge-pair",
          label: "Merge operation",
          purpose: "Replace every match of the chosen neighboring pair.",
          concepts: [
            { name: "left", detail: "The first symbol in the chosen pair." },
            { name: "right", detail: "The second symbol in the chosen pair." },
            { name: "output", detail: "The new symbol list after replacing non-overlapping matches." },
          ],
          code: `def merge_pair(symbols, pair):
    left, right = pair
    output = []
    index = 0
    while index < len(symbols):
        if index + 1 < len(symbols) and symbols[index] == left and symbols[index + 1] == right:
            output.append(left + right)
            index += 2
        else:
            output.append(symbols[index])
            index += 1
    return output`,
          checkCode: `merged = merge_pair(["l", "o", "w", "e", "r"], ["l", "o"])
RESULT = {
    "passed": "|".join(merged) == "lo|w|e|r",
    "detail": " · ".join(merged),
}`,
        },
        {
          id: "encode-word",
          label: "Ordered encoder",
          purpose: "Run the learned merges on a new word in training order.",
          concepts: [
            { name: "merges", detail: "The ordered list learned from the training corpus." },
            { name: "symbols", detail: "How the new word is currently split up." },
            { name: "slice assignment", detail: "Replaces one neighboring pair without changing the order." },
          ],
          code: `def encode_word(word, merges):
    symbols = list(word)
    for left, right in merges:
        index = 0
        while index < len(symbols) - 1:
            if symbols[index] == left and symbols[index + 1] == right:
                symbols[index:index + 2] = [left + right]
            else:
                index += 1
    return symbols`,
          checkCode: `tokens = encode_word("lower", [["l", "o"], ["lo", "w"], ["e", "r"]])
RESULT = {
    "passed": "|".join(tokens) == "low|er",
    "detail": " · ".join(tokens),
}`,
        },
      ],
    },
    experiment: {
      kind: "bpe",
      title: "Train the tokenizer",
      intro: "Run the BPE trainer with the merge budget you choose, then inspect its merge list, learned vocabulary, and encoded length.",
    },
  } satisfies Omit<CourseLesson, "sources">;
