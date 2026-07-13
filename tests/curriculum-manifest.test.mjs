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
  assert.match(pairFeedback, /do not concatenate/);

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
  assert.match(scoreFeedback, /Wk/);
  assert.match(scoreFeedback, /not a plain query-key dot product/);

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
  assert.match(scorerFeedback, /first standalone/);
});

test("practice verification is inseparable from the exact editor source and contract version", () => {
  const block = { id: "rnn-step", code: "function rnnStep() { return 'reference'; }" };
  const correct = "function rnnStep() { return 'correct learner answer'; }";
  const wrong = "function rnnStep() { return 'wrong learner answer'; }";
  const currentVersion = "llm-systems-contracts-v6";
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
