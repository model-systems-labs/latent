import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));

const solutions = {
  firstEcho(values) {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) return value;
      seen.add(value);
    }
    return null;
  },

  gatesCloseCleanly(events) {
    const stack = [];
    for (const event of events) {
      if (event === event.toUpperCase()) stack.push(event);
      else if (stack.pop() !== event.toUpperCase()) return false;
    }
    return stack.length === 0;
  },

  quietestWindow(readings, width) {
    let sum = readings.slice(0, width).reduce((total, value) => total + value, 0);
    let bestSum = sum;
    let bestIndex = 0;
    for (let right = width; right < readings.length; right += 1) {
      sum += readings[right] - readings[right - width];
      if (sum < bestSum) {
        bestSum = sum;
        bestIndex = right - width + 1;
      }
    }
    return bestIndex;
  },

  longestUniqueSpan(text) {
    const latest = new Map();
    let left = 0;
    let best = 0;
    for (let right = 0; right < text.length; right += 1) {
      left = Math.max(left, (latest.get(text[right]) ?? -1) + 1);
      latest.set(text[right], right);
      best = Math.max(best, right - left + 1);
    }
    return best;
  },

  reverseChain(head) {
    let output = null;
    for (let node = head; node; node = node.next) {
      output = { value: node.value, next: output };
    }
    return output;
  },

  condenseWindows(windows) {
    const sorted = windows.map(([start, end]) => [start, end])
      .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    const output = [];
    for (const window of sorted) {
      const previous = output.at(-1);
      if (!previous || window[0] > previous[1]) output.push(window);
      else previous[1] = Math.max(previous[1], window[1]);
    }
    return output;
  },

  minutesToReachAll(grid) {
    const queue = [];
    const seen = new Set();
    let healthy = 0;
    for (let row = 0; row < grid.length; row += 1) {
      for (let column = 0; column < grid[row].length; column += 1) {
        if (grid[row][column] === "S") {
          queue.push([row, column, 0]);
          seen.add(`${row}:${column}`);
        } else if (grid[row][column] === "H") healthy += 1;
      }
    }
    let reached = 0;
    let minutes = 0;
    for (let index = 0; index < queue.length; index += 1) {
      const [row, column, minute] = queue[index];
      for (const [rowDelta, columnDelta] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextRow = row + rowDelta;
        const nextColumn = column + columnDelta;
        const key = `${nextRow}:${nextColumn}`;
        if (
          grid[nextRow]?.[nextColumn] !== "H"
          || seen.has(key)
        ) continue;
        seen.add(key);
        reached += 1;
        minutes = minute + 1;
        queue.push([nextRow, nextColumn, minute + 1]);
      }
    }
    return reached === healthy ? minutes : -1;
  },

  fewestRelayHops(nodeCount, links, start, goal) {
    if (start === goal) return 0;
    const neighbors = Array.from({ length: nodeCount }, () => []);
    for (const [left, right] of links) {
      neighbors[left].push(right);
      neighbors[right].push(left);
    }
    const queue = [[start, 0]];
    const seen = new Set([start]);
    for (let index = 0; index < queue.length; index += 1) {
      const [node, distance] = queue[index];
      for (const next of neighbors[node]) {
        if (next === goal) return distance + 1;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push([next, distance + 1]);
        }
      }
    }
    return -1;
  },

  minimumClimbEnergy(heights) {
    if (heights.length === 1) return 0;
    let twoBack = 0;
    let oneBack = Math.abs(heights[1] - heights[0]);
    for (let index = 2; index < heights.length; index += 1) {
      const current = Math.min(
        oneBack + Math.abs(heights[index] - heights[index - 1]),
        twoBack + Math.abs(heights[index] - heights[index - 2]),
      );
      twoBack = oneBack;
      oneBack = current;
    }
    return oneBack;
  },

  minimumDailyCapacity(loads, days) {
    let low = Math.max(...loads);
    let high = loads.reduce((total, value) => total + value, 0);
    while (low < high) {
      const capacity = Math.floor((low + high) / 2);
      let usedDays = 1;
      let current = 0;
      for (const load of loads) {
        if (current + load > capacity) {
          usedDays += 1;
          current = 0;
        }
        current += load;
      }
      if (usedDays <= days) high = capacity;
      else low = capacity + 1;
    }
    return low;
  },
};

for (const group of library.groups) {
  for (const question of group.questions) {
    test(`${question.title} reference solution satisfies every authored case`, () => {
      const solution = solutions[question.entrypoint.functionName];
      assert.equal(typeof solution, "function");
      for (const exerciseCase of question.cases) {
        const actual = solution(...structuredClone(exerciseCase.args));
        const expected = exerciseCase.assertions[0].expected;
        assert.deepEqual(actual, expected, exerciseCase.id);
      }
    });
  }
}
