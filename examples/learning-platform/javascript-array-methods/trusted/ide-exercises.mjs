export const ideExercises = [
  {
    id: "initials-from-name",
    contractVersion: "2",
    title: "Build initials from a name",
    summary: "Use a short array-method pipeline to turn words into initials.",
    language: "javascript",
    files: [
      {
        path: "initials.js",
        content: `/**
 * @param {string} name
 * @returns {string}
 */
function initials(name) {
  // Trim the name, split it into words, and return uppercase initials.
  return "";
}
`,
      },
    ],
    entrypoint: {
      kind: "function",
      functionName: "initials",
    },
    limits: {
      timeoutMs: 1500,
      maxOutputBytes: 50000,
    },
    checks: [
      {
        id: "ordinary-name",
        label: "uses every word",
        args: ["Ada Lovelace"],
        expected: "AL",
      },
      {
        id: "surrounding-space",
        label: "ignores surrounding whitespace",
        args: ["  Grace Brewster Murray Hopper  "],
        expected: "GBMH",
      },
      {
        id: "single-name",
        label: "handles one word",
        args: ["Prince"],
        expected: "P",
      },
    ],
  },
];
