import type { QuestionGroupLibrary } from "@latent/course-kit";

export const methodQuestionLibrary = {
  format: "latent-question-group-library",
  schemaVersion: 1,
  library: {
    id: "latent/method-practice",
    version: "1.0.0",
    title: "Method practice",
    description: "Original interview-style coding questions that run locally in the browser.",
    authors: [{
      name: "Model Systems Labs",
      url: "https://github.com/model-systems-labs",
    }],
    license: {
      expression: "Apache-2.0",
      url: "https://www.apache.org/licenses/LICENSE-2.0",
    },
    provenance: {
      sourceUrl: "https://github.com/model-systems-labs/latent",
      revision: "method-practice-1.0.0",
    },
  },
  objectives: [
    {
      id: "array-map-methods",
      title: "Design array and map methods",
      description: "Choose sets, maps, and stable iteration to implement bounded collection transformations.",
    },
    {
      id: "text-stack-methods",
      title: "Design text and stack methods",
      description: "Use stacks, normalization rules, and sliding windows to implement reliable text transformations.",
    },
  ],
  sources: [{
    id: "latent-original",
    title: "Latent original method-practice library",
    url: "https://github.com/model-systems-labs/latent/tree/main/app/content/practice",
    note: "Original practice prompts and checks maintained with the Latent reference application.",
    license: {
      expression: "Apache-2.0",
      url: "https://www.apache.org/licenses/LICENSE-2.0",
    },
  }],
  runtimes: [{
    id: "browser-typescript",
    language: "typescript",
    environment: "browser-worker",
    engine: "esbuild-wasm",
    engineVersion: "0.28.1",
    capabilities: ["class-method", "exceptions"],
    limits: {
      timeoutMs: 2_000,
      maxOutputBytes: 100_000,
    },
  }],
  groups: [
    {
      id: "arrays-and-maps",
      order: 1,
      title: "Arrays and maps",
      description: "Use sets, lookup tables, and stable iteration to turn repeated scans into clear methods.",
      objectiveIds: ["array-map-methods"],
      questions: [
        {
          id: "unique-values",
          order: 1,
          title: "Keep unique values",
          difficulty: "easy",
          language: "typescript",
          path: "unique-values.ts",
          prompt: "Return the values that appear in the input, keeping only their first appearance. Preserve the original order.",
          constraints: [
            "The input contains at most 10,000 finite numbers.",
            "Do not sort the input.",
            "Return a new array.",
          ],
          starterCode: `class Solution {
  uniqueValues(values: number[]): number[] {
    // Keep the first appearance of every value.
    return [];
  }
}
`,
          entrypoint: {
            kind: "class-method",
            className: "Solution",
            methodName: "uniqueValues",
          },
          objectiveIds: ["array-map-methods"],
          sourceIds: ["latent-original"],
          runtimeId: "browser-typescript",
          tags: ["arrays", "sets"],
          cases: [
            {
              id: "mixed-duplicates",
              label: "keeps the first copy of repeated values",
              visibility: "example",
              args: [[4, 2, 4, 1, 2]],
              assertions: [{
                id: "result",
                label: "returns [4, 2, 1]",
                kind: "deep-equal",
                expected: [4, 2, 1],
              }],
            },
            {
              id: "already-unique",
              label: "leaves an already unique list alone",
              visibility: "example",
              args: [[3, 1, 8]],
              assertions: [{
                id: "result",
                label: "returns [3, 1, 8]",
                kind: "deep-equal",
                expected: [3, 1, 8],
              }],
            },
            {
              id: "empty",
              label: "handles an empty input",
              visibility: "check",
              args: [[]],
              assertions: [{
                id: "result",
                label: "returns an empty array",
                kind: "deep-equal",
                expected: [],
              }],
            },
            {
              id: "negative-and-zero",
              label: "handles zero and negative values",
              visibility: "check",
              args: [[0, -2, 0, -2, 5]],
              assertions: [{
                id: "result",
                label: "returns [0, -2, 5]",
                kind: "deep-equal",
                expected: [0, -2, 5],
              }],
            },
          ],
        },
        {
          id: "pair-target-indices",
          order: 2,
          title: "Find a target pair",
          difficulty: "easy",
          language: "typescript",
          path: "pair-target-indices.ts",
          prompt: "Return the indices of two different values whose sum equals the target. Prefer the pair whose second index appears first. Return an empty array when no pair exists.",
          constraints: [
            "The input contains at most 20,000 finite numbers.",
            "Each checked input has at most one answer for its earliest second index.",
            "Do not reuse the same array position.",
          ],
          starterCode: `class Solution {
  pairTargetIndices(values: number[], target: number): number[] {
    // Return [earlierIndex, laterIndex], or [].
    return [];
  }
}
`,
          entrypoint: {
            kind: "class-method",
            className: "Solution",
            methodName: "pairTargetIndices",
          },
          objectiveIds: ["array-map-methods"],
          sourceIds: ["latent-original"],
          runtimeId: "browser-typescript",
          tags: ["arrays", "maps"],
          cases: [
            {
              id: "middle-pair",
              label: "finds a pair in the middle of the list",
              visibility: "example",
              args: [[8, 3, 5, 11], 8],
              assertions: [{
                id: "result",
                label: "returns [1, 2]",
                kind: "deep-equal",
                expected: [1, 2],
              }],
            },
            {
              id: "duplicate-values",
              label: "uses two different positions for equal values",
              visibility: "example",
              args: [[4, 4, 9], 8],
              assertions: [{
                id: "result",
                label: "returns [0, 1]",
                kind: "deep-equal",
                expected: [0, 1],
              }],
            },
            {
              id: "no-pair",
              label: "returns an empty array when no pair exists",
              visibility: "check",
              args: [[1, 2, 3], 10],
              assertions: [{
                id: "result",
                label: "returns an empty array",
                kind: "deep-equal",
                expected: [],
              }],
            },
            {
              id: "earliest-second-index",
              label: "prefers the earliest completed pair",
              visibility: "check",
              args: [[2, 7, 4, 5], 9],
              assertions: [{
                id: "result",
                label: "returns [0, 1]",
                kind: "deep-equal",
                expected: [0, 1],
              }],
            },
          ],
        },
        {
          id: "group-equivalent-words",
          order: 3,
          title: "Group equivalent words",
          difficulty: "medium",
          language: "typescript",
          path: "group-equivalent-words.ts",
          prompt: "Group words that contain the same letters with the same counts. Keep groups in the order their first word appears, and keep words inside each group in input order.",
          constraints: [
            "Words contain lowercase English letters only.",
            "The input contains at most 5,000 words.",
            "Return a new nested array.",
          ],
          starterCode: `class Solution {
  groupEquivalentWords(words: string[]): string[][] {
    // Build one stable group for each letter signature.
    return [];
  }
}
`,
          entrypoint: {
            kind: "class-method",
            className: "Solution",
            methodName: "groupEquivalentWords",
          },
          objectiveIds: ["array-map-methods"],
          sourceIds: ["latent-original"],
          runtimeId: "browser-typescript",
          tags: ["strings", "maps", "sorting"],
          cases: [
            {
              id: "several-groups",
              label: "groups words by their letter counts",
              visibility: "example",
              args: [["arc", "below", "car", "elbow", "state", "taste"]],
              assertions: [{
                id: "result",
                label: "returns stable groups",
                kind: "deep-equal",
                expected: [["arc", "car"], ["below", "elbow"], ["state", "taste"]],
              }],
            },
            {
              id: "single-word",
              label: "puts one word in one group",
              visibility: "example",
              args: [["solo"]],
              assertions: [{
                id: "result",
                label: "returns [[solo]]",
                kind: "deep-equal",
                expected: [["solo"]],
              }],
            },
            {
              id: "empty",
              label: "handles an empty list",
              visibility: "check",
              args: [[]],
              assertions: [{
                id: "result",
                label: "returns no groups",
                kind: "deep-equal",
                expected: [],
              }],
            },
            {
              id: "repeated-words",
              label: "keeps repeated words",
              visibility: "check",
              args: [["no", "on", "no"]],
              assertions: [{
                id: "result",
                label: "returns all three words in one group",
                kind: "deep-equal",
                expected: [["no", "on", "no"]],
              }],
            },
          ],
        },
      ],
    },
    {
      id: "text-and-stacks",
      order: 2,
      title: "Text and stacks",
      description: "Practice stateful scans where one pass and the right data structure make the behavior easy to reason about.",
      objectiveIds: ["text-stack-methods"],
      questions: [
        {
          id: "balanced-delimiters",
          order: 1,
          title: "Check balanced delimiters",
          difficulty: "easy",
          language: "typescript",
          path: "balanced-delimiters.ts",
          prompt: "Return true when every round, square, and curly delimiter closes in the correct order. Ignore all other characters.",
          constraints: [
            "The input contains at most 100,000 characters.",
            "Only (), [], and {} affect the result.",
            "An empty string is balanced.",
          ],
          starterCode: `class Solution {
  balancedDelimiters(text: string): boolean {
    // Track delimiters that still need a closing match.
    return false;
  }
}
`,
          entrypoint: {
            kind: "class-method",
            className: "Solution",
            methodName: "balancedDelimiters",
          },
          objectiveIds: ["text-stack-methods"],
          sourceIds: ["latent-original"],
          runtimeId: "browser-typescript",
          tags: ["strings", "stacks"],
          cases: [
            {
              id: "nested",
              label: "accepts correctly nested delimiters",
              visibility: "example",
              args: ["a({b[c]})"],
              assertions: [{
                id: "result",
                label: "returns true",
                kind: "deep-equal",
                expected: true,
              }],
            },
            {
              id: "wrong-order",
              label: "rejects delimiters closed in the wrong order",
              visibility: "example",
              args: ["([)]"],
              assertions: [{
                id: "result",
                label: "returns false",
                kind: "deep-equal",
                expected: false,
              }],
            },
            {
              id: "unfinished",
              label: "rejects an unclosed delimiter",
              visibility: "check",
              args: ["hello ["],
              assertions: [{
                id: "result",
                label: "returns false",
                kind: "deep-equal",
                expected: false,
              }],
            },
            {
              id: "plain-text",
              label: "accepts text with no delimiters",
              visibility: "check",
              args: ["plain text"],
              assertions: [{
                id: "result",
                label: "returns true",
                kind: "deep-equal",
                expected: true,
              }],
            },
          ],
        },
        {
          id: "normalize-path",
          order: 2,
          title: "Normalize a path",
          difficulty: "easy",
          language: "typescript",
          path: "normalize-path.ts",
          prompt: "Normalize an absolute slash-separated path. Remove repeated separators and current-directory segments. A parent segment removes one prior segment but never moves above the root.",
          constraints: [
            "The input always starts with /.",
            "Segments contain letters, numbers, dots, dashes, or underscores.",
            "Return / when no named segments remain.",
          ],
          starterCode: `class Solution {
  normalizePath(path: string): string {
    // Resolve each path segment against a stack.
    return "/";
  }
}
`,
          entrypoint: {
            kind: "class-method",
            className: "Solution",
            methodName: "normalizePath",
          },
          objectiveIds: ["text-stack-methods"],
          sourceIds: ["latent-original"],
          runtimeId: "browser-typescript",
          tags: ["strings", "stacks"],
          cases: [
            {
              id: "mixed-segments",
              label: "resolves repeated, current, and parent segments",
              visibility: "example",
              args: ["/models//tiny/./weights/../config"],
              assertions: [{
                id: "result",
                label: "returns /models/tiny/config",
                kind: "deep-equal",
                expected: "/models/tiny/config",
              }],
            },
            {
              id: "root",
              label: "keeps the root path",
              visibility: "example",
              args: ["/"],
              assertions: [{
                id: "result",
                label: "returns /",
                kind: "deep-equal",
                expected: "/",
              }],
            },
            {
              id: "above-root",
              label: "does not move above root",
              visibility: "check",
              args: ["/../../logs"],
              assertions: [{
                id: "result",
                label: "returns /logs",
                kind: "deep-equal",
                expected: "/logs",
              }],
            },
            {
              id: "trailing-slashes",
              label: "removes trailing separators",
              visibility: "check",
              args: ["/api/v1///"],
              assertions: [{
                id: "result",
                label: "returns /api/v1",
                kind: "deep-equal",
                expected: "/api/v1",
              }],
            },
          ],
        },
        {
          id: "longest-unique-window",
          order: 3,
          title: "Longest unique window",
          difficulty: "medium",
          language: "typescript",
          path: "longest-unique-window.ts",
          prompt: "Return the length of the longest contiguous part of the string that contains no repeated character.",
          constraints: [
            "The input contains at most 100,000 Unicode code points.",
            "The empty string has a longest window of zero.",
            "A correct one-pass sliding window is expected.",
          ],
          starterCode: `class Solution {
  longestUniqueWindow(text: string): number {
    // Move the left edge when a character repeats.
    return 0;
  }
}
`,
          entrypoint: {
            kind: "class-method",
            className: "Solution",
            methodName: "longestUniqueWindow",
          },
          objectiveIds: ["text-stack-methods"],
          sourceIds: ["latent-original"],
          runtimeId: "browser-typescript",
          tags: ["strings", "maps", "sliding-window"],
          cases: [
            {
              id: "overlapping-repeat",
              label: "moves past a repeated character",
              visibility: "example",
              args: ["turbot"],
              assertions: [{
                id: "result",
                label: "returns 5",
                kind: "deep-equal",
                expected: 5,
              }],
            },
            {
              id: "all-same",
              label: "handles one repeated character",
              visibility: "example",
              args: ["aaaa"],
              assertions: [{
                id: "result",
                label: "returns 1",
                kind: "deep-equal",
                expected: 1,
              }],
            },
            {
              id: "empty",
              label: "handles an empty string",
              visibility: "check",
              args: [""],
              assertions: [{
                id: "result",
                label: "returns 0",
                kind: "deep-equal",
                expected: 0,
              }],
            },
            {
              id: "late-window",
              label: "finds a longest window near the end",
              visibility: "check",
              args: ["abbaefg"],
              assertions: [{
                id: "result",
                label: "returns 5",
                kind: "deep-equal",
                expected: 5,
              }],
            },
          ],
        },
      ],
    },
  ],
} satisfies QuestionGroupLibrary;

export type MethodQuestionGroup = (typeof methodQuestionLibrary.groups)[number];
export type MethodQuestion = MethodQuestionGroup["questions"][number];

export const methodQuestionGroups = methodQuestionLibrary.groups;
export const methodQuestions = methodQuestionGroups.flatMap((group) => (
  group.questions.map((question) => ({ ...question, groupId: group.id }))
));
