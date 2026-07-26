"use client";

import { useState } from "react";
import type { HarnessExperimentVariant } from "../../products/courses/reference-curriculum/content/harness-engineering/experiments";

type HarnessResult = {
  control: string;
  minimum: number;
  maximum: number;
  step: number;
  initial: number;
  metrics: Array<{ label: string; value: string }>;
  trace: Array<{ label: string; detail: string }>;
};

export function harnessExperimentResult(variant: HarnessExperimentVariant, value: number): HarnessResult {
  if (variant === "agent-loop") {
    const budget = 6;
    const completed = value <= budget;
    return {
      control: "Tool calls before the final response",
      minimum: 0,
      maximum: 8,
      step: 1,
      initial: 2,
      metrics: [
        { label: "Model turns", value: String(Math.min(value + 1, budget + 1)) },
        { label: "Tool calls", value: String(Math.min(value, budget)) },
        { label: "Budget remaining", value: String(Math.max(0, budget - value)) },
        { label: "Terminal state", value: completed ? "complete" : "budget exceeded" },
      ],
      trace: [
        { label: "Propose", detail: "The model returns a final answer or a structured tool call." },
        { label: "Validate", detail: "The harness checks the response shape, tool name, arguments, and remaining budget." },
        { label: completed ? "Continue or finish" : "Stop", detail: completed ? "A tool observation becomes the next input until a final answer arrives." : "The harness terminates before another action can run." },
      ],
    };
  }

  if (variant === "tool-contracts") {
    const total = 12;
    const returned = Math.min(value, total);
    return {
      control: "Results per page",
      minimum: 1,
      maximum: 12,
      step: 1,
      initial: 4,
      metrics: [
        { label: "Returned", value: String(returned) },
        { label: "Still omitted", value: String(total - returned) },
        { label: "Next offset", value: returned < total ? String(returned) : "none" },
      ],
      trace: [
        { label: "Validate input", detail: "Required fields, types, and unknown fields are checked before dispatch." },
        { label: "Run tool", detail: "Only validated arguments cross the model-to-software boundary." },
        { label: "Bound output", detail: `${returned} of ${total} records return with explicit pagination metadata.` },
      ],
    };
  }

  if (variant === "context-selection") {
    const items = [
      { name: "System rules", tokens: 90, required: true, priority: 100 },
      { name: "Current task", tokens: 80, required: true, priority: 100 },
      { name: "Failing test", tokens: 140, required: false, priority: 90 },
      { name: "Relevant source", tokens: 210, required: false, priority: 70 },
      { name: "Old log", tokens: 180, required: false, priority: 20 },
    ];
    let used = 0;
    const selected: string[] = [];
    for (const item of items.filter((item) => item.required)) {
      if (used + item.tokens <= value) { selected.push(item.name); used += item.tokens; }
    }
    for (const item of items.filter((item) => !item.required).sort((left, right) => right.priority - left.priority)) {
      if (used + item.tokens <= value) { selected.push(item.name); used += item.tokens; }
    }
    return {
      control: "Context budget",
      minimum: 200,
      maximum: 800,
      step: 50,
      initial: 450,
      metrics: [
        { label: "Selected", value: `${selected.length} / ${items.length}` },
        { label: "Tokens used", value: `${used} / ${value}` },
        { label: "Remaining", value: String(value - used) },
      ],
      trace: items.map((item) => ({
        label: item.name,
        detail: selected.includes(item.name) ? `${item.tokens} tokens · included` : `${item.tokens} tokens · omitted`,
      })),
    };
  }

  if (variant === "permission-boundaries") {
    const decisions = [
      { label: "Read source", decision: "allow", reason: "inside the workspace" },
      { label: "Write source", decision: value > 0 ? "allow" : "confirm", reason: value > 0 ? "scoped edit" : "state-changing action" },
      { label: "Read credentials", decision: "deny", reason: "a narrow rule cannot override the credential boundary" },
      { label: "Run tests", decision: value > 1 ? "allow" : "confirm", reason: value > 1 ? "approved command class" : "process execution" },
      { label: "Unknown network host", decision: "deny", reason: "no matching allow rule" },
    ];
    const count = (decision: string) => decisions.filter((item) => item.decision === decision).length;
    return {
      control: "Autonomy level",
      minimum: 0,
      maximum: 2,
      step: 1,
      initial: 1,
      metrics: [
        { label: "Allowed", value: String(count("allow")) },
        { label: "Needs approval", value: String(count("confirm")) },
        { label: "Denied", value: String(count("deny")) },
      ],
      trace: decisions.map((item) => ({ label: item.label, detail: `${item.decision} · ${item.reason}` })),
    };
  }

  if (variant === "state-and-recovery") {
    const total = 6;
    const finished = Math.max(0, value - 1);
    return {
      control: "Failure after step",
      minimum: 1,
      maximum: 6,
      step: 1,
      initial: 4,
      metrics: [
        { label: "Durable completions", value: String(finished) },
        { label: "Blind restart repeats", value: String(finished) },
        { label: "Pending after restart", value: String(total - finished) },
      ],
      trace: [
        { label: "Record", detail: `${finished} completed actions have stable event IDs outside the sandbox.` },
        { label: "Fail", detail: `The disposable worker stops before step ${value}.` },
        { label: "Replay", detail: "Logged completions are not scheduled again. An in-flight external action still needs an idempotency key or receipt." },
        { label: "Resume", detail: `Execution continues with ${total - finished} pending actions.` },
      ],
    };
  }

  if (variant === "agent-evaluations") {
    const total = 10;
    const k = 3;
    const choose = (n: number, size: number) => {
      if (size < 0 || size > n) return 0;
      let result = 1;
      for (let index = 1; index <= size; index += 1) result = (result * (n - size + index)) / index;
      return result;
    };
    const combinations = choose(total, k);
    const passAtThree = 1 - (choose(total - value, k) / combinations);
    const passThree = choose(value, k) / combinations;
    return {
      control: "Successful trials out of 10",
      minimum: 0,
      maximum: 10,
      step: 1,
      initial: 6,
      metrics: [
        { label: "Pass rate", value: `${value * 10}%` },
        { label: "Pass@3", value: `${Math.round(passAtThree * 100)}%` },
        { label: "Pass³", value: `${Math.round(passThree * 100)}%` },
      ],
      trace: [
        { label: "Outcome", detail: "Grade the resulting files, tests, or environment state—not one preferred transcript." },
        { label: "Pass@3", detail: "Draw-without-replacement estimate that at least one of three attempts succeeds." },
        { label: "Pass³", detail: "Draw-without-replacement estimate that all three attempts succeed." },
      ],
    };
  }

  if (variant === "integrated-harness") {
    const completed = value >= 2;
    return {
      control: "Turn budget",
      minimum: 1,
      maximum: 4,
      step: 1,
      initial: 2,
      metrics: [
        { label: "Model turns", value: String(Math.min(value, 2)) },
        { label: "Tool calls", value: "1" },
        { label: "Run status", value: completed ? "completed" : "turn limit reached" },
      ],
      trace: [
        { label: "Turn 1", detail: "Validate read_file, apply the read policy, and record its observation." },
        { label: "Turn 2", detail: completed ? "Accept the final response and close the run." : "The second saved reply is never read because the turn limit is 1." },
        { label: "Audit", detail: completed ? "Every call has one result and the terminal event is last." : "The partial trace remains inspectable without claiming completion." },
      ],
    };
  }

  const tasks = [
    { id: "inspect", duration: 4, dependencies: [] as string[] },
    { id: "research", duration: 3, dependencies: [] as string[] },
    { id: "fixtures", duration: 2, dependencies: [] as string[] },
    { id: "implement", duration: 5, dependencies: ["inspect", "research"] },
    { id: "document", duration: 2, dependencies: ["research"] },
    { id: "verify", duration: 3, dependencies: ["implement", "fixtures"] },
  ];
  const serial = tasks.reduce((sum, task) => sum + task.duration, 0);
  const workers = Math.max(1, value);
  const completed = new Set<string>();
  const running = new Map<string, { remaining: number; started: number }>();
  const schedule: Array<{ id: string; started: number; ended: number }> = [];
  let elapsed = 0;
  while (completed.size < tasks.length) {
    for (const task of tasks) {
      if (running.size >= workers) break;
      if (completed.has(task.id) || running.has(task.id)) continue;
      if (task.dependencies.every((dependency) => completed.has(dependency))) {
        running.set(task.id, { remaining: task.duration, started: elapsed });
      }
    }
    const advance = Math.min(...[...running.values()].map((task) => task.remaining));
    elapsed += advance;
    for (const [id, task] of [...running]) {
      task.remaining -= advance;
      if (task.remaining === 0) {
        completed.add(id);
        running.delete(id);
        schedule.push({ id, started: task.started, ended: elapsed });
      }
    }
  }
  return {
    control: "Available workers",
    minimum: 1,
    maximum: 4,
    step: 1,
    initial: 2,
    metrics: [
      { label: "Workers", value: String(workers) },
      { label: "Serial time", value: `${serial} min` },
        { label: "Scheduled time", value: `${elapsed} min` },
      ],
      trace: schedule
        .sort((left, right) => left.started - right.started || left.id.localeCompare(right.id))
        .map((task) => ({ label: task.id, detail: `minute ${task.started}–${task.ended}` })),
  };
}

export default function HarnessExperiment({ variant, onComplete }: { variant: HarnessExperimentVariant; onComplete: () => void }) {
  const initial = harnessExperimentResult(variant, 0).initial;
  const [value, setValue] = useState(initial);
  const [ran, setRan] = useState(false);
  const result = harnessExperimentResult(variant, value);
  return (
    <>
      <div className="simulation-controls fundamentals-controls">
        <label>
          <span>{result.control} · {value}</span>
          <input
            aria-label={result.control}
            type="range"
            min={result.minimum}
            max={result.maximum}
            step={result.step}
            value={value}
            onChange={(event) => { setValue(Number(event.target.value)); setRan(false); }}
          />
        </label>
      </div>
      <div className="experiment-action">
        <p>Set one condition, then run the example.</p>
        <button type="button" onClick={() => { setRan(true); onComplete(); }}>
          {ran ? "Run again" : "Run trace"}
        </button>
      </div>
      {ran ? (
        <div className="simulation-result fundamentals-result">
          <div className="metric-grid">
            {result.metrics.map((metric) => <span key={metric.label}><em>{metric.label}</em><strong>{metric.value}</strong></span>)}
          </div>
          <div className="trace-list compact-trace">
            {result.trace.map((item, index) => <div key={item.label}><span>{index + 1}</span><strong>{item.label}</strong><p>{item.detail}</p></div>)}
          </div>
        </div>
      ) : null}
    </>
  );
}
