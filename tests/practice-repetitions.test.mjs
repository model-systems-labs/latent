import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { pythonLanguage } from "@codemirror/lang-python";
import { createServer } from "#vite-test-server";

const root = new URL("../", import.meta.url);
const PROVIDED_BROWSER_ADAPTER = "# Provided browser adapter.";

let vite;
let course;
let practiceState;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, practiceState] = await Promise.all([
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/course.ts"),
    vite.ssrLoadModule("/app/features/ide/practice-state.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function parseErrors(source) {
  const errors = [];
  pythonLanguage.parser.parse(source).iterate({
    enter(node) {
      if (node.type.isError) errors.push(source.slice(node.from, node.to));
    },
  });
  return errors;
}

test("practice rounds make only the guided pass required", () => {
  assert.deepEqual(
    practiceState.PRACTICE_ROUNDS.map(({ id, label, required }) => ({ id, label, required })),
    [
      { id: 1, label: "Guided", required: true },
      { id: 2, label: "Less help", required: false },
      { id: 3, label: "From scratch", required: false },
    ],
  );
  assert.equal(practiceState.practiceRepetitionKey("stable-softmax", 1), "stable-softmax");
  assert.equal(practiceState.practiceRepetitionKey("stable-softmax", 2), "stable-softmax::round-2");
  assert.equal(practiceState.practiceRepetitionKey("stable-softmax", 3), "stable-softmax::round-3");
});

test("authored guidance stays canonical while generated fallbacks and harder rounds stay deterministic", () => {
  const block = {
    id: "stable-softmax",
    label: "Stable softmax",
    code: `import numpy as np

def stable_softmax(logits):
    shifted = np.asarray(logits) - np.max(logits)
    weights = np.exp(shifted)
    return weights / np.sum(weights)`,
    starterCode: `import numpy as np

def stable_softmax(logits):
    shifted = np.asarray(logits) - np.max(logits)
    # TODO: normalize the shifted logits.
    raise NotImplementedError("Implement Stable softmax.")`,
  };
  const authored = block.code;
  const guided = practiceState.practiceRepetitionSource("lesson.py", block, 1);
  const lessHelp = practiceState.practiceRepetitionSource("lesson.py", block, 2);
  const fromScratch = practiceState.practiceRepetitionSource("lesson.py", block, 3);

  assert.equal(guided, block.starterCode, "course-authored guidance is the exact required first round");
  assert.match(lessHelp, /^    pass$/m);
  assert.ok(lessHelp.split("\n").filter((line) => line.trim() === "pass").length >= 2);
  assert.equal(
    fromScratch,
    `import numpy as np

def stable_softmax(logits):
    # TODO: implement stable softmax.
    raise NotImplementedError("Implement Stable softmax.")`,
  );
  assert.equal(block.code, authored, "source generation never mutates the authored reference");
  assert.equal(practiceState.starterPracticeSource("lesson.py", block), guided);
  assert.equal(
    practiceState.starterCodeFor(block, { implementation: { filename: "lesson.py" } }),
    guided,
  );

  const fallbackBlock = { ...block, id: "fallback-softmax", starterCode: undefined };
  const generatedGuided = practiceState.practiceRepetitionSource("lesson.py", fallbackBlock, 1);
  assert.match(generatedGuided, /(?:=|return) \.\.\./);
  assert.match(generatedGuided, /np\.(?:asarray|max|exp|sum)/, "fallback guidance keeps most cues visible");
  assert.equal(practiceState.starterPracticeSource("lesson.py", fallbackBlock), generatedGuided);
});

test("all 70 authored blocks have deterministic, syntax-valid progressive sources", () => {
  const exercises = course.allRoutedLessons.flatMap((lesson) => (
    lesson.implementation.codeBlocks.map((block) => ({ lesson, block }))
  ));
  assert.equal(exercises.length, 70);

  for (const { lesson, block } of exercises) {
    const authored = block.code;
    const sources = [1, 2, 3].map((round) => practiceState.practiceRepetitionSource(
      lesson.implementation.filename,
      block,
      round,
    ));
    assert.deepEqual(
      sources,
      [1, 2, 3].map((round) => practiceState.practiceRepetitionSource(
        lesson.implementation.filename,
        block,
        round,
      )),
      `${lesson.id}/${block.id} sources must be deterministic`,
    );
    assert.equal(block.code, authored, `${lesson.id}/${block.id} must retain its authored reference`);
    assert.equal(new Set(sources).size, 3, `${lesson.id}/${block.id} needs three distinct rounds`);
    if (block.starterCode) {
      assert.equal(sources[0], block.starterCode, `${lesson.id}/${block.id} must preserve its authored guidance`);
    } else {
      assert.match(sources[0], /\.\.\./, `${lesson.id}/${block.id} generated guidance needs a focused gap`);
    }
    assert.match(sources[1], /\bpass\b/, `${lesson.id}/${block.id} less-help source needs statement gaps`);
    assert.match(sources[2], /# TODO: implement /, `${lesson.id}/${block.id} needs a from-scratch TODO`);
    assert.equal(
      practiceState.starterCodeFor(block, lesson),
      sources[0],
      `${lesson.id}/${block.id} canonical starter must be round 1`,
    );
    for (const [index, source] of sources.entries()) {
      assert.deepEqual(parseErrors(source), [], `${lesson.id}/${block.id} round ${index + 1} must parse`);
    }
    for (const importLine of authored.split("\n").filter((line) => /^(?:from |import )/.test(line))) {
      assert.match(sources[2], new RegExp(`^${importLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
    }
    const postludeAt = authored.indexOf(PROVIDED_BROWSER_ADAPTER);
    if (postludeAt >= 0) {
      const exactPostlude = authored.slice(postludeAt);
      for (const source of sources) assert.ok(source.endsWith(exactPostlude));
    }
  }
});

test("optional round drafts use separate keys and incompatible saves stay out of Python", () => {
  const block = {
    id: "stable-softmax",
    label: "Stable softmax",
    code: "def stable_softmax(logits):\n    return logits",
  };
  const roundTwoKey = practiceState.practiceRepetitionKey(block.id, 2);
  const roundTwoDraft = "def stable_softmax(logits):\n    return [42]";
  assert.equal(
    practiceState.workingPracticeRepetitionSource("lesson.py", block, 2, { [roundTwoKey]: roundTwoDraft }),
    roundTwoDraft,
  );
  assert.notEqual(
    practiceState.workingPracticeRepetitionSource("lesson.py", block, 3, { [roundTwoKey]: roundTwoDraft }),
    roundTwoDraft,
  );
  assert.equal(
    practiceState.workingPracticeRepetitionSource(
      "lesson.py",
      block,
      2,
      { [roundTwoKey]: "function stableSoftmax(logits) { return logits; }" },
    ),
    practiceState.practiceRepetitionSource("lesson.py", block, 2),
  );
});

test("optional receipts bind to exact sources without changing required-round state", () => {
  const key = practiceState.practiceRepetitionKey("stable-softmax", 2);
  const empty = { answers: {}, verifiedSources: {}, verifiedContractVersion: null };
  const edited = practiceState.editPracticeRepetition(empty, key, "attempt one");
  const verified = practiceState.verificationAfterPracticeRepetitionRun(
    edited,
    key,
    "attempt one",
    true,
    "contracts-v2",
  );
  assert.deepEqual(verified, {
    answers: { [key]: "attempt one" },
    verifiedSources: { [key]: "attempt one" },
    verifiedContractVersion: "contracts-v2",
  });
  assert.equal(
    practiceState.practiceRepetitionIsVerified(verified, key, "attempt one", "contracts-v2"),
    true,
  );
  assert.equal(
    practiceState.practiceRepetitionIsVerified(verified, key, "changed", "contracts-v2"),
    false,
  );
  assert.deepEqual(
    practiceState.editPracticeRepetition(verified, key, "changed"),
    {
      answers: { [key]: "changed" },
      verifiedSources: {},
      verifiedContractVersion: null,
    },
  );
  assert.deepEqual(
    practiceState.restorePracticeRepetitionVerification(verified, "contracts-v3"),
    {
      answers: { [key]: "attempt one" },
      verifiedSources: {},
      verifiedContractVersion: null,
    },
  );
  assert.deepEqual(
    practiceState.verificationAfterPracticeRepetitionRun(
      verified,
      key,
      "attempt two",
      false,
      "contracts-v2",
    ),
    {
      answers: { [key]: "attempt two" },
      verifiedSources: {},
      verifiedContractVersion: null,
    },
  );
});
