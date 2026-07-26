import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

let browserPython;
let lessons;
let vite;

const expectedLessons = {
  "character-rnns": {
    filename: "character-rnn.py",
    blocks: {
      "rnn-step": "rnn_step",
      "cross-entropy": "cross_entropy",
      "gradient-clipping": "clip_gradients",
    },
  },
  "neural-language-models": {
    filename: "neural-language-model.py",
    blocks: {
      "stable-softmax": "stable_softmax",
      "context-embedding": "context_embedding",
      "negative-log-likelihood": "negative_log_likelihood",
    },
  },
  "subword-tokenization": {
    filename: "bpe-tokenizer.py",
    blocks: {
      "pair-counts": "count_pairs",
      "merge-pair": "merge_pair",
      "encode-word": "encode_word",
    },
  },
  "additive-attention": {
    filename: "additive-attention.py",
    blocks: {
      "additive-score": "additive_score",
      "attention-softmax": "attention_weights",
      "context-vector": "context_vector",
    },
  },
  transformers: {
    filename: "causal-transformer.py",
    blocks: {
      "causal-mask": "causal_mask",
      "scaled-attention": "scaled_dot_product_attention",
      "layer-norm": "layer_norm",
    },
  },
  "in-context-learning": {
    filename: "few-shot-evaluation.py",
    blocks: {
      "format-demonstrations": "format_demonstrations",
      "build-prompt": "build_prompt",
      "exact-match": "exact_match_label",
    },
  },
  "neural-text-degeneration": {
    filename: "nucleus-sampling.py",
    blocks: {
      softmax: "softmax",
      nucleus: "nucleus",
      policy: null,
      contract: "enforce_output_contract",
    },
  },
};

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  const [course, paper] = await Promise.all([
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/course.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/neural-text-degeneration.ts"),
  ]);
  lessons = [
    ...course.courseLessons.filter((lesson) => lesson.id in expectedLessons),
    paper.neuralTextDegenerationLesson,
  ];

  const packageManifestUrl = import.meta.resolve("pyodide/package.json");
  browserPython = await loadPyodide({
    indexURL: fileURLToPath(new URL(".", packageManifestUrl)),
  });
});

after(async () => {
  browserPython?.globals.delete("__latent_lesson_source");
  await vite?.close();
});

test("model lesson filenames, block IDs, and Python exports stay stable", () => {
  assert.equal(lessons.length, Object.keys(expectedLessons).length);
  for (const lesson of lessons) {
    const expected = expectedLessons[lesson.id];
    assert.ok(expected, lesson.id);
    assert.equal(lesson.implementation.filename, expected.filename);
    assert.deepEqual(
      lesson.implementation.codeBlocks.map((block) => block.id),
      Object.keys(expected.blocks),
    );
    for (const block of lesson.implementation.codeBlocks) {
      const exportName = expected.blocks[block.id];
      if (exportName) {
        assert.match(
          block.code,
          new RegExp(`(^|\\n)def ${exportName}\\(`),
          `${lesson.id}/${block.id} must define ${exportName}`,
        );
      } else {
        assert.match(block.code, /^policy = \{/);
      }
    }
  }
});

test("every evaluated solution and check compiles under the pinned browser CPython", () => {
  for (const lesson of lessons) {
    for (const block of lesson.implementation.codeBlocks) {
      for (const [kind, source] of [
        ["solution", block.code],
        ["check", block.checkCode],
      ]) {
        if (!source) continue;
        browserPython.globals.set("__latent_lesson_source", source);
        try {
          browserPython.runPython("import ast; ast.parse(__latent_lesson_source); True");
        } catch (error) {
          assert.fail(`${lesson.id}/${block.id} ${kind} is not valid Python: ${error}`);
        }
      }
    }
  }
});

test("course checks use the structured RESULT contract and contain no JavaScript starters", () => {
  for (const lesson of lessons) {
    for (const block of lesson.implementation.codeBlocks) {
      assert.doesNotMatch(block.code, /\bfunction\b|=>|\bconst\b|\blet\b/);
      if (lesson.id === "neural-text-degeneration") continue;
      assert.match(block.checkCode, /(^|\n)RESULT = \{/);
      assert.doesNotMatch(block.checkCode, /\breturn\s+\{|===|=>|\bconst\b|\blet\b/);
    }
  }
});
