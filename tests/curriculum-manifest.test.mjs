import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "#vite-test-server";

let vite;
let course;
let manifestModule;
let lms;
let fileStatus;
let contracts;
let practiceFeedback;
let contractRuntime;
let practiceState;
let learnerStateModule;
let artifactBlueprints;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, manifestModule, lms, fileStatus, contracts, practiceFeedback, contractRuntime, practiceState, learnerStateModule, artifactBlueprints] = await Promise.all([
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/course.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/llm-systems/manifest.ts"),
    vite.ssrLoadModule("/packages/course-kit/src/curriculum.ts"),
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/features/ide/practice-feedback.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/contracts.ts"),
    vite.ssrLoadModule("/app/features/ide/practice-state.ts"),
    vite.ssrLoadModule("/app/lib/learner-state.ts"),
    vite.ssrLoadModule("/app/features/artifacts/lesson-blueprints.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function assertPythonExport(block, exportName) {
  assert.ok(block);
  assert.match(
    block.code,
    new RegExp(`(^|\\n)def ${exportName}\\(`),
    `${block.id} must expose the contracted Python callable ${exportName}`,
  );
  assert.doesNotMatch(block.code, /\bfunction\b|=>|\bconst\b|\blet\b/);
}

test("one LLM Systems program owns four technical modules and every lesson", () => {
  const curriculum = course.llmSystemsCurriculum;
  assert.equal(curriculum.title, "Build an LLM System in Your Browser");
  assert.deepEqual(
    curriculum.modules.map((module) => module.title),
    ["Model Foundations", "Inference Runtime", "LLM Serving", "Chat Integration"],
  );
  assert.equal(curriculum.lessonCount, 14);
  assert.equal(curriculum.testCount, 34);
  assert.equal(curriculum.lessons.length, curriculum.lessonCount);
  assert.equal(new Set(curriculum.lessons.map((lesson) => lesson.id)).size, 14);
  assert.doesNotMatch(JSON.stringify(curriculum.modules), /Mock Backend Systems/);

  for (const curriculumModule of curriculum.modules) {
    assert.equal(curriculumModule.lessonCount, curriculumModule.lessons.length);
    assert.equal(
      curriculumModule.testCount,
      curriculumModule.lessons.reduce((total, lesson) => total + lesson.testCount, 0),
    );
  }
});

test("module identity is independent from stable saved-project paths", () => {
  const curriculum = course.llmSystemsCurriculum;
  for (const entry of curriculum.lessons) {
    assert.equal(
      entry.projectPath,
      `${entry.lesson.courseId}/${entry.lesson.implementation.filename}`,
    );
    assert.notEqual(entry.moduleId, entry.projectPath.split("/")[0]);
    assert.equal(curriculum.lessonById[entry.id], entry);
  }
  assert.deepEqual(
    curriculum.modules.map((module) => module.routeSlug),
    ["models", "systems", "backend", "product"],
  );
});

test("model dataset records and reference frames match the supplied runtimes", () => {
  const expectedSizes = {
    "character-rnns": "1,610 characters · fixed repeatable sequence",
    "neural-language-models": "20 sentences · fixed example-by-example modulo split",
    "subword-tokenization": "6 lines · 24 words · fixed",
    "additive-attention": "3 semantic roles · 3 fixed alignment cases · 2,000 epochs",
    transformers: "1 fixed six-token sequence",
    "in-context-learning": "4 demonstrations · 2 held-out cases",
  };
  for (const [lessonId, size] of Object.entries(expectedSizes)) {
    assert.equal(course.courseLessons.find((lesson) => lesson.id === lessonId)?.dataset.size, size);
  }
  const character = artifactBlueprints.lessonArtifactBlueprintById.get("character-rnns");
  const bpe = artifactBlueprints.lessonArtifactBlueprintById.get("subword-tokenization");
  const additive = artifactBlueprints.lessonArtifactBlueprintById.get("additive-attention");
  const transformer = artifactBlueprints.lessonArtifactBlueprintById.get("transformers");
  const icl = artifactBlueprints.lessonArtifactBlueprintById.get("in-context-learning");
  assert.match(character.frames[2].payload.operation, /Why · h_t/);
  assert.equal(bpe.payload.decoder, "not implemented");
  assert.equal(additive.frames[0].payload.keys, 3);
  assert.equal(transformer.payload.projections, "identity in reference experiment");
  assert.equal("residual" in transformer.payload, false);
  assert.equal(icl.frames[2].payload.demonstrations, 4);
});

test("manifest validation rejects ambiguous files and unreachable source lessons", () => {
  const duplicatePathManifest = structuredClone(manifestModule.llmSystemsManifest);
  duplicatePathManifest.modules[1].lessons[0].projectPath =
    duplicatePathManifest.modules[0].lessons[0].projectPath;
  const issues = lms.validateCurriculumManifest(duplicatePathManifest);
  assert.ok(issues.some((issue) => /projectPath duplicates/.test(issue.message)));

  const sourceLessons = course.courseLessons.map((lesson) => ({
    id: lesson.id,
    implementation: lesson.implementation,
  }));
  sourceLessons.push({
    id: "unassigned-lesson",
    implementation: { filename: "unassigned.py", codeBlocks: [] },
  });
  assert.throws(
    () => lms.deriveCurriculum(manifestModule.llmSystemsManifest, sourceLessons),
    /source lesson is not assigned to a module: unassigned-lesson/,
  );
});

test("Character RNN practice catches missing recurrent state and explains the failing behavior", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "character-rnns");
  assert.ok(lesson);
  const lessonCopy = lesson.summary.map((section) => `${section.label} ${section.body}`).join(" ");
  assert.match(lessonCopy, /Teacher forcing vs\. sampled generation/);
  assert.match(lessonCopy, /real corpus character.*cross-entropy target.*next input/);
  assert.match(lessonCopy, /sample a character.*next input/);
  assert.match(lesson.diagram.caption, /With teacher forcing.*model doesn't feed its guess back in/);

  const contract = contracts.llmSystemsExerciseContracts.find((candidate) => candidate.id === "character-rnns/rnn-step");
  assert.ok(contract);
  assert.equal(contract.cases.length, 4);
  const recurrentCase = contract.cases.find((candidate) => candidate.id === "non-empty-recurrent-state");
  assert.ok(recurrentCase);
  assert.match(recurrentCase.label, /previous hidden state/);

  const detail = practiceFeedback.formatPracticeContractDetail([{
    contractId: contract.id,
    contractLabel: contract.label,
    caseId: recurrentCase.id,
    caseLabel: recurrentCase.label,
    observationStatus: "returned",
    passed: false,
    detail: "2 host-owned assertions failed.",
    assertions: recurrentCase.assertions.map((assertion) => ({
      assertionId: assertion.id,
      label: assertion.label,
      passed: false,
      detail: "the returned value is outside the expected range.",
    })),
  }]);
  assert.match(detail, /Use Whh and the previous state before tanh/);
  assert.match(detail, /outside the expected range/);
});

test("Character RNN contracts reject plausible semantic shortcuts and accept the references", () => {
  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const rnn = byId.get("character-rnns/rnn-step");
  assert.ok(rnn);
  const project = (matrix, vector) => matrix.map((row) => row.reduce((sum, weight, index) => sum + weight * vector[index], 0));
  const diagonalOnlyProject = (matrix, vector) => matrix.map((row, index) =>
    (row[index] ?? 0) * (vector[index] ?? 0));
  rejects(rnn, (input, _previous, weights) => project(weights.Wxh, input).map(Math.tanh));
  rejects(rnn, (input, previous, weights) => project(weights.Wxh, input).map((value, index) => value + project(weights.Whh, previous)[index] + weights.bias[index]));
  rejects(rnn, (input, previous, weights) => {
    const inputProjection = diagonalOnlyProject(weights.Wxh, input);
    const stateProjection = diagonalOnlyProject(weights.Whh, previous);
    return inputProjection.map((value, index) => Math.tanh(value + stateProjection[index] + weights.bias[index]));
  });
  accepts(rnn, (input, previous, weights) => project(weights.Wxh, input).map((value, index) => Math.tanh(value + project(weights.Whh, previous)[index] + weights.bias[index])));

  const loss = byId.get("character-rnns/cross-entropy");
  assert.ok(loss);
  rejects(loss, (probabilities, targetIndex) => probabilities[targetIndex]);
  rejects(loss, (probabilities, targetIndex) => Math.log(probabilities[targetIndex]));
  rejects(loss, (probabilities) => -Math.log(probabilities[1]));
  accepts(loss, (probabilities, targetIndex) => -Math.log(probabilities[targetIndex]));

  const clipping = byId.get("character-rnns/gradient-clipping");
  assert.ok(clipping);
  rejects(clipping, (gradients, limit) => gradients.map((value) => Math.min(value, limit)));
  rejects(clipping, (gradients, limit) => gradients.map((value) => Math.max(value, -limit)));
  rejects(clipping, (gradients) => gradients.map((value) => Math.max(-5, Math.min(5, value))));
  accepts(clipping, (gradients, limit) => gradients.map((value) => Math.max(-limit, Math.min(limit, value))));
});

test("Neural Language Model contracts reject plausible shortcuts and give one actionable direction", () => {
  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const softmax = byId.get("neural-language-models/stable-softmax");
  assert.ok(softmax);
  const rawExponentials = (logits) => {
    const weights = logits.map(Math.exp);
    const total = weights.reduce((sum, value) => sum + value, 0);
    return weights.map((value) => value / total);
  };
  rejects(softmax, rawExponentials);
  rejects(softmax, (logits) => {
    const total = logits.reduce((sum, value) => sum + value, 0);
    return logits.map((value) => value / total);
  });
  accepts(softmax, (logits) => {
    const maximum = Math.max(...logits);
    const weights = logits.map((value) => Math.exp(value - maximum));
    const total = weights.reduce((sum, value) => sum + value, 0);
    return weights.map((value) => value / total);
  });
  const softmaxFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(softmax, rawExponentials));
  assert.match(softmaxFeedback, /Subtract max\(logits\) before exponentiating/);
  assert.equal((softmaxFeedback.match(/Subtract max\(logits\)/g) ?? []).length, 1);

  const context = byId.get("neural-language-models/context-embedding");
  assert.ok(context);
  rejects(context, (indices, embeddings) => embeddings[indices[0]]);
  rejects(context, (indices, embeddings) => indices.reduce(
    (sum, index) => sum.map((value, coordinate) => value + embeddings[index][coordinate]),
    Array(embeddings[0].length).fill(0),
  ));
  accepts(context, (indices, embeddings) => indices.reduce(
    (sum, index) => sum.map((value, coordinate) => value + embeddings[index][coordinate] / indices.length),
    Array(embeddings[0].length).fill(0),
  ));

  const loss = byId.get("neural-language-models/negative-log-likelihood");
  assert.ok(loss);
  rejects(loss, (probabilities, targetIndex) => probabilities[targetIndex]);
  rejects(loss, (probabilities, targetIndex) => Math.log(probabilities[targetIndex]));
  rejects(loss, (probabilities) => -Math.log(Math.max(probabilities[1], 1e-12)));
  accepts(loss, (probabilities, targetIndex) => -Math.log(Math.max(probabilities[targetIndex], 1e-12)));
});

test("Subword Tokenization exposes pair identity and rejects shortcuts in every cell", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "subword-tokenization");
  const pairBlock = lesson?.implementation.codeBlocks.find((block) => block.id === "pair-counts");
  assert.ok(pairBlock);
  assert.match(
    pairBlock.code,
    /^import json\n\ndef count_pairs\(words\):/,
    "the practice starter must target the contracted count_pairs export",
  );

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const countPairs = byId.get("subword-tokenization/pair-counts");
  assert.ok(countPairs);
  const concatenatedKeys = (words) => {
    const counts = {};
    for (const symbols of words) for (let index = 0; index < symbols.length - 1; index += 1) {
      const key = symbols[index] + symbols[index + 1];
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  const uniquePairsOnly = (words) => {
    const counts = {};
    for (const symbols of words) for (let index = 0; index < symbols.length - 1; index += 1) {
      counts[JSON.stringify([symbols[index], symbols[index + 1]])] = 1;
    }
    return counts;
  };
  const referenceCounts = (words) => {
    const counts = {};
    for (const symbols of words) for (let index = 0; index < symbols.length - 1; index += 1) {
      const key = JSON.stringify([symbols[index], symbols[index + 1]]);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  rejects(countPairs, concatenatedKeys);
  rejects(countPairs, uniquePairsOnly);
  accepts(countPairs, referenceCounts);
  const pairFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(countPairs, concatenatedKeys));
  assert.match(pairFeedback, /json\.dumps/);
  assert.match(pairFeedback, /2 more cases still fail; run the checks again after this fix/);

  const mergePair = byId.get("subword-tokenization/merge-pair");
  assert.ok(mergePair);
  const firstOccurrenceOnly = (symbols, [left, right]) => {
    const index = symbols.findIndex((symbol, position) => symbol === left && symbols[position + 1] === right);
    return index < 0 ? [...symbols] : [...symbols.slice(0, index), left + right, ...symbols.slice(index + 2)];
  };
  const overlappingReplacement = (symbols, [left, right]) => {
    const output = [];
    for (let index = 0; index < symbols.length; index += 1) {
      if (symbols[index] === left && symbols[index + 1] === right) output.push(left + right);
      else output.push(symbols[index]);
    }
    return output;
  };
  const referenceMerge = (symbols, [left, right]) => {
    const output = [];
    for (let index = 0; index < symbols.length; index += 1) {
      if (symbols[index] === left && symbols[index + 1] === right) {
        output.push(left + right);
        index += 1;
      } else output.push(symbols[index]);
    }
    return output;
  };
  rejects(mergePair, firstOccurrenceOnly);
  rejects(mergePair, overlappingReplacement);
  accepts(mergePair, referenceMerge);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(mergePair, firstOccurrenceOnly)), /Continue scanning after the first match/);

  const encodeWord = byId.get("subword-tokenization/encode-word");
  assert.ok(encodeWord);
  const replay = (word, merges, reverse = false, firstOnly = false) => {
    const symbols = [...word];
    const ordered = reverse ? [...merges].reverse() : merges;
    for (const [left, right] of ordered) {
      for (let index = 0; index < symbols.length - 1; index += 1) {
        if (symbols[index] === left && symbols[index + 1] === right) {
          symbols.splice(index, 2, left + right);
          if (firstOnly) break;
          index -= 1;
        }
      }
    }
    return symbols;
  };
  rejects(encodeWord, (word, merges) => replay(word, merges, true));
  rejects(encodeWord, (word, merges) => replay(word, merges, false, true));
  accepts(encodeWord, (word, merges) => replay(word, merges));
  const orderFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(
    encodeWord,
    (word, merges) => replay(word, merges, true),
  ));
  assert.match(orderFeedback, /array order|Replay each learned merge once in order/);
});

test("Additive Attention teaches the scoring network and rejects shortcuts in every cell", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "additive-attention");
  assert.ok(lesson);
  const decoderStep = lesson.summary.find((section) => section.label === "One decoding step.");
  assert.ok(decoderStep);
  assert.ok(decoderStep.body.indexOf("The encoder reads") < decoderStep.body.indexOf("In notation"));
  assert.match(decoderStep.body, /decoder produces the target one token at a time/);
  assert.match(decoderStep.body, /current state becomes the query q_t/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));
  const project = (matrix, vector) => matrix.map((row) =>
    row.reduce((sum, weight, index) => sum + weight * vector[index], 0));

  const score = byId.get("additive-attention/additive-score");
  assert.ok(score);
  const dotProduct = (query, key) => query.reduce((sum, value, index) => sum + value * key[index], 0);
  const linearScore = (query, key, { Wq, Wk, v, bias }) => {
    const queryTerm = project(Wq, query);
    const keyTerm = project(Wk, key);
    return v.reduce((sum, value, index) => sum + value * (queryTerm[index] + keyTerm[index] + bias[index]), 0);
  };
  const additiveScore = (query, key, { Wq, Wk, v, bias }) => {
    const queryTerm = project(Wq, query);
    const keyTerm = project(Wk, key);
    return v.reduce((sum, value, index) =>
      sum + value * Math.tanh(queryTerm[index] + keyTerm[index] + bias[index]), 0);
  };
  rejects(score, dotProduct);
  rejects(score, linearScore);
  rejects(score, (query, key, { Wq, Wk, v, bias }) => {
    const diagonalProject = (matrix, vector) => matrix.map((row, index) =>
      (row[index] ?? 0) * (vector[index] ?? 0));
    const queryTerm = diagonalProject(Wq, query);
    const keyTerm = diagonalProject(Wk, key);
    return v.reduce((sum, value, index) =>
      sum + value * Math.tanh(queryTerm[index] + keyTerm[index] + bias[index]), 0);
  });
  accepts(score, additiveScore);
  const scoreFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(score, dotProduct));
  assert.match(scoreFeedback, /Wq/);
  assert.match(scoreFeedback, /3 more cases still fail; run the checks again after this fix/);
  assert.doesNotMatch(scoreFeedback, /Wk|plain query-key dot product/);

  const weights = byId.get("additive-attention/attention-softmax");
  assert.ok(weights);
  rejects(weights, (scores) => Array(scores.length).fill(1 / scores.length));
  rejects(weights, (scores) => {
    const total = scores.reduce((sum, value) => sum + value, 0);
    return scores.map((value) => value / total);
  });
  rejects(weights, (scores) => {
    const exponentials = scores.map(Math.exp);
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    return exponentials.map((value) => value / total);
  });
  rejects(weights, (scores) => {
    const fixedScores = scores.slice(0, 3);
    const maximum = Math.max(...fixedScores);
    const exponentials = fixedScores.map((value) => Math.exp(value - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    return exponentials.map((value) => value / total);
  });
  accepts(weights, (scores) => {
    const maximum = Math.max(...scores);
    const exponentials = scores.map((value) => Math.exp(value - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    return exponentials.map((value) => value / total);
  });
  const weightFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(
    weights,
    (scores) => Array(scores.length).fill(1 / scores.length),
  ));
  assert.match(weightFeedback, /one softmax across the whole scores array/);
  assert.equal((weightFeedback.match(/whole scores array/g) ?? []).length, 1);

  const context = byId.get("additive-attention/context-vector");
  assert.ok(context);
  const average = (states) => states[0].map((_, coordinate) =>
    states.reduce((sum, state) => sum + state[coordinate], 0) / states.length);
  const winnerTakeAll = (states, alphas) => states[alphas.indexOf(Math.max(...alphas))];
  const weightedSum = (states, alphas) => states[0].map((_, coordinate) =>
    states.reduce((sum, state, index) => sum + state[coordinate] * alphas[index], 0));
  rejects(context, average);
  rejects(context, winnerTakeAll);
  accepts(context, weightedSum);
  const contextFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(context, average));
  assert.match(contextFeedback, /Multiply each state by its corresponding alpha, then sum coordinate-wise/);
});

test("Transformers teaches the causal attention computation and rejects semantic shortcuts in every cell", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "transformers");
  assert.ok(lesson);
  assert.match(lesson.summary.map((section) => section.body).join(" "), /QKᵀ/);
  assert.match(lesson.summary.map((section) => section.body).join(" "), /Then apply softmax across that row/);
  assert.match(lesson.diagram.caption, /worked three-token pass/i);
  const layerNormBlock = lesson.implementation.codeBlocks.find((block) => block.id === "layer-norm");
  assert.ok(layerNormBlock);
  assert.equal(layerNormBlock.label, "Non-affine layer normalization");
  assert.match(layerNormBlock.purpose, /learned gain gamma and bias beta/);
  assert.match(layerNormBlock.concepts.map((concept) => concept.detail).join(" "), /Full layer norm.*learned gain gamma and bias beta/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const causalMask = byId.get("transformers/causal-mask");
  assert.ok(causalMask);
  const maskedValue = { $number: "-Infinity" };
  const maskBy = (scores, predicate) => scores.map((row, rowIndex) =>
    row.map((score, columnIndex) => predicate(rowIndex, columnIndex) ? maskedValue : score));
  rejects(causalMask, (scores) => scores);
  rejects(causalMask, (scores) => maskBy(scores, (row, column) => column < row));
  rejects(causalMask, (scores) => maskBy(scores, (row, column) => column !== row));
  accepts(causalMask, (scores) => maskBy(scores, (row, column) => column > row));
  const maskFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(causalMask, (scores) => scores));
  assert.match(maskFeedback, /column > row/);

  const attention = byId.get("transformers/scaled-attention");
  assert.ok(attention);
  const softmax = (scores) => {
    const maximum = Math.max(...scores);
    const weights = scores.map((score) => Math.exp(score - maximum));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map((weight) => weight / total);
  };
  const attentionWithScale = (query, keys, values, scale) => {
    const scores = keys.map((key) => key.reduce((sum, value, index) => sum + value * query[index], 0) / scale);
    const probabilities = softmax(scores);
    return values[0].map((_, coordinate) =>
      values.reduce((sum, value, index) => sum + value[coordinate] * probabilities[index], 0));
  };
  rejects(attention, (query, keys, values) => attentionWithScale(query, keys, values, 1));
  rejects(attention, (query, keys, values) => attentionWithScale(query, keys, values, Math.sqrt(keys.length)));
  rejects(attention, (query, keys) => softmax(keys.map((key) => key.reduce((sum, value, index) => sum + value * query[index], 0))));
  rejects(attention, (query, keys, values) => values[keys.map((key) => key.reduce((sum, value, index) => sum + value * query[index], 0)).indexOf(Math.max(...keys.map((key) => key.reduce((sum, value, index) => sum + value * query[index], 0))))]);
  rejects(attention, (_query, _keys, values) => values[0].map((_, coordinate) => values.reduce((sum, value) => sum + value[coordinate], 0) / values.length));
  accepts(attention, (query, keys, values) => attentionWithScale(query, keys, values, Math.sqrt(query.length)));
  const attentionFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(
    attention,
    (query, keys, values) => attentionWithScale(query, keys, values, 1),
  ));
  assert.match(attentionFeedback, /Divide query-key scores by sqrt\(query width\) before softmax/);

  const layerNorm = byId.get("transformers/layer-norm");
  assert.ok(layerNorm);
  const variance = (vector, mean) => vector.reduce((sum, value) => sum + (value - mean) ** 2, 0) / vector.length;
  rejects(layerNorm, (vector, epsilon = 1e-5) => {
    const rms = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0) / vector.length + epsilon);
    return vector.map((value) => value / rms);
  });
  rejects(layerNorm, (vector, epsilon = 1e-5) => {
    const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
    const scale = variance(vector, mean) + epsilon;
    return vector.map((value) => (value - mean) / scale);
  });
  rejects(layerNorm, (vector) => {
    const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
    const scale = Math.sqrt(variance(vector, mean) + 1e-5);
    return vector.map((value) => (value - mean) / scale);
  });
  accepts(layerNorm, (vector, epsilon = 1e-5) => {
    const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
    const scale = Math.sqrt(variance(vector, mean) + epsilon);
    return vector.map((value) => (value - mean) / scale);
  });
  const normFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(layerNorm, (vector) => {
    const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
    return vector.map((value) => value - mean);
  }));
  assert.match(normFeedback, /divide by sqrt\(variance \+ epsilon\)/);
});

test("In-Context Learning holds the experiment constant and rejects prompt and scoring shortcuts", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "in-context-learning");
  assert.ok(lesson);
  assert.match(lesson.summary[0].body, /hidden activations and KV cache/);
  assert.match(lesson.diagram.title, /Controlled zero-, one-, and few-shot comparison/);
  assert.match(lesson.diagram.caption, /not whether few-shot prompting works in general/);
  assert.match(lesson.summary.find((section) => section.label === "Keep the comparison fair.")?.body ?? "", /provided local evaluator.*doesn't import or run your prompt and scoring functions/);
  assert.match(lesson.experiment.intro, /compare zero-, one-, and four-example prompts on the same two held-out items/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const formatter = byId.get("in-context-learning/format-demonstrations");
  assert.ok(formatter);
  rejects(formatter, (examples) => [...examples].reverse().map(({ input, label }) => `Input: ${input}\nLabel: ${label}`).join("\n\n"));
  rejects(formatter, (examples) => examples.filter(({ input }) => input.trim()).map(({ input, label }) => `Input: ${input}\nLabel: ${label}`).join("\n"));
  accepts(formatter, (examples) => examples.map(({ input, label }) => `Input: ${input.trim()}\nLabel: ${label.trim()}`).join("\n\n"));
  const formatterFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(formatter, (examples) =>
    [...examples].reverse().map(({ input, label }) => `Input: ${input}\nLabel: ${label}`).join("\n\n")));
  assert.match(formatterFeedback, /Keep the examples in order/);

  const prompt = byId.get("in-context-learning/build-prompt");
  assert.ok(prompt);
  rejects(prompt, ({ instruction, demonstrations, query }) => [instruction.trim(), demonstrations.trim(), `Input: ${query.trim()}\nLabel:`].join("\n\n"));
  rejects(prompt, ({ demonstrations, query }) => [demonstrations.trim(), `Input: ${query.trim()}\nLabel:`].filter(Boolean).join("\n\n"));
  accepts(prompt, ({ instruction, demonstrations, query }) => {
    const sections = [instruction.trim()];
    if (demonstrations.trim()) sections.push(demonstrations.trim());
    sections.push(`Input: ${query.trim()}\nLabel:`);
    return sections.join("\n\n");
  });
  const promptFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(prompt, ({ demonstrations, query }) =>
    [demonstrations.trim(), `Input: ${query.trim()}\nLabel:`].filter(Boolean).join("\n\n")));
  assert.match(promptFeedback, /instruction/);
  assert.match(promptFeedback, /Label:/);

  const scorer = byId.get("in-context-learning/exact-match");
  assert.ok(scorer);
  rejects(scorer, (output, expected) => ({ predicted: output.includes(expected) ? expected : null, passed: output.includes(expected) }));
  rejects(scorer, (output, expected, allowedLabels = ["K", "M"]) => {
    const match = output.toUpperCase().match(new RegExp(`\\b(${allowedLabels.join("|")})\\b`));
    const predicted = match?.[1] ?? null;
    return { predicted, passed: predicted === expected };
  });
  const scorerBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "exact-match");
  assert.ok(scorerBlock);
  assert.match(scorerBlock.code, /^def exact_match_label\(/);
  accepts(scorer, (output, expected, allowedLabels = ["K", "M"]) => {
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
        if (!isWord(before) && !isWord(after) && (!match || index < match.index)) {
          match = { index, label };
        }
        start = index + Math.max(1, label.length);
      }
    }
    const predicted = match?.label ?? null;
    return { predicted, passed: predicted === expected };
  });
  const scorerFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(scorer, (output, expected) => ({
    predicted: output.includes(expected) ? expected : null,
    passed: output.includes(expected),
  })));
  assert.match(scorerFeedback, /independently/);
  assert.match(scorerFeedback, /more cases still fail; run the checks again after this fix/);
  assert.doesNotMatch(scorerFeedback, /first standalone/);
});

test("Inference Runtime separates sampled tokens from decode forwards and sizes every KV factor", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "inference-runtime");
  assert.ok(lesson);
  assert.match(lesson.thesis, /cached sequence positions/);
  assert.match(lesson.summary[0].body, /max\(0, N - 1\)/);
  assert.match(lesson.summary[1].body, /2 × layers × KV heads × tokens × head dimension × bytes per value/);
  assert.match(lesson.summary[3].body, /Time to first token \(TTFT\)/);
  assert.match(lesson.summary[3].body, /Inter-token latency \(ITL\)/);
  assert.equal(lesson.diagram.title, "Worked request r-104");
  assert.match(lesson.diagram.caption, /31 later decode forwards/);
  assert.match(lesson.dataset.preview, /final length 128 · 1 prefill \+ 31 decode forwards/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const phases = byId.get("inference-runtime/inference-phases");
  assert.ok(phases);
  assert.equal(phases.cases.length, 3);
  rejects(phases, (promptTokens, maxNewTokens) => ({
    prefillTokens: promptTokens,
    generatedTokens: maxNewTokens,
    decodeForwards: maxNewTokens,
    processedTokenPositions: promptTokens + maxNewTokens,
    finalSequenceLength: promptTokens + maxNewTokens,
  }));
  rejects(phases, (promptTokens, maxNewTokens) => ({
    prefillTokens: promptTokens,
    generatedTokens: maxNewTokens,
    decodeForwards: maxNewTokens - 1,
    processedTokenPositions: promptTokens + maxNewTokens - 1,
    finalSequenceLength: promptTokens + maxNewTokens,
  }));
  accepts(phases, (promptTokens, maxNewTokens) => {
    const generatedTokens = Math.max(0, maxNewTokens);
    const decodeForwards = Math.max(0, generatedTokens - 1);
    return {
      prefillTokens: promptTokens,
      generatedTokens,
      decodeForwards,
      processedTokenPositions: promptTokens + decodeForwards,
      finalSequenceLength: promptTokens + generatedTokens,
    };
  });
  const phaseFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(phases, (promptTokens, maxNewTokens) => ({
    prefillTokens: promptTokens,
    generatedTokens: maxNewTokens,
    decodeForwards: maxNewTokens,
    processedTokenPositions: promptTokens + maxNewTokens,
    finalSequenceLength: promptTokens + maxNewTokens,
  })));
  assert.match(phaseFeedback, /31 later decode passes because the prefill logits sample token 1/);
  assert.match(phaseFeedback, /1 more case still fails; run the checks again after this fix/);
  assert.doesNotMatch(phaseFeedback, /Do not count the final sampled token as another processed input/);

  const cache = byId.get("inference-runtime/kv-bytes");
  assert.ok(cache);
  assert.equal(cache.cases.length, 6);
  rejects(cache, ({ layers, kvHeads, headDimension, tokens, bytesPerValue = 2 }) =>
    layers * kvHeads * headDimension * tokens * bytesPerValue);
  rejects(cache, ({ kvHeads, headDimension, tokens, bytesPerValue = 2 }) =>
    2 * kvHeads * headDimension * tokens * bytesPerValue);
  rejects(cache, ({ layers, heads, headDimension, tokens, bytesPerValue = 2 }) =>
    2 * layers * heads * headDimension * tokens * bytesPerValue);
  accepts(cache, ({ layers, kvHeads, headDimension, tokens, bytesPerValue = 2 }) =>
    2 * layers * kvHeads * headDimension * tokens * bytesPerValue);
  const cacheFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(cache, ({ layers, kvHeads, headDimension, tokens, bytesPerValue = 2 }) =>
    layers * kvHeads * headDimension * tokens * bytesPerValue));
  assert.equal(
    evaluate(cache, ({ layers, kvHeads, headDimension, tokens, bytesPerValue = 2 }) =>
      layers * kvHeads * headDimension * tokens * bytesPerValue).filter((result) => !result.passed).length,
    6,
    "the formatter must not discard complete host results",
  );
  assert.match(cacheFeedback, /Multiply by 2 because every cached position stores both key and value/);
  assert.match(cacheFeedback, /5 more cases still fail; run the checks again after this fix/);
  assert.doesNotMatch(cacheFeedback, /all 3 layers|kvHeads|headDimension|FP32/);
});

test("Streaming Transport separates byte decoding, frame carry, typed events, and cancellation", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "streaming-transport");
  assert.ok(lesson);
  assert.match(lesson.summary[0].body, /TextDecoder\.decode\(chunk, \{ stream: true \}\)/);
  assert.match(lesson.summary[0].body, /decoded text, never raw bytes/);
  assert.match(lesson.summary[1].body, /LF or CRLF/);
  assert.match(lesson.summary[1].body, /"message" as the default event name/);
  assert.match(lesson.summary[3].body, /AbortSignal must stop the reader, parser, and generator/);
  assert.match(lesson.summary[3].body, /Render buffering is different/);
  assert.equal(lesson.diagram.title, "One token across arbitrary chunks");
  assert.match(lesson.diagram.caption, /TextDecoder owns byte carry/);
  assert.match(lesson.experiment.intro, /cancellation after four tokens/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const observe = (implementation, args) => {
    try {
      return { status: "returned", value: implementation(...args) };
    } catch (reason) {
      return {
        status: "threw",
        errorName: reason instanceof Error ? reason.name : "Error",
        message: reason instanceof Error ? reason.message : String(reason),
      };
    }
  };
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, observe(implementation, exerciseCase.invoke.args)));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));

  const encoder = byId.get("streaming-transport/encode-sse");
  assert.ok(encoder);
  assert.equal(encoder.cases.length, 4);
  const missingBlankLine = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n`;
  const manualPayload = (event, data) => `event: ${event}\ndata: ${String(data)}\n\n`;
  const hardCodedType = (_event, data) => `event: token\ndata: ${JSON.stringify(data)}\n\n`;
  rejects(encoder, missingBlankLine);
  rejects(encoder, manualPayload);
  rejects(encoder, hardCodedType);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(encoder, missingBlankLine)), /Terminate the frame with a final blank line/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(encoder, manualPayload)), /Serialize the payload with json\.dumps/);

  const encoderBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "encode-sse");
  assertPythonExport(encoderBlock, "encode_sse");
  assert.match(encoderBlock.code, /json\.dumps\(data, separators=\("[,]", "[:]"\), ensure_ascii=False\)/);

  const parser = byId.get("streaming-transport/parse-sse");
  assert.ok(parser);
  assert.equal(parser.cases.length, 6);
  const parserBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "parse-sse");
  assertPythonExport(parserBlock, "parse_sse_chunk");
  assert.match(parserBlock.code, /re\.split\(r"\\r\?\\n\\r\?\\n", combined\)/);
  const parseForContract = (buffer, chunk) => {
    const frames = (buffer + chunk).split(/\r?\n\r?\n/);
    const remainder = frames.pop() ?? "";
    return {
      events: frames.map((frame) => {
        let event = "message";
        const dataLines = [];
        for (const line of frame.split(/\r?\n/)) {
          if (!line || line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          let value = colon === -1 ? "" : line.slice(colon + 1);
          if (value.startsWith(" ")) value = value.slice(1);
          if (field === "event" && value) event = value;
          if (field === "data") dataLines.push(value);
        }
        return { event, data: JSON.parse(dataLines.length ? dataLines.join("\n") : "null") };
      }),
      remainder,
    };
  };
  const ignoresRemainder = (_buffer, chunk) => parseForContract("", chunk);
  const firstFrameOnly = (buffer, chunk) => {
    const parsed = parseForContract(buffer, chunk);
    return { events: parsed.events.slice(0, 1), remainder: parsed.remainder };
  };
  const lfAndExactSpacesOnly = (buffer, chunk) => {
    const frames = (buffer + chunk).split("\n\n");
    const remainder = frames.pop() ?? "";
    return {
      events: frames.map((frame) => {
        const lines = frame.split("\n");
        const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
        const data = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "null";
        return { event, data: JSON.parse(data) };
      }),
      remainder,
    };
  };
  rejects(parser, ignoresRemainder);
  rejects(parser, firstFrameOnly);
  rejects(parser, lfAndExactSpacesOnly);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(parser, ignoresRemainder)), /Prepend the previous remainder/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(parser, firstFrameOnly)), /Process all complete frames in order/);
});

test("Scheduling and Memory preserves completion identities and catches page-boundary shortcuts", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "scheduling-memory");
  assert.ok(lesson);
  assert.match(lesson.summary[0].body, /decode slots sit idle/);
  assert.match(lesson.summary[1].body, /completed requests are recorded/);
  assert.match(lesson.summary[2].body, /fewer than one page/);
  assert.match(lesson.summary[3].body, /does not prove that continuous batching always wins/);
  assert.equal(lesson.diagram.title, "Static versus continuous membership");
  assert.match(lesson.diagram.nodes[3].value, /continuous 88 \/ 86% \/ 7 · static 116 \/ 61% \/ 19/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, {
      status: "returned",
      value: implementation(...exerciseCase.invoke.args),
    }));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const allocation = byId.get("scheduling-memory/page-allocation");
  assert.ok(allocation);
  assert.equal(allocation.cases.length, 4);
  const allocateWith = (pageCount) => (tokens, pageSize = 16) => {
    const pages = pageCount(tokens, pageSize);
    const capacity = pages * pageSize;
    return { pages, capacity, wastedSlots: capacity - tokens };
  };
  const floorAllocation = allocateWith((tokens, pageSize) => Math.floor(tokens / pageSize));
  const alwaysExtraPage = allocateWith((tokens, pageSize) => Math.floor(tokens / pageSize) + 1);
  const ceilingAllocation = allocateWith((tokens, pageSize) => Math.ceil(tokens / pageSize));
  rejects(allocation, floorAllocation);
  rejects(allocation, alwaysExtraPage);
  accepts(allocation, ceilingAllocation);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(allocation, floorAllocation)), /Use ceiling division/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(allocation, alwaysExtraPage)), /do not add a page unconditionally/);

  const iteration = byId.get("scheduling-memory/batch-step");
  assert.ok(iteration);
  assert.equal(iteration.cases.length, 4);
  const oldActiveOnly = (requests) => requests
    .map((request) => ({ ...request, remaining: request.remaining - 1, generated: request.generated + 1 }))
    .filter((request) => request.remaining > 0);
  const firstRequestOnly = (requests) => {
    const active = [];
    const completed = [];
    requests.forEach((request, index) => {
      if (request.remaining <= 0) completed.push({ ...request });
      else {
        const advanced = index === 0
          ? { ...request, remaining: request.remaining - 1, generated: request.generated + 1 }
          : { ...request };
        (advanced.remaining === 0 ? completed : active).push(advanced);
      }
    });
    return { active, completed };
  };
  const dropsCompleted = (requests) => ({
    active: requests
      .filter((request) => request.remaining > 0)
      .map((request) => ({ ...request, remaining: request.remaining - 1, generated: request.generated + 1 }))
      .filter((request) => request.remaining > 0),
    completed: [],
  });
  const decodeReference = (requests) => {
    const active = [];
    const completed = [];
    for (const request of requests) {
      if (request.remaining <= 0) {
        completed.push({ ...request });
        continue;
      }
      const advanced = { ...request, remaining: request.remaining - 1, generated: request.generated + 1 };
      (advanced.remaining === 0 ? completed : active).push(advanced);
    }
    return { active, completed };
  };
  rejects(iteration, oldActiveOnly);
  rejects(iteration, firstRequestOnly);
  rejects(iteration, dropsCompleted);
  accepts(iteration, decodeReference);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(iteration, oldActiveOnly)), /separate active and completed arrays/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(iteration, firstRequestOnly)), /Move every request/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(iteration, dropsCompleted)), /Move a request that reaches zero into completed/);

  const block = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "batch-step");
  assertPythonExport(block, "decode_iteration");
  assert.match(block.code, /completed\.append\(dict\(request\)\)/);
  assert.match(block.code, /advanced = \{\s*\*\*request,/);
  assert.doesNotMatch(block.code, /request\["(?:remaining|generated)"\]\s*=/);
});

test("Reliability and Observability binds retries and events to attempt identity", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "reliability-observability");
  assert.ok(lesson);
  assert.match(lesson.summary[0].body, /logical request id/);
  assert.match(lesson.summary[0].body, /new attempt id to every retry/);
  assert.match(lesson.summary[1].body, /attempt is a zero-based index/);
  assert.match(lesson.summary[1].body, /attempt \+ 1 < maxAttempts/);
  assert.match(lesson.summary[2].body, /queued, loading, prefill, and streaming/);
  assert.match(lesson.summary[3].body, /queue time, prefill time, time to first token/);
  assert.equal(lesson.diagram.title, "One request across two attempts");
  assert.match(lesson.diagram.nodes[1].value, /0 \+ 1 < 2 → retry/);
  assert.match(lesson.diagram.nodes[4].value, /r-201\.1 token rejected/);
  assert.match(lesson.experiment.intro, /rejected late event/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const observe = (implementation, args) => {
    try {
      return { status: "returned", value: implementation(...args) };
    } catch (reason) {
      return {
        status: "threw",
        errorName: reason instanceof Error ? reason.name : "Error",
        message: reason instanceof Error ? reason.message : String(reason),
      };
    }
  };
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, observe(implementation, exerciseCase.invoke.args)));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const retry = byId.get("reliability-observability/retry-policy");
  assert.ok(retry);
  assert.equal(retry.cases.length, 7);
  const ignoresVisibleOutput = ({ transient, attempt, maxAttempts = 2 }) => transient && attempt + 1 < maxAttempts;
  const ignoresClassification = ({ tokensEmitted, attempt, maxAttempts = 2 }) => tokensEmitted === 0 && attempt + 1 < maxAttempts;
  const offByOneBudget = ({ transient, tokensEmitted, attempt, maxAttempts = 2 }) => transient && tokensEmitted === 0 && attempt < maxAttempts;
  const capsEveryBudgetAtTwo = ({ transient, tokensEmitted, attempt, maxAttempts = 2 }) => transient && tokensEmitted === 0 && maxAttempts > 1 && attempt < 1;
  rejects(retry, ignoresVisibleOutput);
  rejects(retry, ignoresClassification);
  rejects(retry, offByOneBudget);
  rejects(retry, capsEveryBudgetAtTwo);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(retry, ignoresVisibleOutput)), /Return false once tokensEmitted is greater than zero/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(retry, ignoresClassification)), /Return false for a non-transient failure/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(retry, offByOneBudget)), /attempt 1 is already the second and final attempt/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(retry, capsEveryBudgetAtTwo)), /Use the maxAttempts value you were given/);
  const retryBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "retry-policy");
  assertPythonExport(retryBlock, "should_retry");
  assert.match(retryBlock.code, /attempt \+ 1 < max_attempts/);

  const guard = byId.get("reliability-observability/terminal-guard");
  assert.ok(guard);
  assert.equal(guard.cases.length, 8);
  const terminalOnly = (request) => !["complete", "error", "cancelled"].includes(request.status);
  const identityOnly = (request, event) => request.attemptId === event.attemptId && request.requestId === event.requestId;
  const requestIdOnly = (request, event) => ["queued", "loading", "prefill", "streaming"].includes(request.status) && request.requestId === event.requestId;
  const missesCancelled = (request, event) => !["complete", "error"].includes(request.status) && request.attemptId === event.attemptId && request.requestId === event.requestId;
  const acceptsUnknown = (request, event) => !["complete", "error", "cancelled"].includes(request.status) && request.attemptId === event.attemptId && request.requestId === event.requestId;
  rejects(guard, terminalOnly);
  rejects(guard, identityOnly);
  rejects(guard, requestIdOnly);
  rejects(guard, missesCancelled);
  rejects(guard, acceptsUnknown);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, terminalOnly)), /Compare request\.attemptId with event\.attemptId/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, identityOnly)), /Return false after complete/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, requestIdOnly)), /sharing one logical request ID must not let an old attempt change the active one/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, missesCancelled)), /Return false after cancelled/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, acceptsUnknown)), /Accept only the known active states/);
  const guardBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "terminal-guard");
  assertPythonExport(guardBlock, "accept_event");
  assert.match(guardBlock.code, /request\["attemptId"\] == event\["attemptId"\]/);
  assert.match(guardBlock.code, /request\["requestId"\] == event\["requestId"\]/);
});

test("Conversation State enforces normalized records and immutable targeted deltas", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "conversation-state");
  assert.ok(lesson);
  assert.match(lesson.summary[0].body, /messageIds/);
  assert.match(lesson.summary[0].body, /messagesById/);
  assert.match(lesson.summary[1].body, /messageId/);
  assert.match(lesson.summary[1].body, /attemptId/);
  assert.match(lesson.summary[1].body, /requestId/);
  assert.match(lesson.summary[2].body, /new messages collection/);
  assert.match(lesson.summary[2].body, /keeps every other message's identity unchanged/);
  assert.match(lesson.summary[3].body, /canStop/);
  assert.match(lesson.summary[3].body, /canRegenerate/);
  assert.equal(lesson.diagram.title, "One delta through normalized state");
  assert.match(lesson.dataset.size, /18 reducer actions · 3 generation attempts/);
  assert.match(lesson.experiment.intro, /all 18 actions/);
  assert.match(lesson.experiment.intro, /rejected late event/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };
  const observe = (implementation, sourceArgs) => {
    const args = structuredClone(sourceArgs);
    args.forEach(freeze);
    try {
      return { status: "returned", value: implementation(...args) };
    } catch (reason) {
      return {
        status: "threw",
        errorName: reason instanceof Error ? reason.name : "Error",
        message: reason instanceof Error ? reason.message : String(reason),
      };
    }
  };
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, observe(implementation, exerciseCase.invoke.args)));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const create = byId.get("conversation-state/create-message");
  assert.ok(create);
  assert.equal(create.cases.length, 4);
  const defaultsOnly = ({ id, role }) => ({ id, role, content: "", status: "complete", createdAt: 0 });
  const copiesCallerFields = (input) => ({ ...input, content: input.content ?? "", status: input.status ?? "complete", createdAt: 0 });
  rejects(create, defaultsOnly);
  rejects(create, copiesCallerFields);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(create, defaultsOnly)), /null attemptId and requestId/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(create, copiesCallerFields)), /null attemptId and requestId/);
  const createBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "create-message");
  assertPythonExport(createBlock, "create_message");
  assert.match(createBlock.code, /"createdAt": 0/);
  assert.doesNotMatch(createBlock.code, /\*\*options/);

  const append = byId.get("conversation-state/append-delta");
  assert.ok(append);
  assert.equal(append.cases.length, 6);
  const mutatesTarget = (messages, event) => {
    const target = messages.find((message) => message.id === event.messageId && message.status === "streaming");
    if (target) target.content += event.delta;
    return messages;
  };
  const updatesLast = (messages, event) => messages.map((message, index) => index === messages.length - 1 ? { ...message, content: message.content + event.delta } : message);
  const ignoresStatus = (messages, event) => messages.map((message) => message.id === event.messageId && message.attemptId === event.attemptId && message.requestId === event.requestId ? { ...message, content: message.content + event.delta } : message);
  const ignoresAttempt = (messages, event) => messages.map((message) => message.id === event.messageId && message.requestId === event.requestId && message.status === "streaming" ? { ...message, content: message.content + event.delta } : message);
  const ignoresRequest = (messages, event) => messages.map((message) => message.id === event.messageId && message.attemptId === event.attemptId && message.status === "streaming" ? { ...message, content: message.content + event.delta } : message);
  rejects(append, mutatesTarget);
  rejects(append, updatesLast);
  rejects(append, ignoresStatus);
  rejects(append, ignoresAttempt);
  rejects(append, ignoresRequest);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, mutatesTarget)), /Match messageId, attemptId, and requestId/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, updatesLast)), /Match messageId, attemptId, and requestId/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, ignoresStatus)), /Check that the matching message is streaming/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, ignoresAttempt)), /attemptId does not match/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, ignoresRequest)), /requestId does not match/);
  const appendBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "append-delta");
  assertPythonExport(appendBlock, "append_message_delta");
  assert.match(appendBlock.code, /next_messages = \[\]/);
  assert.match(appendBlock.code, /next_messages\.append\(/);
  assert.doesNotMatch(appendBlock.code, /message\["content"\]\s*\+=/);
});

test("Streaming React preserves render deltas and applies the complete scroll-follow gate", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "streaming-react");
  assert.ok(lesson);
  assert.equal(lesson.diagram.title, "One animation-frame commit");
  assert.match(lesson.diagram.caption, /Typed token events are already parsed/);
  assert.match(lesson.diagram.caption, /scrolling, announcements, and cancellation remain separate policies/);
  assert.match(lesson.dataset.size, /60 deltas · 4 timing profiles/);
  assert.match(lesson.experiment.intro, /burst, steady, stalled, and cancelled/);
  assert.match(lesson.experiment.intro, /short live-region announcements/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };
  const observe = (implementation, sourceArgs) => {
    const args = structuredClone(sourceArgs);
    args.forEach(freeze);
    try {
      return { status: "returned", value: implementation(...args) };
    } catch (reason) {
      return {
        status: "threw",
        errorName: reason instanceof Error ? reason.name : "Error",
        message: reason instanceof Error ? reason.message : String(reason),
      };
    }
  };
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, observe(implementation, exerciseCase.invoke.args)));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const buffer = byId.get("streaming-react/delta-buffer");
  assert.ok(buffer);
  assert.equal(buffer.cases.length, 4);
  const firstOnly = (pending) => ({ text: pending[0] ?? "", remaining: [] });
  const insertsSeparators = (pending) => ({ text: pending.join(" "), remaining: [] });
  const sortsDeltas = (pending) => ({ text: [...pending].sort().join(""), remaining: [] });
  const retainsPending = (pending) => ({ text: pending.join(""), remaining: [...pending] });
  const mutatesInput = (pending) => ({ text: pending.splice(0).join(""), remaining: pending });
  rejects(buffer, firstOnly);
  rejects(buffer, insertsSeparators);
  rejects(buffer, sortsDeltas);
  rejects(buffer, retainsPending);
  rejects(buffer, mutatesInput);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(buffer, firstOnly)), /Join every queued delta with no inserted separator/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(buffer, insertsSeparators)), /no inserted separator/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(buffer, retainsPending)), /fresh empty remaining queue/);
  const bufferBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "delta-buffer");
  assertPythonExport(bufferBlock, "flush_token_buffer");
  assert.match(bufferBlock.code, /""\.join\(pending\)/);

  const scroll = byId.get("streaming-react/scroll-policy");
  assert.ok(scroll);
  assert.equal(scroll.cases.length, 7);
  const distanceOnly = ({ distanceFromBottom, threshold = 80 }) => distanceFromBottom <= threshold;
  const userFlagOnly = ({ userScrolledUp }) => !userScrolledUp;
  const exclusiveBoundary = ({ distanceFromBottom, userScrolledUp, threshold = 80 }) => !userScrolledUp && distanceFromBottom < threshold;
  const fixedThreshold = ({ distanceFromBottom, userScrolledUp }) => !userScrolledUp && distanceFromBottom <= 80;
  rejects(scroll, distanceOnly);
  rejects(scroll, userFlagOnly);
  rejects(scroll, exclusiveBoundary);
  rejects(scroll, fixedThreshold);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(scroll, distanceOnly)), /userScrolledUp override/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(scroll, userFlagOnly)), /exceeds the default 80-pixel threshold/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(scroll, exclusiveBoundary)), /distanceFromBottom <= threshold/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(scroll, fixedThreshold)), /provided threshold/);
  const scrollBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "scroll-policy");
  assertPythonExport(scrollBlock, "should_follow_stream");
  assert.match(scrollBlock.code, /distance_from_bottom <= threshold/);
});

test("Actions and Context treats branches as durable records and admits only complete historical turns", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "chat-actions-context");
  assert.ok(lesson);
  assert.equal(lesson.diagram.title, "One prefix, three actions, one request boundary");
  assert.match(lesson.diagram.caption, /cancelled partial attempt/);
  assert.match(lesson.diagram.caption, /complete historical pairs from newest to oldest/);
  assert.match(lesson.summary.map((section) => section.body).join(" "), /overflow is reported/);
  assert.match(lesson.dataset.size, /3 action flows · 29 budgets \(14–42\)/);
  assert.match(lesson.experiment.intro, /message \/ attempt \/ request ids/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };
  const observe = (implementation, sourceArgs) => {
    const args = structuredClone(sourceArgs);
    args.forEach(freeze);
    try {
      return { status: "returned", value: implementation(...args) };
    } catch (reason) {
      return {
        status: "threw",
        errorName: reason instanceof Error ? reason.name : "Error",
        message: reason instanceof Error ? reason.message : String(reason),
      };
    }
  };
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, observe(implementation, exerciseCase.invoke.args)));
  const rejects = (contract, implementation) => assert.ok(evaluate(contract, implementation).some((result) => !result.passed));
  const context = byId.get("chat-actions-context/context-budget");
  assert.ok(context);
  assert.equal(context.cases.length, 9);
  const individualMessages = ({ system, history, activeUser, budget }) => {
    const selected = [...system, activeUser];
    let used = selected.reduce((sum, message) => sum + message.tokens, 0);
    for (const message of [...history].reverse()) {
      if (used + message.tokens <= budget) {
        selected.splice(system.length, 0, message);
        used += message.tokens;
      }
    }
    return { selected, used, overflow: used > budget };
  };
  const oldestFirst = ({ system, history, activeUser, budget }) => {
    const turns = [];
    for (let index = 0; index < history.length - 1; index += 1) {
      if (history[index].role === "user" && history[index + 1].role === "assistant") turns.push([history[index], history[index + 1]]);
    }
    let used = [...system, activeUser].reduce((sum, message) => sum + message.tokens, 0);
    const selected = [...system];
    for (const turn of turns) {
      const tokens = turn.reduce((sum, message) => sum + message.tokens, 0);
      if (used + tokens <= budget) { selected.push(...turn); used += tokens; }
    }
    selected.push(activeUser);
    return { selected, used, overflow: used > budget };
  };
  const omitsActiveUser = ({ system, history }) => {
    const selected = [...system, ...history.slice(-2)];
    return { selected, used: selected.reduce((sum, message) => sum + message.tokens, 0), overflow: false };
  };
  const ignoresLifecycle = ({ system, history, activeUser }) => {
    const selected = [...system, ...history, activeUser];
    return { selected, used: selected.reduce((sum, message) => sum + message.tokens, 0), overflow: false };
  };
  const stopsAfterOversizedNewest = ({ system, history, activeUser, budget }) => {
    const pairs = [];
    for (let index = 0; index < history.length - 1; index += 1) {
      if (history[index].role === "user" && history[index + 1].role === "assistant") pairs.push([history[index], history[index + 1]]);
    }
    let used = [...system, activeUser].reduce((sum, message) => sum + message.tokens, 0);
    const selected = [...system];
    for (const pair of pairs.reverse()) {
      const tokens = pair.reduce((sum, message) => sum + message.tokens, 0);
      if (used + tokens > budget) break;
      selected.splice(system.length, 0, ...pair);
      used += tokens;
    }
    selected.push(activeUser);
    return { selected, used, overflow: used > budget };
  };
  const mutatesOrder = ({ system, history, activeUser, budget }) => {
    history.reverse();
    return { selected: [...system, ...history, activeUser], used: budget, overflow: false };
  };
  rejects(context, individualMessages);
  rejects(context, oldestFirst);
  rejects(context, omitsActiveUser);
  rejects(context, ignoresLifecycle);
  rejects(context, stopsAfterOversizedNewest);
  rejects(context, mutatesOrder);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(context, individualMessages)), /user-assistant pair as one unit/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(context, oldestFirst)), /from newest to oldest/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(context, omitsActiveUser)), /active-user/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(context, ignoresLifecycle)), /return the request in time order/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(context, stopsAfterOversizedNewest)), /keep checking older complete pairs/);
  const contextBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "context-budget");
  assertPythonExport(contextBlock, "select_context");
  assert.match(contextBlock.code, /for turn in reversed\(turns\):/);
  assert.match(contextBlock.code, /selected_turns\.insert\(0, turn\)/);
  assert.doesNotMatch(contextBlock.code, /history\.reverse\(/);

  const regeneration = byId.get("chat-actions-context/regenerate-branch");
  assert.ok(regeneration);
  assert.equal(regeneration.cases.length, 4);
  const hardcoded = () => ({ messageId: "m9", parentUserId: "m4", attemptId: "a2", requestId: "r2", role: "assistant", content: "", status: "queued" });
  const spreadsCaller = (input) => ({ ...input, role: "assistant", content: input.content ?? "", status: input.status ?? "queued" });
  const wrongDefaults = ({ messageId, parentUserId, attemptId, requestId }) => ({ messageId, parentUserId, attemptId, requestId, role: "assistant", content: "loading", status: "streaming" });
  const mutatesCaller = (input) => {
    input.status = "queued";
    return input;
  };
  rejects(regeneration, hardcoded);
  rejects(regeneration, spreadsCaller);
  rejects(regeneration, wrongDefaults);
  rejects(regeneration, mutatesCaller);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(regeneration, hardcoded)), /IDs passed in on every call/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(regeneration, spreadsCaller)), /four ID fields/);
  const regenerationBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "regenerate-branch");
  assertPythonExport(regenerationBlock, "create_regeneration");
  assert.doesNotMatch(regenerationBlock.code, /\*\*options/);
  assert.match(regenerationBlock.code, /"content": ""/);
  assert.match(regenerationBlock.code, /"status": "queued"/);
});

test("Product Quality rejects shallow persistence guards and incomplete phase labels", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "chat-product-quality");
  assert.ok(lesson);
  const aria23Url = "https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23";
  const aria23Title = "ARIA23: Using role=log to identify sequential information updates";
  assert.equal(lesson.paperUrl, aria23Url);
  assert.equal(lesson.paperTitle, aria23Title);
  assert.ok(lesson.sources.some((source) => source.url === aria23Url && source.title === aria23Title));
  assert.doesNotMatch(JSON.stringify(lesson.sources), /\/WAI\/ARIA\/apg\/patterns\/log/);
  assert.equal(lesson.diagram.title, "One send through reload");
  assert.match(lesson.dataset.size, /11 executable pure checks · 5 specifications · 3 manual verification groups/);
  assert.match(lesson.claims.limit, /real browsers, keyboards, screen readers, and users/);

  const byId = new Map(contracts.llmSystemsExerciseContracts.map((contract) => [contract.id, contract]));
  const observe = (implementation, sourceArgs) => {
    try {
      return { status: "returned", value: implementation(...structuredClone(sourceArgs)) };
    } catch (reason) {
      return { status: "threw", errorName: reason instanceof Error ? reason.name : "Error", message: reason instanceof Error ? reason.message : String(reason) };
    }
  };
  const evaluate = (contract, implementation) => contract.cases.map((exerciseCase) =>
    contractRuntime.evaluateExerciseCase(contract, exerciseCase, observe(implementation, exerciseCase.invoke.args)));
  const storage = byId.get("chat-product-quality/storage-validation");
  assert.ok(storage);
  assert.equal(storage.cases.length, 11);
  const shallow = (record) => Boolean(record) && record.version === 1 && typeof record.id === "string" && Array.isArray(record.messages) && !("apiKey" in record);
  const shallowResults = evaluate(storage, shallow);
  assert.ok(shallowResults.some((result) => !result.passed));
  assert.match(practiceFeedback.formatPracticeContractDetail(shallowResults), /expected message keys/);
  const storageBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "storage-validation");
  assertPythonExport(storageBlock, "valid_conversation_record");
  assert.match(storageBlock.code, /def has_exact_keys\(/);
  assert.match(storageBlock.code, /json\.dumps\(record\)/);

  const phases = byId.get("chat-product-quality/phase-label");
  assert.ok(phases);
  assert.equal(phases.cases.length, 8);
  const missingComplete = (phase) => ({ queued: "Waiting for capacity", loading: "Loading model", prefill: "Processing context", streaming: "Generating", cancelled: "Stopped", error: "Generation failed" })[phase] ?? "Ready";
  const phaseResults = evaluate(phases, missingComplete);
  assert.ok(phaseResults.some((result) => !result.passed));
  assert.match(practiceFeedback.formatPracticeContractDetail(phaseResults), /Map complete directly/);
  const phaseBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "phase-label");
  assertPythonExport(phaseBlock, "generation_status_label");
  assert.match(phaseBlock.code, /labels\.get\(phase, "Status unavailable"\)/);
});

test("practice verification is inseparable from the exact editor source and contract version", () => {
  const block = { id: "rnn-step", code: "def rnn_step():\n    return 'reference'" };
  const correct = "def rnn_step():\n    return 'correct learner answer'";
  const wrong = "def rnn_step():\n    return 'wrong learner answer'";
  const currentVersion = contracts.llmSystemsContractSuite.contractVersion;
  assert.equal(currentVersion, "llm-systems-contracts-v17-cpython");
  const empty = { ids: [], sources: {}, contractVersion: null };
  assert.deepEqual(
    practiceState.verificationAfterBlockRun(empty, block.id, block.code, [], true, currentVersion),
    empty,
    "a passing visible reference run remains an example and earns no learner credit",
  );
  const creditedPractice = practiceState.verificationAfterBlockRun(
    empty,
    block.id,
    correct,
    [block.id],
    true,
    currentVersion,
  );
  assert.deepEqual(creditedPractice, {
    ids: [block.id],
    sources: { [block.id]: correct },
    contractVersion: currentVersion,
  }, "a passing run of the active practice source earns source-bound credit");
  assert.deepEqual(
    practiceState.creditablePracticeBlockIds([block.id], [], [block.id]),
    [],
    "passing reference examples in a lesson-wide run earn no credit",
  );
  assert.deepEqual(
    practiceState.creditablePracticeBlockIds([block.id], [block.id], [block.id]),
    [block.id],
    "passing practice sources in a lesson-wide run earn credit",
  );
  const bound = practiceState.bindBlockVerification(
    { ids: [], sources: {}, contractVersion: null },
    block.id,
    correct,
    currentVersion,
  );

  assert.equal(practiceState.practiceBlockSource(block, [block.id], { [block.id]: wrong }), wrong);
  assert.deepEqual(
    practiceState.restoreSourceBoundVerification([block], [], {}, [block.id], { [block.id]: block.code }, currentVersion, currentVersion),
    empty,
    "legacy verification for a visible reference is discarded on restore",
  );
  assert.deepEqual(
    practiceState.restoreSourceBoundVerification([block], [block.id], { [block.id]: wrong }, bound.ids, bound.sources, currentVersion, currentVersion),
    { ids: [], sources: {}, contractVersion: null },
    "a verified id must not move from an older correct answer to current wrong source",
  );
  assert.deepEqual(
    practiceState.restoreSourceBoundVerification([block], [block.id], { [block.id]: correct }, bound.ids, bound.sources, currentVersion, currentVersion),
    bound,
  );
  assert.deepEqual(
    practiceState.restoreSourceBoundVerification([block], [block.id], { [block.id]: correct }, bound.ids, bound.sources, "llm-systems-contracts-v3", currentVersion),
    { ids: [], sources: {}, contractVersion: null },
    "the same source must be checked again after host contracts change",
  );
  assert.deepEqual(practiceState.invalidateBlockVerification(bound, block.id), { ids: [], sources: {}, contractVersion: null });
});

test("practice remains locked until both project and learner hydration finish", async () => {
  let resolveProject;
  let resolveLearner;
  const project = new Promise((resolve) => { resolveProject = resolve; });
  const learner = new Promise((resolve) => { resolveLearner = resolve; });
  let ready = false;
  const hydration = practiceState.waitForPracticeHydration(project, learner).then(() => { ready = true; });

  resolveProject();
  await Promise.resolve();
  assert.equal(ready, false, "project hydration alone must not unlock practice");

  resolveLearner();
  await hydration;
  assert.equal(ready, true);
});

test("project files expose clear pending, complete, provided, and failure states", () => {
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 0, totalCells: 3 }),
    { tone: "pending", label: "0 of 3 checks verified", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 2, totalCells: 3 }),
    { tone: "in-progress", label: "2 of 3 checks verified", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 3, totalCells: 3 }),
    { tone: "complete", label: "3 of 3 checks verified", complete: true },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, readOnly: true }),
    { tone: "provided", label: "Provided", complete: true },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, requiresPassingTests: true }),
    { tone: "pending", label: "Tests not run", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, requiresPassingTests: true, results: [{ passed: true }] }),
    { tone: "passed", label: "IDE tests pass", complete: true },
  );
  const sharedCompile = [{ id: "capstone", path: "capstone/main.tsx", label: "Capstone", passed: true, detail: "Passed" }];
  assert.equal(
    fileStatus.projectResultsForFile(
      { "capstone/main.tsx": sharedCompile },
      "capstone/BrowserChat.tsx",
      "capstone/main.tsx",
    ),
    sharedCompile,
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 3, totalCells: 3, results: [{ passed: false }] }),
    { tone: "failed", label: "IDE tests failing", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 1, totalCells: 3, results: [{ passed: true }] }),
    { tone: "in-progress", label: "1 of 3 checks verified", complete: false },
    "a partial IDE receipt cannot validate the complete lesson implementation",
  );
  assert.deepEqual(
    fileStatus.projectSourceProgress([
      { tone: "complete", label: "3 of 3 checks verified", complete: true },
      { tone: "in-progress", label: "1 of 3 checks verified", complete: false },
      { tone: "failed", label: "IDE tests failing", complete: false },
      { tone: "pending", label: "0 of 2 checks verified", complete: false },
    ]),
    { total: 4, verified: 1, partial: 1, needsWork: 1, notStarted: 1, percentage: 25 },
  );
  assert.equal(fileStatus.projectTimelineVisibleFileCount(0, 4, 6), 10);
  assert.equal(fileStatus.projectTimelineVisibleFileCount(14, 4, 6), 24);
});

test("lesson completion requires both implementation evidence and the concept prediction", () => {
  const state = learnerStateModule.emptyLearnerState();
  state.lessons["probe"] = {
    verifiedCells: ["one", "two"],
    verifiedSources: { one: "one source", two: "two source" },
    verifiedContractVersion: contracts.llmSystemsContractSuite.contractVersion,
    experimentComplete: true,
    hiddenBlocks: [],
    answers: { one: "one source", two: "two source" },
    knowledgeAnswers: {},
    knowledgeVerified: [],
    updatedAt: 0,
  };
  const blockIds = ["one", "two"];
  const contractVersion = contracts.llmSystemsContractSuite.contractVersion;
  assert.equal(learnerStateModule.lessonImplementationIsComplete(state, "probe", blockIds, contractVersion), true);
  assert.equal(learnerStateModule.lessonIsComplete(state, "probe", blockIds, contractVersion, "concept-check"), false);
  state.lessons.probe.knowledgeVerified.push("concept-check");
  assert.equal(learnerStateModule.lessonIsComplete(state, "probe", blockIds, contractVersion, "concept-check"), true);
  state.lessons.probe.answers.one = "edited after verification";
  assert.equal(learnerStateModule.lessonIsComplete(state, "probe", blockIds, contractVersion, "concept-check"), false);
});
