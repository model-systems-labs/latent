import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let course;
let manifestModule;
let lms;
let fileStatus;
let contracts;
let practiceFeedback;
let contractRuntime;
let practiceState;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, manifestModule, lms, fileStatus, contracts, practiceFeedback, contractRuntime, practiceState] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/manifest.ts"),
    vite.ssrLoadModule("/packages/course-kit/src/curriculum.ts"),
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/features/ide/practice-feedback.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/contracts.ts"),
    vite.ssrLoadModule("/app/features/ide/practice-state.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

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
    implementation: { filename: "unassigned.js", codeBlocks: [] },
  });
  assert.throws(
    () => lms.deriveCurriculum(manifestModule.llmSystemsManifest, sourceLessons),
    /source lesson is not assigned to a module: unassigned-lesson/,
  );
});

test("Character RNN practice catches missing recurrent state and explains the failing behavior", () => {
  const contract = contracts.llmSystemsExerciseContracts.find((candidate) => candidate.id === "character-rnns/rnn-step");
  assert.ok(contract);
  assert.equal(contract.cases.length, 2);
  const recurrentCase = contract.cases.find((candidate) => candidate.id === "non-empty-recurrent-state");
  assert.ok(recurrentCase);
  assert.match(recurrentCase.label, /preceding hidden state/);

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

test("Character RNN contracts reject two plausible semantic mistakes per cell and accept the references", () => {
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
  rejects(rnn, (input, _previous, weights) => project(weights.Wxh, input).map(Math.tanh));
  rejects(rnn, (input, previous, weights) => project(weights.Wxh, input).map((value, index) => value + project(weights.Whh, previous)[index] + weights.bias[index]));
  accepts(rnn, (input, previous, weights) => project(weights.Wxh, input).map((value, index) => Math.tanh(value + project(weights.Whh, previous)[index] + weights.bias[index])));

  const loss = byId.get("character-rnns/cross-entropy");
  assert.ok(loss);
  rejects(loss, (probabilities, targetIndex) => probabilities[targetIndex]);
  rejects(loss, (probabilities, targetIndex) => Math.log(probabilities[targetIndex]));
  accepts(loss, (probabilities, targetIndex) => -Math.log(probabilities[targetIndex]));

  const clipping = byId.get("character-rnns/gradient-clipping");
  assert.ok(clipping);
  rejects(clipping, (gradients, limit) => gradients.map((value) => Math.min(value, limit)));
  rejects(clipping, (gradients, limit) => gradients.map((value) => Math.max(value, -limit)));
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
  accepts(loss, (probabilities, targetIndex) => -Math.log(Math.max(probabilities[targetIndex], 1e-12)));
});

test("Subword Tokenization exposes pair identity and rejects shortcuts in every cell", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "subword-tokenization");
  const pairBlock = lesson?.implementation.codeBlocks.find((block) => block.id === "pair-counts");
  assert.ok(pairBlock);
  assert.match(pairBlock.code, /^function countPairs\(words\)/, "the practice starter must target the contracted countPairs export");

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
  assert.match(pairFeedback, /JSON\.stringify/);
  assert.match(pairFeedback, /2 additional cases still fail; rerun after this fix/);

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
  accepts(score, additiveScore);
  const scoreFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(score, dotProduct));
  assert.match(scoreFeedback, /Wq/);
  assert.match(scoreFeedback, /2 additional cases still fail; rerun after this fix/);
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
  assert.match(weightFeedback, /one softmax across the complete scores array/);
  assert.equal((weightFeedback.match(/complete scores array/g) ?? []).length, 1);

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
  assert.match(lesson.summary.map((section) => section.body).join(" "), /before applying softmax independently across that row/);
  assert.match(lesson.diagram.caption, /three-token worked pass/i);

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
  assert.match(lesson.diagram.caption, /not general few-shot ability/);

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
  assert.match(formatterFeedback, /Preserve example order/);

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
  accepts(scorer, (output, expected, allowedLabels = ["K", "M"]) => {
    const match = output.match(new RegExp(`\\b(${allowedLabels.join("|")})\\b`));
    const predicted = match?.[1] ?? null;
    return { predicted, passed: predicted === expected };
  });
  const scorerFeedback = practiceFeedback.formatPracticeContractDetail(evaluate(scorer, (output, expected) => ({
    predicted: output.includes(expected) ? expected : null,
    passed: output.includes(expected),
  })));
  assert.match(scorerFeedback, /independently/);
  assert.match(scorerFeedback, /2 additional cases still fail; rerun after this fix/);
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
  assert.match(lesson.diagram.caption, /31 subsequent decode forwards/);
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
  assert.match(phaseFeedback, /31 subsequent decode forwards because prefill logits sample token 1/);
  assert.match(phaseFeedback, /1 additional case still fails; rerun after this fix/);
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
  assert.match(cacheFeedback, /5 additional cases still fail; rerun after this fix/);
  assert.doesNotMatch(cacheFeedback, /all 3 layers|kvHeads|headDimension|FP32/);
});

test("Streaming Transport separates byte decoding, frame carry, typed events, and cancellation", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "streaming-transport");
  assert.ok(lesson);
  assert.match(lesson.summary[0].body, /TextDecoder\.decode\(chunk, \{ stream: true \}\)/);
  assert.match(lesson.summary[0].body, /decoded text, never raw bytes/);
  assert.match(lesson.summary[1].body, /LF or CRLF/);
  assert.match(lesson.summary[1].body, /default event name message/);
  assert.match(lesson.summary[3].body, /AbortSignal must stop the reader, parser, and generator/);
  assert.match(lesson.summary[3].body, /Render buffering is different/);
  assert.equal(lesson.diagram.title, "One token across arbitrary chunks");
  assert.match(lesson.diagram.caption, /TextDecoder owns byte carry/);
  assert.match(lesson.experiment.intro, /cancel after four tokens/);

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
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

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
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(encoder, manualPayload)), /Serialize the payload with JSON\.stringify/);

  const encoderBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "encode-sse");
  assert.ok(encoderBlock);
  const encoderReference = new Function(`${encoderBlock.code}; return encodeSse;`)();
  accepts(encoder, encoderReference);

  const parser = byId.get("streaming-transport/parse-sse");
  assert.ok(parser);
  assert.equal(parser.cases.length, 6);
  const parserBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "parse-sse");
  assert.ok(parserBlock);
  const parserReference = new Function(`${parserBlock.code}; return parseSseChunk;`)();
  const ignoresRemainder = (_buffer, chunk) => parserReference("", chunk);
  const firstFrameOnly = (buffer, chunk) => {
    const parsed = parserReference(buffer, chunk);
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
  accepts(parser, parserReference);
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
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(iteration, firstRequestOnly)), /Advance every request/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(iteration, dropsCompleted)), /Move a request that reaches zero into completed/);

  const block = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "batch-step");
  assert.ok(block);
  const referenceFromLesson = new Function(`${block.code}; return decodeIteration;`)();
  const frozenRequests = Object.freeze([
    Object.freeze({ id: "frozen-a", remaining: 1, generated: 0 }),
    Object.freeze({ id: "frozen-b", remaining: 2, generated: 3 }),
  ]);
  assert.doesNotThrow(() => referenceFromLesson(frozenRequests));
  assert.deepEqual(frozenRequests, [
    { id: "frozen-a", remaining: 1, generated: 0 },
    { id: "frozen-b", remaining: 2, generated: 3 },
  ], "the authored reference must not mutate scheduler input");
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
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

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
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(retry, capsEveryBudgetAtTwo)), /Use the supplied maxAttempts value/);
  const retryBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "retry-policy");
  assert.ok(retryBlock);
  accepts(retry, new Function(`${retryBlock.code}; return shouldRetry;`)());

  const guard = byId.get("reliability-observability/terminal-guard");
  assert.ok(guard);
  assert.equal(guard.cases.length, 7);
  const terminalOnly = (request) => !["complete", "error", "cancelled"].includes(request.status);
  const identityOnly = (request, event) => request.id === event.requestId;
  const missesCancelled = (request, event) => !["complete", "error"].includes(request.status) && request.id === event.requestId;
  const acceptsUnknown = (request, event) => !["complete", "error", "cancelled"].includes(request.status) && request.id === event.requestId;
  rejects(guard, terminalOnly);
  rejects(guard, identityOnly);
  rejects(guard, missesCancelled);
  rejects(guard, acceptsUnknown);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, terminalOnly)), /Compare request\.id with event\.requestId/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, identityOnly)), /Return false after complete/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, missesCancelled)), /Return false after cancelled/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(guard, acceptsUnknown)), /Accept only the known active states/);
  const guardBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "terminal-guard");
  assert.ok(guardBlock);
  accepts(guard, new Function(`${guardBlock.code}; return acceptEvent;`)());
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
  assert.match(lesson.summary[2].body, /preserves untouched message identities/);
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
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

  const create = byId.get("conversation-state/create-message");
  assert.ok(create);
  assert.equal(create.cases.length, 4);
  const defaultsOnly = ({ id, role }) => ({ id, role, content: "", status: "complete", createdAt: 0 });
  const copiesCallerFields = (input) => ({ ...input, content: input.content ?? "", status: input.status ?? "complete", createdAt: 0 });
  rejects(create, defaultsOnly);
  rejects(create, copiesCallerFields);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(create, defaultsOnly)), /Use the supplied id, role, content, and status/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(create, copiesCallerFields)), /do not persist renderIndex/);
  const createBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "create-message");
  assert.ok(createBlock);
  const createReference = new Function(`${createBlock.code}; return createMessage;`)();
  accepts(create, createReference);
  assert.deepEqual(Object.keys(createReference({ id: "m", role: "assistant" })).sort(), ["content", "createdAt", "id", "role", "status"]);
  assert.doesNotThrow(() => JSON.stringify(createReference({ id: "m", role: "assistant" })));

  const append = byId.get("conversation-state/append-delta");
  assert.ok(append);
  assert.equal(append.cases.length, 4);
  const mutatesTarget = (messages, messageId, delta) => {
    const target = messages.find((message) => message.id === messageId && message.status === "streaming");
    if (target) target.content += delta;
    return messages;
  };
  const updatesLast = (messages, _messageId, delta) => messages.map((message, index) => index === messages.length - 1 ? { ...message, content: message.content + delta } : message);
  const ignoresStatus = (messages, messageId, delta) => messages.map((message) => message.id === messageId ? { ...message, content: message.content + delta } : message);
  rejects(append, mutatesTarget);
  rejects(append, updatesLast);
  rejects(append, ignoresStatus);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, mutatesTarget)), /Match messageId instead of array position/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, updatesLast)), /Match messageId instead of array position/);
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(append, ignoresStatus)), /Check that the matching message is streaming/);
  const appendBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "append-delta");
  assert.ok(appendBlock);
  const appendReference = new Function(`${appendBlock.code}; return appendMessageDelta;`)();
  accepts(append, appendReference);

  const before = Object.freeze([
    Object.freeze({ id: "before", content: "keep", status: "streaming" }),
    Object.freeze({ id: "target", content: "Hel", status: "streaming" }),
    Object.freeze({ id: "after", content: "fixed", status: "complete" }),
  ]);
  const next = appendReference(before, "target", "lo");
  assert.notEqual(next, before, "every reducer call returns a new array identity");
  assert.equal(next[0], before[0], "the preceding untargeted record preserves identity");
  assert.notEqual(next[1], before[1], "the targeted record receives a new object identity");
  assert.equal(next[2], before[2], "the following untargeted record preserves identity");
  assert.deepEqual(before, [
    { id: "before", content: "keep", status: "streaming" },
    { id: "target", content: "Hel", status: "streaming" },
    { id: "after", content: "fixed", status: "complete" },
  ], "the authored reference never mutates its input");
  const missing = appendReference(before, "missing", "!");
  assert.notEqual(missing, before);
  assert.equal(missing[0], before[0]);
  assert.equal(missing[1], before[1]);
  assert.equal(missing[2], before[2]);
});

test("Streaming React preserves render deltas and applies the complete scroll-follow gate", () => {
  const lesson = course.courseLessons.find((candidate) => candidate.id === "streaming-react");
  assert.ok(lesson);
  assert.equal(lesson.diagram.title, "One animation-frame commit");
  assert.match(lesson.diagram.caption, /Typed token events are already parsed/);
  assert.match(lesson.diagram.caption, /scrolling, announcements, and cancellation remain separate policies/);
  assert.match(lesson.dataset.size, /60 deltas · 4 timing profiles/);
  assert.match(lesson.experiment.intro, /burst, steady, stalled, and cancelled/);
  assert.match(lesson.experiment.intro, /bounded live-region contents/);

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
  const accepts = (contract, implementation) => assert.ok(evaluate(contract, implementation).every((result) => result.passed));

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
  assert.ok(bufferBlock);
  accepts(buffer, new Function(`${bufferBlock.code}; return flushTokenBuffer;`)());

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
  assert.match(practiceFeedback.formatPracticeContractDetail(evaluate(scroll, fixedThreshold)), /supplied threshold/);
  const scrollBlock = lesson.implementation.codeBlocks.find((candidate) => candidate.id === "scroll-policy");
  assert.ok(scrollBlock);
  accepts(scroll, new Function(`${scrollBlock.code}; return shouldFollowStream;`)());
});

test("practice verification is inseparable from the exact editor source and contract version", () => {
  const block = { id: "rnn-step", code: "function rnnStep() { return 'reference'; }" };
  const correct = "function rnnStep() { return 'correct learner answer'; }";
  const wrong = "function rnnStep() { return 'wrong learner answer'; }";
  const currentVersion = "llm-systems-contracts-v12";
  const bound = practiceState.bindBlockVerification(
    { ids: [], sources: {}, contractVersion: null },
    block.id,
    correct,
    currentVersion,
  );

  assert.equal(practiceState.practiceBlockSource(block, [block.id], { [block.id]: wrong }), wrong);
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
    { tone: "pending", label: "Pending", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 2, totalCells: 3 }),
    { tone: "in-progress", label: "2/3 complete", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 3, totalCells: 3 }),
    { tone: "complete", label: "Complete", complete: true },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, readOnly: true }),
    { tone: "provided", label: "Provided", complete: true },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, requiresPassingTests: true }),
    { tone: "pending", label: "Pending", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, requiresPassingTests: true, results: [{ passed: true }] }),
    { tone: "passed", label: "Tests pass", complete: true },
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
    { tone: "failed", label: "Needs work", complete: false },
  );
});
