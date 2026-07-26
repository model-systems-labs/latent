import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
const scenarioSourceUrl = new URL("../products/courses/reference-curriculum/content/harness-engineering/scenarios.ts", import.meta.url);
const workbenchSourceUrl = new URL("../app/components/HarnessWorkbench.tsx", import.meta.url);
const workbenchStylesUrl = new URL("../app/components/HarnessWorkbench.module.css", import.meta.url);
const lessonSourceUrl = new URL("../products/courses/reference-curriculum/lessons/harness-engineering/index.ts", import.meta.url);
const expectedIds = [
  "read-file-and-finish",
  "denied-secret-read",
  "approval-before-write",
  "turn-budget-exhausted",
];
const expectedKinds = [
  "successful-tool-use",
  "denied-request",
  "approval-required",
  "turn-budget-exhausted",
];

let scenariosModule;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  scenariosModule = await vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/scenarios.ts");
});

after(async () => {
  await vite?.close();
});

test("four named scenarios cover the key harness outcomes", () => {
  const fixtures = scenariosModule.HARNESS_SCENARIO_FIXTURES;
  assert.equal(fixtures.length, 4);
  assert.deepEqual(fixtures.map(({ id }) => id), expectedIds);
  assert.deepEqual(fixtures.map(({ kind }) => kind), expectedKinds);
  assert.equal(new Set(fixtures.map(({ id }) => id)).size, fixtures.length);

  assert.deepEqual(fixtures.map(({ expected }) => ({
    terminalStatus: expected.terminalStatus,
    final: expected.final,
    toolCallCount: expected.toolCallCount,
  })), [
    { terminalStatus: "completed", final: "The project is ready to test.", toolCallCount: 1 },
    {
      terminalStatus: "completed",
      final: "I could not read that file because the request was denied.",
      toolCallCount: 0,
    },
    { terminalStatus: "approval_required", final: null, toolCallCount: 0 },
    { terminalStatus: "budget_exceeded", final: null, toolCallCount: 2 },
  ]);
  for (const { expected } of fixtures) {
    assert.ok(Number.isInteger(expected.turns) && expected.turns > 0);
    assert.ok(expected.messageRoles.length > 0);
    assert.ok(expected.eventKinds.length > 0);
  }
});

test("each scenario is complete deterministic JSON data", () => {
  const allowedStatuses = new Set([
    "completed",
    "approval_required",
    "budget_exceeded",
    "model_exhausted",
  ]);

  for (const scenario of scenariosModule.HARNESS_SCENARIO_FIXTURES) {
    assert.deepEqual(Object.keys(scenario).sort(), [
      "description",
      "expected",
      "id",
      "initialMessages",
      "kind",
      "label",
      "maxTurns",
      "permissionRules",
      "recordedResponses",
      "tools",
    ]);
    assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Number.isInteger(scenario.maxTurns) && scenario.maxTurns > 0);
    assert.ok(scenario.initialMessages.length > 0);
    assert.ok(scenario.recordedResponses.length > 0);
    assert.ok(scenario.tools.length > 0);
    assert.ok(scenario.permissionRules.length > 0);
    assert.ok(allowedStatuses.has(scenario.expected.terminalStatus));
    assert.equal(typeof scenario.expected.toolCallCount, "number");
    assert.doesNotThrow(() => JSON.stringify(scenario));

    const toolsByName = new Map(scenario.tools.map((tool) => [tool.name, tool]));
    const callIds = new Set();
    for (const response of scenario.recordedResponses) {
      assert.equal(("final" in response) === ("tool_call" in response), false);
      if (!("tool_call" in response)) continue;
      const call = response.tool_call;
      assert.ok(call.id && !callIds.has(call.id));
      callIds.add(call.id);
      const tool = toolsByName.get(call.name);
      assert.ok(tool, `${scenario.id} names an available tool`);
      assert.ok(Object.hasOwn(tool.outputs, call.id), `${scenario.id} records output for ${call.id}`);
    }

    for (const tool of scenario.tools) {
      assert.match(tool.name, /^[a-z][a-z0-9_]*$/);
      assert.ok(tool.target_arg);
      assert.ok(Object.keys(tool.required).length > 0);
    }
    for (const rule of scenario.permissionRules) {
      assert.match(rule.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(rule.target_prefix);
      assert.ok(["allow", "confirm", "deny"].includes(rule.decision));
    }
  }
});

test("course fixtures are frozen and editable copies do not leak changes", () => {
  const canonical = scenariosModule.HARNESS_SCENARIO_FIXTURES;
  assert.ok(Object.isFrozen(canonical));
  assert.ok(Object.isFrozen(canonical[0]));
  assert.ok(Object.isFrozen(canonical[0].recordedResponses));
  assert.ok(Object.isFrozen(canonical[0].tools[0].outputs));

  const first = scenariosModule.createHarnessScenarioFixtures();
  const second = scenariosModule.createHarnessScenarioFixtures();
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
  assert.notEqual(first[0].tools[0].outputs, second[0].tools[0].outputs);

  first[0].label = "Changed locally";
  first[0].initialMessages[0].content = "Changed locally";
  first[0].tools[0].outputs["read-ready-file"] = "Changed locally";
  assert.equal(second[0].label, "Read a file and finish");
  assert.equal(second[0].initialMessages[0].content, "What does /workspace/README.md say?");
  assert.equal(second[0].tools[0].outputs["read-ready-file"], "Project status: ready to test.");
  assert.equal(canonical[0].label, "Read a file and finish");
});

test("the scenarios stay separate from Browser Chat", () => {
  const source = readFileSync(scenarioSourceUrl, "utf8");
  const renderedFixtures = JSON.stringify(scenariosModule.HARNESS_SCENARIO_FIXTURES);
  assert.match(source, /import type \{ JsonValue \} from "@latent\/python-lab\/types"/);
  assert.doesNotMatch(source, /@latent\/browser-lab|project-workspace|browser-chat/i);
  assert.doesNotMatch(renderedFixtures, /browser[ -]chat|capstone/i);
});

test("labels and descriptions read like plain instructions", () => {
  const jargon = /\b(?:adapter|deterministic|fixture|inference|orchestration|protocol|schema|serialization|terminal)\b/i;
  for (const { label, description } of scenariosModule.HARNESS_SCENARIO_FIXTURES) {
    assert.ok(label.length >= 8 && label.length <= 36, label);
    assert.ok(description.length >= 36 && description.length <= 100, description);
    assert.match(label, /^[A-Z][^.?!]+$/);
    assert.match(description, /^[A-Z].*[.]$/);
    assert.doesNotMatch(label, jargon);
    assert.doesNotMatch(description, jargon);
  }
});

test("scenario arguments cross the browser boundary through one explicit recorded adapter", () => {
  assert.equal(scenariosModule.HARNESS_SCENARIO_MODULE_PATH, "harness/harness.py");
  assert.equal(scenariosModule.HARNESS_SCENARIO_EXPORT, "run_recorded_harness");
  for (const scenario of scenariosModule.HARNESS_SCENARIO_FIXTURES) {
    const args = scenariosModule.harnessScenarioArguments(scenario);
    assert.equal(args.length, 5);
    assert.deepEqual(args[0], scenario.initialMessages);
    assert.deepEqual(args[1], { adapter: "recorded", responses: scenario.recordedResponses });
    assert.deepEqual(args[2], scenario.tools);
    assert.deepEqual(args[3], scenario.permissionRules);
    assert.equal(args[4], scenario.maxTurns);
    args[1].responses[0] = { final: "changed" };
    assert.notDeepEqual(args[1].responses, scenario.recordedResponses);
  }
});

test("visible traces are derived from actual run messages and events", () => {
  const trace = scenariosModule.harnessScenarioTrace({
    status: "completed",
    final: "Done",
    turns: 2,
    tool_calls: 1,
    messages: [
      { role: "user", content: "Read it" },
      { role: "assistant", tool_call: { id: "c1", name: "read_file", arguments: { path: "/workspace/a.py" } } },
      { role: "tool", call_id: "c1", content: "print('a')", is_error: false },
      { role: "assistant", content: "Done" },
    ],
    events: [
      { kind: "action_proposed", call_id: "c1" },
      { kind: "policy_decision", call_id: "c1", decision: "allow", rule_id: "workspace-read" },
      { kind: "tool_completed", call_id: "c1" },
      { kind: "run_completed", turn: 2 },
    ],
  });
  assert.equal(trace.status, "completed");
  assert.equal(trace.summary, "Completed after 2 model turns and 1 tool call.");
  assert.deepEqual(trace.rows.map(({ actor }) => actor), ["model", "harness", "tool", "model"]);
  assert.match(trace.rows[0].text, /read_file.*workspace\/a\.py/);
  assert.match(trace.rows[1].text, /Allowed.*workspace-read/);
  assert.match(trace.rows[2].text, /print\('a'\)/);
  assert.match(trace.rows[3].text, /Done/);
});

test("a matching status cannot turn an empty or broken trace green", () => {
  const scenario = scenariosModule.HARNESS_SCENARIO_FIXTURES[0];
  assert.equal(scenariosModule.harnessScenarioMatchesExpected({
    status: scenario.expected.terminalStatus,
    final: scenario.expected.final,
    turns: scenario.expected.turns,
    tool_calls: scenario.expected.toolCallCount,
    messages: [],
    events: [],
  }, scenario), false);
});

test("the code setting presents one minimal recorded-model runner on desktop and mobile", () => {
  const source = readFileSync(workbenchSourceUrl, "utf8");
  const css = readFileSync(workbenchStylesUrl, "utf8");
  assert.match(source, /runPythonProjectFunction/);
  assert.doesNotMatch(source, /runPythonProjectFile|CPython in your browser|Standard output will appear here/);
  assert.match(source, /\["files", "code", "run", "checks"\]/);
  assert.match(source, /<nav className=\{styles\.inspectorTabs\} aria-label="Inspector views">/);
  assert.match(source, /The model replies and tool results are fixed test data\. Your Python parses each reply, checks permissions, applies the turn limit, and builds the trace\./);
  assert.match(source, /<summary>View fixed model replies<\/summary>[\s\S]*?<CodeEditor[\s\S]*?readOnly/);
  assert.match(source, /aria-keyshortcuts="Control\+Enter Meta\+Enter"/);
  assert.match(source, /event\.key === "Escape" && busy/);
  assert.doesNotMatch(source, /className=\{styles\.outputPanel\}/);
  assert.match(css, /\.inspector\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
  assert.match(css, /\.scenarioControls select\s*\{[^}]*min-height:\s*2\.75rem/s);
  assert.match(css, /data-mobile-view="run"/);
  assert.match(css, /\.cassetteEditor :global\(\.cm-editor\)\s*\{[^}]*font-size:\s*15px/s);
});

test("the integrated project depends on a model interface while the browser wrapper owns recordings", () => {
  const source = readFileSync(lessonSourceUrl, "utf8");
  const block = source.slice(source.indexOf("class ModelExhausted"), source.indexOf("id: \"audit-harness-run\""));
  assert.match(block, /class RecordedModel/);
  assert.match(block, /def run_harness\(initial_messages, model, tools, rules, max_turns\):/);
  assert.match(block, /model\.generate\(copy\.deepcopy\(history\), copy\.deepcopy\(model_tools\)\)/);
  assert.match(block, /class RecordedTool:/);
  assert.match(block, /def run_recorded_harness\(initial_messages, model_config, tool_configs, rules, max_turns\):/);
  assert.match(block, /RecordedModel\(model_config\.get\("responses"\)\)/);
  assert.doesNotMatch(block, /responses\[turn - 1\]/);
  const modelTools = block.slice(block.indexOf("model_tools ="), block.indexOf("history ="));
  assert.match(modelTools, /tool\.model_schema\(\)/);
  const modelSchema = block.slice(block.indexOf("def model_schema"), block.indexOf("def validate"));
  assert.match(modelSchema, /"name"[\s\S]*?"required"/);
  assert.doesNotMatch(modelSchema, /outputs|rules|target_arg/);
});
