# Latent Question Groups

Question groups are a portable, model-neutral primitive for programming
practice. A person or LLM can author the same declarative JSON, validate it
with Course Kit, and host the file on any static server.

**Status: complete in the Course Kit v0.2 source tree; published availability
still follows the repository release status.**

The format is versioned separately from Learning Pack v1. This keeps
the released lesson and flash-card contract byte-for-byte compatible while
giving practice questions a clean schema of their own.

- [Checked-in JSON Schema](../packages/course-kit/schema/question-group-library.schema.json)
- [Checked-in progress JSON Schema](../packages/course-kit/schema/question-group-progress.schema.json)
- Planned permanent URL after the v0.2 release:
  `https://model-systems-labs.github.io/latent/question-groups/v1/question-group-library.schema.json`
- Planned progress-schema URL after the v0.2 release:
  `https://model-systems-labs.github.io/latent/question-groups/v1/question-group-progress.schema.json`

The planned URL may return `404` before `course-kit-v0.2.0` is tagged. Once the
release workflow publishes `/question-groups/v1/`, those exact bytes become
immutable.

## Layering

```text
question-group library (portable JSON)
        ↓
reader adapter (validated data → host-owned contracts)
        ↓
language runtime (isolated learner code)
        ↓
bounded runtime result
        ↓
host source and contract binding
        ↓
practice UI and device-local progress
```

Course Kit owns the portable data, progress snapshot, host-injected player
contract, and static build. It has no React or application persistence
dependency. A compatible reader still decides whether and how to execute
learner code. The static build bundles a browser-worker JavaScript/TypeScript
adapter; a trusted host may inject another adapter at build time.

Latent's built-in practice site uses the shared CodeMirror editor, Browser Lab
for JavaScript and TypeScript, and a separate practice progress store. It does
not reuse lesson completion, the cumulative course project, or flash-card
ratings.

## What a library can declare

A library declares authors, an SPDX license, source revision, learning
objectives, source records, bounded namespaced extensions, and explicit runtime
requirements. It then contains ordered question groups. Each question declares:

- A stable id, order, title, prompt, difficulty, tags, and constraints.
- JavaScript, TypeScript, or Python as its language.
- A safe relative source path without `.` or `..` segments, and starter source.
- A function or class-method entrypoint.
- Objective and source references plus one declared runtime requirement.
- Bounded JSON arguments.
- Example and additional check cases.
- Data-only assertions such as deep equality, type, range, length, inclusion,
  regular-expression matching, or an expected exception.

Regular-expression assertions use ECMAScript `RegExp` syntax. Course Kit
rejects invalid patterns during full validation, before a reader sees them.

The format never accepts executable test strings, HTML, components, workers,
iframes, credentials, runtime module URLs, or publisher-defined hooks. A
namespaced extension remains bounded JSON and grants no capability. Cases are
visible learning checks, not secret certification tests.

## Validate the complete contract

The JSON Schema checks the versioned document shape, strict fields,
types, and size bounds. It cannot express every cross-field rule in the
portable contract. Full Course Kit validation additionally checks unique ids
and ordering, language-specific paths and non-reserved entrypoint names,
example and check coverage, constructor-argument use, assertion combinations,
and ECMAScript regular-expression syntax. It also verifies objective, source,
and runtime references; runtime language and capability compatibility; unique
metadata ids; extension bounds; and the rule that portable browser workers are
JavaScript or TypeScript, never Python.

Run the full validator before publishing; JSON Schema success alone is not the
publication gate:

```sh
latent-learning questions validate question-group-library.json --strict
latent-learning questions build question-group-library.json --out-dir dist
latent-learning questions serve dist
```

```js
import { readFile } from "node:fs/promises";
import { parseQuestionGroupLibraryJson } from "@latent/course-kit/question-group";

const source = await readFile("question-group-library.json", "utf8");
const result = parseQuestionGroupLibraryJson(source);

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`${error.path}: ${error.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${result.summary.questions} questions.`);
}
```

## Trust boundary

Hosting a library does not grant it execution privileges in another site.
Readers must validate the complete file before use, map the data into their own
host-owned checks, and run learner source outside the page realm.

Latent executes its built-in reviewed library. An arbitrary hosted library
does not automatically gain access to Latent's privileged runtimes. A
publisher explicitly authorizes its own library by building a standalone site,
or serves the JSON for another reader.

The bundled static player compiles JavaScript and TypeScript with esbuild and
runs the result in a disposable worker with declared time and output limits.
The bundled compiler parses and lowers native dynamic-import syntax, including
comment- or whitespace-separated forms, before worker evaluation. The worker
provides no module loader and disables the string forms of `setTimeout` and
`setInterval` that browsers otherwise evaluate as code. Before learner
evaluation, the checker locks every intrinsic it uses for grading. Returned
values must survive structured cloning, contain finite JSON data, and use only
plain object or array prototypes; accepted data is then copied into
null-prototype containers. Paths and sparse-array positions use own properties
only. The page validates the complete worker response again, and the worker
removes known browser network globals and fails closed if a denied capability
cannot be disabled. The generated `_headers` file and bundled preview server
add a `connect-src 'none'` worker policy as defense in depth, not as the primary
dynamic-import control. These guarantees apply to the bundled adapter; a
build-time injected adapter is trusted platform code and must provide
equivalent isolation. Python requirements must use `host-managed`; Course Kit
neither downloads nor advertises a remote Python sandbox.

## Injectable player and progress

Trusted platform code can `await createQuestionGroupPlayer(...)` with a
validated library, its canonical SHA-256 digest, a runtime adapter, and an
optional progress store. Player creation recomputes the canonical digest and
refuses a mismatch. The JSON selects only a declared runtime id. It cannot
supply, import, or redirect the adapter.

A progress store implements `transact(identity, update)` as a linearizable
transaction for that identity across every tab, worker, and player instance
sharing the store. A separate `get` followed by `put` is not conforming because
concurrent checks would lose attempts. Example-only runs never write progress
or mark a question solved; only a complete `check` run enters the transaction.
The generated static player uses one IndexedDB read-write transaction per
question check, so concurrent tabs preserve both attempts. Each run is bound to
its starting question and source revision; navigation is disabled while it is
pending, and an invalidated outcome is discarded before rendering or writing
progress.

Portable progress snapshots intentionally omit learner source and
storage-specific revision data. They bind status and counters to the exact
canonical library digest plus library, group, question, and contract versions.
`queryQuestionGroupProgress(records, { kind: "leeches" })` selects unsolved
questions with repeated misses (three attempts and two failures by default).
The generated `/leeches/` page applies that query to device-local progress;
it re-evaluates the query after every check so a solved question disappears
immediately. “Leech” is not a content type.

## Small valid library

This complete library passes full Course Kit validation:

```json
{
  "format": "latent-question-group-library",
  "schemaVersion": 1,
  "library": {
    "id": "publisher/topic",
    "version": "1.0.0",
    "title": "Topic practice",
    "description": "A complete description of the practice library.",
    "authors": [
      {
        "name": "Example Publisher",
        "url": "https://example.com"
      }
    ],
    "license": {
      "expression": "CC-BY-4.0",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "provenance": {
      "sourceUrl": "https://example.com/topic-practice",
      "revision": "1.0.0"
    }
  },
  "objectives": [
    {
      "id": "add-values",
      "title": "Add numeric values",
      "description": "Implement a class method that adds two finite numeric arguments."
    }
  ],
  "sources": [
    {
      "id": "original-prompt",
      "title": "Original example prompt",
      "url": "https://example.com/topic-practice",
      "note": "Original practice prompt written by Example Publisher.",
      "license": {
        "expression": "CC-BY-4.0"
      }
    }
  ],
  "runtimes": [
    {
      "id": "browser-javascript",
      "language": "javascript",
      "environment": "browser-worker",
      "engine": "esbuild-wasm",
      "engineVersion": "0.28.1",
      "capabilities": [
        "class-method"
      ],
      "limits": {
        "timeoutMs": 1000,
        "maxOutputBytes": 50000
      }
    }
  ],
  "groups": [
    {
      "id": "arithmetic",
      "order": 1,
      "title": "Arithmetic warmups",
      "description": "Practice a small class method with visible, data-only cases.",
      "objectiveIds": [
        "add-values"
      ],
      "questions": [
        {
          "id": "add-two-values",
          "order": 1,
          "title": "Add two values",
          "prompt": "Implement the method so it returns the sum of its two numeric arguments.",
          "difficulty": "easy",
          "language": "javascript",
          "path": "add-two-values.js",
          "starterCode": "class Solution {\n  add(left, right) {\n    return 0;\n  }\n}\n",
          "entrypoint": {
            "kind": "class-method",
            "className": "Solution",
            "methodName": "add"
          },
          "objectiveIds": [
            "add-values"
          ],
          "sourceIds": [
            "original-prompt"
          ],
          "runtimeId": "browser-javascript",
          "constraints": [
            "Both arguments are finite JSON numbers."
          ],
          "cases": [
            {
              "id": "small-values",
              "label": "adds two small values",
              "visibility": "example",
              "args": [2, 3],
              "assertions": [
                {
                  "id": "expected-sum",
                  "label": "returns five",
                  "kind": "deep-equal",
                  "expected": 5
                }
              ]
            },
            {
              "id": "negative-value",
              "label": "adds a negative value",
              "visibility": "check",
              "args": [-3, 8],
              "assertions": [
                {
                  "id": "expected-sum",
                  "label": "returns five",
                  "kind": "deep-equal",
                  "expected": 5
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Versioning

After v1 is published, publishers must put changed content under a new semantic
library version. A future incompatible schema receives a new
`/question-groups/vN/` path rather than replacing the published v1 bytes.
